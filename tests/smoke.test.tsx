/**
 * Renders the whole app to a string. It catches the class of mistake a type
 * checker cannot — an undefined read during the first render, a bad index into
 * a trace — without pulling in a DOM implementation the engine does not need.
 */
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '../src/App.tsx';
import { SAMPLES } from '../src/samples/index.ts';

describe('the app', () => {
  it('renders', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Compression Lab');
    expect(html).toContain('The staircase');
    expect(html).toContain('bits per symbol');
  });

  it('every bundled sample is non-empty and within the cap', () => {
    for (const sample of SAMPLES) {
      expect(sample.text.length, sample.id).toBeGreaterThan(200);
      expect(sample.text.length, sample.id).toBeLessThan(200_000);
    }
  });
});
