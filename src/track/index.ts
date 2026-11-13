/**
 * track — geometry.
 *
 * Hides: how a shape description becomes a centreline of straight
 * segments and circular arcs; the angle convention; corner operators
 * (chamfer, fillet) and the edge operator (step); which details drop out
 * when space is short; how offsets are computed and when they collapse;
 * arc length; where named anchors lie. Knows nothing about the DOM,
 * rendering or time. Pure.
 *
 * Interface: `resolve(shape, width, height) → Track`,
 * `offset(track, distance) → Track` and `portion(track, share) → Track`. Rings and arcs work today; frames
 * resolve to an empty track until milestone M3.
 */
export { offset, portion, resolve } from './track.js';
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
