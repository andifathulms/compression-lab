/**
 * LZ77 with a hash-chain match finder.
 *
 * LZ77 operates on the UTF-8 bytes of the text, not on code points. That is
 * what the algorithm is in practice, and it is what makes the literal token
 * exactly nine bits. It also means LZ77 needs no alphabet and therefore no
 * model description at all: its model is the text it has already emitted, and
 * the decoder has that too. Paying nothing for the model is the whole reason
 * LZ77 can land below the order-0 entropy of the same text.
 *
 * Token encoding, which the interface states beside every LZ77 size because
 * the size depends on it and there is no single right answer:
 *
 *   literal   1 bit flag (0) + 8 bits of byte                    = 9 bits
 *   match     1 bit flag (1)
 *             + ceil(log2(windowSize))   bits holding distance-1
 *             + ceil(log2(lookahead-2))  bits holding length-3
 *
 * There is no end marker; the byte count is carried by the container, the same
 * way the symbol count is for the other two coders.
 */

import { BitWriter, BitReader, bitsFor } from './bitio.ts';
import type { Lz77Step, Lz77Token, Lz77Trace } from './trace.ts';

/** Shorter than three bytes never pays for a match token. */
export const MIN_MATCH = 3;

const HASH_BITS = 15;
const HASH_SIZE = 1 << HASH_BITS;
/** Chain walk limit. Without it a highly repetitive text degenerates to O(n*w). */
const MAX_CHAIN = 256;

export interface Lz77Options {
  windowSize: number;
  lookahead: number;
  lazy: boolean;
}

export const DEFAULT_LZ77: Lz77Options = { windowSize: 4096, lookahead: 32, lazy: false };

export interface TokenWidths {
  distanceBits: number;
  lengthBits: number;
  literalBits: number;
  matchBits: number;
}

export function tokenWidths(options: Lz77Options): TokenWidths {
  const distanceBits = bitsFor(options.windowSize);
  const lengthBits = bitsFor(options.lookahead - MIN_MATCH + 1);
  return {
    distanceBits,
    lengthBits,
    literalBits: 9,
    matchBits: 1 + distanceBits + lengthBits,
  };
}

export function toBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function fromBytes(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

interface Match {
  distance: number;
  length: number;
  candidates: number;
}

class MatchFinder {
  private readonly head = new Int32Array(HASH_SIZE).fill(-1);
  private readonly prev: Int32Array;

  constructor(
    private readonly data: Uint8Array,
    private readonly windowSize: number,
    private readonly lookahead: number,
  ) {
    this.prev = new Int32Array(data.length).fill(-1);
  }

  private hash(at: number): number {
    return (
      ((this.data[at] << 10) ^ (this.data[at + 1] << 5) ^ this.data[at + 2]) & (HASH_SIZE - 1)
    );
  }

  /** Record `at` as the newest position with its 3-byte prefix. */
  insert(at: number): void {
    if (at + MIN_MATCH > this.data.length) return;
    const h = this.hash(at);
    this.prev[at] = this.head[h];
    this.head[h] = at;
  }

  /**
   * Longest match for the bytes at `at`, searching back through the chain.
   *
   * The match may run past `at` into the look-ahead — distance shorter than
   * length is legal, and the decoder copies byte by byte so the tail of the
   * match is written as it is read.
   */
  find(at: number): Match | null {
    const n = this.data.length;
    const maxLength = Math.min(this.lookahead, n - at);
    if (maxLength < MIN_MATCH) return null;
    const limit = at - this.windowSize;

    let best: Match | null = null;
    let candidates = 0;
    let candidate = this.head[this.hash(at)];
    while (candidate >= 0 && candidate > limit && candidates < MAX_CHAIN) {
      candidates++;
      let length = 0;
      while (
        length < maxLength &&
        this.data[candidate + length] === this.data[at + length]
      ) {
        length++;
      }
      if (length >= MIN_MATCH && (best === null || length > best.length)) {
        best = { distance: at - candidate, length, candidates };
        if (length === maxLength) break;
      }
      candidate = this.prev[candidate];
    }
    if (best) best.candidates = candidates;
    return best;
  }
}

export interface Lz77Encoded {
  bytes: Uint8Array;
  bits: number;
  byteCount: number;
  tokens: Lz77Token[];
  trace: Lz77Trace;
}

export function lz77Encode(
  data: Uint8Array,
  options: Lz77Options = DEFAULT_LZ77,
  traceLimit = 4096,
): Lz77Encoded {
  const { distanceBits, lengthBits } = tokenWidths(options);
  const finder = new MatchFinder(data, options.windowSize, options.lookahead);
  const writer = new BitWriter();
  const tokens: Lz77Token[] = [];
  const steps: Lz77Step[] = [];

  let at = 0;
  while (at < data.length) {
    const before = writer.length;
    let match = finder.find(at);
    let lazySkipped = false;
    let alreadyInserted = false;

    if (match && options.lazy && at + 1 < data.length) {
      // Look one byte ahead. If the next position starts a longer match, the
      // literal here buys more than the match does. The probe needs `at` in
      // the chain, so it goes in now and is not inserted again below.
      finder.insert(at);
      alreadyInserted = true;
      const next = finder.find(at + 1);
      if (next && next.length > match.length) {
        match = null;
        lazySkipped = true;
      }
    }

    let emitted: Lz77Token;
    if (match) {
      writer.writeBit(1);
      writer.writeBits(match.distance - 1, distanceBits);
      writer.writeBits(match.length - MIN_MATCH, lengthBits);
      emitted = { kind: 'match', distance: match.distance, length: match.length };
    } else {
      writer.writeBit(0);
      writer.writeBits(data[at], 8);
      emitted = { kind: 'literal', byte: data[at] };
    }
    tokens.push(emitted);

    if (steps.length < traceLimit) {
      steps.push({
        position: at,
        windowStart: Math.max(0, at - options.windowSize),
        lookaheadEnd: Math.min(data.length, at + options.lookahead),
        match: match ? { distance: match.distance, length: match.length } : null,
        emitted,
        candidatesExamined: match ? match.candidates : 0,
        costBits: writer.length - before,
        lazySkipped,
      });
    }

    const advance = match ? match.length : 1;
    // Every position inside a match still goes into the chain, or later
    // positions cannot match against the middle of a repeated run.
    for (let k = 0; k < advance; k++) {
      if (k === 0 && alreadyInserted) continue;
      finder.insert(at + k);
    }
    at += advance;
  }

  return {
    bytes: writer.finish(),
    bits: writer.length,
    byteCount: data.length,
    tokens,
    trace: { steps, windowSize: options.windowSize, lookahead: options.lookahead, lazy: options.lazy },
  };
}

export function lz77Decode(
  encoded: Uint8Array,
  byteCount: number,
  options: Lz77Options = DEFAULT_LZ77,
): Uint8Array {
  const { distanceBits, lengthBits } = tokenWidths(options);
  const reader = new BitReader(encoded);
  const out = new Uint8Array(byteCount);
  let at = 0;
  while (at < byteCount) {
    if (reader.readBit() === 0) {
      out[at++] = reader.readBits(8);
      continue;
    }
    const distance = reader.readBits(distanceBits) + 1;
    const length = reader.readBits(lengthBits) + MIN_MATCH;
    if (distance > at) throw new Error('LZ77 stream references before the start of the output');
    // Byte by byte, not by block: when distance < length the copy reads bytes
    // this same loop has just written. That is the overlapping match, and
    // copying by block is the classic way to get it wrong.
    for (let k = 0; k < length; k++) {
      out[at] = out[at - distance];
      at++;
    }
  }
  return out;
}

/** Encode and decode a string end to end. */
export function lz77EncodeText(text: string, options: Lz77Options = DEFAULT_LZ77): Lz77Encoded {
  return lz77Encode(toBytes(text), options);
}

export function lz77DecodeText(
  encoded: Uint8Array,
  byteCount: number,
  options: Lz77Options = DEFAULT_LZ77,
): string {
  return fromBytes(lz77Decode(encoded, byteCount, options));
}
