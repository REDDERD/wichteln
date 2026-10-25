import {
  auth, db, getSecondaryAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, deleteUser,
  doc, collection, getDoc, getDocs, setDoc, writeBatch, serverTimestamp, arrayUnion, arrayRemove, deleteField
} from './firebase.js';
import { adminUid } from './firebase-config.js';
import { credentialsFor, normalizeKennwort, suggestKennwort, personalLink } from './kennwort.js';
import { drawAssignment } from './draw.js';
import { renderGraph } from './graph.js';
import { h, render, ask, flash } from './ui.js';

const root = document.getElementById('app');

// { settings, people: [{ id, name, exclusions, kennwort, uid }], assignments: { giverId: { receiverId, revealed } }, drawn }
let state = null;
let showNames = false;

onAuthStateChanged(auth, user => {
  showNames = false;
  if (!user) showLogin();
  else if (user.uid !== adminUid) showNotAdmin();
  else reload().catch(e => {
    console.error(e);
    render(root, h('section', { class: 'card card--red' },
      h('h2', null, 'Fehler beim Laden'),
      h('p', null, 'Die Daten konnten nicht geladen werden. Stimmen die Admin-UID in firestore.rules und firebase-config.js?'),
      h('p', { class: 'hint' }, String(e.code || e.message))), logoutButton());
  });
});

function fail(message) {
  const error = new Error(message);
  error.userMessage = message;
  throw error;
}

// Führt eine Änderung aus, lädt danach alles neu und meldet das Ergebnis.
async function act(button, task, successText) {
  if (button) button.disabled = true;
  try {
    await task();
    await reload();
    if (successText) flash(successText);
  } catch (e) {
    console.error(e);
    flash(e.userMessage || 'Das hat nicht geklappt: ' + (e.code || e.message), 'error');
    if (button) button.disabled = false;
  }
}

function field(labelText, input) {
  return h('div', { class: 'field' }, h('label', { for: input.id }, labelText), input);
}

function logoutButton() {
  return h('div', { class: 'footer-actions' },
    h('button', { class: 'btn-text', type: 'button', onclick: () => signOut(auth) }, 'Abmelden'));
}

function showLogin() {
  const email = h('input', { id: 'email', class: 'input', type: 'email', autocomplete: 'username' });
  const password = h('input', { id: 'password', class: 'input', type: 'password', autocomplete: 'current-password' });
  const button = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Anmelden');
  const message = h('p', { class: 'message message--error', role: 'alert' });
  render(root, h('form', {
    class: 'card card--red',
    onsubmit: async e => {
      e.preventDefault();
      button.disabled = true;
      message.textContent = '';
      try {
        await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
      } catch (err) {
        message.textContent = 'Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.';
        button.disabled = false;
      }
    }
  },
  h('h2', null, 'Verwaltung'),
  field('E-Mail', email),
  field('Passwort', password),
  button,
  message));
}

function showNotAdmin() {
  render(root,
    h('section', { class: 'card card--red' },
      h('h2', null, 'Kein Zugriff'),
      h('p', null, 'Du bist mit einem Teilnehmer-Kennwort angemeldet. Für die Verwaltung bitte abmelden und mit dem Admin-Konto anmelden.')),
    logoutButton());
}

async function reload() {
  const results = await Promise.all([
    getDoc(doc(db, 'settings', 'main')),
    getDocs(collection(db, 'participants')),
    getDocs(collection(db, 'secrets')),
    getDocs(collection(db, 'assignments'))
  ]);

  const secrets = {};
  results[2].forEach(d => { secrets[d.id] = d.data(); });

  const people = [];
  results[1].forEach(d => {
    const secret = secrets[d.id] || {};
    people.push({
      id: d.id,
      name: d.data().name,
      exclusions: d.data().exclusions || [],
      kennwort: secret.kennwort || '',
      uid: secret.uid || ''
    });
  });
  people.sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const assignments = {};
  results[3].forEach(d => { assignments[d.id] = d.data(); });

  state = {
    settings: results[0].exists() ? results[0].data() : {},
    people,
    assignments,
    drawn: Object.keys(assignments).length > 0
  };
  renderAdmin();
}

function renderAdmin() {
  render(root,
    budgetSection(),
    peopleSection(),
    exclusionsSection(),
    drawSection(),
    graphSection(),
    logoutButton());
}

function peopleById() {
  const byId = {};
  state.people.forEach(p => { byId[p.id] = p; });
  return byId;
}

/* ---------- Budget ---------- */

function budgetSection() {
  const input = h('input', { id: 'budget', class: 'input', type: 'text', value: state.settings.budget || '', placeholder: 'z. B. 25 Euro' });
  const button = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Speichern');
  return h('section', { class: 'card' },
    h('h2', null, 'Budget'),
    h('p', { class: 'hint' }, 'Wird allen beim Bearbeiten ihrer Wunschliste angezeigt.'),
    h('form', {
      onsubmit: e => {
        e.preventDefault();
        act(button, () => setDoc(doc(db, 'settings', 'main'), { budget: input.value.trim() }, { merge: true }), 'Budget gespeichert.');
      }
    },
    h('label', { for: 'budget' }, 'Budget pro Geschenk'),
    h('div', { class: 'form-row form-row--inline' }, input, button)));
}

/* ---------- Teilnehmer ---------- */

function peopleSection() {
  const locked = state.drawn;
  const name = h('input', { id: 'new-name', class: 'input', type: 'text', autocomplete: 'off', disabled: locked });
  const kennwort = h('input', {
    id: 'new-kennwort', class: 'input', type: 'text', autocomplete: 'off', autocapitalize: 'none',
    spellcheck: 'false', value: suggestKennwort(), disabled: locked
  });
  const suggest = h('button', {
    class: 'btn btn-secondary', type: 'button', disabled: locked,
    onclick: () => { kennwort.value = suggestKennwort(); }
  }, 'Anderer Vorschlag');
  const add = h('button', { class: 'btn btn-primary', type: 'submit', disabled: locked }, 'Teilnehmer hinzufügen');

  const form = h('form', {
    class: 'subform',
    onsubmit: e => {
      e.preventDefault();
      const newName = name.value.trim();
      act(add, () => addPerson(newName, kennwort.value), newName + ' wurde hinzugefügt.');
    }
  },
  h('h3', null, 'Neuer Teilnehmer'),
  field('Name', name),
  h('div', { class: 'field' },
    h('label', { for: 'new-kennwort' }, 'Kennwort'),
    h('div', { class: 'form-row form-row--inline' }, kennwort, suggest)),
  add);

  return h('section', { class: 'card' },
    h('h2', null, 'Teilnehmer (' + state.people.length + ')'),
    locked ? h('p', { class: 'message message--info' }, 'Die Auslosung ist vorbereitet. Um Teilnehmer hinzuzufügen oder zu entfernen, setze zuerst die Auslosung zurück.') : null,
    state.people.length
      ? h('ul', { class: 'person-list' }, state.people.map(personRow))
      : h('p', { class: 'empty' }, 'Noch keine Teilnehmer.'),
    form);
}

function personRow(person) {
  const assignment = state.assignments[person.id];
  const status = state.drawn ? (assignment && assignment.revealed ? 'hat schon gelost' : 'hat noch nicht gelost') : null;
  return h('li', { class: 'person' },
    h('div', { class: 'person-info' },
      h('div', { class: 'person-name' }, person.name),
      h('div', { class: 'person-meta' },
        'Kennwort: ', h('span', { class: 'kennwort' }, person.kennwort),
        status ? ' · ' + status : null)),
    h('div', { class: 'person-actions' },
      h('button', { class: 'btn btn-secondary btn-small', type: 'button', onclick: () => copyInvitation(person) }, 'Einladung kopieren'),
      h('button', { class: 'btn btn-secondary btn-small', type: 'button', onclick: e => changeKennwort(person, e.currentTarget) }, 'Kennwort ändern'),
      h('button', { class: 'btn btn-danger btn-small', type: 'button', disabled: state.drawn, onclick: e => removePerson(person, e.currentTarget) }, 'Entfernen')));
}

function invitationText(person) {
  return 'Hallo ' + person.name + ',\n' +
    'hier ist dein Zugang zum Familien-Wichteln:\n' +
    personalLink(person.kennwort) + '\n' +
    'Einfach antippen, dann bist du angemeldet.\n' +
    'Falls du nach einem Kennwort gefragt wirst: ' + person.kennwort;
}

async function copyInvitation(person) {
  const text = invitationText(person);
  try {
    await navigator.clipboard.writeText(text);
    flash('Einladung für ' + person.name + ' kopiert. Du kannst sie jetzt z. B. in WhatsApp einfügen.');
  } catch (e) {
    await ask({
      title: 'Einladung für ' + person.name,
      text: 'Bitte markiere den Text und kopiere ihn:',
      extra: h('textarea', { class: 'input textarea', readonly: true, rows: '6' }, text),
      okLabel: 'Schließen',
      cancelLabel: null
    });
  }
}

function checkKennwort(kennwort, exceptId) {
  if (kennwort.length < 4) fail('Das Kennwort muss mindestens 4 Zeichen lang sein.');
  if (state.people.some(p => p.id !== exceptId && p.kennwort === kennwort)) {
    fail('Dieses Kennwort ist schon vergeben. Bitte wähle ein anderes.');
  }
}

// Legt das Firebase-Konto zum Kennwort an. Gibt es das Konto schon (z. B. von einem früher
// entfernten Teilnehmer), wird es wiederverwendet.
async function authAccountFor(kennwort) {
  const secondary = getSecondaryAuth();
  const credentials = await credentialsFor(kennwort);
  try {
    try {
      return (await createUserWithEmailAndPassword(secondary, credentials.email, credentials.password)).user.uid;
    } catch (e) {
      if (e.code !== 'auth/email-already-in-use') throw e;
      return (await signInWithEmailAndPassword(secondary, credentials.email, credentials.password)).user.uid;
    }
  } finally {
    await signOut(secondary);
  }
}

async function deleteAuthAccount(kennwort) {
  const secondary = getSecondaryAuth();
  try {
    const credentials = await credentialsFor(kennwort);
    const result = await signInWithEmailAndPassword(secondary, credentials.email, credentials.password);
    await deleteUser(result.user);
  } catch (e) {
    // Nicht schlimm: Ohne Eintrag in "accounts" hat das Konto keinen Zugriff mehr.
    console.warn('Altes Konto konnte nicht gelöscht werden', e);
  } finally {
    try {
      await signOut(secondary);
    } catch (e) {
      console.warn(e);
    }
  }
}

async function addPerson(name, rawKennwort) {
  const kennwort = normalizeKennwort(rawKennwort);
  if (!name) fail('Bitte gib einen Namen ein.');
  if (state.people.some(p => p.name.toLowerCase() === name.toLowerCase())) fail('Es gibt schon jemanden mit diesem Namen.');
  checkKennwort(kennwort, null);

  const uid = await authAccountFor(kennwort);
  const pid = doc(collection(db, 'participants')).id;
  const batch = writeBatch(db);
  batch.set(doc(db, 'participants', pid), { name, exclusions: [] });
  batch.set(doc(db, 'secrets', pid), { kennwort, uid });
  batch.set(doc(db, 'accounts', uid), { participantId: pid });
  await batch.commit();
}

async function changeKennwort(person, button) {
  const value = await ask({
    title: 'Neues Kennwort für ' + person.name,
    text: 'Das alte Kennwort und die alte Einladung funktionieren danach nicht mehr.',
    input: { label: 'Neues Kennwort', value: suggestKennwort(), suggest: suggestKennwort },
    okLabel: 'Speichern'
  });
  if (value === null) return;

  act(button, async () => {
    const kennwort = normalizeKennwort(value);
    if (kennwort === person.kennwort) return;
    checkKennwort(kennwort, person.id);

    const uid = await authAccountFor(kennwort);
    const batch = writeBatch(db);
    batch.set(doc(db, 'secrets', person.id), { kennwort, uid });
    batch.set(doc(db, 'accounts', uid), { participantId: person.id });
    if (person.uid && person.uid !== uid) batch.delete(doc(db, 'accounts', person.uid));
    await batch.commit();
    if (person.kennwort) await deleteAuthAccount(person.kennwort);
  }, 'Kennwort für ' + person.name + ' geändert. Bitte schick die neue Einladung.');
}

async function removePerson(person, button) {
  const confirmed = await ask({
    title: person.name + ' entfernen?',
    text: 'Die Wunschliste von ' + person.name + ' wird dabei ebenfalls gelöscht.',
    okLabel: 'Ja, entfernen'
  });
  if (!confirmed) return;

  act(button, async () => {
    const byId = peopleById();
    const batch = writeBatch(db);
    batch.delete(doc(db, 'participants', person.id));
    batch.delete(doc(db, 'secrets', person.id));
    batch.delete(doc(db, 'wishlists', person.id));
    if (person.uid) batch.delete(doc(db, 'accounts', person.uid));
    person.exclusions.forEach(otherId => {
      if (byId[otherId]) batch.update(doc(db, 'participants', otherId), { exclusions: arrayRemove(person.id) });
    });
    await batch.commit();
    if (person.kennwort) await deleteAuthAccount(person.kennwort);
  }, person.name + ' wurde entfernt.');
}

/* ---------- Ausschlüsse ---------- */

function exclusionPairs() {
  const byId = peopleById();
  const seen = {};
  const pairs = [];
  state.people.forEach(p => p.exclusions.forEach(other => {
    if (!byId[other]) return;
    const pair = [p.id, other].sort();
    const key = pair.join('|');
    if (seen[key]) return;
    seen[key] = true;
    pairs.push(pair);
  }));
  return pairs;
}

function setExclusion(a, b, on) {
  const op = on ? arrayUnion : arrayRemove;
  const batch = writeBatch(db);
  batch.update(doc(db, 'participants', a), { exclusions: op(b) });
  batch.update(doc(db, 'participants', b), { exclusions: op(a) });
  return batch.commit();
}

function exclusionsSection() {
  const locked = state.drawn;
  const byId = peopleById();
  const pairs = exclusionPairs();
  const options = () => [h('option', { value: '' }, 'Bitte wählen')]
    .concat(state.people.map(p => h('option', { value: p.id }, p.name)));
  const first = h('select', { class: 'input', 'aria-label': 'Erste Person', disabled: locked }, options());
  const second = h('select', { class: 'input', 'aria-label': 'Zweite Person', disabled: locked }, options());
  const add = h('button', { class: 'btn btn-primary', type: 'submit', disabled: locked }, 'Ausschluss hinzufügen');

  return h('section', { class: 'card' },
    h('h2', null, 'Ausschlüsse'),
    h('p', { class: 'hint' }, 'Diese zwei Personen können sich gegenseitig nicht ziehen, z. B. Paare, die sich ohnehin beschenken.'),
    pairs.length
      ? h('ul', { class: 'person-list' }, pairs.map(pair => h('li', { class: 'person' },
        h('div', { class: 'person-info' },
          h('span', { class: 'person-name' }, byId[pair[0]].name + ' und ' + byId[pair[1]].name)),
        h('div', { class: 'person-actions' },
          h('button', {
            class: 'btn btn-danger btn-small', type: 'button', disabled: locked,
            onclick: e => act(e.currentTarget, () => setExclusion(pair[0], pair[1], false), 'Ausschluss entfernt.')
          }, 'Entfernen')))))
      : h('p', { class: 'empty' }, 'Noch keine Ausschlüsse.'),
    h('form', {
      class: 'subform',
      onsubmit: e => {
        e.preventDefault();
        act(add, () => {
          if (!first.value || !second.value) fail('Bitte zwei Personen auswählen.');
          if (first.value === second.value) fail('Bitte zwei verschiedene Personen auswählen.');
          return setExclusion(first.value, second.value, true);
        }, 'Ausschluss gespeichert.');
      }
    },
    h('h3', null, 'Neuer Ausschluss'),
    h('div', { class: 'form-row form-row--inline' }, first, second),
    add));
}

/* ---------- Auslosung ---------- */

function countRevealed() {
  return Object.keys(state.assignments).filter(id => state.assignments[id].revealed).length;
}

function drawSection() {
  if (!state.drawn) {
    return h('section', { class: 'card card--red' },
      h('h2', null, 'Auslosung'),
      h('p', null, 'Wenn alle Teilnehmer und Ausschlüsse eingetragen sind, wird hier die Zuordnung festgelegt. Danach lost jeder bei der Anmeldung selbst. Die Lostrommel landet dabei immer auf der hier festgelegten Person.'),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: e => prepareDraw(e.currentTarget) }, 'Auslosung vorbereiten'));
  }
  return h('section', { class: 'card card--red' },
    h('h2', null, 'Auslosung'),
    h('p', null, 'Die Auslosung ist vorbereitet. ' + countRevealed() + ' von ' + state.people.length + ' haben schon gelost.'),
    h('button', { class: 'btn btn-danger', type: 'button', onclick: e => resetDraw(e.currentTarget) }, 'Auslosung zurücksetzen'));
}

async function prepareDraw(button) {
  if (state.people.length < 2) {
    flash('Es werden mindestens zwei Teilnehmer benötigt.', 'error');
    return;
  }
  const confirmed = await ask({
    title: 'Auslosung vorbereiten?',
    text: 'Danach lassen sich Teilnehmer und Ausschlüsse erst wieder ändern, wenn die Auslosung zurückgesetzt wird.',
    okLabel: 'Ja, vorbereiten'
  });
  if (!confirmed) return;

  act(button, async () => {
    const excluded = {};
    state.people.forEach(p => { excluded[p.id] = p.exclusions; });
    const result = drawAssignment(state.people.map(p => p.id), excluded);
    if (!result) fail('Mit diesen Ausschlüssen ist keine gültige Auslosung möglich. Bitte entferne einen Ausschluss.');

    const batch = writeBatch(db);
    result.forEach((receiverId, giverId) => {
      batch.set(doc(db, 'assignments', giverId), { receiverId, revealed: false });
    });
    batch.set(doc(db, 'settings', 'main'), { drawnAt: serverTimestamp() }, { merge: true });
    await batch.commit();
  }, 'Die Auslosung ist vorbereitet. Jetzt kann jeder selbst losen.');
}

async function resetDraw(button) {
  const revealed = countRevealed();
  const confirmed = await ask({
    title: 'Auslosung zurücksetzen?',
    text: revealed > 0
      ? 'Achtung: ' + revealed + ' Personen haben ihr Ergebnis schon gesehen. Nach einer neuen Auslosung bekommen sie jemand anderen.'
      : 'Noch niemand hat gelost. Die Zuordnung wird gelöscht und kann neu vorbereitet werden.',
    okLabel: 'Ja, zurücksetzen'
  });
  if (!confirmed) return;

  act(button, async () => {
    const batch = writeBatch(db);
    Object.keys(state.assignments).forEach(id => batch.delete(doc(db, 'assignments', id)));
    batch.set(doc(db, 'settings', 'main'), { drawnAt: deleteField() }, { merge: true });
    await batch.commit();
    showNames = false;
  }, 'Die Auslosung wurde zurückgesetzt.');
}

/* ---------- Übersicht ---------- */

function graphSection() {
  const section = h('section', { class: 'card' });
  drawGraphSection(section);
  return section;
}

function drawGraphSection(section) {
  if (!state.drawn) {
    render(section,
      h('h2', null, 'Übersicht'),
      h('p', { class: 'empty' }, 'Noch keine Auslosung vorbereitet.'));
    return;
  }

  const byId = peopleById();
  const toggle = h('button', {
    class: 'btn btn-secondary', type: 'button',
    onclick: async () => {
      if (showNames) {
        showNames = false;
        drawGraphSection(section);
        return;
      }
      const confirmed = await ask({
        title: 'Namen einblenden?',
        text: 'Dann siehst du, wer wen beschenkt. Das lässt sich nicht mehr vergessen.',
        okLabel: 'Ja, Namen anzeigen'
      });
      if (confirmed) {
        showNames = true;
        drawGraphSection(section);
      }
    }
  }, showNames ? 'Namen ausblenden' : 'Namen einblenden');

  render(section,
    h('h2', null, 'Übersicht'),
    h('p', { class: 'hint' }, 'Jeder Pfeil zeigt von der schenkenden zur beschenkten Person.'),
    h('div', { class: 'graph' }, renderGraph(state.people, state.assignments, showNames)),
    h('div', { class: 'legend' },
      h('span', null, h('span', { class: 'legend-dot filled' }), 'hat schon gelost'),
      h('span', null, h('span', { class: 'legend-dot' }), 'hat noch nicht gelost')),
    showNames
      ? h('ul', { class: 'pair-list' }, state.people.map(p => {
        const assignment = state.assignments[p.id];
        const receiver = assignment && byId[assignment.receiverId];
        return h('li', null, h('strong', null, p.name), ' beschenkt ', h('strong', null, receiver ? receiver.name : '?'));
      }))
      : null,
    h('div', { class: 'form-row' }, toggle));
}
