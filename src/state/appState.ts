/**
 * Application state, and what of it goes in the URL.
 *
 * Sample choice, order, coder and the LZ77 settings serialise. **Typed text
 * does not.** People paste their own writing into this and a URL is a share
 * surface — it lands in history, in referrers and in whatever is watching the
 * address bar. There is an explicit copy-link action that includes the text,
 * and it says that it does.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Order } from '../engine/index.ts';
import { MAX_INPUT } from '../engine/index.ts';
import { DEFAULT_SAMPLE, sampleById } from '../samples/index.ts';

export type CoderChoice = 'huffman' | 'arithmetic' | 'lz77' | 'compare';

export interface Lz77Settings {
  windowSize: number;
  lookahead: number;
  lazy: boolean;
}

export interface AppState {
  text: string;
  /** Which sample the text came from, or null once the user has edited it. */
  sampleId: string | null;
  order: Order;
  adaptive: boolean;
  coder: CoderChoice;
  lz77: Lz77Settings;
  selection: { symbol: string | null; textRange: [number, number] | null };
}

export const DEFAULT_LZ77_SETTINGS: Lz77Settings = {
  windowSize: 4096,
  lookahead: 32,
  lazy: false,
};

export const WINDOW_SIZES = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768];
export const LOOKAHEAD_SIZES = [4, 8, 16, 32, 64, 128, 258];

const CODERS: CoderChoice[] = ['huffman', 'arithmetic', 'lz77', 'compare'];

function clampOrder(value: unknown): Order {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 5) return 2;
  return n as Order;
}

function nearest(value: number, allowed: number[], fallback: number): number {
  return allowed.includes(value) ? value : fallback;
}

/** Read the shareable part of the state out of a query string. */
export function readUrl(search: string): Partial<AppState> & { text?: string } {
  const params = new URLSearchParams(search);
  const out: Partial<AppState> & { text?: string } = {};

  const sample = params.get('sample');
  if (sample !== null && sampleById(sample)) {
    out.sampleId = sample;
    out.text = sampleById(sample)!.text;
  }
  if (params.has('order')) out.order = clampOrder(params.get('order'));
  if (params.has('adaptive')) out.adaptive = params.get('adaptive') === '1';
  const coder = params.get('coder') as CoderChoice | null;
  if (coder !== null && CODERS.includes(coder)) out.coder = coder;

  const lz77 = { ...DEFAULT_LZ77_SETTINGS };
  let sawLz77 = false;
  if (params.has('window')) {
    lz77.windowSize = nearest(Number(params.get('window')), WINDOW_SIZES, DEFAULT_LZ77_SETTINGS.windowSize);
    sawLz77 = true;
  }
  if (params.has('lookahead')) {
    lz77.lookahead = nearest(Number(params.get('lookahead')), LOOKAHEAD_SIZES, DEFAULT_LZ77_SETTINGS.lookahead);
    sawLz77 = true;
  }
  if (params.has('lazy')) {
    lz77.lazy = params.get('lazy') === '1';
    sawLz77 = true;
  }
  if (sawLz77) out.lz77 = lz77;

  // Only honoured when the link was made by the copy-link action, which says
  // it includes the text.
  const text = params.get('text');
  if (text !== null) {
    out.text = text.slice(0, MAX_INPUT);
    out.sampleId = null;
  }
  return out;
}

/** The query string for the current state. `withText` is the explicit opt-in. */
export function writeUrl(state: AppState, withText: boolean): string {
  const params = new URLSearchParams();
  if (state.sampleId !== null) params.set('sample', state.sampleId);
  params.set('order', String(state.order));
  params.set('adaptive', state.adaptive ? '1' : '0');
  params.set('coder', state.coder);
  if (state.coder === 'lz77' || state.coder === 'compare') {
    params.set('window', String(state.lz77.windowSize));
    params.set('lookahead', String(state.lz77.lookahead));
    params.set('lazy', state.lz77.lazy ? '1' : '0');
  }
  if (withText && state.sampleId === null) params.set('text', state.text);
  return `?${params.toString()}`;
}

export const INITIAL_STATE: AppState = {
  text: DEFAULT_SAMPLE.text,
  sampleId: DEFAULT_SAMPLE.id,
  order: 2,
  adaptive: false,
  coder: 'huffman',
  lz77: DEFAULT_LZ77_SETTINGS,
  selection: { symbol: null, textRange: null },
};

export interface AppStateHandle {
  state: AppState;
  set: <K extends keyof AppState>(key: K, value: AppState[K]) => void;
  setText: (text: string, sampleId?: string | null) => void;
  /** True while a paste is over the cap and has been refused rather than cut. */
  overflow: number | null;
  dismissOverflow: () => void;
  copyLink: (withText: boolean) => string;
}

export function useAppState(): AppStateHandle {
  const [state, setState] = useState<AppState>(() => ({
    ...INITIAL_STATE,
    ...readUrl(typeof window === 'undefined' ? '' : window.location.search),
  }));
  const [overflow, setOverflow] = useState<number | null>(null);
  const first = useRef(true);

  const set = useCallback(<K extends keyof AppState>(key: K, value: AppState[K]) => {
    setState((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const setText = useCallback((text: string, sampleId: string | null = null) => {
    if (text.length > MAX_INPUT) {
      // Refused, not truncated. Silently cutting someone's paste in half and
      // then reporting numbers about it would be worse than saying no.
      setOverflow(text.length);
      return;
    }
    setOverflow(null);
    setState((prev) => ({
      ...prev,
      text,
      sampleId,
      selection: { symbol: null, textRange: null },
    }));
  }, []);

  // The URL follows the state, without the text, and without pushing history
  // entries for a slider drag.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.history.replaceState(null, '', writeUrl(state, false));
  }, [state]);

  const copyLink = useCallback(
    (withText: boolean) => `${window.location.origin}${window.location.pathname}${writeUrl(state, withText)}`,
    [state],
  );

  return useMemo(
    () => ({
      state,
      set,
      setText,
      overflow,
      dismissOverflow: () => setOverflow(null),
      copyLink,
    }),
    [state, set, setText, overflow, copyLink],
  );
}
