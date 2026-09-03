---
target: all pages
total_score: 57
max_score: 72
na_heuristics: 7,10 (about only)
p0_count: 0
p1_count: 3
timestamp: 2026-09-03T05-15-58Z
slug: compression-lab-all-pages
---
Method: dual-agent (A: design review, isolated · B: detector and static evidence, isolated). Source-only: no browser, no screenshots, no overlay (no Chrome/Chromium/Edge/Playwright/Puppeteer on the machine).

# Critique: all pages

Two surfaces, two modes, scored separately.

## Design Health Score

### The app at / (Operate)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 4 | Rail reading, stale fade, "Recomputing.", live readout. Excellent. |
| 2 | Match system / real world | 4 | Terms introduced once at first use; every number carries its unit. |
| 3 | User control and freedom | 2 | Choosing a sample destroys typed text. No undo, no confirmation. |
| 4 | Consistency and standards | 3 | Three simultaneous controls for model order; bespoke focus on the text surface. |
| 5 | Error prevention | 3 | Over-cap paste refused, not truncated. Nothing guards text against the sample select. |
| 6 | Recognition rather than recall | 3 | Coder colour consistent across control/plot/panel; undone at 380px (~5px key). |
| 7 | Flexibility and efficiency | 3 | URL state, keyboard row-buttons, click-a-column with keyboard parity. |
| 8 | Aesthetic and minimalist design | 3 | Apparatus column is one scroll with up to ~10,600 ledger rows. |
| 9 | Error recovery | 3 | Overflow message names number, cap, reason, and that nothing changed. |
| 10 | Help and documentation | 3 | Assumptions on-page, never collapsed; prose argument only in a bottom footer link. |
| **Total** | | **31/40** | **Good** |

### /about/ (Persuade)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | No current-page marker on the site name, which is a link. |
| 2 | Match system / real world | 4 | Thesis in eleven words. |
| 3 | User control and freedom | 3 | Three exits to the lab, two to source. |
| 4 | Consistency and standards | 4 | Imports the app's tokens/fonts, same theme key, same assumption treatment. |
| 5 | Error prevention | 3 | No inputs. |
| 6 | Recognition rather than recall | 2 | Gold means total here, model in the app. Vocabulary breaks on arrival. |
| 7 | Flexibility and efficiency | n/a | Single static argument page; no repeat-use workflow. |
| 8 | Aesthetic and minimalist design | 4 | Real measured plot, hairlines not cards, hanging labels not a card grid. |
| 9 | Error recovery | 3 | Nothing can fail but the year script. |
| 10 | Help and documentation | n/a | The page is the documentation. |
| **Total** | | **26/32 (81%)** | **Good** |

Combined: 57/72.

## Design Specificity Verdict
App: emphatically specific, not liftable onto another product. Surprisal maps onto presence not hue; the paper/bench seam draws the subject; chart forms derive from the mathematics (literal steps, area for waste, the only hatched fill for model overhead). One drift: the masthead tool cluster is standard SaaS chrome, correctly demoted.
/about/: specific and above category norm; argues by measurement, publishes a half-supported hypothesis, hero is a real dual-scale plot. One wound: gold reassigned to the total.

Deterministic scan: 1 finding total. `side-tab` at src/App.css:174 (2px left accent on the over-cap warning) - GENUINE but narrow (transient warning, tokenised colour). about/index.html and index.html returned zero.
SCAN INTEGRITY CAVEAT: both HTML runs degraded - detector HTML parser modules (htmlparser2, css-select, css-tree, domutils) not installed, regex fallback, custom properties/selectors/computed contrast NOT evaluated. The zero-finding HTML results are an undercount. The src run used the full engine.
Visual overlays: none. No browser on the machine; no server started, no injection, no rendered-DOM/computed-contrast evidence.

## Overall Impression
The design is the argument and it mostly holds. What is missing is not craft but care toward the arriving reader: no privacy statement, destructive sample switch, and a central chart whose labels render ~5px on a phone. The app is better at proving things than at reassuring anyone.

## What's Working
1. Assumptions as a first-class typographic genre, attached to every figure they qualify, never collapsible.
2. Controls that carry their consequence (adaptive switch second line; share actions stating what enters the URL; compare naming the winner).
3. The two-setting staircase axis: honest default, and it says where a line went when it leaves the plot.
4. Contrast claim verified arithmetically (ink-faint on sunk 4.59:1; bench 4.60:1; huffman 4.61:1; model-cost on page 5.09:1).

## Priority Issues
[P1] SVG instruments unreadable at 380px. Staircase.css and WastePlot.css have zero media queries (verified). 620-unit viewBox at ~330px = 0.53 scale, so 10px axis/key/annotation render ~5.3px; Huffman ~5.3px, waste ~5.9px. Against PRODUCT.md's "usable at 380px", on the most likely first-contact device. Fix: media query raising to ~16 user units; key drops beneath the plot; PAD from measured width. -> /impeccable adapt

[P1] The app never says the reader's text stays on their device. Verified: no privacy wording anywhere in src/. Reassurance lives on /about/, in PRODUCT.md, and inside the opened share menu. Engineering is strict (zero network, bundled samples, text out of the URL); the interface takes no credit at the moment of decision. Fix: one sentence in the specimen head, assumption voice. -> /impeccable clarify

[P1] Choosing a sample destroys the reader's own text, silently and irreversibly. setText replaces outright; the parallel-corpus row actively invites the switch. Fix: keep lastUserText, offer "Restore your text (N characters)" beside the sample select. -> /impeccable harden

[P2] Interval letterboxed + reduced motion removes a capability. viewBox 240x320 in a 200x360 box (both verified): ~46px dead surface, DESIGN.md 5.6's "fills the frame" cannot hold. disabled={reduced} makes the `reduced ? 700` timing branch dead code. Reduced motion means do not animate, not do not advance. -> /impeccable audit

[P2] Gold means two things across surfaces. /about/ strokes the total in --model-cost; the app reserves gold for the model and draws the total in ink. PRODUCT.md: "Gold means the model and nothing else." The way-in page teaches the vocabulary wrong. Fix: total in ink, add a dashed gold model line to the hero plot. -> /impeccable polish

## Persona Red Flags
Engineer/recruiter (primary): source rewards reading. Red: App.tsx:13-14 still claims the staircase is pinned (retracted by App.css and the last commit); /about/ hero figures are hand-transcribed into SVG paths and asserted by no test; the gold inconsistency.
First-time reader: terminology introduced once at first use. Red: no entry ramp (default order 2/static/Huffman over 10,652 chars, no "drag this"); the prose argument is reachable only from a bottom footer link labelled like a colophon.
Accessibility-dependent: table equivalents, real row buttons, caret-driven readout all hold. Not holding: sliding-window table caps at 400 rows while the scrubber reaches all; reduced motion disables Play/Speed instead of stepping; the text surface replaces its outline with a ~2px left sliver, against the one-focus-treatment rule; Huffman leaf nodes are focusable SVG circles (Safari risk).
Mobile 380px: three plots broken. Correct: single column with specimen first, sticky released, ground control drops words at 720px, total-size fact drops at 560px. Risk: bit ledger renders every step as a row (~10,600 rows, ~64,000 nodes) with no cap, reconciled on every order change.

## Minor Observations
- Exactly one hard-coded colour in the codebase (#000 in a mask gradient); no interactive element lacks an accessible name.
- Tap targets consistently under 44px (social 28px, segmented ~30px, base button ~29.6px, checkbox 14px, Huffman leaf ~12px). Only /about/'s large CTA reaches 44.
- Component geometry is raw px throughout; breakpoints hard-coded across seven files.
- --t-small (11.5px) carries content, including the byline on both surfaces.
- /about/ ships 2026 as the literal year fallback; with JS off it reads 2026 forever, and the comment claims otherwise.
- BitLedger.css :empty::after is dead code.
- DESIGN.md 5.6 describes three columns; the build fuses two into one SVG.
- Sample select: nine flat options across three families; two optgroups would show the parallel four.
- ParallelRow runs four full analyses on first paint.

## Questions to Consider
1. Why does model order still have three simultaneously visible controls now that the rail is the anchor?
2. What changes if the specimen head opens with "nothing you paste leaves this machine" instead of the definition of surprisal?
3. Is a hand-transcribed SVG path an acceptable home for headline figures on a project positioned as "measured, not estimated"?
4. The journey ends in a footer. What sentence belongs at the bottom of the apparatus column, and why is it on another page?
