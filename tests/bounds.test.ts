import { describe, it, expect } from 'vitest';
import { arithmeticEncode, arithmeticDecode, idealCodeBits } from '../src/engine/arithmetic.ts';
import { buildModel, emptyModel, alphabetOf, toSymbols, ORDERS } from '../src/engine/model.ts';
import { CORPUS } from './corpus.ts';

describe('arithmetic coding', () => {
  it('round-trips the corpus at every order, static', () => {
    for (const { name, text } of CORPUS) {
      const symbols = toSymbols(text);
      for (const order of ORDERS) {
        const { bytes, symbolCount } = arithmeticEncode(symbols, buildModel(symbols, order));
        expect(arithmeticDecode(bytes, buildModel(symbols, order), symbolCount), `${name} order ${order}`).toBe(text);
      }
    }
  });

  it('round-trips the corpus at every order, adaptive', () => {
    for (const { name, text } of CORPUS) {
      const symbols = toSymbols(text);
      const alphabet = alphabetOf(symbols);
      for (const order of ORDERS) {
        const { bytes, symbolCount } = arithmeticEncode(symbols, emptyModel(alphabet, order));
        expect(
          arithmeticDecode(bytes, emptyModel(alphabet, order), symbolCount),
          `${name} order ${order} adaptive`,
        ).toBe(text);
      }
    }
  });

  it('output is within 2 bits of the ideal code length, static', () => {
    for (const { name, text } of CORPUS) {
      if (text.length === 0) continue;
      const symbols = toSymbols(text);
      for (const order of ORDERS) {
        const model = buildModel(symbols, order);
        const ideal = idealCodeBits(symbols, buildModel(symbols, order));
        const { bits } = arithmeticEncode(symbols, model);
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
      const symbols = toSymbols(text);
      const alphabet = alphabetOf(symbols);
      for (const order of ORDERS) {
        const ideal = idealCodeBits(symbols, emptyModel(alphabet, order));
        const { bits } = arithmeticEncode(symbols, emptyModel(alphabet, order));
        expect(bits - ideal, `${name} order ${order} adaptive`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('holds the bound on a long text, where drift would show', () => {
    const text = 'the quick brown fox jumps over the lazy dog, and then does it again. '.repeat(160);
    const symbols = toSymbols(text);
    expect(symbols.length).toBeGreaterThan(10000);
    const ideal = idealCodeBits(symbols, buildModel(symbols, 2));
    const { bits, bytes, symbolCount } = arithmeticEncode(symbols, buildModel(symbols, 2));
    expect(bits - ideal).toBeLessThanOrEqual(2);
    expect(arithmeticDecode(bytes, buildModel(symbols, 2), symbolCount)).toBe(text);
  });

  it('the trace carries both the integer state and the idealised interval', () => {
    const symbols = toSymbols('the quick brown fox jumps over the lazy dog');
    const { trace } = arithmeticEncode(symbols, buildModel(symbols, 1));
    expect(trace.steps.length).toBe(symbols.length);
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
});
