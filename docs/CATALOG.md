# Primitive catalogue

Status: milestone M0 closed. The maintainer delegated the open decisions to the agent's recommendations on 2026-11-13 (see `DECISIONS.md`, D-011 to D-016).

The entries below come from the maintainer's reference images. Nine of ten are written as typed specs in `src/catalog/index.ts`; the compiler checks that the spec language can express them. All nine render and move: `npm run gallery` writes `gallery.html`, in which every entry is attached to a plain element with `attach`: the frames at three sizes plus one that can be resized by hand, the rings at three sizes, two panels whose padding comes from the published insets, and a gauge driven by `update`. Pointing at a shape enters its `hover` state; buttons set `alert` and replay `enter`.

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
| F3 | Stepped frame: part of the bottom edge steps inward, a notch in the top edge | `step` with mixed position forms, an accent band outside the track on a step anchor |
| F4 | Double frame: two outlines and thick accents on two corners | band offsets, spans on corner anchors |
| F5 | Corner brackets: only the four corners are drawn, rounded | fillets, spans on all corner anchors |
| F6 | Hatched edge strip: diagonal hatching alongside part of an edge | **not expressible yet**; diagonal hatch is not an interval pattern. Scheduled for M5 |

## How the open questions were settled

1. **Two tick lengths (R2).** Two bands with the same offset and different widths. Equal offsets share the outer edge, so the ticks line up. No addressable band is needed. (D-012)
2. **Filled regions (F2, corner accents).** A fill is a band limited to a span. There is no separate fill concept. Band ends are cut square; slanted ends wait for the hatch work in M5. (D-013)
3. **Corner-anchored intervals (F4, F5).** `track` publishes named anchors; the `spans` pattern refers to them by name. `pattern` stays ignorant of shapes. (D-013)
4. **Positions along an edge.** Pixels from the start, the end or the centre, or a fraction, always in reading direction. (D-014)

## Known limits of the notation

- A fill on a tab is a rectangle on the tab's flat part. It does not follow the slanted ramps, so small triangles beside it stay empty.
- Outward steps (tabs) leave the base outline. The author insets the frame by the tab's depth to keep it inside the host box, as F2 does. The track does not do this automatically.
- Major and minor ticks stay aligned at every size only if the minor band names the major count in `multipleOf`, as R2 does. Without it the minor count drops to whatever fits.
- A band is shown or left out by its idle shape and the host's size; a state can narrow it but never hide it. There is no band priority. Steps have priority, and it decides only between steps that overlap on one edge.
- Steps and bands that were left out come back only with 4 px to spare. Tick, dot and segment counts still change exactly at their thresholds.
- A filleted frame whose straight sides are consumed by a deep offset loses that band entirely.
- Flicker and breathing switch on and off at once when a state changes `motion`; only numbers glide.
- `addressable` is accepted but not yet honoured: a flickering band flickers as a whole until M5.
- Block sizes are fixed pixels, so a seeded block band changes its arrangement when the host is resized. It is stable for a given size.
