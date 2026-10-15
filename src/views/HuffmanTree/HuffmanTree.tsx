/**
 * The Huffman tree, built bottom-up.
 *
 * The priority queue is the row beneath, shrinking by one on each merge. Nodes
 * carry their frequency; edges carry 0 and 1. Selecting a leaf marks every
 * occurrence of that symbol in the text surface, which is the reason the text
 * stays on screen while this is open.
 *
 * The tree drawn is the one the trace recorded, and the codes listed are the
 * canonical ones the encoder actually wrote. Those can differ in shape where
 * weights tie; the codes are what the stream contains, so the codes win.
 *
 * It grows left to right. Depth is a column, so every leaf lines up under the
 * code length it gets and the reader can count bits by column. It used to grow
 * downward with all fifty-three leaves of a prose alphabet in one row, which
 * put the labels at about six pixels. A finished tree with more rows than fit
 * folds its deepest subtrees into "+N more" nodes — the rare symbols, which is
 * what is deep in a Huffman tree — and opens them on request.
 */

import { useCallback, useMemo, useState } from 'react';
import type { HuffmanNode, HuffmanTrace } from '../../engine/index.ts';
import { display } from '../BitLedger/BitLedger.tsx';
import { ShowAll, useRowLimit } from '../../ui/RowLimit.tsx';
import './HuffmanTree.css';

interface Props {
  trace: HuffmanTrace;
  selected: string | null;
  onSelect: (symbol: string | null) => void;
}

const WIDTH = 640;
/** Room on the right of the deepest column for a symbol and its code. */
const LABEL_ROOM = 118;
const TOP = 28;
/** The most rows a folded tree is allowed before it folds deeper. */
const MAX_ROWS = 18;

interface Placed {
  node: HuffmanNode;
  /** Depth, which is the column. */
  x: number;
  /** Row, in leaf order; internal nodes sit at the mean of their children. */
  y: number;
  parent: Placed | null;
  bit: '0' | '1' | null;
  /** Symbols hidden under this node, when it is a fold. */
  folded: number;
  /** The symbols under a fold, so a selection inside one can light it. */
  hidden: Set<string> | null;
}

function isLeaf(node: HuffmanNode): boolean {
  return node.left === null || node.right === null;
}

function symbolsUnder(node: HuffmanNode, into: Set<string> = new Set()): Set<string> {
  if (isLeaf(node)) {
    if (node.symbol !== null) into.add(node.symbol);
    return into;
  }
  symbolsUnder(node.left!, into);
  symbolsUnder(node.right!, into);
  return into;
}

/** Rows the tree takes if every internal node at `fold` is folded. */
function rowsAt(node: HuffmanNode, level: number, fold: number | null): number {
  if (isLeaf(node)) return 1;
  if (fold !== null && level >= fold) return 1;
  return rowsAt(node.left!, level + 1, fold) + rowsAt(node.right!, level + 1, fold);
}

function maxDepth(node: HuffmanNode, level = 0): number {
  if (isLeaf(node)) return level;
  return Math.max(maxDepth(node.left!, level + 1), maxDepth(node.right!, level + 1));
}

/** The deepest fold that still fits, or null when the whole tree fits. */
function chooseFold(root: HuffmanNode): number | null {
  if (rowsAt(root, 0, null) <= MAX_ROWS) return null;
  for (let fold = maxDepth(root) - 1; fold >= 1; fold--) {
    if (rowsAt(root, 0, fold) <= MAX_ROWS) return fold;
  }
  return 1;
}

function layout(
  root: HuffmanNode | null,
  fold: number | null,
): { placed: Placed[]; depth: number; rows: number } {
  if (root === null) return { placed: [], depth: 0, rows: 0 };
  const placed: Placed[] = [];
  let row = 0;
  let depth = 0;

  const walk = (
    node: HuffmanNode,
    level: number,
    parent: Placed | null,
    bit: '0' | '1' | null,
  ): Placed => {
    depth = Math.max(depth, level);
    const folding = !isLeaf(node) && fold !== null && level >= fold;
    if (isLeaf(node) || folding) {
      const hidden = folding ? symbolsUnder(node) : null;
      const entry: Placed = {
        node,
        x: level,
        y: row++,
        parent,
        bit,
        folded: hidden?.size ?? 0,
        hidden,
      };
      placed.push(entry);
      return entry;
    }
    const entry: Placed = { node, x: level, y: 0, parent, bit, folded: 0, hidden: null };
    placed.push(entry);
    const left = walk(node.left!, level + 1, entry, '0');
    const right = walk(node.right!, level + 1, entry, '1');
    entry.y = (left.y + right.y) / 2;
    return entry;
  };

  walk(root, 0, null, null);
  return { placed, depth, rows: row };
}

export function HuffmanTree({ trace, selected, onSelect }: Props): JSX.Element {
  const [step, setStep] = useState(trace.merges.length);
  const [expanded, setExpanded] = useState(false);
  const atStep = Math.min(step, trace.merges.length);
  const complete = atStep >= trace.merges.length;

  // Folding is for reading the finished tree. While it is being built merge
  // by merge, every node is drawn so the build stays watchable.
  const fold = useMemo(
    () => (trace.root === null || expanded || !complete ? null : chooseFold(trace.root)),
    [trace.root, expanded, complete],
  );
  const { placed, depth, rows } = useMemo(() => layout(trace.root, fold), [trace.root, fold]);
  const totalLeaves = trace.codes.size;

  const rowH = rows > MAX_ROWS ? 15 : 19;
  const height = TOP + Math.max(1, rows) * rowH + 8;
  const colW = depth > 0 ? (WIDTH - 24 - LABEL_ROOM) / depth : 0;
  const px = (p: Placed): number => 16 + p.x * colW;
  const py = (p: Placed): number => TOP + p.y * rowH + rowH / 2;

  const queue = atStep === 0 ? initialQueue(trace) : trace.merges[atStep - 1].queue;
  const merge = atStep === 0 ? null : trace.merges[atStep - 1];

  // Only the nodes that exist by this step are drawn, so the build is
  // watchable rather than a finished picture with a slider next to it.
  const built = useMemo(() => {
    const ids = new Set<number>();
    for (let i = 0; i < atStep; i++) {
      collect(trace.merges[i].left, ids);
      collect(trace.merges[i].right, ids);
      ids.add(mergedId(trace, i));
    }
    return ids;
  }, [trace, atStep]);

  const visible = atStep >= trace.merges.length ? null : built;

  const codes = useMemo(
    () =>
      Array.from(trace.codes.entries())
        .map(([symbol, code]) => ({
          symbol,
          code,
          weight: trace.weights.get(symbol) ?? 0,
        }))
        .sort((a, b) => b.weight - a.weight || a.symbol.localeCompare(b.symbol)),
    [trace],
  );

  const limit = useRowLimit(codes.length);

  const toggle = useCallback(
    (symbol: string) => onSelect(selected === symbol ? null : symbol),
    [onSelect, selected],
  );

  if (trace.root === null) {
    return <p className="label">No tree: the text has no symbols.</p>;
  }

  return (
    <div className="ht">
      {/* The frame is its own element so the tree can scroll inside it on a
          narrow screen while the queue and the code table below stay put. */}
      <div className="ht-frame">
      <svg
        className="ht-svg"
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={`Huffman tree over ${totalLeaves} symbols, ${trace.merges.length} merges, drawn left to right with one column per code length. Every symbol and its code is in the table below.`}
      >
        {/* One column per code length, so bits can be counted across. */}
        {Array.from({ length: depth }, (_, d) => d + 1).map((d) => (
          <g key={`col${d}`}>
            <line
              x1={16 + d * colW}
              x2={16 + d * colW}
              y1={TOP - 8}
              y2={height - 4}
              className="ht-column"
            />
            <text x={16 + d * colW} y={14} className="ht-depth" textAnchor="middle">
              {d === 1 ? '1 bit' : `${d}`}
            </text>
          </g>
        ))}

        {placed.map((p) => {
          if (p.parent === null) return null;
          if (visible !== null && !visible.has(p.node.id)) return null;
          const x1 = px(p.parent);
          const y1 = py(p.parent);
          const x2 = px(p);
          const y2 = py(p);
          const mx = (x1 + x2) / 2;
          return (
            <g key={`e${p.node.id}`}>
              <path d={`M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} className="ht-edge" />
              {/* Where two siblings sit a row apart there is no room for the
                  bit between them, and the column already says how deep. */}
              {Math.abs(y2 - y1) >= 12 ? (
                <text x={mx} y={(y1 + y2) / 2 - 3} className="ht-bit">
                  {p.bit}
                </text>
              ) : null}
            </g>
          );
        })}
        {placed.map((p) => {
          if (visible !== null && !visible.has(p.node.id)) return null;
          const leaf = p.node.symbol !== null && p.folded === 0;
          const isFold = p.folded > 0;
          const isSelected =
            (leaf && p.node.symbol === selected) ||
            (isFold && selected !== null && p.hidden !== null && p.hidden.has(selected));
          const inMerge =
            merge !== null && (merge.left.id === p.node.id || merge.right.id === p.node.id);
          const code = leaf ? trace.codes.get(p.node.symbol!) : undefined;
          return (
            <g key={`n${p.node.id}`}>
              <circle
                cx={px(p)}
                cy={py(p)}
                r={leaf || isFold ? 4.5 : 2.75}
                className={[
                  'ht-node',
                  isFold ? 'ht-node-fold' : '',
                  isSelected ? 'ht-node-on' : inMerge ? 'ht-node-merge' : '',
                  leaf || isFold ? 'ht-leaf-hit' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                /*
                 * A pointer affordance, and only that. The code table below
                 * selects every symbol with a real button, and the "show all"
                 * button opens the folds; a tab stop per leaf was fifty-three
                 * stops through twelve-pixel targets.
                 */
                onClick={
                  leaf ? () => toggle(p.node.symbol!) : isFold ? () => setExpanded(true) : undefined
                }
              />
              {leaf ? (
                <text x={px(p) + 9} y={py(p) + 4} className="ht-leaf">
                  <tspan className="ht-leaf-symbol">{display(p.node.symbol!)}</tspan>
                  {code !== undefined ? <tspan className="ht-leaf-code" dx={7}>{code}</tspan> : null}
                </text>
              ) : null}
              {isFold ? (
                <text x={px(p) + 9} y={py(p) + 4} className="ht-leaf ht-leaf-fold">
                  +{p.folded} more
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      </div>

      {complete && (fold !== null || expanded) ? (
        <button type="button" className="ht-expand" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Fold the rare symbols' : `Show all ${totalLeaves} symbols`}
        </button>
      ) : null}

      {/* No aria-label. It sat on a bare div with no role, where every screen
          reader drops it — so it named nothing while looking as though it did.
          The visible "queue, N" beside the chips is the label, and it is read
          by everybody. */}
      <div className="ht-queue">
        <span className="label">queue, {queue.length}</span>
        {queue.slice(0, 40).map((node) => (
          <span key={node.id} className="ht-chip data">
            {node.symbol === null ? '·' : display(node.symbol)} {formatWeight(node.weight)}
          </span>
        ))}
        {queue.length > 40 ? <span className="label">…</span> : null}
      </div>

      <div className="ht-controls">
        <button type="button" onClick={() => setStep(0)} disabled={atStep === 0}>
          Reset
        </button>
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={atStep === 0}>
          Back
        </button>
        <button
          type="button"
          onClick={() => setStep((s) => Math.min(trace.merges.length, s + 1))}
          disabled={atStep >= trace.merges.length}
        >
          Merge
        </button>
        <label className="visually-hidden" htmlFor="ht-scrub">
          Merge step
        </label>
        <input
          id="ht-scrub"
          type="range"
          min={0}
          max={trace.merges.length}
          value={atStep}
          onChange={(e) => setStep(Number(e.target.value))}
        />
        <span className="label">
          merge {atStep} of {trace.merges.length}
        </span>
      </div>

      <div className="ht-table table-frame">
      <table>
        <caption className="visually-hidden">
          Every symbol, its smoothed weight and its canonical code
        </caption>
        <thead>
          <tr>
            <th scope="col">Symbol</th>
            <th scope="col">Weight</th>
            <th scope="col">Code</th>
            <th scope="col">Length, bits</th>
          </tr>
        </thead>
        <tbody>
          {codes.slice(0, limit.shown).map((row) => (
            <tr key={row.symbol} aria-current={row.symbol === selected ? 'true' : undefined}>
              <th scope="row">
                <button
                  type="button"
                  className="row-button"
                  aria-pressed={row.symbol === selected}
                  onClick={() => toggle(row.symbol)}
                >
                  {display(row.symbol)}
                </button>
              </th>
              <td>{formatWeight(row.weight)}</td>
              <td className="ht-code">{row.code}</td>
              <td>{row.code.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ShowAll total={codes.length} open={limit.open} onToggle={limit.toggle} noun="symbols" />
      </div>
    </div>
  );
}

function initialQueue(trace: HuffmanTrace): HuffmanNode[] {
  if (trace.merges.length > 0) {
    const first = trace.merges[0];
    return [first.left, first.right, ...first.queue.filter((n) => n.id !== mergedId(trace, 0))];
  }
  return trace.root === null ? [] : [trace.root];
}

function mergedId(trace: HuffmanTrace, step: number): number {
  const { queue, left, right } = trace.merges[step];
  const found = queue.find((n) => n.left?.id === left.id && n.right?.id === right.id);
  return found?.id ?? -1;
}

function collect(node: HuffmanNode, into: Set<number>): void {
  into.add(node.id);
  if (node.left !== null) collect(node.left, into);
  if (node.right !== null) collect(node.right, into);
}

function formatWeight(weight: number): string {
  return weight >= 1000 ? weight.toExponential(2) : String(weight);
}
