# CLAUDE.md — Compression Lab

Build instructions for Claude Code. PRD.md is what and why. DESIGN.md is how it looks.

## Non-negotiables

1. **Everything is written from scratch.** No compression library, no entropy library, no
   `pako`, no `lz-string`. There is nothing to import here that would not defeat the point.
2. **Every coder has a working decoder**, tested, even though decompression is not a
   user-facing feature. A coder without a decoder is unverified and this app's entire
   claim is that its numbers are real.
3. **Model cost is computed, never estimated.** See PRD §7.1. If the model description size
   is a guess, the app's central chart is fiction.
4. **The engine is pure.** `src/engine/` imports nothing — no React, no DOM, no randomness,
   no `Date`. Runs unmodified under `node --test`.
5. **No network at runtime.** Fonts self-hosted, samples bundled.

## Stack

- Vite + React 18 + TypeScript, strict.
- Plain CSS with custom properties. No Tailwind, no component library.
- No charting library. The staircase, the waste plot and the interval view are all bespoke;
  Recharts would fight all three.
- Vitest.
- Zero runtime dependencies beyond React.

## Layout

```
/
├─ public/samples/            # bundled texts, plain .txt
├─ src/
│  ├─ engine/
│  │  ├─ model.ts             # order-N frequency model, static + adaptive
│  │  ├─ entropy.ts           # H_0..H_N, conditional entropies
│  │  ├─ modelcost.ts         # model description size, and its serialiser
│  │  ├─ huffman.ts           # build, canonical codes, encode, decode
│  │  ├─ arithmetic.ts        # integer range coder + decoder
│  │  ├─ lz77.ts              # match finder, encode, decode
│  │  ├─ bitio.ts             # bit writer / reader
│  │  ├─ trace.ts             # trace record types (see §3)
│  │  └─ index.ts
│  ├─ views/
│  │  ├─ Staircase/
│  │  ├─ TextSurface/         # the corpus with surprisal colouring
│  │  ├─ HuffmanTree/
│  │  ├─ WastePlot/
│  │  ├─ SlidingWindow/
│  │  ├─ Interval/
│  │  └─ BitLedger/
│  ├─ state/
│  ├─ ui/
│  └─ styles/
└─ tests/
   ├─ roundtrip.test.ts
   ├─ bounds.test.ts
   ├─ entropy.test.ts
   └─ modelcost.test.ts
```

## 1. Models

```ts
type Order = 0 | 1 | 2 | 3 | 4 | 5;

interface Model {
  order: Order;
  adaptive: boolean;
  // context string → symbol → count
  counts: Map<string, Map<string, number>>;
  alphabet: string[];
  probability(context: string, symbol: string): number;
  observe(context: string, symbol: string): void;   // adaptive only
}
```

Contexts are the preceding `order` characters. Handle the first `order` characters of the
input with progressively shorter contexts rather than padding with a sentinel — padding
introduces symbols that are not in the text and distorts the alphabet.

**Escape handling.** A high-order model will meet contexts it has never seen. Use
add-constant smoothing (Laplace, α = 1) over the observed alphabet. Do not implement PPM
escape mechanics — that is a different algorithm and PRD §3 puts it out of scope. State the
smoothing choice in the interface, because it materially affects the numbers.

## 2. Model cost

This is the part most likely to be done badly. Do it explicitly.

The model description must be a real serialisation that a decoder can consume:

```ts
function serialiseModel(m: Model): Uint8Array;
function deserialiseModel(bytes: Uint8Array): Model;
```

`modelcost.test.ts` asserts the round trip and asserts that
`decode(codeStream, deserialiseModel(modelBytes))` reproduces the original text. Model cost
in the UI is `modelBytes.length * 8` bits — a measured quantity, not a formula.

For adaptive models the cost is zero, because the decoder builds the same model from the
same history. Make this explicit in the UI: it is the reason adaptive coding is used in
practice and it is half the answer to why LZ77 wins.

## 3. Traces

Every coder produces a trace alongside its output. The views render the trace; they never
re-simulate. Same rule as the seat-award trace in Suara ke Kursi and the division trace in
Anatomi QRIS — display and computation are one object, so they cannot drift.

```ts
interface HuffmanTrace {
  merges: Array<{ step: number; left: Node; right: Node; queue: Node[] }>;
  codes: Map<string, string>;
}

interface Lz77Trace {
  steps: Array<{
    position: number;
    windowStart: number;
    lookaheadEnd: number;
    match: { distance: number; length: number } | null;
    emitted: Token;
    candidatesExamined: number;
  }>;
}

interface ArithmeticTrace {
  steps: Array<{
    symbol: string;
    lowBefore: bigint; highBefore: bigint;
    lowAfter: bigint;  highAfter: bigint;
    idealLow: number;  idealHigh: number;   // the [0,1) idealisation, for display
    bitsEmitted: string;
    underflowCount: number;
    costBits: number;                        // -log2 p(symbol)
  }>;
}
```

Note that `ArithmeticTrace` carries both the integer state and the idealised real-number
interval. The Interval view renders the idealisation; the renormalization track renders the
integer state. Carrying both in one record is how PRD §7.3 is honoured structurally rather
than by a disclaimer.

## 4. Arithmetic coding

The fiddliest thing in the project. Implement it as an integer range coder:

- 32-bit `low` and `high` (use `bigint` for clarity; performance is not a constraint at
  these input sizes, and correctness is).
- Renormalize while the top bits of `low` and `high` agree: emit the bit, shift both.
- Handle underflow: when `low` and `high` straddle the midpoint but converge, count pending
  bits and emit them with opposite polarity after the next resolved bit.
- Flush correctly at the end — a coder that is right for 10,000 symbols and drops the last
  two bits will pass casual inspection and fail `bounds.test.ts`.

**Do not implement this in floating point.** A naive `[0,1)` double implementation breaks
after roughly fifteen symbols. The idealised interval in the trace is for display only and
is computed separately.

`bounds.test.ts` asserts output length is within 2 bits of `-Σ log2 p`. If this fails, the
coder is wrong; do not widen the tolerance.

## 5. LZ77

Greedy longest match by default, with lazy matching as a toggle so the user can see what it
buys.

- Configurable window size (256 to 32768) and look-ahead (4 to 258).
- Match finder: hash chains on 3-byte prefixes. A naive O(n·w) scan will stall on a
  10,000-character input during live typing.
- **Overlapping matches must work.** Distance less than length is legal and common — the
  decoder copies byte by byte, not by block. This has its own test; it is the standard bug.

Token encoding for size accounting: literals as 9 bits (flag + byte), matches as
1 + log₂(window) + log₂(lookahead) bits. State the scheme in the interface, since the
compressed size depends on it and there is no single right answer.

## 6. Performance

Full recompute — models at all six orders, all entropies, all three coders — must land
under 16 ms for 10,000 characters so typing recomputes without a debounce.

- Compute all six orders in one pass over the text, not six passes.
- Cache per-order results keyed by input hash; changing only the coder must not recompute
  models.
- The 200,000-character cap exists so that a paste of a whole novel does not lock the tab.
  Above 50,000 characters, recompute on paste and on a debounced idle rather than on every
  keystroke — and say so in the interface rather than silently changing behaviour.

## 7. Rendering

SVG for the staircase, waste plot, Huffman tree and interval. DOM spans for the text
surface — it is prose and must be selectable, searchable and screen-reader legible, which
rules out canvas.

**The text surface is the performance risk**, not the charts. 200,000 characters is
200,000 spans if done naively. Virtualise: render only the visible window plus a buffer,
and colour by inline style rather than per-character class names.

Do not attach listeners per character. One listener on the container, hit-tested by
`document.caretPositionFromPoint` or by data attributes on word-level wrappers.

## 8. Animation

Hand-rolled, one rAF loop. The house rule carries over from the previous two apps and is
now settled:

**Continuous control → direct mapping, zero easing.** The model order slider, the window
size slider, and the interval scrubber follow the pointer exactly.

**Discrete control → timed transition.** Switching coder, switching sample, toggling
adaptive, toggling lazy matching.

The interval zoom is the one autonomous animation (PRD §5.6) and it is user-started.
`prefers-reduced-motion: reduce` turns it into a stepper.

## 9. State

```ts
interface AppState {
  text: string;
  order: Order;
  adaptive: boolean;
  coder: 'huffman' | 'arithmetic' | 'lz77' | 'compare';
  lz77: { windowSize: number; lookahead: number; lazy: boolean };
  selection: { symbol: string | null; textRange: [number, number] | null };
}
```

Sample choice, order, coder and LZ77 settings serialise to the URL. **Typed text does not**
— people will paste their own writing into this and a URL is a share surface. Provide an
explicit copy-link action that includes text only when the user asks for it, and say what
it includes.

## 10. Copy

English. Sentence case. No exclamation marks.

Terms are introduced once, in one sentence, at the point of first use: surprisal,
conditional entropy, prefix code, renormalization. Do not build a glossary page; a glossary
is where explanations go to be ignored.

Every number carries its unit. Bits per symbol, not "entropy: 4.13".

The smoothing choice, the LZ77 token encoding, and the model serialisation format are all
arbitrary in ways that change the numbers. Each is stated in the interface next to the
figure it affects. This app's credibility rests on not hiding its assumptions.

## 11. Build order

Do not start the UI before step 5 passes.

1. Bit I/O, model, entropy. Tests.
2. Huffman: build, canonical codes, encode, decode. Round-trip test.
3. Arithmetic: integer range coder, encoder, decoder. Round-trip and bounds tests.
4. LZ77: hash-chain match finder, encoder, decoder, overlapping-match test.
5. Model serialisation and `modelcost.test.ts`. **Gate.**
6. Traces for all three coders.
7. Design tokens, shell, text surface with surprisal colouring.
8. Staircase. This is the app's centre; get it right before the coder views.
9. Interval view and renormalization track. The orchestrated moment.
10. Sliding window.
11. Huffman tree and waste plot.
12. Bit ledger, samples, parallel-corpus comparison row.
13. Reduced motion, keyboard, virtualisation, mobile, Lighthouse.

## 12. Deployment

GitHub Pages via Actions. `base` set to the repo path. CI: typecheck → lint → test → build.
Deploy only on green.
