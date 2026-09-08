/**
 * The strings that appear both on a page and in its metadata.
 *
 * They used to be written twice: once in the component and once by hand in the
 * document head. They drifted, which is the failure mode that makes metadata
 * worth less than none — the app's description told a crawler "Entropy is not a
 * property of a text", a sentence that had moved to the staircase two changes
 * earlier, while the page itself opened with something else entirely.
 *
 * So there is one copy. The interface imports these; the build substitutes the
 * same values into the head of both documents. A description cannot drift from
 * a page it is generated from.
 *
 * This module is imported by `vite.config.ts` as well as by the app, so it must
 * stay free of anything that needs a DOM or a bundler: strings and nothing
 * else.
 */

export const SITE = {
  /** Canonical origin. Used for absolute URLs, which OG tags require. */
  origin: 'https://andifathulms.github.io',
  base: '/compression-lab/',
  name: 'Compression Lab',
  locale: 'en_GB',
} as const;

export const APP_PAGE = {
  title: 'Compression Lab — what a text costs',
  /**
   * The masthead's opening line, and the page's description. One sentence
   * carrying the verb, the object and the payoff, because that is all a search
   * result or a shared link has room for.
   */
  lead: 'Measure what a text costs to compress — and why that answer depends on the model.',
  path: '',
} as const;

export const ABOUT_PAGE = {
  title: 'Compression Lab — a better model has to be sent',
  lead:
    'Six models over one text, measured end to end: the entropy, the code stream, and the model a decoder needs.',
  path: 'about/',
} as const;

/** What the social card shows, described for anyone who cannot see it. */
export const OG_IMAGE_ALT =
  'The Compression Lab mark: a staircase of conditional entropy stepping down, with one riser in gold.';

/** Absolute URL for a page, which Open Graph requires. */
export function pageUrl(path: string): string {
  return `${SITE.origin}${SITE.base}${path}`;
}
