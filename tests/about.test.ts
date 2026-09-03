/**
 * The way-in page publishes numbers, and numbers on a page that nothing checks
 * are the one place this project can quietly start lying.
 *
 * `about/index.html` draws its hero plot as hand-written SVG path coordinates
 * with the figures called out in text beside them. Every one of those figures
 * came out of this engine over a bundled sample, and nothing but this file
 * stops them drifting apart the next time a coder, a smoothing constant or a
 * serialisation format changes. The plot geometry is not asserted — a chart may
 * be redrawn — but every quantity the page states in words is.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { analyseText, runLz77, DEFAULT_LZ77 } from '../src/engine/index.ts';
import literary from '../src/samples/literary.txt?raw';
import udhrEn from '../src/samples/udhr-en.txt?raw';
import udhrId from '../src/samples/udhr-id.txt?raw';
import udhrDe from '../src/samples/udhr-de.txt?raw';
import udhrFi from '../src/samples/udhr-fi.txt?raw';

const page = readFileSync(
  fileURLToPath(new URL('../about/index.html', import.meta.url)),
  'utf8',
);

/** Every figure the page states, as it is written there. */
function statesFigure(text: string): boolean {
  return page.includes(text);
}

describe('the way-in page', () => {
  const analysis = analyseText(literary, false);

  it('states the sample it measured, at the size it measured', () => {
    expect(analysis.symbolCount).toBe(10652);
    expect(statesFigure('10,652 characters')).toBe(true);
  });

  it('states the entropy at both ends of the staircase', () => {
    expect(analysis.rows[0].entropyBits).toBeCloseTo(4.436, 3);
    expect(analysis.rows[5].entropyBits).toBeCloseTo(0.467, 3);
    // The caption and the accessible description both quote these.
    expect(statesFigure('4.44 bits at order 0 to 0.47 bits at order 5')).toBe(true);
    expect(statesFigure('>0.47<')).toBe(true);
  });

  it('states the total at every order, and the accessible description agrees', () => {
    const totals = analysis.rows.map((r) => Number(r.totalBits.toFixed(2)));
    expect(totals).toEqual([4.58, 4.5, 8.26, 18.74, 33.86, 49.31]);
    expect(
      statesFigure(
        '4.58 bits at order 0, falls to 4.50 at order 1, then rises to 8.26, 18.74, 33.86 and 49.31',
      ),
    ).toBe(true);
    expect(statesFigure('49.31 total')).toBe(true);
  });

  it('states the model description at every order', () => {
    const model = analysis.rows.map((r) => Number(r.modelBits.toFixed(2)));
    expect(model).toEqual([0.14, 0.98, 4.97, 15.05, 29.79, 44.98]);
    expect(statesFigure('0.14, 0.98, 4.97, 15.05, 29.79 and 44.98 bits')).toBe(true);
  });

  it('states the order that wins, and the number of contexts that loses', () => {
    expect(analysis.optimalOrder).toBe(1);
    expect(analysis.rows[5].contexts).toBe(6345);
    expect(statesFigure('order 1<span class="unit"> · 4.50 bits</span>')).toBe(true);
    expect(statesFigure('6,345 contexts')).toBe(true);
  });

  it('states the parallel corpus row the app measures', () => {
    const corpus: Array<[string, string]> = [
      [udhrId, 'Indonesian'],
      [udhrDe, 'German'],
      [udhrEn, 'English'],
      [udhrFi, 'Finnish'],
    ];
    for (const [text, name] of corpus) {
      const a = analyseText(text, false);
      const h0 = a.rows[0].entropyBits;
      const lz = runLz77(a, DEFAULT_LZ77).result.bitsPerSymbol;
      expect(statesFigure(`<th scope="row">${name}</th>`), name).toBe(true);
      expect(statesFigure(h0.toFixed(2)), `${name} H0`).toBe(true);
      expect(statesFigure(lz.toFixed(2)), `${name} LZ77`).toBe(true);
      expect(statesFigure((h0 - lz).toFixed(3)), `${name} margin`).toBe(true);
    }
  });

  it('does not claim the window size it did not measure at', () => {
    expect(DEFAULT_LZ77.windowSize).toBe(4096);
    expect(statesFigure('4,096-byte window')).toBe(true);
  });
});
