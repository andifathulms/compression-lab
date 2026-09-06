/**
 * The model description, taken apart.
 *
 * "Model cost is measured, not estimated" is this project's load-bearing
 * claim: if the model description size is a guess, the staircase's minimum is
 * fiction and the whole app is an illustration rather than an instrument. The
 * claim was true — the model really is serialised and the tests really do
 * decode a text from those bytes and the code stream alone — and it was also
 * the one figure in the interface with nothing behind it but a number.
 *
 * So: the number, taken apart into the parts the format actually writes, with
 * the sections summing to the measurement rather than approximating it. Then
 * the contexts, ranked by what they cost, because the accumulation of contexts
 * seen once is the mechanism behind the staircase's rising model curve. The
 * staircase shows that the curve goes up; this shows why.
 *
 * Showing the format invites the reader to judge the format, and they will
 * sometimes be right — a tighter encoding exists. That is stated here rather
 * than defended, because the app's credibility rests on naming the arbitrary
 * choices, not on pretending they were forced.
 */

import { useMemo, useState } from 'react';
import type { Order, TextAnalysis } from '../../engine/index.ts';
import { contextBreakdown, modelLayout, serialiseModel } from '../../engine/index.ts';
import { bytes, count } from '../../ui/format.ts';
import './ModelPanel.css';

interface Props {
  analysis: TextAnalysis;
  order: Order;
}

/** Enough to see the shape of the format without printing six kilobytes. */
const PREVIEW_BYTES = 48;

export function ModelPanel({ analysis, order }: Props): JSX.Element {
  const [showBytes, setShowBytes] = useState(false);
  const model = analysis.models[order];

  const { layout, breakdown, preview, totalBytes } = useMemo(() => {
    const bytesOut = serialiseModel(model);
    return {
      layout: modelLayout(model),
      breakdown: contextBreakdown(model),
      preview: Array.from(bytesOut.slice(0, PREVIEW_BYTES)),
      totalBytes: bytesOut.length,
    };
  }, [model]);

  // Share of the total, not of the largest section. At order 1 the counts are
  // 95% of the description and the header parts are a few bytes each — which
  // is the finding, and a bar scaled to the largest section hides it by making
  // counts full width no matter what it costs.
  const shareOf = (b: number): number => (b / (totalBytes || 1)) * 100;

  /* The singleton argument only holds where singletons are actually most of
   * the table. At order 1 there are three of them out of fifty-four, and
   * claiming they drive the model curve upward there would be false. */
  const singletonShare = breakdown.totalBytes > 0
    ? breakdown.singletonBytes / breakdown.totalBytes
    : 0;

  return (
    <section className="modelpanel panel" aria-labelledby="model-heading">
      <div className="panel-heading">
        <h3 id="model-heading">The model description</h3>
        <span className="label">
          order {order} · {bytes(totalBytes * 8)}
        </span>
      </div>

      <p className="note">
        This is what the receiver is sent before a single character of the text. It is a real
        serialisation, not an estimate: the figure on the staircase is the length of this byte
        array, and the test suite decodes the text from these bytes and the code stream alone.
      </p>

      <ol className="model-sections">
        {layout.sections.map((section) => (
          <li key={section.label}>
            <div className="model-section-head">
              <span className="model-section-label">{section.label}</span>
              <span className="model-section-bytes data">{count(section.bytes)} B</span>
            </div>
            <div className="model-section-track">
              <div
                className="model-section-bar"
                style={{ width: `${Math.max(0.6, shareOf(section.bytes))}%` }}
                data-part={section.label === 'counts' ? 'counts' : 'header'}
              />
              <span className="model-section-share data">
                {shareOf(section.bytes) < 1
                  ? '<1%'
                  : `${shareOf(section.bytes).toFixed(0)}%`}
              </span>
            </div>
            <p className="model-section-note">{section.note}</p>
          </li>
        ))}
      </ol>

      <p className="model-reconcile data">
        {count(layout.sections.reduce((sum, s) => sum + s.bytes, 0))} B in sections ·{' '}
        {count(totalBytes)} B actually written
        {layout.totalBytes === totalBytes ? ' · reconciled' : ' · MISMATCH'}
      </p>

      {model.adaptive ? (
        <p className="assumption">
          An adaptive model writes a context count of zero and no counts at all, because the
          decoder rebuilds every one of them from the symbols it has already decoded. What it
          still pays for is its alphabet and its symbol count, and those are in the figure
          because they really are transmitted.
        </p>
      ) : (
        <>
          <h4 className="model-sub">What the counts are spent on</h4>
          <p className="note">
            {count(breakdown.totalContexts)} contexts at order {order}, of which{' '}
            <strong>{count(breakdown.singletons)}</strong> were seen exactly once — costing{' '}
            {bytes(breakdown.singletonBytes * 8)} between them, or{' '}
            {(singletonShare * 100).toFixed(0)}% of the count table, to describe behaviour that
            never repeats.{' '}
            {singletonShare > 0.25 ? (
              <>
                That is the accumulation that turns the staircase&apos;s model line upward.
                Raise the order again and it gets worse: every extra character of context
                splits the counts further, and most of what it buys is contexts seen once.
              </>
            ) : (
              <>
                At this order almost every context repeats, so the table earns its keep. Raise
                the order and watch this share climb — that is the staircase&apos;s model line
                turning upward.
              </>
            )}
          </p>

          <div className="model-table scroll-box">
            <table>
              <caption className="visually-hidden">
                The most expensive contexts in the model description, with what each costs
              </caption>
              <thead>
                <tr>
                  <th scope="col">Context</th>
                  <th scope="col">Followed by</th>
                  <th scope="col">Occurrences</th>
                  <th scope="col">Bytes</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.rows.map((row) => (
                  <tr key={row.context}>
                    <th scope="row" className="model-context">
                      {order === 0 ? '(none)' : JSON.stringify(row.context)}
                    </th>
                    <td>{count(row.entries)}</td>
                    <td>{count(row.occurrences)}</td>
                    <td>{count(row.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="model-bytes">
        <button
          type="button"
          aria-expanded={showBytes}
          onClick={() => setShowBytes((open) => !open)}
        >
          {showBytes ? 'Hide the bytes' : 'Show the first bytes'}
        </button>
        {showBytes ? (
          <>
            <pre className="model-hex" aria-label="The first bytes of the model description">
              {preview.map((b) => b.toString(16).padStart(2, '0')).join(' ')}
              {totalBytes > PREVIEW_BYTES ? ` … (${count(totalBytes)} B total)` : ''}
            </pre>
            <p className="assumption">
              <span className="data">43 4c 4d 31</span> is the magic, &apos;CLM1&apos;. The byte
              after it carries the order in its low three bits and the adaptive flag in bit
              three. Everything after that is unsigned LEB128 varints: symbol count, alphabet
              size, the alphabet as ascending delta-coded code points, then the context count
              and one row per context.
            </p>
          </>
        ) : null}
      </div>

      <p className="assumption">
        The format is one of many that would work, and a tighter one exists — the counts could
        be entropy coded rather than written as varints, which would shrink every figure on the
        staircase without changing its shape. It is written down here so the number can be
        checked rather than believed, and because a measured cost under a stated format is the
        only kind this app is willing to draw.
      </p>
    </section>
  );
}
