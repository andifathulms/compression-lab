/**
 * The staircase. The app's central chart, and the thing every other view
 * supports.
 *
 * It is a staircase because conditional entropy genuinely descends in discrete
 * steps: flat segments with vertical risers, not a smooth curve. Conditional
 * entropy is defined at integer orders, and drawing a curve between them would
 * assert a continuity that does not exist.
 *
 * Every line is labelled with the model it belongs to. There is no unlabelled
 * entropy line here, because the whole point is that entropy is a property of
 * a text *under a model* — and LZ77, which brings no model, routinely lands
 * below the order-0 step, which looks like a paradox only if you believe in a
 * floor.
 */

import { useMemo } from 'react';
import type { CoderResult, Order, TextAnalysis } from '../../engine/index.ts';
import { ORDERS } from '../../engine/index.ts';
import type { CoderChoice } from '../../state/appState.ts';
import './Staircase.css';

interface Props {
  analysis: TextAnalysis;
  order: Order;
  coder: CoderChoice;
  huffman: CoderResult;
  arithmetic: CoderResult;
  lz77: CoderResult;
  onOrder: (order: Order) => void;
}

const WIDTH = 560;
const HEIGHT = 300;
const PAD = { top: 18, right: 116, bottom: 34, left: 46 };

export function Staircase({
  analysis,
  order,
  coder,
  huffman,
  arithmetic,
  lz77,
  onOrder,
}: Props): JSX.Element {
  const rows = analysis.rows;
  const empty = analysis.symbolCount === 0;

  const maxBits = useMemo(() => {
    const values = [
      ...rows.map((r) => r.totalBits),
      ...rows.map((r) => r.entropyBits),
      huffman.bitsPerSymbol,
      arithmetic.bitsPerSymbol,
      lz77.bitsPerSymbol,
    ].filter((v) => Number.isFinite(v));
    return Math.max(1, ...values) * 1.08;
  }, [rows, huffman, arithmetic, lz77]);

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const stepW = plotW / 6;
  const x = (o: number): number => PAD.left + o * stepW;
  const centre = (o: number): number => x(o) + stepW / 2;
  const y = (bits: number): number =>
    PAD.top + plotH - Math.min(1, Math.max(0, bits / maxBits)) * plotH;

  /** Literal steps: a flat segment per order, joined by vertical risers. */
  const stepPath = (pick: (o: Order) => number): string => {
    const parts: string[] = [];
    for (const o of ORDERS) {
      const yy = y(pick(o));
      parts.push(`${o === 0 ? 'M' : 'L'} ${x(o)} ${yy}`, `L ${x(o) + stepW} ${yy}`);
    }
    return parts.join(' ');
  };

  /** Model cost and total are defined at integer orders too, so: points and
   * straight segments between them, at the centre of each step. */
  const linePath = (pick: (o: Order) => number): string =>
    ORDERS.map((o) => `${o === 0 ? 'M' : 'L'} ${centre(o)} ${y(pick(o))}`).join(' ');

  const best = analysis.optimalOrder;
  const ticks = useMemo(() => {
    const step = maxBits > 8 ? 2 : maxBits > 4 ? 1 : 0.5;
    const out: number[] = [];
    for (let v = 0; v <= maxBits; v += step) out.push(v);
    return out;
  }, [maxBits]);

  const points: Array<{ key: string; colour: string; result: CoderResult; label: string }> = [];
  if (coder === 'huffman' || coder === 'compare') {
    points.push({ key: 'huffman', colour: 'var(--huffman)', result: huffman, label: 'Huffman' });
  }
  if (coder === 'arithmetic' || coder === 'compare') {
    points.push({
      key: 'arithmetic',
      colour: 'var(--arithmetic)',
      result: arithmetic,
      label: 'Arithmetic',
    });
  }
  if (coder === 'lz77' || coder === 'compare') {
    points.push({ key: 'lz77', colour: 'var(--lz77)', result: lz77, label: 'LZ77' });
  }

  return (
    <section className="stair panel" aria-label="The staircase">
      <div className="panel-heading">
        <h2>The staircase</h2>
        <span className="label">bits per symbol</span>
      </div>
      <p className="note">
        Conditional entropy falls as the model conditions on more of the previous text, and the
        description of that model grows. The total has a minimum, and where the minimum sits
        depends on how long the text is.
      </p>

      {empty ? (
        <p className="label">Nothing to measure yet.</p>
      ) : (
        <>
          <p className="stair-headline">
            <span className="display">order {best}</span>{' '}
            <span className="unit">
              lowest total for this text, at {rows[best].totalBits.toFixed(2)} bits per symbol
            </span>
          </p>

          <svg
            className="stair-svg"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={`Conditional entropy, model cost and total, orders 0 to 5. Lowest total at order ${best}.`}
          >
            {ticks.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.left}
                  x2={WIDTH - PAD.right}
                  y1={y(v)}
                  y2={y(v)}
                  stroke="var(--rule)"
                  strokeWidth={1}
                />
                <text x={PAD.left - 6} y={y(v) + 4} className="stair-axis" textAnchor="end">
                  {v % 1 === 0 ? v : v.toFixed(1)}
                </text>
              </g>
            ))}

            {/* The order in view. A marker, not a highlight: the slider is a
                continuous control and this follows it on the same frame. */}
            <rect
              x={x(order)}
              y={PAD.top}
              width={stepW}
              height={plotH}
              fill="var(--page-edge)"
            />

            <path d={stepPath((o) => rows[o].entropyBits)} className="stair-entropy" />
            <path d={linePath((o) => rows[o].modelBits)} className="stair-model" />
            <path d={linePath((o) => rows[o].totalBits)} className="stair-total" />

            {ORDERS.map((o) => (
              <circle
                key={`m${o}`}
                cx={centre(o)}
                cy={y(rows[o].modelBits)}
                r={2.5}
                fill="var(--model-cost)"
              />
            ))}
            {ORDERS.map((o) => (
              <circle
                key={`t${o}`}
                cx={centre(o)}
                cy={y(rows[o].totalBits)}
                r={o === best ? 5 : 2.5}
                fill={o === best ? 'var(--ink)' : 'var(--ink-mid)'}
              />
            ))}

            {/* The minimum, annotated. When a longer text moves it right, the
                annotation moves with it, and that movement is the thesis. */}
            <line
              x1={centre(best)}
              x2={centre(best)}
              y1={y(rows[best].totalBits)}
              y2={PAD.top + plotH}
              stroke="var(--ink)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <text
              x={centre(best)}
              y={y(rows[best].totalBits) - 10}
              className="stair-annotation"
              textAnchor="middle"
            >
              lowest total
            </text>

            {points.map((p) => {
              const px = p.result.order === null ? WIDTH - PAD.right : centre(p.result.order);
              const py = y(p.result.bitsPerSymbol);
              return (
                <g key={p.key}>
                  {p.result.order === null ? (
                    <line
                      x1={PAD.left}
                      x2={WIDTH - PAD.right}
                      y1={py}
                      y2={py}
                      stroke={p.colour}
                      strokeWidth={2}
                      strokeDasharray="5 3"
                    />
                  ) : (
                    <circle cx={px} cy={py} r={5} fill={p.colour} />
                  )}
                  <line
                    x1={px}
                    x2={WIDTH - PAD.right + 8}
                    y1={py}
                    y2={py}
                    stroke={p.colour}
                    strokeWidth={0.75}
                  />
                  <text
                    x={WIDTH - PAD.right + 12}
                    y={py + 4}
                    className="stair-key"
                    fill={p.colour}
                  >
                    {p.label} {p.result.bitsPerSymbol.toFixed(2)}
                  </text>
                </g>
              );
            })}

            <text
              x={WIDTH - PAD.right + 12}
              y={y(rows[5].modelBits) + 4}
              className="stair-key"
              fill="var(--model-cost)"
            >
              model
            </text>
            <text
              x={WIDTH - PAD.right + 12}
              y={y(rows[5].totalBits) + 4}
              className="stair-key"
              fill="var(--ink)"
            >
              total
            </text>
            <text
              x={WIDTH - PAD.right + 12}
              y={y(rows[5].entropyBits) + 4}
              className="stair-key"
              fill="var(--ink-mid)"
            >
              H
            </text>

            {ORDERS.map((o) => (
              <text
                key={`x${o}`}
                x={centre(o)}
                y={HEIGHT - 12}
                className={o === order ? 'stair-axis stair-axis-on' : 'stair-axis'}
                textAnchor="middle"
              >
                {o}
              </text>
            ))}
            <text x={centre(2.5)} y={HEIGHT - 1} className="stair-axis" textAnchor="middle">
              model order
            </text>
          </svg>

          <div className="stair-orders" role="group" aria-label="Model order">
            {ORDERS.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={o === order}
                onClick={() => onOrder(o)}
                title={`H${o} — conditional on ${o} previous ${
                  o === 1 ? 'character' : 'characters'
                }`}
              >
                H{o}
              </button>
            ))}
          </div>

          <p className="stair-split data">
            code {bytes(pickResult(coder, huffman, arithmetic, lz77).codeBits)} · model{' '}
            {bytes(pickResult(coder, huffman, arithmetic, lz77).modelBits)} · total{' '}
            {bytes(pickResult(coder, huffman, arithmetic, lz77).totalBits)} · ratio{' '}
            {(
              pickResult(coder, huffman, arithmetic, lz77).totalBits /
              (analysis.byteCount * 8 || 1)
            ).toFixed(3)}{' '}
            of the UTF-8 original
          </p>

          <table className="stair-table">
            <caption className="visually-hidden">
              Conditional entropy, model description and total, by model order
            </caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">H, bits/symbol</th>
                <th scope="col">Contexts</th>
                <th scope="col">Model, bits/symbol</th>
                <th scope="col">Code, bits/symbol</th>
                <th scope="col">Total, bits/symbol</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.order} aria-current={r.order === order ? 'true' : undefined}>
                  <th scope="row">H{r.order}</th>
                  <td>{r.entropyBits.toFixed(3)}</td>
                  <td>{r.contexts.toLocaleString()}</td>
                  <td>{r.modelBits.toFixed(3)}</td>
                  <td>{r.codeBits.toFixed(3)}</td>
                  <td>{r.totalBits.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="assumption">
            H{order} is the entropy of this text conditional on the {order} previous{' '}
            {order === 1 ? 'character' : 'characters'}, measured over this text. The model line is
            the serialised description in bytes, measured, not estimated. The total is that
            description plus the code stream an ideal coder would produce against the same model.
            LZ77 is drawn as a rule across every order because it has no model order: its model is
            the text it has already emitted, and it transmits none of it.
          </p>
        </>
      )}
    </section>
  );
}

function pickResult(
  coder: CoderChoice,
  huffman: CoderResult,
  arithmetic: CoderResult,
  lz77: CoderResult,
): CoderResult {
  if (coder === 'arithmetic') return arithmetic;
  if (coder === 'lz77') return lz77;
  return huffman;
}

function bytes(bits: number): string {
  const b = bits / 8;
  if (b < 1024) return `${b.toFixed(0)} B`;
  return `${(b / 1024).toFixed(2)} kB`;
}
