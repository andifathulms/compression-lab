/**
 * The bit ledger: the output stream growing symbol by symbol, each symbol
 * annotated with what it actually cost.
 *
 * Watching a common letter cost 1.2 bits and a rare one cost 8.4 is the whole
 * intuition of entropy in one column of numbers, which is why this is a table
 * of figures and not a chart.
 */

import { useEffect, useRef } from 'react';
import type { ArithmeticStep } from '../../engine/index.ts';
import './BitLedger.css';

interface Props {
  steps: ArithmeticStep[];
  /** The step in view, so the ledger scrolls in step with the coder. */
  cursor: number;
  onSelect: (index: number) => void;
}

export function BitLedger({ steps, cursor, onSelect }: Props): JSX.Element {
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    const row = bodyRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    row?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  return (
    <div className="ledger">
      <div className="panel-heading">
        <h3 className="label">Bit ledger</h3>
        <span className="label">
          {steps.length.toLocaleString()} symbols traced
        </span>
      </div>
      <div className="ledger-scroll">
        <table>
          <caption className="visually-hidden">
            Each coded symbol, its probability under the model, its cost in bits, the bits it put
            on the output, and the running total.
          </caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Symbol</th>
              <th scope="col">p</th>
              <th scope="col">Cost, bits</th>
              <th scope="col">Emitted</th>
              <th scope="col">Total, bits</th>
            </tr>
          </thead>
          <tbody ref={bodyRef}>
            {steps.map((step) => (
              <tr key={step.index} aria-current={step.index === cursor ? 'true' : undefined}>
                <td>
                  <button
                    type="button"
                    className="row-button"
                    aria-pressed={step.index === cursor}
                    onClick={() => onSelect(step.index)}
                  >
                    {step.index}
                  </button>
                </td>
                <td className="ledger-symbol">{display(step.symbol)}</td>
                <td>{step.probability.toFixed(4)}</td>
                <td>{step.costBits.toFixed(2)}</td>
                <td className="ledger-bits">{step.bitsEmitted || '·'}</td>
                <td>{step.cumulativeBits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Whitespace has to be visible in a table of one-character cells. */
export function display(symbol: string): string {
  if (symbol === ' ') return '␣';
  if (symbol === '\n') return '⏎';
  if (symbol === '\t') return '⇥';
  return symbol;
}
