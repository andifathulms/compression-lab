/**
 * The sliding window.
 *
 * Search buffer behind, look-ahead ahead, and when a match is found it is
 * outlined in both places at once. That simultaneity is the point: the whole
 * idea is that the second occurrence can be replaced by a reference to the
 * first, and seeing only one of the two would not say that.
 *
 * The window and look-ahead sliders are directly beneath, because watching a
 * match fall out of range as the window shrinks is the clearest possible
 * explanation of why window size matters.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Lz77Run, TextAnalysis } from '../../engine/index.ts';
import { LOOKAHEAD_SIZES, WINDOW_SIZES, type Lz77Settings } from '../../state/appState.ts';
import './SlidingWindow.css';

interface Props {
  run: Lz77Run;
  analysis: TextAnalysis;
  settings: Lz77Settings;
  onSettings: (settings: Lz77Settings) => void;
  onRanges: (ranges: {
    lookahead: [number, number] | null;
    match: [number, number] | null;
  }) => void;
}

/** Bytes of context drawn either side of the cursor. */
const SHOWN_BEHIND = 96;
const SHOWN_AHEAD = 48;

export function SlidingWindow({
  run,
  analysis,
  settings,
  onSettings,
  onRanges,
}: Props): JSX.Element {
  const steps = run.trace.steps;
  const [cursor, setCursor] = useState(0);
  const step = steps[Math.min(cursor, steps.length - 1)];

  // The window works in bytes; the text surface highlights characters. The
  // engine's byte-to-symbol map is what keeps a highlight on whole characters.
  useEffect(() => {
    if (step === undefined) {
      onRanges({ lookahead: null, match: null });
      return;
    }
    const toSymbol = (byte: number): number =>
      run.byteToSymbol[Math.min(byte, run.byteToSymbol.length - 1)];
    const length = step.emitted.kind === 'match' ? step.emitted.length : 1;
    const lookahead: [number, number] = [
      toSymbol(step.position),
      toSymbol(step.position + length),
    ];
    const match: [number, number] | null =
      step.match === null
        ? null
        : [
            toSymbol(step.position - step.match.distance),
            toSymbol(step.position - step.match.distance + step.match.length),
          ];
    onRanges({ lookahead, match });
  }, [step, run.byteToSymbol, onRanges]);

  useEffect(() => () => onRanges({ lookahead: null, match: null }), [onRanges]);

  const move = useCallback(
    (delta: number) => setCursor((c) => Math.min(steps.length - 1, Math.max(0, c + delta))),
    [steps.length],
  );

  if (step === undefined) {
    return <p className="label">Nothing to encode yet.</p>;
  }

  const bytes = new TextEncoder().encode(analysis.text);
  const from = Math.max(0, step.position - SHOWN_BEHIND);
  const to = Math.min(bytes.length, step.position + SHOWN_AHEAD);
  const matchFrom = step.match === null ? -1 : step.position - step.match.distance;
  const matchTo = step.match === null ? -1 : matchFrom + step.match.length;
  const emittedLength = step.emitted.kind === 'match' ? step.emitted.length : 1;

  const cells: JSX.Element[] = [];
  for (let i = from; i < to; i++) {
    const classes = ['sw-b'];
    if (i < step.position) {
      classes.push(i >= step.windowStart ? 'sw-search' : 'sw-out');
    } else {
      classes.push(i < step.lookaheadEnd ? 'sw-ahead' : 'sw-out');
    }
    if (i >= matchFrom && i < matchTo) classes.push('sw-source');
    if (i >= step.position && i < step.position + emittedLength) classes.push('sw-target');
    cells.push(
      <span key={i} className={classes.join(' ')}>
        {byteLabel(bytes[i])}
      </span>,
    );
  }

  return (
    <div className="sw">
      <div className="sw-strip" role="img" aria-label={describe(step)}>
        {cells}
      </div>
      <p className="sw-legend label">
        <span className="sw-key sw-key-search" /> search buffer
        <span className="sw-key sw-key-ahead" /> look-ahead
        <span className="sw-key sw-key-match" /> the match, in both places at once
      </p>

      <dl className="sw-token data">
        <div>
          <dt>at byte</dt>
          <dd>{step.position.toLocaleString()}</dd>
        </div>
        <div>
          <dt>emitted</dt>
          <dd>
            {step.emitted.kind === 'literal'
              ? `literal ${byteLabel(step.emitted.byte)}`
              : `match, distance ${step.emitted.distance}, length ${step.emitted.length}`}
          </dd>
        </div>
        <div>
          <dt>cost</dt>
          <dd>{step.costBits} bits</dd>
        </div>
        <div>
          <dt>candidates examined</dt>
          <dd>{step.candidatesExamined}</dd>
        </div>
        {step.match !== null && step.match.distance < step.match.length ? (
          <div>
            <dt>overlapping</dt>
            <dd>
              distance {step.match.distance} is below length {step.match.length}, so the copy
              reads bytes it is writing
            </dd>
          </div>
        ) : null}
        {step.lazySkipped ? (
          <div>
            <dt>lazy</dt>
            <dd>a match was available here, but the next position starts a longer one</dd>
          </div>
        ) : null}
      </dl>

      <div className="sw-controls">
        <button type="button" onClick={() => move(-1)} disabled={cursor === 0}>
          Step back
        </button>
        <button type="button" onClick={() => move(1)} disabled={cursor >= steps.length - 1}>
          Step on
        </button>
        <label className="visually-hidden" htmlFor="sw-scrub">
          Token
        </label>
        <input
          id="sw-scrub"
          type="range"
          min={0}
          max={Math.max(0, steps.length - 1)}
          value={Math.min(cursor, steps.length - 1)}
          onChange={(e) => setCursor(Number(e.target.value))}
        />
        <span className="label">
          token {Math.min(cursor, steps.length - 1) + 1} of {steps.length.toLocaleString()}
        </span>
      </div>

      <div className="sw-sliders">
        <label className="sw-slider">
          <span className="label">Window {settings.windowSize} bytes</span>
          <input
            type="range"
            min={0}
            max={WINDOW_SIZES.length - 1}
            value={WINDOW_SIZES.indexOf(settings.windowSize)}
            onChange={(e) =>
              onSettings({ ...settings, windowSize: WINDOW_SIZES[Number(e.target.value)] })
            }
          />
        </label>
        <label className="sw-slider">
          <span className="label">Look-ahead {settings.lookahead} bytes</span>
          <input
            type="range"
            min={0}
            max={LOOKAHEAD_SIZES.length - 1}
            value={LOOKAHEAD_SIZES.indexOf(settings.lookahead)}
            onChange={(e) =>
              onSettings({ ...settings, lookahead: LOOKAHEAD_SIZES[Number(e.target.value)] })
            }
          />
        </label>
        <label className="bar-check">
          <input
            type="checkbox"
            checked={settings.lazy}
            onChange={(e) => onSettings({ ...settings, lazy: e.target.checked })}
          />
          <span>Lazy matching</span>
        </label>
      </div>

      <div className="sw-table scroll-box">
      <table>
        <caption className="visually-hidden">Every token the encoder emitted</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Byte</th>
            <th scope="col">Token</th>
            <th scope="col">Distance</th>
            <th scope="col">Length</th>
            <th scope="col">Cost, bits</th>
          </tr>
        </thead>
        <tbody>
          {steps.slice(0, 400).map((s, i) => (
            <tr key={s.position} aria-current={i === cursor ? 'true' : undefined}>
              <td>
                <button
                  type="button"
                  className="row-button"
                  aria-pressed={i === cursor}
                  onClick={() => setCursor(i)}
                >
                  {i}
                </button>
              </td>
              <td>{s.position}</td>
              <td>{s.emitted.kind}</td>
              <td>{s.emitted.kind === 'match' ? s.emitted.distance : '·'}</td>
              <td>{s.emitted.kind === 'match' ? s.emitted.length : '·'}</td>
              <td>{s.costBits}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {steps.length > 400 ? (
        <p className="assumption">
          The table lists the first 400 of {steps.length.toLocaleString()} tokens. The scrubber
          reaches all of them.
        </p>
      ) : null}
    </div>
  );
}

/** Bytes, not characters: a multi-byte character shows as its byte values. */
function byteLabel(byte: number): string {
  if (byte === 0x20) return '␣';
  if (byte === 0x0a) return '⏎';
  if (byte === 0x09) return '⇥';
  if (byte < 0x20 || byte > 0x7e) return '·';
  return String.fromCharCode(byte);
}

function describe(step: { position: number; match: { distance: number; length: number } | null }): string {
  if (step.match === null) {
    return `At byte ${step.position}, no match in the window; a literal is emitted.`;
  }
  return `At byte ${step.position}, a match of ${step.match.length} bytes found ${step.match.distance} bytes back.`;
}
