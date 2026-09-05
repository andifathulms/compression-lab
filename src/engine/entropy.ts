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
  indexText,
  type FrequencyModel,
  type Order,
  type TextIndex,
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
export function conditionalEntropy(index: TextIndex, model: FrequencyModel): number {
  const n = index.symbols.length;
  if (n === 0) return 0;
  const contextIds = index.contexts[model.order].positionIds!;
  let bits = 0;
  for (let i = 0; i < n; i++) {
    const id = contextIds[i];
    bits += -Math.log2(model.countAt(id, index.symbolIds[i]) / model.totalAt(id));
  }
  return bits / n;
}

/** The staircase: one entry per order, non-increasing in `bits`. */
export function entropyStaircase(
  index: TextIndex,
  models: readonly FrequencyModel[],
): EntropyResult[] {
  return models.map((model) => ({
    order: model.order,
    bits: conditionalEntropy(index, model),
    contexts: index.contexts[model.order].size,
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
 * When `model.adaptive` the model learns as the walk proceeds, which is what
 * an adaptive coder pays symbol by symbol; the model is mutated, so pass a
 * fresh one.
 */
export function surprisals(index: TextIndex, model: FrequencyModel): Float64Array {
  const n = index.symbols.length;
  const contextIds = index.contexts[model.order].positionIds!;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const id = contextIds[i];
    const symbolId = index.symbolIds[i];
    out[i] = -Math.log2(model.probabilityAt(id, symbolId));
    if (model.adaptive) model.observeAt(id, symbolId);
  }
  return out;
}

/** Total cost of coding the text under a model, in bits. */
/**
 * Per-position cost under an adaptive model, in bits.
 *
 * The static twin of this is `surprisals`, which asks a finished model what
 * each character cost. An adaptive model has no finished state to ask: it
 * knows only what it has already seen, so the cost of position i has to be
 * taken before position i is observed, and the model is consumed by the walk.
 *
 * This is the measurement behind the claim that adaptive coding is not free.
 * It transmits no counts, but it starts ignorant, and the opening characters
 * are charged at close to log2 of the alphabet size.
 */
export function adaptiveSurprisals(
  index: TextIndex,
  model: FrequencyModel,
): Float64Array {
  const n = index.symbols.length;
  const out = new Float64Array(n);
  const contextIds = index.contexts[model.order].positionIds!;
  for (let i = 0; i < n; i++) {
    const id = contextIds[i];
    const symbolId = index.symbolIds[i];
    out[i] = -Math.log2(model.probabilityAt(id, symbolId));
    model.observeAt(id, symbolId);
  }
  return out;
}

export function idealBits(index: TextIndex, model: FrequencyModel): number {
  const n = index.symbols.length;
  const contextIds = index.contexts[model.order].positionIds!;
  let bits = 0;
  for (let i = 0; i < n; i++) {
    const id = contextIds[i];
    const symbolId = index.symbolIds[i];
    bits += -Math.log2(model.probabilityAt(id, symbolId));
    if (model.adaptive) model.observeAt(id, symbolId);
  }
  return bits;
}

/**
 * Ideal cost at every order under models that learn as they go, in one pass
 * over the text.
 *
 * The cost of a symbol is charged *before* the models observe it, which is
 * what makes the figure honest: an adaptive coder cannot use a count it has
 * not yet been given.
 */
export function adaptiveIdealBits(
  index: TextIndex,
  models: readonly FrequencyModel[],
): number[] {
  const n = index.symbols.length;
  const bits = models.map(() => 0);
  for (let k = 0; k < models.length; k++) {
    const model = models[k];
    const contextIds = index.contexts[model.order].positionIds!;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const id = contextIds[i];
      const symbolId = index.symbolIds[i];
      total += -Math.log2(model.probabilityAt(id, symbolId));
      model.observeAt(id, symbolId);
    }
    bits[k] = total;
  }
  return bits;
}

/**
 * The number of distinct contexts at each order, which is what drives model
 * cost upward.
 */
export function contextCounts(symbols: readonly string[]): number[] {
  return indexText(symbols).contexts.map((c) => c.size);
}

/** Surprisal of one position, for the text surface's hover readout. */
export function surprisalAt(
  symbols: readonly string[],
  model: FrequencyModel,
  position: number,
): { context: string; probability: number; bits: number } {
  const context = contextAt(symbols, position, model.order);
  const probability = model.probability(context, symbols[position]);
  return { context: context.join(''), probability, bits: -Math.log2(probability) };
}
