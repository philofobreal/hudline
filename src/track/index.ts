/**
 * track — geometry.
 *
 * Hides: how a shape description becomes a centreline of straight
 * segments and circular arcs; corner operators (chamfer, fillet) and the
 * edge operator (step); which details drop out when space is short;
 * offsets for bands; arc length; where named anchors lie. Knows nothing
 * about the DOM, rendering or time. Pure.
 *
 * Planned interface: `resolve(shape, width, height) → Track`
 * (rings in milestone M1, frames in M3). Today the module exports the
 * shape description types only.
 */
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
