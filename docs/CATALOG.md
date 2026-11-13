# Primitive catalogue (draft)

Status: draft for milestone M0, written from the maintainer's reference images. Not yet accepted. The spec notation is provisional; settling it is the purpose of M0.

Each entry names what the spec language must be able to express.

## Rings

### R1 Segmented ring
A thin full circle with a thicker inner band cut into equal segments.
Needs: two bands; `segments(n, gap)`; spin.

### R2 Scale ring
A band of evenly spaced ticks with a longer tick every k-th position, around a thin circle.
Needs: `ticks(n, major)`; two tick lengths, which means band width varies per tick → addressable band or two overlaid bands. Open question for M0.

### R3 Irregular block ring
Three or four concentric bands of unequal blocks and gaps, turning at different speeds and directions.
Needs: `blocks(seed, min, max)`; per-band spin; seamless closure.

### R4 Value arc
An open arc from a start angle over a sweep, filled to a value between 0 and 1, with a thin full-length guide.
Needs: open track; `value`; spring transition.

## Frames

### F1 Chamfered frame
Rectangle with 45° chamfers on two opposite corners; thin outline.
Needs: per-corner chamfer.

### F2 Tabbed frame
Chamfered frame with a raised tab on the top edge near one end, the tab drawn as a filled accent.
Needs: edge operator `tab(at, width, depth)`; anchoring from the edge's start or end; a filled region bounded by the tab.

### F3 Stepped frame
One edge steps inward by a fixed depth for part of its length, with 45° transitions.
Needs: edge operator `step(from, to, depth)`.

### F4 Double frame with accents
Outer thin outline, inner offset outline, and short thick accents on selected corners.
Needs: two bands at different offsets; a band limited to intervals near corners.

### F5 Corner brackets
Only the four corners are drawn, as L-shapes of fixed length.
Needs: pattern intervals anchored to corners instead of a repeating period.

### F6 Hatched edge strip
A short strip of diagonal hatching alongside part of an edge.
Needs: a band interval filled with diagonal hatch → not a dash pattern; planned for M5.

## Open questions for M0

1. Two tick lengths in R2: addressable band, or two bands sharing a pattern?
2. Filled regions (F2 tab fill, corner blocks): are they bands with large width, or a separate "fill" concept?
3. Corner-anchored intervals (F4, F5): part of `pattern`, or produced by `track` as named anchors that `pattern` refers to?
4. Notation for positions along an edge: pixels from start, pixels from end, or fraction.
