/**
 * The ground control.
 *
 * Three settings rather than a switch, because "system" is a real answer and
 * a two-state toggle forces a person who has already told their machine what
 * they want to tell this page as well. The icons are drawn inline: an
 * icon font would be a network request and a sprite sheet would be a build
 * step, and there are three of them.
 */

import type { ThemeChoice, ThemeHandle } from './theme.ts';

const OPTIONS: Array<{ value: ThemeChoice; label: string }> = [
  { value: 'light', label: 'Paper' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Bench' },
];

export function ThemeToggle({ theme }: { theme: ThemeHandle }): JSX.Element {
  return (
    <div className="segmented segmented-quiet" role="group" aria-label="Ground">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented-item"
          aria-pressed={theme.choice === option.value}
          onClick={() => theme.set(option.value)}
          title={
            option.value === 'system'
              ? 'Follow the operating system'
              : option.value === 'light'
                ? 'The paper ground'
                : 'The dark ground'
          }
        >
          <Glyph choice={option.value} />
          <span className="segmented-text">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function Glyph({ choice }: { choice: ThemeChoice }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" className="glyph" aria-hidden="true" focusable="false">
      {choice === 'light' ? (
        <>
          <circle cx="8" cy="8" r="3.2" />
          <g strokeLinecap="round">
            <path d="M8 1.2v1.8M8 13v1.8M1.2 8h1.8M13 8h1.8M3.2 3.2l1.3 1.3M11.5 11.5l1.3 1.3M12.8 3.2l-1.3 1.3M4.5 11.5l-1.3 1.3" />
          </g>
        </>
      ) : null}
      {choice === 'dark' ? (
        <path d="M13.4 9.6A5.8 5.8 0 0 1 6.4 2.6a5.9 5.9 0 1 0 7 7Z" />
      ) : null}
      {choice === 'system' ? (
        <>
          <rect x="1.6" y="2.6" width="12.8" height="9" rx="1.4" />
          <path d="M5.6 13.4h4.8" strokeLinecap="round" />
        </>
      ) : null}
    </svg>
  );
}
