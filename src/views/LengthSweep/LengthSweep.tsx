/**
 * Where the minimum moves.
 *
 * The staircase says order N is cheapest *for this text at this length*, and
 * the app's whole argument is that the N moves right as the text grows. Until
 * now the only way to change the length was to paste a different text — which
 * changes the text as well, so it demonstrated nothing. This measures the same
 * text at a dozen prefixes and plots where the optimum sits at each.
 *
 * It runs on an explicit action rather than on every keystroke. Twelve
 * analyses of log-spaced prefixes come to roughly three and a half times one
 * full analysis, not twelve times, because most of the prefixes are short —
 * but that is still far too much to put on the typing path, and the app's rule
 * is that continuous controls stay on the pointer. So this is the one control
 * in the interface that is not instant, and it says so on its own button
 * rather than appearing to hang.
 */

import { useState } from 'react';
import type { LengthSweep as Sweep, Order, TextAnalysis } from '../../engine/index.ts';
import { lengthSweep, ORDERS } from '../../engine/index.ts';
import { count } from '../../ui/format.ts';
import './LengthSweep.css';

interface Props {
  analysis: TextAnalysis;
  adaptive: boolean;
  order: Order;
  onOrder: (order: Order) => void;
}

const WIDTH = 620;
const HEIGHT = 240;
const PAD = { top: 18, right: 20, bottom: 46, left: 46 };

export function LengthSweep({ analysis, adaptive, order, onOrder }: Props): JSX.Element {
  const [sweep, setSweep] = useState<Sweep | null>(null);
  const [ranFor, setRanFor] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const key = `${analysis.text.length}:${analysis.symbolCount}:${adaptive}`;
  const stale = sweep !== null && ranFor !== key;
  const tooShort = analysis.symbolCount < 400;

  const run = (): void => {
    setRunning(true);
    // A frame for the button to repaint before the main thread is taken.
    requestAnimationFrame(() => {
      const result = lengthSweep(analysis.text, adaptive);
      setSweep(result);
      setRanFor(key);
      setRunning(false);
    });
  };

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const points = sweep?.points ?? [];
  const minLength = points[0]?.length ?? 1;
  const maxLength = points[points.length - 1]?.length ?? 1;

  // Log scale on length, because the sweep's points are log spaced and a
  // linear axis would pile the first eight of them against the origin.
  const x = (length: number): number => {
    const lo = Math.log(minLength);
    const hi = Math.log(maxLength);
    const t = hi === lo ? 1 : (Math.log(length) - lo) / (hi - lo);
    return PAD.left + t * plotW;
  };
  const y = (o: Order): number => PAD.top + plotH - (o / 5) * plotH;

  /*
   * A step, not a slope.
   *
   * The optimum is a choice between integer orders, and the staircase makes a
   * point of drawing conditional entropy as flat runs with vertical risers
   * because a line between orders would assert a continuity that does not
   * exist. There is no "order 0.6", so the same rule holds here: hold the
   * previous order across to the new length, then rise.
   */
  const walk = points
    .map((p, i) => {
      const px = x(p.length).toFixed(2);
      const py = y(p.optimalOrder).toFixed(2);
      if (i === 0) return `M ${px} ${py}`;
      return `L ${px} ${y(points[i - 1].optimalOrder).toFixed(2)} L ${px} ${py}`;
    })
    .join(' ');

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <section className="sweep panel" aria-labelledby="sweep-heading">
      <div className="panel-heading">
        <h3 id="sweep-heading">Where the minimum moves</h3>
        <span className="label">cheapest order by length</span>
      </div>

      <p className="note">
        The staircase answers this for the text you have. This answers it for the same text at
        a dozen lengths: cut it to the first 200 characters, then 300, then 500, and measure
        where the total bottoms out each time. A short text cannot pay for a big model, so the
        cheapest order climbs as the text grows.
      </p>

      {tooShort ? (
        <p className="sweep-empty label">
          This text is too short to sweep. Below about four hundred characters the model tables
          are mostly contexts seen once, and order 0 wins by default rather than by argument.
        </p>
      ) : (
        <div className="sweep-controls">
          <button type="button" onClick={run} disabled={running}>
            {running ? 'Measuring…' : sweep === null ? 'Run the sweep' : 'Run it again'}
          </button>
          <span className="label" role="status">
            {running
              ? 'Twelve analyses of this text.'
              : stale
                ? 'The text changed. These points are from the old one.'
                : sweep === null
                  ? 'Twelve analyses — about a tenth of a second, so it does not run while you type.'
                  : `${points.length} lengths measured.`}
          </span>
        </div>
      )}

      {points.length > 0 ? (
        <>
          <div className="sweep-plot" data-stale={stale ? 'true' : undefined}>
            <svg
              className="sweep-svg"
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              role="img"
              aria-label={`Cheapest model order against text length. At ${count(
                first.length,
              )} characters the cheapest order is ${first.optimalOrder}; at ${count(
                last.length,
              )} it is ${last.optimalOrder}.`}
            >
              {ORDERS.map((o) => (
                <g key={o}>
                  <line
                    x1={PAD.left}
                    x2={WIDTH - PAD.right}
                    y1={y(o)}
                    y2={y(o)}
                    className={o === order ? 'sweep-grid sweep-grid-on' : 'sweep-grid'}
                  />
                  <text
                    x={PAD.left - 6}
                    y={y(o) + 3.5}
                    className={o === order ? 'sweep-axis sweep-axis-on' : 'sweep-axis'}
                    textAnchor="end"
                  >
                    H{o}
                  </text>
                </g>
              ))}

              <path d={walk} className="sweep-line" />

              {points.map((p) => (
                <circle
                  key={p.length}
                  cx={x(p.length)}
                  cy={y(p.optimalOrder)}
                  r={p.length === last.length ? 5 : 3}
                  className="sweep-dot"
                />
              ))}

              {[first, last].map((p, i) => (
                <text
                  key={p.length}
                  x={x(p.length)}
                  y={HEIGHT - 26}
                  className="sweep-axis"
                  textAnchor={i === 0 ? 'start' : 'end'}
                >
                  {count(p.length)}
                </text>
              ))}
              <text
                x={PAD.left + plotW / 2}
                y={HEIGHT - 8}
                className="sweep-axis"
                textAnchor="middle"
              >
                characters, log scale
              </text>
            </svg>
          </div>

          <p className="sweep-verdict">
            {first.optimalOrder === last.optimalOrder ? (
              <>
                Across every length measured, order{' '}
                <strong>{last.optimalOrder}</strong> stays cheapest. This text does not grow
                enough to buy a bigger model — paste more of it and the step should come.
              </>
            ) : (
              <>
                At {count(first.length)} characters this text is cheapest at order{' '}
                <strong>{first.optimalOrder}</strong>; by {count(last.length)} it is cheapest at
                order <strong>{last.optimalOrder}</strong>. Nothing about the text changed but
                its length.
              </>
            )}
          </p>

          <div className="sweep-table scroll-box">
            <table>
              <caption className="visually-hidden">
                Cheapest model order and its total, at each prefix length measured
              </caption>
              <thead>
                <tr>
                  <th scope="col">Characters</th>
                  <th scope="col">Cheapest</th>
                  <th scope="col">Total, bits/symbol</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.length} aria-current={p.optimalOrder === order ? 'true' : undefined}>
                    <th scope="row">{count(p.length)}</th>
                    <td>
                      <button
                        type="button"
                        className="row-button"
                        aria-pressed={p.optimalOrder === order}
                        onClick={() => onOrder(p.optimalOrder)}
                      >
                        H{p.optimalOrder}
                      </button>
                    </td>
                    <td>{p.bestTotalBits.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Inside the guard, with the measurement it qualifies. Outside it,
              this was the first thing a reader met in the panel: a caveat about
              prefixes, standing next to no prefixes, answering a question
              nobody had asked yet. A caveat only means something beside the
              number it is about. */}
          <p className="assumption">
            These are prefixes of this text, not samples of texts that length. The first tenth
            of a novel is a different register from the whole of it, so what this shows is how
            the optimum moves across <em>this text&apos;s</em> openings — not what any text of
            that length would cost. The sweep uses the model setting selected when it ran
            {sweep?.adaptive === true ? ' (adaptive)' : ' (static)'}.
          </p>
        </>
      ) : null}
    </section>
  );
}
