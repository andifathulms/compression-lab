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
import { contextAt, type FrequencyModel } from './model.ts';
import type { ArithmeticStep, ArithmeticTrace } from './trace.ts';

export const PRECISION = 48n;
const TOP = (1n << PRECISION) - 1n;
const HALF = 1n << (PRECISION - 1n);
const QUARTER = 1n << (PRECISION - 2n);
const THREE_QUARTERS = QUARTER * 3n;

/** Largest frequency total the coder can carve without the interval collapsing. */
export const MAX_TOTAL = 1n << (PRECISION - 2n);

interface Cumulative {
  /** cum[i] is the total frequency of alphabet positions below i. */
  cum: Float64Array;
  freqs: number[];
  total: number;
}

function cumulative(model: FrequencyModel, context: readonly string[]): Cumulative {
  const { freqs, total } = model.frequencies(context);
  const cum = new Float64Array(freqs.length + 1);
  for (let i = 0; i < freqs.length; i++) cum[i + 1] = cum[i] + freqs[i];
  return { cum, freqs, total };
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
  symbols: readonly string[],
  model: FrequencyModel,
  traceLimit = 512,
): ArithmeticEncoded {
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
    const context = contextAt(symbols, i, model.order);
    const { cum, freqs, total } = cumulative(model, context);
    const index = model.indexOf(symbols[i]);
    if (index < 0) throw new Error(`symbol ${JSON.stringify(symbols[i])} is not in the alphabet`);
    if (BigInt(total) > MAX_TOTAL) throw new Error('frequency total exceeds the coder precision');

    const lowBefore = low;
    const highBefore = high;
    const range = high - low + 1n;
    const t = BigInt(total);
    high = low + (range * BigInt(cum[index + 1])) / t - 1n;
    low = low + (range * BigInt(cum[index])) / t;

    const probability = freqs[index] / total;
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
        context: context.join(''),
        lowBefore,
        highBefore,
        lowAfter: low,
        highAfter: high,
        idealLow: cum[index] / total,
        idealHigh: cum[index + 1] / total,
        bitsEmitted: emitted.join(''),
        underflowCount: pending,
        costBits,
        cumulativeBits: writer.length,
        probability,
        widthLog2,
      });
    }

    if (model.adaptive) model.observe(context, symbols[i]);
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
  let low = 0n;
  let high = TOP;
  let value = 0n;
  for (let i = 0n; i < PRECISION; i++) value = value * 2n + BigInt(reader.readBit());

  const out: string[] = [];
  for (let i = 0; i < symbolCount; i++) {
    const context = contextAt(out, i, model.order);
    const { cum, total } = cumulative(model, context);
    const t = BigInt(total);
    const range = high - low + 1n;
    const scaled = ((value - low + 1n) * t - 1n) / range;

    // Binary search for the band containing `scaled`.
    let lo = 0;
    let hi = model.alphabet.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (BigInt(cum[mid + 1]) <= scaled) lo = mid + 1;
      else hi = mid;
    }
    const index = lo;

    high = low + (range * BigInt(cum[index + 1])) / t - 1n;
    low = low + (range * BigInt(cum[index])) / t;

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

    const symbol = model.alphabet[index];
    out.push(symbol);
    if (model.adaptive) model.observe(context, symbol);
  }
  return out.join('');
}

/** -sum log2 p(symbol), the bound the coder is measured against. */
export function idealCodeBits(symbols: readonly string[], model: FrequencyModel): number {
  let bits = 0;
  for (let i = 0; i < symbols.length; i++) {
    const context = contextAt(symbols, i, model.order);
    bits += -Math.log2(model.probability(context, symbols[i]));
    if (model.adaptive) model.observe(context, symbols[i]);
  }
  return bits;
}
