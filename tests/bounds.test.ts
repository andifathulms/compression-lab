import { describe, it, expect } from 'vitest';
import { arithmeticEncode, arithmeticDecode, idealCodeBits } from '../src/engine/arithmetic.ts';
import { buildModelsFromIndex, emptyModel, indexText, toSymbols, ORDERS } from '../src/engine/model.ts';
import { CORPUS } from './corpus.ts';

describe('arithmetic coding', () => {
  it('round-trips the corpus at every order, static', () => {
    for (const { name, text } of CORPUS) {
      const index = indexText(toSymbols(text));
      const models = buildModelsFromIndex(index);
      for (const order of ORDERS) {
        const { bytes, symbolCount } = arithmeticEncode(index, models[order]);
        // The decoder is handed a model it did not encode with, built from the
        // same text, so nothing leaks through a shared object.
        const decoder = buildModelsFromIndex(indexText(toSymbols(text)))[order];
        expect(arithmeticDecode(bytes, decoder, symbolCount), `${name} order ${order}`).toBe(text);
      }
    }
  });

  it('round-trips the corpus at every order, adaptive', () => {
    for (const { name, text } of CORPUS) {
      const index = indexText(toSymbols(text));
      for (const order of ORDERS) {
        const { bytes, symbolCount } = arithmeticEncode(index, emptyModel(index.alphabet, order));
        expect(
          arithmeticDecode(bytes, emptyModel(index.alphabet, order), symbolCount),
          `${name} order ${order} adaptive`,
        ).toBe(text);
      }
    }
  });

  it('output is within 2 bits of the ideal code length, static', () => {
    for (const { name, text } of CORPUS) {
      if (text.length === 0) continue;
      const index = indexText(toSymbols(text));
      for (const order of ORDERS) {
        const ideal = idealCodeBits(index, buildModelsFromIndex(index)[order]);
        const { bits } = arithmeticEncode(index, buildModelsFromIndex(index)[order]);
        expect(bits, `${name} order ${order}: ${bits} vs ideal ${ideal.toFixed(3)}`).toBeGreaterThanOrEqual(
          Math.floor(ideal) - 1,
        );
        expect(bits - ideal, `${name} order ${order}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('output is within 2 bits of the ideal code length, adaptive', () => {
    for (const { name, text } of CORPUS) {
      if (text.length === 0) continue;
      const index = indexText(toSymbols(text));
      for (const order of ORDERS) {
        const ideal = idealCodeBits(index, emptyModel(index.alphabet, order));
        const { bits } = arithmeticEncode(index, emptyModel(index.alphabet, order));
        expect(bits - ideal, `${name} order ${order} adaptive`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('holds the bound on a long text, where drift would show', () => {
    const text = 'the quick brown fox jumps over the lazy dog, and then does it again. '.repeat(160);
    const index = indexText(toSymbols(text));
    expect(index.symbols.length).toBeGreaterThan(10000);
    const ideal = idealCodeBits(index, buildModelsFromIndex(index)[2]);
    const { bits, bytes, symbolCount } = arithmeticEncode(index, buildModelsFromIndex(index)[2]);
    expect(bits - ideal).toBeLessThanOrEqual(2);
    expect(arithmeticDecode(bytes, buildModelsFromIndex(index)[2], symbolCount)).toBe(text);
  });

  it('the trace carries both the integer state and the idealised interval', () => {
    const index = indexText(toSymbols('the quick brown fox jumps over the lazy dog'));
    const { trace } = arithmeticEncode(index, buildModelsFromIndex(index)[1]);
    expect(trace.steps.length).toBe(index.symbols.length);
    for (const step of trace.steps) {
      expect(step.highAfter).toBeGreaterThan(step.lowAfter);
      expect(step.idealHigh).toBeGreaterThan(step.idealLow);
      expect(step.idealHigh - step.idealLow).toBeCloseTo(step.probability, 12);
      expect(step.costBits).toBeCloseTo(-Math.log2(step.probability), 12);
    }
    // The idealised width, tracked in logarithms, matches the summed cost.
    const summed = trace.steps.reduce((s, x) => s + x.costBits, 0);
    expect(trace.steps[trace.steps.length - 1].widthLog2).toBeCloseTo(-summed, 9);
  });

  it('the trace carries the bands the coder actually used', () => {
    // The Interval view draws these rather than re-deriving them. Under an
    // adaptive model the distribution at step i exists only during step i, so
    // a view that recomputed it would draw a different one.
    const index = indexText(toSymbols('to be or not to be, that is the question'));
    for (const model of [buildModelsFromIndex(index)[1], emptyModel(index.alphabet, 1)]) {
      const { trace } = arithmeticEncode(index, model);
      for (const step of trace.steps) {
        expect(step.bands.length).toBe(index.alphabet.length + 1);
        expect(step.bands[0]).toBe(0);
        expect(step.bands[step.bands.length - 1]).toBeCloseTo(1, 12);
        const at = index.alphabet.indexOf(step.symbol);
        expect(step.bands[at]).toBeCloseTo(step.idealLow, 12);
        expect(step.bands[at + 1]).toBeCloseTo(step.idealHigh, 12);
        for (let i = 1; i < step.bands.length; i++) {
          expect(step.bands[i]).toBeGreaterThan(step.bands[i - 1]);
        }
      }
    }
  });
});
