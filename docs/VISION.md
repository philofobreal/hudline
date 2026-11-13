# Vision

## Goal

A general way to give existing DOM elements the look of film and game HUDs: clean, geometric frames and rings whose breaks, fills and segments move along the outline while the outline itself keeps its shape.

## Principles of the result

- **Geometric, not drawn.** Shapes come from parameters and rules, never from hand-made path strings.
- **Shape-preserving motion.** Animation travels along edges, corners and arcs.
- **Responsive by rule.** Details (tabs, chamfers, notches, ticks) keep fixed pixel sizes; straight runs stretch; when space runs out, details drop by priority.
- **Monochrome first.** One colour per state, taken from `currentColor`.
- **Quiet in the page.** The library never changes the host's layout.

## In scope (v1)

- Frames: closed outlines with corner operators (chamfer, fillet) and edge operators (tab, step, notch), multiple bands, partial outlines, corner brackets.
- Rings: concentric bands, open arcs, equal segments, ticks, dots, seeded irregular blocks, value arcs (progress).
- Motion: drift along the track, rigid rotation, draw-on, value transitions, noise-driven flicker, state transitions.
- Reactions: pointer and focus, host resize, visibility, element insertion and removal, custom state changes.
- Renderer: SVG.
- Up to 50 animated elements per page.

## Non-goals (v1)

- Data widgets: bar charts, waveforms, dot matrices, grids.
- Connector lines between separate elements.
- Glow, gradients, blur, transparency layering.
- Text and typography.
- Shape-accurate hit testing; interaction uses the host's box.
- Void hosts (`img`, `input`) that cannot take a child.
- Framework bindings.

## Later

- Canvas 2D renderer on the same core.
- Notched and toothed ring outlines.
- Per-state colour sets and an optional glow layer.
