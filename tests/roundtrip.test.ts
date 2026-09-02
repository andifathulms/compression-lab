import { describe, it, expect } from 'vitest';
import {
  arithmeticEncode,
  arithmeticDecode,
  huffmanEncode,
  huffmanDecode,
  lz77EncodeText,
  lz77DecodeText,
  serialiseModel,
  deserialiseModel,
  buildModelsFromIndex,
  emptyModel,
  indexText,
  toSymbols,
  ORDERS,
  DEFAULT_LZ77,
} from '../src/engine/index.ts';
import { SAMPLES } from '../src/samples/index.ts';

/**
 * Every coder round-trips every bundled sample, or the app is lying about the
 * numbers it draws. The per-coder suites cover the awkward corpus; this one
 * covers the texts a visitor will actually load, through the engine's public
 * surface rather than its internals.
 */
describe('round trip over every bundled sample', () => {
  for (const sample of SAMPLES) {
    it(sample.id, () => {
      const index = indexText(toSymbols(sample.text));

      for (const order of ORDERS) {
        const modelBytes = serialiseModel(buildModelsFromIndex(index)[order]);

        const huffman = huffmanEncode(index, buildModelsFromIndex(index)[order]);
        const forHuffman = deserialiseModel(modelBytes);
        expect(
          huffmanDecode(huffman.bytes, forHuffman, forHuffman.symbolCount),
          `huffman order ${order}`,
        ).toBe(sample.text);

        const arith = arithmeticEncode(index, buildModelsFromIndex(index)[order]);
        const forArith = deserialiseModel(modelBytes);
        expect(
          arithmeticDecode(arith.bytes, forArith, forArith.symbolCount),
          `arithmetic order ${order}`,
        ).toBe(sample.text);

        // Adaptive: the decoder is handed a model description with no counts
        // in it and rebuilds them from the symbols it decodes.
        const adaptiveBytes = serialiseModel(
          Object.assign(emptyModel(index.alphabet, order), {
            symbolCount: index.symbols.length,
          }),
        );
        const encoded = arithmeticEncode(index, emptyModel(index.alphabet, order));
        const forAdaptive = deserialiseModel(adaptiveBytes);
        expect(
          arithmeticDecode(encoded.bytes, forAdaptive, forAdaptive.symbolCount),
          `arithmetic order ${order} adaptive`,
        ).toBe(sample.text);
      }

      const lz = lz77EncodeText(sample.text, DEFAULT_LZ77);
      expect(lz77DecodeText(lz.bytes, lz.byteCount, DEFAULT_LZ77), 'lz77').toBe(sample.text);
    });
  }
});
