/**
 * The size breakdown, shown beside every coder.
 *
 * PRD 7.1: any figure presented as a compressed size includes the model
 * description unless it is explicitly labelled otherwise. A static high-order
 * model that appeared free would make higher orders look strictly better,
 * which is false and is the exact misconception this app exists to remove. So
 * the split is always visible: code stream, model, total.
 */

import type { CoderResult } from '../engine/index.ts';

interface Props {
  result: CoderResult;
  /** UTF-8 size of the original, for the ratio. */
  originalBytes: number;
  colour: string;
}

export function SizeSplit({ result, originalBytes, colour }: Props): JSX.Element {
  const original = originalBytes * 8;
  return (
    <div className="split">
      <div className="split-bar" role="img" aria-label={label(result, original)}>
        <span
          className="split-code"
          style={{ width: pct(result.codeBits, original), background: colour }}
        />
        <span
          className="split-model"
          style={{ width: pct(result.modelBits, original) }}
        />
      </div>
      <dl className="split-figures data">
        <div>
          <dt>code stream</dt>
          <dd>{bytes(result.codeBits)}</dd>
        </div>
        <div>
          <dt>model description</dt>
          <dd>{bytes(result.modelBits)}</dd>
        </div>
        <div>
          <dt>total</dt>
          <dd>{bytes(result.totalBits)}</dd>
        </div>
        <div>
          <dt>rate</dt>
          <dd>{result.bitsPerSymbol.toFixed(3)} bits per symbol</dd>
        </div>
      </dl>
    </div>
  );
}

function pct(bits: number, original: number): string {
  return `${Math.min(100, (bits / (original || 1)) * 100).toFixed(2)}%`;
}

function bytes(bits: number): string {
  const b = bits / 8;
  if (b < 1024) return `${b.toFixed(0)} B`;
  return `${(b / 1024).toFixed(2)} kB`;
}

function label(result: CoderResult, original: number): string {
  return `Code stream ${bytes(result.codeBits)}, model description ${bytes(
    result.modelBits,
  )}, against ${bytes(original)} of UTF-8 original.`;
}
