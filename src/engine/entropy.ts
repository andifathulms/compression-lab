/**
 * Conditional entropies H0 .. H5, in bits per symbol.
 *
 * These are the *empirical* conditional entropies of the text: the counts are
 * used unsmoothed, so H_k is the average code length an ideal coder would
 * achieve if it were handed the exact order-k statistics of this text for
 * free. Unsmoothed is the right choice here for two reasons: it is the
 * quantity textbooks call conditional entropy, and it is guaranteed
 * non-increasing in the order, which the smoothed version is not.
 *
 * The coders do not get the statistics for free — they pay Laplace smoothing
 * and, if static, the model description. That gap is the app's subject, so the
 * two quantities are deliberately kept distinct rather than reconciled.
 */

import {
  contextAt,
  contextKey,
  type FrequencyModel,
  type Order,
  MAX_ORDER,
} from './model.ts';

export interface EntropyResult {
  order: Order;
  /** Bits per symbol. */
  bits: number;
  /** Number of distinct contexts seen at this order. */
  contexts: number;
}

/**
 * H_k = -(1/N) * sum_i log2 ( count(ctx_i, s_i) / count(ctx_i) ).
 *
 * Every term is well defined: the context and symbol at position i were both
 * counted from this same text, so the numerator is at least 1.
 */
export function conditionalEntropy(
  symbols: readonly string[],
  model: FrequencyModel,
): number {
  if (symbols.length === 0) return 0;
  let bits = 0;
  for (let i = 0; i < symbols.length; i++) {
    const context = contextAt(symbols, i, model.order);
    const seen = model.count(context, symbols[i]);
    const total = model.contextTotal(context);
    bits += -Math.log2(seen / total);
  }
  return bits / symbols.length;
}

/** The staircase: one entry per order, non-increasing in `bits`. */
export function entropyStaircase(
  symbols: readonly string[],
  models: readonly FrequencyModel[],
): EntropyResult[] {
  return models.map((m) => ({
    order: m.order,
    bits: conditionalEntropy(symbols, m),
    contexts: m.counts.size,
  }));
}

/**
 * Order-0 entropy computed directly from symbol frequencies, independent of
 * the model machinery. `entropy.test.ts` checks the two agree; if they ever
 * diverge the model is miscounting.
 */
export function order0Entropy(symbols: readonly string[]): number {
  if (symbols.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const s of symbols) freq.set(s, (freq.get(s) ?? 0) + 1);
  let h = 0;
  for (const c of freq.values()) {
    const p = c / symbols.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/**
 * Per-symbol surprisal under a model, in bits: -log2 p(symbol | context).
 *
 * This is what the text surface renders as ink. It uses the *smoothed*
 * probability, because that is what a coder using this model actually pays.
 */
export function surprisals(
  symbols: readonly string[],
  model: FrequencyModel,
): Float64Array {
  const out = new Float64Array(symbols.length);
  for (let i = 0; i < symbols.length; i++) {
    const context = contextAt(symbols, i, model.order);
    out[i] = -Math.log2(model.probability(context, symbols[i]));
  }
  return out;
}

/**
 * Surprisals under a model that learns as it goes, matching what an adaptive
 * coder pays symbol by symbol. The model is mutated; pass a fresh one.
 */
export function adaptiveSurprisals(
  symbols: readonly string[],
  model: FrequencyModel,
): Float64Array {
  const out = new Float64Array(symbols.length);
  for (let i = 0; i < symbols.length; i++) {
    const context = contextAt(symbols, i, model.order);
    out[i] = -Math.log2(model.probability(context, symbols[i]));
    model.observe(context, symbols[i]);
  }
  return out;
}

/** Total cost of coding the text under a static model, in bits. */
export function idealBits(
  symbols: readonly string[],
  model: FrequencyModel,
): number {
  let bits = 0;
  for (let i = 0; i < symbols.length; i++) {
    bits += -Math.log2(model.probability(contextAt(symbols, i, model.order), symbols[i]));
  }
  return bits;
}

/**
 * The number of distinct contexts at each order, which is what drives model
 * cost upward. Exposed for the staircase's model-cost annotation.
 */
export function contextCounts(symbols: readonly string[]): number[] {
  const out: number[] = [];
  for (let k = 0; k <= MAX_ORDER; k++) {
    const seen = new Set<string>();
    for (let i = 0; i < symbols.length; i++) {
      seen.add(contextKey(contextAt(symbols, i, k)));
    }
    out.push(seen.size);
  }
  return out;
}
