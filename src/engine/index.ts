/**
 * The engine's public surface, and the orchestration the views read from.
 *
 * Nothing in `src/engine` imports React, the DOM, `Math.random` or `Date`. It
 * runs unmodified under `node --test` and under Vitest, which is what makes
 * the numbers testable independently of anything that draws them.
 */

export * from './bitio.ts';
export * from './model.ts';
export * from './entropy.ts';
export * from './modelcost.ts';
export * from './huffman.ts';
export * from './arithmetic.ts';
export * from './lz77.ts';
export * from './trace.ts';

import {
  buildModelsFromIndex,
  emptyModel,
  indexText,
  toSymbols,
  MAX_ORDER,
  ORDERS,
  type FrequencyModel,
  type Order,
  type TextIndex,
} from './model.ts';
import {
  entropyStaircase,
  surprisals,
  adaptiveIdealBits,
  idealBits,
  type EntropyResult,
} from './entropy.ts';
import { modelCosts, type ModelCost } from './modelcost.ts';
import { huffmanEncode, huffmanTrace, huffmanWaste, totalWasteBits } from './huffman.ts';
import { arithmeticEncode } from './arithmetic.ts';
import { lz77Encode, toBytes, tokenWidths, DEFAULT_LZ77, type Lz77Options } from './lz77.ts';
import type { ArithmeticTrace, CoderResult, HuffmanTrace, Lz77Trace, WasteEntry } from './trace.ts';

/** PRD 3: above this the model tables stall a keystroke-driven recompute. */
export const MAX_INPUT = 200_000;
/** Above this, recompute on paste and on idle rather than on every keystroke. */
export const LIVE_TYPING_LIMIT = 50_000;

export type CoderName = 'huffman' | 'arithmetic' | 'lz77';

/* -------------------------------------------------------- the staircase */

export interface StaircaseRow {
  order: Order;
  /** Empirical conditional entropy, bits per symbol. */
  entropyBits: number;
  /** Model description, bits per symbol of text. */
  modelBits: number;
  /** -sum log2 p under this order's model, bits per symbol. */
  codeBits: number;
  /** codeBits + modelBits. The curve with the minimum. */
  totalBits: number;
  contexts: number;
}

export interface TextAnalysis {
  text: string;
  index: TextIndex;
  symbols: string[];
  alphabet: string[];
  symbolCount: number;
  byteCount: number;
  adaptive: boolean;
  entropies: EntropyResult[];
  costs: ModelCost[];
  rows: StaircaseRow[];
  /** The order with the smallest total. The app's headline number. */
  optimalOrder: Order;
  /** Upper end of the surprisal ramp, in bits. */
  rampMaxBits: number;
  /** The models the coders are run against, at every order. */
  models: FrequencyModel[];
}

/** A fresh model at one order, ready to be coded against. */
function freshModel(analysis: TextAnalysis, order: Order): FrequencyModel {
  if (!analysis.adaptive) return analysis.models[order];
  const model = emptyModel(analysis.alphabet, order, analysis.index.contexts[order]);
  model.symbolCount = analysis.symbolCount;
  return model;
}

/**
 * Everything that depends only on the text and the adaptive flag. Cached,
 * because changing the coder must not recompute the models.
 */
export function analyseText(text: string, adaptive: boolean): TextAnalysis {
  const symbols = toSymbols(text);
  const index = indexText(symbols, MAX_ORDER);
  const staticModels = buildModelsFromIndex(index, MAX_ORDER);
  const entropies = entropyStaircase(index, staticModels);

  let models: FrequencyModel[];
  let codeBits: number[];
  if (adaptive) {
    models = ORDERS.map((order) => {
      const m = emptyModel(index.alphabet, order, index.contexts[order]);
      m.symbolCount = symbols.length;
      return m;
    });
    // The models handed to `adaptiveIdealBits` are consumed by it, so the ones
    // the coders will use are built separately and stay empty.
    const learning = ORDERS.map((order) =>
      emptyModel(index.alphabet, order, index.contexts[order]),
    );
    codeBits = adaptiveIdealBits(index, learning);
  } else {
    models = staticModels;
    codeBits = staticModels.map((m) => idealBits(index, m));
  }

  const costs = modelCosts(models);
  const n = symbols.length;
  const rows: StaircaseRow[] = ORDERS.map((order) => ({
    order,
    entropyBits: entropies[order].bits,
    modelBits: n > 0 ? costs[order].bits / n : 0,
    codeBits: n > 0 ? codeBits[order] / n : 0,
    totalBits: n > 0 ? (costs[order].bits + codeBits[order]) / n : 0,
    contexts: entropies[order].contexts,
  }));

  let optimalOrder: Order = 0;
  for (const row of rows) {
    if (row.totalBits < rows[optimalOrder].totalBits) optimalOrder = row.order;
  }

  return {
    text,
    index,
    symbols,
    alphabet: index.alphabet,
    symbolCount: n,
    byteCount: toBytes(text).length,
    adaptive,
    entropies,
    costs,
    rows,
    optimalOrder,
    // A four-symbol alphabet maxes out at 2 bits and would render entirely
    // pale against an 8-bit ramp, so the ramp is rescaled and the interface
    // says what it was rescaled to.
    rampMaxBits: index.alphabet.length > 1 ? Math.min(8, Math.log2(index.alphabet.length)) : 1,
    models,
  };
}

/* ------------------------------------------------------------ the coders */

export interface HuffmanRun {
  result: CoderResult;
  trace: HuffmanTrace;
  waste: WasteEntry[];
  wasteBits: number;
  surprisal: Float64Array;
}

export interface ArithmeticRun {
  result: CoderResult;
  trace: ArithmeticTrace;
  surprisal: Float64Array;
}

export interface Lz77Run {
  result: CoderResult;
  trace: Lz77Trace;
  widths: ReturnType<typeof tokenWidths>;
  literals: number;
  matches: number;
  /** Byte offset to symbol position, so the window view highlights characters. */
  byteToSymbol: Int32Array;
  /** Symbol position to byte offset. */
  symbolToByte: Int32Array;
}

/**
 * The context whose code table the tree view draws: the empty context at order
 * 0, and the context of the text's first symbols above it. Choosing a context
 * is unavoidable at higher orders, where there is a tree per context.
 */
function traceContextId(analysis: TextAnalysis, order: Order): number {
  const ids = analysis.index.contexts[order].positionIds;
  if (order === 0 || ids === null || ids.length === 0) {
    return analysis.index.contexts[order].idFor([]);
  }
  return ids[Math.min(order, ids.length - 1)];
}

export function runHuffman(analysis: TextAnalysis, order: Order): HuffmanRun {
  const encoded = huffmanEncode(analysis.index, freshModel(analysis, order));
  const reference = analysis.adaptive ? measuredModel(analysis, order) : analysis.models[order];
  const contextId = traceContextId(analysis, order);
  const waste = huffmanWaste(analysis.symbols, reference, contextId);
  return {
    result: totals(encoded.bits, analysis.costs[order].bits, analysis, order),
    trace: huffmanTrace(reference, contextId),
    waste,
    wasteBits: totalWasteBits(waste),
    surprisal: surprisals(analysis.index, freshModel(analysis, order)),
  };
}

export function runArithmetic(
  analysis: TextAnalysis,
  order: Order,
  traceLimit = 512,
): ArithmeticRun {
  const encoded = arithmeticEncode(analysis.index, freshModel(analysis, order), traceLimit);
  return {
    result: totals(encoded.bits, analysis.costs[order].bits, analysis, order),
    trace: encoded.trace,
    surprisal: surprisals(analysis.index, freshModel(analysis, order)),
  };
}

/**
 * An adaptive model after it has seen the whole text. The tree and waste views
 * need a settled distribution to draw; drawing the empty one would show a
 * uniform tree, which is true at the first symbol and useless.
 */
function measuredModel(analysis: TextAnalysis, order: Order): FrequencyModel {
  const model = emptyModel(analysis.alphabet, order, analysis.index.contexts[order]);
  model.symbolCount = analysis.symbolCount;
  const ids = analysis.index.contexts[order].positionIds!;
  for (let i = 0; i < analysis.symbolCount; i++) {
    model.observeAt(ids[i], analysis.index.symbolIds[i]);
  }
  return model;
}

export function runLz77(analysis: TextAnalysis, options: Lz77Options = DEFAULT_LZ77): Lz77Run {
  const bytes = toBytes(analysis.text);
  const encoded = lz77Encode(bytes, options);

  // LZ77 works on bytes; the window view draws characters. These map one to
  // the other so a highlighted range lands on whole characters.
  const byteToSymbol = new Int32Array(bytes.length + 1);
  const symbolToByte = new Int32Array(analysis.symbolCount + 1);
  let byteAt = 0;
  for (let i = 0; i < analysis.symbols.length; i++) {
    symbolToByte[i] = byteAt;
    const width = utf8Width(analysis.symbols[i].codePointAt(0)!);
    for (let k = 0; k < width; k++) byteToSymbol[byteAt + k] = i;
    byteAt += width;
  }
  symbolToByte[analysis.symbolCount] = bytes.length;
  byteToSymbol[bytes.length] = analysis.symbolCount;

  let literals = 0;
  let matches = 0;
  for (const token of encoded.tokens) {
    if (token.kind === 'literal') literals++;
    else matches++;
  }

  return {
    // LZ77 has no model description at all: its model is the text already
    // emitted, which the decoder has too.
    result: totals(encoded.bits, 0, analysis, null),
    trace: encoded.trace,
    widths: tokenWidths(options),
    literals,
    matches,
    byteToSymbol,
    symbolToByte,
  };
}

/** UTF-8 bytes a code point occupies. Encoding each symbol to find out was a
 * tenth of the recompute, all of it allocation. */
function utf8Width(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

function totals(
  codeBits: number,
  modelBits: number,
  analysis: TextAnalysis,
  order: Order | null,
): CoderResult {
  const totalBits = codeBits + modelBits;
  return {
    codeBits,
    modelBits,
    totalBits,
    symbolCount: analysis.symbolCount,
    bitsPerSymbol: analysis.symbolCount > 0 ? totalBits / analysis.symbolCount : 0,
    order,
    adaptive: analysis.adaptive,
  };
}

/* --------------------------------------------------------------- caching */

/**
 * A one-entry memo per key. Changing the coder must not recompute the models,
 * and dragging the order slider must not recompute them either.
 */
class Memo<K extends Record<string, unknown>, V> {
  private key: K | null = null;
  private value: V | null = null;

  get(key: K, compute: () => V): V {
    if (this.key !== null && sameKey(this.key, key) && this.value !== null) return this.value;
    this.key = key;
    this.value = compute();
    return this.value;
  }
}

function sameKey(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

const analysisMemo = new Memo<{ text: string; adaptive: boolean }, TextAnalysis>();
const huffmanMemo = new Memo<{ text: string; adaptive: boolean; order: Order }, HuffmanRun>();
const arithmeticMemo = new Memo<{ text: string; adaptive: boolean; order: Order }, ArithmeticRun>();
const lz77Memo = new Memo<
  { text: string; windowSize: number; lookahead: number; lazy: boolean },
  Lz77Run
>();

export function cachedAnalysis(text: string, adaptive: boolean): TextAnalysis {
  return analysisMemo.get({ text, adaptive }, () => analyseText(text, adaptive));
}

export function cachedHuffman(analysis: TextAnalysis, order: Order): HuffmanRun {
  return huffmanMemo.get({ text: analysis.text, adaptive: analysis.adaptive, order }, () =>
    runHuffman(analysis, order),
  );
}

export function cachedArithmetic(analysis: TextAnalysis, order: Order): ArithmeticRun {
  return arithmeticMemo.get({ text: analysis.text, adaptive: analysis.adaptive, order }, () =>
    runArithmetic(analysis, order),
  );
}

export function cachedLz77(analysis: TextAnalysis, options: Lz77Options): Lz77Run {
  return lz77Memo.get({ text: analysis.text, ...options }, () => runLz77(analysis, options));
}
