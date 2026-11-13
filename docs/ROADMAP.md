# Roadmap

Work happens only in the milestone marked **current**. Durations assume one experienced developer working full time and are estimates.

| Milestone | Content | Done when | Status |
|---|---|---|---|
| M0, 2–3 days | Catalogue: about 4 rings and 6 frames written as specs | Every catalogue shape can be expressed in the spec language; the maintainer accepts the catalogue | done, by delegation (D-011); F6 deferred to M5 |
| M1, 1 week | Ring track, `pattern`, static SVG output | Catalogue rings are correct at three sizes; closed patterns show no seam; ticks thin out at small sizes, consistently across bands that share a grid | done; accepted by the maintainer on the gallery |
| M2, 1 week | `motion`: spin, drift, draw-on, value, noise, states | Same seed and time give the same output; transitions are smooth when interrupted | done; accepted by delegation |
| M3, 1.5 weeks | Frame track: corner and edge operators, bands, detail dropping | Catalogue frames are correct at three sizes; details drop by priority without flicker at thresholds | done; accepted by delegation. Hysteresis followed in M4 |
| M4, 1 week | `mount`: observers, interactions, lifecycle | 50 animated elements run without dropped frames; no leaks after hosts are removed; reduced motion respected | **current**: implemented and tested; waits for the maintainer to try `gallery.html` by hand |
| M5, 1 week | Addressable bands, diagonal hatch, preset library | The frames and rings of the reference images come from presets | planned |
| Later | Canvas `surface` | Same spec renders on canvas within a 1 px visual tolerance | not scheduled |

## Measured in M4

`npm run perf` writes a page with fifty attached drawings, all set to their busiest state, and times the library's work in every animation frame. In headless Chrome on the development machine: 0.60 ms median, 2.2 ms at the 95th percentile, 3.0 ms at most, at about 60 frames per second. This is script time only; style and paint are not included, and no other browser or device has been measured.

## Not done in M4

- Attaching by a `data-hud` attribute: it needs named presets, which arrive in M5.
- Hysteresis for tick, dot and segment counts.
- The host's size is read in whole pixels (`clientWidth`, `clientHeight`); a host with a fractional size is drawn up to half a pixel off.

## Largest risk

Only Chrome has been used. `npm run selftest` exercises pointer, focus, resizing, visibility and removal with real events in a real browser, and passes there; it says nothing about Firefox or Safari, and nothing about how the motion feels. The maintainer has tried the gallery by hand and found one defect that the agent's own checks had missed (D-036): states were looked at in large sizes only. Anything that changes what is drawn must be looked at in every state at the smallest size too.

## Parity note

DOM and canvas output are held to specification parity (same geometry and timing) within a 1 px visual tolerance, not to pixel identity.
