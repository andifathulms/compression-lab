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

import type { CoderResult, Order } from '../engine/index.ts';
import { ORDERS } from '../engine/index.ts';
import type { CoderChoice } from '../state/appState.ts';
import { bytes, ratio } from './format.ts';
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

  return (
    <div className={stale ? 'rail rail-stale' : 'rail'}>
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
                distance. The full phrase is on the title. */}
            <dt title="of the UTF-8 original">of original</dt>
            <dd>{empty ? '—' : ratio(result.totalBits, originalBytes)}</dd>
          </div>
        </dl>
      </div>

      <div className="rail-controls">
        <div className="rail-control">
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
  );
}
