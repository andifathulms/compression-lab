/**
 * The shell.
 *
 * A brand row, a pinned readout bar, then two columns on two grounds: the
 * specimen on warm paper on the left, and the apparatus on cool steel on the
 * right. The readout bar carries the answer — what this text costs, right
 * now, under the current model — together with the controls that move it.
 *
 * The apparatus is five chapters rather than one column. It used to stack
 * eight panels into about 7,700 pixels, and the staircase, the app's centre,
 * began eleven hundred pixels down. The chapters run in the order of the
 * argument and the app opens on the staircase; see state/chapter.ts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TextSurface, FULL_RENDER_LIMIT } from './views/TextSurface/TextSurface.tsx';
import { Staircase } from './views/Staircase/Staircase.tsx';
import { CoderBay } from './views/CoderBay.tsx';
import { ParallelRow } from './views/ParallelRow.tsx';
import { Masthead } from './ui/Masthead.tsx';
import { Rail } from './ui/Rail.tsx';
import { Lens } from './ui/Lens.tsx';
import { ChapterNav, chapterPanelId, chapterTabId } from './ui/ChapterNav.tsx';
import { useChapter, type ChapterId } from './state/chapter.ts';
import { MakerSignature } from './ui/MakerSignature.tsx';
import { useTheme } from './ui/theme.ts';
import { RampKey } from './ui/RampKey.tsx';
import { Derivation } from './views/Derivation/Derivation.tsx';
import { LearningCurve } from './views/LearningCurve/LearningCurve.tsx';
import { LengthSweep } from './views/LengthSweep/LengthSweep.tsx';
import { ModelPanel } from './views/ModelPanel/ModelPanel.tsx';
import { measurementsCsv, measurementsFilename } from './ui/exportRows.ts';
import { count } from './ui/format.ts';
import { useAppState } from './state/appState.ts';
import { useAnalysis } from './state/useAnalysis.ts';
import {
  cachedArithmetic,
  cachedHuffman,
  cachedLz77,
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

const CODER_COLOURS: Record<string, string> = {
  huffman: 'var(--huffman)',
  arithmetic: 'var(--arithmetic)',
  lz77: 'var(--lz77)',
  compare: 'var(--ink)',
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

  /**
   * The reader's own text, kept when a sample replaces it.
   *
   * Loading a sample overwrites the surface, and the interface actively invites
   * that: the parallel-corpus row is four buttons that each swap the text. The
   * most valuable thing anyone does with this app is measure their own writing,
   * and ordinary curiosity about Finnish was enough to destroy it. So the
   * outgoing text is held and offered back. Not a dialog, not a confirmation
   * step: a button that appears next to the chooser and says how much it has.
   */
  const [restorable, setRestorable] = useState<string | null>(null);

  const chooseSample = useCallback(
    (id: string) => {
      const chosen = sampleById(id);
      if (chosen === undefined) return;
      if (state.sampleId === null && state.text.trim() !== '') {
        setRestorable(state.text);
      }
      setText(chosen.text, chosen.id);
    },
    [setText, state.sampleId, state.text],
  );

  const restoreText = useCallback(() => {
    if (restorable === null) return;
    setText(restorable, null);
    setRestorable(null);
  }, [restorable, setText]);

  /**
   * The header is pinned at the top and the two columns are pinned underneath
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

  /**
   * The measurements as a file the reader saved themselves. Nothing is
   * uploaded and nothing is fetched — a blob built in the page and handed to
   * the browser's own download is not a contradiction of that, and the label
   * beside the control says what it contains.
   */
  const onDownload = useCallback(() => {
    const csv = measurementsCsv({
      analysis,
      lz77Settings: state.lz77,
      results: {
        huffman: huffman.result,
        arithmetic: arithmetic.result,
        lz77: lz77.result,
      },
      sampleId: state.sampleId,
    });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = measurementsFilename(state.sampleId);
    link.click();
    URL.revokeObjectURL(url);
  }, [analysis, state.lz77, state.sampleId, huffman, arithmetic, lz77]);

  const [chapter, setChapter] = useChapter();

  /*
   * Changing chapter keeps the reader's place on the page: if they had
   * scrolled down into a long chapter, the next one starts at its top rather
   * than somewhere in its middle.
   */
  const apparatusRef = useRef<HTMLElement>(null);
  const goChapter = useCallback(
    (id: ChapterId) => {
      setChapter(id);
      const el = apparatusRef.current;
      if (el === null) return;
      const top = el.getBoundingClientRect().top;
      if (top < 0) window.scrollTo({ top: window.scrollY + top, behavior: 'auto' });
    },
    [setChapter],
  );

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

      {/* The brand row and the readout bar are pinned together. Pinned apart,
          the brand row scrolled away and the specimen, sized to the viewport
          under the rail alone, started with its lens below the fold. */}
      <div className="app-head" ref={railRef}>
      <Masthead
        sampleId={state.sampleId}
        onSample={chooseSample}
        restorable={restorable}
        onRestore={restoreText}
        onCopyLink={onCopyLink}
        linkStatus={linkStatus}
        theme={theme}
        coder={state.coder}
        onCoder={(coder) => set('coder', coder)}
        onDownload={onDownload}
      />

      <div className="app-rail">
        <Rail
          order={state.order}
          onOrder={(order) => set('order', order)}
          adaptive={state.adaptive}
          onAdaptive={(adaptive) => set('adaptive', adaptive)}
          coder={state.coder}
          result={reading.result}
          resultLabel={reading.label}
          resultCaveat={reading.caveat}
          originalBytes={analysis.byteCount}
          symbolCount={analysis.symbolCount}
          stale={stale}
        />
      </div>
      </div>

      <main className="app-main">
        {/* Named by its heading, so the region and the heading give a screen
            reader one name for one thing. */}
        <section className="app-specimen" aria-labelledby="specimen-heading">
          <div className="specimen-head">
            <div className="panel-heading">
              <h2 id="specimen-heading">The text</h2>
              <span className="label">
                {count(analysis.symbolCount)} characters · {analysis.alphabet.length} distinct
              </span>
            </div>
            {/* Plain language first, the name for it second: the picture is
                explained before the coined term and the logarithm. */}
            <p className="note">
              Each character is shaded by what it costs to code. The ones the model saw
              coming fade into the page; the ones it did not are drawn in full ink. That
              cost has a name — <em>surprisal</em> — and a formula,{' '}
              <span className="data">-log2 p</span>, in bits.
            </p>
            <RampKey maxBits={analysis.rampMaxBits} />
          </div>

          {/*
            * The two standing caveats: what happens to your text, and what
            * this sample is. Stated where the decision to paste is made, and
            * short, because above the text they cost lines of it.
            */}
          <div className="specimen-caveats">
            <p className="caveat">
              <strong>Editable.</strong> Paste your own text and every figure remeasures.
              Nothing is uploaded, and your text stays out of the address bar unless you ask
              for a link that includes it.
            </p>
            {sample !== undefined ? <p className="caveat">{sample.note}</p> : null}
          </div>

          {overflow !== null ? (
            <p className="app-warning" role="alert">
              That paste is {count(overflow)} characters. The cap is {count(MAX_INPUT)}, above
              which the model tables stop being legible and a keystroke stops being cheap.
              Nothing was changed — the text was not truncated.
            </p>
          ) : null}
          {deferred ? (
            <p className="caveat">
              Above {count(50000)} characters the figures are recomputed when you stop typing
              rather than on every keystroke.{stale ? ' Recomputing.' : ''}
            </p>
          ) : null}
          {analysis.symbolCount > FULL_RENDER_LIMIT ? (
            <p className="caveat">
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
            // Marks belong to the instrument that made them, and only the coders
            // chapter has one mounted.
            highlightSymbol={chapter === 'coders' ? huffmanSymbol : null}
            highlightRange={chapter === 'coders' ? windowRanges.lookahead : null}
            matchRange={chapter === 'coders' ? windowRanges.match : null}
            order={state.order}
            placeholder="Paste some text, or choose a sample."
          />

          <div className="specimen-lens">
            <Lens
              analysis={analysis}
              order={state.order}
              position={hover}
              colour={CODER_COLOURS[state.coder]}
            />
          </div>
        </section>

        <section
          className="app-apparatus"
          id="apparatus"
          aria-label="The instruments"
          ref={apparatusRef}
        >
          <ChapterNav chapter={chapter} onChapter={goChapter} />

          <div
            className="chapter"
            role="tabpanel"
            id={chapterPanelId(chapter)}
            aria-labelledby={chapterTabId(chapter)}
            key={chapter}
          >
            {chapter === 'counting' ? (
              <Derivation analysis={analysis} order={state.order} position={hover} />
            ) : null}

            {chapter === 'staircase' ? (
              <>
                <Staircase
                  analysis={analysis}
                  order={state.order}
                  coder={state.coder}
                  huffman={huffman.result}
                  arithmetic={arithmetic.result}
                  lz77={lz77.result}
                  onOrder={(order) => set('order', order)}
                />
                <p className="assumption">
                  <strong>Assumption: add-one smoothing.</strong> Probabilities use
                  add-constant smoothing, alpha = {ALPHA}, over the {analysis.alphabet.length}{' '}
                  symbols that occur in this text. The entropy steps use the unsmoothed counts,
                  which is why a coder never quite reaches its step.
                </p>
              </>
            ) : null}

            {chapter === 'model' ? (
              <>
                <ModelPanel analysis={analysis} order={state.order} />
                <LengthSweep
                  analysis={analysis}
                  adaptive={state.adaptive}
                  order={state.order}
                  onOrder={(o) => set('order', o)}
                />
                <LearningCurve
                  analysis={analysis}
                  order={state.order}
                  adaptive={state.adaptive}
                />
              </>
            ) : null}

            {chapter === 'coders' ? (
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
            ) : null}

            {chapter === 'languages' ? (
              <ParallelRow
                lz77={state.lz77}
                currentSampleId={state.sampleId}
                onChoose={chooseSample}
              />
            ) : null}
          </div>
        </section>
      </main>

      <footer className="app-foot">
        {/* The way in, for anyone who arrived at the instrument first. It is a
            static page one level up in the same deployment, so the link is
            relative rather than absolute. */}
        <a className="app-foot-link" href="about/">
          What this is, and what it measures
        </a>
        <MakerSignature />
      </footer>
    </div>
  );
}
