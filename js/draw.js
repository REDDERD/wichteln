import { shuffle } from './random.js';

// Ordnet jeder Person genau eine andere Person zu.
// ids: Liste der Teilnehmer-IDs, excluded: { id: [ids, die diese Person nicht ziehen darf] }
// Ergebnis: Map schenker -> beschenkter, oder null, wenn es keine gültige Zuordnung gibt.
export function drawAssignment(ids, excluded) {
  const allowed = (giver, receiver) =>
    giver !== receiver && !(excluded[giver] && excluded[giver].indexOf(receiver) !== -1);

  // Zufällige Permutationen ziehen, bis eine passt. So ist jede gültige Zuordnung gleich wahrscheinlich.
  for (let attempt = 0; attempt < 5000; attempt++) {
    const receivers = shuffle(ids);
    if (ids.every((giver, i) => allowed(giver, receivers[i]))) {
      return new Map(ids.map((giver, i) => [giver, receivers[i]]));
    }
  }

  // Bei sehr vielen Ausschlüssen systematisch suchen.
  return backtrack(ids, allowed);
}

function backtrack(ids, allowed) {
  const givers = shuffle(ids);
  const used = new Set();
  const result = new Map();

  function step(index) {
    if (index === givers.length) return true;
    const giver = givers[index];
    const options = shuffle(ids.filter(r => !used.has(r) && allowed(giver, r)));
    for (const receiver of options) {
      used.add(receiver);
      result.set(giver, receiver);
      if (step(index + 1)) return true;
      used.delete(receiver);
      result.delete(giver);
    }
    return false;
  }

  return step(0) ? result : null;
}
