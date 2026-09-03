/**
 * The masthead.
 *
 * The app's name, its claim, and the chrome that is not a measurement: which
 * text is loaded, how to share it, and which ground to draw it on. The claim
 * is here rather than in a paragraph further down because it is the whole
 * argument — everything below it is the demonstration.
 *
 * Sharing is two separate actions and always has been, and the reason is
 * stated on the control rather than in a tooltip: people paste their own
 * writing into this and a URL is a share surface.
 */

import { useEffect, useRef, useState } from 'react';
import { SAMPLES } from '../samples/index.ts';
import { count } from './format.ts';
import type { ThemeHandle } from './theme.ts';
import { ThemeToggle } from './ThemeToggle.tsx';
import { Mark } from './Mark.tsx';
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
}

export function Masthead({
  sampleId,
  onSample,
  restorable,
  onRestore,
  onCopyLink,
  linkStatus,
  theme,
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
          <Mark />
          Compression Lab
        </h1>
        <p className="masthead-claim">
          Entropy is not a property of a text. It is a property of a text{' '}
          <em>under a model</em>.
        </p>
      </div>

      <div className="masthead-tools">
        <div className="field">
          <label className="label" htmlFor="sample">
            Text
          </label>
          <select id="sample" value={sampleId ?? ''} onChange={(e) => onSample(e.target.value)}>
            {sampleId === null ? <option value="">Your own text</option> : null}
            {/* The four Declaration texts say the same thing in four languages,
                which is the only reason the comparison row means anything. Flat
                in a list of nine that fact arrives late; grouped, it arrives
                before the reader opens the chooser a second time. */}
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
          <div className="field">
            <span className="label" aria-hidden="true">
              Your text
            </span>
            <button type="button" className="restore" onClick={onRestore}>
              Restore {count(restorable.length)} characters
            </button>
          </div>
        ) : null}

        <div className="field share" ref={shareRef}>
          <span className="label" aria-hidden="true">
            Share
          </span>
          <button
            type="button"
            aria-expanded={shareOpen}
            aria-haspopup="true"
            onClick={() => setShareOpen((open) => !open)}
          >
            Copy link
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
                  Sample, order, coder and window. No text.
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

        <div className="field">
          <span className="label" aria-hidden="true">
            Ground
          </span>
          <ThemeToggle theme={theme} />
        </div>
      </div>

      <p className="masthead-status" role="status" aria-live="polite">
        {linkStatus}
      </p>
    </header>
  );
}
