/**
 * Arithmetic coding, as an integer range coder.
 *
 * The interval is held in integers, not in a floating-point [0,1). A naive
 * double implementation loses the interval after roughly fifteen symbols; the
 * idealised real interval that the Interval view draws is computed separately
 * and carried in the trace beside the integer state, so the view can be
 * honest about being an idealisation.
 *
 * Precision is 48 bits rather than the more usual 32. At 32 bits the floor
 * division that carves the interval drifts upward: measured on a
 * 10,000-symbol order-4 text it costs 1.54 bits, which is inside the 2-bit
 * bound in `bounds.test.ts` but leaves almost no headroom for a text with a
 * larger alphabet. Widening the register removes the drift; widening the
 * tolerance would only hide it.
 */

import { BitWriter, BitReader } from './bitio.ts';
import { contextAt, type FrequencyModel, type TextIndex } from './model.ts';
import type { ArithmeticStep, ArithmeticTrace } from './trace.ts';

export const PRECISION = 48n;
const TOP = (1n << PRECISION) - 1n;
const HALF = 1n << (PRECISION - 1n);
const QUARTER = 1n << (PRECISION - 2n);
const THREE_QUARTERS = QUARTER * 3n;

/** Largest frequency total the coder can carve without the interval collapsing. */
export const MAX_TOTAL = 1n << (PRECISION - 2n);

/**
 * Running totals of the smoothed frequencies for one context, held as bigints
 * because that is what the interval arithmetic consumes.
 *
 * A static model's counts do not change while coding, so a context's table is
 * built once and kept. That removes both the per-symbol refill and the
 * per-symbol BigInt conversion, which together were most of the coder's time.
 * An adaptive model's counts change under it, so it rebuilds every symbol.
 */
const CACHE_LIMIT = 50_000;

class Cumulative {
  /** cum[i] is the total frequency of alphabet positions below i. */
  cum: BigInt64Array;
  total = 0n;
  private readonly scratch: BigInt64Array;
  private readonly cache: Array<BigInt64Array | undefined> | null;

  constructor(private readonly model: FrequencyModel) {
    const width = model.alphabet.length + 1;
    this.scratch = new BigInt64Array(width);
    this.cum = this.scratch;
    // Caching a table per context is only worth its memory while the contexts
    // are countable; above the limit the coder rebuilds each time.
    this.cache = model.adaptive || model.index.size > CACHE_LIMIT ? null : [];
  }

  at(contextId: number): this {
    const hit = this.cache?.[contextId];
    if (hit !== undefined) {
      this.cum = hit;
      this.total = hit[hit.length - 1];
      return this;
    }
    const target = this.cache ? new BigInt64Array(this.scratch.length) : this.scratch;
    const { freqs } = this.model.fill(contextId);
    let running = 0n;
    target[0] = 0n;
    for (let i = 0; i < freqs.length; i++) {
      running += BigInt(freqs[i]);
      target[i + 1] = running;
    }
    if (this.cache) this.cache[contextId] = target;
    this.cum = target;
    this.total = running;
    return this;
  }

  /** p(symbol), from the band widths rather than a second frequency lookup. */
  probability(symbolId: number): number {
    return Number(this.cum[symbolId + 1] - this.cum[symbolId]) / Number(this.total);
  }
}

/** Band boundaries as fractions of the current interval, for the trace. */
function normalise(cum: BigInt64Array, total: bigint): Float64Array {
  const scale = Number(total);
  const out = new Float64Array(cum.length);
  for (let i = 0; i < cum.length; i++) out[i] = Number(cum[i]) / scale;
  return out;
}

export interface ArithmeticEncoded {
  bytes: Uint8Array;
  bits: number;
  symbolCount: number;
  trace: ArithmeticTrace;
}

/**
 * @param traceLimit how many steps to record. The Interval view reads at most
 *   a few hundred, and recording 200,000 bigint pairs would cost more than the
 *   coding does.
 */
export function arithmeticEncode(
  index: TextIndex,
  model: FrequencyModel,
  traceLimit = 512,
): ArithmeticEncoded {
  const symbols = index.symbols;
  const contextIds = index.contexts[model.order].positionIds!;
  const table = new Cumulative(model);
  const writer = new BitWriter();
  let low = 0n;
  let high = TOP;
  let pending = 0;
  const steps: ArithmeticStep[] = [];
  let widthLog2 = 0;

  /** Emit a resolved bit, then the pending underflow bits at opposite polarity. */
  const emit = (bit: 0 | 1, sink: string[]): void => {
    writer.writeBit(bit);
    sink.push(String(bit));
    const opposite = bit === 0 ? '1' : '0';
    while (pending > 0) {
      writer.writeBit(bit === 0 ? 1 : 0);
      sink.push(opposite);
      pending--;
    }
  };

  for (let i = 0; i < symbols.length; i++) {
    const contextId = contextIds[i];
    const symbolId = index.symbolIds[i];
    const { cum, total } = table.at(contextId);
    if (total > MAX_TOTAL) throw new Error('frequency total exceeds the coder precision');

    const lowBefore = low;
    const highBefore = high;
    const range = high - low + 1n;
    high = low + (range * cum[symbolId + 1]) / total - 1n;
    low = low + (range * cum[symbolId]) / total;

    const probability = table.probability(symbolId);
    const costBits = -Math.log2(probability);
    widthLog2 -= costBits;

    const emitted: string[] = [];
    for (;;) {
      if (high < HALF) {
        emit(0, emitted);
      } else if (low >= HALF) {
        emit(1, emitted);
        low -= HALF;
        high -= HALF;
      } else if (low >= QUARTER && high < THREE_QUARTERS) {
        // The interval straddles the midpoint but is narrowing. Remember the
        // bit we cannot yet resolve and emit it once the next one is known.
        pending++;
        low -= QUARTER;
        high -= QUARTER;
      } else {
        break;
      }
      low = low * 2n;
      high = high * 2n + 1n;
    }

    if (steps.length < traceLimit) {
      steps.push({
        index: i,
        symbol: symbols[i],
        context: contextAt(symbols, i, model.order).join(''),
        lowBefore,
        highBefore,
        lowAfter: low,
        highAfter: high,
        idealLow: Number(cum[symbolId]) / Number(total),
        idealHigh: Number(cum[symbolId + 1]) / Number(total),
        bitsEmitted: emitted.join(''),
        underflowCount: pending,
        costBits,
        cumulativeBits: writer.length,
        probability,
        widthLog2,
        bands: normalise(cum, total),
      });
    }

    if (model.adaptive) model.observeAt(contextId, symbolId);
  }

  // Flush: one more bit distinguishes the interval, and the pending bits go
  // with it. Dropping this is the classic way to be right for 10,000 symbols
  // and wrong at the end.
  if (symbols.length > 0) {
    pending++;
    const tail: string[] = [];
    if (low < QUARTER) emit(0, tail);
    else emit(1, tail);
  }

  return {
    bytes: writer.finish(),
    bits: writer.length,
    symbolCount: symbols.length,
    trace: { steps, totalBits: writer.length },
  };
}

export function arithmeticDecode(
  bytes: Uint8Array,
  model: FrequencyModel,
  symbolCount: number,
): string {
  if (symbolCount === 0) return '';
  const reader = new BitReader(bytes);
  const table = new Cumulative(model);
  let low = 0n;
  let high = TOP;
  let value = 0n;
  for (let i = 0n; i < PRECISION; i++) value = value * 2n + BigInt(reader.readBit());

  const out: string[] = [];
  for (let i = 0; i < symbolCount; i++) {
    const contextId = model.index.idFor(contextAt(out, i, model.order));
    const { cum, total } = table.at(contextId);
    const range = high - low + 1n;
    const scaled = ((value - low + 1n) * total - 1n) / range;

    // Binary search for the band containing `scaled`.
    let lo = 0;
    let hi = model.alphabet.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid + 1] <= scaled) lo = mid + 1;
      else hi = mid;
    }
    const index = lo;

    high = low + (range * cum[index + 1]) / total - 1n;
    low = low + (range * cum[index]) / total;

    for (;;) {
      if (high < HALF) {
        // nothing to subtract
      } else if (low >= HALF) {
        low -= HALF;
        high -= HALF;
        value -= HALF;
      } else if (low >= QUARTER && high < THREE_QUARTERS) {
        low -= QUARTER;
        high -= QUARTER;
        value -= QUARTER;
      } else {
        break;
      }
      low = low * 2n;
      high = high * 2n + 1n;
      value = value * 2n + BigInt(reader.readBit());
    }

    out.push(model.alphabet[index]);
    if (model.adaptive) model.observeAt(contextId, index);
  }
  return out.join('');
}

/** -sum log2 p(symbol), the bound the coder is measured against. */
export function idealCodeBits(index: TextIndex, model: FrequencyModel): number {
  const contextIds = index.contexts[model.order].positionIds!;
  let bits = 0;
  for (let i = 0; i < index.symbols.length; i++) {
    const contextId = contextIds[i];
    const symbolId = index.symbolIds[i];
    bits += -Math.log2(model.probabilityAt(contextId, symbolId));
    if (model.adaptive) model.observeAt(contextId, symbolId);
  }
  return bits;
}
