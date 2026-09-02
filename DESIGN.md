# DESIGN.md — Compression Lab

Visual and motion specification. PRD.md defines substance; this defines form.

---

## 0. The design problem

The previous two apps were handed their palettes by the world — parties have colours,
QR codes are black and white. This one is handed nothing. The subject is abstract:
probability, cost, prediction. That freedom is the risk, because an abstract brief is
exactly where a design defaults.

So the grounding has to come from the material, and the material is **the user's own
text**. Everything in this app is a measurement of prose that someone pasted in. The app is
a reading surface with instrumentation on it, not a dashboard that happens to contain some
words.

That decides almost everything: the ground is light because it is a reading surface, the
primary face is a serif because the subject is prose, and the central visual idea comes
straight out of the subject matter —

**Cost is rendered as visibility.** A character that the model predicted perfectly costs
nothing and is drawn in the page colour: invisible. A character the model did not expect
costs a lot and is drawn in full ink. Surprisal is not mapped onto an arbitrary colour
ramp; it is mapped onto how much the character is *there*.

That single mapping does more teaching than any legend, and it makes the surprisal ramp the
one place in this family of apps where a continuous colour scale is correct rather than
lazy.

---

## 1. Design plan

**Concept: the annotated manuscript.**

A page of text under a measuring instrument. Generous margins, a real reading measure, and
marks made on the text rather than beside it. The instruments to the right are the
apparatus; the text is the specimen.

Structure encodes the argument. The staircase is a staircase because conditional entropy
genuinely descends in discrete steps. The waste plot is an area because waste is an area.
Nothing is a chart type chosen from a menu.

**Alignment:** the text column is left-aligned, ragged right, on a measure of 62–66
characters. The instrument column is right-aligned on its numerals and left-aligned on its
labels. The two columns share a baseline grid so a value in the instruments sits on the
same line as the text it describes.

---

## 2. Colour

### 2.1 Ground

| Token | Value | Use |
|---|---|---|
| `--page` | `#F7F5F0` | The reading surface. Warm off-white, paper rather than UI white. |
| `--page-edge` | `#EFECE5` | Instrument panel grounds, one step down from the page. |
| `--ink` | `#1A1815` | Full ink. The maximum of the surprisal ramp. |
| `--ink-mid` | `#5C5852` | Labels, axis text, secondary copy. |
| `--ink-faint` | `#9B9589` | Disabled states, axis ticks. |
| `--rule` | `#DCD7CC` | Hairlines, grid, panel edges. |

This is a warm off-white ground, which sits close to a known generated-design default. It
is used here because the app is literally a reading surface and a cool grey would fight the
prose — but the usual companions of that ground are banned to keep it from reading as the
template: no terracotta accent, no high-contrast display serif, no centred hero.

### 2.2 The surprisal ramp

The app's primary colour system. A continuous ramp from `--page` to `--ink`, traversed by
cost in bits.

Not a hue ramp. The ramp runs through *presence*: from the page colour itself, through a
warm grey, to full ink, with a very slight warm shift at the high end so that expensive
characters read as ink rather than as shadow.

| Bits | Colour | Reading |
|---|---|---|
| 0 | `--page` | invisible; the model knew exactly |
| 2 | `#CFC8B9` | barely there |
| 4 | `#918977` | present |
| 6 | `#4E4940` | dark |
| 8+ | `--ink` | full ink; the model was surprised |

Clamp at 8 bits for an 8-bit alphabet; rescale the top of the ramp when the alphabet is
smaller, and say so, because a DNA sample maxes out at 2 bits and would otherwise render
entirely pale.

Because zero-cost characters are the page colour, low-entropy text partially disappears.
That is correct and it is the app's best single visual: paste a repeated phrase, raise the
order, and watch the text fade off the page as the model learns it.

### 2.3 The three coders

Three identity colours. Only three, so they can be genuinely distinct and none of them
needs to be a ramp.

| Coder | Colour | Note |
|---|---|---|
| Huffman | `#B0642A` | burnt orange |
| Arithmetic | `#2F6B7A` | deep teal |
| LZ77 | `#6B4B8A` | plum |

Each is used for that coder's line on the staircase, its point on every comparison, and the
accent on its instrument panel. Nowhere else.

Entropy steps on the staircase are drawn in `--ink-mid`, not in a coder colour — they are
not a coder's achievement, they are the standard being compared against.

### 2.4 Two functional colours

| Token | Value | Use |
|---|---|---|
| `--model-cost` | `#8A7A3D` | The model description cost, on the staircase and in every size breakdown. Olive; deliberately unlike the three coder colours because it is a different kind of quantity. |
| `--match` | `#3E7D5A` | The LZ77 match highlight, in the sliding window view only. |

Nothing else is coloured. Selection is a 2 px `--ink` outline. No hover tints.

---

## 3. Typography

Two families, both doing real work.

**Literata** for the text surface and for running copy. It was drawn for long-form screen
reading, it has a large x-height that survives being tinted toward the page colour, and it
holds together when individual characters are set at different values — which is exactly
what the surprisal view does to it. A display serif with high stroke contrast would fall
apart under that treatment; test this specifically.

**Iosevka** for every number, bitstream, code, label and axis. Narrow, so a bit ledger
column of 32 characters fits without shrinking; excellent digits; and its condensation is
useful rather than stylistic when the app is full of long binary strings.

No sans. The app is prose and numerals, and a third voice would be a third opinion nobody
asked for.

### 3.1 Scale

Base 17 px for the text surface — larger than typical UI, because it is meant to be read.
Ratio 1.2.

| Token | Size / line-height | Face | Use |
|---|---|---|---|
| `--t-display` | 35 / 1.1, 500 | Iosevka | The headline figure: bits per symbol, optimal order |
| `--t-figure` | 24 / 1.1, 500 | Iosevka | Instrument values |
| `--t-h2` | 20 / 1.3, 600 | Literata | Panel headings |
| `--t-text` | 17 / 1.65, 400 | Literata | The text surface. Measure 62–66 characters. |
| `--t-body` | 15 / 1.6, 400 | Literata | Explanatory copy |
| `--t-data` | 13 / 1.5, 400 | Iosevka | Bits, codes, tokens, tables |
| `--t-small` | 12 / 1.4, 400 | Iosevka | Axis labels, units, legend |

`font-variant-numeric: tabular-nums` on all Iosevka. The staircase animates numbers and
proportional figures will jitter.

### 3.2 Prohibitions

No all-caps labels. No tracked-out eyebrows. No single word in a heading accented in colour
or weight — particularly tempting here, and particularly wrong, since colour already means
cost. Sentence case throughout.

---

## 4. Layout

### 4.1 Two columns

```
┌──────────────────────────────────────────────────────────────────┐
│ Compression Lab                                                  │
├────────────────────────────────┬─────────────────────────────────┤
│                                │  THE STAIRCASE                  │
│  THE TEXT SURFACE              │  ┌───────────────────────────┐  │
│                                │  │ H₀ ▔▔▔▔                   │  │
│  Every character coloured by   │  │   H₁ ▔▔▔▔                 │  │
│  what it costs. Predictable    │  │     H₂ ▔▔▔▔               │  │
│  characters fade into the      │  │  · huffman  · arith · lz  │  │
│  page; surprising ones sit in  │  │  ╱ model cost             │  │
│  full ink.                     │  │  ╲ total ── minimum at 2  │  │
│                                │  └───────────────────────────┘  │
│  Scrolls independently.        │                                 │
│  Measure held at 62–66 chars.  │  code 4.1 kB · model 0.9 kB     │
│                                │  total 5.0 kB · ratio 0.41      │
│                                ├─────────────────────────────────┤
│                                │  THE CODER BAY                 │
│                                │  [huffman|arithmetic|lz77|all]  │
│                                │                                 │
│                                │  ← one instrument at a time     │
│                                │                                 │
├────────────────────────────────┴─────────────────────────────────┤
│ order ●──────────  0 1 2 3 4 5   □ adaptive    [ sample ▾ ]      │
└──────────────────────────────────────────────────────────────────┘
```

The text is on the left and it is the largest thing on the page. That is the argument the
layout makes: this app measures writing, and the writing stays visible while you measure it.

The staircase is pinned at the top of the right column and never scrolls away, because
every other instrument is an elaboration of it.

### 4.2 The coder bay

Below the staircase. Four states: Huffman, arithmetic, LZ77, and compare. Switching swaps
the instrument; the staircase and the text surface do not change.

This is the structural parallel to the fixed matrix in Anatomi QRIS — one constant, one
interchangeable part — arrived at for the same reason, that a constant anchor is what makes
a set of views read as one subject.

### 4.3 The control bar

Pinned to the bottom, full width. The model order slider is the primary control and takes
the most space, with the six orders marked. Adaptive is a checkbox beside it, because
adaptive is the thing that zeroes the model cost and the user should be able to toggle it
while watching the staircase.

The sample chooser sits at the right. The paste target is the text surface itself — click
into it and type or paste. There is no separate input box, because the text is the subject
and putting it behind a form field would say otherwise.

### 4.4 Grid and rhythm

8 px base. Spacing scale: 8 · 16 · 24 · 40 · 64 · 96. Max width 84 rem. Text column fixed
at 34 rem; instrument column takes the rest.

Panels are separated by value and a single hairline, not by cards. No radius, no shadow —
this is a page, not a set of tiles.

### 4.5 Mobile

Below 860 px the columns stack: staircase first, then text surface, then coder bay. The
staircase stays sticky at the top at reduced height. The text surface keeps its measure and
its type size — it is still meant to be read. The control bar keeps the order slider and
collapses adaptive and sample behind one control.

---

## 5. Instruments

### 5.1 The staircase

Horizontal axis: model order, 0 through 5. Vertical: bits per symbol.

- Entropy steps as literal steps — flat segments with vertical risers, `--ink-mid`, 2 px.
  Not a smooth curve. Conditional entropy is defined at integer orders and drawing a curve
  between them would assert a continuity that does not exist.
- Each coder's achieved rate as a point at the order it is configured for, in its colour.
- Model cost as a rising line in `--model-cost`.
- Total as a line with a marked minimum, annotated with the order.

The minimum annotation is the app's headline: *"lowest total at order 2"*. When the user
pastes a longer text and the minimum shifts right, the annotation moves with it and that
movement is the thesis.

Compare mode plots all three coders at once with a light connecting rule to their labels.

### 5.2 The text surface

The user's text, set at reading size, every character tinted by its cost.

Hovering a character shows its context, its probability under the current model, and its
cost in bits. The context is shown as the preceding *n* characters highlighted in place,
which is how a user learns what "order 3" actually means without a definition.

Selecting a range shows that range's total cost, which lets someone measure a single word
against another.

Virtualised (CLAUDE.md §7) but never paginated. Scrolling must feel like scrolling a
document.

### 5.3 Huffman tree

Built bottom-up, steppable. Nodes carry their frequency; edges carry 0 and 1. The queue is
shown as a row beneath, shrinking by one on each merge.

Selecting a leaf highlights every occurrence of that symbol in the text surface. That
binding is the reason the text stays on screen.

### 5.4 Waste plot

Symbols on the horizontal axis, ordered by frequency. Two marks per symbol: the ideal cost
−log₂(p), and the integer code length Huffman assigned. The area between them, weighted by
frequency, is filled in the Huffman colour at low opacity.

The filled area is the entire argument for arithmetic coding. Label it with its total in
bits, once.

### 5.5 Sliding window

The text with two adjacent regions marked: search buffer behind, look-ahead ahead. The
match, when found, is outlined in `--match` in both places simultaneously — this
simultaneity is the point, since the whole idea is that the second occurrence can be
replaced by a reference to the first.

Emitted tokens accumulate in a column at the right. Window and look-ahead sizes are sliders
directly beneath, so a user can shrink the window and watch a match fall out of range.

### 5.6 The interval

The [0,1) interval as a vertical bar filling the panel height, subdivided by symbol
probability, each band labelled where it fits.

On each step, the active band is selected and the view zooms continuously so that band
fills the panel. The bar never appears to shrink; the subdivisions expand past the frame
edges.

A depth readout accumulates: symbols coded, current interval width in scientific notation,
bits emitted. Beneath, the renormalization track — bits leaving as the top bits agree, and
the underflow counter.

A single line of standing copy states that the visual is the idealised real-number interval
and the engine is an integer range coder, with the renormalization track as the bridge.
This is a PRD commitment (§7.3), not a caveat to be styled away.

### 5.7 Bit ledger

A column: symbol, probability, cost in bits, cumulative bits. Iosevka, right-aligned
numerals, one row per symbol, scrolling in step with whichever coder is running.

---

## 6. Motion

### 6.1 The rule

Settled across all three apps now:

**Continuous control → direct mapping, zero easing.** The order slider, the window size
sliders, and the interval scrubber follow the pointer exactly. The staircase re-plots and
the text re-tints on every frame of the drag.

**Discrete control → timed transition.** Coder switch, sample switch, adaptive toggle.

### 6.2 Durations

| Event | Duration | Curve |
|---|---|---|
| Interval zoom, per symbol | 420 ms | `cubic-bezier(.4,0,.2,1)` |
| Coder switch | 300 ms | `cubic-bezier(.32,.72,0,1)` |
| Sample switch, text re-tint | 500 ms, staggered 0.4 ms per character | `cubic-bezier(.4,0,.2,1)` |
| Huffman merge step | 260 ms | `cubic-bezier(.4,0,.2,1)` |
| Window slide | 180 ms | linear |
| Staircase re-plot (discrete) | 300 ms | `cubic-bezier(.32,.72,0,1)` |
| Hover readout | 0 ms | none — a query, not a transition |

### 6.3 The orchestrated moment

The interval zoom. It is the only autonomous animation in the app and it is user-started.

Play, pause, step, scrub. Two hundred symbols at 420 ms each is well over a minute, so
provide a speed control — but the default speed must be slow enough that a viewer can read
the band labels, because the labels are what make it comprehensible rather than merely
pretty.

Nothing else in the app animates unprompted. No panel entrances, no hover transitions on
instrument cards, no pulsing.

### 6.4 The text re-tint

Not an orchestrated moment, but the app's most-seen transition and worth specifying: when
the order changes discretely or a sample loads, characters retint with a stagger that
sweeps in reading order at 0.4 ms per character.

The stagger is barely perceptible as a sequence — it reads as the page settling — and at
0.4 ms even a 2,000-character viewport completes in under a second. Do not increase it into
a visible wave; that would turn a state change into a performance.

### 6.5 Reduced motion

`prefers-reduced-motion: reduce`: interval zoom becomes a stepper with instant state
writes, the text re-tint becomes instantaneous with no stagger, the Huffman build and the
window slide become step-only. Nothing is lost but the animation.

---

## 7. Copy

English. Sentence case. No exclamation marks. Terms introduced once at first use, in one
sentence, in `--ink-mid` beneath the heading that introduces them.

Every number carries a unit: "4.13 bits per symbol", never "entropy: 4.13".

Every limit is labelled with its model, per PRD §7.2. The staircase's steps read
"H₂ — conditional on 2 previous characters", not "entropy".

Assumptions are stated next to the figures they affect, not in an about page: the smoothing
constant beside the entropy values, the LZ77 token encoding beside the LZ77 size, the model
serialisation format beside the model cost.

Empty state: the text surface holds a focused cursor and one line of placeholder — "Paste
some text, or choose a sample." Nothing else. No illustration, no feature tour.

---

## 8. Quality floor

Assumed, not announced: usable at 380 px; visible keyboard focus everywhere; the text
surface fully selectable and searchable by the browser; every instrument has a
keyboard-reachable table equivalent; contrast 4.5:1 for text and 3:1 for graphical objects
— note that the low end of the surprisal ramp is *deliberately* below that, which is
legitimate because the tint is redundant encoding and every value is available in the hover
readout and the table view; reduced motion honoured; no network at runtime.

## 9. Relationship to the house layer

Takes: the spacing scale, the motion curve family, the type floor, the
continuous-versus-discrete motion rule.

Contributes back: the constant-anchor-plus-interchangeable-bay layout, now used in two apps
(the fixed matrix in Anatomi QRIS, the fixed staircase here). It is worth promoting to the
house layer as a pattern for any app with several views of one subject.

Departs in one place: this is the only app in the family with a warm light ground. The
reason is in §0 — it is a reading surface and the text is the subject. Document the
departure so the ground does not quietly become a house default, since it is the closest
of the three to a generic choice and is only justified by this specific brief.
