/**
 * The interval. The app's one orchestrated moment.
 *
 * The [0,1) interval, subdivided by symbol probability. Each coded symbol
 * selects a band and the view zooms so that band fills the frame. The bar
 * never appears to shrink; the world expands around it. Precision being
 * consumed becomes something you watch rather than something you are told
 * about.
 *
 * Honesty requirement, PRD 7.3. What is drawn is the idealised real-number
 * interval. What the engine does is an integer range coder with
 * renormalization and underflow handling. The two are different, the interface
 * says so at the point of viewing, and the renormalization track beneath is
 * the bridge — both are read from the same trace record, so neither can drift
 * from the other.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArithmeticStep, TextAnalysis } from '../../engine/index.ts';
import { PRECISION } from '../../engine/index.ts';
import { display } from '../BitLedger/BitLedger.tsx';
import './Interval.css';

interface Props {
  steps: ArithmeticStep[];
  analysis: TextAnalysis;
  cursor: number;
  onCursor: (index: number) => void;
}

const HEIGHT = 320;
const WIDTH = 240;
/** Bands narrower than this cannot carry a legible label. */
const LABEL_MIN_PX = 11;

export function Interval({ steps, analysis, cursor, onCursor }: Props): JSX.Element {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  /** 0 to 1 through the zoom into `cursor`. */
  const [phase, setPhase] = useState(1);
  const raf = useRef<number | null>(null);
  const startedAt = useRef(0);

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  const step = steps[cursor];

  // One rAF loop. The zoom is the only autonomous animation in the app and it
  // is user-started; nothing else here moves unprompted.
  useEffect(() => {
    if (reduced) {
      setPhase(1);
      return;
    }
    startedAt.current = performance.now();
    setPhase(0);
    const duration = 420 / speed;
    const tick = (now: number): void => {
      const t = Math.min(1, (now - startedAt.current) / duration);
      setPhase(t);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else raf.current = null;
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [cursor, speed, reduced]);

  useEffect(() => {
    if (!playing) return;
    // The default speed is slow enough to read the band labels, because the
    // labels are what make this comprehensible rather than merely pretty.
    const id = window.setTimeout(
      () => {
        if (cursor + 1 >= steps.length) setPlaying(false);
        else onCursor(cursor + 1);
      },
      reduced ? 700 : 460 / speed,
    );
    return () => window.clearTimeout(id);
  }, [playing, cursor, steps.length, onCursor, speed, reduced]);

  const move = useCallback(
    (delta: number) => {
      setPlaying(false);
      onCursor(Math.min(steps.length - 1, Math.max(0, cursor + delta)));
    },
    [cursor, onCursor, steps.length],
  );

  if (step === undefined) {
    return <p className="label">Nothing coded yet.</p>;
  }

  // The bands of the current context, and where the chosen one sits. `phase`
  // eases the zoom: at 0 the whole interval is shown, at 1 the chosen band
  // fills the frame.
  const eased = ease(phase);
  const low = step.idealLow * eased;
  const high = 1 - (1 - step.idealHigh) * eased;
  const span = high - low;
  const toY = (v: number): number => ((v - low) / span) * HEIGHT;

  const bands = bandsFor(step, analysis.alphabet);

  const width = Number(step.highAfter - step.lowAfter + 1n);
  const widthFraction = width / Number(1n << PRECISION);

  return (
    <div className="interval">
      <div className="interval-body">
        <svg
          className="interval-svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Symbol ${cursor + 1} of ${steps.length}: ${display(
            step.symbol,
          )}, probability ${step.probability.toFixed(4)}, costing ${step.costBits.toFixed(
            2,
          )} bits.`}
        >
          <clipPath id="interval-clip">
            <rect x={0} y={0} width={WIDTH} height={HEIGHT} />
          </clipPath>
          <g clipPath="url(#interval-clip)">
            {bands.map((band) => {
              const y0 = toY(band.low);
              const y1 = toY(band.high);
              if (y1 < -40 || y0 > HEIGHT + 40) return null;
              const chosen = band.symbol === step.symbol;
              return (
                <g key={band.symbol}>
                  <rect
                    x={0}
                    y={y0}
                    width={WIDTH}
                    height={Math.max(0, y1 - y0)}
                    className={chosen ? 'interval-band interval-band-on' : 'interval-band'}
                  />
                  {y1 - y0 >= LABEL_MIN_PX ? (
                    <text x={8} y={(y0 + y1) / 2 + 4} className="interval-label">
                      {display(band.symbol)} {(band.high - band.low).toFixed(3)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>

        <div className="interval-readout">
          {/*
            The cost of the symbol under the cursor is the figure this whole
            view exists to make visible, so it is the one set at figure size and
            the other three are its context.
          */}
          <p className="interval-cost">
            <span className="figure">{step.costBits.toFixed(2)}</span>
            <span className="unit">bits for this symbol</span>
          </p>
          <dl className="interval-facts">
            <div>
              <dt>symbol</dt>
              <dd>{JSON.stringify(step.symbol)}</dd>
            </div>
            <div>
              <dt>symbols coded</dt>
              <dd>
                {cursor + 1} of {steps.length}
              </dd>
            </div>
            <div>
              <dt>idealised interval width</dt>
              <dd>2^{step.widthLog2.toFixed(1)}</dd>
            </div>
            <div>
              <dt>bits emitted so far</dt>
              <dd>{step.cumulativeBits}</dd>
            </div>
          </dl>
        </div>

        <div className="interval-renorm">
          <h3 className="label">Renormalization</h3>
          <p className="assumption">
            When the top bits of the integer low and high agree they can never change again, so they
            leave the register and the interval doubles. When the interval straddles the midpoint
            but keeps narrowing, the bit is not yet decided: it is counted as underflow and emitted
            later, at the opposite polarity to whichever bit resolves next.
          </p>
          <dl className="interval-integers data">
            <div>
              <dt>low</dt>
              <dd>{step.lowAfter.toString(2).padStart(Number(PRECISION), '0')}</dd>
            </div>
            <div>
              <dt>high</dt>
              <dd>{step.highAfter.toString(2).padStart(Number(PRECISION), '0')}</dd>
            </div>
            <div>
              <dt>register width</dt>
              <dd>
                {widthFraction.toExponential(3)} of the full range, {Number(PRECISION)}-bit
                registers
              </dd>
            </div>
            <div>
              <dt>emitted this step</dt>
              <dd>{step.bitsEmitted || 'nothing yet'}</dd>
            </div>
            <div>
              <dt>underflow pending</dt>
              <dd>{step.underflowCount}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="interval-controls">
        <button type="button" onClick={() => move(-1)} disabled={cursor === 0}>
          Step back
        </button>
        {/* Reduced motion means do not animate, not do not advance. The
            timing branch above already knows this and steps at a fixed 700ms
            with no interpolation; disabling the control made that branch
            unreachable and took the instrument away from the reader it was
            written for. The speed slider stays disabled, because under reduced
            motion the interval is stepped at one rate by design. */}
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-pressed={playing}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={() => move(1)} disabled={cursor >= steps.length - 1}>
          Step on
        </button>
        <label className="label" htmlFor="interval-speed">
          Speed
        </label>
        <input
          id="interval-speed"
          type="range"
          min={0.5}
          max={4}
          step={0.5}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          disabled={reduced}
        />
        <label className="visually-hidden" htmlFor="interval-scrub">
          Symbol
        </label>
        <input
          id="interval-scrub"
          className="interval-scrub"
          type="range"
          min={0}
          max={Math.max(0, steps.length - 1)}
          value={cursor}
          onChange={(e) => {
            setPlaying(false);
            onCursor(Number(e.target.value));
          }}
        />
      </div>
      {reduced ? (
        <p className="assumption">
          Reduced motion is on, so the zoom is a stepper: each step writes its state
          instantly, and Play advances one resolved step at a time rather than animating
          between them.
        </p>
      ) : null}
    </div>
  );
}

interface Band {
  symbol: string;
  low: number;
  high: number;
}

/** The bands the coder actually used, straight out of the trace. */
function bandsFor(step: ArithmeticStep, alphabet: string[]): Band[] {
  const bands: Band[] = [];
  for (let i = 0; i < alphabet.length; i++) {
    bands.push({ symbol: alphabet[i], low: step.bands[i], high: step.bands[i + 1] });
  }
  return bands;
}

function ease(t: number): number {
  // cubic-bezier(.4,0,.2,1), close enough for a scalar.
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
