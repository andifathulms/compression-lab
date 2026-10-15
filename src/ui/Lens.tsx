/**
 * The lens: one character's cost, with the arithmetic that produced it.
 *
 * It replaces a one-line readout that showed the two ends of the calculation
 * — "p = 0.4624 · 1.11 bits" — and nothing in between. The counts are cheap to
 * show and they are the whole explanation, so they are shown.
 *
 * It sits at the foot of the specimen rather than floating over the character
 * it describes. A tooltip that follows the pointer across 200,000 characters
 * is a tooltip permanently in front of the character you wanted to look at
 * next. It follows the caret as well as the pointer, so it is on the keyboard
 * path.
 */

import { useMemo } from 'react';
import type { Order, TextAnalysis } from '../engine/index.ts';
import { ALPHA, contextAt } from '../engine/index.ts';
import './Lens.css';

interface Props {
  analysis: TextAnalysis;
  order: Order;
  position: number | null;
  /** The colour of the instrument whose cost this is. */
  colour: string;
}

/** Printable form of a symbol, so a space or a newline is visible. */
function show(symbol: string): string {
  if (symbol === ' ') return '␣';
  if (symbol === '\n') return '⏎';
  if (symbol === '\t') return '⇥';
  return symbol;
}

export function Lens({ analysis, order, position, colour }: Props): JSX.Element {
  const reading = useMemo(() => {
    if (position === null || position >= analysis.symbolCount) return null;
    const model = analysis.models[order];
    const symbol = analysis.symbols[position];
    const context = contextAt(analysis.symbols, position, order);
    const seen = model.count(context, symbol);
    const total = model.contextTotal(context);
    const p = model.probability(context, symbol);
    return {
      symbol,
      context: context.map(show).join(''),
      seen,
      total,
      p,
      bits: -Math.log2(p),
    };
  }, [position, analysis, order]);

  const alphabet = analysis.alphabet.length;
  const top = analysis.rampMaxBits > 0 ? analysis.rampMaxBits : 8;

  return (
    <div className="lens" aria-live="polite">
      {reading === null ? (
        <p className="lens-empty">Point at a character, or move the caret, to see its cost.</p>
      ) : (
        <>
          <div className="lens-row">
            <kbd className="lens-key">{show(reading.symbol)}</kbd>
            <span className="lens-word">after</span>
            <kbd className="lens-key lens-context">{reading.context === '' ? 'nothing' : reading.context}</kbd>
            <span className="lens-math data">
              p = ({reading.seen} + {ALPHA}) / ({reading.total} + {alphabet}) ={' '}
              {reading.p.toFixed(4)}
            </span>
            <span className="lens-cost data" style={{ color: colour }}>
              {reading.bits.toFixed(2)}
              <span className="unit"> bits</span>
            </span>
          </div>
          <div className="lens-bar" aria-hidden="true">
            <span
              style={{
                width: `${Math.min(100, (reading.bits / top) * 100).toFixed(1)}%`,
                background: colour,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
