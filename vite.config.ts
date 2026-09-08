/// <reference types='vitest' />
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { ABOUT_PAGE, APP_PAGE, OG_IMAGE_ALT, SITE, pageUrl } from './src/copy.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Head metadata, generated from the same strings the pages render.
 *
 * The description in the app's head had drifted from the sentence the masthead
 * actually shows, which makes it worse than no description at all: it tells a
 * search result and a shared link something the page does not say. The fix is
 * not to correct it once but to stop it being written twice, so both documents
 * take their title, description and canonical URL from src/copy.ts, and so does
 * the interface.
 *
 * A built-in hook rather than a plugin — nothing new is installed for this.
 */
function metadata(): Plugin {
  return {
    name: 'compression-lab-metadata',
    transformIndexHtml(html, ctx) {
      const about = ctx.path.includes('about');
      const page = about ? ABOUT_PAGE : APP_PAGE;
      const url = pageUrl(page.path);
      const image = `${SITE.origin}${SITE.base}og.png`;
      return html
        .replaceAll('__TITLE__', page.title)
        .replaceAll('__DESCRIPTION__', page.lead)
        .replaceAll('__URL__', url)
        .replaceAll('__IMAGE__', image)
        .replaceAll('__IMAGE_ALT__', OG_IMAGE_ALT)
        .replaceAll('__SITE_NAME__', SITE.name)
        .replaceAll('__LOCALE__', SITE.locale);
    },
  };
}

// base is the repo path so GitHub Pages serves assets correctly.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/compression-lab/',
  plugins: [react(), metadata()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      // Two pages. The app is the root; `about/` is the way in, and it is a
      // static document with no bundle of its own beyond the shared CSS.
      input: {
        app: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about/index.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // A forked process per file. The timing test measures a 16 ms budget, and
    // sharing a worker with the round-trip suites leaves enough heap behind to
    // double its ninetieth percentile through garbage collection alone.
    // A forked process per file, one file at a time. The timing test measures
    // a 16 ms budget; sharing a worker with the round-trip suites leaves
    // enough heap behind to double its ninetieth percentile through garbage
    // collection alone, and running files in parallel has them competing for
    // the same cores.
    pool: 'forks',
    poolOptions: { forks: { isolate: true } },
    fileParallelism: false,
  },
});
