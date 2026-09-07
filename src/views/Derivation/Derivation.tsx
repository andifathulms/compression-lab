/**
 * One character, all the way down.
 *
 * This is the calculation the whole app is a sum over. The staircase, all three
 * coders, the model-cost trade-off and the tint on every character in the
 * specimen are aggregates of exactly this: take the characters before this one,
 * look up how often each symbol followed them, turn that into a probability,
 * and take minus its log.
 *
 * The app was showing the two ends of it — "p = 0.4624 · 1.11 bits" — and
 * nothing in between. A reader who cannot reproduce that one line cannot check
 * any other number on the page, and PRD 5.2 says this surface is where entropy
 * stops being a number. It stayed a number.
 *
 * So the arithmetic is on screen, with the counts it came from, the smoothing
 * rule quoted where it is applied rather than in a footnote at the foot of a
 * six-thousand-pixel column, and the unsmoothed probability beside the smoothed
 * one so the size of that assumption is visible instead of asserted.
 *
 * It follows the pointer and the caret when the reader moves either, and picks
 * a worked example itself when they have not. Nothing here waits for input: a
 * newcomer can read it end to end before touching a control, which is the one
 * thing the landing view could not previously offer.
 */

import { useMemo, useState } from 'react';
import type { Order, TextAnalysis } from '../../engine/index.ts';
import { ALPHA, contextAt } from '../../engine/index.ts';
import { count } from '../../ui/format.ts';
import './Derivation.css';

interface Props {
  analysis: TextAnalysis;
  order: Order;
  /** Where the reader is pointing, or null when they are not. */
  position: number | null;
}

/** How far to look for a worked example before settling for what we have. */
const SCAN = 4000;

/**
 * A position worth showing when the reader has not chosen one.
 *
 * The most *predictable* character in the opening of the text, not the most
 * common one. Picking by frequency lands on whatever follows a space, which is
 * a context that predicts almost nothing — the example then shows the machinery
 * working and the answer coming out at four bits, which teaches the opposite of
 * the point.
 *
 * Picking by probability lands on a context that genuinely narrows the next
 * character, so the reader's first worked example is one where conditioning
 * visibly pays. A floor on how often the context occurs keeps it from being a
 * fluke of something seen twice.
 *
 * Deterministic: same text and order, same example, every time.
 */
const MIN_OCCURRENCES = 12;

function defaultPosition(analysis: TextAnalysis, order: Order): number | null {
  const n = analysis.symbolCount;
  if (n === 0) return null;
  if (order === 0) return 0;

  const model = analysis.models[order];
  let best = Math.min(order, n - 1);
  let bestP = -1;
  const limit = Math.min(n, SCAN);
  for (let i = order; i < limit; i++) {
    const context = contextAt(analysis.symbols, i, order);
    if (model.contextTotal(context) < MIN_OCCURRENCES) continue;
    const p = model.probability(context, analysis.symbols[i]);
    if (p > bestP) {
      bestP = p;
      best = i;
    }
  }
  return best;
}

/** Printable form of a symbol, so a space or a newline is visible. */
function show(symbol: string): string {
  if (symbol === ' ') return '␣';
  if (symbol === '\n') return '⏎';
  if (symbol === '\t') return '⇥';
  return symbol;
}

export function Derivation({ analysis, order, position }: Props): JSX.Element | null {
  /*
   * The demonstrator's own probability, in halvings. It starts at one half —
   * one bit — because that is the case the whole unit is defined against.
   */
  const [halvings, setHalvings] = useState(1);

  const fallback = useMemo(() => defaultPosition(analysis, order), [analysis, order]);
  const at = position !== null && position < analysis.symbolCount ? position : fallback;

  const derived = useMemo(() => {
    if (at === null || analysis.symbolCount === 0) return null;
    const model = analysis.models[order];
    const symbol = analysis.symbols[at];
    const context = contextAt(analysis.symbols, at, order);
    const seen = model.count(context, symbol);
    const total = model.contextTotal(context);
    const alphabet = analysis.alphabet.length;
    const smoothed = (seen + ALPHA) / (total + ALPHA * alphabet);
    const raw = total > 0 ? seen / total : 0;
    return {
      symbol,
      context: context.join(''),
      seen,
      total,
      alphabet,
      smoothed,
      raw,
      bits: -Math.log2(smoothed),
      chosen: position !== null,
    };
  }, [at, analysis, order, position]);

  if (derived === null) return null;

  const demoP = 1 / 2 ** halvings;

  return (
    <section className="deriv panel" aria-labelledby="deriv-heading">
      <div className="panel-heading">
        <h3 id="deriv-heading">Where a number of bits comes from</h3>
        <span className="label">{derived.chosen ? 'the character you picked' : 'a worked example'}</span>
      </div>

      <p className="note">
        Every figure on this page is a sum over the calculation below, done once per
        character. It is worth following once.
      </p>

      {/*
        * What the app assumes you already have, said once, where the assuming
        * starts. The rule about introducing each term at first use covers the
        * vocabulary — surprisal, prefix code, renormalization — and says
        * nothing about the arithmetic underneath it, which was assumed
        * silently.
        */}
      <p className="assumption">
        It needs three things from you and nothing else: that a probability here is just a
        count divided by a count; that a “bit” can be fractional, because it is an average
        price rather than a physical 0 or 1; and that log2 counts halvings, which the
        control further down will show you if it does not. No other mathematics is assumed
        anywhere in this app.
      </p>

      <ol className="deriv-steps">
        <li>
          <span className="deriv-step-label">the character</span>
          <span className="deriv-step-body">
            <span className="deriv-symbol">{show(derived.symbol)}</span>
            {order === 0 ? (
              <> anywhere in the text, because an order-0 model looks at nothing before it.</>
            ) : (
              <>
                {' '}
                after{' '}
                <span className="deriv-context">
                  {derived.context.split('').map(show).join('')}
                </span>{' '}
                — the {order} character{order === 1 ? '' : 's'} in front of it, which is what
                “order {order}” means.
              </>
            )}
          </span>
        </li>

        <li>
          <span className="deriv-step-label">what the text did</span>
          <span className="deriv-step-body">
            {order === 0 ? (
              <>
                <span className="data">{show(derived.symbol)}</span> occurs{' '}
                <strong className="data">{count(derived.seen)}</strong> times in{' '}
                <strong className="data">{count(derived.total)}</strong> characters.
              </>
            ) : (
              <>
                <span className="data">{derived.context.split('').map(show).join('')}</span>{' '}
                occurs <strong className="data">{count(derived.total)}</strong> times, and{' '}
                <span className="data">{show(derived.symbol)}</span> follows it{' '}
                <strong className="data">{count(derived.seen)}</strong> of those times.
              </>
            )}
          </span>
        </li>

        <li>
          <span className="deriv-step-label">the probability</span>
          <span className="deriv-step-body">
            <span className="deriv-sum data">
              p = ({count(derived.seen)} + {ALPHA}) / ({count(derived.total)} + {ALPHA} ×{' '}
              {count(derived.alphabet)}) = {derived.smoothed.toFixed(4)}
            </span>
            {/* The rule, where it is applied. */}
            <span className="deriv-rule">
              The + {ALPHA} is add-constant smoothing: every one of the{' '}
              {count(derived.alphabet)} symbols in this text is handed one imaginary
              occurrence before counting starts, so nothing a model has never seen is given
              probability zero and a cost of infinity. It is an assumption, and it moves this
              number:{' '}
              {derived.total > 0 ? (
                <>
                  without it the count alone gives{' '}
                  <span className="data">{derived.raw.toFixed(4)}</span>.
                </>
              ) : (
                <>
                  without it this context has been seen zero times and the probability would
                  be undefined.
                </>
              )}
            </span>
          </span>
        </li>

        <li>
          <span className="deriv-step-label">the cost</span>
          <span className="deriv-step-body">
            <span className="deriv-sum data">
              −log2({derived.smoothed.toFixed(4)}) ={' '}
              <strong>{derived.bits.toFixed(2)} bits</strong>
            </span>
            <span className="deriv-rule">
              This is the one step that is a definition rather than a measurement, and it is
              the definition the whole subject rests on, so it is worth a moment below.
            </span>
          </span>
        </li>
      </ol>

      {/*
        * The log, as something to push on rather than a formula to accept.
        * Halving a probability adds exactly one bit, and that is easier to feel
        * by moving it than to take on trust from "-log2 p".
        */}
      <div className="deriv-demo">
        <h4 className="deriv-demo-heading">Why a probability becomes a number of bits</h4>
        <p className="note">
          A bit is one yes-or-no answer. If something happens half the time, one answer
          settles it. Half of that, and you need another. Every halving costs one more bit —
          which is all <span className="data">−log2 p</span> says.
        </p>

        <div className="deriv-demo-control">
          <label className="label" htmlFor="deriv-halvings">
            Probability
          </label>
          <input
            id="deriv-halvings"
            type="range"
            min={0}
            max={10}
            step={1}
            value={halvings}
            onChange={(e) => setHalvings(Number(e.target.value))}
            aria-valuetext={`1 in ${2 ** halvings}, costing ${halvings} bit${
              halvings === 1 ? '' : 's'
            }`}
          />
          <p className="deriv-demo-readout data">
            <span className="deriv-demo-p">
              {halvings === 0 ? '1' : `1 / ${count(2 ** halvings)}`} = {demoP.toFixed(
                Math.min(6, halvings),
              )}
            </span>
            <span className="deriv-demo-arrow" aria-hidden="true">
              →
            </span>
            <span className="deriv-demo-bits">
              <strong>{halvings}</strong> bit{halvings === 1 ? '' : 's'}
            </span>
          </p>
        </div>

        <p className="assumption">
          A character&apos;s probability is rarely a neat power of two, which is why the cost
          above came out as {derived.bits.toFixed(2)} rather than a whole number. Huffman has
          to round every one of these up to a whole bit and that rounding is what it gives
          away; arithmetic coding does not, and the interval view further down is that
          difference made visible.
        </p>
      </div>
    </section>
  );
}
