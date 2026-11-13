# Roadmap

Work happens only in the milestone marked **current**. Durations assume one experienced developer working full time and are estimates.

| Milestone | Content | Done when | Status |
|---|---|---|---|
| M0, 2–3 days | Catalogue: about 4 rings and 6 frames written as specs | Every catalogue shape can be expressed in the spec language; the maintainer accepts the catalogue | **current** (draft in `CATALOG.md`) |
| M1, 1 week | Ring track, `pattern`, static SVG output | Catalogue rings are correct at three sizes; closed patterns show no seam; ticks thin out at small sizes | planned |
| M2, 1 week | `motion`: spin, drift, draw-on, value, noise, states | Same seed and time give the same output; transitions are smooth when interrupted | planned |
| M3, 1.5 weeks | Frame track: corner and edge operators, bands, detail dropping | Catalogue frames are correct at three sizes; details drop by priority without flicker at thresholds | planned |
| M4, 1 week | `mount`: observers, interactions, lifecycle | 50 animated elements run without dropped frames; no leaks after hosts are removed; reduced motion respected | planned |
| M5, 1 week | Addressable bands, diagonal hatch, preset library | The frames and rings of the reference images come from presets | planned |
| Later | Canvas `surface` | Same spec renders on canvas within a 1 px visual tolerance | not scheduled |

## Largest risk

M0. If the spec language cannot express the catalogue, every later milestone moves. Settle the spec types before writing geometry.

## Parity note

DOM and canvas output are held to specification parity (same geometry and timing) within a 1 px visual tolerance, not to pixel identity.
