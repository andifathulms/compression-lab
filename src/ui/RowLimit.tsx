/**
 * A table that says it continues.
 *
 * Tables used to sit in fixed-height scroll boxes that cut the last visible
 * row in half, which reads as a rendering fault rather than as "there is more".
 * A short table now shows its first rows and a full-width row that says how
 * many there are and opens the rest. Tables that run to thousands of rows —
 * the bit ledger, the LZ77 tokens — keep their scroll boxes, because listing
 * ten thousand rows on demand is not a kindness.
 */

import { useState } from 'react';

export const DEFAULT_ROWS = 8;

export function useRowLimit(
  total: number,
  limit = DEFAULT_ROWS,
): { shown: number; open: boolean; toggle: () => void } {
  const [open, setOpen] = useState(false);
  return {
    shown: open ? total : Math.min(total, limit),
    open,
    toggle: () => setOpen((o) => !o),
  };
}

export function ShowAll({
  total,
  open,
  onToggle,
  noun,
  limit = DEFAULT_ROWS,
}: {
  total: number;
  open: boolean;
  onToggle: () => void;
  /** What a row is, plural: "symbols", "contexts". */
  noun: string;
  limit?: number;
}): JSX.Element | null {
  if (total <= limit) return null;
  return (
    <button type="button" className="show-all" aria-expanded={open} onClick={onToggle}>
      {open ? `Show the first ${limit}` : `Show all ${total.toLocaleString()} ${noun}`}
    </button>
  );
}
