/**
 * The coder bay: one constant anchor above it, one interchangeable part here.
 *
 * Switching the coder swaps the instrument. The staircase and the text surface
 * do not change, because a constant anchor is what makes a set of views read
 * as one subject rather than as four unrelated screens.
 */

import { useState } from 'react';
import type {
  ArithmeticRun,
  HuffmanRun,
  Lz77Run,
  TextAnalysis,
} from '../engine/index.ts';
import type { AppState, Lz77Settings } from '../state/appState.ts';
import { SizeSplit } from './SizeSplit.tsx';
import { BitLedger } from './BitLedger/BitLedger.tsx';

interface Props {
  analysis: TextAnalysis;
  state: AppState;
  huffman: HuffmanRun;
  arithmetic: ArithmeticRun;
  lz77: Lz77Run;
  onLz77: (settings: Lz77Settings) => void;
  onSelectSymbol: (symbol: string | null) => void;
  selectedSymbol: string | null;
  onWindowRanges: (ranges: {
    lookahead: [number, number] | null;
    match: [number, number] | null;
  }) => void;
}

export function CoderBay({
  analysis,
  state,
  huffman,
  arithmetic,
  lz77,
}: Props): JSX.Element {
  const [ledgerCursor, setLedgerCursor] = useState(0);

  if (state.coder === 'compare') {
    return (
      <section className="panel" aria-label="All three coders">
        <div className="panel-heading">
          <h2>All three</h2>
        </div>
        <p className="note">
          The same text under all three, at order {state.order}. There is no winner here: each has
          a regime, and the point is to make the regimes visible.
        </p>
        <h3 className="label">Huffman</h3>
        <SizeSplit
          result={huffman.result}
          originalBytes={analysis.byteCount}
          colour="var(--huffman)"
        />
        <h3 className="label">Arithmetic</h3>
        <SizeSplit
          result={arithmetic.result}
          originalBytes={analysis.byteCount}
          colour="var(--arithmetic)"
        />
        <h3 className="label">LZ77</h3>
        <SizeSplit result={lz77.result} originalBytes={analysis.byteCount} colour="var(--lz77)" />
      </section>
    );
  }

  if (state.coder === 'arithmetic') {
    return (
      <section className="panel" aria-label="Arithmetic coding">
        <div className="panel-heading">
          <h2>Arithmetic coding</h2>
          <span className="label">order {state.order}</span>
        </div>
        <p className="note">
          The text is one number in an interval that narrows by a factor of the probability of
          each symbol. A symbol the model expected barely narrows it; a surprising one narrows it
          a lot, and the number needs more digits.
        </p>
        <SizeSplit
          result={arithmetic.result}
          originalBytes={analysis.byteCount}
          colour="var(--arithmetic)"
        />
        <BitLedger
          steps={arithmetic.trace.steps}
          cursor={ledgerCursor}
          onSelect={setLedgerCursor}
        />
      </section>
    );
  }

  if (state.coder === 'lz77') {
    return (
      <section className="panel" aria-label="LZ77">
        <div className="panel-heading">
          <h2>LZ77</h2>
          <span className="label">
            window {state.lz77.windowSize} · look-ahead {state.lz77.lookahead}
          </span>
        </div>
        <p className="note">
          No model is measured and none is transmitted. A repeated run of text is replaced by a
          reference back to where it appeared before, and the decoder has the same history to
          read from.
        </p>
        <SizeSplit result={lz77.result} originalBytes={analysis.byteCount} colour="var(--lz77)" />
        <p className="assumption">
          {lz77.matches.toLocaleString()} matches and {lz77.literals.toLocaleString()} literals.
          Token encoding: a literal is 1 flag bit and 8 bits of byte; a match is 1 flag bit,{' '}
          {lz77.widths.distanceBits} bits of distance and {lz77.widths.lengthBits} bits of length.
          The size depends on this scheme and there is no single right one.
        </p>
      </section>
    );
  }

  return (
    <section className="panel" aria-label="Huffman coding">
      <div className="panel-heading">
        <h2>Huffman coding</h2>
        <span className="label">order {state.order}</span>
      </div>
      <p className="note">
        A prefix code — no code is the start of another, so the stream needs no separators. Codes
        are whole numbers of bits, and that rounding is what Huffman gives away.
      </p>
      <SizeSplit
        result={huffman.result}
        originalBytes={analysis.byteCount}
        colour="var(--huffman)"
      />
    </section>
  );
}
