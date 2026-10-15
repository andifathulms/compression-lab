/**
 * The byte bar: code stream and model description, to scale against the
 * original.
 *
 * One component everywhere a compressed size is drawn — the readout bar, every
 * coder's split, the adaptive comparison — so the same quantity is always the
 * same mark on the same scale. The code stream is a solid in the coder's
 * colour. The model description is hatched, because it is overhead rather than
 * output and a solid block beside the code stream would read as more of the
 * same substance (PRD 7.1).
 *
 * The frame is the original. When the total comes out larger than the file it
 * was meant to compress, the bar is rescaled to the total and a rule marks
 * where the original ends, so the overshoot is drawn rather than clipped.
 */

import './ByteBar.css';

interface Props {
  codeBits: number;
  modelBits: number;
  originalBits: number;
  /** The coder's colour token, e.g. var(--huffman). */
  colour: string;
  /** Read out in place of the drawing. */
  label: string;
  size?: 'regular' | 'large';
}

export function ByteBar({
  codeBits,
  modelBits,
  originalBits,
  colour,
  label,
  size = 'regular',
}: Props): JSX.Element {
  const total = codeBits + modelBits;
  const scale = Math.max(originalBits, total) || 1;
  const over = total > originalBits && originalBits > 0;
  return (
    <div
      className={size === 'large' ? 'bytebar bytebar-large' : 'bytebar'}
      role="img"
      aria-label={label}
    >
      <span className="bytebar-code" style={{ width: pct(codeBits, scale), background: colour }} />
      <span className="bytebar-model" style={{ width: pct(modelBits, scale) }} />
      {over ? (
        <span className="bytebar-original" style={{ left: pct(originalBits, scale) }} />
      ) : null}
    </div>
  );
}

function pct(bits: number, scale: number): string {
  return `${Math.max(0, Math.min(100, (bits / scale) * 100)).toFixed(2)}%`;
}
