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
| `track` | All geometry: corner and edge operators, detail dropping, offsets, arc length | `resolve(shape, width, height) → Track` |
| `pattern` | Fitting patterns to a length, phase, interpolation between patterns | `compile(spec, length) → Dashes` |
| `motion` | Clock handling, springs, noise, seeded randomness, state transitions | `drive(params, time) → values` |
| `surface` | SVG node management now; canvas drawing later | `paint(track, bands, values)` |
| `mount` | Observers, lifecycle, turning DOM events into states | the public API |

### Dependency rule

```
mount ──► track, pattern, motion, surface
surface ──► types of track and pattern
track, pattern, motion ──► nothing
```

`track`, `pattern` and `motion` are pure and run without a DOM.

### Public API (planned)

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

- **Primitives:** line and circular arc. The offset of a line is a line; the offset of an arc is a concentric arc. Lengths are closed-form.
- **Seamless patterns:** on a closed track the period is fitted to the length, `p' = L / round(L / p)`.
- **Detail budget:** each edge has a budget (length minus corners). Details are placed by priority and dropped when they do not fit, with hysteresis so that a size near the threshold does not flicker.
- **Band limit:** half the band width may not exceed the corner radius it bends around; the track clamps it.
- **Rings:** the radius comes from the host's smaller side; band offsets and widths are fixed pixels. Tick counts halve when spacing falls under a minimum.

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
