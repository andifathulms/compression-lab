import { describe, it, expect } from 'vitest';
import {
  huffmanEncode,
  huffmanDecode,
  codeLengths,
  canonicalTable,
  huffmanTrace,
  huffmanWaste,
} from '../src/engine/huffman.ts';
import {
  buildModelsFromIndex,
  emptyModel,
  indexText,
  toSymbols,
  ORDERS,
  type Order,
} from '../src/engine/model.ts';
import { CORPUS } from './corpus.ts';

describe('huffman', () => {
  it('round-trips the corpus at every order, static', () => {
    for (const { name, text } of CORPUS) {
      const index = indexText(toSymbols(text));
      for (const order of ORDERS) {
        const { bytes, symbolCount } = huffmanEncode(index, buildModelsFromIndex(index)[order]);
        const decoder = buildModelsFromIndex(indexText(toSymbols(text)))[order];
        expect(huffmanDecode(bytes, decoder, symbolCount), `${name} order ${order}`).toBe(text);
      }
    }
  });

  it('round-trips the corpus at every order, adaptive', () => {
    for (const { name, text } of CORPUS) {
      const index = indexText(toSymbols(text));
      for (const order of ORDERS) {
        const { bytes, symbolCount } = huffmanEncode(index, emptyModel(index.alphabet, order));
        const decoded = huffmanDecode(bytes, emptyModel(index.alphabet, order), symbolCount);
        expect(decoded, `${name} order ${order} adaptive`).toBe(text);
      }
    }
  });

  it('output length equals the sum of frequency times code length, exactly', () => {
    for (const { name, text } of CORPUS) {
      if (text.length === 0) continue;
      const symbols = toSymbols(text);
      const index = indexText(symbols);
      const order: Order = 0;
      const model = buildModelsFromIndex(index)[order];
      const { bits } = huffmanEncode(index, buildModelsFromIndex(index)[order]);
      const { freqs } = model.frequencies([]);
      const table = canonicalTable(codeLengths(freqs));
      const occurrences = new Map<string, number>();
      for (const s of symbols) occurrences.set(s, (occurrences.get(s) ?? 0) + 1);
      let expected = 0;
      model.alphabet.forEach((symbol, i) => {
        expected += (occurrences.get(symbol) ?? 0) * table.lengths[i];
      });
      expect(bits, name).toBe(expected);
    }
  });

  it('canonical codes are prefix-free', () => {
    const symbols = toSymbols(CORPUS[6].text);
    const model = buildModelsFromIndex(indexText(symbols))[0];
    const table = canonicalTable(codeLengths(model.frequencies([]).freqs));
    const strings = model.alphabet.map((_, i) =>
      table.codes[i].toString(2).padStart(table.lengths[i], '0'),
    );
    for (const a of strings) {
      for (const b of strings) {
        if (a === b) continue;
        expect(b.startsWith(a), `${a} prefixes ${b}`).toBe(false);
      }
    }
  });

  it('canonical codes are assigned shortest first, then by alphabet position', () => {
    const symbols = toSymbols('aaaaaaaabbbbccdd');
    const model = buildModelsFromIndex(indexText(symbols))[0];
    const { freqs } = model.frequencies([]);
    const table = canonicalTable(codeLengths(freqs));
    const ordered = Array.from(table.sorted).map((i) => model.alphabet[i]);
    for (let i = 1; i < ordered.length; i++) {
      const a = model.alphabet.indexOf(ordered[i - 1]);
      const b = model.alphabet.indexOf(ordered[i]);
      expect(table.lengths[a] < table.lengths[b] || (table.lengths[a] === table.lengths[b] && a < b)).toBe(true);
    }
  });

  it('satisfies the Kraft equality: a complete code sums to one', () => {
    for (const { name, text } of CORPUS) {
      if (text.length === 0) continue;
      const model = buildModelsFromIndex(indexText(toSymbols(text)))[0];
      // A one-symbol alphabet is deliberately incomplete: the code is one bit
      // and half the code space goes unused, because a zero-bit code would
      // give the decoder nothing to consume.
      if (model.alphabet.length < 2) continue;
      const lengths = codeLengths(model.frequencies([]).freqs);
      let kraft = 0;
      for (const len of lengths) kraft += Math.pow(2, -len);
      expect(kraft, name).toBeCloseTo(1, 12);
    }
  });

  it('the traced tree agrees with the fast code-length construction', () => {
    for (const { name, text } of CORPUS) {
      if (text.length === 0) continue;
      const symbols = toSymbols(text);
      const index = indexText(symbols);
      const model = buildModelsFromIndex(index)[1];
      const contextId = index.contexts[1].positionIds![Math.min(1, symbols.length - 1)];
      const trace = huffmanTrace(model, contextId);
      // Both constructions must give the same total weighted depth, which is
      // the only property a Huffman tree is required to optimise.
      const depths = new Map<string, number>();
      const walk = (node: typeof trace.root, depth: number): void => {
        if (!node) return;
        if (node.symbol !== null) {
          depths.set(node.symbol, model.alphabet.length === 1 ? 1 : depth);
          return;
        }
        walk(node.left, depth + 1);
        walk(node.right, depth + 1);
      };
      walk(trace.root, 0);
      const { freqs } = model.frequenciesAt(contextId);
      const fast = codeLengths(freqs);
      let a = 0;
      let b = 0;
      model.alphabet.forEach((symbol, i) => {
        a += freqs[i] * (depths.get(symbol) ?? 0);
        b += freqs[i] * fast[i];
      });
      expect(a, name).toBe(b);
      expect(trace.merges.length).toBe(Math.max(0, model.alphabet.length - 1));
    }
  });

  it('waste is never negative: an integer code cannot beat the ideal cost', () => {
    for (const { name, text } of CORPUS) {
      if (text.length === 0) continue;
      const symbols = toSymbols(text);
      const model = buildModelsFromIndex(indexText(symbols))[0];
      const entries = huffmanWaste(symbols, model, model.index.idFor([]));
      const weighted = entries.reduce((s, e) => s + e.frequency * (e.codeBits - e.idealBits), 0);
      expect(weighted, name).toBeGreaterThanOrEqual(-1e-9);
    }
  });
});
