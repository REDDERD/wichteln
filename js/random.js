// Zufallszahl 0 <= x < n aus dem kryptografischen Zufallsgenerator, ohne Verzerrung.
export function randomInt(n) {
  const limit = Math.floor(0x100000000 / n) * n;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % n;
}

// Fisher-Yates, gibt eine neue Liste zurück.
export function shuffle(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}
