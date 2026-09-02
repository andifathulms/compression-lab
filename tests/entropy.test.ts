import { describe, it, expect } from 'vitest';
import {
  buildModelsFromIndex,
  indexText,
  toSymbols,
  alphabetOf,
  contextAt,
  ALPHA,
} from '../src/engine/model.ts';
import {
  conditionalEntropy,
  entropyStaircase,
  order0Entropy,
  surprisals,
} from '../src/engine/entropy.ts';
import { BitWriter, BitReader, bitsFor } from '../src/engine/bitio.ts';
import { CORPUS } from './corpus.ts';

describe('bit i/o', () => {
  it('round-trips an arbitrary bit string', () => {
    const bits = '1011000111101010101010000011111';
    const w = new BitWriter();
    w.writeString(bits);
    expect(w.length).toBe(bits.length);
    const r = new BitReader(w.finish());
    let out = '';
    for (let i = 0; i < bits.length; i++) out += r.readBit();
    expect(out).toBe(bits);
  });

  it('round-trips fixed-width integers', () => {
    const values = [0, 1, 5, 255, 4095, 65535];
    const w = new BitWriter();
    for (const v of values) w.writeBits(v, 16);
    const r = new BitReader(w.finish());
    expect(values.map(() => r.readBits(16))).toEqual(values);
  });

  it('bitsFor(1) is zero: a single possible value carries no information', () => {
    expect(bitsFor(1)).toBe(0);
    expect(bitsFor(2)).toBe(1);
    expect(bitsFor(256)).toBe(8);
    expect(bitsFor(257)).toBe(9);
  });
});

describe('entropy', () => {
  it('H0 from the model matches a direct frequency calculation', () => {
    for (const { name, text } of CORPUS) {
      const index = indexText(toSymbols(text));
      const models = buildModelsFromIndex(index);
      expect(conditionalEntropy(index, models[0]), name).toBeCloseTo(
        order0Entropy(index.symbols),
        10,
      );
    }
  });

  it('conditional entropies are non-increasing in the order', () => {
    for (const { name, text } of CORPUS) {
      const index = indexText(toSymbols(text));
      const steps = entropyStaircase(index, buildModelsFromIndex(index));
      for (let k = 1; k < steps.length; k++) {
        expect(steps[k].bits, `${name} H${k} <= H${k - 1}`).toBeLessThanOrEqual(
          steps[k - 1].bits + 1e-9,
        );
      }
    }
  });

  it('a uniform alphabet has entropy log2 of its size', () => {
    const symbols = toSymbols('abcd'.repeat(50));
    expect(order0Entropy(symbols)).toBeCloseTo(2, 12);
  });

  it('a single repeated symbol has zero entropy at every order', () => {
    const index = indexText(toSymbols('x'.repeat(200)));
    for (const step of entropyStaircase(index, buildModelsFromIndex(index))) {
      expect(step.bits).toBeCloseTo(0, 12);
    }
  });
});

describe('model', () => {
  it('probabilities under one context sum to one', () => {
    const symbols = toSymbols(CORPUS[6].text);
    const models = buildModelsFromIndex(indexText(symbols));
    for (const model of models) {
      const context = contextAt(symbols, 10, model.order);
      const total = model.alphabet.reduce((s, sym) => s + model.probability(context, sym), 0);
      expect(total).toBeCloseTo(1, 10);
    }
  });

  it('smoothing gives an unseen context a uniform distribution', () => {
    const symbols = toSymbols('abcabcabc');
    const model = buildModelsFromIndex(indexText(symbols))[2];
    const p = model.probability(['z', 'z'], 'a');
    expect(p).toBeCloseTo(ALPHA / (ALPHA * model.alphabet.length), 12);
  });

  it('the alphabet is the set of code points, sorted', () => {
    const symbols = toSymbols(CORPUS[5].text);
    expect(alphabetOf(symbols)).toEqual(['a', 'b', 'c', 'd', '\u{1D11E}', '\u{1F600}']);
  });

  it('surprisal is finite everywhere and averages above the entropy', () => {
    for (const { name, text } of CORPUS) {
      if (text.length === 0) continue;
      const index = indexText(toSymbols(text));
      const models = buildModelsFromIndex(index);
      const s = surprisals(index, models[2]);
      const mean = s.reduce((a, b) => a + b, 0) / s.length;
      expect(Number.isFinite(mean), name).toBe(true);
      expect(mean, name).toBeGreaterThanOrEqual(conditionalEntropy(index, models[2]) - 1e-9);
    }
  });
});
