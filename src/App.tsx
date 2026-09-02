/**
 * The shell.
 *
 * The text is on the left and it is the largest thing on the page. That is the
 * argument the layout makes: this app measures writing, and the writing stays
 * visible while you measure it. The staircase is pinned at the top of the
 * right column and never scrolls away, because every other instrument is an
 * elaboration of it.
 */

import { useCallback, useMemo, useState } from 'react';
import { TextSurface, FULL_RENDER_LIMIT } from './views/TextSurface/TextSurface.tsx';
import { Staircase } from './views/Staircase/Staircase.tsx';
import { CoderBay } from './views/CoderBay.tsx';
import { ControlBar } from './ui/ControlBar.tsx';
import { useAppState } from './state/appState.ts';
import { useAnalysis } from './state/useAnalysis.ts';
import {
  cachedArithmetic,
  cachedHuffman,
  cachedLz77,
  contextAt,
  MAX_INPUT,
  surprisals,
  ALPHA,
} from './engine/index.ts';
import { sampleById } from './samples/index.ts';
import './styles/base.css';
import './App.css';

export function App(): JSX.Element {
  const { state, set, setText, overflow, copyLink } = useAppState();
  const { analysis, stale, deferred } = useAnalysis(state.text, state.adaptive);
  const [hover, setHover] = useState<number | null>(null);
  const [linkStatus, setLinkStatus] = useState<string | null>(null);

  const huffman = useMemo(
    () => cachedHuffman(analysis, state.order),
    [analysis, state.order],
  );
  const arithmetic = useMemo(
    () => cachedArithmetic(analysis, state.order),
    [analysis, state.order],
  );
  const lz77 = useMemo(() => cachedLz77(analysis, state.lz77), [analysis, state.lz77]);

  // The tint follows the coder in view, because the two are the same
  // measurement: what this model charges for this character.
  const surprisal = useMemo(() => {
    if (state.coder === 'lz77') {
      // LZ77 has no per-symbol probability, so the tint shows the model the
      // staircase is drawn against rather than pretending LZ77 has one.
      return surprisals(analysis.index, analysis.models[state.order]);
    }
    return state.coder === 'arithmetic' ? arithmetic.surprisal : huffman.surprisal;
  }, [state.coder, state.order, analysis, arithmetic, huffman]);

  const sample = sampleById(state.sampleId);

  const readout = useMemo(() => {
    if (hover === null || hover >= analysis.symbolCount) return null;
    const model = analysis.models[state.order];
    const context = contextAt(analysis.symbols, hover, state.order);
    const probability = model.probability(context, analysis.symbols[hover]);
    return {
      symbol: analysis.symbols[hover],
      context: context.join(''),
      probability,
      bits: -Math.log2(probability),
    };
  }, [hover, analysis, state.order]);

  const onCopyLink = useCallback(
    (withText: boolean) => {
      const url = copyLink(withText);
      void navigator.clipboard?.writeText(url).then(
        () =>
          setLinkStatus(
            withText
              ? 'Link copied. It contains your text.'
              : 'Link copied. Settings only, no text.',
          ),
        () => setLinkStatus('Could not reach the clipboard.'),
      );
      window.setTimeout(() => setLinkStatus(null), 4000);
    },
    [copyLink],
  );

  const [huffmanSymbol, setHuffmanSymbol] = useState<string | null>(null);
  const [windowRanges, setWindowRanges] = useState<{
    lookahead: [number, number] | null;
    match: [number, number] | null;
  }>({ lookahead: null, match: null });

  return (
    <div className="app">
      <header className="app-header">
        <h1>Compression Lab</h1>
        <p className="app-descriptor">What a text costs, and what that cost depends on</p>
      </header>

      <main className="app-main">
        <section className="app-text panel" aria-label="The text surface">
          <div className="panel-heading">
            <h2>The text</h2>
            <span className="label">
              {analysis.symbolCount.toLocaleString()} characters · {analysis.alphabet.length}{' '}
              distinct
            </span>
          </div>
          <p className="note">
            Every character is coloured by its surprisal — the cost of coding it,{' '}
            <span className="data">-log2 p</span>, in bits. Predictable characters fade into the
            page; surprising ones sit in full ink.
          </p>
          {sample !== undefined ? <p className="assumption">{sample.note}</p> : null}

          <div className="app-readout" aria-live="polite">
            {readout !== null ? (
              <span className="data">
                {JSON.stringify(readout.symbol)} after {JSON.stringify(readout.context)} ·{' '}
                p = {readout.probability.toFixed(4)} · {readout.bits.toFixed(2)} bits
              </span>
            ) : (
              <span className="label">
                Point at a character to see its context, its probability and its cost.
              </span>
            )}
          </div>

          {overflow !== null ? (
            <p className="app-warning" role="alert">
              That paste is {overflow.toLocaleString()} characters. The cap is{' '}
              {MAX_INPUT.toLocaleString()}, above which the model tables stop being legible and a
              keystroke stops being cheap. Nothing was changed — the text was not truncated.
            </p>
          ) : null}
          {deferred ? (
            <p className="assumption">
              Above {(50000).toLocaleString()} characters the figures are recomputed when you stop
              typing rather than on every keystroke.{stale ? ' Recomputing.' : ''}
            </p>
          ) : null}
          {analysis.symbolCount > FULL_RENDER_LIMIT ? (
            <p className="assumption">
              Only the visible part of the text is drawn, so the browser&apos;s find will not reach
              past it.
            </p>
          ) : null}

          <TextSurface
            text={state.text}
            surprisal={surprisal}
            rampMaxBits={analysis.rampMaxBits}
            charOffsets={analysis.index.charOffsets}
            onChange={(text) => setText(text, null)}
            onHover={setHover}
            hoverPosition={hover}
            highlightSymbol={huffmanSymbol}
            highlightRange={windowRanges.lookahead}
            matchRange={windowRanges.match}
            order={state.order}
            placeholder="Paste some text, or choose a sample."
          />
        </section>

        <section className="app-instruments" aria-label="Instruments">
          <Staircase
            analysis={analysis}
            order={state.order}
            coder={state.coder}
            huffman={huffman.result}
            arithmetic={arithmetic.result}
            lz77={lz77.result}
            onOrder={(order) => set('order', order)}
          />
          <CoderBay
            analysis={analysis}
            state={state}
            huffman={huffman}
            arithmetic={arithmetic}
            lz77={lz77}
            onLz77={(lz) => set('lz77', lz)}
            onSelectSymbol={setHuffmanSymbol}
            selectedSymbol={huffmanSymbol}
            onWindowRanges={setWindowRanges}
          />
          <p className="assumption">
            Probabilities use add-constant smoothing, alpha = {ALPHA}, over the{' '}
            {analysis.alphabet.length} symbols that occur in this text. The entropy steps use the
            unsmoothed counts, which is why a coder never quite reaches its step.
          </p>
        </section>
      </main>

      <footer className="app-footer">
        <ControlBar
          order={state.order}
          onOrder={(order) => set('order', order)}
          adaptive={state.adaptive}
          onAdaptive={(adaptive) => set('adaptive', adaptive)}
          sampleId={state.sampleId}
          onSample={(id) => {
            const chosen = sampleById(id);
            if (chosen !== undefined) setText(chosen.text, chosen.id);
          }}
          coder={state.coder}
          onCoder={(coder) => set('coder', coder)}
          onCopyLink={onCopyLink}
          linkStatus={linkStatus}
        />
      </footer>
    </div>
  );
}
