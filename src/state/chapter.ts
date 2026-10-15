/**
 * Which chapter of the apparatus is in view.
 *
 * The instruments used to be one column of eight panels and about 7,700
 * pixels, with nothing to say where a reader was or what was left — and the
 * staircase, which is the app's centre, started eleven hundred pixels down,
 * under a worked example. They are now five chapters, in the order the
 * argument runs, and the app opens on the staircase.
 *
 * The chapter lives in the URL fragment rather than in AppState. The query
 * string describes a measurement — sample, order, coder — and a chapter is
 * where you are standing to look at it. A fragment also gives every chapter a
 * plain deep link, #staircase, which is what someone sharing one wants.
 *
 * Only the chapter in view is mounted. That is a performance decision as much
 * as a visual one: every keystroke in the specimen recomputes the analysis,
 * and four hidden chapters re-rendering against it were work nobody could see.
 */

import { useCallback, useEffect, useState } from 'react';
import { APP_PAGE } from '../copy.ts';

export type ChapterId = 'counting' | 'staircase' | 'model' | 'coders' | 'languages';

export interface Chapter {
  id: ChapterId;
  /** The tab's words. Short, because five of them share one row. */
  label: string;
  /** One line under the tab row saying what the chapter is for. */
  summary: string;
}

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'counting',
    label: 'Counting bits',
    summary: 'One character, worked all the way through. Every figure on the page is a sum of this.',
  },
  {
    id: 'staircase',
    label: 'The staircase',
    // The app's own lead. It is the chapter that answers it.
    summary: APP_PAGE.lead,
  },
  {
    id: 'model',
    label: 'Model cost',
    summary: 'What the model description is made of, how its minimum moves, and what adaptive saves.',
  },
  {
    id: 'coders',
    label: 'The coders',
    summary: 'What Huffman, arithmetic coding and LZ77 actually achieve on this text.',
  },
  {
    id: 'languages',
    label: 'Languages',
    summary: 'One document in four languages, and the two kinds of redundancy it carries.',
  },
];

export const DEFAULT_CHAPTER: ChapterId = 'staircase';

function fromHash(hash: string): ChapterId | null {
  const id = hash.replace(/^#/, '');
  return CHAPTERS.some((c) => c.id === id) ? (id as ChapterId) : null;
}

export function useChapter(): [ChapterId, (id: ChapterId) => void] {
  const [chapter, setChapter] = useState<ChapterId>(() =>
    typeof window === 'undefined' ? DEFAULT_CHAPTER : fromHash(window.location.hash) ?? DEFAULT_CHAPTER,
  );

  // Back, forward and a pasted link all arrive as a hash change. An anchor
  // that is not a chapter, such as the skip link, is left alone.
  useEffect(() => {
    const onHash = (): void => {
      const next = fromHash(window.location.hash);
      if (next !== null) setChapter(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((id: ChapterId) => {
    setChapter(id);
    // Replaced rather than pushed, the same way the query string is: a reader
    // flicking between tabs should not have to press back five times to leave.
    const url = `${window.location.pathname}${window.location.search}#${id}`;
    window.history.replaceState(null, '', url);
  }, []);

  return [chapter, go];
}
