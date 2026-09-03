/**
 * The shell.
 *
 * Three bands, and the order they are in is the argument.
 *
 * The masthead states the claim. The rail underneath it is pinned and carries
 * the answer — what this text costs, right now, under the current model —
 * together with the three controls that move it. Below that the page splits:
 * the specimen on the left, on paper, and the apparatus on the right, on the
 * bench. The specimen is the largest thing on the page and it stays visible
 * while it is being measured, because that is what this app is for.
 *
 * The staircase is pinned at the top of the apparatus column and never scrolls
 * away, because every other instrument is an elaboration of it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TextSurface, FULL_RENDER_LIMIT } from './views/TextSurface/TextSurface.tsx';
import { Staircase } from './views/Staircase/Staircase.tsx';
import { CoderBay } from './views/CoderBay.tsx';
import { ParallelRow } from './views/ParallelRow.tsx';
import { Masthead } from './ui/Masthead.tsx';
import { Rail } from './ui/Rail.tsx';
import { MakerSignature } from './ui/MakerSignature.tsx';
import { useTheme } from './ui/theme.ts';
import { count } from './ui/format.ts';
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
  type CoderResult,
} from './engine/index.ts';
import { sampleById } from './samples/index.ts';
import './styles/base.css';
import './App.css';

const CODER_NAMES: Record<string, string> = {
  huffman: 'Huffman',
  arithmetic: 'Arithmetic',
  lz77: 'LZ77',
};

export function App(): JSX.Element {
  const { state, set, setText, overflow, copyLink } = useAppState();
  const { analysis, stale, deferred } = useAnalysis(state.text, state.adaptive);
  const theme = useTheme();
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

  /**
   * The reading in the rail. Under compare there is no coder in view, so the
   * rail shows the lowest of the three and names it — a blank reading, or an
   * arbitrary one, would be worse than picking the winner and saying so.
   */
  const reading = useMemo((): {
    result: CoderResult;
    label: string;
    caveat: string | null;
  } => {
    if (state.coder === 'compare') {
      const candidates: Array<[string, CoderResult]> = [
        ['Huffman', huffman.result],
        ['Arithmetic', arithmetic.result],
        ['LZ77', lz77.result],
      ];
      const best = candidates.reduce((a, b) =>
        b[1].bitsPerSymbol < a[1].bitsPerSymbol ? b : a,
      );
      // The name alone. "LZ77, lowest of three" is twice as wide as any other
      // value this row ever holds, and it pushed the whole rail onto a second
      // line for one of the four coder settings. The qualifier moves to the
      // label above it, which has the room.
      return { result: best[1], label: best[0], caveat: 'lowest of three' };
    }
    const result =
      state.coder === 'arithmetic'
        ? arithmetic.result
        : state.coder === 'lz77'
          ? lz77.result
          : huffman.result;
    return { result, label: CODER_NAMES[state.coder], caveat: null };
  }, [state.coder, huffman, arithmetic, lz77]);

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

  const chooseSample = useCallback(
    (id: string) => {
      const chosen = sampleById(id);
      if (chosen !== undefined) setText(chosen.text, chosen.id);
    },
    [setText],
  );

  /**
   * The rail is pinned at the top and the two columns are pinned underneath
   * it, so they need to know how tall it is. It wraps differently at every
   * width and with every reading, so it is measured rather than guessed and
   * published as a custom property the layout reads.
   */
  const railRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rail = railRef.current;
    const shell = shellRef.current;
    if (rail === null || shell === null || typeof ResizeObserver === 'undefined') return;
    const apply = (): void => {
      shell.style.setProperty('--rail-h', `${Math.round(rail.getBoundingClientRect().height)}px`);
    };
    const observer = new ResizeObserver(apply);
    observer.observe(rail);
    apply();
    return () => observer.disconnect();
  }, []);

  const [huffmanSymbol, setHuffmanSymbol] = useState<string | null>(null);
  const [windowRanges, setWindowRanges] = useState<{
    lookahead: [number, number] | null;
    match: [number, number] | null;
  }>({ lookahead: null, match: null });

  return (
    <div className="app" ref={shellRef}>
      <a className="skip-link" href="#apparatus">
        Skip to the instruments
      </a>

      <Masthead
        sampleId={state.sampleId}
        onSample={chooseSample}
        onCopyLink={onCopyLink}
        linkStatus={linkStatus}
        theme={theme}
      />

      <div className="app-rail" ref={railRef}>
        <Rail
          order={state.order}
          onOrder={(order) => set('order', order)}
          adaptive={state.adaptive}
          onAdaptive={(adaptive) => set('adaptive', adaptive)}
          coder={state.coder}
          onCoder={(coder) => set('coder', coder)}
          result={reading.result}
          resultLabel={reading.label}
          resultCaveat={reading.caveat}
          originalBytes={analysis.byteCount}
          symbolCount={analysis.symbolCount}
          stale={stale}
        />
      </div>

      <main className="app-main">
        <section className="app-specimen" aria-label="The text surface">
          <div className="specimen-head">
            <div className="panel-heading">
              <h2>The text</h2>
              <span className="label">
                {count(analysis.symbolCount)} characters · {analysis.alphabet.length} distinct
              </span>
            </div>
            <p className="note">
              Every character is coloured by its surprisal — the cost of coding it,{' '}
              <span className="data">-log2 p</span>, in bits. Predictable characters fade into
              the ground; surprising ones are fully drawn.
            </p>
            {sample !== undefined ? <p className="assumption">{sample.note}</p> : null}
          </div>

          {overflow !== null ? (
            <p className="app-warning" role="alert">
              That paste is {count(overflow)} characters. The cap is {count(MAX_INPUT)}, above
              which the model tables stop being legible and a keystroke stops being cheap.
              Nothing was changed — the text was not truncated.
            </p>
          ) : null}
          {deferred ? (
            <p className="assumption">
              Above {count(50000)} characters the figures are recomputed when you stop typing
              rather than on every keystroke.{stale ? ' Recomputing.' : ''}
            </p>
          ) : null}
          {analysis.symbolCount > FULL_RENDER_LIMIT ? (
            <p className="assumption">
              Only the visible part of the text is drawn, so the browser&apos;s find will not
              reach past it.
            </p>
          ) : null}

          <TextSurface
            text={state.text}
            surprisal={surprisal}
            rampMaxBits={analysis.rampMaxBits}
            charOffsets={analysis.index.charOffsets}
            mode={theme.mode}
            onChange={(text) => setText(text, null)}
            onHover={setHover}
            hoverPosition={hover}
            onCaret={setHover}
            highlightSymbol={huffmanSymbol}
            highlightRange={windowRanges.lookahead}
            matchRange={windowRanges.match}
            order={state.order}
            placeholder="Paste some text, or choose a sample."
          />

          <div className="specimen-readout" aria-live="polite">
            {readout !== null ? (
              <>
                <span className="specimen-readout-symbol data">
                  {JSON.stringify(readout.symbol)}
                </span>
                <span className="specimen-readout-body data">
                  after {JSON.stringify(readout.context)} · p ={' '}
                  {readout.probability.toFixed(4)}
                </span>
                <span className="specimen-readout-cost data">
                  {readout.bits.toFixed(2)}
                  <span className="unit"> bits</span>
                </span>
              </>
            ) : (
              <span className="label">
                Point at a character, or move the caret, to see its cost
              </span>
            )}
          </div>
        </section>

        <section className="app-apparatus" id="apparatus" aria-label="The instruments">
          <div className="app-stair">
            <Staircase
              analysis={analysis}
              order={state.order}
              coder={state.coder}
              huffman={huffman.result}
              arithmetic={arithmetic.result}
              lz77={lz77.result}
              onOrder={(order) => set('order', order)}
            />
          </div>

          <div className="app-bay">
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
            <ParallelRow
              lz77={state.lz77}
              currentSampleId={state.sampleId}
              onChoose={chooseSample}
            />
            <p className="assumption">
              Probabilities use add-constant smoothing, alpha = {ALPHA}, over the{' '}
              {analysis.alphabet.length} symbols that occur in this text. The entropy steps use
              the unsmoothed counts, which is why a coder never quite reaches its step.
            </p>
          </div>
        </section>
      </main>

      <footer className="app-foot">
        {/* The way in, for anyone who arrived at the instrument first. It is a
            static page and it is one level up in the same deployment, so the
            link is relative rather than absolute. */}
        <a className="app-foot-link" href="about/">
          What this is, and what it measures
        </a>
        <MakerSignature />
      </footer>
    </div>
  );
}
