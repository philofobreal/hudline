/**
 * track — geometry.
 *
 * Hides: how a shape description becomes a centreline of straight lines
 * and circular arcs; the angle convention; how frame corners are fitted
 * and steps are placed or left out; where the seam lies; when a band is
 * too deep for a shape; how parallel
 * tracks are computed and what happens to details an offset consumes;
 * arc length; where named anchors lie. Knows nothing about the DOM,
 * rendering or time. Pure.
 *
 * Interface: `resolve(shape, width, height) → Track`,
 * `offset(track, distance) → Track`, `portion(track, share) → Track` and
 * `holds(track, from, to) → boolean`.
 */
export { holds, offset, portion, resolve } from './track.js';
export type { Anchor, Track } from './track.js';
export type {
  Along,
  ArcShape,
  Corner,
  CornerOp,
  Edge,
  EdgeOp,
  FrameShape,
  RingShape,
  ShapeSpec,
  StepOp,
} from './shape.js';
