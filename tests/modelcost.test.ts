import { describe, it, expect } from 'vitest';
import { serialiseModel, deserialiseModel, modelCostBits, modelCosts } from '../src/engine/modelcost.ts';
import {
  buildModelsFromIndex,
  emptyModel,
  indexText,
  alphabetOf,
  toSymbols,
  ORDERS,
} from '../src/engine/model.ts';
import { huffmanEncode, huffmanDecode } from '../src/engine/huffman.ts';
import { arithmeticEncode, arithmeticDecode } from '../src/engine/arithmetic.ts';
import { CORPUS } from './corpus.ts';

describe('model description', () => {
  it('round-trips: the counts that come back are the counts that went in', () => {
    for (const { name, text } of CORPUS) {
      const index = indexText(toSymbols(text));
      const models = buildModelsFromIndex(index);
      for (const order of ORDERS) {
        const model = models[order];
        const back = deserialiseModel(serialiseModel(model));
        expect(back.order, `${name} order ${order}`).toBe(model.order);
        expect(back.adaptive).toBe(model.adaptive);
        expect(back.alphabet).toEqual(model.alphabet);
        expect(back.symbolCount).toBe(model.symbolCount);
        expect(back.counts.size).toBe(model.counts.size);
        for (const [key, row] of model.counts) {
          const other = back.counts.get(key);
          expect(other, `${name} order ${order} context ${JSON.stringify(key)}`).toBeDefined();
          expect(Object.fromEntries(other!)).toEqual(Object.fromEntries(row));
        }
      }
    }
  });

  it('is canonical: serialising twice gives identical bytes', () => {
    const symbols = toSymbols(CORPUS[6].text);
    const models = buildModelsFromIndex(indexText(symbols));
    for (const order of ORDERS) {
      const a = serialiseModel(models[order]);
      const b = serialiseModel(deserialiseModel(serialiseModel(models[order])));
      expect(Array.from(a), `order ${order}`).toEqual(Array.from(b));
    }
  });

  // This is the assertion the whole thesis rests on. A decoder given only the
  // code stream and the model description must reproduce the text. If it
  // cannot, the model cost is a guess and the total-size minimum is fiction.
  it('a decoder given only the code stream and the model bytes reproduces the text', () => {
    for (const { name, text } of CORPUS) {
      const index = indexText(toSymbols(text));
      for (const order of ORDERS) {
        const modelBytes = serialiseModel(buildModelsFromIndex(index)[order]);

        const huffman = huffmanEncode(index, buildModelsFromIndex(index)[order]);
        const viaHuffman = deserialiseModel(modelBytes);
        expect(
          huffmanDecode(huffman.bytes, viaHuffman, viaHuffman.symbolCount),
          `huffman ${name} order ${order}`,
        ).toBe(text);

        const arith = arithmeticEncode(index, buildModelsFromIndex(index)[order]);
        const viaArith = deserialiseModel(modelBytes);
        expect(
          arithmeticDecode(arith.bytes, viaArith, viaArith.symbolCount),
          `arithmetic ${name} order ${order}`,
        ).toBe(text);
      }
    }
  });

  it('an adaptive model description carries the alphabet and no counts', () => {
    const index = indexText(toSymbols(CORPUS[6].text));
    const alphabet = index.alphabet;
    const model = emptyModel(alphabet, 3);
    model.symbolCount = index.symbols.length;
    const back = deserialiseModel(serialiseModel(model));
    expect(back.adaptive).toBe(true);
    expect(back.counts.size).toBe(0);
    expect(back.alphabet).toEqual(alphabet);

    // And it round-trips, with the decoder rebuilding the counts as it goes.
    const encoded = arithmeticEncode(index, emptyModel(alphabet, 3));
    expect(arithmeticDecode(encoded.bytes, back, back.symbolCount)).toBe(CORPUS[6].text);
  });

  it('adaptive costs far less to describe than static at the same order', () => {
    const symbols = toSymbols(
      'Entropy is not a property of a text; it is a property of a text under a model. '.repeat(30),
    );
    const staticModel = buildModelsFromIndex(indexText(symbols))[3];
    const adaptive = emptyModel(alphabetOf(symbols), 3);
    adaptive.symbolCount = symbols.length;
    expect(modelCostBits(adaptive)).toBeLessThan(modelCostBits(staticModel) / 10);
  });

  it('model cost rises with order, which is the other half of the staircase', () => {
    const symbols = toSymbols(
      'Compression is prediction, and prediction has to be described. '.repeat(40),
    );
    const costs = modelCosts(buildModelsFromIndex(indexText(symbols)));
    for (let k = 1; k < costs.length; k++) {
      expect(costs[k].bits, `order ${k} costs more than order ${k - 1}`).toBeGreaterThan(
        costs[k - 1].bits,
      );
    }
  });

  it('rejects bytes that are not a model description', () => {
    expect(() => deserialiseModel(Uint8Array.from([1, 2, 3, 4, 5]))).toThrow(/not a model description/);
  });
});
