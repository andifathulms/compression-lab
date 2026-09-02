/**
 * The analysis the whole interface reads from.
 *
 * Under the live-typing limit this recomputes synchronously on every
 * keystroke, which is what the 16 ms budget in the engine exists to allow.
 * Above it, a full analysis is around 150 ms and would make typing feel
 * broken, so the recompute waits for the typing to stop — and the interface
 * says that it is waiting, rather than quietly changing behaviour.
 */

import { useEffect, useRef, useState } from 'react';
import {
  cachedAnalysis,
  LIVE_TYPING_LIMIT,
  type TextAnalysis,
} from '../engine/index.ts';

export interface AnalysisState {
  analysis: TextAnalysis;
  /** True when the text has changed and the figures shown are the old ones. */
  stale: boolean;
  /** True when this text is large enough that recompute waits for a pause. */
  deferred: boolean;
}

const IDLE_MS = 400;

export function useAnalysis(text: string, adaptive: boolean): AnalysisState {
  const deferred = text.length > LIVE_TYPING_LIMIT;
  const [settled, setSettled] = useState({ text, adaptive });
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!deferred) {
      setSettled({ text, adaptive });
      return;
    }
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSettled({ text, adaptive }), IDLE_MS);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [text, adaptive, deferred]);

  const analysis = cachedAnalysis(settled.text, settled.adaptive);
  return {
    analysis,
    stale: settled.text !== text || settled.adaptive !== adaptive,
    deferred,
  };
}
