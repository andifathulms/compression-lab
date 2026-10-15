/**
 * The brand row.
 *
 * The app's name, what it does, and the chrome that is not a measurement:
 * which text is loaded, which coder is in view, how to share or download what
 * is on screen, and which ground to draw it on.
 *
 * It used to be a 127px masthead with the lead set at reading size, which a
 * returning visitor scrolled past on every visit, followed by a second band
 * for the readout. It is now one slim row. The lead is still the first
 * sentence on the page — it states the job, which is what five seconds buys —
 * but at label size under the name rather than as a headline.
 *
 * Sharing is two separate actions and always has been, and the reason is
 * stated on the control rather than in a tooltip: people paste their own
 * writing into this and a URL is a share surface.
 */

import { useEffect, useRef, useState } from 'react';
import { APP_PAGE } from '../copy.ts';
import { SAMPLES } from '../samples/index.ts';
import { count } from './format.ts';
import type { ThemeHandle } from './theme.ts';
import { ThemeToggle } from './ThemeToggle.tsx';
import { Mark } from './Mark.tsx';
import { CoderSwitch } from './Rail.tsx';
import type { CoderChoice } from '../state/appState.ts';
import './Masthead.css';

interface Props {
  sampleId: string | null;
  onSample: (id: string) => void;
  /** The reader's own text, if a sample displaced it. */
  restorable: string | null;
  onRestore: () => void;
  onCopyLink: (withText: boolean) => void;
  linkStatus: string | null;
  theme: ThemeHandle;
  coder: CoderChoice;
  onCoder: (coder: CoderChoice) => void;
  onDownload: () => void;
}

export function Masthead({
  sampleId,
  onSample,
  restorable,
  onRestore,
  onCopyLink,
  linkStatus,
  theme,
  coder,
  onCoder,
  onDownload,
}: Props): JSX.Element {
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  // A menu that cannot be dismissed by clicking away or by Escape is a trap,
  // and this one covers the sample chooser when it is open.
  useEffect(() => {
    if (!shareOpen) return;
    const onDown = (event: MouseEvent): void => {
      if (!shareRef.current?.contains(event.target as Node)) setShareOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setShareOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [shareOpen]);

  return (
    <header className="masthead">
      <div className="masthead-identity">
        <h1>
          <Mark size={20} />
          Compression Lab
        </h1>
        <p className="masthead-lead">{APP_PAGE.lead}</p>
      </div>

      <div className="masthead-tools">
        <div className="field field-sample">
          <label className="visually-hidden" htmlFor="sample">
            Text
          </label>
          <select id="sample" value={sampleId ?? ''} onChange={(e) => onSample(e.target.value)}>
            {sampleId === null ? <option value="">Your own text</option> : null}
            {/* The four Declaration texts say the same thing in four languages,
                which is the only reason the comparison chapter means anything.
                Grouped, that fact arrives before the reader opens the chooser
                a second time. */}
            <optgroup label="Texts">
              {SAMPLES.filter((s) => s.language === undefined).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="One text, four languages">
              {SAMPLES.filter((s) => s.language !== undefined).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Only while there is something to put back, and it says how much so
            the reader knows it is their paragraph and not a stale sample. */}
        {restorable !== null ? (
          <button type="button" className="restore" onClick={onRestore}>
            Restore your {count(restorable.length)} characters
          </button>
        ) : null}

        <CoderSwitch coder={coder} onCoder={onCoder} />

        <span className="masthead-divider" aria-hidden="true" />

        <div className="field share" ref={shareRef}>
          <button
            type="button"
            className="tool-button"
            aria-expanded={shareOpen}
            aria-haspopup="true"
            onClick={() => setShareOpen((open) => !open)}
          >
            <svg viewBox="0 0 16 16" className="glyph" aria-hidden="true" focusable="false">
              <path d="M6.6 9.4l2.8-2.8M7 4.6l1.1-1.1a2.6 2.6 0 013.7 3.7L10.7 8.3M9 11.4l-1.1 1.1a2.6 2.6 0 01-3.7-3.7L5.3 7.7" strokeLinecap="round" />
            </svg>
            <span className="tool-text">Copy link</span>
          </button>
          {shareOpen ? (
            <div className="share-menu" role="group" aria-label="Copy a link">
              <button
                type="button"
                className="share-option"
                onClick={() => {
                  onCopyLink(false);
                  setShareOpen(false);
                }}
              >
                <span className="share-option-title">Settings only</span>
                <span className="share-option-note">
                  Sample, order, coder, window and chapter. No text.
                </span>
              </button>
              <button
                type="button"
                className="share-option"
                onClick={() => {
                  onCopyLink(true);
                  setShareOpen(false);
                }}
              >
                <span className="share-option-title">Settings and the text</span>
                <span className="share-option-note">
                  Puts whatever is in the surface into the address bar.
                </span>
              </button>
            </div>
          ) : null}
        </div>

        {/* For the reader who came to check rather than to read. Nothing is
            uploaded: the file is built in the page and handed to the browser's
            own download, and the description says what it contains. */}
        <button
          type="button"
          className="tool-button"
          onClick={onDownload}
          aria-describedby="download-note"
          title="The staircase and all three coders, with the rules that produced them"
        >
          <svg viewBox="0 0 16 16" className="glyph" aria-hidden="true" focusable="false">
            <path d="M8 2.5v7.5M4.8 7L8 10.2 11.2 7M3 13h10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="tool-text">CSV</span>
        </button>
        <span className="visually-hidden" id="download-note">
          Downloads a CSV of the staircase and all three coders, with the rules that produced them.
        </span>

        <ThemeToggle theme={theme} />
      </div>

      <p className="masthead-status" role="status" aria-live="polite">
        {linkStatus}
      </p>
    </header>
  );
}
