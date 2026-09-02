/**
 * Huffman's waste.
 *
 * Two marks per symbol: the ideal cost, -log2 p, and the whole number of bits
 * Huffman assigned. The area between them, weighted by frequency, is exactly
 * what Huffman loses to arithmetic coding.
 *
 * Shown as an area rather than a number, because the number is small and
 * unconvincing and the area is neither.
 */

import { useMemo } from 'react';
import type { WasteEntry } from '../../engine/index.ts';
import { display } from '../BitLedger/BitLedger.tsx';
import './WastePlot.css';

interface Props {
  entries: WasteEntry[];
  wasteBits: number;
  symbolCount: number;
  selected: string | null;
  onSelect: (symbol: string | null) => void;
}

const WIDTH = 560;
const HEIGHT = 200;
const PAD = { top: 14, right: 12, bottom: 26, left: 34 };
/** Symbols that never occur contribute no area, so they are left off. */
const MAX_SYMBOLS = 60;

export function WastePlot({
  entries,
  wasteBits,
  symbolCount,
  selected,
  onSelect,
}: Props): JSX.Element {
  const shown = useMemo(
    () => entries.filter((e) => e.frequency > 0).slice(0, MAX_SYMBOLS),
    [entries],
  );

  if (shown.length === 0) {
    return <p className="label">Nothing to plot yet.</p>;
  }

  const maxBits = Math.max(...shown.map((e) => Math.max(e.idealBits, e.codeBits))) * 1.1;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const step = plotW / shown.length;
  const x = (i: number): number => PAD.left + i * step + step / 2;
  const y = (bits: number): number => PAD.top + plotH - (bits / maxBits) * plotH;

  const idealPath = shown.map((e, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(e.idealBits)}`).join(' ');
  const codePath = shown.map((e, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(e.codeBits)}`).join(' ');
  // The area is the code-length line out, then the ideal line back.
  const area = `${codePath} ${shown
    .map((_, i) => {
      const j = shown.length - 1 - i;
      return `L ${x(j)} ${y(shown[j].idealBits)}`;
    })
    .join(' ')} Z`;

  return (
    <div className="waste">
      <div className="waste-plot">
      <svg
        className="waste-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Ideal cost against assigned code length, for the ${shown.length} symbols that occur. Total waste ${wasteBits.toFixed(0)} bits.`}
      >
        <path d={area} className="waste-area" />
        <path d={idealPath} className="waste-ideal" />
        <path d={codePath} className="waste-code" />
        {shown.map((e, i) => (
          <g key={e.symbol} onClick={() => onSelect(selected === e.symbol ? null : e.symbol)}>
            <rect
              x={x(i) - step / 2}
              y={PAD.top}
              width={step}
              height={plotH}
              fill={e.symbol === selected ? 'var(--huffman-tint)' : 'transparent'}
            />
            <circle cx={x(i)} cy={y(e.codeBits)} r={2} className="waste-dot" />
          </g>
        ))}
        {[0, 2, 4, 6, 8].filter((v) => v <= maxBits).map((v) => (
          <text key={v} x={PAD.left - 6} y={y(v) + 4} className="waste-axis" textAnchor="end">
            {v}
          </text>
        ))}
        <text x={PAD.left} y={HEIGHT - 6} className="waste-axis">
          symbols, most frequent first
        </text>
      </svg>
      </div>

      <p className="waste-total">
        <span className="figure">{(wasteBits / 8).toFixed(0)} B</span>{' '}
        <span className="unit">
          lost to whole-bit codes over this text — {(wasteBits / (symbolCount || 1)).toFixed(3)}{' '}
          bits per symbol. That is the filled area, and it is what arithmetic coding does not pay.
        </span>
      </p>

      <div className="waste-table scroll-box">
      <table>
        <caption className="visually-hidden">
          Ideal cost and assigned code length for every symbol that occurs
        </caption>
        <thead>
          <tr>
            <th scope="col">Symbol</th>
            <th scope="col">Occurrences</th>
            <th scope="col">Ideal, bits</th>
            <th scope="col">Code, bits</th>
            <th scope="col">Lost, bits</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((e) => (
            <tr key={e.symbol} aria-current={e.symbol === selected ? 'true' : undefined}>
              <th scope="row">
                <button
                  type="button"
                  className="row-button"
                  aria-pressed={e.symbol === selected}
                  onClick={() => onSelect(selected === e.symbol ? null : e.symbol)}
                >
                  {display(e.symbol)}
                </button>
              </th>
              <td>{e.frequency.toLocaleString()}</td>
              <td>{e.idealBits.toFixed(3)}</td>
              <td>{e.codeBits}</td>
              <td>{(e.frequency * (e.codeBits - e.idealBits)).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
