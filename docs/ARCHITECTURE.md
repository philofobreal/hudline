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
| `track` | All geometry: the angle convention, corner and edge operators, detail dropping, offsets and when they collapse, arc length | `resolve(shape, width, height) → Track`, `offset(track, distance) → Track`, `portion(track, share) → Track`, `holds(track, from, to) → boolean` |
| `pattern` | Layout of each pattern kind, seam fitting, thinning on short bands, wrapping and merging of intervals | `compile(spec, context) → Dashes` |
| `motion` | Springs, noise, how travel accumulates across changes of speed, seeded randomness | `begin(target) → BandState`, `steer(state, target, time, settle) → BandState`, `sample(state, length, closed, time, out)` |
| `surface` | How bands become SVG elements and dash arrays; later live DOM updates and canvas drawing | `svgMarkup(scene) → string` |
| `mount` | How a spec becomes a scene (which bands fit, seed mixing); later observers, lifecycle, turning DOM events into states | the public API: `createPlayer` and `renderToString` today, `attach` in M4 |
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

Available now, without a DOM:

```ts
renderToString(spec, width, height);          // standalone SVG at rest; rings, arcs and frames
const player = createPlayer(spec, width, height);
player.set('alert', time);                    // the caller supplies the time
player.markup(time);                          // SVG at that moment
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
| Attach, host resize | `track.resolve`; every band's centreline and pattern |
| Animation frame | `motion.sample` per band. A band's centreline and pattern are rebuilt only if its offset or width changed since the last frame, its shown path only if its value did |
| State change | `motion.steer`: new transitions. A pattern is laid out again only if the change makes it start or stop travelling |

A band that is only travelling or flickering costs one `sample` and a changed dash offset or opacity per frame. Bands in a transition, or breathing, rebuild their geometry each frame until they settle.
| Host hidden, off-screen, reduced motion | The frame loop skips the element |

One shared `requestAnimationFrame` loop serves all elements.

## 4. Geometry rules

- **Units:** lengths in CSS pixels, angles in degrees at the public interface, time in seconds.
- **Angles:** 0° points up and angles grow clockwise. Closed tracks travel clockwise.
- **Edge positions:** measured in reading direction (left to right, top to bottom), whatever the track's direction of travel.
- **Band placement:** a band covers `offset` to `offset + width` from the track, toward the inside. Bands with equal offsets share their outer edge.
- **Anchors:** `track` publishes named intervals on the track: the frame corners `tl`, `tr`, `br`, `bl` (a sharp corner has zero length) and the flat part of every step that has an `id`. Span patterns refer to them by name; a span on a missing anchor draws nothing. Anchors follow their pieces onto parallel tracks.
- **Seam:** a ring starts at the top, a frame in the middle of the first straight run of its top edge, so the seam never lies on a corner.
- **One edge operator:** `step` displaces a stretch of an edge. A tab is a step with negative depth, a notch a short step with positive depth.
- **Value:** a band's `value` (0–1) shows that share of the band from the track's start, by shortening the drawn path. The pattern is laid out for the whole band, so it can travel under a fixed value. Progress and draw-on are the same parameter.
- **Travel:** a pattern's travel is a dash offset on a dash array as long as the band. A travelling pattern is laid out cyclically, also on an open band: what leaves at the end comes back in at the start.
- **Transitions:** each state has its own settle time. Numeric band parameters move on a critically damped spring and stay continuous in value and speed when retargeted. A state's `motion` replaces the band's motion; travel so far is kept.
- **Primitives:** line and circular arc. The offset of a line is a line; the offset of an arc is a concentric arc. Lengths are closed-form.
- **Seamless patterns:** on a closed track the period is fitted to the length, `p' = L / round(L / p)`.
- **Corner fit:** when the two corners of an edge ask for more than the edge has, both shrink by the same factor.
- **Step placement:** a step is placed if both ramps and a pixel of flat part fit within the edge's straight run and it overlaps no step placed before it. Higher priority is placed first. Hysteresis at the threshold is not implemented yet (see the roadmap).
- **Parallel tracks:** an offset shifts every piece and joins neighbours where they meet. What the offset consumes is dropped: a short line disappears and its neighbours join, a fillet turns sharp. The track is empty only when the shape itself is consumed.
- **Band fit:** a band is left out when its inner edge would pass through the shape, and on a shape made of arcs alone when its inner edge would curve tighter than the band is wide. `track.holds` decides.
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
