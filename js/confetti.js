const COLORS = ['#a3262a', '#c99a2e', '#1f5039', '#f1dfae', '#2f6b4f', '#d6453f'];

// Konfetti-Explosion aus der Mitte von origin plus etwas Konfetti-Regen von oben.
export function confetti(origin) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.scale(ratio, ratio);

  const rect = origin.getBoundingClientRect();
  const pieces = [];
  for (let i = 0; i < 160; i++) {
    pieces.push(piece(rect.left + rect.width / 2, rect.top + rect.height / 2, true));
  }
  for (let i = 0; i < 90; i++) {
    pieces.push(piece(Math.random() * width, -20 - Math.random() * height * 0.6, false));
  }

  let start = null;
  let last = null;
  function frame(now) {
    if (start === null) start = last = now;
    const step = Math.min(3, (now - last) / 16.67);
    last = now;
    ctx.clearRect(0, 0, width, height);

    let visible = false;
    const drag = Math.pow(0.95, step);
    pieces.forEach(p => {
      p.vx *= drag;
      p.vy = p.vy * drag + 0.25 * step;
      p.flip += p.flipSpeed * step;
      p.rotation += p.spin * step;
      p.x += (p.vx + Math.sin(p.flip) * 0.6) * step;
      p.y += p.vy * step;
      if (p.y < height + 20) visible = true;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(1, Math.cos(p.flip));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
      ctx.restore();
    });

    if (visible && now - start < 8000) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

function piece(x, y, burst) {
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
  const speed = burst ? 9 + Math.random() * 13 : 0;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed + (burst ? 0 : (Math.random() - 0.5) * 2),
    vy: Math.sin(angle) * speed,
    size: 7 + Math.random() * 7,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.3,
    flip: Math.random() * Math.PI * 2,
    flipSpeed: 0.08 + Math.random() * 0.12
  };
}
