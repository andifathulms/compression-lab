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
 *
 * Representation. Contexts and symbols are interned to integers before any
 * counting happens, and every model, entropy and coder loop works on those
 * integers. The obvious implementation — a Map keyed by the context string,
 * rebuilt on each pass — measured about fifteen times over the 16 ms recompute
 * budget for a 10,000-character text, because it rebuilds the same context
 * strings six times per pass and again for every coder. `counts` is still
 * exposed in the documented Map-of-Maps shape, materialised on demand, so the
 * shape the model is specified in is the shape the tests can check.
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

/** Sorted by code point, so serialisation is canonical and diffs are stable. */
export function alphabetOf(symbols: readonly string[]): string[] {
  const set = new Set<string>(symbols);
  return Array.from(set).sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!);
}

/* --------------------------------------------------------- context interning */

/**
 * The contexts seen at one order, interned to integer ids.
 *
 * Which context a position has is a property of the text alone, not of any
 * model's counts, so one index serves the static model, the adaptive model and
 * every coder at that order.
 *
 * Contexts are held as plain strings, in one map per symbol length. Separate
 * maps rather than a length-prefixed key because a context of one astral
 * symbol and a context of two BMP symbols are the same string, and because
 * building the prefix was measurable at 60,000 contexts per recompute.
 */
export class ContextIndex {
  /** Symbol length to a map from context text to id. */
  private readonly maps: Array<Map<string, number>> = [];
  /** Context id to its text. */
  readonly texts: string[] = [];
  /** Context id to its length in symbols. */
  readonly lengths: number[] = [];
  /** Position to context id, when the index was built over a known text. */
  positionIds: Int32Array | null = null;

  constructor(readonly order: Order) {}

  get size(): number {
    return this.texts.length;
  }

  private mapFor(length: number): Map<string, number> {
    let map = this.maps[length];
    if (map === undefined) {
      map = new Map();
      this.maps[length] = map;
    }
    return map;
  }

  /** Intern a context given as text plus its symbol length. */
  idForText(text: string, length: number): number {
    const map = this.mapFor(length);
    const hit = map.get(text);
    if (hit !== undefined) return hit;
    const id = this.texts.length;
    map.set(text, id);
    this.texts.push(text);
    this.lengths.push(length);
    return id;
  }

  /** Intern a context, creating an id if this is the first sighting. */
  idFor(context: readonly string[]): number {
    return this.idForText(context.join(''), context.length);
  }

  /** Look up without creating. -1 when the context has not been seen. */
  lookup(context: readonly string[]): number {
    const hit = this.maps[context.length]?.get(context.join(''));
    return hit === undefined ? -1 : hit;
  }

  /** The context's symbols, for the serialiser and for display. */
  symbolsOf(id: number): string[] {
    return Array.from(this.texts[id]);
  }

  key(id: number): string {
    return this.lengths[id] + SEP + this.texts[id];
  }
}

/**
 * Intern every position's context at one order, in a single walk.
 *
 * `charOffsets` maps a symbol position to its UTF-16 offset in `text`, so a
 * context is one substring rather than an array slice and a join. That
 * difference was most of the recompute budget.
 */
export function indexContexts(
  text: string,
  charOffsets: Int32Array,
  count: number,
  order: Order,
): ContextIndex {
  const index = new ContextIndex(order);
  const positionIds = new Int32Array(count);
  if (order === 0) {
    // One context, and it is empty. Worth its own branch: it is a sixth of the
    // work and none of it is needed.
    if (count > 0) index.idForText('', 0);
    index.positionIds = positionIds;
    return index;
  }
  for (let i = 0; i < count; i++) {
    const start = i - order < 0 ? 0 : i - order;
    positionIds[i] = index.idForText(
      text.slice(charOffsets[start], charOffsets[i]),
      i - start,
    );
  }
  index.positionIds = positionIds;
  return index;
}

/**
 * Every order's context index plus the alphabet, computed once per text. This
 * is the object the entropy pass and the coders are handed.
 */
export interface TextIndex {
  symbols: string[];
  alphabet: string[];
  /** Position to alphabet position. */
  symbolIds: Int32Array;
  /** Position to UTF-16 offset in the text. */
  charOffsets: Int32Array;
  /** One per order, 0 through `maxOrder`. */
  contexts: ContextIndex[];
}

export function indexText(symbols: readonly string[], maxOrder: Order = MAX_ORDER): TextIndex {
  const n = symbols.length;
  const alphabet = alphabetOf(symbols);
  const lookup = new Map(alphabet.map((s, i) => [s, i]));
  const symbolIds = new Int32Array(n);
  const charOffsets = new Int32Array(n + 1);
  let offset = 0;
  for (let i = 0; i < n; i++) {
    symbolIds[i] = lookup.get(symbols[i])!;
    charOffsets[i] = offset;
    offset += symbols[i].length;
  }
  charOffsets[n] = offset;
  const text = symbols.join('');

  const contexts: ContextIndex[] = [];
  for (let k = 0; k <= maxOrder; k++) {
    contexts.push(indexContexts(text, charOffsets, n, k as Order));
  }

  return { symbols: symbols as string[], alphabet, symbolIds, charOffsets, contexts };
}

/* ---------------------------------------------------------------- the model */

export interface FrequencyTable {
  /** Smoothed counts, indexed by position in `alphabet`. */
  freqs: Float64Array;
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
  /** Context id to a sparse row of alphabet position to count. */
  private readonly rows: Array<Map<number, number> | undefined> = [];
  private readonly totals: number[] = [];
  private readonly lookup: Map<string, number>;
  /** Reused by `fill`, so coding a symbol allocates nothing. */
  private readonly scratch: Float64Array;

  /**
   * Symbols in the text this model describes. Not a property of the
   * distribution, but the decoder needs it to know when to stop, so it rides
   * along in the model description and is counted in the model cost.
   */
  symbolCount = 0;

  constructor(
    readonly order: Order,
    readonly adaptive: boolean,
    readonly alphabet: string[],
    readonly index: ContextIndex = new ContextIndex(order),
  ) {
    this.lookup = new Map(alphabet.map((s, i) => [s, i]));
    this.scratch = new Float64Array(alphabet.length);
  }

  /** Contexts this model has actually counted something in. */
  get contextCount(): number {
    let seen = 0;
    for (const row of this.rows) if (row !== undefined && row.size > 0) seen++;
    return seen;
  }

  indexOf(symbol: string): number {
    const i = this.lookup.get(symbol);
    return i === undefined ? -1 : i;
  }

  /* ------------------------------------------------ integer-indexed core */

  private rowFor(id: number): Map<number, number> {
    let row = this.rows[id];
    if (row === undefined) {
      row = new Map();
      this.rows[id] = row;
      this.totals[id] = 0;
    }
    return row;
  }

  observeAt(contextId: number, symbolId: number): void {
    const row = this.rowFor(contextId);
    row.set(symbolId, (row.get(symbolId) ?? 0) + 1);
    this.totals[contextId] += 1;
  }

  countAt(contextId: number, symbolId: number): number {
    if (contextId < 0) return 0;
    return this.rows[contextId]?.get(symbolId) ?? 0;
  }

  totalAt(contextId: number): number {
    if (contextId < 0) return 0;
    return this.totals[contextId] ?? 0;
  }

  probabilityAt(contextId: number, symbolId: number): number {
    return (
      (this.countAt(contextId, symbolId) + ALPHA) /
      (this.totalAt(contextId) + ALPHA * this.alphabet.length)
    );
  }

  /**
   * Smoothed frequencies for a context, written into a reused buffer. The
   * arithmetic coder calls this once per symbol; allocating a fresh array each
   * time was a fifth of the whole recompute.
   */
  fill(contextId: number): FrequencyTable {
    const freqs = this.scratch;
    freqs.fill(ALPHA);
    let total = ALPHA * this.alphabet.length;
    const row = contextId >= 0 ? this.rows[contextId] : undefined;
    if (row !== undefined) {
      for (const [symbolId, count] of row) {
        freqs[symbolId] += count;
        total += count;
      }
    }
    return { freqs, total };
  }

  /** A copy of the frequencies, for callers that keep the array. */
  frequenciesAt(contextId: number): FrequencyTable {
    const { freqs, total } = this.fill(contextId);
    return { freqs: freqs.slice(), total };
  }

  /** Enumerate the non-empty rows, for the serialiser. */
  forEachContext(
    visit: (contextId: number, context: string[], row: Map<number, number>) => void,
  ): void {
    for (let id = 0; id < this.rows.length; id++) {
      const row = this.rows[id];
      if (row === undefined || row.size === 0) continue;
      visit(id, this.index.symbolsOf(id), row);
    }
  }

  /* --------------------------------------------------- string-keyed facade */

  probability(context: readonly string[], symbol: string): number {
    const symbolId = this.lookup.get(symbol);
    if (symbolId === undefined) return 0;
    return this.probabilityAt(this.index.lookup(context), symbolId);
  }

  observe(context: readonly string[], symbol: string): void {
    const symbolId = this.lookup.get(symbol);
    if (symbolId === undefined) {
      throw new Error(`symbol ${JSON.stringify(symbol)} is not in the alphabet`);
    }
    this.observeAt(this.index.idFor(context), symbolId);
  }

  frequencies(context: readonly string[]): FrequencyTable {
    return this.frequenciesAt(this.index.lookup(context));
  }

  /** Raw observed count, before smoothing. Used by the entropy calculation. */
  count(context: readonly string[], symbol: string): number {
    const symbolId = this.lookup.get(symbol);
    if (symbolId === undefined) return 0;
    return this.countAt(this.index.lookup(context), symbolId);
  }

  contextTotal(context: readonly string[]): number {
    return this.totalAt(this.index.lookup(context));
  }

  /**
   * The documented Map-of-Maps view, materialised on demand. Nothing on a hot
   * path reads this.
   */
  get counts(): Map<string, Map<string, number>> {
    const out = new Map<string, Map<string, number>>();
    this.forEachContext((_id, context, row) => {
      const view = new Map<string, number>();
      for (const [symbolId, count] of row) view.set(this.alphabet[symbolId], count);
      out.set(contextKey(context), view);
    });
    return out;
  }

  /** Adopt a whole row from a deserialised description. */
  loadRow(context: readonly string[], entries: Iterable<readonly [number, number]>): void {
    const id = this.index.idFor(context);
    const row = this.rowFor(id);
    let total = 0;
    for (const [symbolId, count] of entries) {
      row.set(symbolId, count);
      total += count;
    }
    this.totals[id] = total;
  }
}

/* -------------------------------------------------------------- builders */

/**
 * Static models for every order, from an interned text.
 *
 * The interning pass is the expensive part and it is shared; filling six
 * models from the interned ids is then six cheap integer loops.
 */
export function buildModelsFromIndex(
  index: TextIndex,
  maxOrder: Order = MAX_ORDER,
): FrequencyModel[] {
  const models: FrequencyModel[] = [];
  const n = index.symbols.length;
  for (let k = 0; k <= maxOrder; k++) {
    const model = new FrequencyModel(k as Order, false, index.alphabet, index.contexts[k]);
    const ids = index.contexts[k].positionIds!;
    for (let i = 0; i < n; i++) model.observeAt(ids[i], index.symbolIds[i]);
    model.symbolCount = n;
    models.push(model);
  }
  return models;
}

/** Convenience for callers that only have the symbols. */
export function buildModels(
  symbols: readonly string[],
  maxOrder: Order = MAX_ORDER,
): FrequencyModel[] {
  return buildModelsFromIndex(indexText(symbols, maxOrder), maxOrder);
}

/** A single static model at one order. */
export function buildModel(symbols: readonly string[], order: Order): FrequencyModel {
  return buildModels(symbols, order)[order];
}

/**
 * An adaptive model starts empty and learns as coding proceeds. Its count
 * table costs nothing to transmit because the decoder rebuilds it from the
 * same history — that is what adaptive coding buys.
 *
 * Pass the text's context index when encoding, so the adaptive model shares
 * the interning the static models already paid for. A decoder has no text yet
 * and gets a fresh index.
 */
export function emptyModel(
  alphabet: string[],
  order: Order,
  index?: ContextIndex,
): FrequencyModel {
  return new FrequencyModel(order, true, alphabet, index ?? new ContextIndex(order));
}
