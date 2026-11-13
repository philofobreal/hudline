# Primitive catalogue

Status: milestone M0 closed. The maintainer delegated the open decisions to the agent's recommendations on 2026-11-13 (see `DECISIONS.md`, D-011 to D-016).

The entries below come from the maintainer's reference images. Nine of ten are written as typed specs in `src/catalog/index.ts`; the compiler checks that the spec language can express them. No geometry exists yet, so none of them has been rendered: whether they look right is verified in M1 (rings) and M3 (frames).

## Rings

| Id | Entry | What it exercises |
|---|---|---|
| R1 | Segmented ring: thin circle, thicker inner band of 12 equal segments | two bands, `segments`, spin |
| R2 | Scale ring: 60 short ticks, 12 long ticks, thin circle | two tick bands sharing an offset; tick thinning |
| R3 | Irregular block ring: four bands of seeded blocks turning at different speeds and directions | `blocks`, per-band spin, an addressable flickering band |
| R4 | Value arc: 270° guide with a thicker band filled to a value | open track, `value`, a state override |

## Frames

| Id | Entry | What it exercises |
|---|---|---|
| F1 | Chamfered frame: two opposite corners cut at 45° | per-corner operators |
| F2 | Tabbed frame: a tab raised from the top edge near its end, filled | `step` with negative depth, a named anchor, a span band as fill |
| F3 | Stepped frame: part of the bottom edge steps inward | `step` with mixed position forms |
| F4 | Double frame: two outlines and thick accents on two corners | band offsets, spans on corner anchors, band priority |
| F5 | Corner brackets: only the four corners are drawn | spans on all corner anchors |
| F6 | Hatched edge strip: diagonal hatching alongside part of an edge | **not expressible yet**; diagonal hatch is not an interval pattern. Scheduled for M5 |

## How the open questions were settled

1. **Two tick lengths (R2).** Two bands with the same offset and different widths. Equal offsets share the outer edge, so the ticks line up. No addressable band is needed. (D-012)
2. **Filled regions (F2, corner accents).** A fill is a band limited to a span. There is no separate fill concept. Band ends are cut square; slanted ends wait for the hatch work in M5. (D-013)
3. **Corner-anchored intervals (F4, F5).** `track` publishes named anchors; the `spans` pattern refers to them by name. `pattern` stays ignorant of shapes. (D-013)
4. **Positions along an edge.** Pixels from the start, the end or the centre, or a fraction, always in reading direction. (D-014)

## Known limits of the notation

- A span band over a step follows the track, so on the ramps of a diagonal step it is a slanted strip, not a clean wedge. F2 trims the span by the ramp length to avoid this.
- Outward steps (tabs) leave the base outline. The author insets the frame by the tab's depth to keep it inside the host box, as F2 does. The track does not do this automatically.
- Major and minor ticks stay aligned only while both bands thin out by the same factor. M1 must make thinning consistent across bands that share a grid, or R2 will misalign at small sizes.
