import { describe, it, expect } from 'vitest';
import { analyseText, runLz77, DEFAULT_LZ77 } from '../src/engine/index.ts';
import { PARALLEL_SAMPLES, SAMPLES } from '../src/samples/index.ts';

describe('the samples', () => {
  it('span the space: prose, repetition and noise sit in different regimes', () => {
    const by = (id: string) => analyseText(SAMPLES.find((s) => s.id === id)!.text, false);

    const prose = by('literary');
    const repetitive = by('repetitive');
    const random = by('random');

    // Prose: order-0 entropy is high, conditioning drops it a lot.
    expect(prose.rows[0].entropyBits).toBeGreaterThan(4);
    expect(prose.rows[2].entropyBits).toBeLessThan(prose.rows[0].entropyBits - 1);

    // Repetition: low even at order 0, and near nothing once conditioned.
    expect(repetitive.rows[0].entropyBits).toBeLessThan(prose.rows[0].entropyBits);
    expect(repetitive.rows[2].entropyBits).toBeLessThan(0.2);

    // Noise: uniform over 27 symbols is log2(27) = 4.75 at order 0.
    expect(random.rows[0].entropyBits).toBeGreaterThan(4.5);
    // Its conditional entropy does fall with order, and that is not structure:
    // 27^2 contexts over 3,000 characters means the order-2 model has a
    // handful of observations each and is fitting noise. The staircase tells
    // the difference, because describing that model costs far more than it
    // saves — the total rises at every order and the minimum stays at 0.
    expect(random.optimalOrder).toBe(0);
    for (let k = 1; k < 6; k++) {
      expect(random.rows[k].totalBits, `random order ${k}`).toBeGreaterThan(
        random.rows[k - 1].totalBits,
      );
    }
  });

  it('the default sample is long enough to put the minimum off order 0', () => {
    // The headline moment: for this text, at this length, some order above
    // zero pays for itself. A shorter paste moves it back down.
    const prose = analyseText(SAMPLES.find((s) => s.id === 'literary')!.text, false);
    expect(prose.optimalOrder).toBeGreaterThan(0);
    const half = analyseText(prose.text.slice(0, 2000), false);
    expect(half.optimalOrder).toBe(0);
  });

  it('LZ77 lands below the order-0 entropy on repetitive text', () => {
    // The result that looks like a paradox if you believe in a single floor.
    const analysis = analyseText(SAMPLES.find((s) => s.id === 'repetitive')!.text, false);
    const lz = runLz77(analysis, DEFAULT_LZ77);
    expect(lz.result.bitsPerSymbol).toBeLessThan(analysis.rows[0].entropyBits);
    expect(lz.result.modelBits).toBe(0);
  });

  it('the parallel corpus is parallel: four texts, thirty articles each', () => {
    // Structural, not empirical. What the margins turn out to be is a finding
    // and belongs in the interface; that the four texts say the same thing is
    // a precondition for the comparison meaning anything at all.
    expect(PARALLEL_SAMPLES.length).toBe(4);
    const lengths = PARALLEL_SAMPLES.map((s) => s.text.length);
    expect(Math.max(...lengths) / Math.min(...lengths)).toBeLessThan(1.5);
    for (const sample of PARALLEL_SAMPLES) {
      const headings = sample.text.match(
        /^(Article \d+|Pasal \d+|Artikel \d+|\d+\. artikla\.?)$/gm,
      );
      expect(headings?.length, sample.id).toBe(30);
    }
  });
});
