# Primitive catalogue

Status: milestone M0 closed. The maintainer delegated the open decisions to the agent's recommendations on 2026-11-13 (see `DECISIONS.md`, D-011 to D-016).

The entries below come from the maintainer's reference images. All thirteen are written as typed specs in `src/catalog/index.ts`; the compiler checks that the spec language can express them. All thirteen render and move: `npm run gallery` writes `gallery.html`, in which every entry is a plain element that asks for its drawing with `data-hud`: the frames at three sizes plus one that can be resized by hand, the rings at three sizes, two panels whose padding comes from the published insets, and a gauge driven by `update`. Pointing at a shape enters its `hover` state; buttons set `alert` and replay `enter`.

## Names

Every entry is a preset. In markup, `data-hud="name"` asks for it.

| Id | Preset name |
|---|---|
| R1 | `ring-segmented` |
| R2 | `ring-scale` |
| R3 | `ring-blocks` |
| R4 | `arc-value` |
| R5 | `ring-gear` |
| F1 | `frame-chamfered` |
| F2 | `frame-tabbed` |
| F3 | `frame-stepped` |
| F4 | `frame-double` |
| F5 | `frame-brackets` |
| F6 | `frame-hatched` |
| L1 | `line-divider` |
| L2 | `line-callout` |

## Rings

| Id | Entry | What it exercises |
|---|---|---|
| R1 | Segmented ring: thin circle, thicker inner band of 12 equal segments | two bands, `segments`, spin |
| R2 | Scale ring: 60 short ticks, 12 long ticks, thin circle | two tick bands sharing an offset; tick thinning |
| R3 | Irregular block ring: four bands of seeded blocks turning at different speeds and directions | `blocks`, per-band spin, an addressable band whose blocks flicker one by one |
| R4 | Value arc: 270° guide with a thicker band filled to a value | open track, `value`, a state override |
| R5 | Gear ring: blocks standing on the outside of a turning rim | a band with a negative offset, outside the track |

## Frames

| Id | Entry | What it exercises |
|---|---|---|
| F1 | Chamfered frame: two opposite corners cut at 45° | per-corner operators |
| F2 | Tabbed frame: a tab raised from the top edge near its end, filled | `step` with negative depth, a named anchor, a span band as fill |
| F3 | Stepped frame: part of the bottom edge steps inward, a notch in the top edge | `step` with mixed position forms, an accent band outside the track on a step anchor |
| F4 | Double frame: two outlines and thick accents on two corners | band offsets, spans on corner anchors |
| F5 | Corner brackets: only the four corners are drawn, rounded | fillets, spans on all corner anchors |
| F6 | Hatched edge strip: moving diagonal stripes alongside the bottom edge | a hatch fill on a span that starts where a chamfer ends |

## Lines

| Id | Entry | What it exercises |
|---|---|---|
| L1 | Divider: a rule with a thick stub at its start and small dashes drifting above it | a line shape, a span on the `start` anchor, drift on an open band |
| L2 | Callout rule: a line that rises by a 45° jog and stays up, a dot on each end, a thick stretch into its end | a step that sits on the end of the line, bands centred on the track, dots |

## How the open questions were settled

1. **Two tick lengths (R2).** Two bands with the same offset and different widths. Equal offsets share the outer edge, so the ticks line up. No addressable band is needed. (D-012)
2. **Filled regions (F2, corner accents).** A fill is a band limited to a span. There is no separate fill concept. Band ends are cut square; slanted ends wait for the hatch work in M5. (D-013)
3. **Corner-anchored intervals (F4, F5).** `track` publishes named anchors; the `spans` pattern refers to them by name. `pattern` stays ignorant of shapes. (D-013)
4. **Positions along an edge.** Pixels from the start, the end or the centre, or a fraction, always in reading direction. (D-014)

## Rule for every entry

`hover` and `alert` must change the first band. On a small host the inner bands and the steps are left out, and a state that only touched those would change nothing visible. Tests enforce this at seven sizes down to 20 px.

## Known limits of the notation

- A fill on a tab is a rectangle on the tab's flat part. It does not follow the slanted ramps, so small triangles beside it stay empty.
- Outward steps (tabs) leave the base outline. The author insets the frame by the tab's depth to keep it inside the host box, as F2 does. The track does not do this automatically.
- Major and minor ticks stay aligned at every size only if the minor band names the major count in `multipleOf`, as R2 does. Without it the minor count drops to whatever fits.
- A band is shown or left out by its idle shape and the host's size; a state can narrow it but never hide it. There is no band priority. Steps have priority, and it decides only between steps that overlap on one edge.
- Steps and bands that were left out come back only with 4 px to spare. Tick, dot and segment counts still change exactly at their thresholds.
- A filleted frame whose straight sides are consumed by a deep offset loses that band entirely.
- Flicker and breathing switch on and off at once when a state changes `motion`; only numbers glide.
- A span is measured along the track and does not stop at corners: on a host shorter than the span, F6's strip runs on around the corner.
- A state cannot change a band's fill.
- A ring's own outline cannot have steps; `ring-gear` gets its teeth from a band outside the rim instead.
- A dot or a span can be put on a line's end, but not on one end only with `dots`: the pattern places dots evenly, so two dots means both ends.
- On a small ring a state such as faster spin is visible only as motion; a still picture of it looks like idle.
- Block sizes are fixed pixels, so a seeded block band changes its arrangement when the host is resized. It is stable for a given size.
