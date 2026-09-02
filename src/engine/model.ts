/**
 * Order-N frequency models over the symbols of a text.
 *
 * A symbol is a Unicode code point, not a UTF-16 unit, so text outside the
 * Basic Multilingual Plane is modelled as one symbol rather than as a
 * surrogate pair.
 *
 * Smoothing: add-constant (Laplace, alpha = 1) over the observed alphabet.
 * Every symbol of the alphabet therefore has non-zero probability in every
 * context, including contexts never seen, which is what lets a high-order
 * coder survive an unseen context without PPM escape mechanics. The choice is
 * arbitrary and it moves the numbers, so it is stated in the interface.
 */

export type Order = 0 | 1 | 2 | 3 | 4 | 5;
export const ORDERS: readonly Order[] = [0, 1, 2, 3, 4, 5];
export const MAX_ORDER: Order = 5;

/** Laplace constant. Named because it appears in the interface copy. */
export const ALPHA = 1;

const SEP = '\u001F';

/**
 * Context keys carry their symbol length. Without it, a single astral symbol
 * (two UTF-16 units) and two BMP symbols would produce the same joined string
 * and share a count table.
 */
export function contextKey(symbols: readonly string[]): string {
  return symbols.length + SEP + symbols.join('');
}

/** The human-readable context back out of a key, for traces and hover readouts. */
export function contextText(key: string): string {
  return key.slice(key.indexOf(SEP) + 1);
}

/** The symbol length a context key carries in its prefix. */
export function contextLength(key: string): number {
  return Number(key.slice(0, key.indexOf(SEP)));
}

/** Split text into code-point symbols. */
export function toSymbols(text: string): string[] {
  return Array.from(text);
}

/**
 * The context at position `i`: the preceding `order` symbols, truncated at the
 * start of the text. Truncating rather than padding with a sentinel keeps the
 * alphabet equal to the symbols that actually occur.
 */
export function contextAt(symbols: readonly string[], i: number, order: number): string[] {
  const start = i - order < 0 ? 0 : i - order;
  return symbols.slice(start, i) as string[];
}

export interface FrequencyTable {
  /** Smoothed counts, indexed by position in `alphabet`. */
  freqs: number[];
  total: number;
}

export interface Model {
  readonly order: Order;
  readonly adaptive: boolean;
  readonly counts: Map<string, Map<string, number>>;
  readonly alphabet: string[];
  probability(context: readonly string[], symbol: string): number;
  observe(context: readonly string[], symbol: string): void;
  frequencies(context: readonly string[]): FrequencyTable;
  indexOf(symbol: string): number;
}

export class FrequencyModel implements Model {
  readonly counts: Map<string, Map<string, number>>;
  /**
   * Symbols in the text this model describes. Not a property of the
   * distribution, but the decoder needs it to know when to stop, so it rides
   * along in the model description and is counted in the model cost.
   */
  symbolCount = 0;
  private readonly index: Map<string, number>;
  private readonly totals: Map<string, number>;

  constructor(
    readonly order: Order,
    readonly adaptive: boolean,
    readonly alphabet: string[],
    counts?: Map<string, Map<string, number>>,
  ) {
    this.counts = counts ?? new Map();
    this.index = new Map(alphabet.map((s, i) => [s, i]));
    this.totals = new Map();
    for (const [key, row] of this.counts) {
      let t = 0;
      for (const c of row.values()) t += c;
      this.totals.set(key, t);
    }
  }

  indexOf(symbol: string): number {
    const i = this.index.get(symbol);
    return i === undefined ? -1 : i;
  }

  /** Raw observed count, before smoothing. Used by the entropy calculation. */
  count(context: readonly string[], symbol: string): number {
    const row = this.counts.get(contextKey(context));
    return row?.get(symbol) ?? 0;
  }

  contextTotal(context: readonly string[]): number {
    return this.totals.get(contextKey(context)) ?? 0;
  }

  probability(context: readonly string[], symbol: string): number {
    const key = contextKey(context);
    const row = this.counts.get(key);
    const seen = row?.get(symbol) ?? 0;
    const total = this.totals.get(key) ?? 0;
    return (seen + ALPHA) / (total + ALPHA * this.alphabet.length);
  }

  frequencies(context: readonly string[]): FrequencyTable {
    const key = contextKey(context);
    const row = this.counts.get(key);
    const n = this.alphabet.length;
    const freqs = new Array<number>(n).fill(ALPHA);
    let total = ALPHA * n;
    if (row) {
      for (const [symbol, c] of row) {
        const i = this.index.get(symbol);
        if (i !== undefined) {
          freqs[i] += c;
          total += c;
        }
      }
    }
    return { freqs, total };
  }

  observe(context: readonly string[], symbol: string): void {
    const key = contextKey(context);
    let row = this.counts.get(key);
    if (!row) {
      row = new Map();
      this.counts.set(key, row);
    }
    row.set(symbol, (row.get(symbol) ?? 0) + 1);
    this.totals.set(key, (this.totals.get(key) ?? 0) + 1);
  }
}

/** Sorted by code point, so serialisation is canonical and diffs are stable. */
export function alphabetOf(symbols: readonly string[]): string[] {
  const set = new Set<string>(symbols);
  return Array.from(set).sort(
    (a, b) => a.codePointAt(0)! - b.codePointAt(0)!,
  );
}

/**
 * Build the static models for every order in a single pass over the text.
 *
 * Six passes would be the obvious implementation and would cost six times as
 * much; the recompute budget is 16 ms for 10,000 characters (PRD 8.2), so the
 * pass is shared.
 */
export function buildModels(
  symbols: readonly string[],
  maxOrder: Order = MAX_ORDER,
): FrequencyModel[] {
  const alphabet = alphabetOf(symbols);
  const models: FrequencyModel[] = [];
  for (let k = 0; k <= maxOrder; k++) {
    models.push(new FrequencyModel(k as Order, false, alphabet));
  }
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    for (let k = 0; k <= maxOrder; k++) {
      models[k].observe(contextAt(symbols, i, k), symbol);
    }
  }
  for (const model of models) model.symbolCount = symbols.length;
  return models;
}

/** A single static model at one order. */
export function buildModel(symbols: readonly string[], order: Order): FrequencyModel {
  const model = new FrequencyModel(order, false, alphabetOf(symbols));
  for (let i = 0; i < symbols.length; i++) {
    model.observe(contextAt(symbols, i, order), symbols[i]);
  }
  model.symbolCount = symbols.length;
  return model;
}

/**
 * An adaptive model starts empty and learns as coding proceeds. Its count
 * table costs nothing to transmit because the decoder rebuilds it from the
 * symbols it has already decoded; only the alphabet has to be sent.
 */
export function emptyModel(alphabet: string[], order: Order): FrequencyModel {
  return new FrequencyModel(order, true, alphabet);
}
