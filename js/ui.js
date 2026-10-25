const PROPERTIES = ['value', 'disabled', 'checked', 'selected', 'hidden'];

// Kleiner DOM-Helfer: h('p', { class: 'hint' }, 'Text', kindElement, [weitere]).
// Texte werden immer als Text eingefügt, nie als HTML.
export function h(tag, props, ...children) {
  const node = document.createElement(tag);
  if (props) {
    Object.keys(props).forEach(key => {
      const value = props[key];
      if (value === null || value === undefined || value === false) return;
      if (key === 'class') node.className = value;
      else if (key.indexOf('on') === 0) node.addEventListener(key.slice(2), value);
      else if (PROPERTIES.indexOf(key) !== -1) node[key] = value;
      else node.setAttribute(key, value === true ? '' : value);
    });
  }
  append(node, children);
  return node;
}

function append(node, child) {
  if (child === null || child === undefined || child === false) return;
  if (Array.isArray(child)) {
    child.forEach(c => append(node, c));
    return;
  }
  node.appendChild(child.nodeType ? child : document.createTextNode(String(child)));
}

export function render(container, ...children) {
  container.textContent = '';
  append(container, children);
}

// Macht Internet-Adressen in Wünschen anklickbar.
export function linkify(text) {
  return String(text)
    .split(/(https?:\/\/[^\s]+)/g)
    .map((part, i) => (i % 2 === 1
      ? h('a', { href: part, target: '_blank', rel: 'noopener noreferrer' }, part)
      : part))
    .filter(part => part !== '');
}

// Eigenes Popup statt confirm()/prompt(): große Knöpfe, deutsche Beschriftung.
// Ohne input: liefert true/false. Mit input: liefert den Text oder null.
export function ask(options) {
  const o = Object.assign({ okLabel: 'OK', cancelLabel: 'Abbrechen' }, options);
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const field = o.input
      ? h('input', {
        id: 'modal-input', class: 'input', type: 'text', value: o.input.value || '',
        autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false'
      })
      : null;
    const ok = h('button', { class: 'btn btn-primary', type: 'submit' }, o.okLabel);
    const cancel = o.cancelLabel
      ? h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => close(null) }, o.cancelLabel)
      : null;
    const suggest = o.input && o.input.suggest
      ? h('button', {
        class: 'btn btn-secondary', type: 'button',
        onclick: () => { field.value = o.input.suggest(); field.focus(); }
      }, 'Anderer Vorschlag')
      : null;

    const dialog = h('form', {
      class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-title',
      onsubmit: e => { e.preventDefault(); close(field ? field.value : true); }
    },
    h('h2', { id: 'modal-title' }, o.title),
    o.text ? h('p', null, o.text) : null,
    field ? h('div', { class: 'field' },
      h('label', { for: 'modal-input' }, o.input.label),
      h('div', { class: 'form-row form-row--inline' }, field, suggest)) : null,
    o.extra || null,
    h('div', { class: 'modal-actions' }, cancel, ok));

    const backdrop = h('div', {
      class: 'modal-backdrop',
      onclick: e => { if (e.target === backdrop) close(null); }
    }, dialog);

    function onKey(e) {
      if (e.key === 'Escape') close(null);
    }

    function close(result) {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      if (previousFocus && previousFocus.focus) previousFocus.focus();
      resolve(o.input ? result : result === true);
    }

    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);
    (field || ok).focus();
  });
}

let toastTimer = null;

export function flash(text, kind) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const toast = h('div', { class: 'toast' + (kind === 'error' ? ' toast--error' : ''), role: 'status' }, text);
  document.body.appendChild(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.remove(), kind === 'error' ? 7000 : 4500);
}
