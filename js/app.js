import {
  auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  doc, collection, getDoc, getDocs, setDoc, updateDoc, serverTimestamp
} from './firebase.js';
import { adminUid } from './firebase-config.js';
import { credentialsFor } from './kennwort.js';
import { h, render, ask, linkify } from './ui.js';
import { createSlotMachine } from './slot.js';
import { confetti } from './confetti.js';

const MAX_WISHES = 50;
const root = document.getElementById('app');

start();

async function start() {
  const linkKennwort = takeKennwortFromLink();
  let linkError = null;
  if (linkKennwort) {
    try {
      await signIn(linkKennwort);
    } catch (e) {
      linkError = e;
    }
  }
  onAuthStateChanged(auth, user => {
    if (user) showHome(user);
    else showLogin(linkError ? loginErrorText(linkError) : '');
    linkError = null;
  });
}

// Persönlicher Link: .../#k=tanne-stern. Der Teil nach # wird nie an einen Server geschickt.
function takeKennwortFromLink() {
  const match = /[#&]k=([^&]+)/.exec(location.hash);
  if (!match) return null;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    return decodeURIComponent(match[1]);
  } catch (e) {
    return null;
  }
}

async function signIn(kennwort) {
  const credentials = await credentialsFor(kennwort);
  await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
}

function loginErrorText(error) {
  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-email':
      return 'Das Kennwort stimmt leider nicht. Bitte versuche es noch einmal.';
    case 'auth/too-many-requests':
      return 'Zu viele Versuche. Bitte warte ein paar Minuten und versuche es dann noch einmal.';
    case 'auth/network-request-failed':
      return 'Keine Verbindung zum Internet. Bitte prüfe deine Verbindung.';
    default:
      return 'Das hat leider nicht geklappt. Bitte versuche es später noch einmal.';
  }
}

function showLoading() {
  render(root, h('p', { class: 'loading' }, 'Einen Moment bitte ...'));
}

function logoutButton() {
  return h('div', { class: 'footer-actions' },
    h('button', { class: 'btn-text', type: 'button', onclick: () => signOut(auth) }, 'Abmelden'));
}

function showLogin(errorText) {
  const input = h('input', {
    id: 'kennwort', class: 'input', type: 'text',
    autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false'
  });
  const button = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Anmelden');
  const message = h('p', { class: 'message message--error', role: 'alert' }, errorText);

  const form = h('form', {
    class: 'card card--red',
    onsubmit: async e => {
      e.preventDefault();
      if (!input.value.trim()) {
        input.focus();
        return;
      }
      button.disabled = true;
      button.textContent = 'Einen Moment bitte ...';
      message.textContent = '';
      try {
        await signIn(input.value);
      } catch (err) {
        message.textContent = loginErrorText(err);
        button.disabled = false;
        button.textContent = 'Anmelden';
        input.select();
      }
    }
  },
  h('h2', null, 'Willkommen!'),
  h('p', null, 'Bitte gib dein persönliches Kennwort ein. Groß- und Kleinschreibung ist egal.'),
  h('div', { class: 'field' }, h('label', { for: 'kennwort' }, 'Dein Kennwort'), input),
  button,
  message);

  render(root, form);
}

async function showHome(user) {
  showLoading();

  if (user.uid === adminUid) {
    render(root,
      h('section', { class: 'card' },
        h('h2', null, 'Du bist als Admin angemeldet'),
        h('p', null, 'Die Verwaltung findest du hier:'),
        h('a', { class: 'btn btn-primary', href: 'admin.html' }, 'Zur Verwaltung')),
      logoutButton());
    return;
  }

  let state;
  try {
    state = await loadState(user.uid);
  } catch (e) {
    console.error(e);
    render(root,
      h('section', { class: 'card card--red' },
        h('h2', null, 'Das hat nicht geklappt'),
        h('p', null, 'Die Daten konnten nicht geladen werden. Bitte lade die Seite neu.'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => location.reload() }, 'Seite neu laden')),
      logoutButton());
    return;
  }

  if (!state) {
    render(root,
      h('section', { class: 'card card--red' },
        h('h2', null, 'Kennwort nicht mehr gültig'),
        h('p', null, 'Dieses Kennwort gilt nicht mehr. Bitte frag nach deinem neuen Kennwort.')),
      logoutButton());
    return;
  }

  const partnerCard = h('section', { class: 'card card--red' });
  const wishCard = h('section', { class: 'card' });
  render(root, h('p', { class: 'greeting' }, 'Hallo ' + state.me.name + '!'), partnerCard, wishCard, logoutButton());
  renderPartner(partnerCard, state);
  renderWishlist(wishCard, state);
}

async function loadState(uid) {
  const account = await getDoc(doc(db, 'accounts', uid));
  if (!account.exists()) return null;
  const pid = account.data().participantId;

  const results = await Promise.all([
    getDocs(collection(db, 'participants')),
    getDoc(doc(db, 'settings', 'main')),
    getDoc(doc(db, 'assignments', pid)),
    getDoc(doc(db, 'wishlists', pid))
  ]);

  const people = {};
  results[0].forEach(d => { people[d.id] = d.data(); });
  if (!people[pid]) return null;

  return {
    pid,
    people,
    me: people[pid],
    budget: results[1].exists() ? (results[1].data().budget || '') : '',
    assignment: results[2].exists() ? results[2].data() : null,
    wishes: results[3].exists() ? (results[3].data().items || []) : []
  };
}

function renderPartner(card, state) {
  const assignment = state.assignment;

  if (!assignment) {
    render(card,
      h('h2', null, 'Dein Wichtelpartner'),
      h('p', null, 'Die Auslosung ist noch nicht freigegeben. Schau einfach in ein paar Tagen wieder vorbei.'),
      h('p', { class: 'hint' }, 'Deine Wunschliste kannst du schon jetzt ausfüllen.'));
    return;
  }

  const receiver = state.people[assignment.receiverId] || { name: '?' };

  if (assignment.revealed) {
    render(card,
      h('h2', null, 'Dein Wichtelpartner'),
      h('p', { class: 'result-label' }, 'Du beschenkst'),
      h('p', { class: 'result-name' }, receiver.name),
      receiverWishes(assignment.receiverId, receiver.name));
    return;
  }

  const heading = h('h2', null, 'Wen beschenkst du?');
  const intro = h('p', null, 'Jetzt bist du dran! Drücke auf den Knopf und finde heraus, wem du dieses Jahr eine Freude machst.');
  const slot = createSlotMachine();
  const button = h('button', { class: 'btn btn-primary btn-block btn-large', type: 'button' }, 'Jetzt auslosen');
  render(card, heading, intro, slot.element, button);

  button.addEventListener('click', async () => {
    button.remove();
    intro.textContent = 'Die Lostrommel dreht sich ...';
    await slot.spin(reelNames(state), receiver.name);
    confetti(slot.element);
    heading.textContent = 'Dein Wichtelpartner';
    intro.remove();
    card.appendChild(h('p', { class: 'result-label' }, 'Du beschenkst'));
    card.appendChild(h('p', { class: 'result-name' }, receiver.name));
    card.appendChild(receiverWishes(assignment.receiverId, receiver.name));
    updateDoc(doc(db, 'assignments', state.pid), { revealed: true, revealedAt: serverTimestamp() })
      .catch(e => console.error(e));
  });
}

// Auf der Lostrommel erscheinen nur Personen, die man überhaupt ziehen könnte.
function reelNames(state) {
  const exclusions = state.me.exclusions || [];
  return Object.keys(state.people)
    .filter(id => id !== state.pid && exclusions.indexOf(id) === -1)
    .map(id => state.people[id].name);
}

function receiverWishes(receiverId, name) {
  const box = h('div', { class: 'receiver-wishes' }, h('p', { class: 'hint' }, 'Wünsche werden geladen ...'));
  getDoc(doc(db, 'wishlists', receiverId))
    .then(snap => {
      const items = snap.exists() ? (snap.data().items || []) : [];
      render(box,
        h('h3', null, 'Das wünscht sich ' + name + ':'),
        items.length
          ? h('ul', { class: 'wish-list wish-list--read' },
            items.map(item => h('li', null, h('span', { class: 'wish-text' }, linkify(item.text)))))
          : h('p', { class: 'empty' }, name + ' hat noch keine Wünsche eingetragen. Schau später noch einmal vorbei.'));
    })
    .catch(e => {
      console.error(e);
      render(box, h('p', { class: 'message message--error' }, 'Die Wünsche konnten nicht geladen werden. Bitte lade die Seite neu.'));
    });
  return box;
}

function renderWishlist(card, state) {
  const list = h('ul', { class: 'wish-list' });
  const empty = h('p', { class: 'empty' }, 'Du hast noch keine Wünsche eingetragen.');
  const input = h('input', { id: 'new-wish', class: 'input', type: 'text', maxlength: '300', autocomplete: 'off' });
  const button = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Hinzufügen');
  const message = h('p', { class: 'message', role: 'status' });

  function showMessage(text, ok) {
    message.className = 'message ' + (ok ? 'message--ok' : 'message--error');
    message.textContent = text;
  }

  function draw() {
    render(list, state.wishes.map(item => h('li', null,
      h('span', { class: 'wish-text' }, linkify(item.text)),
      h('button', { class: 'btn btn-secondary btn-small', type: 'button', onclick: () => remove(item) }, 'Entfernen'))));
    list.hidden = state.wishes.length === 0;
    empty.hidden = state.wishes.length > 0;
  }

  async function save(items, successText) {
    const previous = state.wishes;
    state.wishes = items;
    draw();
    try {
      await setDoc(doc(db, 'wishlists', state.pid), { items, updatedAt: serverTimestamp() });
      showMessage(successText, true);
      return true;
    } catch (e) {
      console.error(e);
      state.wishes = previous;
      draw();
      showMessage('Das Speichern hat nicht geklappt. Bitte versuche es noch einmal.', false);
      return false;
    }
  }

  async function remove(item) {
    const confirmed = await ask({
      title: 'Wunsch entfernen?',
      text: '„' + item.text + '“ wird von deiner Liste gelöscht.',
      okLabel: 'Ja, entfernen'
    });
    if (confirmed) save(state.wishes.filter(w => w.id !== item.id), 'Der Wunsch wurde entfernt.');
  }

  const form = h('form', {
    class: 'subform',
    onsubmit: async e => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) {
        input.focus();
        return;
      }
      if (state.wishes.length >= MAX_WISHES) {
        showMessage('Deine Liste ist voll. Bitte entferne zuerst einen Wunsch.', false);
        return;
      }
      button.disabled = true;
      const item = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), text };
      if (await save(state.wishes.concat([item]), 'Dein Wunsch wurde gespeichert.')) input.value = '';
      button.disabled = false;
      input.focus();
    }
  },
  h('label', { for: 'new-wish' }, 'Neuer Wunsch'),
  h('div', { class: 'form-row form-row--inline' }, input, button));

  render(card,
    h('h2', null, 'Deine Wunschliste'),
    state.budget ? h('p', { class: 'budget' }, 'Budget: ' + state.budget) : null,
    h('p', { class: 'hint' }, 'Nur die Person, die dich gezogen hat, kann diese Liste sehen.'),
    list,
    empty,
    form,
    message);
  draw();
}
