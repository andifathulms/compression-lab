/**
 * Number formatting, in one place.
 *
 * Every number in this app carries its unit, and the same quantity is
 * formatted the same way wherever it appears — a size that reads "2.14 kB" in
 * the rail and "2135 B" in a panel is two numbers as far as a reader is
 * concerned.
 */

/** A count of bits, as a size, in the largest unit that stays legible. */
export function bytes(bits: number): string {
  const b = bits / 8;
  if (b < 1024) return `${b.toFixed(0)} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(2)} kB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

/** A compressed size against the original, as "0.41×". */
export function ratio(totalBits: number, originalBytes: number): string {
  return `${(totalBits / (originalBytes * 8 || 1)).toFixed(3)}×`;
}

/** A count, grouped. */
export function count(n: number): string {
  return n.toLocaleString('en-GB');
}
