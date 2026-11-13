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
2026-11-13 · Status: proposed
Decision: A pattern's travel is expressed by the surface as a dash offset on a dash array as long as the band. A band whose pattern travels is laid out cyclically even on an open track: what leaves at the end comes back in at the start. `PatternContext.closed` became `cyclic`.
Why: One mechanism for rings and open arcs, no pattern recompilation per frame, and no seam on a moving open band. Replaces the earlier idea of rotating rings with a transform.
Rejected: Transform rotation (rings only); recompiling the pattern with a phase every frame (allocates in the frame path).

## D-024 Value is a portion of the track
2026-11-13 · Status: proposed
Decision: `value` shortens the drawn path (`track.portion`) instead of clipping the pattern. `pattern.reveal`, added in M1, is removed.
Why: A pattern can travel under a fixed reveal only if the two are independent; clipping the intervals made them move together.
Rejected: Clipping intervals (wrong once the pattern moves); a mask element per band.

## D-025 States as overrides, `enter` for draw-on, motion replaced not merged
2026-11-13 · Status: proposed
Decision: A state overrides band parameters by band `id`. Numbers glide on a critically damped spring and stay continuous in value and speed when interrupted. A state's `motion` replaces the band's motion; travel so far is kept, so the pattern never jumps. If `enter` is defined, bands start in it and move to idle.
Why: One mechanism covers hover, alert, progress changes and draw-on. Critical damping settles fastest without overshoot.
Rejected: A separate draw-on option; merging motion objects (ambiguous when a state wants to stop one effect).

## D-026 A headless player is public
2026-11-13 · Status: proposed
Decision: `createPlayer(spec, width, height)` is exported. It has `set(state, time)`, `resize`, `scene(time)` and `markup(time)`; the caller supplies the time.
Why: It is the engine `attach` will drive in M4, the natural entry for the later canvas renderer, and what makes motion testable and reproducible.
Rejected: Keeping it private and exposing only `attach` (canvas users and tests would have no entry point).
