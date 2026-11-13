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
