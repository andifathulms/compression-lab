/**
 * The adaptive learning curve, and the length sweep.
 *
 * Both are new claims the interface makes, so both need to be claims the test
 * suite checks. The learning curve asserts that adaptive coding is not free;
 * the sweep asserts that the optimal order moves with length. Neither is worth
 * drawing if the numbers behind it are not reconciled to the same engine the
 * rest of the app uses.
 */

import { describe, it, expect } from 'vitest';
import {
  analyseText,
  indexText,
  learningCurve,
  lengthSweep,
  toSymbols,
  ORDERS,
  buildModelsFromIndex,
  modelCostBits,
  modelLayout,
  contextBreakdown,
  type Order,
} from '../src/engine/index.ts';
import { sampleById } from '../src/samples/index.ts';

/* The bundled samples, so the numbers the tests assert are the numbers the
 * interface shows. */
const LITERARY = sampleById('literary')!.text;
const REPETITIVE = sampleById('repetitive')!.text;

function indexOf(text: string) {
  return indexText(toSymbols(text));
}

describe('the learning curve', () => {
  it('charges the adaptive model for its ignorance', () => {
    const curve = learningCurve(indexOf(LITERARY), 2);

    // The whole point: a model handed the finished distribution codes the text
    // more cheaply than one that had to learn it. If this were ever negative
    // the adaptive walk would be reading the future.
    expect(curve.learningBits).toBeGreaterThan(0);
    expect(curve.adaptiveCodeBits).toBeGreaterThan(curve.staticCodeBits);
  });

  it('charges the adaptive model for its alphabet, and nothing more', () => {
    const curve = learningCurve(indexOf(LITERARY), 3);

    // Adaptive transmits no counts, so its description is a small constant
    // beside the static table — but it is not zero, because the alphabet and
    // the symbol count really are sent.
    expect(curve.adaptiveModelBits).toBeGreaterThan(0);
    expect(curve.adaptiveModelBits).toBeLessThan(curve.staticModelBits / 10);
  });

  it('reconciles both sides to the staircase the app already draws', () => {
    const text = LITERARY;
    const n = toSymbols(text).length;
    const curve = learningCurve(indexOf(text), 2);

    const staticRows = analyseText(text, false).rows[2];
    const adaptiveRows = analyseText(text, true).rows[2];

    // Same quantity, computed twice by different paths. A breakdown that does
    // not reconcile is worse than no breakdown.
    expect(curve.staticCodeBits / n).toBeCloseTo(staticRows.codeBits, 9);
    expect(curve.adaptiveCodeBits / n).toBeCloseTo(adaptiveRows.codeBits, 9);
    expect(curve.staticModelBits / n).toBeCloseTo(staticRows.modelBits, 9);
    expect(curve.adaptiveModelBits / n).toBeCloseTo(adaptiveRows.modelBits, 9);
    expect(curve.staticRate).toBeCloseTo(staticRows.totalBits, 9);
    expect(curve.adaptiveRate).toBeCloseTo(adaptiveRows.totalBits, 9);
  });

  it('samples the ends exactly', () => {
    const n = toSymbols(LITERARY).length;
    const curve = learningCurve(indexOf(LITERARY), 1);
    expect(curve.samples[0].position).toBe(1);
    expect(curve.samples[curve.samples.length - 1].position).toBe(n);
    // The last sample is the final rate, so the plot and the figures beside it
    // cannot disagree.
    expect(curve.samples[curve.samples.length - 1].staticRate).toBeCloseTo(curve.staticRate, 9);
    expect(curve.samples[curve.samples.length - 1].adaptiveRate).toBeCloseTo(
      curve.adaptiveRate,
      9,
    );
  });

  it('reports a crossing only when adaptive holds the lead to the end', () => {
    for (const order of ORDERS) {
      const curve = learningCurve(indexOf(LITERARY), order);
      if (curve.crossing === null) {
        // No crossing claimed means adaptive did not finish ahead.
        expect(curve.adaptiveRate).toBeGreaterThanOrEqual(curve.staticRate);
      } else {
        expect(curve.adaptiveRate).toBeLessThan(curve.staticRate);
        expect(curve.crossing).toBeGreaterThan(0);
      }
    }
  });

  it('finds a crossing at high order, where the static table is ruinous', () => {
    // Order 4 on this text: the static description costs more than the code
    // stream it buys, so the model that transmits nothing has to win.
    const curve = learningCurve(indexOf(LITERARY), 4);
    expect(curve.crossing).not.toBeNull();
    expect(curve.adaptiveRate).toBeLessThan(curve.staticRate);
  });

  it('survives a text with one distinct symbol', () => {
    const curve = learningCurve(indexOf('aaaaaaaaaaaaaaaaaaaa'), 2);
    expect(Number.isFinite(curve.staticRate)).toBe(true);
    expect(Number.isFinite(curve.adaptiveRate)).toBe(true);
    expect(curve.learningBits).toBeGreaterThanOrEqual(0);
  });
});

describe('the length sweep', () => {
  it('measures prefixes of the text it was given', () => {
    const sweep = lengthSweep(LITERARY, false, 8);
    expect(sweep.points.length).toBeGreaterThan(4);

    const n = toSymbols(LITERARY).length;
    expect(sweep.points[sweep.points.length - 1].length).toBe(n);
    for (let i = 1; i < sweep.points.length; i++) {
      expect(sweep.points[i].length).toBeGreaterThan(sweep.points[i - 1].length);
    }
  });

  it('agrees with a direct analysis at every point it reports', () => {
    const sweep = lengthSweep(LITERARY, false, 6);
    const symbols = toSymbols(LITERARY);
    for (const point of sweep.points) {
      const direct = analyseText(symbols.slice(0, point.length).join(''), false);
      expect(point.optimalOrder).toBe(direct.optimalOrder);
      expect(point.bestTotalBits).toBeCloseTo(direct.rows[direct.optimalOrder].totalBits, 12);
    }
  });

  it('shows the optimum moving right as the text grows', () => {
    // The thesis, as a test. A short prefix cannot pay for a bigger model; a
    // long one can. If this ever fails the app's headline argument is wrong.
    const sweep = lengthSweep(LITERARY, false, 12);
    const first = sweep.points[0].optimalOrder;
    const last = sweep.points[sweep.points.length - 1].optimalOrder;
    expect(last).toBeGreaterThan(first);
  });

  it('declines to measure a text too short to say anything', () => {
    expect(lengthSweep('the cat sat on the mat.', false).points).toEqual([]);
  });

  it('runs over repetitive text without the optimum wandering backwards', () => {
    const sweep = lengthSweep(REPETITIVE, false, 10);
    // Not monotone in general, but the last point must be at least the first:
    // more text never makes a bigger model less affordable.
    const first = sweep.points[0].optimalOrder;
    const last = sweep.points[sweep.points.length - 1].optimalOrder;
    expect(last).toBeGreaterThanOrEqual(first);
  });
});

describe('the model description, taken apart', () => {
  it('reconciles the breakdown to the bytes actually written', () => {
    const index = indexOf(LITERARY);
    const models = buildModelsFromIndex(index);
    for (const order of ORDERS) {
      const model = models[order];
      const layout = modelLayout(model);
      // The sections must sum to the measurement, or the panel is decoration.
      expect(layout.totalBytes * 8, `order ${order}`).toBe(modelCostBits(model));
    }
  });

  it('reconciles the per-context costs to the counts section', () => {
    const index = indexOf(LITERARY);
    const order: Order = 3;
    const model = buildModelsFromIndex(index, order)[order];

    const layout = modelLayout(model);
    const counts = layout.sections.find((s) => s.label === 'counts')!;
    const breakdown = contextBreakdown(model);

    // The counts section is every context row plus the varint holding how many
    // rows there are.
    expect(breakdown.totalBytes).toBeLessThan(counts.bytes);
    expect(counts.bytes - breakdown.totalBytes).toBeLessThanOrEqual(5);
    expect(breakdown.totalContexts).toBe(model.contextCount);
  });

  it('finds the singletons that drive the model curve upward', () => {
    const index = indexOf(LITERARY);
    const model = buildModelsFromIndex(index, 3)[3];
    const breakdown = contextBreakdown(model);

    // The claim the panel makes: at order 3 most contexts are seen once.
    expect(breakdown.singletons).toBeGreaterThan(breakdown.totalContexts / 3);
    expect(breakdown.singletonBytes).toBeGreaterThan(0);
    expect(breakdown.rows.length).toBeGreaterThan(0);
  });

  it('reports nothing for an adaptive model, which has no counts to report', () => {
    const analysis = analyseText(LITERARY, true);
    expect(contextBreakdown(analysis.models[2]).totalContexts).toBe(0);
  });
});
