/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base is the repo path so GitHub Pages serves assets correctly.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/compression-lab/',
  plugins: [react()],
  build: { target: 'es2022', assetsInlineLimit: 0 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
