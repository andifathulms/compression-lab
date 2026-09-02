/**
 * Huffman coding, conditioned on the model's context.
 *
 * At order 0 this is the familiar single code table. At order k there is one
 * code table per context, built from that context's smoothed counts. The
 * decoder rebuilds every table from the same counts, so nothing beyond the
 * model description has to be transmitted.
 *
 * Because the model is smoothed, every symbol of the alphabet appears in every
 * table, and so every symbol costs at least one bit. That is the honest
 * consequence of not implementing escape mechanics, and it is why Huffman at
 * high order loses ground to arithmetic coding on top of losing ground to the
 * model description.
 */

import { BitWriter, BitReader } from './bitio.ts';
import { contextAt, type FrequencyModel, type TextIndex } from './model.ts';
import type { HuffmanNode, HuffmanTrace, HuffmanMerge, WasteEntry } from './trace.ts';

/** Codes deeper than this cannot occur for any weight table this app builds. */
const MAX_CODE_BITS = 32;

export interface CodeTable {
  /** Code length in bits, indexed by alphabet position. */
  lengths: Int32Array;
  /** Canonical code value, indexed by alphabet position. */
  codes: Int32Array;
  /** Decoding aids, indexed by code length. */
  firstCode: Int32Array;
  firstIndex: Int32Array;
  countPerLength: Int32Array;
  /** Alphabet positions ordered by (length, position). */
  sorted: Int32Array;
  maxLength: number;
}

/**
 * Huffman code lengths for a weight vector, by the two-queue construction.
 *
 * Ties are broken by ascending weight then ascending alphabet position, which
 * makes the result a pure function of the weights. The decoder builds from the
 * same weights, so any non-determinism here would be a decode failure.
 */
export function codeLengths(weights: ArrayLike<number>): Int32Array {
  const n = weights.length;
  const lengths = new Int32Array(n);
  if (n === 0) return lengths;
  if (n === 1) {
    lengths[0] = 1; // A one-symbol alphabet still costs a bit per symbol.
    return lengths;
  }

  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => weights[a] - weights[b] || a - b,
  );

  // Node arrays: 0..n-1 are leaves in `order`, n..2n-2 are internal nodes.
  const total = 2 * n - 1;
  const weight = new Float64Array(total);
  const left = new Int32Array(total).fill(-1);
  const right = new Int32Array(total).fill(-1);
  for (let i = 0; i < n; i++) weight[i] = weights[order[i]];

  let leaf = 0;
  let internal = n;
  let next = n;

  /** Take the lighter of the two queue heads, preferring leaves on a tie. */
  const take = (): number => {
    if (leaf < n && (internal >= next || weight[leaf] <= weight[internal])) {
      return leaf++;
    }
    return internal++;
  };

  while (next < total) {
    const a = take();
    const b = take();
    weight[next] = weight[a] + weight[b];
    left[next] = a;
    right[next] = b;
    next++;
  }

  // Depth of every node, walking down from the root.
  const depth = new Int32Array(total);
  const root = total - 1;
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (left[node] === -1) {
      lengths[order[node]] = depth[node];
      continue;
    }
    depth[left[node]] = depth[node] + 1;
    depth[right[node]] = depth[node] + 1;
    stack.push(left[node], right[node]);
  }
  return lengths;
}

/**
 * Canonical codes from code lengths: shortest first, and within a length by
 * alphabet position. Canonical means the whole table is recoverable from the
 * lengths alone, which is what makes the decoder's job cheap.
 */
export function canonicalTable(lengths: Int32Array): CodeTable {
  const n = lengths.length;
  let maxLength = 0;
  for (let i = 0; i < n; i++) if (lengths[i] > maxLength) maxLength = lengths[i];
  if (maxLength > MAX_CODE_BITS) {
    throw new Error(`Huffman code of ${maxLength} bits exceeds the ${MAX_CODE_BITS}-bit limit`);
  }

  const countPerLength = new Int32Array(maxLength + 2);
  for (let i = 0; i < n; i++) if (lengths[i] > 0) countPerLength[lengths[i]]++;

  const sorted = new Int32Array(n);
  const offset = new Int32Array(maxLength + 2);
  let running = 0;
  for (let len = 1; len <= maxLength; len++) {
    offset[len] = running;
    running += countPerLength[len];
  }
  const cursor = offset.slice();
  for (let i = 0; i < n; i++) {
    if (lengths[i] > 0) sorted[cursor[lengths[i]]++] = i;
  }

  const codes = new Int32Array(n);
  const firstCode = new Int32Array(maxLength + 2);
  const firstIndex = new Int32Array(maxLength + 2);
  let code = 0;
  for (let len = 1; len <= maxLength; len++) {
    firstCode[len] = code;
    firstIndex[len] = offset[len];
    for (let k = 0; k < countPerLength[len]; k++) {
      codes[sorted[offset[len] + k]] = code + k;
    }
    code = (code + countPerLength[len]) << 1;
  }

  return { lengths, codes, firstCode, firstIndex, countPerLength, sorted, maxLength };
}

/**
 * Code tables per context, built lazily and cached by context id.
 *
 * The adaptive coder invalidates one context after each update, so a context
 * is rebuilt only when its counts have actually changed.
 */
export class HuffmanTables {
  private readonly cache: Array<CodeTable | undefined> = [];

  constructor(private readonly model: FrequencyModel) {}

  invalidate(contextId: number): void {
    this.cache[contextId] = undefined;
  }

  get(contextId: number): CodeTable {
    const hit = this.cache[contextId];
    if (hit !== undefined) return hit;
    const { freqs } = this.model.fill(contextId);
    const table = canonicalTable(codeLengths(freqs));
    this.cache[contextId] = table;
    return table;
  }
}

export interface HuffmanEncoded {
  bytes: Uint8Array;
  bits: number;
  symbolCount: number;
}

/**
 * Encode with a static model: the model is measured over the whole text and
 * transmitted, so every code table is fixed before the first symbol.
 */
export function huffmanEncode(index: TextIndex, model: FrequencyModel): HuffmanEncoded {
  const tables = new HuffmanTables(model);
  const writer = new BitWriter();
  const contextIds = index.contexts[model.order].positionIds!;
  const n = index.symbols.length;
  for (let i = 0; i < n; i++) {
    const contextId = contextIds[i];
    const symbolId = index.symbolIds[i];
    const table = tables.get(contextId);
    writer.writeBits(table.codes[symbolId], table.lengths[symbolId]);
    if (model.adaptive) {
      model.observeAt(contextId, symbolId);
      tables.invalidate(contextId);
    }
  }
  return { bytes: writer.finish(), bits: writer.length, symbolCount: n };
}

/**
 * Decode. The decoder walks the canonical table by length, which is why the
 * lengths alone are enough and no tree is transmitted.
 */
export function huffmanDecode(
  bytes: Uint8Array,
  model: FrequencyModel,
  symbolCount: number,
): string {
  const tables = new HuffmanTables(model);
  const reader = new BitReader(bytes);
  const out: string[] = [];
  for (let i = 0; i < symbolCount; i++) {
    // The decoder has no text to intern ahead of time; it interns the context
    // it has just produced, which is the same context the encoder used.
    const contextId = model.index.idFor(contextAt(out, i, model.order));
    const table = tables.get(contextId);
    let code = 0;
    let index = -1;
    for (let len = 1; len <= table.maxLength; len++) {
      code = (code << 1) | reader.readBit();
      const count = table.countPerLength[len];
      if (count > 0 && code - table.firstCode[len] < count) {
        index = table.sorted[table.firstIndex[len] + (code - table.firstCode[len])];
        break;
      }
    }
    if (index < 0) throw new Error('Huffman stream does not decode: no code matched');
    out.push(model.alphabet[index]);
    if (model.adaptive) {
      model.observeAt(contextId, index);
      tables.invalidate(contextId);
    }
  }
  return out.join('');
}

/* ------------------------------------------------------------------ Traces */

/**
 * Rebuild one context's tree with the merges recorded, for the tree view.
 *
 * This is a second implementation of the same construction, kept honest by a
 * test asserting its code lengths equal `codeLengths`. It exists because the
 * fast path uses typed arrays and has no nodes to draw.
 */
export function huffmanTrace(model: FrequencyModel, contextId: number): HuffmanTrace {
  const { freqs } = model.frequenciesAt(contextId);
  const weights = new Map<string, number>();
  model.alphabet.forEach((s, i) => weights.set(s, freqs[i]));

  let nextId = 0;
  let queue: HuffmanNode[] = model.alphabet.map((symbol, i) => ({
    id: nextId++,
    weight: freqs[i],
    symbol,
    left: null,
    right: null,
  }));
  queue.sort((a, b) => a.weight - b.weight || a.id - b.id);

  const merges: HuffmanMerge[] = [];
  let step = 0;
  while (queue.length > 1) {
    const left = queue[0];
    const right = queue[1];
    const parent: HuffmanNode = {
      id: nextId++,
      weight: left.weight + right.weight,
      symbol: null,
      left,
      right,
    };
    queue = queue.slice(2);
    // Insert at the first position whose weight is greater, so equal weights
    // keep the older node first and the construction stays deterministic.
    let at = 0;
    while (at < queue.length && queue[at].weight <= parent.weight) at++;
    queue.splice(at, 0, parent);
    merges.push({ step: step++, left, right, queue: queue.slice() });
  }

  const root = queue[0] ?? null;
  // The drawn tree and the canonical table can differ in shape; the codes shown
  // are the canonical ones, because those are the codes the encoder writes.
  const table = canonicalTable(codeLengths(freqs));
  const codes = new Map<string, string>();
  model.alphabet.forEach((symbol, i) => {
    codes.set(symbol, table.codes[i].toString(2).padStart(table.lengths[i], '0'));
  });

  return {
    context: contextId >= 0 ? model.index.texts[contextId] : '',
    root,
    merges,
    codes,
    weights,
  };
}

/**
 * Per-symbol ideal cost against the whole number of bits Huffman assigned.
 * The area between them, weighted by frequency, is what Huffman loses.
 */
export function huffmanWaste(
  symbols: readonly string[],
  model: FrequencyModel,
  contextId: number,
): WasteEntry[] {
  const { freqs, total } = model.frequenciesAt(contextId);
  const table = canonicalTable(codeLengths(freqs));
  const occurrences = new Map<string, number>();
  for (const s of symbols) occurrences.set(s, (occurrences.get(s) ?? 0) + 1);
  return model.alphabet
    .map((symbol, i) => ({
      symbol,
      frequency: occurrences.get(symbol) ?? 0,
      idealBits: -Math.log2(freqs[i] / total),
      codeBits: table.lengths[i],
    }))
    .sort((a, b) => b.frequency - a.frequency || a.symbol.localeCompare(b.symbol));
}

/** Total bits Huffman spends above the ideal, over the whole text. */
export function totalWasteBits(entries: readonly WasteEntry[]): number {
  return entries.reduce((sum, e) => sum + e.frequency * (e.codeBits - e.idealBits), 0);
}
