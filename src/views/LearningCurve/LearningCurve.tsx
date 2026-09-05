/**
 * What adaptive costs.
 *
 * This panel exists because the adaptive toggle was breaking the app's own
 * standing commitment. PRD 7.1 says a model that appears free makes higher
 * orders look strictly better, which is false and is the exact misconception
 * the app was built to remove — and flipping to Adaptive did precisely that:
 * the model description collapses to a few dozen bytes and the order-5 total
 * falls off a cliff, with nothing on screen to say what was paid instead.
 *
 * What was paid is ignorance. Both curves here are description-inclusive, so
 * neither side is given anything the other pays for: the static model's whole
 * count table is charged before the first character, and the adaptive model's
 * alphabet is charged before its first character too. The lines start far
 * apart because a static model at order 4 has already spent kilobytes; they
 * converge because the adaptive one is catching up on prediction while paying
 * nothing more.
 *
 * The crossing is the answer, and on a short text there is no crossing — which
 * is the same claim the staircase makes about model order, arriving a second
 * time on a different axis.
 */

import { useDeferredValue, useMemo } from 'react';
import type { LearningSample, Order, TextAnalysis } from '../../engine/index.ts';
import { learningCurve } from '../../engine/index.ts';
import { bytes, count } from '../../ui/format.ts';
import './LearningCurve.css';

interface Props {
  analysis: TextAnalysis;
  order: Order;
  adaptive: boolean;
}

const WIDTH = 620;
const HEIGHT = 260;
const PAD = { top: 16, right: 132, bottom: 34, left: 52 };

/**
 * A crossing this early is not a crossing.
 *
 * At a high order the static model has spent kilobytes before the first
 * character, so the adaptive model leads from the opening and never gives the
 * lead up. The measurement reports character 1, which is true and reads as
 * "adaptive won a race" when what happened is that the race was over before it
 * started. That is a different fact and gets a different sentence.
 */
const EARLY = 2;

export function LearningCurve({ analysis, order, adaptive }: Props): JSX.Element | null {
  // The curve is a second pair of model walks over the whole text, so it is
  // the most expensive thing on the page that is not a coder. Deferring the
  // order keeps a slider drag on the pointer: the staircase re-plots on the
  // frame and this catches up.
  const deferredOrder = useDeferredValue(order);

  const curve = useMemo(() => {
    if (analysis.symbolCount < 2) return null;
    return learningCurve(analysis.index, deferredOrder);
  }, [analysis.index, analysis.symbolCount, deferredOrder]);

  if (curve === null) return null;

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const n = analysis.symbolCount;

  /*
   * Log scale, and it has to be.
   *
   * These are running averages: total spent so far over characters so far. At
   * character 1 a static order-1 model has already spent its whole 1.28 kB
   * description, so its rate there is ten thousand bits per symbol. On a
   * linear axis that one point sets the scale and the entire rest of the plot
   * — the part anyone came to see — collapses onto the floor.
   *
   * The spike is real and worth showing: it is what "paid up front" looks
   * like. So the axis is logarithmic, ticked at decades, and labelled as such.
   */
  const maxRate = Math.max(curve.samples[0]?.staticRate ?? 8, 10);
  const minRate = Math.max(0.05, Math.min(curve.staticRate, curve.adaptiveRate) * 0.6);
  const logMax = Math.log10(maxRate);
  const logMin = Math.log10(minRate);

  const x = (position: number): number => PAD.left + (position / (n || 1)) * plotW;
  const y = (rate: number): number => {
    const t = (Math.log10(Math.max(rate, minRate)) - logMin) / (logMax - logMin || 1);
    return PAD.top + plotH - Math.min(1, Math.max(0, t)) * plotH;
  };

  // Decades inside the range, so every label names a value the plot reaches.
  const rateTicks: number[] = [];
  for (let e = Math.floor(logMin); e <= Math.ceil(logMax); e++) {
    const value = 10 ** e;
    if (value >= minRate && value <= maxRate) rateTicks.push(value);
  }

  /* Two keys at nearly the same rate overprint each other. When the final
   * rates are within a line of one another, the pair is nudged apart. */
  const staticY = y(curve.staticRate);
  const adaptiveY = y(curve.adaptiveRate);
  const apart = Math.abs(staticY - adaptiveY) < 11;
  const staticKeyY = apart ? Math.min(staticY, adaptiveY) - 1 : staticY;
  const adaptiveKeyY = apart ? Math.max(staticY, adaptiveY) + 11 : adaptiveY;

  const path = (pick: (s: LearningSample) => number): string =>
    curve.samples
      .map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(s.position).toFixed(2)} ${y(pick(s)).toFixed(2)}`)
      .join(' ');

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(n * f));

  return (
    <section className="learn panel" aria-labelledby="learn-heading">
      <div className="panel-heading">
        <h2 id="learn-heading">What adaptive costs</h2>
        <span className="label">bits per symbol, running</span>
      </div>

      <p className="note">
        An adaptive model sends no counts, so its description is nearly free — but it starts
        knowing nothing, and pays for that in the code stream while it learns. A static model
        pays everything up front and then predicts well from the first character. Both lines
        below carry their own description, so neither is being given something the other
        pays for.
      </p>

      <div className="learn-plot">
        <svg
          className="learn-svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Running cost per symbol at order ${curve.order}. Static ends at ${curve.staticRate.toFixed(
            2,
          )} bits per symbol, adaptive at ${curve.adaptiveRate.toFixed(2)}. ${
            curve.crossing === null
              ? 'Adaptive does not overtake static within this text.'
              : `Adaptive overtakes static at character ${curve.crossing}.`
          }`}
        >
          {rateTicks.map((value) => (
            <g key={value}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(value)}
                y2={y(value)}
                className="learn-grid"
              />
              <text x={PAD.left - 6} y={y(value) + 3.5} className="learn-axis" textAnchor="end">
                {value >= 1 ? value.toLocaleString('en-GB') : value}
              </text>
            </g>
          ))}

          {/* The crossing, marked where it happens rather than described in a
              caption the reader has to map back onto the plot. */}
          {curve.crossing !== null && curve.crossing > EARLY ? (
            <g>
              <line
                x1={x(curve.crossing)}
                x2={x(curve.crossing)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                className="learn-cross"
              />
              <text
                x={x(curve.crossing) + 5}
                y={PAD.top + 10}
                className="learn-cross-label"
              >
                adaptive ahead from here
              </text>
            </g>
          ) : null}

          <path d={path((s) => s.staticRate)} className="learn-static" />
          <path d={path((s) => s.adaptiveRate)} className="learn-adaptive" />

          <text
            x={WIDTH - PAD.right + 8}
            y={staticKeyY + 3.5}
            className="learn-key learn-key-static"
          >
            static {curve.staticRate.toFixed(2)}
          </text>
          <text
            x={WIDTH - PAD.right + 8}
            y={adaptiveKeyY + 3.5}
            className="learn-key learn-key-adaptive"
          >
            adaptive {curve.adaptiveRate.toFixed(2)}
          </text>

          {ticks.map((t) => (
            <text key={t} x={x(t)} y={HEIGHT - 12} className="learn-axis" textAnchor="middle">
              {count(t)}
            </text>
          ))}
          <text x={PAD.left + plotW / 2} y={HEIGHT - 1} className="learn-axis" textAnchor="middle">
            characters coded · rate on a log scale
          </text>
        </svg>
      </div>

      <p className="learn-verdict">
        {curve.crossing === null ? (
          <>
            At order {curve.order} the adaptive model{' '}
            <strong>never catches up within this text</strong>. It is still paying off what it
            did not know at the start when the text runs out, which is the same reason a short
            text cannot afford a big model.
          </>
        ) : curve.crossing <= EARLY ? (
          <>
            At order {curve.order} the adaptive model is{' '}
            <strong>cheaper at every length</strong>. The static model spends{' '}
            {bytes(curve.staticModelBits)} before it codes a single character, and on this text
            it never earns that back — so there is no crossing to wait for.
          </>
        ) : (
          <>
            At order {curve.order} the adaptive model{' '}
            <strong>overtakes at character {count(curve.crossing)}</strong>, which is{' '}
            {((curve.crossing / n) * 100).toFixed(0)}% of the way through this text, and stays
            ahead to the end. Before that it is still paying for what it did not know.
          </>
        )}
      </p>

      <dl className="learn-figures">
        <div>
          <dt>learned the hard way</dt>
          <dd>{bytes(curve.learningBits)}</dd>
        </div>
        <div>
          <dt>static description</dt>
          <dd>{bytes(curve.staticModelBits)}</dd>
        </div>
        <div>
          <dt>adaptive description</dt>
          <dd>{bytes(curve.adaptiveModelBits)}</dd>
        </div>
        <div>
          <dt>currently shown</dt>
          <dd>{adaptive ? 'adaptive' : 'static'}</dd>
        </div>
      </dl>

      <p className="assumption">
        “Learned the hard way” is the extra code the adaptive model spent relative to one that
        was handed the finished distribution — the price of transmitting nothing. Both
        descriptions are measured by serialising the model, not estimated. The adaptive
        description is not zero because the alphabet and the symbol count really are sent.
      </p>
    </section>
  );
}
