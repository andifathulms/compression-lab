/**
 * Trace record types.
 *
 * Every coder emits a trace alongside its output, and the views render the
 * trace rather than re-simulating the algorithm. Display and computation are
 * one object, so they cannot drift: if a view shows a match, the encoder
 * emitted that match.
 */

import type { Order } from './model.ts';

/* ------------------------------------------------------------------ Huffman */

export interface HuffmanNode {
  id: number;
  weight: number;
  /** Leaves carry a symbol; internal nodes do not. */
  symbol: string | null;
  left: HuffmanNode | null;
  right: HuffmanNode | null;
}

export interface HuffmanMerge {
  step: number;
  left: HuffmanNode;
  right: HuffmanNode;
  /** The queue *after* the merge, ascending by weight. */
  queue: HuffmanNode[];
}

export interface HuffmanTrace {
  /** The context this tree belongs to. Empty at order 0. */
  context: string;
  root: HuffmanNode | null;
  merges: HuffmanMerge[];
  /** Symbol to its canonical code, as a string of '0' and '1'. */
  codes: Map<string, string>;
  /** Weights the tree was built from: observed count + the smoothing constant. */
  weights: Map<string, number>;
}

/* ---------------------------------------------------------------- Huffman waste */

export interface WasteEntry {
  symbol: string;
  frequency: number;
  /** -log2 p, the cost an ideal coder would pay. */
  idealBits: number;
  /** The whole number of bits Huffman actually assigned. */
  codeBits: number;
}

/* ------------------------------------------------------------------- LZ77 */

export type Lz77Token =
  /** LZ77 works on bytes, so a literal is a byte, not a code point. */
  | { kind: 'literal'; byte: number }
  | { kind: 'match'; distance: number; length: number };

export interface Lz77Step {
  position: number;
  windowStart: number;
  lookaheadEnd: number;
  match: { distance: number; length: number } | null;
  emitted: Lz77Token;
  candidatesExamined: number;
  /** Bits this token cost under the stated encoding. */
  costBits: number;
  /** True when the greedy match was dropped for a longer one at position + 1. */
  lazySkipped: boolean;
}

export interface Lz77Trace {
  steps: Lz77Step[];
  windowSize: number;
  lookahead: number;
  lazy: boolean;
}

/* ------------------------------------------------------------- Arithmetic */

export interface ArithmeticStep {
  index: number;
  symbol: string;
  context: string;
  lowBefore: bigint;
  highBefore: bigint;
  lowAfter: bigint;
  highAfter: bigint;
  /** The [0,1) idealisation, carried alongside the integer state for display. */
  idealLow: number;
  idealHigh: number;
  bitsEmitted: string;
  underflowCount: number;
  /** -log2 p(symbol), the cost the model assigns. */
  costBits: number;
  /** Cumulative output bits after this symbol. */
  cumulativeBits: number;
  probability: number;
  /**
   * log2 of the idealised interval width after this symbol. Carried as a
   * logarithm because the width itself underflows a double after about 50
   * symbols, and the depth readout needs to keep counting past that.
   */
  widthLog2: number;
}

export interface ArithmeticTrace {
  steps: ArithmeticStep[];
  /** Total bits actually written, including the flush. */
  totalBits: number;
}

/* ---------------------------------------------------------------- Results */

export interface CoderResult {
  /** Bits of code stream. Never includes the model description. */
  codeBits: number;
  /** Bits of model description, measured from the serialiser. */
  modelBits: number;
  /** codeBits + modelBits. The only figure the app calls a compressed size. */
  totalBits: number;
  symbolCount: number;
  /** totalBits / symbolCount. */
  bitsPerSymbol: number;
  order: Order | null;
  adaptive: boolean;
}
