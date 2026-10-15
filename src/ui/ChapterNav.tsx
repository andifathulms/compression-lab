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
 *
 * On a phone the same tabs become a bar fixed to the bottom of the screen,
 * with an icon each and a "Text" button that goes back to the specimen. The
 * phone used to get every panel in one continuous scroll of about twenty
 * thousand pixels; a chapter is now one tap from anywhere.
 */

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { CHAPTERS, type ChapterId } from '../state/chapter.ts';
import './ChapterNav.css';

interface Props {
  chapter: ChapterId;
  onChapter: (id: ChapterId) => void;
  /** Back to the specimen. Only drawn on a phone, where it is a screen away. */
  onText: () => void;
}

const ICONS: Record<ChapterId | 'text', JSX.Element> = {
  text: <path d="M4 5h12M4 9h12M4 13h8" />,
  counting: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.5v4l2.5 1.5" />
    </>
  ),
  staircase: <path d="M3 16h4v-4h4V8h4V4h2" />,
  model: (
    <>
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <path d="M3 8h14M8 8v8" />
    </>
  ),
  coders: (
    <>
      <circle cx="10" cy="4.5" r="1.6" />
      <circle cx="5" cy="15" r="1.6" />
      <circle cx="15" cy="15" r="1.6" />
      <path d="M10 6.2v3M10 9.2l-4.2 4.3M10 9.2l4.2 4.3" />
    </>
  ),
  languages: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M3 10h14M10 3c2.5 2.5 2.5 11.5 0 14M10 3c-2.5 2.5-2.5 11.5 0 14" />
    </>
  ),
};

function Icon({ id }: { id: ChapterId | 'text' }): JSX.Element {
  return (
    <svg className="chapter-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {ICONS[id]}
    </svg>
  );
}

export function chapterTabId(id: ChapterId): string {
  return `chapter-tab-${id}`;
}

export function chapterPanelId(id: ChapterId): string {
  return `chapter-${id}`;
}

export function ChapterNav({ chapter, onChapter, onText }: Props): JSX.Element {
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
      <div className="chapter-bar">
      <button type="button" className="chapter-text" onClick={onText}>
        <Icon id="text" />
        Text
      </button>
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
            // Only the chapter in view is mounted, so only its tab can point
            // at a panel that exists.
            aria-controls={c.id === chapter ? chapterPanelId(c.id) : undefined}
            tabIndex={c.id === chapter ? 0 : -1}
            onClick={() => onChapter(c.id)}
          >
            <span className="chapter-key" aria-hidden="true">
              {i + 1}
            </span>
            <Icon id={c.id} />
            <span className="chapter-label">{c.label}</span>
            <span className="chapter-short" aria-hidden="true">
              {c.short}
            </span>
          </button>
        ))}
      </div>
      </div>
      <p className="chapter-summary">{current.summary}</p>
    </div>
  );
}
