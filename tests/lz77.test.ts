import { describe, it, expect } from 'vitest';
import {
  lz77Encode,
  lz77EncodeText,
  lz77DecodeText,
  tokenWidths,
  toBytes,
  MIN_MATCH,
  type Lz77Options,
} from '../src/engine/lz77.ts';
import { CORPUS } from './corpus.ts';

const SETTINGS: Lz77Options[] = [
  { windowSize: 256, lookahead: 4, lazy: false },
  { windowSize: 256, lookahead: 258, lazy: false },
  { windowSize: 4096, lookahead: 32, lazy: false },
  { windowSize: 4096, lookahead: 32, lazy: true },
  { windowSize: 32768, lookahead: 258, lazy: true },
];

describe('lz77', () => {
  it('round-trips the corpus at every window and look-ahead setting', () => {
    for (const { name, text } of CORPUS) {
      for (const options of SETTINGS) {
        const { bytes, byteCount } = lz77EncodeText(text, options);
        expect(
          lz77DecodeText(bytes, byteCount, options),
          `${name} w=${options.windowSize} la=${options.lookahead} lazy=${options.lazy}`,
        ).toBe(text);
      }
    }
  });

  it('round-trips overlapping matches, where distance is less than length', () => {
    // A run of one byte is the canonical overlapping match: distance 1,
    // length up to the whole look-ahead.
    const cases = ['a'.repeat(200), 'ab'.repeat(200), 'abc'.repeat(200), 'xaaaaaaaaaaaaaaaaaaaay'];
    for (const text of cases) {
      const options: Lz77Options = { windowSize: 4096, lookahead: 258, lazy: false };
      const { bytes, byteCount, tokens } = lz77EncodeText(text, options);
      const overlapping = tokens.filter((t) => t.kind === 'match' && t.distance < t.length);
      expect(overlapping.length, `${text.slice(0, 8)} produces an overlapping match`).toBeGreaterThan(0);
      expect(lz77DecodeText(bytes, byteCount, options)).toBe(text);
    }
  });

  it('emits no match longer than the look-ahead or further than the window', () => {
    const text = 'the quick brown fox. '.repeat(400);
    for (const options of SETTINGS) {
      const { tokens } = lz77EncodeText(text, options);
      for (const token of tokens) {
        if (token.kind !== 'match') continue;
        expect(token.length).toBeLessThanOrEqual(options.lookahead);
        expect(token.length).toBeGreaterThanOrEqual(MIN_MATCH);
        expect(token.distance).toBeLessThanOrEqual(options.windowSize);
        expect(token.distance).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('the measured bit count equals the stated token encoding', () => {
    const text = CORPUS[6].text;
    for (const options of SETTINGS) {
      const { bits, tokens } = lz77EncodeText(text, options);
      const w = tokenWidths(options);
      const expected = tokens.reduce(
        (sum, t) => sum + (t.kind === 'literal' ? w.literalBits : w.matchBits),
        0,
      );
      expect(bits, `w=${options.windowSize}`).toBe(expected);
    }
  });

  it('a shrinking window loses matches that fall out of range', () => {
    // The phrase recurs every 300 bytes, so a 256-byte window cannot see the
    // previous occurrence and a 4096-byte window can. This is the thing the
    // window slider exists to show.
    const text = ('unique phrase here' + '.'.repeat(282)).repeat(6);
    const small = lz77EncodeText(text, { windowSize: 256, lookahead: 32, lazy: false });
    const large = lz77EncodeText(text, { windowSize: 4096, lookahead: 32, lazy: false });
    expect(large.bits).toBeLessThan(small.bits);
  });

  it('wins on repetitive text and loses on random text', () => {
    const options: Lz77Options = { windowSize: 4096, lookahead: 258, lazy: false };

    const repetitive = 'compression is a measurement of prediction. '.repeat(200);
    const structured = lz77EncodeText(repetitive, options);
    expect(structured.bits / toBytes(repetitive).length).toBeLessThan(1);

    // Deterministic pseudo-random letters, mulberry32 so the low bits are not
    // patterned the way a truncated LCG's are.
    let state = 0x9e3779b9;
    const next = (): number => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const random = Array.from({ length: 4000 }, () =>
      String.fromCharCode(97 + Math.floor(next() * 26)),
    ).join('');
    const noise = lz77EncodeText(random, options);

    // Random text over 26 letters carries log2(26) = 4.70 bits per character.
    // LZ77 sits well above that: with 26^3 three-grams and 4,000 positions,
    // the matches it does find are coincidences, and an 18-bit match token
    // barely pays for the three literals it replaces.
    const noiseRate = noise.bits / toBytes(random).length;
    expect(noiseRate).toBeGreaterThan(Math.log2(26));
    expect(noiseRate).toBeGreaterThan(6);
    expect(noiseRate / (structured.bits / toBytes(repetitive).length)).toBeGreaterThan(8);
  });

  it('the trace records what the encoder actually emitted', () => {
    const options: Lz77Options = { windowSize: 1024, lookahead: 32, lazy: false };
    const text = 'to be or not to be, that is the question. to be or not to be.';
    const { trace, tokens, bits } = lz77EncodeText(text, options);
    expect(trace.steps.length).toBe(tokens.length);
    let cursor = 0;
    let cost = 0;
    for (const [i, step] of trace.steps.entries()) {
      expect(step.position).toBe(cursor);
      expect(step.emitted).toEqual(tokens[i]);
      expect(step.windowStart).toBe(Math.max(0, cursor - options.windowSize));
      cursor += step.emitted.kind === 'match' ? step.emitted.length : 1;
      cost += step.costBits;
    }
    expect(cost).toBe(bits);
  });

  it('decodes an empty input', () => {
    expect(lz77DecodeText(lz77Encode(new Uint8Array(0)).bytes, 0)).toBe('');
  });
});
