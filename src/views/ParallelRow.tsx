/**
 * The parallel corpus, as a comparison row on the staircase.
 *
 * Four texts that say the same thing, measured the same way. It exists to
 * support one specific claim, which the numbers here either bear out or do
 * not: affix-heavy and agglutinative languages carry more substring redundancy
 * than character-level entropy reveals, so LZ77 should beat the order-0
 * prediction by a wider margin on the Indonesian and Finnish texts than on the
 * English one.
 *
 * The margin is the figure that carries the claim, so it is the column the row
 * is sorted on and the only one given emphasis. This is a sample chooser plus
 * a row, deliberately: any more and it becomes a research apparatus.
 */

import { useMemo } from 'react';
import {
  analyseText,
  runLz77,
  type Lz77Options,
} from '../engine/index.ts';
import { PARALLEL_SAMPLES } from '../samples/index.ts';

interface Props {
  lz77: Lz77Options;
  currentSampleId: string | null;
  onChoose: (id: string) => void;
}

export function ParallelRow({ lz77, currentSampleId, onChoose }: Props): JSX.Element {
  const rows = useMemo(
    () =>
      PARALLEL_SAMPLES.map((sample) => {
        const analysis = analyseText(sample.text, false);
        const run = runLz77(analysis, lz77);
        const h0 = analysis.rows[0].entropyBits;
        const lz = run.result.bitsPerSymbol;
        return {
          id: sample.id,
          language: sample.language ?? sample.name,
          symbols: analysis.symbolCount,
          h0,
          h2: analysis.rows[2].entropyBits,
          lz,
          // Positive means LZ77 landed below the order-0 entropy of the same
          // text, which is the thing that looks impossible if you believe in a
          // floor.
          margin: h0 - lz,
        };
      }),
    [lz77],
  );

  return (
    <section className="panel" aria-label="The parallel corpus">
      <div className="panel-heading">
        <h2>The same text, four languages</h2>
        <span className="label">bits per symbol</span>
      </div>
      <p className="note">
        The same articles of the Universal Declaration of Human Rights. Character-level entropy
        and LZ77 measure different kinds of redundancy, and the gap between them is not the same
        in every language.
      </p>
      <table>
        <caption className="visually-hidden">
          Order-0 entropy, order-2 entropy and the LZ77 rate for each translation
        </caption>
        <thead>
          <tr>
            <th scope="col">Language</th>
            <th scope="col">Characters</th>
            <th scope="col">H0</th>
            <th scope="col">H2</th>
            <th scope="col">LZ77 total</th>
            <th scope="col">H0 − LZ77</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} aria-current={row.id === currentSampleId ? 'true' : undefined}>
              <th scope="row">
                <button
                  type="button"
                  className="row-button"
                  aria-pressed={row.id === currentSampleId}
                  onClick={() => onChoose(row.id)}
                >
                  {row.language}
                </button>
              </th>
              <td>{row.symbols.toLocaleString()}</td>
              <td>{row.h0.toFixed(3)}</td>
              <td>{row.h2.toFixed(3)}</td>
              <td>{row.lz.toFixed(3)}</td>
              <td style={{ color: 'var(--lz77)' }}>{row.margin.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="assumption">
        LZ77 has no model description, so its total is its code stream. These texts are short —
        around {Math.round(rows[0]?.symbols ?? 0)} characters — and at that length a static model
        costs more to describe than it saves, which is why the staircase&apos;s minimum sits at a
        low order for all four. The margin is the figure that carries the claim; the entropies are
        there so it can be read against something.
      </p>
    </section>
  );
}
