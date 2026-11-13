# Roadmap

Work happens only in the milestone marked **current**. Durations assume one experienced developer working full time and are estimates.

| Milestone | Content | Done when | Status |
|---|---|---|---|
| M0, 2–3 days | Catalogue: about 4 rings and 6 frames written as specs | Every catalogue shape can be expressed in the spec language; the maintainer accepts the catalogue | done, by delegation (D-011); F6 deferred to M5 |
| M1, 1 week | Ring track, `pattern`, static SVG output | Catalogue rings are correct at three sizes; closed patterns show no seam; ticks thin out at small sizes, consistently across bands that share a grid | done; accepted by the maintainer on the gallery |
| M2, 1 week | `motion`: spin, drift, draw-on, value, noise, states | Same seed and time give the same output; transitions are smooth when interrupted | done; accepted by delegation |
| M3, 1.5 weeks | Frame track: corner and edge operators, bands, detail dropping | Catalogue frames are correct at three sizes; details drop by priority without flicker at thresholds | **current**: implemented and tested except hysteresis at thresholds (see below); waits for the maintainer to look at `gallery.html` |
| M4, 1 week | `mount`: observers, interactions, lifecycle | 50 animated elements run without dropped frames; no leaks after hosts are removed; reduced motion respected | planned |
| M5, 1 week | Addressable bands, diagonal hatch, preset library | The frames and rings of the reference images come from presets | planned |
| Later | Canvas `surface` | Same spec renders on canvas within a 1 px visual tolerance | not scheduled |

## Open in M3

Details and bands appear and disappear exactly at the size where they start or stop fitting. A host whose size hovers around such a threshold will show the detail flickering. Hysteresis needs memory of the previous size, which the pure `track` module does not have; it belongs to `mount` and is planned with M4.

## Largest risk

The spec language was settled in M0 on paper: it type-checks, but nothing has been rendered. M1 and M3 are the first real test. If a catalogue entry turns out to look wrong or to be awkward to express, change the spec then, before more code depends on it.

## Parity note

DOM and canvas output are held to specification parity (same geometry and timing) within a 1 px visual tolerance, not to pixel identity.
