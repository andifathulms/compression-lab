/**
 * Bundled sample texts.
 *
 * The files live under `src/` rather than `public/` and are imported with
 * Vite's `?raw` so they end up inside the JavaScript bundle. `public/` would
 * have meant a fetch at runtime, and PRD 7.5 and 8.9 require an empty network
 * tab: people paste their own writing into this app.
 *
 * The set spans the space the app is trying to teach — high order-0 entropy
 * with much lower order-2 entropy, low order-0 entropy, and incompressible —
 * so that a user who tries all of them cannot keep a single-floor intuition.
 */

import literary from './literary.txt?raw';
import source from './source.txt?raw';
import repetitive from './repetitive.txt?raw';
import random from './random.txt?raw';
import dna from './dna.txt?raw';
import udhrEn from './udhr-en.txt?raw';
import udhrId from './udhr-id.txt?raw';
import udhrDe from './udhr-de.txt?raw';
import udhrFi from './udhr-fi.txt?raw';

export interface Sample {
  id: string;
  name: string;
  /** One sentence on what this text is here to show. */
  note: string;
  text: string;
  /** Set on the four parallel texts, which say the same thing. */
  language?: string;
}

export const SAMPLES: Sample[] = [
  {
    id: 'literary',
    name: 'English prose',
    note: 'Public domain. High order-0 entropy, much lower once conditioned on a character or two.',
    text: literary,
  },
  {
    id: 'source',
    name: 'Source code',
    note: 'A page of TypeScript. Repeated identifiers and indentation give LZ77 more to work with than prose does.',
    text: source,
  },
  {
    id: 'repetitive',
    name: 'Repeated phrase',
    note: 'One sentence, over and over. Raise the order and watch the text fade off the page as the model learns it.',
    text: repetitive,
  },
  {
    id: 'random',
    name: 'Random letters',
    note: 'Uniform over 27 symbols, so about 4.75 bits per character and no structure at any order. Every coder fails, which is the point.',
    text: random,
  },
  {
    id: 'dna',
    name: 'Four-symbol alphabet',
    note: 'Sequence-like text over A, C, G and T. Two bits per symbol is the ceiling, so the surprisal ramp is rescaled.',
    text: dna,
  },
  {
    id: 'udhr-en',
    name: 'Declaration, English',
    note: 'Universal Declaration of Human Rights, articles 1 and 3 to 5. Public domain.',
    text: udhrEn,
    language: 'English',
  },
  {
    id: 'udhr-id',
    name: 'Declaration, Indonesian',
    note: 'The same articles. Affix-heavy morphology: more substring redundancy than the character-level entropy shows.',
    text: udhrId,
    language: 'Indonesian',
  },
  {
    id: 'udhr-de',
    name: 'Declaration, German',
    note: 'The same articles. Compounding lengthens words without adding character-level surprise.',
    text: udhrDe,
    language: 'German',
  },
  {
    id: 'udhr-fi',
    name: 'Declaration, Finnish',
    note: 'The same articles. Agglutinative: long words built from repeated suffixes.',
    text: udhrFi,
    language: 'Finnish',
  },
];

/** The four texts that say the same thing, for the comparison row. */
export const PARALLEL_SAMPLES = SAMPLES.filter((s) => s.language !== undefined);

export const DEFAULT_SAMPLE = SAMPLES[0];

export function sampleById(id: string | null): Sample | undefined {
  return SAMPLES.find((s) => s.id === id);
}
