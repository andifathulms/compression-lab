# Portfolio context — Compression Lab

Raw material for a client-facing case study. Every figure below was read out of this
repository on 2026-09-03; nothing here is estimated.

---

## 1. One-line summary

An interactive web lab that shows what a piece of text actually costs to store, and how
that cost changes depending on how much the compressor is allowed to remember about the
text — with every number computed live in the browser from code written from scratch.

## 2. The problem

Almost every explanation of data compression teaches three algorithms and implies there is
a single "entropy floor" they all approach. That is wrong, and the wrongness is the
interesting part: entropy is not a property of a text, it is a property of a text *under a
model*. Condition on the previous character and the cost drops; condition on two and it
drops again — but each step down costs something to describe, and that description has to
be shipped with the data. So total size is code stream plus model description, and that
total has a minimum at some model order which moves depending on how long the text is.

Existing explainers hide this because they never count the model. Compression Lab exists to
make the trade-off visible: paste a longer text and the optimal model order moves right.
That single moment is the argument, delivered without a paragraph.

**Who it is for:** students and self-taught engineers learning information theory, people
who half-remember Huffman from a course, and technical readers who want to see a claim
measured instead of asserted. It is also a portfolio piece demonstrating that the maker can
build correct algorithmic software and explain it.

## 3. Role

Solo project. Sole author across all 41 commits (Andi Fathul Mukminin), with Claude Code
used as a pair-programming assistant (commits carry a `Co-Authored-By` trailer).

**Written from scratch, nothing borrowed:**
- The entire compression engine — bit I/O, order-0..5 frequency models, conditional
  entropy, Huffman (build, canonical codes, encoder *and* decoder), an integer arithmetic
  range coder and decoder, LZ77 with a hash-chain match finder and decoder, and the model
  serialiser/deserialiser.
- All six visualizations, drawn as bespoke SVG — no charting library.
- The design system: CSS custom-property tokens, two themes, self-hosted variable fonts.
- The test suite, the CI/deploy pipeline, the product and design documents.

**Used as-is:** React 18 + React DOM, Vite, TypeScript, Vitest, ESLint, Testing Library,
and two open-licensed typefaces (Literata, JetBrains Mono) subsetted and vendored locally.
Sample texts are public-domain sources (a literary passage; the official UDHR translations
in English, Indonesian, German and Finnish).

There is deliberately **no compression library, no entropy library and no chart library** in
the dependency tree — importing one would defeat the point of the project.

## 4. Technical approach

**A pure engine, separated hard from the UI.** `src/engine/` (~2,300 lines) imports nothing
— no React, no DOM, no `Math.random`, no `Date`. It runs unmodified under a plain Node test
runner. That separation is what makes the numbers testable independently of anything that
draws them, and it is why the correctness claims in the interface can be trusted.

**Every coder has a working decoder, and it is tested.** Decompression is not a user-facing
feature, but a coder without a decoder is unverified — and the app's whole claim is that its
numbers are real. 64 tests cover round trips over a corpus that includes the empty string,
a single character, a repeated character, all-distinct characters, text outside the Basic
Multilingual Plane, and every bundled sample.

**Model cost is measured, never estimated.** `serialiseModel` writes a real byte format that
`deserialiseModel` reads back; the test suite asserts that a decoder given *only* the code
stream and the model bytes reproduces the original text, for both Huffman and arithmetic, at
all six orders. Model cost in the UI is literally `modelBytes.length * 8`. If this were a
formula or a guess, the minimum on the app's central chart would be fiction.

**Traces, not re-simulation.** Each coder emits a trace record alongside its output — the
Huffman merge sequence, the LZ77 window steps, the arithmetic interval state per symbol. The
views render the trace and never re-run the algorithm themselves, so the picture and the
computation cannot drift apart.

**Arithmetic coding as an integer range coder, with an honest idealisation on top.** A naive
floating-point `[0,1)` implementation breaks after about fifteen symbols, so the engine uses
integer registers with renormalization and underflow handling. The zooming interval the user
watches is the idealised real-number view — the trace carries both, the interface says
plainly which is which, and the renormalization track is provided as the bridge.

**A 16 ms recompute budget so typing needs no debounce.** All six model orders are built in a
single pass over the text and cached by input; changing only the coder does not rebuild
models. Above 50,000 characters the app switches to recompute-on-idle — and says so in the
interface rather than silently changing behaviour.

**Nothing leaves the device.** No network requests at runtime: fonts self-hosted, samples in
the bundle, no analytics. People paste their own writing into this. Typed text is explicitly
excluded from the URL state; there is a separate, labelled copy-link action.

## 5. Actual tech stack

From `package.json` — two runtime dependencies, both React.

| Layer | What is actually used |
|---|---|
| Runtime deps | `react@18.3`, `react-dom@18.3` — that is the complete list |
| Build | Vite 5, TypeScript 5.6 (strict), multi-page build (app + `/about/`) |
| Testing | Vitest 2, jsdom, Testing Library (`@testing-library/react`, `user-event`) |
| Lint | ESLint 8, `@typescript-eslint` 7, `eslint-plugin-react-hooks` |
| Styling | Plain CSS with custom properties. No Tailwind, no UI kit, no CSS-in-JS |
| Charts | None. All SVG hand-written |
| Animation | One hand-rolled `requestAnimationFrame` loop (interval zoom only) |
| Fonts | Literata + JetBrains Mono, variable woff2, subsetted, vendored |
| CI/CD | GitHub Actions — typecheck → lint → test → build, then Pages deploy |

Bundle, from the current `dist/`: **94 KB gzipped JS, 7 KB gzipped CSS**, samples included —
against a 200 KB budget.

## 6. Notable features

- **The staircase** — the central chart. Conditional entropy H₀..H₅ as descending steps, each
  coder's measured rate plotted against them, the model description cost as a rising curve,
  and total size as a third curve with a marked minimum. Drag the order and everything
  re-plots live.
- **Surprisal over the text** — the user's own prose, every character tinted by its cost in
  bits under the current model. At order 0 it looks like noise; raise the order and structure
  appears — word beginnings stay dark, interiors fade. Virtualised above a threshold so a
  200,000-character paste still scrolls.
- **The interval view** — arithmetic coding's `[0,1)` interval continuously zooming so the
  active subinterval always fills the frame. The interval never appears to shrink; the world
  expands around it. Backed by a renormalization track and a bit ledger showing each symbol's
  actual cost.
- **The sliding window** — LZ77's search and look-ahead buffers with the current match
  highlighted in both, window size and look-ahead user-controllable, greedy against lazy
  matching, so you can watch a match fall out of range as the window shrinks.
- **Huffman's waste plot** — ideal cost −log₂(p) against the integer code length Huffman
  actually assigns, shown as an area, because that gap *is* what Huffman loses to arithmetic
  coding.
- **The parallel corpus** — the UDHR in four languages, strictly parallel, testing one
  specific claim about morphological redundancy. Measured result, stated on the page:
  Indonesian shows the widest LZ77 advantage over H₀ (0.851 bits/symbol vs English's 0.636);
  Finnish, despite being the most agglutinative of the four, does not (0.340). The interface
  reports both and does not pretend four texts settle it.

## 7. Challenges and tradeoffs

Each of these is documented in the repo's README under "Deviations from the specification",
with the measurement that forced it.

- **The 16 ms budget forced an engine rewrite.** The straightforward
  `Map<string, Map<string, number>>` model measured **250 ms** for a 10,000-character
  recompute against a 16 ms budget. Counts are now stored as interned integers; the
  documented map shape is still exposed on demand so the tests can read it. This is the
  subject of its own commit ("the refactor the 16 ms budget forced").
- **32-bit arithmetic registers were not enough.** At 32 bits, the floor division that carves
  the interval drifted 1.54 bits high on a 10,000-symbol order-4 text — inside the 2-bit
  bound but with no headroom for a larger alphabet. The register was widened to 48 bits
  rather than the tolerance being widened. That is the discipline the whole project runs on.
- **Adaptive model cost is not zero.** The spec said it was. Its *counts* are free, because
  the decoder rebuilds them from decoded history — but its alphabet and symbol count really
  are transmitted, so they are in the figure. Measured, an order-3 adaptive description is
  about a fiftieth of the static one, which makes the point without overstating it.
- **CI cannot verify a claim about a reader's machine.** A shared GitHub runner measured
  17.0 ms for the same commit that measures 14.4 ms locally. Rather than loosen the
  assertion everywhere, the performance test asserts p90 under 16 ms locally and becomes a
  32 ms regression guard on CI, and the README says to run it locally to check the real
  criterion. Two commits deal with this.
- **Samples moved out of `public/`.** Files in `public/` are served, not bundled — reading
  one would be a runtime network request, and an empty network tab is a hard requirement.
  They are bundled with Vite's `?raw` import instead.
- **Iosevka was specified and dropped.** No variable webfont worth vendoring at the required
  subset size; JetBrains Mono has the tabular figures the slot needed.
- **A late design rework.** Roughly a third of the commits post-date the feature build and
  come from looking at the running app: the palette was reworked into two named grounds
  (paper and bench) with a theme control, the type system was rebuilt, the staircase was
  unpinned after the scroll behaviour was found to be wrong, and the answer was moved to the
  top with the controls placed next to what they move.
- **A self-run design audit is checked into the repo** (`.impeccable/critique/`) — scored
  57/72 across both surfaces, zero P0 issues, three P1. Later commits fix items from it
  directly (typed text is no longer destroyed by choosing a sample; the reduced-motion
  stepper; the unit that jumped).
- **Deliberately out of scope:** LZW, BWT, PPM, ANS, DEFLATE, binary/image input, file
  upload, and any leaderboard. The app never declares a winner — the point is the trade-off.

## 8. Status

- **Live**, deployed to GitHub Pages by Actions on every green push to `main`:
  `https://andifathulms.github.io/compression-lab/` (plus an `/about/` explainer page).
- **Public repository:** `https://github.com/andifathulms/compression-lab`.
  *(Repository visibility could not be re-confirmed via the GitHub API at time of writing —
  no network access in this session — but the README links to public Pages and CI badges.)*
- **Production-quality, and finished as scoped** — v1.0.0, full test suite green in CI, deploy
  gated on typecheck + lint + test + build, running the same gate twice so a deploy cannot
  outrun a failing suite. It is a finished small product, not a prototype.
- Ships a web manifest, installed-app icons, a social card and a brand lockup.

## 9. Metrics

| | |
|---|---|
| Commits | 41 |
| Time span | 2026-09-02 to 2026-09-03 — a two-day concentrated build |
| Net diff, first commit to HEAD | 97 files, +13,417 / −271 lines |
| Application code | ~9,845 lines of TS/TSX/CSS under `src/` and `tests/` |
| Engine | 2,286 lines across 9 pure modules |
| Views | 3,171 lines across 10 components (6 named instruments) |
| Tests | 12 files, 1,103 lines, 64 test cases |
| Runtime dependencies | 2 (react, react-dom) |
| Shipped bundle | 94 KB gzipped JS + 7 KB gzipped CSS, samples included |
| Bundled sample text | 9 files, ~63 KB, spanning literary English, source code, repetitive text, near-random text, DNA, and a 4-language parallel corpus |
| Model orders / coders | 6 orders × static and adaptive × 3 coders, all round-trip tested |
| Pages | 2 (the lab, and `/about/`) |

## 10. Suggested screenshots

1. **The staircase with the total-size minimum marked** — the headline shot, and the app's
   entire argument in one image. Ideally captured twice, on a short text and a long one, to
   show the minimum moving right.
   `src/views/Staircase/Staircase.tsx` (518 lines — the largest view), `Staircase.css`,
   orchestrated from `src/App.tsx`.
2. **The text surface at order 0 beside order 3** — surprisal colouring going from noise to
   visible linguistic structure. This is the "entropy stops being a number" moment and the
   most immediately legible image in the project.
   `src/views/TextSurface/TextSurface.tsx`, with the colour ramp in `src/ui/ramp.ts`.
3. **The interval view mid-zoom, with the renormalization track and bit ledger beneath** —
   the app's orchestrated moment, and the clearest evidence of the honesty commitment
   (idealisation on top, the integer coder that actually runs shown underneath).
   `src/views/Interval/Interval.tsx`, `src/views/BitLedger/BitLedger.tsx`.
4. **The parallel-corpus comparison row** — four languages, same text, different LZ77
   advantage, with the result that contradicts the hypothesis shown alongside the one that
   supports it. Good for a case study because it demonstrates measurement discipline, not
   just visuals. `src/views/ParallelRow.tsx`.

*Optional fifth:* **the sliding window with a match highlighted in both buffers**
(`src/views/SlidingWindow/SlidingWindow.tsx`) — the most animated, most obviously
"interactive" frame if the case study needs a motion still. And both themes are worth one
frame each — paper and bench, `src/styles/tokens.css`.
