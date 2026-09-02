/**
 * Theme.
 *
 * Three settings, two grounds. "System" is the default and is a real setting
 * rather than a starting guess: it keeps following the operating system after
 * the page has loaded, so a machine that flips to dark at sunset flips this
 * page with it.
 *
 * The choice is stored locally and is deliberately *not* in the URL. The URL
 * describes the measurement — sample, order, coder, window — and a link should
 * arrive looking the way the person who opens it prefers, not the way the
 * person who sent it does.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type ThemeMode = 'light' | 'dark';

const KEY = 'compression-lab:theme';
const QUERY = '(prefers-color-scheme: dark)';

function readStored(): ThemeChoice {
  if (typeof localStorage === 'undefined') return 'system';
  try {
    const raw = localStorage.getItem(KEY);
    return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
  } catch {
    // Storage can be denied outright. A theme is not worth an exception.
    return 'system';
  }
}

function systemMode(): ThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia(QUERY).matches ? 'dark' : 'light';
}

export interface ThemeHandle {
  choice: ThemeChoice;
  /** What is actually on screen, with "system" already resolved. */
  mode: ThemeMode;
  set: (choice: ThemeChoice) => void;
  /** Light to dark and back, leaving "system" behind once it is used. */
  toggle: () => void;
}

export function useTheme(): ThemeHandle {
  const [choice, setChoice] = useState<ThemeChoice>(() => readStored());
  const [system, setSystem] = useState<ThemeMode>(() => systemMode());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(QUERY);
    const onChange = (): void => setSystem(media.matches ? 'dark' : 'light');
    onChange();
    // Safari below 14 has only the deprecated form.
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  const mode: ThemeMode = choice === 'system' ? system : choice;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const set = useCallback((next: ThemeChoice) => {
    setChoice(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // See readStored.
    }
  }, []);

  const toggle = useCallback(() => {
    setChoice((prev) => {
      const next: ThemeChoice =
        (prev === 'system' ? systemMode() : prev) === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // See readStored.
      }
      return next;
    });
  }, []);

  return useMemo(() => ({ choice, mode, set, toggle }), [choice, mode, set, toggle]);
}
