/**
 * The maker's mark.
 *
 * A quiet credit at the foot of the page, in the chrome voice rather than the
 * instrument voice: it is not a reading, so it takes no figure size and no
 * coder colour. Everything identifying lives in the one array below, so the
 * links are changed in a single place.
 *
 * The year is computed at render, in the mono face with tabular figures, like
 * every other numeral in the app.
 */

import './MakerSignature.css';

const MAKER = {
  name: 'Andi Fathul Mukminin',
  portfolio: 'https://andifathulms.github.io/en/',
} as const;

interface MakerLink {
  label: string;
  href: string;
  icon: JSX.Element;
}

const LINKS: MakerLink[] = [
  {
    label: 'Portfolio',
    href: MAKER.portfolio,
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" />
      </>
    ),
  },
  {
    label: 'GitHub',
    href: 'https://github.com/andifathulms',
    icon: (
      <path
        fill="currentColor"
        stroke="none"
        d="M12 2.2a9.8 9.8 0 0 0-3.1 19.1c.49.09.67-.21.67-.47l-.01-1.83c-2.73.59-3.3-1.16-3.3-1.16-.45-1.13-1.09-1.43-1.09-1.43-.89-.61.07-.6.07-.6.98.07 1.5 1.01 1.5 1.01.88 1.5 2.3 1.07 2.86.82.09-.64.34-1.07.62-1.32-2.18-.25-4.47-1.09-4.47-4.85 0-1.07.38-1.95 1.01-2.64-.1-.25-.44-1.25.1-2.61 0 0 .82-.26 2.7 1.01a9.4 9.4 0 0 1 4.92 0c1.88-1.27 2.7-1.01 2.7-1.01.54 1.36.2 2.36.1 2.61.63.69 1.01 1.57 1.01 2.64 0 3.77-2.3 4.6-4.49 4.84.35.31.67.91.67 1.84l-.01 2.72c0 .26.18.57.68.47A9.8 9.8 0 0 0 12 2.2Z"
      />
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/andifathulmukminin/',
    icon: (
      <path
        fill="currentColor"
        stroke="none"
        d="M4.98 3.5a2.02 2.02 0 1 0 0 4.04 2.02 2.02 0 0 0 0-4.04ZM3.2 9.06h3.56V21H3.2V9.06Zm5.81 0h3.41v1.63h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.26 2.37 4.26 5.45V21h-3.55v-5.99c0-1.43-.03-3.27-1.99-3.27-2 0-2.3 1.56-2.3 3.17V21H9.01V9.06Z"
      />
    ),
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/andifathulms/',
    icon: (
      <>
        <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" />
        <circle cx="12" cy="12" r="4.1" />
        <circle cx="17.1" cy="6.9" r="1.15" fill="currentColor" stroke="none" />
      </>
    ),
  },
];

export function MakerSignature(): JSX.Element {
  const year = new Date().getFullYear();

  return (
    <div className="maker">
      <p className="maker-line">
        Designed &amp; built by{' '}
        <a
          className="maker-name"
          href={MAKER.portfolio}
          target="_blank"
          rel="noopener noreferrer"
        >
          {MAKER.name}
        </a>{' '}
        · <span className="data maker-year">© {year}</span>
      </p>

      <ul className="maker-links">
        {LINKS.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              title={link.label}
            >
              <svg
                className="maker-icon"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
                focusable="false"
              >
                {link.icon}
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
