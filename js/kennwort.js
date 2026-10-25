import { randomInt } from './random.js';

const WORDS = [
  'tanne', 'stern', 'kerze', 'apfel', 'nuss', 'zimt', 'schnee', 'glocke', 'engel', 'keks',
  'mandel', 'schlitten', 'kugel', 'punsch', 'mistel', 'flocke', 'kamin', 'socke', 'schleife', 'laterne',
  'winter', 'rentier', 'wichtel', 'krippe', 'honig', 'orange', 'vanille', 'marzipan', 'stollen', 'kranz'
];

// Groß-/Kleinschreibung, Umlaute, Bindestriche und doppelte Leerzeichen spielen keine Rolle:
// "Tanne-Stern", "tanne  stern" und "TANNE STERN" sind dasselbe Kennwort.
export function normalizeKennwort(input) {
  return String(input)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[-_.,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Firebase Auth braucht E-Mail und Passwort. Beides wird aus dem Kennwort abgeleitet,
// damit man beim Anmelden nur das Kennwort eintippen muss.
export async function credentialsFor(kennwort) {
  const secret = 'wichteln:' + normalizeKennwort(kennwort);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return { email: hex.slice(0, 40) + '@wichteln.example.com', password: secret };
}

export function suggestKennwort() {
  const first = WORDS[randomInt(WORDS.length)];
  let second = first;
  while (second === first) second = WORDS[randomInt(WORDS.length)];
  return first + ' ' + second;
}

export function personalLink(kennwort) {
  const base = new URL('./', location.href).href;
  return base + '#k=' + encodeURIComponent(normalizeKennwort(kennwort).replace(/ /g, '-'));
}
