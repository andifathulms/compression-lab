/**
 * The surprisal ramp: cost in bits to a colour.
 *
 * Not a hue ramp. It runs through *presence*, from the page colour itself to
 * full ink, so a character the model predicted perfectly is invisible and one
 * it did not expect sits in full ink. That mapping does more teaching than a
 * legend would, and it is why low-entropy text partially disappears as the
 * order rises.
 *
 * The low end of the ramp is deliberately below the 4.5:1 contrast floor. That
 * is legitimate because the tint is redundant encoding: every value is also in
 * the hover readout and in the table view.
 */

interface Stop {
  bits: number;
  rgb: [number, number, number];
}

/** The stops in DESIGN.md 2.2, with a slight warm shift at the ink end. */
const STOPS: Stop[] = [
  { bits: 0, rgb: [0xf7, 0xf5, 0xf0] },
  { bits: 2, rgb: [0xcf, 0xc8, 0xb9] },
  { bits: 4, rgb: [0x91, 0x89, 0x77] },
  { bits: 6, rgb: [0x4e, 0x49, 0x40] },
  { bits: 8, rgb: [0x1a, 0x18, 0x15] },
];

const CACHE_STEPS = 128;
const cache: string[] = [];

function mix(a: Stop, b: Stop, t: number): string {
  const r = Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t);
  const g = Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t);
  const bl = Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Position on the ramp, 0 to 1, as a colour. */
export function rampColour(position: number): string {
  const clamped = position <= 0 ? 0 : position >= 1 ? 1 : position;
  const step = Math.round(clamped * (CACHE_STEPS - 1));
  const hit = cache[step];
  if (hit !== undefined) return hit;

  const bits = (step / (CACHE_STEPS - 1)) * 8;
  let i = 0;
  while (i < STOPS.length - 2 && bits > STOPS[i + 1].bits) i++;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const colour = mix(a, b, (bits - a.bits) / (b.bits - a.bits));
  cache[step] = colour;
  return colour;
}

/**
 * Cost in bits to a colour, with the top of the ramp rescaled to the
 * alphabet.
 *
 * Clamping at 8 bits suits an 8-bit alphabet. A four-symbol alphabet maxes out
 * at 2 bits and would render entirely pale against a fixed ramp, so the top is
 * rescaled — and the interface says what it was rescaled to, because a
 * rescaled ramp changes what the page looks like.
 */
export function surprisalColour(bits: number, maxBits: number): string {
  return rampColour(bits / (maxBits > 0 ? maxBits : 1));
}
