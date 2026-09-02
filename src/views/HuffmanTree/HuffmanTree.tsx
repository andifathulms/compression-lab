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
 */

import { useCallback, useMemo, useState } from 'react';
import type { HuffmanNode, HuffmanTrace } from '../../engine/index.ts';
import { display } from '../BitLedger/BitLedger.tsx';
import './HuffmanTree.css';

interface Props {
  trace: HuffmanTrace;
  selected: string | null;
  onSelect: (symbol: string | null) => void;
}

const WIDTH = 560;
const LEVEL = 34;

interface Placed {
  node: HuffmanNode;
  x: number;
  y: number;
  parent: Placed | null;
  bit: '0' | '1' | null;
}

/** Leaves in visiting order, internal nodes above the midpoint of their children. */
function layout(root: HuffmanNode | null): { placed: Placed[]; depth: number } {
  if (root === null) return { placed: [], depth: 0 };
  const placed: Placed[] = [];
  let leafIndex = 0;
  let depth = 0;

  const walk = (node: HuffmanNode, level: number, parent: Placed | null, bit: '0' | '1' | null): Placed => {
    depth = Math.max(depth, level);
    if (node.left === null || node.right === null) {
      const entry: Placed = { node, x: leafIndex++, y: level, parent, bit };
      placed.push(entry);
      return entry;
    }
    const entry: Placed = { node, x: 0, y: level, parent, bit };
    placed.push(entry);
    const left = walk(node.left, level + 1, entry, '0');
    const right = walk(node.right, level + 1, entry, '1');
    entry.x = (left.x + right.x) / 2;
    return entry;
  };

  walk(root, 0, null, null);
  return { placed, depth };
}

export function HuffmanTree({ trace, selected, onSelect }: Props): JSX.Element {
  const [step, setStep] = useState(trace.merges.length);
  const { placed, depth } = useMemo(() => layout(trace.root), [trace.root]);

  const leaves = placed.filter((p) => p.node.symbol !== null).length;
  const height = (depth + 1) * LEVEL + 20;
  const spacing = leaves > 1 ? (WIDTH - 40) / (leaves - 1) : 0;
  const px = (p: Placed): number => 20 + p.x * spacing;
  const py = (p: Placed): number => 16 + p.y * LEVEL;

  const atStep = Math.min(step, trace.merges.length);
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

  const toggle = useCallback(
    (symbol: string) => onSelect(selected === symbol ? null : symbol),
    [onSelect, selected],
  );

  if (trace.root === null) {
    return <p className="label">No tree: the text has no symbols.</p>;
  }

  return (
    <div className="ht">
      <svg
        className="ht-svg"
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label={`Huffman tree over ${leaves} symbols, ${trace.merges.length} merges.`}
      >
        {placed.map((p) => {
          if (p.parent === null) return null;
          if (visible !== null && !visible.has(p.node.id)) return null;
          return (
            <g key={`e${p.node.id}`}>
              <line
                x1={px(p.parent)}
                y1={py(p.parent) + 5}
                x2={px(p)}
                y2={py(p) - 5}
                className="ht-edge"
              />
              <text
                x={(px(p.parent) + px(p)) / 2 + (p.bit === '0' ? -6 : 6)}
                y={(py(p.parent) + py(p)) / 2}
                className="ht-bit"
              >
                {p.bit}
              </text>
            </g>
          );
        })}
        {placed.map((p) => {
          if (visible !== null && !visible.has(p.node.id)) return null;
          const isLeaf = p.node.symbol !== null;
          const isSelected = isLeaf && p.node.symbol === selected;
          const inMerge =
            merge !== null && (merge.left.id === p.node.id || merge.right.id === p.node.id);
          return (
            <g key={`n${p.node.id}`}>
              <circle
                cx={px(p)}
                cy={py(p)}
                r={isLeaf ? 5 : 3}
                className={
                  isSelected ? 'ht-node ht-node-on' : inMerge ? 'ht-node ht-node-merge' : 'ht-node'
                }
                onClick={isLeaf ? () => toggle(p.node.symbol!) : undefined}
                onKeyDown={
                  isLeaf
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggle(p.node.symbol!);
                        }
                      }
                    : undefined
                }
                tabIndex={isLeaf ? 0 : undefined}
                role={isLeaf ? 'button' : undefined}
                aria-pressed={isLeaf ? isSelected : undefined}
                aria-label={
                  isLeaf
                    ? `${display(p.node.symbol!)}, code ${trace.codes.get(p.node.symbol!) ?? ''}`
                    : undefined
                }
              />
              {isLeaf ? (
                <text x={px(p)} y={py(p) + 16} className="ht-leaf" textAnchor="middle">
                  {display(p.node.symbol!)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <div className="ht-queue" aria-label="The priority queue">
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

      <div className="ht-table scroll-box">
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
          {codes.map((row) => (
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
