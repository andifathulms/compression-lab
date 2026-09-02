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
import type { ThemeHandle } from './theme.ts';
import { ThemeToggle } from './ThemeToggle.tsx';
import './Masthead.css';

interface Props {
  sampleId: string | null;
  onSample: (id: string) => void;
  onCopyLink: (withText: boolean) => void;
  linkStatus: string | null;
  theme: ThemeHandle;
}

export function Masthead({
  sampleId,
  onSample,
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
        <h1>Compression Lab</h1>
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
            {SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

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
