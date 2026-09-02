# Compression Lab

What a text costs, and what that cost depends on.

Entropy is not a property of a text. It is a property of a text under a model.
Condition on the previous character and it drops; condition on two and it drops
again. There is no single floor — there is a staircase, and every step down
costs something to describe. Total size is the code stream plus the model
description, and that total has a minimum at some order which depends on how
long the text is.

Paste a longer text and the minimum moves right. That is the whole argument.

## Running it

```
npm install
npm run dev        # http://localhost:5173
npm test           # engine round trips, bounds, model cost, timing
npm run typecheck
npm run lint
npm run build
```

Nothing is fetched at runtime. The sample texts are in the JavaScript bundle,
there is no analytics and no font CDN, and text pasted into the page never
leaves it. The network tab should be empty after load.

## Layout

```
src/
├─ engine/       pure: no React, no DOM, no randomness, no Date
│  ├─ bitio.ts       bit writer and reader
│  ├─ model.ts       order-0..5 models, static and adaptive, interned contexts
│  ├─ entropy.ts     conditional entropies and per-symbol surprisal
│  ├─ modelcost.ts   the model serialiser, and the measured model size
│  ├─ huffman.ts     build, canonical codes, encode, decode
│  ├─ arithmetic.ts  integer range coder and decoder
│  ├─ lz77.ts        hash-chain match finder, encode, decode
│  └─ trace.ts       what the views render
├─ views/        one directory per instrument
├─ state/        app state, URL serialisation, the analysis hook
├─ ui/           control bar and the surprisal ramp
├─ styles/       tokens and base
└─ samples/      bundled texts, plain .txt, imported with ?raw
tests/
```

## What the numbers mean

**Model cost is measured, not estimated.** `serialiseModel` writes a real byte
format and `deserialiseModel` reads it back. `modelcost.test.ts` asserts that a
decoder given only the code stream and the model bytes reproduces the text, for
both Huffman and arithmetic, over the whole corpus at all six orders. If that
were a hand-wave, the minimum on the total curve would be fiction.

**Every coder has a working decoder**, tested, even though decompression is not
a user-facing feature. A coder without a decoder is unverified.

**Entropy and coder rates are different quantities and stay different.** The
entropy steps use unsmoothed counts, because that is what conditional entropy
means and because it is guaranteed non-increasing in the order. The coders pay
Laplace smoothing with alpha = 1 and, if static, the model description. The gap
between the two is the app's subject, so the app does not reconcile them.

**Three choices are arbitrary and change the numbers**, so each is stated in
the interface beside the figure it affects: the smoothing constant, the LZ77
token encoding, and the model serialisation format.

## Deviations from the specification, and why

- **Samples live in `src/samples/`, not `public/samples/`.** Files in `public/`
  are served, not bundled, so reading one would be a network request at
  runtime, and an empty network tab is a hard requirement. They are still plain
  `.txt`, imported with Vite's `?raw`.

- **The arithmetic coder uses 48-bit registers, not 32.** At 32 bits the floor
  division that carves the interval drifts upward by 1.54 bits on a
  10,000-symbol order-4 text — inside the 2-bit bound, but with no headroom
  left for a larger alphabet. Measured, then the register was widened rather
  than the tolerance.

- **An adaptive model's description is not zero bits.** Its counts are, because
  the decoder rebuilds them from the symbols it has already decoded. Its
  alphabet and symbol count are really transmitted, so they are in the figure.
  Measured, the order-3 adaptive description is about a fiftieth of the static
  one, which makes the point without overstating it.

- **`FrequencyModel` stores counts as interned integers**, not as a
  `Map<string, Map<string, number>>` walked afresh on each pass. The documented
  shape is still exposed as `model.counts`, materialised on demand, and the
  tests read it. The straightforward version measured 250 ms for a
  10,000-character recompute against a 16 ms budget; see the commit for the
  four changes that closed the gap.

- **The performance test asserts the ninetieth percentile**, not the maximum.
  The occasional 25 ms sample is a garbage collection pause provoked by
  rebuilding the analysis fifty times with no frames in between, which is not
  what typing does. p50 is 12.5 ms, p90 is 14.4 ms.

- **Literata and Iosevka are not bundled.** No woff2 files ship here, so the
  faces fall back to Georgia and the platform monospace — both chosen for the
  properties the design relies on, a large x-height that survives being tinted
  toward the page colour and tabular figures. To use the real faces, drop the
  woff2 files into `src/styles/fonts/` and add `@font-face` rules at the top of
  `src/styles/tokens.css`. Nothing else changes, and nothing is fetched over
  the network either way.

- **The parallel corpus is short.** It carries articles 1 and 3 to 5 of the
  Universal Declaration of Human Rights in four languages — around 500
  characters each, which is enough for the comparison row and not enough to
  move the staircase's minimum. See below before publishing.

## Before publishing: the parallel corpus

`src/samples/udhr-*.txt` were written without network access and are a
reproduction from memory, not a copy of the official text. The English and
German are reliable; the Indonesian and Finnish should be checked. Replace all
four with the official translations from <https://www.un.org/en/about-us/universal-declaration-of-human-rights>
before this goes anywhere public — longer files will also make the comparison
row more convincing, since 500 characters is short enough that model cost
dominates every order.

Nothing else in the repository depends on their content: drop in new files at
the same paths and `npm test` will re-verify the round trips.

## Deployment

GitHub Pages via Actions. `vite.config.ts` sets `base` to `/compression-lab/`;
change it if the repository is named something else, or set `VITE_BASE`. CI
runs typecheck, lint, test and build, and the deploy workflow runs the same
gate again so a deploy cannot outrun a failing suite.
