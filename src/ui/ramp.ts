/**
 * The surprisal ramp: cost in bits to a colour.
 *
 * Not a hue ramp. It runs through *presence*, from the ground colour itself to
 * full contrast, so a character the model predicted perfectly is invisible and
 * one it did not expect is fully drawn. That mapping does more teaching than a
 * legend would, and it is why low-entropy text partially disappears as the
 * model order rises.
 *
 * There is one ramp per ground, and the dark one is not the light one
 * inverted. On paper the ramp ends in ink. On the bench it ends in a warm
 * near-white, so an unexpected character reads as a signal rather than as one
 * more shade of grey — the top of the ramp is the only place in the app where
 * warmth is used to mean intensity.
 *
 * The low end of both ramps is deliberately below the 4.5:1 contrast floor.
 * That is legitimate because the tint is redundant encoding: every value is
 * also in the readout under the text and in the tables.
 */

import type { ThemeMode } from './theme.ts';

interface Stop {
  bits: number;
  rgb: [number, number, number];
}

/** The stops in DESIGN.md 2.2. Both sets end at 8 bits. */
const RAMPS: Record<ThemeMode, Stop[]> = {
  light: [
    { bits: 0, rgb: [0xfc, 0xfb, 0xf8] },
    { bits: 2, rgb: [0xd6, 0xd4, 0xcf] },
    { bits: 4, rgb: [0x9b, 0x98, 0x8f] },
    { bits: 6, rgb: [0x50, 0x53, 0x5b] },
    { bits: 8, rgb: [0x12, 0x16, 0x1c] },
  ],
  dark: [
    { bits: 0, rgb: [0x14, 0x19, 0x22] },
    { bits: 2, rgb: [0x35, 0x3c, 0x47] },
    { bits: 4, rgb: [0x6c, 0x73, 0x80] },
    { bits: 6, rgb: [0xae, 0xb3, 0xba] },
    { bits: 8, rgb: [0xff, 0xf1, 0xd6] },
  ],
};

const CACHE_STEPS = 128;
const caches: Record<ThemeMode, string[]> = { light: [], dark: [] };

function mix(a: Stop, b: Stop, t: number): string {
  const r = Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t);
  const g = Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t);
  const bl = Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Position on the ramp, 0 to 1, as a colour. */
export function rampColour(position: number, mode: ThemeMode = 'light'): string {
  const clamped = position <= 0 ? 0 : position >= 1 ? 1 : position;
  const step = Math.round(clamped * (CACHE_STEPS - 1));
  const cache = caches[mode];
  const hit = cache[step];
  if (hit !== undefined) return hit;

  const stops = RAMPS[mode];
  const bits = (step / (CACHE_STEPS - 1)) * 8;
  let i = 0;
  while (i < stops.length - 2 && bits > stops[i + 1].bits) i++;
  const a = stops[i];
  const b = stops[i + 1];
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
export function surprisalColour(
  bits: number,
  maxBits: number,
  mode: ThemeMode = 'light',
): string {
  return rampColour(bits / (maxBits > 0 ? maxBits : 1), mode);
}
