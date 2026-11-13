# Architecture

Two things are described here and must not be confused: the **visual model** (what a shape is) and the **code modules** (how the source is divided).

## 1. Visual model

| Concept | Meaning | Examples |
|---|---|---|
| Track | A centreline of straight segments and circular arcs, open or closed | frame outline, circle, arc between two angles |
| Band | A strip at a normal offset from the track, with a width | thin outline, thick accent, inner ring |
| Pattern | Intervals along the band's arc length that are drawn | solid, dashes, equal segments, ticks, dots, seeded blocks |
| Motion | A function of time that drives pattern and band parameters | drift, spin, draw-on, value, flicker |
| State | A named parameter set; changing state interpolates | idle, hover, active, alert |

A ring is a track that is a circle. A frame is a track that is a closed polygon with corner and edge operators. Nothing else distinguishes them.

## 2. Code modules

| Module | Hides | Interface (planned) |
|---|---|---|
| `track` | All geometry: the angle convention, corner and edge operators, detail dropping, offsets and when they collapse, arc length | `resolve(shape, width, height) → Track`, `offset(track, distance) → Track` |
| `pattern` | Layout of each pattern kind, seam fitting, thinning on short bands, wrapping and merging of intervals | `compile(spec, context) → Dashes`, `reveal(dashes, length, value) → Dashes` |
| `motion` | Clock handling, springs, noise, seeded randomness, state transitions | `drive(params, time) → values` |
| `surface` | How bands become SVG elements and dash arrays; later live DOM updates and canvas drawing | `svgMarkup(scene) → string` |
| `mount` | How a spec becomes a scene (which bands fit, seed mixing); later observers, lifecycle, turning DOM events into states | the public API: `renderToString` today, `attach` in M4 |
| `catalog` | Nothing; it is data: the catalogue entries as typed specs, later the presets | `catalog` |

### Dependency rule

```
mount ──► track, pattern, motion, surface
surface ──► types of track and pattern
catalog ──► types of mount
track, pattern, motion ──► nothing
```

`track`, `pattern` and `motion` are pure and run without a DOM. Modules reach each other through `index.ts` only. `scripts/check-rules.mjs` enforces this section.

### Where the spec types live

Each module owns the part of the spec language that describes its own decisions, so the language cannot drift from the code that interprets it.

| Types | Owner |
|---|---|
| `ShapeSpec`, corner and edge operators, `Along` | `track` |
| `PatternSpec`, `Span` | `pattern` |
| `MotionSpec` | `motion` |
| `BandSpec`, `StateSpec`, `HudSpec` | `mount` |

### What crosses module boundaries

- A `Track` is opaque to its users: they read `length`, `closed` and `anchors`, draw `path` (path data that an SVG `d` attribute and `Path2D` both accept), and call `offset`. The segments and the angle convention stay inside `track`.
- `Dashes` is a flat, sorted list of drawn intervals plus a cap style. `surface` turns it into a dash array whose sum equals the track length.
- `pattern` receives its randomness as a function in its context, so it stays independent of `motion`, where the generator lives.

### Public API

Available now:

```ts
renderToString(spec, width, height);  // standalone SVG at rest; rings and arcs
```

Planned for M4:

```ts
const hud = attach(element, spec);  // idempotent
hud.set('alert');                   // state change
hud.update({ value: 0.7 });         // parameter change
hud.detach();                       // automatic when the host is removed
```

## 3. What runs when

| Trigger | Work |
|---|---|
| Attach, host resize | `track.resolve`, `pattern.compile`, `surface` rebuilds nodes |
| Animation frame | `motion.drive`, `surface` writes changed attributes only |
| State change | `motion` starts a transition; no geometry work |
| Host hidden, off-screen, reduced motion | The frame loop skips the element |

One shared `requestAnimationFrame` loop serves all elements.

## 4. Geometry rules

- **Units:** lengths in CSS pixels, angles in degrees at the public interface, time in seconds.
- **Angles:** 0° points up and angles grow clockwise. Closed tracks travel clockwise.
- **Edge positions:** measured in reading direction (left to right, top to bottom), whatever the track's direction of travel.
- **Band placement:** a band covers `offset` to `offset + width` from the track, toward the inside. Bands with equal offsets share their outer edge.
- **Anchors:** `track` publishes named intervals on the track: the frame corners `tl`, `tr`, `br`, `bl` and every step that has an `id`. Span patterns refer to them by name; a span on a missing anchor draws nothing.
- **One edge operator:** `step` displaces a stretch of an edge. A tab is a step with negative depth, a notch a short step with positive depth.
- **Value:** a band's `value` (0–1) reveals that share of the band from the track's start. Progress and draw-on are the same parameter.
- **Primitives:** line and circular arc. The offset of a line is a line; the offset of an arc is a concentric arc. Lengths are closed-form.
- **Seamless patterns:** on a closed track the period is fitted to the length, `p' = L / round(L / p)`.
- **Detail budget:** each edge has a budget (length minus corners). Details are placed by priority and dropped when they do not fit, with hysteresis so that a size near the threshold does not flicker.
- **Band limit:** a band is left out when less than its own width would remain between its inner edge and the centre it bends around. Closer than that it stops reading as a strip.
- **Rings:** the radius comes from the host's smaller side; band offsets and widths are fixed pixels. Tick, dot and segment counts drop to the largest that fits; ticks can drop in multiples of a number so that a coarser band stays aligned.
- **Seeded blocks:** on a closed band the row starts at a seeded position, so several block bands on one ring do not all begin at the same angle.

## 5. DOM contract

- The host receives one child `<svg>`: `position: absolute; inset: 0; pointer-events: none; overflow: visible`.
- The host's `position` is set to `relative` only if it is `static`.
- The library publishes the safe content margin as `--hud-inset-top`, `--hud-inset-right`, `--hud-inset-bottom`, `--hud-inset-left`. Using them is the author's choice.
- Colour comes from `currentColor`.
- Because the child is out of flow, observing the host's size cannot feed back into layout.

## 6. Addressable bands

A dashed stroke cannot address its segments one by one. A band that needs per-segment flicker or per-segment width is marked addressable and is rendered as separate elements. This is opt-in because it costs nodes.

## 7. Performance budget

- At most 50 animated elements per page.
- Per-frame script time for 50 elements: target under 2 ms on a mid-range laptop. This is a target to be measured in M4, not a verified figure.
- No per-frame allocation in `motion` or `surface`.
