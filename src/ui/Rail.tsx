/**
 * The readout bar.
 *
 * The answer and the controls that change it are one object, pinned to the
 * top. On the left is the current coder's rate. Next to it the same answer is
 * drawn as a byte bar to scale against the original, so "43% smaller" is
 * visible before it is read. On the right are the model order and whether the
 * model is adaptive. The coder switch sits in the brand row, see CoderSwitch.
 *
 * The rail used to say "coder" twice — once as a fact beside the figure and
 * once as the label of the control — and spread the size across three
 * label/value pairs. The coder now names itself once, under the figure, in its
 * own colour, and the size is one legend over one bar.
 *
 * The model order is six buttons rather than a slider. It only ever takes six
 * values, the staircase already labels them H0 to H5, and a slider made the
 * most important control in the app a fifteen-pixel grip. A choice between
 * six named states is a discrete control, so it gets the timed transition.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { CoderResult, Order } from '../engine/index.ts';
import { ORDERS } from '../engine/index.ts';
import type { CoderChoice } from '../state/appState.ts';
import { bytes, ratio, ratioSense } from './format.ts';
import { ByteBar } from './ByteBar.tsx';
import './Rail.css';

const CODER_COLOUR: Record<string, string> = {
  huffman: 'var(--huffman)',
  arithmetic: 'var(--arithmetic)',
  lz77: 'var(--lz77)',
};

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

  // The coder whose reading this is: under compare, the winner.
  const shownCoder = result.order === null ? 'lz77' : coder === 'compare' ? resultCoder(resultLabel) : coder;
  const original = originalBytes * 8;
  const over = result.totalBits > original;

  /*
   * Arrow keys move the order, the way they would in any radio group. Only
   * the selected button is in the tab order, so the group is one tab stop.
   */
  const orderRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const onOrderKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? -1
          : 0;
    let next: number | null = null;
    if (step !== 0) next = Math.max(0, Math.min(5, order + step));
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = 5;
    if (next === null) return;
    event.preventDefault();
    onOrder(next as Order);
    orderRefs.current[next]?.focus();
  };

  return (
    <div className={stale ? 'rail rail-stale' : 'rail'}>
      {/* The rail's figures are not a live region; this sentence is. They stay
          in the reading order for anyone who navigates to them directly. */}
      <p className="visually-hidden" aria-live="polite">
        {announced}
      </p>

      <div className="rail-reading">
        <p className="rail-figure">
          <span className="display">{empty ? '—' : result.bitsPerSymbol.toFixed(2)}</span>
          <span className="rail-unit">
            bits per symbol
            <span className="rail-coder" data-coder={shownCoder}>
              {resultLabel}
              {resultCaveat !== null ? <span className="rail-caveat">, {resultCaveat}</span> : null}
            </span>
          </span>
        </p>
      </div>

      <div className="rail-size">
        <p className="rail-legend">
          <span>
            Code stream <span className="data">{empty ? '—' : bytes(result.codeBits)}</span>
          </span>
          <span>
            Model <span className="data">{empty ? '—' : bytes(result.modelBits)}</span>
          </span>
          <span>
            Total <span className="data">{empty ? '—' : bytes(result.totalBits)}</span> of{' '}
            <span className="data">{bytes(original)}</span>
            <span className="visually-hidden"> UTF-8 original</span>
          </span>
          {empty ? null : (
            <span className="rail-sense" data-over={over ? 'true' : undefined}>
              <span className="data">{ratio(result.totalBits, originalBytes)}</span>{' '}
              {ratioSense(result.totalBits, originalBytes)}
            </span>
          )}
        </p>
        <ByteBar
          codeBits={empty ? 0 : result.codeBits}
          modelBits={empty ? 0 : result.modelBits}
          originalBits={original}
          colour={CODER_COLOUR[shownCoder] ?? 'var(--ink)'}
          label={`Code stream ${bytes(result.codeBits)} and model description ${bytes(
            result.modelBits,
          )}, drawn against the ${bytes(original)} original.`}
          size="large"
        />
      </div>

      <div className="rail-controls">
        <div className="rail-control rail-control-order">
          <span className="label" id="order-label">
            Model order
          </span>
          <div
            className="segmented segmented-order"
            role="radiogroup"
            id="order"
            aria-labelledby="order-label"
            onKeyDown={onOrderKey}
          >
            {ORDERS.map((o) => (
              <button
                key={o}
                ref={(el) => {
                  orderRefs.current[o] = el;
                }}
                type="button"
                role="radio"
                className="segmented-item"
                aria-checked={o === order}
                tabIndex={o === order ? 0 : -1}
                title={`Order ${o}: conditioned on ${o} previous ${o === 1 ? 'character' : 'characters'}`}
                onClick={() => onOrder(o)}
              >
                H{o}
              </button>
            ))}
          </div>
        </div>

        <div className="rail-control">
          {/*
            * The switch is named "Model" and nothing else. A control whose name
            * changes with its own state is a control a screen-reader user
            * cannot refer to twice (WCAG 4.1.2): the state belongs in checked.
            * The visible words describe the state, so they are the description.
            */}
          <span className="label" id="model-switch-label">
            Model
          </span>
          <label className="switch">
            <input
              type="checkbox"
              checked={adaptive}
              onChange={(e) => onAdaptive(e.target.checked)}
              aria-labelledby="model-switch-label"
              aria-describedby="model-switch-state"
            />
            <span className="switch-track" aria-hidden="true">
              <span className="switch-grip" />
            </span>
            <span className="switch-text" id="model-switch-state">
              {adaptive ? 'Adaptive' : 'Static'}
              <span className="switch-consequence">
                {adaptive ? 'model costs nothing' : 'model is sent'}
              </span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

/**
 * Which coder is in view. It lives in the brand row rather than here: it
 * chooses which instrument the chapters show, and the readout bar needs every
 * pixel of its width for the size drawn to scale.
 */
export function CoderSwitch({
  coder,
  onCoder,
}: {
  coder: CoderChoice;
  onCoder: (coder: CoderChoice) => void;
}): JSX.Element {
  return (
    <div className="coder-switch">
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
            {c.value !== 'compare' ? <span className="coder-dot" aria-hidden="true" /> : null}
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function resultCoder(label: string): string {
  return label === 'Arithmetic' ? 'arithmetic' : label === 'LZ77' ? 'lz77' : 'huffman';
}
