/**
 * The control bar, pinned to the bottom.
 *
 * The model order is the primary control and takes the most space, with the
 * six orders marked. Adaptive sits beside it, because adaptive is the thing
 * that collapses the model cost and a reader should be able to toggle it while
 * watching the staircase.
 *
 * The order slider is a continuous control: it maps to the pointer directly,
 * with no easing and no transition. Everything that re-plots from it re-plots
 * on the same frame.
 */

import type { Order } from '../engine/index.ts';
import { ORDERS } from '../engine/index.ts';
import { SAMPLES } from '../samples/index.ts';
import type { CoderChoice } from '../state/appState.ts';
import './ControlBar.css';

interface Props {
  order: Order;
  onOrder: (order: Order) => void;
  adaptive: boolean;
  onAdaptive: (adaptive: boolean) => void;
  sampleId: string | null;
  onSample: (id: string) => void;
  coder: CoderChoice;
  onCoder: (coder: CoderChoice) => void;
  onCopyLink: (withText: boolean) => void;
  linkStatus: string | null;
}

export function ControlBar({
  order,
  onOrder,
  adaptive,
  onAdaptive,
  sampleId,
  onSample,
  coder,
  onCoder,
  onCopyLink,
  linkStatus,
}: Props): JSX.Element {
  return (
    <div className="bar">
      <div className="bar-order">
        <label className="label" htmlFor="order">
          Model order
        </label>
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
        <div className="bar-ticks" aria-hidden="true">
          {ORDERS.map((o) => (
            <span key={o} className={o === order ? 'bar-tick bar-tick-on' : 'bar-tick'}>
              {o}
            </span>
          ))}
        </div>
      </div>

      <label className="bar-check">
        <input
          type="checkbox"
          checked={adaptive}
          onChange={(e) => onAdaptive(e.target.checked)}
        />
        <span>Adaptive</span>
      </label>

      <div className="bar-coder" role="group" aria-label="Coder">
        {(['huffman', 'arithmetic', 'lz77', 'compare'] as CoderChoice[]).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={coder === c}
            onClick={() => onCoder(c)}
            className={`bar-coder-${c}`}
          >
            {c === 'lz77' ? 'LZ77' : c[0].toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      <div className="bar-right">
        <label className="visually-hidden" htmlFor="sample">
          Sample text
        </label>
        <select
          id="sample"
          value={sampleId ?? ''}
          onChange={(e) => onSample(e.target.value)}
        >
          {sampleId === null ? <option value="">Your text</option> : null}
          {SAMPLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => onCopyLink(false)}>
          Copy link
        </button>
        <button type="button" onClick={() => onCopyLink(true)}>
          Copy link with text
        </button>
        {linkStatus !== null ? (
          <span className="label" role="status">
            {linkStatus}
          </span>
        ) : null}
      </div>
    </div>
  );
}
