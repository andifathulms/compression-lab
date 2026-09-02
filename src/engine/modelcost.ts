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

import {
  FrequencyModel,
  contextKey,
  contextLength,
  contextText,
  type Order,
} from './model.ts';

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

/**
 * Contexts in a canonical order - by length, then by the context text - so
 * that two models built from the same text serialise identically and the
 * measured size is reproducible.
 */
function canonicalContexts(model: FrequencyModel): string[] {
  return Array.from(model.counts.keys()).sort((a, b) => {
    const la = contextLength(a);
    const lb = contextLength(b);
    if (la !== lb) return la - lb;
    const ta = contextText(a);
    const tb = contextText(b);
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

  const contexts = canonicalContexts(model);
  w.varint(contexts.length);
  for (const key of contexts) {
    const symbols = Array.from(contextText(key));
    w.varint(symbols.length);
    for (const s of symbols) w.varint(index.get(s)!);

    const row = model.counts.get(key)!;
    const entries = Array.from(row.entries())
      .map(([symbol, count]) => [index.get(symbol)!, count] as const)
      .sort((a, b) => a[0] - b[0]);
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

  const counts = new Map<string, Map<string, number>>();
  const contextCount = r.varint();
  for (let c = 0; c < contextCount; c++) {
    const length = r.varint();
    const symbols: string[] = [];
    for (let i = 0; i < length; i++) symbols.push(alphabet[r.varint()]);
    const rowSize = r.varint();
    const row = new Map<string, number>();
    let last = 0;
    for (let i = 0; i < rowSize; i++) {
      last += r.varint();
      row.set(alphabet[last], r.varint());
    }
    counts.set(contextKey(symbols), row);
  }

  const model = new FrequencyModel(order, adaptive, alphabet, counts);
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
      contexts: model.adaptive ? 0 : model.counts.size,
      bitsPerSymbol: model.symbolCount > 0 ? bits / model.symbolCount : 0,
    };
  });
}
