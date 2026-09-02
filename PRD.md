# Compression Lab — Product Requirements

**Name:** Compression Lab
**Descriptor:** What a text costs, and what that cost depends on
**Type:** Static single-page application. No backend, no network at runtime.
**Deploy target:** GitHub Pages.
**Interface language:** English, single locale. No i18n framework.

> Note on language. The interface is English. Several bundled sample texts are not, because
> the app's most interesting comparison is across languages (§4.3). Sample text is data,
> not localisation — do not conflate the two.

---

## 1. The thesis

Most compression explainers teach three algorithms and imply there is a floor they all
approach. That is wrong, and the wrongness is the interesting part.

**Entropy is not a property of a text. It is a property of a text under a model.**

The number people quote as "the entropy of this text" is the order-0 entropy — symbol
frequencies, nothing else. Condition on the previous character and it drops. Condition on
two and it drops again. There is no single floor; there is a staircase, and every step
down costs something to describe.

This produces the app's actual argument, which is more useful than "compression approaches
a limit":

1. Higher-order models predict better, so the code stream shrinks.
2. Higher-order models are bigger, so the model description grows.
3. **Total size = code stream + model description**, and that total has a minimum at some
   order which depends on how long the text is.
4. Short text: low order wins. Long text: high order wins.
5. LZ77 sidesteps the whole trade by building its model implicitly out of the text it has
   already seen, paying no separate model cost at all.

Point 5 is why LZ77 routinely *beats* order-0 entropy, which looks like a paradox if you
believe in a floor and is obvious once you don't.

## 2. Correction to a common framing

An earlier framing of this project described the entropy measurement as a line the
algorithms approach but never cross. That holds for Huffman and arithmetic coding against
the model they were given. It does not hold for LZ77, and the app must not imply that it
does.

Anywhere a limit is drawn, it must be labelled with the model it belongs to. There is no
unlabelled entropy line in this app.

## 3. Scope

### In

- **Models:** order 0 through order 5, both static (two-pass, measured over the whole
  input) and adaptive (one-pass, updated as coding proceeds).
- **Coders:** Huffman, arithmetic coding, LZ77.
- **Measurement:** conditional entropy at each order, actual bits per symbol achieved by
  each coder, model description cost, total size.
- **Six instruments** (§5), one of which is the app's orchestrated moment.
- Bundled sample texts including a parallel corpus (§4.3).

### Out

- **LZW, BWT, PPM, ANS, DEFLATE.** BWT in particular is very visual and very tempting.
  Save it. Three coders and the model staircase is already a full app.
- **Binary and image input.** Text only. Byte-level input muddies the model story.
- **File upload.** Paste or choose a sample. No file API, no drag-and-drop.
- **Decompression as a user-facing feature.** Decoders exist and are tested (§6), but the
  app does not present decompression as a workflow.
- **Any claim that one algorithm is best.** The point is the trade-off.

### Limits

Input capped at 200,000 characters. Order capped at 5. Above either, the model tables get
large enough to stall a keystroke-driven recompute and the visualizations stop being
legible. State both limits in the interface rather than silently truncating.

## 4. Data

The app has no dataset. Every number is computed from the user's input. This is the reason
it is buildable in a fraction of the time of the other projects.

The only shipped content is sample text.

### 4.1 Samples

- A long English literary passage (public domain).
- A page of English source code.
- Highly repetitive text (a repeated phrase) — makes LZ77 win enormously.
- Near-random text (uniform random letters) — makes every coder fail, which is the point.
- DNA-like text over a four-symbol alphabet.

### 4.2 Choosing well

Samples must span the space the app is trying to teach: high order-0 entropy with low
order-2 entropy (natural language), low order-0 entropy (repetitive), and incompressible
(random). A user who tries all three should be unable to hold on to a single-floor
intuition.

### 4.3 The parallel corpus

Bundle the Universal Declaration of Human Rights in English, Indonesian, German, and
Finnish. It is public domain, genuinely parallel, and available in hundreds of languages.

This exists to support one specific, testable claim: **agglutinative and affix-heavy
languages carry more substring redundancy than character-level entropy reveals.**
Indonesian's morphology means LZ77 should beat the order-0 prediction by a wider margin on
the Indonesian text than on the English one, even though the two say the same thing.

Keep this feature small. It is a sample chooser plus a comparison row on the staircase, not
a research apparatus. If it grows past that, cut it back.

**Optional extension, only if the Kupas stemmer is easy to reuse:** run the Indonesian text
through the stemmer, strip affixes, re-measure. The LZ77 advantage should shrink, because
the redundancy that created it has been removed. That is a clean calibration control and a
genuine cross-project link. It is a nice-to-have, not v1.

## 5. Instruments

### 5.1 The staircase (constant, always visible)

The app's central chart, and the thing every other view supports.

- Conditional entropy H₀ through H₅ as descending steps, in bits per symbol.
- Each coder's achieved rate plotted against those steps.
- The model description cost overlaid as a rising curve.
- Total size — code stream plus model — as a third curve with a visible minimum.

Dragging the model order moves a marker along the staircase and every coder configured to
use that order re-plots live.

The minimum of the total curve is the app's headline number: *for this text, at this
length, order N is optimal.* Paste a longer text and the minimum moves right. That moment
is the whole thesis, delivered without a paragraph.

### 5.2 Surprisal over the text

The user's actual text, rendered as readable prose, with every character coloured by its
cost in bits under the current model.

Predictable characters fade toward the page colour. Surprising characters darken. Cost
becomes visibility — see DESIGN.md §2.3, where this idea drives the entire palette.

At order 0 the colouring tracks letter frequency and looks like noise. Raise the order and
structure appears: word beginnings stay dark, word interiors fade, and in a morphologically
rich language the affix boundaries light up while the predictable interiors go quiet.

This is where entropy stops being a number.

### 5.3 Huffman tree construction

The priority queue, the repeated merge of the two lowest-frequency nodes, the tree
assembling bottom-up, and the codes falling out as root-to-leaf paths.

Steppable and scrubbable. Selecting a leaf highlights every occurrence of that symbol in
the text panel.

### 5.4 Huffman's waste

For every symbol: its ideal cost −log₂(p) against the integer code length Huffman actually
assigned. The gap between them, summed and weighted by frequency, is exactly what Huffman
loses to arithmetic coding.

Shown as an area rather than a number, because the number is small and unconvincing and
the area is neither.

### 5.5 The sliding window (LZ77)

Search buffer and look-ahead buffer as two adjacent regions of the text. The match finder
scans backward; the longest match highlights simultaneously in both places; a (distance,
length, next) triple is emitted; the window slides.

Window size and look-ahead size are user-controllable, because watching a match fall out of
range as the window shrinks is the clearest possible explanation of why window size
matters.

### 5.6 The interval (arithmetic coding) — the orchestrated moment

The [0,1) interval subdivided by symbol probabilities. Each coded symbol selects a
subinterval, and the view continuously zooms so the active interval always fills the frame.

The interval never appears to shrink. The world expands around it. Precision being consumed
becomes something you watch rather than something you are told about.

**Honesty requirement.** The comprehensible visualization is the idealised real-number
interval. The correct implementation is an integer range coder with renormalization and
underflow handling. The app shows the idealised view, says plainly that it is an
idealisation, and provides the renormalization view (§5.7) as the bridge to what the engine
actually does. Do not visualise something the engine is not doing without saying so.

### 5.7 Renormalization and the bit ledger

When the interval's top bits agree, they are emitted and the interval rescales. Shown as a
secondary track beneath the interval view: bits leaving, interval rescaling, underflow
counter.

The bit ledger runs alongside — the output stream growing symbol by symbol, each symbol
annotated with what it actually cost. Watching a common letter cost 1.2 bits and a rare one
cost 8.4 is the entire intuition of entropy in one column of numbers.

## 6. Correctness

Every coder round-trips or the app is lying.

1. `decode(encode(x)) === x` for every coder, over a corpus that includes: empty string,
   one character, one character repeated, all-distinct characters, text with characters
   outside the BMP, and each bundled sample.
2. **Huffman:** output length equals Σ frequency × code length, exactly. Code is prefix-free
   and canonical.
3. **Arithmetic:** output length is within 2 bits of −Σ log₂ p(symbol) under the same model.
   This is the theoretical bound and it is a strong test — a coder that passes it is almost
   certainly correct.
4. **LZ77:** round-trip including overlapping matches, where distance is less than length.
   This is the classic implementation bug and it needs an explicit test.
5. **Entropy:** H₀ computed by the engine matches a direct independent calculation.
   Conditional entropies are non-increasing in order for every sample.
6. **Model cost:** the model description size is computed, not estimated, and is itself
   round-trippable — a decoder given only the code stream and the model description must
   reconstruct the text.

Point 6 is the one most likely to be skipped and it is the one holding up the entire
thesis. If model cost is a hand-wave, the total-size minimum is fiction.

## 7. Commitments

### 7.1 Model cost is always counted

Any figure the app presents as a compressed size includes the model description unless it
is explicitly labelled "code stream only". A static high-order model that appears free
makes higher orders look strictly better, which is false and is the exact misconception
this app exists to remove.

The interface always shows the split: code stream, model, total.

### 7.2 Every limit is labelled with its model

No unlabelled entropy line. Ever. See §2.

### 7.3 The visualization matches the implementation

Where a view is an idealisation of what the engine does (§5.6), the app says so at the
point of viewing, and provides the bridge.

### 7.4 No leaderboard

The app never declares a winner. Each coder has regimes where it wins and the app's job is
to make those regimes visible. Copy describing outcomes uses no comparative adjectives
beyond the measured numbers.

### 7.5 Nothing leaves the device

No network requests at runtime. People paste their own writing into this.

## 8. Acceptance criteria

1. All round-trip and bound tests in §6 pass in CI and block deploy.
2. Typing recomputes models, entropies and all three coders in under 16 ms for a
   10,000-character input, with no debounce.
3. The 200,000-character cap is enforced with a stated message, not silent truncation.
4. Dragging the model order re-plots the staircase and re-colours the text at 60 fps.
5. The interval zoom runs smoothly for at least 200 symbols without visual precision
   artefacts.
6. `prefers-reduced-motion` honoured: every animation becomes steppable state.
7. Fully keyboard operable, including the Huffman tree, the window stepper, and the
   interval stepper.
8. Every instrument has a keyboard-reachable table equivalent.
9. Zero runtime network requests, verifiable with an empty network tab.
10. Bundle under 200 KB gzipped, samples included.
11. Usable at 380 px.
