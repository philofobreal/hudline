# Vision

## Goal

A general way to give existing DOM elements the look of film and game HUDs: clean, geometric frames and rings whose breaks, fills and segments move along the outline while the outline itself keeps its shape.

## Principles of the result

- **Geometric, not drawn.** Shapes come from parameters and rules, never from hand-made path strings.
- **Shape-preserving motion.** Animation travels along edges, corners and arcs.
- **Responsive by rule.** Details (tabs, chamfers, notches, ticks) keep fixed pixel sizes; straight runs stretch; when space runs out, details that no longer fit drop out.
- **Monochrome first.** One colour per state, taken from `currentColor`.
- **Quiet in the page.** The library never changes the host's layout.

## In scope (v1)

- Frames: closed outlines with corner operators (chamfer, fillet) and the edge operator (step, which also makes tabs and notches), multiple bands, partial outlines, corner brackets.
- Lines: a rule along one side of the host with the same steps, for dividers, underlines and callout rules.
- Rings: concentric bands, open arcs, equal segments, ticks, dots, seeded irregular blocks, value arcs (progress).
- Motion: drift along the track, rigid rotation, draw-on, value transitions, noise-driven flicker of a band or of its parts one by one, moving hatch stripes, state transitions.
- Reactions: pointer and focus, host resize, visibility, element insertion and removal, custom state changes.
- Renderers: SVG in the DOM, and a 2D canvas for applications with a loop of their own.
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

- Steps on a ring's own outline (a gear look exists as a preset built from a band outside the rim).
- Per-state colour sets and an optional glow layer.
