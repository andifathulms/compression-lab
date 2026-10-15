# DESIGN.md — Compression Lab

Visual and motion specification. PRD.md defines substance; this defines form.

---

## 0. The design problem

The previous two apps were handed their palettes by the world — parties have colours, QR
codes are black and white. This one is handed nothing. The subject is abstract:
probability, cost, prediction. That freedom is the risk, because an abstract brief is
exactly where a design defaults.

So the grounding has to come from the material, and the material is **the user's own
text**. Everything in this app is a measurement of prose that someone pasted in. The app is
a reading surface with instrumentation on it, not a dashboard that happens to contain some
words.

Two ideas come out of that, and everything else in this document is downstream of them.

**Cost is rendered as visibility.** A character the model predicted perfectly costs nothing
and is drawn in the ground colour: invisible. A character the model did not expect costs a
lot and is drawn at full contrast. Surprisal is not mapped onto an arbitrary hue ramp; it
is mapped onto how much the character is *there*. That single mapping does more teaching
than any legend, and it makes the surprisal ramp the one place in this family of apps where
a continuous colour scale is correct rather than lazy.

**Paper and instrument.** The thing being measured and the thing doing the measuring are
different materials. The specimen sits on warm paper: a serif face, a real reading measure,
generous margins. The apparatus sits on cool steel: an interface face for its labels, a
monospaced face for its figures, hairline rules and framed plots. The seam between the two
columns is a real edge — a change of temperature as well as of value — and it is the app's
subject drawn rather than described.

---

## 1. Design plan

**Concept: the specimen on the bench.**

Structure encodes the argument. The staircase is a staircase because conditional entropy
genuinely descends in discrete steps. The waste plot is an area because waste is an area.
The interval view puts the idealisation and the integer registers side by side because they
come out of one trace record. Nothing is a chart type chosen from a menu.

**Alignment.** The specimen column is left-aligned, ragged right, on a measure of 62–66
characters. The instrument column is right-aligned on its numerals and left-aligned on its
labels, in one monospaced grid.

**Hierarchy.** There is exactly one hero figure on the page: the current coder's rate, in
the readout bar. Everything else steps down from it. Headings have two levels and no more:
the chapter, named by its tab, and the panel inside it, in the argument voice. Below that
the size hierarchy is carried by the figures. It used to be one level — every heading the
same 11px uppercase mono — and eight panels read as one flat list rather than an argument
with parts.

---

## 2. Colour

The palette is defined once, as tokens, and instantiated on two grounds. The dark ground is
not an inversion: the roles are the same, the values are chosen independently, and the ramp
changes direction rather than being flipped.

### 2.1 The two grounds

| Token | Paper | Bench | Use |
|---|---|---|---|
| `--page` | `#FCFBF8` | `#141922` | The specimen and the brand row. Warm off-white, or the lighter of the two dark grounds. |
| `--sunk` | `#EDF0F3` | `#0C0F14` | Steel: the ground the apparatus and the readout bar sit on. |
| `--surface` | `#FFFFFF` | `#1A202A` | A raised control, a framed plot, a framed table, the lens. |
| `--surface-hover` | `#F4F6F8` | `#212834` | The same, under a pointer; table headers. |
| `--ink` | `#12161C` | `#E7EBF0` | Text, the entropy steps, the selected state. |
| `--ink-mid` | `#47505D` | `#AAB3BF` | Prose that qualifies a figure. The code stream bars. |
| `--ink-faint` | `#5C6573` | `#8C96A5` | Labels, axis numerals, disabled controls. |
| `--rule` | `#DFE3E8` | `#262E3A` | Hairlines between panels. |
| `--rule-strong` | `#C3CAD3` | `#3A4452` | Control borders, table header rules, the column seam. |

The two light grounds used to be `#FBFAF7` and `#F1EFE8`, two beiges about 1.07:1 apart,
and the seam this section calls the subject barely showed. Ink was brown-black. Warm cream
with a serif is also the look a lot of generated pages now default to, which is a poor
place for a portfolio piece to land by accident. The paper stayed warm; the bench moved to
a cool blue-grey steel and the ink to a blue-black that belongs to it.

On paper the specimen is *lighter* than the bench; on the bench it is *lighter* than the
bench too. The specimen is always the raised material. That is the one invariant the two
grounds share, and it is what keeps the layout reading the same way in both.

### 2.2 The surprisal ramp

Five stops, traversed by cost in bits, rescaled if the alphabet tops out below 8 bits — and
the interface says when it has been rescaled, because a rescaled ramp changes what the page
looks like.

| Bits | Paper | Bench |
|---|---|---|
| 0 | `#FCFBF8` | `#141922` |
| 2 | `#D6D4CF` | `#353C47` |
| 4 | `#9B988F` | `#6C7380` |
| 6 | `#50535B` | `#AEB3BA` |
| 8 | `#12161C` | `#FFF1D6` |

Both start at the ground and end at full presence. The paper ramp ends in ink. The bench
ramp ends in a warm near-white — the only place in the app where warmth means intensity —
so that on the dark ground an unexpected character reads as a signal rather than as one
more shade of grey.

The low end of both ramps is deliberately below the 4.5:1 contrast floor. That is
legitimate because the tint is redundant encoding: every value is also in the readout under
the specimen and in the tables.

### 2.3 The three coders

Each coder has one colour. It appears on that coder's dot in the control, its point or rule
on the staircase, the code-stream fill in its byte bar, its name under the hero figure, the
cost bar in the lens, and the marks its instrument makes in the specimen. Nowhere else. The
ideal code stream on the staircase is not any coder's result, so its bars are neutral.

| Coder | Paper | Bench | Why |
|---|---|---|---|
| Huffman | `#B4470B` | `#FF9A55` | Warm, discrete, stepped. |
| Arithmetic | `#0A6E82` | `#4CCFE6` | Cool, continuous, flowing. |
| LZ77 | `#6A3FCB` | `#B59CFF` | Neither; it is about memory, not probability. |

All three are more saturated than they were and balanced to a similar lightness, so no
coder reads as the important one.

Each also has a tint (`--huffman-tint` and so on) for fills that sit under text.

### 2.4 Two functional colours

| Token | Paper | Bench | Use |
|---|---|---|---|
| `--model-cost` | `#8A6400` | `#E3BE57` | The model description, everywhere it appears. |
| `--match` | `#1E7A45` | `#57D394` | An LZ77 match, marked in both places at once. |

The model description is the only quantity in the app drawn as a **hatch** rather than a
solid fill. It is overhead, not output, and a solid block beside the code stream would read
as more of the same substance. The hatch takes the model-cost token, so it follows the
theme.

### 2.5 Contrast

Every colour used for text clears 4.5:1 against the **worst** of the four grounds it can
appear on — the steel on paper, the hover surface on the bench — and each coder colour and
the model-cost gold clear it on their own tint too. That is checked
arithmetically rather than eyeballed, because a muted palette drifts into the low threes
without anyone noticing: `--ink-faint`, `--huffman`, `--model-cost` and `--match` were all
between 2.9 and 4.4 before they were measured, and every one of them is used for text at
10.5–13px.

The two deliberate exemptions are the low end of the surprisal ramp and the pale end of the
staircase's gridlines. Both are redundant encoding — every ramp value is also in the
readout under the specimen and in the tables — and this is stated in §2.2.

### 2.6 Prohibitions

No gradient anywhere except the hatch and the specimen's scroll-edge fade. No colour-coded
sentiment: nothing is green because it is good. No hue used to mean two things. Colour on a
number always means which series it belongs to, never whether the number is large.

---

## 3. Typography

Three voices, each with one job. All are self-hosted variable faces subsetted to Latin and
Latin Extended, bundled with the app; nothing is fetched at runtime.

**Literata** is the argument: the specimen, the notes, the thesis, chapter and panel
headings. A screen-reading face with a large x-height, which is what lets a character
survive being tinted most of the way toward the ground colour.

**Instrument Sans** is the interface: every label, control, tab, legend, table header and
assumption note, in sentence case. It carries a width axis as well as weight, so the dense
readout bar can use a narrower cut without a second family.

**JetBrains Mono** is the measurement, and only that: every number, unit, code, table cell
and axis tick, with tabular figures throughout. The staircase animates its numbers and
proportional figures would jitter.

There used to be two voices, and the mono face did two jobs: it set every number, and also
every label, heading and long note, at 11px uppercase. That is why the instrument side read
as one dense block, and why the assumption notes — the sentences this app's credibility
rests on — were the hardest text on the page to read. Nothing measured is set in the
argument or interface faces. The one deliberate crossing is still the sliding-window strip,
set in mono because there the text is being indexed rather than read.

### 3.1 Scale

One ratio, 1.2, from a 16px base. Six steps, plus a clamped display.

| Token | Size | Derivation | Use |
|---|---|---|---|
| `--t-display` | `clamp(27.65px, 1.5rem + 1vw, 39.81px)` | 16 × 1.2³ → 1.2⁵ | The rail's reading. One per page. |
| `--t-headline` | 27.65px | 16 × 1.2³ | A panel's headline figure. |
| `--t-figure` | 23.04px | 16 × 1.2² | A panel's leading figure. |
| `--t-text` | 19.2px | 16 × 1.2 | The specimen, and the app name. |
| `--t-body` | 16px | base | Prose notes. |
| `--t-data` | 13.33px | 16 ÷ 1.2 | Table cells, controls, readouts. |
| `--t-note` | 14px | — | Assumption notes, in the interface voice. |
| `--t-label` | 12.5px | — | Labels, legends, table headers, in the interface voice. |
| `--t-micro` | 11.11px | 16 ÷ 1.2² | Axis numerals, chips. |

The two off-ratio steps are for the interface face in sentence case, which needs a little
more size than the uppercase mono it replaced, not less.

Plot glyphs are on their own two-step ratio — `--t-plot` (10) and `--t-plot-tick` (8.33) —
because those are viewBox units that scale with the chart rather than pixels on the page.

This replaced nine ad-hoc sizes. Two pairs were effectively the same size (10.5 and 11.5,
17 and 17) and three sat on no ratio at all; eight more sizes were hardcoded in component
CSS, which is the thing tokens exist to prevent. A scale with a duplicate in it is not a
scale, it is a list.

**Prose sits at 16px, and the specimen at 19.2px.** They were 15 and 17. Both are read
rather than scanned, and 15px is below the floor for that.

Tracking is a token too: display numerals are tightened (`-0.035em`) and panel figures a
little less (`-0.02em`), or a five-digit figure reads as a serial number. The label tokens
are zero now that labels are sentence case. They were referenced everywhere and never
defined, so the opened-out uppercase this section used to specify never actually rendered.

### 3.2 Prohibitions

Sentence case throughout, labels included. No word in a heading accented in colour or weight — colour
already means cost. Emphasis is on language, never on a number: the italic on
*surprisal* where the term is introduced, and the bold on the thesis sentence at the head of
the staircase. Every number carries its unit.

---

## 4. Layout

### 4.1 One pinned header, then two columns

```
┌───────────────────────────────────────────────────────────┐
│ brand row  name · lead   sample · coder · link · CSV · ground│  pinned together
│ readout    4.55 bits/symbol  [byte bar to scale]  H0–H5  model│
├────────────────────┬──────────────────────────────────────┤
│ specimen (paper)   │ apparatus (steel)                    │
│  the text, tinted  │  1 Counting bits  2 The staircase …  │  tabs pinned
│                    │  ─────────────────────────────────── │
│  [lens]            │  the chapter in view                 │
└────────────────────┴──────────────────────────────────────┘
```

The **brand row** is slim: the name, the lead under it on wide screens, and the chrome that
is not a measurement — the sample, the coder, the share menu, the CSV download and the
ground. The masthead it replaced was 127px with the lead at reading size, scrolled past on
every visit. The lead also opens the staircase chapter, so a narrow screen does not lose it.

The **readout bar** is the app's answer to its own question: the rate as the hero figure,
the coder named once under it in its own colour, and the same answer drawn as a byte bar to
scale against the original, so "43% smaller" is visible before it is read. Then the model
order and the adaptive switch. Under compare the reading shows the lowest of the three and
names it.

The brand row and the readout bar are pinned together. Pinned apart, the brand row
scrolled away and the specimen, sized to the viewport under the rail alone, started with
its lens below the fold. Their height is measured at runtime and published as `--rail-h`.

### 4.2 The specimen

Its own scroll region, pinned under the header, at its reading measure plus gutters —
about 40% of a desktop screen. It was nearer half, which gave a 62-character line more room
than it can use and the charts less than they need. It fades at its scroll edge, because a
line of prose sliced in half horizontally reads as a rendering fault.

The **lens** sits at the foot of the column, over that fade: the symbol, its context, the
probability with the counts it came from, and the cost with a bar in the coder's colour. It
is not a tooltip: a tooltip that follows the pointer across 200,000 characters is
permanently in front of the character you wanted to look at next. It follows the caret as
well, so it is on the keyboard path. It replaced a one-line readout that showed only the two
ends of the calculation.

The two standing caveats — the text is editable and stays in this browser; what this sample
is — sit above the text in the interface voice at label size, short, because above the text
they cost lines of it.

### 4.3 The apparatus: five chapters

The apparatus used to be eight panels in one column of about 7,700px, and the staircase,
the app's centre, began eleven hundred pixels down under a worked example. It is now five
chapters in the order the argument runs:

1. **Counting bits** — the worked example and why a probability becomes bits.
2. **The staircase** — the default chapter. Thesis, prompts, chart, table, H versus code.
3. **Model cost** — what the description is made of, where the minimum moves, what
   adaptive costs.
4. **The coders** — Huffman, arithmetic, LZ77, following the coder chosen in the brand row.
5. **Languages** — the parallel corpus.

The tabs are pinned under the header with a one-line summary of the chapter under them.
They are a real tablist; keys 1 to 5 jump to a chapter from anywhere that is not a text
field. The chapter lives in the URL fragment (`#staircase`), outside AppState, because the
query string describes a measurement and a chapter is where you stand to look at it. A
shared link carries it.

Only the chapter in view is mounted. That is a performance decision as much as a visual
one: every keystroke recomputes the analysis, and four hidden chapters re-rendering against
it were work nobody could see.

### 4.4 Grid and rhythm

4px base scale, so the dense side has a half step. Panels are separated by a hairline and
by the ground under them, never by cards. No shadow on a panel: the one shadow in the app is
on the thing that floats, the lens (and the phone's bottom bar). Radius exists only on
things a pointer touches — that is how a control announces that it is one — and on framed
plots and framed tables, which are surfaces rather than panels.

Tables do not sit in fixed-height scroll boxes any more where they are short: a box that
cut the last row in half read as a rendering fault. They show their first eight rows and a
full-width "Show all N" row. Only the bit ledger and the LZ77 tokens, which run to thousands
of rows, keep a scroll box.

### 4.5 Responsive

- **≤1500px** — the lead leaves the brand row; it still opens the staircase chapter.
- **≤1280px** — the word "Coder" above its segments is drawn no longer; it stays as the
  group's name.
- **≤1180px** — gutters tighten, the specimen narrows toward its measure.
- **≤1100px** — the readout's controls take their own row under the figure and byte bar.
- **≤980px** — one column. The specimen goes first and the header stops being pinned: two
  nested sticky scroll regions on a phone is a trap.
- **≤720px** — the chapter tabs become a bar fixed to the bottom of the screen with an icon
  each and a Text button. A tap scrolls to the chapter it picked. The order buttons and the
  model switch share one row with their labels kept for assistive technology. On a 390px
  screen the first tinted line lands at about 690px, from about 830.

## 5. Instruments

### 5.1 The staircase

The app's centre, and the chapter it opens on. Literal steps: a flat segment per order
joined by vertical risers, because conditional entropy is defined at integer orders and a
smooth curve between them would assert a continuity that does not exist.

Over the steps, **each order is a stacked bar**: the code stream an ideal coder pays, as a
neutral solid, and the model description on top of it, hatched in gold. The total is the top
of the bar and is printed over it. The minimum is the shortest bar, called out with an ink
chip. These used to be two lines — model and total — and "total = code + model" lived only
in the caption. Charts are read shape-first, so the sum is now the shape.

It sits in a framed plot with a four-item key above it. It is the one chart with a key:
a stacked bar needs one, and everything else stays legend-free.

**The plot is the control.** Clicking a column picks that order, which is the gesture a
reader tries first. The H0–H5 group in the readout bar is the same thing on the keyboard
path; the chart's own copy of it was removed as a duplicate.

Under the thesis, a "Try this" row gives a first-time visitor a reason to touch something:
raise the order, make the model adaptive, compare four languages, or start from counting
bits.

**Two axis settings.** A static order-5 model on a short text costs upwards of fifty bits
per symbol, and against that the entropy steps — the thing the chart is named after —
descend across two pixels at the bottom of the plot. *Everything* fits the tallest series
and is the default, because the model line running away is the lesson. *The steps* fits the
entropy and the coder rates; a bar that runs off the top is marked with an arrow and its
value, and the panel says so in words: a mark that leaves the plot without saying where it
went is a lie.

Ticks come from the range — 1, 2 or 5 times a power of ten, about six of them. The key on
the right collects each label's wanted height, pushes them apart to a minimum gap, and
draws a leader back to where each wanted to be, because several series land on the same
value routinely.

### 5.2 The specimen

Two layers that must agree exactly: a coloured, `aria-hidden`, pointer-transparent layer of
spans underneath, and a real transparent textarea on top carrying the caret, the selection
and the text. That is what keeps the prose selectable, editable and legible to a screen
reader, which is why this is DOM and not canvas.

Marks made on the text carry the colour of the instrument that made them: a Huffman symbol
selection is a Huffman-coloured underline, the LZ77 look-ahead is an LZ77-coloured wash, a
match is a `--match` underline in both places at once. A tint would mean cost, so a mark is
never a tint. The selection is translucent for the same reason: a solid block hides the
tint underneath it, and the tint is the point.

### 5.3 Huffman tree

Framed plot, canonical codes, one merge at a time on a scrubber. The selected leaf takes
the Huffman colour and marks every occurrence of that symbol in the specimen.

It grows left to right with one column per code length, so the reader counts bits across.
It used to grow downward with all fifty-three leaves of a prose alphabet in one row, at
about six pixels a label. A finished tree with more than eighteen rows folds its deepest
subtrees into "+N more" nodes — the rare symbols, which is what is deep in a Huffman tree —
and a button opens them. The merge-by-merge build is never folded, so it stays watchable.

### 5.4 Waste plot

An area, because the waste is an area: the gap between `-log2 p` and the whole number of
bits the code actually spends. Filled in the Huffman colour at low opacity — it is the
entire argument for arithmetic coding, drawn.

### 5.5 Sliding window

The strip in the instrument voice, at line-height 2 so distances can be counted off it. The
search buffer is shaded in the LZ77 colour and the look-ahead is left on the ground with
the ink, so the two are told apart by presence rather than by two competing tints.

### 5.6 The interval

The app's one orchestrated moment, and the only autonomous animation. Three columns, left
to right: the bands the model offers, the idealised interval a person can follow, and the
integer register state the engine actually holds. They are side by side because the trace
carries both — PRD 7.3 honoured structurally rather than by a disclaimer — and putting them
in one row is that fact drawn instead of asserted.

The cost of the symbol under the cursor leads at figure size in the arithmetic colour. It
is the figure the view exists to show, and stacked with three other lines in the same size
it was indistinguishable from the step counter.

### 5.6a Four languages

A dumbbell per language, from the LZ77 rate to the order-0 entropy, with the order-2 step
as a hollow mark for scale. The margin between them is the finding, so it is the widest
mark on the chart. The exact values stay in the table beneath it.

### 5.7 Bit ledger

Every symbol, its probability, its cost and the bits it emitted, in the arithmetic colour.
A row that emitted nothing gets a mark rather than a blank: it is not a gap in the ledger,
it is a symbol the coder absorbed without resolving a bit.

---

## 6. Motion

### 6.1 The rule

**Continuous control → direct mapping, zero easing.** The window and look-ahead sliders,
the interval scrubber, the merge scrubber. They follow the pointer exactly and everything
that re-plots from them re-plots on the same frame.

**Discrete control → timed transition.** Switching coder, switching sample, switching
chapter, choosing a model order, toggling adaptive, toggling lazy matching, stepping a merge.

The model order used to be a slider. It only ever takes six values, the staircase already
named them H0 to H5, and a slider made the app's primary control a fifteen-pixel grip. It is
six buttons in a radio group, and being a choice between named states it takes the discrete
rule.

### 6.2 Durations

| Token | Duration | What |
|---|---|---|
| `--d-fast` | 120ms | A control acknowledging a pointer. |
| `--d-window` | 180ms, linear | The window sliding one byte. |
| `--d-merge` | 260ms | One Huffman merge. |
| `--d-coder` | 300ms | Swapping the instrument, switching chapter, the byte bar. |
| `--d-interval` | 420ms | One interval zoom. |
| `--d-sample` | 500ms | A new text arriving. |

### 6.3 The orchestrated moment

The interval zoom. The bar never appears to shrink; the world expands around it. It is
user-started and it is the only thing in the app that moves unprompted once started.

### 6.4 Staleness

Above 50,000 characters the figures are recomputed on idle rather than on every keystroke.
While that is pending the rail's reading fades rather than blanking: a number you can see
is a moment behind is better than a number that disappears while you type.

### 6.5 Reduced motion

`prefers-reduced-motion: reduce` zeroes every duration token, turns the interval zoom into
a stepper, and says so in the interface rather than silently changing behaviour.

---

## 6a. The first five seconds

Everything above describes a page for someone who already knows what it is. This section is
the audit of what a stranger sees, and what was changed because of it.

**What the landing view used to say.** A wordmark, an aphorism — *"Entropy is not a property
of a text. It is a property of a text under a model."* — a big `8.36`, a wall of mottled
prose, and a chart climbing to 50. Read cold, that is an academic paper, a broken font, or a
dev tool for someone else. The word *compression* appeared nowhere but the wordmark, nothing
said the specimen was editable, and the aphorism corrected a misconception the visitor did
not hold yet: it is the last line of the argument used as the first.

**The lead states the job.** "Measure what a text costs to compress — and why that answer
depends on the model." A verb, an object, a payoff. The thesis moved to the head of the
staircase, which is the one place on the page that demonstrates it.

**The default is a working compression, not a failure.** Order 1, not 2. At order 2 the
model description of the default sample is larger than the code stream it pays for, so the
total came to 10.87 kB against a 10.4 kB original: the app opened by making the file bigger,
presented as a bare `1.045×` that nobody could read as a failure — while the staircase four
hundred pixels away already said order 1 was cheapest. The app knew the good answer and
opened on the bad one. Order 1 lands at 0.569×, and the ratio now says which side of 1 it
fell on in words: *43% smaller*, or *larger than the original* in the model-cost gold.

**The ramp has a key.** The colouring is the best idea in the app and the first thing that
looks broken; its only explanation named a coined term and a logarithm, which explains an
unfamiliar picture with two more unfamiliar things. There is now a gradient key drawn from
the ramp tokens themselves, and the sentence leads with the plain-language version and
introduces *surprisal* second, as the name for what you are already looking at.

**The chart has a floor.** A dotted rule at what the text costs uncompressed, and the
minimum annotation carries its value. Charts are read shape-first: the shape argued "up"
while the caption argued "minimum", and shape wins. With the rule, *below this line is
smaller than what you started with* is the first thing the eye can do with it.

**The phone gets a demonstration.** The first line of coloured text was at y=1126 on an
844px viewport — the whole first screen was chrome, so a phone visitor saw a settings form.
The masthead's tools collapse to one row of unlabelled controls, the order control and the
adaptive switch pair into one row rather than stacking, and the two standing caveats move
under the surface they qualify. First line of text now lands at 769.

Footnotes belong at the foot. Neither caveat contains anything focusable, so reordering them
with CSS cannot desynchronise the tab order from what is on screen.

---

## 6b. Three panels between the staircase and the coders

Added after an ideation pass that asked which additions follow from the concept rather than
from the category. Each of these is a step of the thesis the app was asserting in prose and
could not draw.

### Where the minimum moves

The staircase says order N is cheapest *for this text at this length*, and the argument is
that the N moves right as the text grows. The only way to change the length was to paste a
different text, which changes the text as well and so demonstrates nothing. This measures
the same text at a dozen log-spaced prefixes and steps the optimum against length.

Drawn as a step, not a slope, for the same reason the staircase is: there is no order 0.6,
and a line between integer orders asserts a continuity that does not exist.

It is the one control in the interface that is not instant. Twelve analyses come to about
three and a half times one full analysis rather than twelve times, because most of the
prefixes are short — but that is still far too much for the typing path, so it runs on an
explicit action and the button says what it is about to do.

**Prefixes are not samples.** The first tenth of a novel is a different register from the
whole of it. The panel says so, because the measurement cannot.

### The model description

"Model cost is measured, not estimated" is the project's load-bearing claim and the model
was the one figure in the interface with nothing behind it but a number. The panel takes the
number apart into the parts the format actually writes, and prints both totals side by side
with the word `reconciled` between them. The sections sum to `serialiseModel().length`
exactly; a test asserts it at every order.

The section bars are share of the whole description, not share of the largest section. At
order 1 the counts are 95% of it and everything else is a rounding error — that is the
finding, and a bar scaled to the largest section would show counts at full width whatever
they cost.

The singleton argument is conditional. At order 3 most contexts occur once and their
accumulation is what turns the model line upward; at order 1 three contexts out of
fifty-four are singletons and saying the same thing there would be false. The copy checks
the share before making the claim.

Showing the format invites the reader to judge the format, and sometimes they will be right.
That is stated in the panel rather than defended.

### What adaptive costs

The adaptive toggle was quietly breaking §7.1. Flip it and the model description collapses,
the order-5 total falls off a cliff, and the honest conclusion a reader draws is that a
high-order model is free after all — the exact misconception the app exists to remove,
re-created inside the app that removes it.

Two running totals, both description-inclusive, so neither side is given anything the other
pays for. Static charges its whole count table before the first character; adaptive charges
its alphabet, and then pays in the code stream for what it does not yet know.

**The rate axis is logarithmic and has to be.** These are running averages, so at character
one a static order-1 model has spent its entire 1.28 kB on a single symbol: ten thousand
bits per symbol. On a linear axis that one point sets the scale and everything anyone came
to see collapses onto the floor. The spike is real and worth showing — it is what "paid up
front" looks like — so the axis is logarithmic, ticked at decades, and labelled as such.

The verdict has three cases, not two. "Overtakes at character 1" is what the measurement
says when the static model has already spent kilobytes before coding anything, and it reads
as though adaptive won a race that was in fact over before it started. That gets its own
sentence: *cheaper at every length*.

---

## 7. Copy

English. Sentence case. No exclamation marks.

Terms are introduced once, in one sentence, at the point of first use: surprisal,
conditional entropy, prefix code, renormalization. No glossary page; a glossary is where
explanations go to be ignored.

Every number carries its unit. Bits per symbol, not "entropy: 4.13".

**Assumptions are visible, always.** The smoothing choice, the LZ77 token encoding and the
model serialisation format are all arbitrary in ways that change the numbers. Each is
stated next to the figure it affects, in the instrument voice, hung off a rule in the left
margin so it reads as attached to that figure. None is collapsed behind a disclosure. This
app's credibility rests on not hiding its assumptions, and a disclosure is hiding.

**Controls carry their consequence.** The adaptive switch says "model costs nothing" or
"model is transmitted", because that is the most useful sentence in the app and it was
otherwise discoverable only by watching a chart. The two share actions say what each puts
in the URL, because one of them puts someone's private writing in the address bar.

---

## 8. Quality floor

- Full recompute under 16ms for 10,000 characters, so typing needs no debounce.
- The specimen virtualises above 12,000 characters, and says that browser find will not
  reach past the drawn window.
- Every selection in the app is on the keyboard path: table rows carry real buttons, the
  caret drives the lens, the staircase's click-a-column gesture has the H0–H5 radio group
  as its keyboard equivalent, and the chapters are a tablist with keys 1 to 5.
- One focus treatment everywhere: a 2px ink ring at 2px offset.
- A skip link ahead of everything, to the instruments.
- No network at runtime. Fonts bundled, samples bundled.

---

## 9. Relationship to the house layer

The motion rule and the "display and computation are one object" rule carry over from Suara
ke Kursi and Anatomi QRIS unchanged. What is new here is the two-ground palette and the
paper/instrument split — warm against cool since the October 2026 redesign — and both exist for the same reason the house rules do: the subject
decided them. This app is about the difference between a thing and a measurement of it, so
the thing and the measurement are made of different materials, and the reader can see the
join.
