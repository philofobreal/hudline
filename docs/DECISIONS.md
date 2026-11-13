# Decision log

Append-only. A decision is changed by adding a new entry that supersedes the old one, never by editing history. Agents may propose entries; the maintainer accepts them.

Template:

```
## D-NNN Title
Date · Status: proposed | accepted | superseded by D-NNN
Decision: one or two sentences.
Why: the reason.
Rejected: the alternatives and why not.
```

## D-001 One visual model: track, band, pattern
2026-11-13 · Status: accepted
Decision: Every shape is a track with bands and dash patterns. Rings and frames share it.
Why: Segments, ticks, dots and broken outlines become one mechanism, and motion along a shape is a phase change.
Rejected: Separate ring and frame engines (duplicate logic); free-form path strings (not parametric, not responsive).

## D-002 Lines and circular arcs only
2026-11-13 · Status: accepted
Decision: Tracks consist of straight segments and circular arcs.
Why: Arc length and offsets are exact and cheap. The reference designs need nothing else.
Rejected: Béziers (need flattening and approximate offsets).

## D-003 SVG first, renderer behind an interface
2026-11-13 · Status: accepted
Decision: The first renderer is SVG. The core stays renderer-independent so a canvas renderer can follow.
Why: The designs are monochrome line art without glow, where SVG is crisp and its dash model matches ours. Canvas has the same dash model.
Rejected: CSS Paint API and `corner-shape` (Chromium only at the time of the decision); canvas first (more work for the DOM case); WebGL (context limits per element).

## D-004 The library never mutates host layout
2026-11-13 · Status: accepted
Decision: One out-of-flow child plus CSS custom properties for the safe content margin. `position: relative` only on static hosts.
Why: The library decorates DOM that already exists; changing its layout would surprise authors and could cause resize loops.
Rejected: Setting padding automatically; wrapping the host.

## D-005 Fixed-size details with priority dropping
2026-11-13 · Status: accepted
Decision: Tabs, chamfers, notches and ticks keep pixel sizes. Straight runs stretch. When space is short, details drop by priority.
Why: Proportional scaling distorts the style at small and large sizes.
Rejected: Proportional scaling; a hard minimum size.

## D-006 Vanilla TypeScript, zero runtime dependencies
2026-11-13 · Status: accepted
Decision: No runtime dependencies. Dev dependencies are limited to `typescript` and `@types/node`; tests use the Node test runner.
Why: The required mathematics is small and the project benefits from owning it.
Rejected: Arwes (alpha, framework-coupled); test frameworks (not needed).

## D-007 Ousterhout's modular design governs the source
2026-11-13 · Status: accepted
Decision: Five deep modules: `track`, `pattern`, `motion`, `surface`, `mount`. See `DESIGN_PRINCIPLES.md`.
Why: Each hides one family of decisions; the pure three are testable without a DOM.
Rejected: A staged pipeline split by processing order.

## D-008 Scope of v1
2026-11-13 · Status: accepted
Decision: Decoration and progress only; box-level interaction; up to 50 elements; seeded choreographed and noise-driven motion. Details in `VISION.md`.
Why: Keeps the first version finishable.
Rejected: Data widgets, connectors, glow and shape hit testing in v1.

## D-009 Rings before frames
2026-11-13 · Status: accepted
Decision: Implement the ring track first, then patterns and motion, then frames.
Why: The ring's geometry is trivial while it exercises `pattern` and `motion` fully.
Rejected: Frames first (hardest geometry before the shared modules are proven).

## D-010 Specification parity between renderers
2026-11-13 · Status: accepted
Decision: Renderers must agree on geometry and timing within a 1 px visual tolerance.
Why: Pixel identity across SVG and canvas costs far more than it is worth.
Rejected: Pixel-exact parity.

## D-011 Open decisions delegated to the agent's recommendations
2026-11-13 · Status: accepted
Decision: The maintainer delegated the decisions open on this date to the agent's recommendations. D-012 to D-017 were made under that delegation.
Why: To close milestone M0 without a further round of questions.
Rejected: Waiting for item-by-item answers. The maintainer can supersede any of these entries.

## D-012 Band placement by offset and width, inward
2026-11-13 · Status: accepted
Decision: A band covers `offset` to `offset + width` from the track, toward the inside. Ticks of two lengths are two bands with the same offset.
Why: Shared offsets give a shared outer edge without any alignment option, and remove the need for per-tick widths.
Rejected: Centred bands with an alignment flag (one more concept); an addressable band for tick lengths (costs nodes).

## D-013 Fills and corner accents are bands on anchored spans
2026-11-13 · Status: accepted
Decision: `track` publishes named anchors (corners, steps with an `id`). The `spans` pattern refers to them by name. A fill is a band limited to a span.
Why: `pattern` stays general (intervals on a length) and `track` keeps all knowledge of where things are.
Rejected: A separate fill concept; letting `pattern` compute corner positions.

## D-014 One edge operator and reading-direction positions
2026-11-13 · Status: accepted
Decision: `step` is the only edge operator; tabs and notches are steps. Positions along an edge are pixels from start, centre or end, or a fraction, in reading direction.
Why: One general operator covers the three shapes in the reference images. Reading direction spares authors from knowing the track's direction of travel.
Rejected: Separate tab, notch and step operators; positions in travel direction.

## D-015 Angle and value conventions
2026-11-13 · Status: accepted
Decision: 0° points up and angles grow clockwise. A band's `value` (0–1) reveals that share of the band; progress and draw-on are the same parameter.
Why: Matches how gauges and clocks are read; one parameter instead of two.
Rejected: The mathematical convention (0° right, counter-clockwise).

## D-016 Spec types live in the module that interprets them; catalogue as a data module
2026-11-13 · Status: accepted
Decision: `track`, `pattern` and `motion` each own their spec types; `mount` owns the combining types. A sixth module, `catalog`, holds the catalogue as typed data and may import types from `mount` only.
Why: A spec type next to its interpreter cannot drift from it. Typed catalogue entries make the compiler prove coverage.
Rejected: One central spec file (every module would depend on it and it would know every module's decisions).

## D-017 MIT licence and a rules script
2026-11-13 · Status: accepted
Decision: The project is published under the MIT licence. `scripts/check-rules.mjs` enforces the dependency allowlist, the import direction and the purity of the core, as part of `npm run check`.
Why: A public repository without a licence cannot be used by anyone. Rules that nothing checks erode.
Rejected: No licence; a lint dependency for the import rules.

## D-018 Tracks are opaque and carry path data
2026-11-13 · Status: accepted (maintainer, after viewing the M1 gallery)
Decision: A `Track` exposes `length`, `closed`, `anchors` and `path`. Its segments and the angle convention stay inside `track`; users get parallel tracks from `offset`.
Why: SVG and `Path2D` both accept path data, so no renderer needs the segments, and the convention lives in one place.
Rejected: Exposing segments to `surface` (the convention would have to be known twice).

## D-019 Counts drop to the largest that fits; ticks may drop in multiples
2026-11-13 · Status: accepted (maintainer, after viewing the M1 gallery)
Decision: Ticks, dots and segments drop to the largest count that fits instead of halving. `ticks` gains `multipleOf`. Supersedes the halving rule noted in the spec comments of D-012's time.
Why: Halving breaks alignment between a 60-tick and a 12-tick band (30 is not a multiple of 12) and wastes room. Multiples of the coarser count keep every major tick on a minor one.
Rejected: Halving; a thinning group shared between bands (more machinery for the same result).

## D-020 Patterns receive randomness through their context
2026-11-13 · Status: accepted (maintainer, after viewing the M1 gallery)
Decision: `compile` takes a `random(seed)` factory in its context. `mount` supplies it from `motion.createRandom`, mixing in the host seed.
Why: `pattern` must not import `motion`, and copying the generator would be repetition. The caller already owns seed mixing.
Rejected: A shared utility module (a boundary change for twelve lines); a second generator inside `pattern`.

## D-021 Band limit and seeded start of block bands
2026-11-13 · Status: accepted (maintainer, after viewing the M1 gallery)
Decision: A band is left out when less than its own width would remain inside it. On a closed band, seeded blocks start at a seeded position.
Why: Both came from looking at the first renders: bands near the centre clotted into blobs, and four block bands starting at 12 o'clock formed a visible spoke.
Rejected: Leaving either to the author to work around in every spec.

## D-022 `renderToString` is public
2026-11-13 · Status: accepted (maintainer, after viewing the M1 gallery)
Decision: `renderToString(spec, width, height)` is exported: a standalone SVG at rest.
Why: It is how milestone M1's output is produced and inspected, and it serves server rendering and tests without a DOM.
Rejected: Keeping it internal and rendering the gallery through a private import.

## D-023 Travel is a dash offset; a travelling pattern is cyclic
2026-11-13 · Status: accepted (delegated by the maintainer, as D-011)
Decision: A pattern's travel is expressed by the surface as a dash offset on a dash array as long as the band. A band whose pattern travels is laid out cyclically even on an open track: what leaves at the end comes back in at the start. `PatternContext.closed` became `cyclic`.
Why: One mechanism for rings and open arcs, no pattern recompilation per frame, and no seam on a moving open band. Replaces the earlier idea of rotating rings with a transform.
Rejected: Transform rotation (rings only); recompiling the pattern with a phase every frame (allocates in the frame path).

## D-024 Value is a portion of the track
2026-11-13 · Status: accepted (delegated by the maintainer, as D-011)
Decision: `value` shortens the drawn path (`track.portion`) instead of clipping the pattern. `pattern.reveal`, added in M1, is removed.
Why: A pattern can travel under a fixed reveal only if the two are independent; clipping the intervals made them move together.
Rejected: Clipping intervals (wrong once the pattern moves); a mask element per band.

## D-025 States as overrides, `enter` for draw-on, motion replaced not merged
2026-11-13 · Status: accepted (delegated by the maintainer, as D-011)
Decision: A state overrides band parameters by band `id`. Numbers glide on a critically damped spring and stay continuous in value and speed when interrupted. A state's `motion` replaces the band's motion; travel so far is kept, so the pattern never jumps. If `enter` is defined, bands start in it and move to idle.
Why: One mechanism covers hover, alert, progress changes and draw-on. Critical damping settles fastest without overshoot.
Rejected: A separate draw-on option; merging motion objects (ambiguous when a state wants to stop one effect).

## D-026 A headless player is public
2026-11-13 · Status: accepted (delegated by the maintainer, as D-011)
Decision: `createPlayer(spec, width, height)` is exported. It has `set(state, time)`, `resize`, `scene(time)` and `markup(time)`; the caller supplies the time.
Why: It is the engine `attach` will drive in M4, the natural entry for the later canvas renderer, and what makes motion testable and reproducible.
Rejected: Keeping it private and exposing only `attach` (canvas users and tests would have no entry point).

## D-027 Settle time per state
2026-11-13 · Status: accepted (delegated by the maintainer, as D-011)
Decision: A state is `{ bands, settle? }`. `settle` is the time of the change into that state; for `enter`, the time of the draw-on. The spec's `settle` is the default and the time of the return to idle.
Why: Draw-on reads better slower than a hover change, and one time for both served neither.
Rejected: A map of times beside the states (two places to keep in step); keeping one time.

## D-028 Frame geometry
2026-11-13 · Status: accepted (delegated by the maintainer, as D-011)
Decision: A frame travels clockwise and starts in the middle of the first straight run of its top edge. Corners that do not fit an edge shrink together. A step needs both ramps and a pixel of flat part within the edge's straight run or it is left out; among overlapping steps priority decides. A step's anchor is its flat part, without the ramps.
Why: A dash that crosses the seam is drawn as two, and two dash ends do not make a corner, so the seam must not lie on one. The flat part is what authors decorate; ramps are reachable by widening the span.
Rejected: Starting at the top-left corner (broken corner bracket there); anchoring the whole step (every fill had to trim the ramps by a length that depends on the depth).

## D-029 Parallel tracks drop what they consume
2026-11-13 · Status: accepted (delegated by the maintainer, as D-011)
Decision: `offset` shifts every piece and joins neighbours where they now meet. A line the offset consumes is removed and its neighbours joined; a fillet whose radius reaches zero becomes a sharp corner; the track is empty only when the shape itself is consumed. Anchors follow pieces by identity and shrink to a point when their pieces are gone.
Why: Without this, a band a little deeper than a chamfer is long would fold over itself or vanish entirely.
Rejected: Returning an empty track on any collapse (bands disappear for no visible reason); a full straight-skeleton algorithm (far more than these shapes need).
Known limit: a line next to a fillet that is consumed empties the track.

## D-030 Whether a band fits is a geometry question; band priority removed
2026-11-13 · Status: accepted (delegated by the maintainer, as D-011)
Decision: `track.holds(track, from, to)` says whether a band reads as a strip on a shape: its inner edge must exist, and on shapes made of arcs alone must not curve tighter than the band is wide. `BandSpec.priority` is removed.
Why: The ring rule of D-021 hid thin fills on low frames, where it does not apply. Band priority was accepted by the type and read by nothing, and it has no clear meaning while bands do not move to fill the room of dropped ones.
Rejected: Keeping one rule for all shapes in `mount`; keeping an unused field.

## D-031 How `attach` behaves
2026-11-14 · Status: accepted (delegated by the maintainer, as D-011)
Decision: `attach(host, spec)` adds one `<svg>` child over the host's padding box and returns a handle with `set`, `update` and `detach`. A static host becomes `position: relative`; nothing else of its layout is touched. `hover`, `focus` and `active` are entered automatically when the spec defines them, `active` before `focus` before `hover`, and only while the state asked for with `set` is idle. A host that leaves the document detaches itself. Attaching again replaces the spec and returns the same handle. Void elements and environments without a DOM get a handle that does nothing.
Why: An explicit state such as an alert must not be knocked out by the pointer passing over. Self-detaching and idempotence remove two whole classes of misuse.
Rejected: Automatic states over any requested state; throwing on void elements; a `MutationObserver` on the document to watch for removals (the resize and frame callbacks notice a disconnected host at no cost).

## D-032 Hysteresis is an argument, not a state
2026-11-14 · Status: accepted (delegated by the maintainer, as D-011)
Decision: `track.resolve` takes the track it replaces, and `track.holds` takes a spare distance. A step or a band that is not shown comes back only once it fits with 4 px to spare; one that is shown stays until it truly stops fitting.
Why: A host whose size hovers around a threshold made details flicker. Passing the previous result keeps `track` pure.
Rejected: Remembering the last size inside `track` (hidden state in a pure module); snapping sizes (the outline would no longer follow the host).
Known limit: tick, dot and segment counts still change exactly at their thresholds.

## D-033 Painting in place, one loop that stops
2026-11-14 · Status: accepted (delegated by the maintainer, as D-011)
Decision: A live surface keeps one path per band and writes only what changed since the last paint. All drawings share one animation loop, which runs only while some visible drawing still changes; a drawing at rest costs nothing. The player reuses its scene and caches each band's geometry until its inputs change. Invariant 8 in `AGENTS.md` is reworded to what is true: a drawing at rest does no work, and a moving one allocates only the strings it writes.
Why: Measured in headless Chrome with fifty drawings all in their busiest state: 0.60 ms median and 2.2 ms at the 95th percentile of script time per frame. The earlier wording, no allocation at all, cannot be met by anything that writes attributes.
Rejected: Replacing markup every frame (what the M2 and M3 galleries did); a loop that never stops.

## D-034 Content insets come from geometry
2026-11-14 · Status: accepted (delegated by the maintainer, as D-011)
Decision: `track.clearance(track, depth)` gives how far content must stay from each side to be clear of the bands, of inward steps and of chamfers and fillets. `attach` publishes it as `--hud-inset-top`, `-right`, `-bottom`, `-left` on the host, rounded up to whole pixels, from the idle state.
Why: Only `track` knows what a corner or a step takes. Using idle values keeps the host's padding from moving during a hover.
Rejected: One number for all sides (wastes room, or collides with a step on one side); following animated values.

## D-035 `Player.update` and `Hud.update`
2026-11-14 · Status: accepted (delegated by the maintainer, as D-011)
Decision: `update(bands)` changes band parameters for good, by band id; states still override them. Numbers glide.
Why: A value shown as progress has to change while the drawing is in any state, and a state per value is not workable.
Rejected: Re-attaching with a new spec for every value (restarts motion).

## D-036 A band is shown by its idle shape and narrowed, not hidden, by a state
2026-11-14 · Status: accepted (the maintainer reported the defect and delegated the fix)
Decision: Whether a band is shown depends on its idle offset and width and the host's size, and on nothing a state or a transition does. When a state asks for more width than the shape holds, the band grows as far as it can (`track.widest`).
Why: On the 48 px segmented ring, the hover state asked for a width of 11 where only 9 holds, and the fit rule removed the band: pointing at the ring made its segments disappear. The agent had looked at hover only at larger sizes.
Rejected: Dropping the band (the reported defect); ignoring the fit rule in states (the band would clot at the centre).

## D-037 Bands are stacked in the order of the spec
2026-11-14 · Status: accepted (delegated by the maintainer, as D-011)
Decision: A live surface inserts each band's element in front of the next band that already has one, so document order is spec order whichever band is drawn first.
Why: Elements were appended in the order bands first appeared. With an `enter` state that hides some bands at first, later bands ended up underneath earlier ones. The stand-in DOM of the unit tests could not show this; the browser self-test did.
Rejected: Creating every element up front (hidden elements for bands that may never fit).

## D-038 A self-test that runs in a real browser
2026-11-14 · Status: accepted (delegated by the maintainer, as D-011)
Decision: `npm run selftest` writes a page that exercises `attach` with real events, observers and layout and reports each check. It is run by hand or headless; it is not part of `npm run check`, which has no browser.
Why: The unit tests for `mount` run against a stand-in DOM, which proves logic and can hide what a browser does differently. Two defects in one day were of that kind.
Rejected: A browser-automation dependency; trusting the stand-in.

## D-039 Every state of a catalogue entry changes its first band
2026-11-14 · Status: accepted (the maintainer reported the defect and delegated the fix)
Decision: In every catalogue entry, `hover` and `alert` change the first band, which is the outermost and is drawn as long as anything is. Two tests enforce it: one checks the rule, one renders every entry in every state at seven sizes down to 20 px and fails if a state changes nothing.
Why: On the smallest scale ring and block ring, hover changed only bands that a small host leaves out, so pointing at them did nothing. Six entries had this defect at some size. The library cannot invent a reaction; the spec has to ask for one that survives.
Rejected: Keeping inner bands on small hosts (they clot); leaving it to whoever looks at the gallery.

## D-040 Hatch is a paint, not a pattern
2026-11-14 · Status: accepted (delegated by the maintainer, as D-011)
Decision: `BandSpec.fill` may be `{ kind: 'hatch', angle, stripe, gap, drift }`. The band's pattern still says where the band is drawn; the hatch says what it is drawn with. In SVG it is a pattern used as stroke paint, turned to its angle and moved across itself for drift. A live surface gives each band its own pattern with an id unique in the document; standalone markup names patterns after what they look like, so identical ones may be shared.
Why: Stripes that move inside a shape that stays put were part of the original brief, and F6 could not be expressed without them. Keeping where and what apart lets any pattern be hatched.
Rejected: Hatch as a pattern kind (it is not a set of intervals along the track); clipping drawn lines to the band (many elements for what one paint does).
Known limit: a state cannot change the fill.

## D-041 Addressable bands
2026-11-14 · Status: accepted (delegated by the maintainer, as D-011)
Decision: A band with `addressable: true` is drawn as one element per part of its pattern, and its flicker dims the parts one by one, each on its own curve. An interval that crosses the seam is one part.
Why: The field had been accepted by the type since M0 and honoured by nothing. Blocks that blink independently are a signature of the look.
Rejected: Removing the field (the look needs it); one element per part for every band (most bands need one element).

## D-042 Span ends sit a hair inside their corners
2026-11-14 · Status: accepted (the maintainer reported the defect and delegated the fix)
Decision: Every span's ends are pulled in by 0.05 px from where the anchor arithmetic puts them.
Why: An anchor's ends are corners of the track. A dash that ends exactly on a corner picks up a sliver of the turn there or not, depending on the last decimal of a rounded number, so the ends of the tab's fill showed notches that jumped from frame to frame while the band's width changed on hover.
Rejected: More decimals (moves the threshold, does not remove it); drawing fills as separate shapes (a second drawing mechanism for one artefact).
Known limit: the fill is as long as the flat part of its own centreline, which gets a little shorter as the band gets wider, so its ends still move by about half a pixel during a hover, smoothly.
