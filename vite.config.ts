/// <reference types='vitest' />
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));

// base is the repo path so GitHub Pages serves assets correctly.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/compression-lab/',
  plugins: [react()],
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
