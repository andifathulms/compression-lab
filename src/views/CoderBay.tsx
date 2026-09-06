/**
 * The coder bay: one constant anchor above it, one interchangeable part here.
 *
 * Each panel is named by its own heading rather than by a repeated
 * aria-label. The label used to restate the heading word for word, so a screen
 * reader's region list and its heading list disagreed about nothing while
 * costing a second string to keep in step.
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
import { Interval } from './Interval/Interval.tsx';
import { SlidingWindow } from './SlidingWindow/SlidingWindow.tsx';
import { HuffmanTree } from './HuffmanTree/HuffmanTree.tsx';
import { WastePlot } from './WastePlot/WastePlot.tsx';

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
  onLz77,
  onWindowRanges,
  onSelectSymbol,
  selectedSymbol,
}: Props): JSX.Element {
  const [ledgerCursor, setLedgerCursor] = useState(0);

  if (state.coder === 'compare') {
    return (
      <section className="panel" aria-labelledby="coder-compare-heading">
        <div className="panel-heading">
          <h3 id="coder-compare-heading">All three</h3>
        </div>
        <p className="note">
          The same text under all three, at order {state.order}. There is no winner here: each has
          a regime, and the point is to make the regimes visible.
        </p>
        <h4 className="label">Huffman</h4>
        <SizeSplit
          result={huffman.result}
          originalBytes={analysis.byteCount}
          colour="var(--huffman)"
        />
        <h4 className="label">Arithmetic</h4>
        <SizeSplit
          result={arithmetic.result}
          originalBytes={analysis.byteCount}
          colour="var(--arithmetic)"
        />
        <h4 className="label">LZ77</h4>
        <SizeSplit result={lz77.result} originalBytes={analysis.byteCount} colour="var(--lz77)" />
      </section>
    );
  }

  if (state.coder === 'arithmetic') {
    return (
      <section className="panel" aria-labelledby="coder-arithmetic-heading">
        <div className="panel-heading">
          <h3 id="coder-arithmetic-heading">Arithmetic coding</h3>
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
        <p className="assumption">
          What is drawn is the idealised real-number interval, because that is the version a
          person can follow. What the engine does is an integer range coder with renormalization
          and underflow handling. The renormalization track below is the bridge between them, and
          both are read from the same trace record, so they cannot come apart.
        </p>
        <Interval
          steps={arithmetic.trace.steps}
          analysis={analysis}
          cursor={Math.min(ledgerCursor, Math.max(0, arithmetic.trace.steps.length - 1))}
          onCursor={setLedgerCursor}
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
      <section className="panel" aria-labelledby="coder-lz77-heading">
        <div className="panel-heading">
          <h3 id="coder-lz77-heading">LZ77</h3>
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
        <SlidingWindow
          run={lz77}
          analysis={analysis}
          settings={state.lz77}
          onSettings={onLz77}
          onRanges={onWindowRanges}
        />
      </section>
    );
  }

  return (
    <section className="panel" aria-labelledby="coder-huffman-heading">
      <div className="panel-heading">
        <h3 id="coder-huffman-heading">Huffman coding</h3>
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
      {state.order > 0 ? (
        <p className="assumption">
          At order {state.order} there is a code table per context. The tree drawn is the one for
          the context {JSON.stringify(huffman.trace.context)}; the size above counts every table
          the encoder used.
        </p>
      ) : null}
      <HuffmanTree
        trace={huffman.trace}
        selected={selectedSymbol}
        onSelect={onSelectSymbol}
      />
      <h4 className="label">What the whole bits cost</h4>
      <WastePlot
        entries={huffman.waste}
        wasteBits={huffman.wasteBits}
        symbolCount={analysis.symbolCount}
        selected={selectedSymbol}
        onSelect={onSelectSymbol}
      />
    </section>
  );
}
