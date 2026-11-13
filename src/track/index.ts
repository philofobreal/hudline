/**
 * track — geometry.
 *
 * Hides: how a shape description becomes a centreline of straight lines
 * and circular arcs; the angle convention; how frame corners are fitted
 * and steps are placed or left out, and how that decision is kept steady
 * across resizes; where the seam lies; how much room content needs; when a band is
 * too deep for a shape; how parallel
 * tracks are computed and what happens to details an offset consumes;
 * arc length; where named anchors lie. Knows nothing about the DOM,
 * rendering or time. Pure.
 *
 * Interface: `resolve(shape, width, height) → Track`,
 * `offset(track, distance) → Track`, `portion(track, share) → Track`,
 * `holds(track, from, to) → boolean` and `clearance(track, depth) → Insets`.
 */
export { clearance, holds, offset, portion, resolve } from './track.js';
export type { Anchor, Insets, Track } from './track.js';
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
