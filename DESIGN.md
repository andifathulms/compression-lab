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
different materials. The specimen sits on paper: a serif face, a real reading measure,
generous margins. The apparatus sits on a recessed machined ground: a monospaced face,
dense figures, hairline rules and framed plots. The seam between the two columns is a real
edge, and it is the app's subject drawn rather than described.

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
the rail. Everything else steps down from it. On the instrument side the size hierarchy is
carried entirely by the figures — every panel heading is the same size — because eight
panels with eight heading sizes read as eight competing arguments.

---

## 2. Colour

The palette is defined once, as tokens, and instantiated on two grounds. The dark ground is
not an inversion: the roles are the same, the values are chosen independently, and the ramp
changes direction rather than being flipped.

### 2.1 The two grounds

| Token | Paper | Bench | Use |
|---|---|---|---|
| `--page` | `#FBFAF7` | `#131415` | The specimen. Warm off-white, or the lighter of the two dark grounds. |
| `--sunk` | `#F1EFE8` | `#0B0C0D` | The bench: the recessed ground the apparatus sits on. |
| `--surface` | `#FFFFFF` | `#1B1D1F` | A raised control, a framed plot, a scrolling table. |
| `--surface-hover` | `#F6F4EE` | `#23262A` | The same, under a pointer. |
| `--ink` | `#191817` | `#ECE9E2` | Text, the total line, the selected state. |
| `--ink-mid` | `#57544E` | `#A09B91` | Prose that qualifies a figure. The entropy line. |
| `--ink-faint` | `#6F6B62` | `#89857E` | Labels, axis numerals, disabled controls. |
| `--rule` | `#E3DFD5` | `#292C2F` | Hairlines between panels. |
| `--rule-strong` | `#C9C3B5` | `#3D4145` | Slider tracks, table header rules, menu borders. |

On paper the specimen is *lighter* than the bench; on the bench it is *lighter* than the
bench too. The specimen is always the raised material. That is the one invariant the two
grounds share, and it is what keeps the layout reading the same way in both.

### 2.2 The surprisal ramp

Five stops, traversed by cost in bits, rescaled if the alphabet tops out below 8 bits — and
the interface says when it has been rescaled, because a rescaled ramp changes what the page
looks like.

| Bits | Paper | Bench |
|---|---|---|
| 0 | `#FBFAF7` | `#131415` |
| 2 | `#D6D0C2` | `#33383C` |
| 4 | `#948C7A` | `#676C6F` |
| 6 | `#4C483F` | `#A8A79E` |
| 8 | `#191817` | `#F7EEDC` |

Both start at the ground and end at full presence. The paper ramp ends in ink. The bench
ramp ends in a warm near-white — the only place in the app where warmth means intensity —
so that on the dark ground an unexpected character reads as a signal rather than as one
more shade of grey.

The low end of both ramps is deliberately below the 4.5:1 contrast floor. That is
legitimate because the tint is redundant encoding: every value is also in the readout under
the specimen and in the tables.

### 2.3 The three coders

Each coder has one colour. It appears on that coder's segment in the control, its line and
point on the staircase, the code-stream bar in its size split, and the marks its instrument
makes in the specimen. Nowhere else. There is no legend, because the control, the plot and
the instrument already agree.

| Coder | Paper | Bench | Why |
|---|---|---|---|
| Huffman | `#A65615` | `#E5A05C` | Warm, discrete, stepped. |
| Arithmetic | `#10697C` | `#52C3D8` | Cool, continuous, flowing. |
| LZ77 | `#67449E` | `#B598EF` | Neither; it is about memory, not probability. |

Each also has a tint (`--huffman-tint` and so on) for fills that sit under text.

### 2.4 Two functional colours

| Token | Paper | Bench | Use |
|---|---|---|---|
| `--model-cost` | `#80691C` | `#D8B95D` | The model description, everywhere it appears. |
| `--match` | `#2B7950` | `#58C48D` | An LZ77 match, marked in both places at once. |

The model description is the only quantity in the app drawn as a **hatch** rather than a
solid fill. It is overhead, not output, and a solid block beside the code stream would read
as more of the same substance. The hatch takes the model-cost token, so it follows the
theme.

### 2.5 Contrast

Every colour used for text clears 4.5:1 against the **worst** of the three grounds it can
appear on — the bench on paper, the raised surface on the bench. That is checked
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

Two voices, assigned strictly. Both are self-hosted variable faces subsetted to Latin and
Latin Extended, bundled with the app; nothing is fetched at runtime.

**Literata** is the prose voice: the specimen, the notes, the argument, the claim in the
masthead. A screen-reading face with a large x-height, which is what lets a character
survive being tinted most of the way toward the ground colour.

**JetBrains Mono** is the instrument voice: every number, label, axis, control, table cell
and panel heading, with tabular figures throughout. The staircase animates its numbers and
proportional figures would jitter.

Nothing measured is set in the prose face. Nothing prose-like is set in the instrument
face. The one deliberate crossing is the sliding-window strip, where the text is set in the
instrument voice — because there it is not being read, it is being indexed, and a
monospaced grid is what makes a distance of nine legible as nine.

### 3.1 Scale

One ratio, 1.2, from a 16px base. Six steps, plus a clamped display.

| Token | Size | Derivation | Use |
|---|---|---|---|
| `--t-display` | `clamp(27.65px, 1.5rem + 1vw, 39.81px)` | 16 × 1.2³ → 1.2⁵ | The rail's reading. One per page. |
| `--t-headline` | 27.65px | 16 × 1.2³ | A panel's headline figure. |
| `--t-figure` | 23.04px | 16 × 1.2² | A panel's leading figure. |
| `--t-text` | 19.2px | 16 × 1.2 | The specimen, and the app name. |
| `--t-body` | 16px | base | Prose notes. |
| `--t-data` | 13.33px | 16 ÷ 1.2 | Table cells, controls, readouts, assumptions. |
| `--t-micro` | 11.11px | 16 ÷ 1.2² | Panel headings, field labels, axis numerals. |

Plot glyphs are on their own two-step ratio — `--t-plot` (10) and `--t-plot-tick` (8.33) —
because those are viewBox units that scale with the chart rather than pixels on the page.

This replaced nine ad-hoc sizes. Two pairs were effectively the same size (10.5 and 11.5,
17 and 17) and three sat on no ratio at all; eight more sizes were hardcoded in component
CSS, which is the thing tokens exist to prevent. A scale with a duplicate in it is not a
scale, it is a list.

**Prose sits at 16px, and the specimen at 19.2px.** They were 15 and 17. Both are read
rather than scanned, and 15px is below the floor for that.

Tracking is a token too: display numerals are tightened (`-0.02em`) or a five-digit figure
reads as a serial number; micro labels are opened out (`0.08em`–`0.11em`) or uppercase mono
at 11px sets solid.

### 3.2 Prohibitions

Sentence case throughout, except the tracked uppercase micro-labels, which are a machine
convention and not a heading. No word in a heading accented in colour or weight — colour
already means cost. Emphasis is on language, never on a number: the italic on
*surprisal* where the term is introduced, and the bold on the thesis sentence at the head of
the staircase. Every number carries its unit.

---

## 4. Layout

### 4.1 Three bands, then two columns

```
┌───────────────────────────────────────────────────────────┐
│ masthead   name · claim              text · share · ground│  scrolls away
├───────────────────────────────────────────────────────────┤
│ rail       8.36 bits/symbol   coder · order · adaptive    │  pinned
├──────────────────────────┬────────────────────────────────┤
│ specimen (paper)         │ apparatus (bench)              │
│  the text, tinted        │  staircase — pinned            │
│  hover readout           │  coder bay                     │
│                          │  parallel corpus               │
└──────────────────────────┴────────────────────────────────┘
```

The **masthead** states the claim and holds the chrome that is not a measurement.

The **rail** is pinned and is the app's answer to its own question, together with the only
three controls that move it. The reading and the controls are one object because the model
order is the primary control and it belongs next to the number it changes, not at the far
end of the page from it. Under compare the reading shows the lowest of the three and names
it; a blank reading or an arbitrary one would both be worse.

The rail's height is measured at runtime and published as `--rail-h`, which the two pinned
columns offset against. It wraps differently at every width, so it cannot be a constant.

### 4.2 The specimen

Its own scroll region, pinned under the rail, at `--measure` (36rem). It fades at its
scroll edge, because a line of prose sliced in half horizontally reads as a rendering
fault. The hover readout is a fixed line at the foot of the column, not a tooltip: a
tooltip that follows the pointer across 200,000 characters is a tooltip permanently in
front of the character you wanted to look at next.

### 4.3 The apparatus

One constant anchor and one interchangeable part. **The anchor is the rail, not the
staircase.** The staircase scrolls with the rest of the column.

That is a change from the original design, and the reason is arithmetic. The staircase is a
thousand pixels tall — plot, order control, split, table, assumption — and the rail is
another ninety. Pinned together in a nine-hundred-pixel viewport they are the entire
screen: the scrollbar runs and nothing moves, and the bottom of the staircase is never
reachable at all, because a sticky element taller than its own slot never releases.

The rail does the anchor's job in ninety pixels. It carries the reading, the coder and the
order, it does not change when the instrument below it changes, and it is what makes the
set of views read as one subject rather than as four unrelated screens.

Below it: the staircase, then the coder bay swapping its instrument, then the parallel
corpus row, then the smoothing note.

Anything pinned has to leave room for what it describes. The specimen and the rail together
come to a little over half the viewport, which is the budget.

### 4.4 Grid and rhythm

4px base scale, so the dense side has a half step. Panels are separated by a hairline and
by the ground under them, never by cards. No shadow on a panel. Radius exists only on
things a pointer touches — that is how a control announces that it is one — and on framed
plots and scroll boxes, which are surfaces rather than panels.

### 4.5 Responsive

Three breakpoints.

- **≤1180px** — gutters tighten, the specimen narrows toward its measure.
- **≤980px** — one column. The specimen goes first, because the app opens on a piece of
  text and it should be the first thing there is. Both pinned columns and the rail go
  static: two nested sticky scroll regions on a phone is a trap, and a rail that is most of
  a phone screen tall leaves nothing for the thing it describes.
- **≤560px** — the rail's controls take a full row each, the ground control keeps its marks
  and drops its words, and the total-size fact drops out; the ratio survives, because it is
  the only fact that does not need another number to be read against.

---

## 5. Instruments

### 5.1 The staircase

The app's centre. Literal steps: a flat segment per order joined by vertical risers,
because conditional entropy is defined at integer orders and a smooth curve between them
would assert a continuity that does not exist. The model description and the total are
defined at integer orders too, so they are points joined by straight segments at the centre
of each step.

It sits in a framed plot on the raised surface. It is pinned, and without a frame a panel
scrolling underneath it looks like part of the chart.

**The plot is the control.** Clicking a column picks that order, which is the gesture a
reader tries first. The H0–H5 buttons below are the same thing on the keyboard path.

**Two axis settings.** A static order-5 model on a short text costs upwards of fifty bits
per symbol, and against that the entropy steps — the thing the chart is named after —
descend across two pixels at the bottom of the plot. *Everything* fits the tallest series
and is the default, because the model line running away is the lesson. *The steps* fits the
entropy and the coder rates, and says in words that the model and total lines have run off
the top: a line that leaves the plot without saying where it went is a lie.

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

### 5.7 Bit ledger

Every symbol, its probability, its cost and the bits it emitted, in the arithmetic colour.
A row that emitted nothing gets a mark rather than a blank: it is not a gap in the ledger,
it is a symbol the coder absorbed without resolving a bit.

---

## 6. Motion

### 6.1 The rule

**Continuous control → direct mapping, zero easing.** The model order slider, the window
and look-ahead sliders, the interval scrubber. They follow the pointer exactly and
everything that re-plots from them re-plots on the same frame.

**Discrete control → timed transition.** Switching coder, switching sample, toggling
adaptive, toggling lazy matching, stepping a merge.

### 6.2 Durations

| Token | Duration | What |
|---|---|---|
| `--d-fast` | 120ms | A control acknowledging a pointer. |
| `--d-window` | 180ms, linear | The window sliding one byte. |
| `--d-merge` | 260ms | One Huffman merge. |
| `--d-coder` | 300ms | Swapping the instrument. |
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
The masthead's tools collapse to one row of unlabelled controls, the order slider and the
adaptive switch pair into one row rather than stacking, and the two standing caveats move
under the surface they qualify. First line of text now lands at 769.

Footnotes belong at the foot. Neither caveat contains anything focusable, so reordering them
with CSS cannot desynchronise the tab order from what is on screen.

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
  caret drives the hover readout, and the staircase's click-a-column gesture has the H0–H5
  buttons as its keyboard equivalent.
- One focus treatment everywhere: a 2px ink ring at 2px offset.
- A skip link ahead of everything, to the instruments.
- No network at runtime. Fonts bundled, samples bundled.

---

## 9. Relationship to the house layer

The motion rule and the "display and computation are one object" rule carry over from Suara
ke Kursi and Anatomi QRIS unchanged. What is new here is the two-ground palette and the
paper/instrument split, and both exist for the same reason the house rules do: the subject
decided them. This app is about the difference between a thing and a measurement of it, so
the thing and the measurement are made of different materials, and the reader can see the
join.
