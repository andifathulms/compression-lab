/**
 * What adaptive coding costs.
 *
 * The app has a standing commitment that a high-order model must never appear
 * free, because a model that looks free makes higher orders look strictly
 * better, which is false. The adaptive toggle was quietly breaking it: flip it
 * and the model description drops to a few dozen bytes, the order-5 total
 * falls off a cliff, and the honest conclusion a reader draws is that high
 * orders are free after all.
 *
 * They are not. An adaptive model transmits no counts, but it starts ignorant.
 * The first characters are charged at close to log2 of the alphabet size
 * because the model has seen nothing, and it stays behind a static model that
 * was handed the finished distribution until it has learned enough to make up
 * the difference. Where it makes it up is a real, measurable position in the
 * text, and it moves with the order and the alphabet.
 *
 * So the comparison drawn here is total against total, both sides complete:
 *
 *   static    the whole serialised count table, paid before the first
 *             character, plus -log2 p at every position under a model that
 *             already knows the answer
 *   adaptive  its own description — alphabet and symbol count, which really
 *             are transmitted — plus -log2 p at every position under a model
 *             that only knows what it has already seen
 *
 * Neither side is given anything the other pays for. The crossing is the
 * answer to "when does adaptive start winning", and for a short enough text
 * there is no crossing at all, which is the same claim the staircase makes
 * about model order and is worth being able to see twice.
 */

import { adaptiveSurprisals, surprisals } from './entropy.ts';
import {
  buildModelsFromIndex,
  emptyModel,
  type FrequencyModel,
  type Order,
  type TextIndex,
} from './model.ts';
import { modelCostBits } from './modelcost.ts';

export interface LearningSample {
  /** Symbols coded so far. */
  position: number;
  /** Cumulative bits per symbol under the static model, description included. */
  staticRate: number;
  /** Cumulative bits per symbol under the adaptive model, description included. */
  adaptiveRate: number;
}

export interface LearningCurve {
  order: Order;
  samples: LearningSample[];
  /**
   * The first position after which adaptive is cheaper and stays cheaper.
   * Null when it never gets there within this text — which is the answer for
   * a short text, and is not a failure of the measurement.
   */
  crossing: number | null;
  /** The static model's serialised description, in bits. */
  staticModelBits: number;
  /** The adaptive model's, which is alphabet and count and nothing else. */
  adaptiveModelBits: number;
  /** Code stream only, both sides, in bits. */
  staticCodeBits: number;
  adaptiveCodeBits: number;
  /**
   * What ignorance cost: the extra code bits adaptive spent relative to a
   * model that was handed the distribution. Always positive in practice; it is
   * the price of transmitting nothing.
   */
  learningBits: number;
  /** Final totals, bits per symbol, both description-inclusive. */
  staticRate: number;
  adaptiveRate: number;
}

/**
 * Both walks over the same text at one order.
 *
 * Two models are built here rather than taken from the analysis, because the
 * analysis holds whichever kind the toggle selected and this view needs both
 * at once. That is the real cost of the view: one extra model build per order
 * inspected.
 */
export function learningCurve(
  index: TextIndex,
  order: Order,
  sampleCount = 240,
): LearningCurve {
  const n = index.symbols.length;

  const staticModel: FrequencyModel = buildModelsFromIndex(index, order)[order];
  const learner = emptyModel(index.alphabet, order, index.contexts[order]);
  learner.symbolCount = n;

  const staticBits = surprisals(index, staticModel);
  // Consumes `learner`: it finishes the walk holding the whole text's counts,
  // which is exactly what a decoder would also hold by then.
  const adaptiveBits = adaptiveSurprisals(index, learner);

  const staticModelBits = modelCostBits(staticModel);
  const adaptiveModelBits = modelCostBits(learner);

  const samples: LearningSample[] = [];
  let staticRunning = staticModelBits;
  let adaptiveRunning = adaptiveModelBits;
  let crossing: number | null = null;
  let behindSince: number | null = null;

  // Sampled for the plot, accumulated over every position: a curve drawn from
  // every 40th character would put the crossing in the wrong place.
  const stride = n > sampleCount ? Math.ceil(n / sampleCount) : 1;

  for (let i = 0; i < n; i++) {
    staticRunning += staticBits[i];
    adaptiveRunning += adaptiveBits[i];
    const position = i + 1;

    if (adaptiveRunning < staticRunning) {
      if (behindSince === null) behindSince = position;
    } else {
      behindSince = null;
    }

    if (i % stride === 0 || i === n - 1) {
      samples.push({
        position,
        staticRate: staticRunning / position,
        adaptiveRate: adaptiveRunning / position,
      });
    }
  }

  // Only a lead held to the end counts. An adaptive model can nose ahead early
  // on a lucky run and fall back, and reporting that as the crossing would be
  // reporting noise.
  if (behindSince !== null) crossing = behindSince;

  let staticCodeBits = 0;
  let adaptiveCodeBits = 0;
  for (let i = 0; i < n; i++) {
    staticCodeBits += staticBits[i];
    adaptiveCodeBits += adaptiveBits[i];
  }

  return {
    order,
    samples,
    crossing,
    staticModelBits,
    adaptiveModelBits,
    staticCodeBits,
    adaptiveCodeBits,
    learningBits: adaptiveCodeBits - staticCodeBits,
    staticRate: n > 0 ? (staticModelBits + staticCodeBits) / n : 0,
    adaptiveRate: n > 0 ? (adaptiveModelBits + adaptiveCodeBits) / n : 0,
  };
}
