/**
 * The instrument rail.
 *
 * This replaces the control bar that used to sit pinned to the bottom of the
 * page. Two things were wrong with that. The model order is the app's primary
 * control and it was as far from the staircase it drives as the layout could
 * put it; and the app's own question — what does this text cost — was answered
 * three panels down, in a line of small type, while the top of the page said
 * only the app's name.
 *
 * So the answer and the controls that change it are now the same object, and
 * it is pinned to the top. The reading on the left is the current coder's
 * total. The controls on the right are the three things that move it: which
 * coder, which model order, and whether the model is adaptive. Nothing else is
 * here — the sample chooser and the share action are chrome and live in the
 * masthead, because they are not measurements.
 *
 * The order slider is a continuous control: it maps to the pointer directly,
 * with no easing and no transition, and everything that re-plots from it
 * re-plots on the same frame. The coder is a discrete control and gets a timed
 * transition. That is the house rule and this is where it is most visible.
 */

import { useEffect, useState } from 'react';
import type { CoderResult, Order } from '../engine/index.ts';
import { ORDERS } from '../engine/index.ts';
import type { CoderChoice } from '../state/appState.ts';
import { bytes, ratio, ratioSense } from './format.ts';
import './Rail.css';

const CODERS: Array<{ value: CoderChoice; label: string }> = [
  { value: 'huffman', label: 'Huffman' },
  { value: 'arithmetic', label: 'Arithmetic' },
  { value: 'lz77', label: 'LZ77' },
  { value: 'compare', label: 'Compare' },
];

interface Props {
  order: Order;
  onOrder: (order: Order) => void;
  adaptive: boolean;
  onAdaptive: (adaptive: boolean) => void;
  coder: CoderChoice;
  onCoder: (coder: CoderChoice) => void;
  /** The reading: the coder in view, or the best of the three under compare. */
  result: CoderResult;
  /** What that reading belongs to, named, because compare picks a winner. */
  resultLabel: string;
  /** Why it is that one, when the choice was not the reader's. */
  resultCaveat: string | null;
  originalBytes: number;
  symbolCount: number;
  /** True while the figures behind the reading are being recomputed. */
  stale: boolean;
}

export function Rail({
  order,
  onOrder,
  adaptive,
  onAdaptive,
  coder,
  onCoder,
  result,
  resultLabel,
  resultCaveat,
  originalBytes,
  symbolCount,
  stale,
}: Props): JSX.Element {
  const empty = symbolCount === 0;

  /*
   * The reading, as one sentence, for a screen reader.
   *
   * Everything in the rail is a fragment — a figure, a unit on two lines, three
   * label/value pairs — which reads well and announces badly. And it was not
   * announced at all: switching coder rewrote the headline from 4.55 bits per
   * symbol to 4.42, along with the total and the ratio, in silence. That is the
   * app's primary output changing with no status message (WCAG 4.1.3).
   *
   * The announcement is deferred rather than live-bound, because the model
   * order is a continuous control: bound directly, dragging it would queue one
   * utterance per frame. A short settle means one drag produces one sentence.
   */
  const sentence = empty
    ? 'No text to measure.'
    : `${resultLabel}${resultCaveat === null ? '' : `, ${resultCaveat}`}: ` +
      `${result.bitsPerSymbol.toFixed(2)} bits per symbol, ` +
      `${bytes(result.totalBits)} in total, ` +
      `${ratioSense(result.totalBits, originalBytes)}.`;

  const [announced, setAnnounced] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setAnnounced(sentence), 700);
    return () => window.clearTimeout(id);
  }, [sentence]);

  return (
    <div className={stale ? 'rail rail-stale' : 'rail'}>
      {/* The rail's figures are aria-hidden from this announcement's point of
          view only in the sense that they are not a live region; they stay in
          the reading order for anyone who navigates to them directly. */}
      <p className="visually-hidden" aria-live="polite">
        {announced}
      </p>

      <div className="rail-reading">
        <p className="rail-figure">
          <span className="display">{empty ? '—' : result.bitsPerSymbol.toFixed(2)}</span>
          <span className="rail-unit">
            bits
            <br />
            per symbol
          </span>
        </p>
        <dl className="rail-facts">
          <div>
            <dt>coder</dt>
            <dd data-coder={result.order === null ? 'lz77' : coder}>
              {resultLabel}
              {resultCaveat !== null ? (
                <span className="rail-caveat">{resultCaveat}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>total size</dt>
            <dd>{empty ? '—' : bytes(result.totalBits)}</dd>
          </div>
          <div>
            {/* "of the utf-8 original" is twenty-one characters of tracked
                uppercase, and it was the widest thing in the rail by a
                distance. So the visible label is the short one, and the rest
                of the phrase is read out rather than left on a title
                attribute, which a keyboard and a touchscreen never reach. */}
            <dt title="of the UTF-8 original">
              of original<span className="visually-hidden"> UTF-8 bytes</span>
            </dt>
            <dd>
              {empty ? '—' : ratio(result.totalBits, originalBytes)}
              {empty ? null : (
                <span
                  className="rail-sense"
                  data-over={result.totalBits > originalBytes * 8 ? 'true' : undefined}
                >
                  {ratioSense(result.totalBits, originalBytes)}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rail-controls">
        <div className="rail-control rail-control-coder">
          <span className="label" id="coder-label">
            Coder
          </span>
          <div className="segmented" role="group" aria-labelledby="coder-label">
            {CODERS.map((c) => (
              <button
                key={c.value}
                type="button"
                className="segmented-item"
                data-coder={c.value}
                aria-pressed={coder === c.value}
                onClick={() => onCoder(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* A wrapper that is display:contents everywhere but the narrowest
            screens, where it pairs these two controls into one row. It exists
            for layout only and changes nothing about either control. */}
        <div className="rail-controls-pair">
        <div className="rail-control rail-control-order">
          <label className="label" htmlFor="order">
            Model order
          </label>
          <div className="rail-slider">
            <input
              id="order"
              type="range"
              min={0}
              max={5}
              step={1}
              value={order}
              onChange={(e) => onOrder(Number(e.target.value) as Order)}
              aria-valuetext={`order ${order}, conditioned on ${order} previous ${
                order === 1 ? 'character' : 'characters'
              }`}
            />
            <div className="rail-ticks" aria-hidden="true">
              {ORDERS.map((o) => (
                <span key={o} className={o === order ? 'rail-tick rail-tick-on' : 'rail-tick'}>
                  {o}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="rail-control">
          <span className="label">Model</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={adaptive}
              onChange={(e) => onAdaptive(e.target.checked)}
            />
            <span className="switch-track" aria-hidden="true">
              <span className="switch-grip" />
            </span>
            <span className="switch-text">
              {adaptive ? 'Adaptive' : 'Static'}
              <span className="switch-consequence">
                {adaptive ? 'model costs nothing' : 'model is transmitted'}
              </span>
            </span>
          </label>
        </div>
        </div>
      </div>
    </div>
  );
}
