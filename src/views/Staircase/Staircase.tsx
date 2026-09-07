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

import { useMemo, useState } from 'react';
import type { CoderResult, Order, TextAnalysis } from '../../engine/index.ts';
import { ORDERS } from '../../engine/index.ts';
import type { CoderChoice } from '../../state/appState.ts';
import { bytes, ratio } from '../../ui/format.ts';
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

const WIDTH = 620;
const HEIGHT = 320;
const PAD = { top: 20, right: 128, bottom: 38, left: 50 };

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

  /**
   * What the vertical axis is scaled to.
   *
   * A static order-5 model on a short text costs upwards of fifty bits per
   * symbol, and against that the entropy steps — which are the thing this
   * chart is named after — descend across two pixels at the bottom of the
   * plot. So the axis has two settings and the reader picks.
   *
   * "Everything" fits the tallest series and is the default, because it is the
   * honest picture and the model line running away is the lesson. "The
   * steps" fits the entropy and the coders, and lets the model and total lines
   * run off the top — which the interface says out loud, because a line that
   * leaves the plot without saying so is a lie about where it went.
   */
  const [fit, setFit] = useState<'all' | 'steps'>('all');

  const coderRates = [huffman.bitsPerSymbol, arithmetic.bitsPerSymbol, lz77.bitsPerSymbol];

  const maxBits = useMemo(() => {
    const values = (
      fit === 'all'
        ? [...rows.map((r) => r.totalBits), ...rows.map((r) => r.entropyBits), ...coderRates]
        : [...rows.map((r) => r.entropyBits), ...coderRates]
    ).filter((v) => Number.isFinite(v));
    return Math.max(1, ...values) * 1.08;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, fit, huffman, arithmetic, lz77]);

  /* The original's own rate, for the reference line. */
  const originalRate =
    analysis.symbolCount > 0 ? (analysis.byteCount * 8) / analysis.symbolCount : NaN;

  const clipped =
    fit === 'steps' && ORDERS.some((o) => rows[o].totalBits > maxBits);

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
  const current = pickResult(coder, huffman, arithmetic, lz77);
  /**
   * Ticks at a round interval, about six of them.
   *
   * A static order-5 model on a short text costs upwards of fifty bits per
   * symbol, and a fixed interval that suits a scale of eight draws thirty
   * labels on top of each other at a scale of fifty. So the interval is chosen
   * from the range: the first of 1, 2 or 5 times a power of ten that gets the
   * count down to six.
   */
  const ticks = useMemo(() => {
    const rough = maxBits / 6;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const step =
      [1, 2, 5, 10].find((m) => m * magnitude >= rough) !== undefined
        ? [1, 2, 5, 10].find((m) => m * magnitude >= rough)! * magnitude
        : magnitude;
    const out: number[] = [];
    for (let v = 0; v <= maxBits; v += step) out.push(Number(v.toFixed(6)));
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

  /**
   * The right-hand key.
   *
   * Each entry wants to sit at the height of the thing it names, and several of
   * them want the same height — the model and the total both pin to the top of
   * the plot when the axis is fitted to the steps, and a coder's rate lands on
   * a series as often as not. So the wanted heights are collected, then pushed
   * apart to a minimum gap, and a leader is drawn from where the label wanted
   * to be to where it ended up.
   */
  const keys = useMemo(() => {
    const wanted: Array<{ id: string; label: string; colour: string; at: number; from: number }> =
      [
        {
          id: 'H',
          label: 'H',
          colour: 'var(--ink-mid)',
          at: y(rows[5].entropyBits),
          from: WIDTH - PAD.right,
        },
        {
          id: 'model',
          label: 'model',
          colour: 'var(--model-cost)',
          at: y(rows[5].modelBits),
          from: centre(5),
        },
        {
          id: 'total',
          label: 'total',
          colour: 'var(--ink)',
          at: y(rows[5].totalBits),
          from: centre(5),
        },
        ...points.map((p) => ({
          id: p.key,
          label: `${p.label} ${p.result.bitsPerSymbol.toFixed(2)}`,
          colour: p.colour,
          at: y(p.result.bitsPerSymbol),
          from: p.result.order === null ? WIDTH - PAD.right : centre(p.result.order),
        })),
      ];

    const GAP = 12;
    const sorted = [...wanted].sort((a, b) => a.at - b.at);
    const placed = sorted.map((k) => ({ ...k, y: k.at }));
    // Down the list, then back up, so a run pinned to the top spreads
    // downward and a run pinned to the bottom spreads upward.
    for (let i = 1; i < placed.length; i++) {
      placed[i].y = Math.max(placed[i].y, placed[i - 1].y + GAP);
    }
    const floor = PAD.top + plotH;
    for (let i = placed.length - 1; i >= 0; i--) {
      if (placed[i].y > floor) placed[i].y = floor;
      if (i > 0 && placed[i - 1].y > placed[i].y - GAP) placed[i - 1].y = placed[i].y - GAP;
    }
    return placed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, maxBits, coder, huffman, arithmetic, lz77, plotH]);

  return (
    <section className="stair panel" aria-label="The staircase">
      <div className="panel-heading">
        <h3>The staircase</h3>
        <span className="label">bits per symbol</span>
      </div>
      {/* The app's thesis, at the one place on the page that demonstrates it.
          It used to sit in the masthead, where it arrived before the reader
          had anything to test it against. */}
      <p className="note">
        <strong>Entropy is not a property of a text. It is a property of a text under a
        model.</strong>{' '}
        A longer context predicts the next character better, so the code gets cheaper — but
        the model itself has to be sent, and it grows much faster. The two together have a
        minimum, and that is the cheapest this text can honestly be made.
      </p>

      {empty ? (
        <p className="label">Nothing to measure yet.</p>
      ) : (
        <>
          <p className="stair-headline">
            <span className="display">order {best}</span>
            <span className="unit">
              lowest total for this text, at {rows[best].totalBits.toFixed(2)} bits per symbol
            </span>
          </p>

          <div className="stair-plot">
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
                  {v % 1 === 0 ? v : v.toFixed(v < 1 ? 2 : 1)}
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
              className="stair-band"
            />

            {/* The chart is the control. Clicking a column picks that order,
                which is the gesture a reader tries first; the H0 to H5 buttons
                below are the same thing on the keyboard path. */}
            {ORDERS.map((o) => (
              <rect
                key={`hit${o}`}
                x={x(o)}
                y={PAD.top}
                width={stepW}
                height={plotH}
                className="stair-hit"
                onClick={() => onOrder(o)}
              >
                <title>{`Order ${o}: ${rows[o].totalBits.toFixed(3)} bits per symbol in total`}</title>
              </rect>
            ))}

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

            {/*
              * What the text costs uncompressed, in the same units as
              * everything else on the plot.
              *
              * Without it the reader has to hold "8 bits per character" in
              * their head to know which orders actually compress. With it,
              * "below the line is smaller than what you started with" is the
              * first thing the eye can do with the chart, and the order-5
              * total being five times above it stops being an abstract number.
              */}
            {Number.isFinite(originalRate) && originalRate <= maxBits ? (
              <g>
                <line
                  x1={PAD.left}
                  x2={WIDTH - PAD.right}
                  y1={y(originalRate)}
                  y2={y(originalRate)}
                  className="stair-original"
                />
                {/* Right-aligned at the end of its own rule. Anchored left it
                    sat on top of the "lowest total" annotation, which lands
                    near the middle whenever the minimum is at a low order —
                    which is most of the time. */}
                <text
                  x={WIDTH - PAD.right - 4}
                  y={y(originalRate) - 4}
                  className="stair-original-label"
                  textAnchor="end"
                >
                  uncompressed, {originalRate.toFixed(1)}
                </text>
              </g>
            ) : null}

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
              lowest total {rows[best].totalBits.toFixed(2)}
            </text>

            {points.map((p) => (
              <g key={p.key}>
                {p.result.order === null ? (
                  <line
                    x1={PAD.left}
                    x2={WIDTH - PAD.right}
                    y1={y(p.result.bitsPerSymbol)}
                    y2={y(p.result.bitsPerSymbol)}
                    stroke={p.colour}
                    strokeWidth={2}
                    strokeDasharray="5 3"
                  />
                ) : (
                  <circle
                    cx={centre(p.result.order)}
                    cy={y(p.result.bitsPerSymbol)}
                    r={5}
                    fill={p.colour}
                    className="stair-point"
                  />
                )}
              </g>
            ))}

            {/* The key, laid out so nothing overlaps. Two series that land on
                the same value — which they do the moment the axis is fitted to
                the steps and both run off the top — would otherwise print one
                label on top of another. */}
            {keys.map((k) => (
              <g key={k.id}>
                <line
                  x1={k.from}
                  x2={WIDTH - PAD.right + 8}
                  y1={k.at}
                  y2={k.y}
                  stroke={k.colour}
                  strokeWidth={0.75}
                  opacity={0.6}
                />
                <text
                  x={WIDTH - PAD.right + 12}
                  y={k.y + 3.5}
                  className="stair-key"
                  fill={k.colour}
                >
                  {k.label}
                </text>
              </g>
            ))}

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
          </div>

          <div className="stair-tools">
          <div className="stair-orders segmented" role="group" aria-label="Model order">
            {ORDERS.map((o) => (
              <button
                key={o}
                type="button"
                className="segmented-item"
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

          <div className="segmented" role="group" aria-label="Vertical axis">
            <button
              type="button"
              className="segmented-item"
              aria-pressed={fit === 'all'}
              onClick={() => setFit('all')}
              title="Fit the tallest series, including the model description"
            >
              Everything
            </button>
            <button
              type="button"
              className="segmented-item"
              aria-pressed={fit === 'steps'}
              onClick={() => setFit('steps')}
              title="Fit the entropy steps and the coder rates"
            >
              The steps
            </button>
          </div>
          </div>

          {clipped ? (
            <p className="assumption">
              The axis is fitted to the entropy steps, so the model and total lines run off the
              top of the plot rather than being drawn. At order 5 the total is{' '}
              {rows[5].totalBits.toFixed(1)} bits per symbol.
            </p>
          ) : null}

          <dl className="stair-split">
            <div>
              <dt>code stream</dt>
              <dd>{bytes(current.codeBits)}</dd>
            </div>
            <div>
              <dt>model description</dt>
              <dd>{bytes(current.modelBits)}</dd>
            </div>
            <div>
              <dt>total</dt>
              <dd>{bytes(current.totalBits)}</dd>
            </div>
            <div>
              <dt>of original</dt>
              <dd>{ratio(current.totalBits, analysis.byteCount)}</dd>
            </div>
          </dl>

          <div className="stair-table scroll-box">
          <table>
            <caption className="visually-hidden">
              Conditional entropy, model description, code stream and total, by
              model order. Every column but the context count is in bits per symbol.
            </caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">H</th>
                <th scope="col">Contexts</th>
                <th scope="col">Model</th>
                <th scope="col">Code</th>
                <th scope="col">Total</th>
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
          </div>

          {/*
            * H and the code stream are two numbers for what a newcomer reads as
            * one idea, and the difference between them used to be a
            * subordinate clause at the foot of the column, thousands of pixels
            * from either line. It is the difference between the floor and the
            * bill, which is close to this app's whole subject.
            */}
          <div className="stair-two">
            <h4 className="stair-two-heading">Why H and the code stream are not the same number</h4>
            <dl className="stair-two-pair">
              <div>
                <dt>H{order}, {rows[order].entropyBits.toFixed(3)} bits/symbol</dt>
                <dd>
                  What the counts say this text is worth, measured on the counts themselves.
                  It assumes the next character will behave exactly like the ones already
                  seen, so it holds nothing back for a symbol that has not turned up yet.
                  It is a floor, not a bill.
                </dd>
              </div>
              <div>
                <dt>code stream, {rows[order].codeBits.toFixed(3)} bits/symbol</dt>
                <dd>
                  What an ideal coder actually pays against a model it could hand to a
                  decoder. That model is smoothed, so it reserves a little probability for
                  every symbol that has not followed this context — and probability spent on
                  what did not happen is paid for by what did.
                </dd>
              </div>
            </dl>
            <p className="stair-two-gap">
              The gap is{' '}
              <strong>
                {(rows[order].codeBits - rows[order].entropyBits).toFixed(3)} bits per symbol
              </strong>{' '}
              at this order: the price of not knowing the future. It is why a coder never
              quite reaches its step, and why the two lines converge as the text gets longer
              and the counts stop being guesses.
            </p>
          </div>

          <p className="assumption">
            H{order} is the entropy of this text conditional on the {order} previous{' '}
            {order === 1 ? 'character' : 'characters'}, measured over this text with unsmoothed
            counts. The model line is the serialised description in bytes, measured, not
            estimated. The total is that description plus the code stream an ideal coder would
            produce against the same model. LZ77 is drawn as a rule across every order because
            it has no model order: its model is the text it has already emitted, and it
            transmits none of it.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * The result the split under the plot belongs to. Under compare there is no
 * coder in view, so it is the lowest of the three — the same rule the rail
 * uses, because two readings of the same text disagreeing on the same screen
 * would be worse than either of them being arbitrary.
 */
function pickResult(
  coder: CoderChoice,
  huffman: CoderResult,
  arithmetic: CoderResult,
  lz77: CoderResult,
): CoderResult {
  if (coder === 'arithmetic') return arithmetic;
  if (coder === 'lz77') return lz77;
  if (coder === 'compare') {
    return [huffman, arithmetic, lz77].reduce((a, b) =>
      b.bitsPerSymbol < a.bitsPerSymbol ? b : a,
    );
  }
  return huffman;
}
