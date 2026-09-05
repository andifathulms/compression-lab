# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: engineers and recruiters assessing the maker's work.** They arrive to judge what
this person builds. The app is the artifact and the measured numbers are the argument. They
skim the surface first, then dig into the repository, the tests, and the reasoning in the
commit messages. They are technically literate and will notice a hand-waved figure.

**Secondary, and the audience the content is written for:** a reader who has met a
compression explainer before, believes there is a single entropy "floor" that algorithms
approach, and is meeting the model-cost trade-off for the first time. Every explanation in
the interface is pitched at this reader; the primary audience is watching how well that is
done.

## Product Purpose

Compression Lab measures what a text costs to store, and shows that the cost is a property
of the text *under a model* rather than a property of the text. Conditioning on more
previous characters predicts better and shrinks the code stream, but the model that does
the predicting has to be described too, and the total has a minimum at some order which
depends on how long the text is. A reader who has used it should be unable to keep the
single-floor intuition.

Success, as confirmed by the maker, is four things at once: a reader loses the single-floor
intuition; the project stands as evidence of how the maker builds; it gets linked and cited
as the thing that explains the trade-off; and someone who knows compression can check the
claims and find nothing hand-waved. The fourth is load-bearing for the other three.

## Positioning

Most compression explainers teach three algorithms and imply a floor they all approach.
This one is built on the correction: there is no single floor, there is a staircase, and
every step down costs something to describe. Two commitments make the claim checkable
rather than rhetorical, and a neighbouring explainer could not truthfully copy either:

- **Model cost is measured, not estimated.** The model is really serialised to bytes and
  really deserialised, and the tests assert that a decoder given only the code stream and
  the model bytes reproduces the text. The model-cost figure in the interface is
  `modelBytes.length * 8`, a measurement.
- **Every coder has a working, tested decoder**, even though decompression is not a
  user-facing feature, because a coder without a decoder is a coder nobody has verified.

Everything is written from scratch: models, entropies, three coders, three decoders, bit
I/O, the model serialiser, and every chart. No compression library, no entropy library, no
charting library.

## Operating Context

A reader opens a URL and lands directly in the instrument, which is already loaded with a
sample text. They type or paste into the text surface and every figure recomputes as they
type. They move the model order slider, switch coder, toggle the model between static and
adaptive, and read the consequences off the staircase and the instrument panels.

People paste their own writing into it. That fact drives real product decisions: nothing is
uploaded, nothing is fetched, and typed text is kept out of the URL unless the reader
explicitly asks for a link that includes it.

A second surface, `/about/`, is a static page that makes the argument in prose for someone
who is not ready to operate the instrument, and links into it.

## Capabilities and Constraints

**Confirmed functionality.** Order-0 through order-5 models, static and adaptive.
A length sweep measuring where the cheapest order sits across a dozen prefixes of the same
text; a breakdown of the model description into the parts the format writes, reconciled to
the serialised byte length; a learning curve comparing static and adaptive running totals
with both descriptions included; and a CSV export of every figure carrying the rules that
produced it.
Huffman, arithmetic coding and LZ77, each with a tested decoder. Conditional entropy at
every order, per-character surprisal, measured coder rates, measured model description
cost, and the total. Six instruments: the staircase, the surprisal-coloured text surface,
the Huffman tree and its waste plot, the LZ77 sliding window, the arithmetic interval with
its renormalization track, and the bit ledger. A parallel-corpus comparison row. Sample
chooser, two grounds (paper and bench), and a share action that is two explicit choices.

**Out of scope and deliberately so.** LZW, BWT, PPM, ANS and DEFLATE. Binary and image
input. File upload. Decompression as a user-facing workflow. Any claim that one algorithm
is best; the subject is the trade-off.

**Technical constraints.** Static single-page app, no backend, zero network requests at
runtime, deployed to GitHub Pages under `/compression-lab/`. Vite, React 18, TypeScript
strict, plain CSS with custom properties, Vitest. Zero runtime dependencies beyond React;
no component library, no charting library, no animation library. `src/engine/` is pure: no
React, no DOM, no randomness, no `Date`. Fonts are self-hosted and samples are bundled into
the JavaScript, not fetched.

**Stated limits.** Input capped at 200,000 characters and model order capped at 5, both
enforced with a message rather than silently. Above 50,000 characters the figures recompute
on paste and on idle rather than on every keystroke, and the interface says so. Full
recompute for 10,000 characters targets under 16 ms so typing needs no debounce.

**Terminology the interface owns.** Surprisal, conditional entropy, prefix code,
renormalization, model description, code stream, order. Each is introduced once, in one
sentence, at the point of first use. There is no glossary page.

**Undecided.** Whether the Indonesian stemmer calibration control (PRD §4.3, running the
Indonesian sample through Kupas to strip affixes and re-measuring) is ever built. It is a
nice-to-have and was never part of v1. An ideation pass weighed it and declined: a stemmer
is a large, opinionated, language-specific artifact whose correctness the app would then be
claiming, it applies to one sample of nine, and it answers a question about morphology
rather than about what compression costs.

**Also declined, and why:** batch mode over a corpus the reader brings, which needs file
upload — a committed non-goal — and would turn an explainer into a research apparatus.

## Brand Commitments

- **Name and descriptor:** Compression Lab. "What a text costs, and what that cost depends
  on." Tagline in the brand package: "Bits, and what they depend on."
- **The mark** is a staircase of conditional entropy stepping down, with one riser and one
  dot in gold. Gold means the model and nothing else, in the mark and in the charts alike.
  Source files are in an untracked `exports/` package; the files the site serves are in
  `public/`, and `docs/brand/` holds the lockups the README uses.
- **Interface language is English**, single locale, no i18n framework. Several sample texts
  are not English, because the cross-language comparison is a feature; sample text is data,
  not localisation.
- **Voice:** sentence case, no exclamation marks, every number carries its unit. Terms are
  introduced once at first use. The arbitrary choices that change the numbers are stated in
  the interface next to the figures they affect, never hidden behind a disclosure.
- **Attribution:** the site carries a maker's mark crediting Andi Fathul Mukminin, with
  links to portfolio, GitHub, LinkedIn and Instagram.
- **Relation to the maker's earlier apps** (Suara ke Kursi, Anatomi QRIS): the working
  rules carry across and are binding — display and computation are one object so they
  cannot drift, continuous controls map directly to the pointer while discrete ones get a
  timed transition, and assumptions are stated rather than buried. The visual world does
  not carry across. Compression Lab's own language owes the earlier apps nothing.

## Evidence on Hand

- **The measurements are the evidence, and they are reproducible.** Every figure in the
  interface and in the documentation comes from `src/engine/` running over bundled text.
  Nothing is illustrative.
- **Bundled samples** in `src/samples/`: English literary prose, a page of TypeScript, a
  repeated phrase, near-random letters, a four-symbol DNA-like text, and the Universal
  Declaration of Human Rights in English, Indonesian, German and Finnish (articles 1 to 30,
  strictly parallel; English, Indonesian and Finnish from Wikisource, German from the
  German Wikipedia article carrying the official joint translation).
- **The parallel-corpus result**, measured at a 4,096-byte window: Indonesian shows the
  widest LZ77 margin over order-0 entropy (0.851 bits) and the lowest order-0 entropy;
  Finnish shows the narrowest (0.340) despite being the most agglutinative of the four. The
  claim under test is only half borne out and the interface says so. Four texts of nine
  thousand characters do not settle it and the app does not pretend otherwise.
- **The test suite** is the correctness evidence: round-trip tests for all three coders, a
  bounds test asserting arithmetic output within two bits of `-Σ log2 p`, an
  overlapping-match test for LZ77, model-cost round trips at every order over the whole
  corpus, and a performance test that reports p50, p90 and max.
- **Absent, and not to be fabricated:** there are no users, no testimonials, no traffic or
  adoption figures, no citations, no press, no benchmark comparisons against other tools,
  and no photography of any kind. There is no licence file. Any of these appearing in a
  surface would be an invention.

## Product Principles

1. **Every number is measured, or it does not appear.** Model cost is a real serialisation.
   Coder rates come from real encoders. If a figure would have to be estimated, the honest
   move is to say so beside it, not to smooth it.
2. **Display and computation are one object.** Every coder emits a trace and the views
   render that trace. A view never re-simulates, because two implementations of the same
   step will eventually disagree and the picture will be the one that is wrong.
3. **State the arbitrary choices in the interface.** The smoothing constant, the LZ77 token
   encoding and the model serialisation format all change the numbers. Each is named next
   to the figure it moves. The project's credibility rests on not hiding them.
4. **The reader's text is theirs.** Nothing leaves the device, nothing is fetched, and
   typed text stays out of the URL until the reader asks for a link that includes it, on a
   control that says what it will do.
5. **Teach the trade-off, never crown a winner.** No leaderboard, no unlabelled entropy
   line. Wherever a limit is drawn it is labelled with the model it belongs to.

## Accessibility & Inclusion

Confirmed requirements, from PRD §8 and enforced in the build: fully keyboard operable
including the Huffman tree, the window stepper and the interval stepper; every instrument
has a keyboard-reachable table equivalent; `prefers-reduced-motion` turns every animation
into steppable state; usable at 380 px. Text is DOM spans rather than canvas so the
specimen stays selectable, searchable and legible to a screen reader.

The muted palette was measured rather than trusted: every colour used for text at 10.5 to
13 px clears 4.5:1 against the darkest of the three light grounds. The low end of the
surprisal ramp is deliberately below that floor, which is legitimate only because the tint
is redundant encoding — every value it carries is also in the readout under the specimen
and in the tables.
