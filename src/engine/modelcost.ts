/**
 * Model description size — measured, never estimated.
 *
 * This is the part of the app most easily faked, and faking it would make the
 * central chart fiction: if the model looks free, higher orders look strictly
 * better, which is exactly the misconception the app exists to remove. So the
 * model is really serialised, into bytes a decoder really consumes, and the
 * figure in the interface is that array's length times eight.
 *
 * Format, stated in the interface beside the figure:
 *
 *   magic     4 bytes, 'CLM1'
 *   flags     1 byte  - order in the low 3 bits, adaptive in bit 3
 *   varint    symbol count
 *   varint    alphabet size
 *   varints   alphabet code points, ascending, delta coded
 *   varint    context count
 *   per context, in canonical order:
 *     varint    context length in symbols
 *     varints   alphabet index of each context symbol
 *     varint    row size
 *     per entry: varint alphabet-index delta, varint count
 *
 * An adaptive model writes a context count of zero. Its counts cost nothing
 * because the decoder rebuilds them from the symbols it has already decoded -
 * that is what adaptive coding buys, and it is half the answer to why LZ77
 * wins. What an adaptive model still costs is its alphabet and its symbol
 * count, and those are in the figure, because they are really transmitted.
 */

import { FrequencyModel, type Order } from './model.ts';

const MAGIC = [0x43, 0x4c, 0x4d, 0x31]; // 'CLM1'

class ByteWriter {
  private readonly bytes: number[] = [];

  byte(value: number): void {
    this.bytes.push(value & 0xff);
  }

  /** Unsigned LEB128. */
  varint(value: number): void {
    let v = value;
    for (;;) {
      const chunk = v & 0x7f;
      v = Math.floor(v / 128);
      if (v === 0) {
        this.bytes.push(chunk);
        return;
      }
      this.bytes.push(chunk | 0x80);
    }
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

class ByteReader {
  private at = 0;

  constructor(private readonly bytes: Uint8Array) {}

  byte(): number {
    if (this.at >= this.bytes.length) throw new Error('model description ended early');
    return this.bytes[this.at++];
  }

  varint(): number {
    let value = 0;
    let shift = 1;
    for (;;) {
      const b = this.byte();
      value += (b & 0x7f) * shift;
      if ((b & 0x80) === 0) return value;
      shift *= 128;
    }
  }
}

interface Row {
  context: string[];
  entries: Array<readonly [number, number]>;
}

/**
 * Contexts in a canonical order - by length, then by the context text - so
 * that two models built from the same text serialise identically and the
 * measured size is reproducible. Interning gives contexts ids in first-seen
 * order, which depends on where in the text they appear; that would still
 * round-trip, but it would make the measured size depend on nothing the reader
 * can see.
 */
function canonicalRows(model: FrequencyModel): Row[] {
  const rows: Row[] = [];
  model.forEachContext((_id, context, row) => {
    rows.push({
      context,
      entries: Array.from(row.entries()).sort((a, b) => a[0] - b[0]),
    });
  });
  return rows.sort((a, b) => {
    if (a.context.length !== b.context.length) return a.context.length - b.context.length;
    const ta = a.context.join('');
    const tb = b.context.join('');
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}

export function serialiseModel(model: FrequencyModel): Uint8Array {
  const w = new ByteWriter();
  for (const b of MAGIC) w.byte(b);
  w.byte((model.order & 0x07) | (model.adaptive ? 0x08 : 0x00));
  w.varint(model.symbolCount);

  w.varint(model.alphabet.length);
  let previous = 0;
  for (const symbol of model.alphabet) {
    const point = symbol.codePointAt(0)!;
    w.varint(point - previous);
    previous = point;
  }

  const index = new Map(model.alphabet.map((s, i) => [s, i]));

  if (model.adaptive) {
    w.varint(0);
    return w.finish();
  }

  const rows = canonicalRows(model);
  w.varint(rows.length);
  for (const { context, entries } of rows) {
    w.varint(context.length);
    for (const s of context) w.varint(index.get(s)!);

    w.varint(entries.length);
    let last = 0;
    for (const [i, count] of entries) {
      w.varint(i - last);
      last = i;
      w.varint(count);
    }
  }
  return w.finish();
}

export function deserialiseModel(bytes: Uint8Array): FrequencyModel {
  const r = new ByteReader(bytes);
  for (const b of MAGIC) {
    if (r.byte() !== b) throw new Error('not a model description');
  }
  const flags = r.byte();
  const order = (flags & 0x07) as Order;
  const adaptive = (flags & 0x08) !== 0;
  const symbolCount = r.varint();

  const alphabetSize = r.varint();
  const alphabet: string[] = [];
  let point = 0;
  for (let i = 0; i < alphabetSize; i++) {
    point += r.varint();
    alphabet.push(String.fromCodePoint(point));
  }

  const model = new FrequencyModel(order, adaptive, alphabet);
  const contextCount = r.varint();
  for (let c = 0; c < contextCount; c++) {
    const length = r.varint();
    const symbols: string[] = [];
    for (let i = 0; i < length; i++) symbols.push(alphabet[r.varint()]);
    const rowSize = r.varint();
    const entries: Array<readonly [number, number]> = [];
    let last = 0;
    for (let i = 0; i < rowSize; i++) {
      last += r.varint();
      entries.push([last, r.varint()] as const);
    }
    model.loadRow(symbols, entries);
  }
  model.symbolCount = symbolCount;
  return model;
}

/** The figure the interface shows. A measured quantity, not a formula. */
export function modelCostBits(model: FrequencyModel): number {
  return serialiseModel(model).length * 8;
}

export interface ModelCost {
  order: Order;
  bytes: number;
  bits: number;
  contexts: number;
  /** Bits of model description per symbol of text. */
  bitsPerSymbol: number;
}

export function modelCosts(models: readonly FrequencyModel[]): ModelCost[] {
  return models.map((model) => {
    const bits = modelCostBits(model);
    return {
      order: model.order,
      bytes: bits / 8,
      bits,
      contexts: model.adaptive ? 0 : model.contextCount,
      bitsPerSymbol: model.symbolCount > 0 ? bits / model.symbolCount : 0,
    };
  });
}


/* ----------------------------------------------- what the description holds */

/** Bytes an unsigned LEB128 varint occupies, without writing one. */
function varintSize(value: number): number {
  let v = value;
  let bytes = 1;
  while (v >= 128) {
    v = Math.floor(v / 128);
    bytes++;
  }
  return bytes;
}

export interface ModelSection {
  label: string;
  bytes: number;
  /** What this part of the description is for, in one line. */
  note: string;
}

export interface ModelLayout {
  totalBytes: number;
  sections: ModelSection[];
}

/**
 * The model description broken into the parts the format actually writes.
 *
 * "Model cost is measured, not estimated" is the load-bearing claim of the
 * whole project, and it was the one figure in the interface with nothing
 * behind it but a number. This is the number taken apart. The sections sum to
 * `serialiseModel(model).length` exactly, and the interface asserts that they
 * do rather than trusting it — a breakdown that does not reconcile would be
 * worse than no breakdown at all.
 */
export function modelLayout(model: FrequencyModel): ModelLayout {
  const sections: ModelSection[] = [];

  sections.push({
    label: 'magic and flags',
    bytes: MAGIC.length + 1,
    note: "Four bytes of 'CLM1', then the order and the adaptive bit.",
  });

  sections.push({
    label: 'symbol count',
    bytes: varintSize(model.symbolCount),
    note: 'How many symbols to decode. Not a property of the distribution, but the decoder needs it to know when to stop.',
  });

  let alphabetBytes = varintSize(model.alphabet.length);
  let previous = 0;
  for (const symbol of model.alphabet) {
    const point = symbol.codePointAt(0)!;
    alphabetBytes += varintSize(point - previous);
    previous = point;
  }
  sections.push({
    label: 'alphabet',
    bytes: alphabetBytes,
    note: `${model.alphabet.length} code points, ascending and delta coded. An adaptive model still pays this.`,
  });

  if (model.adaptive) {
    sections.push({
      label: 'counts',
      bytes: varintSize(0),
      note: 'A single zero. The decoder rebuilds every count from the symbols it has already decoded, which is what adaptive coding buys.',
    });
  } else {
    const rows = canonicalRows(model);
    const index = new Map(model.alphabet.map((s, i) => [s, i]));
    let contextBytes = varintSize(rows.length);
    for (const { context, entries } of rows) {
      contextBytes += varintSize(context.length);
      for (const sym of context) contextBytes += varintSize(index.get(sym)!);
      contextBytes += varintSize(entries.length);
      let last = 0;
      for (const [i, count] of entries) {
        contextBytes += varintSize(i - last);
        last = i;
        contextBytes += varintSize(count);
      }
    }
    sections.push({
      label: 'counts',
      bytes: contextBytes,
      note: `${rows.length} contexts, each with the symbols that followed it and how often. This is the part that grows with order.`,
    });
  }

  return {
    totalBytes: sections.reduce((sum, part) => sum + part.bytes, 0),
    sections,
  };
}

export interface ContextCost {
  /** The context itself, as text. Empty at order 0. */
  context: string;
  /** Distinct symbols observed after it. */
  entries: number;
  /** Times this context occurred in the text. */
  occurrences: number;
  /** What its row costs in the description. */
  bytes: number;
}

export interface ContextBreakdown {
  rows: ContextCost[];
  /** Contexts seen exactly once. */
  singletons: number;
  /** What those cost, in bytes. */
  singletonBytes: number;
  totalContexts: number;
  totalBytes: number;
}

/**
 * Per-context cost, ranked by what each row costs.
 *
 * This is the mechanism behind the staircase's rising model curve. At order 3
 * most contexts occur once or twice: each buys a table entry and saves almost
 * nothing, and it is the accumulation of those that turns the model line
 * upward. The staircase shows that the curve rises; this shows why.
 */
export function contextBreakdown(model: FrequencyModel, limit = 40): ContextBreakdown {
  if (model.adaptive) {
    return { rows: [], singletons: 0, singletonBytes: 0, totalContexts: 0, totalBytes: 0 };
  }
  const index = new Map(model.alphabet.map((s, i) => [s, i]));
  const all: ContextCost[] = canonicalRows(model).map(({ context, entries }) => {
    let bytes = varintSize(context.length);
    for (const sym of context) bytes += varintSize(index.get(sym)!);
    bytes += varintSize(entries.length);
    let last = 0;
    let occurrences = 0;
    for (const [i, count] of entries) {
      bytes += varintSize(i - last);
      last = i;
      bytes += varintSize(count);
      occurrences += count;
    }
    return { context: context.join(''), entries: entries.length, occurrences, bytes };
  });

  let singletons = 0;
  let singletonBytes = 0;
  let totalBytes = 0;
  for (const row of all) {
    totalBytes += row.bytes;
    if (row.occurrences === 1) {
      singletons++;
      singletonBytes += row.bytes;
    }
  }

  const rows = all
    .slice()
    .sort((a, b) => b.bytes - a.bytes || b.occurrences - a.occurrences)
    .slice(0, limit);

  return { rows, singletons, singletonBytes, totalContexts: all.length, totalBytes };
}
