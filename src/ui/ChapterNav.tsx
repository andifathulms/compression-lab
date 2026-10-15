/**
 * The chapter tabs.
 *
 * Five tabs in the order the argument runs, numbered because the order is the
 * content: the staircase builds on counting bits, the model chapter opens up
 * the staircase's rising line, and so on. The numbers are also the keys — 1 to
 * 5 jump straight to a chapter from anywhere that is not a text field.
 *
 * A real tablist: arrow keys move between tabs, and only the selected tab is
 * in the tab order, so the row costs a keyboard user one stop rather than five.
 */

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { CHAPTERS, type ChapterId } from '../state/chapter.ts';
import './ChapterNav.css';

interface Props {
  chapter: ChapterId;
  onChapter: (id: ChapterId) => void;
}

export function chapterTabId(id: ChapterId): string {
  return `chapter-tab-${id}`;
}

export function chapterPanelId(id: ChapterId): string {
  return `chapter-${id}`;
}

export function ChapterNav({ chapter, onChapter }: Props): JSX.Element {
  const refs = useRef<Partial<Record<ChapterId, HTMLButtonElement | null>>>({});
  const index = CHAPTERS.findIndex((c) => c.id === chapter);

  const onKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % CHAPTERS.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + CHAPTERS.length) % CHAPTERS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = CHAPTERS.length - 1;
    if (next === null) return;
    event.preventDefault();
    const id = CHAPTERS[next].id;
    onChapter(id);
    refs.current[id]?.focus();
  };

  // 1 to 5 from anywhere that is not taking typed input.
  useEffect(() => {
    const onDown = (event: globalThis.KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target !== null &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      const n = Number(event.key);
      if (Number.isInteger(n) && n >= 1 && n <= CHAPTERS.length) {
        onChapter(CHAPTERS[n - 1].id);
      }
    };
    document.addEventListener('keydown', onDown);
    return () => document.removeEventListener('keydown', onDown);
  }, [onChapter]);

  const current = CHAPTERS[index];

  return (
    <div className="chapters">
      <div className="chapter-tabs" role="tablist" aria-label="Chapters" onKeyDown={onKey}>
        {CHAPTERS.map((c, i) => (
          <button
            key={c.id}
            ref={(el) => {
              refs.current[c.id] = el;
            }}
            type="button"
            role="tab"
            id={chapterTabId(c.id)}
            className="chapter-tab"
            aria-selected={c.id === chapter}
            aria-controls={chapterPanelId(c.id)}
            tabIndex={c.id === chapter ? 0 : -1}
            onClick={() => onChapter(c.id)}
          >
            <span className="chapter-key" aria-hidden="true">
              {i + 1}
            </span>
            {c.label}
          </button>
        ))}
      </div>
      <p className="chapter-summary">{current.summary}</p>
    </div>
  );
}
