import { h } from './ui.js';
import { randomInt } from './random.js';

const SPIN_ITEMS = 48;
const BULBS = 11;

// Lostrommel im Stil eines einarmigen Banditen. Das Ergebnis steht vorher fest,
// die Animation landet nur darauf.
export function createSlotMachine() {
  const strip = h('ul', { class: 'reel-strip' });
  const element = h('div', { class: 'slot-machine', 'aria-hidden': 'true' },
    lights(),
    h('div', { class: 'reel' }, strip, h('div', { class: 'reel-marker' })),
    lights());
  fill(strip, ['?', '?', '?']);
  return {
    element,
    spin: (names, target) => spin(element, strip, names, target)
  };
}

function lights() {
  const row = h('div', { class: 'slot-lights' });
  for (let i = 0; i < BULBS; i++) row.appendChild(h('span'));
  return row;
}

function fill(strip, names) {
  strip.textContent = '';
  names.forEach(name => strip.appendChild(h('li', null, h('span', null, name))));
}

function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function spin(element, strip, names, target) {
  const pool = names.length ? names : [target];
  const pick = avoid => {
    let name = pool[randomInt(pool.length)];
    for (let i = 0; pool.length > 1 && name === avoid && i < 20; i++) name = pool[randomInt(pool.length)];
    return name;
  };

  // Reihenfolge von oben nach unten: [Nachbar, Ziel, ...Namen, die vorher vorbeilaufen, Nachbar].
  // Der Streifen bewegt sich nach unten, die Namen kommen also von oben.
  const sequence = [];
  let previous = target;
  for (let i = 0; i < SPIN_ITEMS; i++) {
    previous = pick(previous);
    sequence.push(previous);
  }
  const items = [pick(target), target].concat(sequence, [pick(previous)]);
  fill(strip, items);

  // Sichtbar sind drei Zeilen, die mittlere ist die Gewinnzeile.
  const itemHeight = strip.firstChild.getBoundingClientRect().height;
  const from = -(items.length - 3) * itemHeight;
  const to = 0;
  strip.style.transform = 'translate3d(0,' + from + 'px,0)';

  const reduced = prefersReducedMotion();
  const duration = reduced ? 1200 : 6500;
  const overshoot = reduced ? 0 : itemHeight * 0.3;
  const settle = reduced ? 0 : 500;

  element.classList.remove('done');
  element.classList.add('spinning');

  return new Promise(resolve => {
    let start = null;
    function frame(now) {
      if (start === null) start = now;
      const t = now - start;
      let y;
      if (t < duration) {
        // Schnell los, dann immer langsamer.
        const p = t / duration;
        y = from + (to + overshoot - from) * (1 - Math.pow(1 - p, 4));
      } else if (t < duration + settle) {
        // Kleines Nachrucken zurück auf die Gewinnzeile.
        const p = (t - duration) / settle;
        y = to + overshoot * (1 + Math.cos(Math.PI * p)) / 2;
      } else {
        strip.style.transform = 'translate3d(0,0,0)';
        strip.children[1].classList.add('winner');
        element.classList.remove('spinning');
        element.classList.add('done');
        resolve();
        return;
      }
      strip.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}
