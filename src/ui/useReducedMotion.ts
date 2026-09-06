/**
 * Whether the reader has asked for reduced motion, and kept up to date.
 *
 * The CSS side of this is settled: every duration in the app comes from a
 * token, and `prefers-reduced-motion: reduce` sets all six of them to zero. But
 * the interval zoom is a hand-rolled rAF loop, so it has to ask in JavaScript,
 * and it was asking with a bare `matchMedia(...).matches` read during render —
 * which answers correctly at load and then never changes its mind. Turn the
 * setting on with the page open and the zoom kept running until something
 * unrelated caused a re-render.
 *
 * The theme hook next door already subscribes properly. This is the same
 * pattern, for the other media query the app cares about.
 */

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function current(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(current);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(QUERY);
    const onChange = (): void => setReduced(media.matches);
    onChange();
    // Safari below 14 has only the deprecated form.
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  return reduced;
}

/**
 * The interval zoom's duration, read from the token that documents it.
 *
 * `--d-interval` is the design system's word on how long this animation lasts,
 * and it was also written out as a bare 420 in the animation itself. Two
 * numbers for one decision, and only one of them was under the reduced-motion
 * media query.
 */
export function intervalDurationMs(fallback = 420): number {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--d-interval')
    .trim();
  const ms = raw.endsWith('ms')
    ? Number.parseFloat(raw)
    : raw.endsWith('s')
      ? Number.parseFloat(raw) * 1000
      : Number.NaN;
  return Number.isFinite(ms) ? ms : fallback;
}
