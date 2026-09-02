/**
 * The text surface: the user's own writing, every character tinted by what it
 * costs under the current model.
 *
 * Two layers, exactly aligned. Underneath, a coloured layer of spans that is
 * `aria-hidden` and takes no pointer events. On top, a real transparent
 * textarea holding the text. The textarea is what makes the surface a paste
 * target with no form field around it, and it is what keeps the prose
 * selectable, editable and legible to a screen reader — which is why this is
 * DOM and not canvas.
 *
 * Virtualisation. Below `FULL_RENDER_LIMIT` every line is drawn, so browser
 * find works over the whole text. Above it only the visible lines plus a
 * buffer are drawn, because 200,000 spans is not a thing to ask of a browser,
 * and the interface says so rather than letting find quietly stop working.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { surprisalColour } from '../../ui/ramp.ts';
import './TextSurface.css';

/** Below this, every line is rendered and browser find covers the whole text. */
export const FULL_RENDER_LIMIT = 12000;
const OVERSCAN_LINES = 40;

export interface HoverReadout {
  position: number;
  symbol: string;
  context: string;
  probability: number;
  bits: number;
}

interface Props {
  text: string;
  /** Cost of each symbol, in bits. Indexed by symbol, not by UTF-16 unit. */
  surprisal: Float64Array;
  /** Top of the ramp, in bits. */
  rampMaxBits: number;
  /** Symbol position to UTF-16 offset, from the engine's text index. */
  charOffsets: Int32Array;
  onChange: (text: string) => void;
  onHover: (position: number | null) => void;
  /** Every occurrence of this symbol is outlined, from the Huffman tree view. */
  highlightSymbol: string | null;
  /** Symbol range to outline, from the sliding window view. */
  highlightRange: [number, number] | null;
  /** A second range, so a match and its source can be shown at once. */
  matchRange: [number, number] | null;
  /** Order of the model, so the context under the cursor can be shaded. */
  order: number;
  hoverPosition: number | null;
  placeholder: string;
}

interface Line {
  /** Symbol index of the line's first character. */
  start: number;
  /** Symbol index one past the line's last character, excluding the newline. */
  end: number;
}

/** Split into lines by symbol index, so the two layers agree on positions. */
function lineSpans(symbols: string[]): Line[] {
  const lines: Line[] = [];
  let start = 0;
  for (let i = 0; i < symbols.length; i++) {
    if (symbols[i] === '\n') {
      lines.push({ start, end: i });
      start = i + 1;
    }
  }
  lines.push({ start, end: symbols.length });
  return lines;
}

export function TextSurface({
  text,
  surprisal,
  rampMaxBits,
  charOffsets,
  onChange,
  onHover,
  highlightSymbol,
  highlightRange,
  matchRange,
  order,
  hoverPosition,
  placeholder,
}: Props): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);
  const [lineHeight, setLineHeight] = useState(28);

  const symbols = useMemo(() => Array.from(text), [text]);
  const lines = useMemo(() => lineSpans(symbols), [symbols]);
  const virtualised = symbols.length > FULL_RENDER_LIMIT;

  // Which lines to draw. Estimated from the line height, then corrected by the
  // browser once the layer has laid out, because prose wraps and a line is not
  // one row.
  const [rowsPerLine, setRowsPerLine] = useState<number[]>([]);
  const offsets = useMemo(() => {
    const out = new Float64Array(lines.length + 1);
    for (let i = 0; i < lines.length; i++) {
      const rows = rowsPerLine[i] ?? Math.max(1, Math.ceil((lines[i].end - lines[i].start) / 66));
      out[i + 1] = out[i] + rows * lineHeight;
    }
    return out;
  }, [lines, rowsPerLine, lineHeight]);

  const [firstLine, lastLine] = useMemo(() => {
    if (!virtualised) return [0, lines.length];
    let lo = 0;
    while (lo < lines.length && offsets[lo + 1] < scrollTop) lo++;
    let hi = lo;
    while (hi < lines.length && offsets[hi] < scrollTop + height) hi++;
    return [Math.max(0, lo - OVERSCAN_LINES), Math.min(lines.length, hi + OVERSCAN_LINES)];
  }, [virtualised, lines.length, offsets, scrollTop, height]);

  // Colours are written straight onto the DOM rather than through React. The
  // order slider is a continuous control and re-tints on every frame of the
  // drag; reconciling several thousand inline styles per frame would not hold
  // 60 fps, and there is nothing here React needs to diff.
  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (layer === null) return;
    const spans = layer.querySelectorAll<HTMLElement>('[data-i]');
    for (const span of spans) {
      const i = Number(span.dataset.i);
      span.style.color = surprisalColour(surprisal[i] ?? 0, rampMaxBits);
    }
  }, [surprisal, rampMaxBits, firstLine, lastLine, text]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el === null) return;
    const observer = new ResizeObserver(() => setHeight(el.clientHeight));
    observer.observe(el);
    setHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  // Measure what the browser actually did, so the spacers are right.
  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (layer === null) return;
    const probe = layer.querySelector<HTMLElement>('.ts-line');
    if (probe !== null) {
      const single = probe.getBoundingClientRect().height;
      if (single > 0 && Math.abs(single - lineHeight) > 0.5 && probe.dataset.rows === '1') {
        setLineHeight(single);
      }
    }
    if (!virtualised) return;
    const measured = rowsPerLine.slice();
    let changed = false;
    for (const el of layer.querySelectorAll<HTMLElement>('.ts-line')) {
      const i = Number(el.dataset.line);
      const rows = Math.max(1, Math.round(el.getBoundingClientRect().height / lineHeight));
      if (measured[i] !== rows) {
        measured[i] = rows;
        changed = true;
      }
    }
    if (changed) setRowsPerLine(measured);
  }, [firstLine, lastLine, lineHeight, virtualised, rowsPerLine, text]);

  /**
   * One listener on the container, hit-tested by caret position. A listener
   * per character would be tens of thousands of them.
   */
  const handleMove = useCallback(
    (event: React.MouseEvent) => {
      const area = areaRef.current;
      if (area === null) return;
      const doc = document as Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offset: number } | null;
      };
      let offset: number | null = null;
      if (typeof doc.caretPositionFromPoint === 'function') {
        offset = doc.caretPositionFromPoint(event.clientX, event.clientY)?.offset ?? null;
      } else if (typeof document.caretRangeFromPoint === 'function') {
        offset = document.caretRangeFromPoint(event.clientX, event.clientY)?.startOffset ?? null;
      }
      if (offset === null) {
        onHover(null);
        return;
      }
      // The caret offset counts UTF-16 units; positions here count symbols.
      let lo = 0;
      let hi = symbols.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (charOffsets[mid] < offset) lo = mid + 1;
        else hi = mid;
      }
      const position = charOffsets[lo] === offset ? lo : Math.max(0, lo - 1);
      onHover(position < symbols.length ? position : null);
    },
    [charOffsets, onHover, symbols.length],
  );

  const contextStart = hoverPosition === null ? -1 : Math.max(0, hoverPosition - order);

  const rendered: JSX.Element[] = [];
  for (let li = firstLine; li < lastLine; li++) {
    const line = lines[li];
    const spans: JSX.Element[] = [];
    for (let i = line.start; i < line.end; i++) {
      const symbol = symbols[i];
      const classes = ['ts-c'];
      if (highlightSymbol !== null && symbol === highlightSymbol) classes.push('ts-symbol');
      if (highlightRange !== null && i >= highlightRange[0] && i < highlightRange[1]) {
        classes.push('ts-range');
      }
      if (matchRange !== null && i >= matchRange[0] && i < matchRange[1]) classes.push('ts-match');
      if (hoverPosition !== null && i >= contextStart && i < hoverPosition) classes.push('ts-context');
      if (i === hoverPosition) classes.push('ts-cursor');
      spans.push(
        <span key={i} data-i={i} className={classes.join(' ')}>
          {symbol}
        </span>,
      );
    }
    rendered.push(
      <div
        key={li}
        className="ts-line"
        data-line={li}
        data-rows={rowsPerLine[li] ?? 1}
      >
        {spans.length > 0 ? spans : '​'}
      </div>,
    );
  }

  const topPad = virtualised ? offsets[firstLine] : 0;
  const bottomPad = virtualised ? offsets[lines.length] - offsets[lastLine] : 0;

  return (
    <div
      className="ts"
      ref={scrollRef}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      onMouseMove={handleMove}
      onMouseLeave={() => onHover(null)}
    >
      <div className="ts-stack">
        <div className="ts-layer" ref={layerRef} aria-hidden="true">
          {topPad > 0 ? <div style={{ height: topPad }} /> : null}
          {rendered}
          {bottomPad > 0 ? <div style={{ height: bottomPad }} /> : null}
        </div>
        <textarea
          ref={areaRef}
          className="ts-input"
          value={text}
          spellCheck={false}
          placeholder={placeholder}
          aria-label="The text being measured. Type or paste to replace it."
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
