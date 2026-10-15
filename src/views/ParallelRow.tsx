/**
 * The parallel corpus, as a comparison row on the staircase.
 *
 * Four texts that say the same thing, measured the same way. It exists to
 * support one specific claim, which the numbers here either bear out or do
 * not: affix-heavy and agglutinative languages carry more substring redundancy
 * than character-level entropy reveals, so LZ77 should beat the order-0
 * prediction by a wider margin on the Indonesian and Finnish texts than on the
 * English one.
 *
 * The margin is the figure that carries the claim, so it is drawn as the mark:
 * a dumbbell from LZ77 to the order-0 entropy, one row per language, with the
 * order-2 step beside it for scale. The table stays under it for anyone who
 * wants the exact values. This is a sample chooser plus a chart, deliberately:
 * any more and it becomes a research apparatus.
 */

import { useEffect, useState } from 'react';
import { analyseText, runLz77, type Lz77Options } from '../engine/index.ts';
import { PARALLEL_SAMPLES } from '../samples/index.ts';
import './ParallelRow.css';

interface Props {
  lz77: Lz77Options;
  currentSampleId: string | null;
  onChoose: (id: string) => void;
}

interface Row {
  id: string;
  language: string;
  symbols: number;
  h0: number;
  h2: number;
  lz: number;
  /** How far LZ77 landed below the order-0 entropy of the same text. */
  margin: number;
}

/**
 * Four full analyses of four nine-thousand-character texts.
 *
 * On the first render that was ninety-five milliseconds of a three-hundred
 * millisecond load — the single most expensive component on the page — for a
 * table that sits seven thousand pixels down and is the last thing anyone
 * reaches.
 *
 * So it is computed when the browser is next idle rather than during the
 * render that puts the app on screen. The arithmetic is identical and the
 * result is the same object; only its timing moved, and it moved to a moment
 * nobody is looking at this panel.
 */
function measure(lz77: Lz77Options): Row[] {
  return PARALLEL_SAMPLES.map((sample) => {
        const analysis = analyseText(sample.text, false);
        const run = runLz77(analysis, lz77);
        const h0 = analysis.rows[0].entropyBits;
        const lz = run.result.bitsPerSymbol;
        return {
          id: sample.id,
          language: sample.language ?? sample.name,
          symbols: analysis.symbolCount,
          h0,
          h2: analysis.rows[2].entropyBits,
          lz,
          // Positive means LZ77 landed below the order-0 entropy of the same
          // text, which is the thing that looks impossible if you believe in a
          // floor.
          margin: h0 - lz,
    };
  });
}

export function ParallelRow({ lz77, currentSampleId, onChoose }: Props): JSX.Element {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = (): void => {
      if (!cancelled) setRows(measure(lz77));
    };
    // requestIdleCallback where it exists; a timeout everywhere else. Either
    // way the work lands after the frame that draws the page.
    const idle = window.requestIdleCallback;
    const id =
      typeof idle === 'function'
        ? idle(run, { timeout: 1000 })
        : window.setTimeout(run, 1);
    return () => {
      cancelled = true;
      if (typeof idle === 'function') window.cancelIdleCallback?.(id as number);
      else window.clearTimeout(id as number);
    };
  }, [lz77]);

  return (
    <section className="panel" aria-labelledby="parallel-heading">
      {/* Named by its heading, like the rest. This one said "The parallel
          corpus" while the heading said "The same text, four languages" — the
          same two-names-for-one-region problem the coder panels had. */}
      <div className="panel-heading">
        <h3 id="parallel-heading">The same text, four languages</h3>
        <span className="label">bits per symbol</span>
      </div>
      <p className="note">
        All thirty articles of the Universal Declaration of Human Rights, in four official
        translations. Character-level entropy and LZ77 measure different kinds of redundancy, and
        the gap between them is not the same in every language.
      </p>
      <Dumbbell rows={rows} currentSampleId={currentSampleId} />
      {/* The only table in the app that was not in a scroll box. Six columns of
          tabular figures do not fit a 320px viewport, so without one the
          document itself scrolled sideways — 417px of content in a 320px
          window, which is WCAG 1.4.10. */}
      <div className="parallel-table scroll-box">
        <table>
          <caption className="visually-hidden">
            Order-0 entropy, order-2 entropy and the LZ77 rate for each translation
          </caption>
          <thead>
            <tr>
              <th scope="col">Language</th>
              <th scope="col">Characters</th>
              <th scope="col">H0</th>
              <th scope="col">H2</th>
              <th scope="col">LZ77 total</th>
              <th scope="col">H0 − LZ77</th>
            </tr>
          </thead>
          <tbody>
            {/* The header and the shape of the table are in the document from
                the first paint, so the outline, browser find and the tab order
                do not depend on when the arithmetic lands. */}
            {rows === null ? (
              <tr>
                <td colSpan={6} className="parallel-pending label">
                  Measuring four translations…
                </td>
              </tr>
            ) : null}
            {(rows ?? []).map((row) => (
              <tr key={row.id} aria-current={row.id === currentSampleId ? 'true' : undefined}>
                <th scope="row">
                  <button
                    type="button"
                    className="row-button"
                    aria-pressed={row.id === currentSampleId}
                    onClick={() => onChoose(row.id)}
                  >
                    {row.language}
                  </button>
                </th>
                <td>{row.symbols.toLocaleString()}</td>
                <td>{row.h0.toFixed(3)}</td>
                <td>{row.h2.toFixed(3)}</td>
                <td>{row.lz.toFixed(3)}</td>
                <td style={{ color: 'var(--lz77)' }}>{row.margin.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="assumption">
        LZ77 has no model description, so its total is its code stream, and a positive margin
        means it landed below the order-0 entropy of the same text — which looks impossible if
        you believe in a single floor. The claim this row was built to test is that affix-heavy
        and agglutinative languages carry more substring redundancy than character-level entropy
        reveals. Indonesian bears it out: its margin is the widest, and its order-0 entropy is the
        lowest. Finnish does not, despite being the most agglutinative of the four — its margin is
        the narrowest. Four texts of nine thousand characters is not enough to settle that, and
        the app is not going to pretend otherwise.
      </p>
    </section>
  );
}

const W = 640;
const ROW = 40;
const PAD = { top: 34, right: 84, bottom: 34, left: 104 };

/**
 * One row per language: order-2 entropy as a hollow mark, then a bar from the
 * LZ77 rate to the order-0 entropy. The length of that bar is the margin, the
 * figure the claim rests on, so it is the thing drawn biggest.
 */
function Dumbbell({
  rows,
  currentSampleId,
}: {
  rows: Row[] | null;
  currentSampleId: string | null;
}): JSX.Element {
  const n = PARALLEL_SAMPLES.length;
  const height = PAD.top + n * ROW + PAD.bottom;
  if (rows === null) {
    return <div className="dumbbell dumbbell-pending" style={{ aspectRatio: `${W} / ${height}` }} />;
  }
  const lo = Math.floor(Math.min(...rows.map((r) => r.h2)) * 2) / 2 - 0.25;
  const hi = Math.ceil(Math.max(...rows.map((r) => r.h0)) * 2) / 2 + 0.25;
  const x = (v: number): number => PAD.left + ((v - lo) / (hi - lo)) * (W - PAD.left - PAD.right);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo * 2) / 2; v <= hi; v += 0.5) ticks.push(v);
  return (
    <div className="dumbbell">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label={`Order-0 entropy against the LZ77 rate for four translations. ${rows
          .map((r) => `${r.language}: LZ77 is ${r.margin.toFixed(3)} bits per symbol below H0`)
          .join('; ')}.`}
      >
        <g className="dumbbell-key">
          <circle cx={PAD.left} cy={14} r={4.5} className="dumbbell-h2" />
          <text x={PAD.left + 10} y={18}>H2</text>
          <circle cx={PAD.left + 70} cy={14} r={5.5} className="dumbbell-lz" />
          <text x={PAD.left + 80} y={18}>LZ77 total</text>
          <circle cx={PAD.left + 182} cy={14} r={5.5} className="dumbbell-h0" />
          <text x={PAD.left + 192} y={18}>H0</text>
        </g>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={PAD.top - 6} y2={height - PAD.bottom} className="dumbbell-grid" />
            <text x={x(v)} y={height - PAD.bottom + 16} className="dumbbell-tick" textAnchor="middle">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cy = PAD.top + i * ROW + ROW / 2;
          const on = r.id === currentSampleId;
          return (
            <g key={r.id} className={on ? 'dumbbell-row dumbbell-row-on' : 'dumbbell-row'}>
              <text x={PAD.left - 14} y={cy + 4} className="dumbbell-name" textAnchor="end">
                {r.language}
              </text>
              <circle cx={x(r.h2)} cy={cy} r={4.5} className="dumbbell-h2" />
              <line x1={x(r.lz)} x2={x(r.h0)} y1={cy} y2={cy} className="dumbbell-bar" />
              <circle cx={x(r.lz)} cy={cy} r={6} className="dumbbell-lz" />
              <circle cx={x(r.h0)} cy={cy} r={6} className="dumbbell-h0" />
              <text x={x(r.h0) + 12} y={cy + 4} className="dumbbell-margin">
                −{r.margin.toFixed(3)}
              </text>
            </g>
          );
        })}
        <text x={(PAD.left + W - PAD.right) / 2} y={height - 4} className="dumbbell-tick" textAnchor="middle">
          bits per symbol
        </text>
      </svg>
    </div>
  );
}
