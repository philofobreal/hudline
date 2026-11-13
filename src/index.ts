/**
 * Public entry point of hudline.
 *
 * Only what is exported here is public API; changing it needs the
 * maintainer's approval (see AGENTS.md, section 3).
 *
 * `attach` is not implemented yet (milestone M4). Today the public
 * surface is the spec language (types), the catalogue, still rendering
 * of rings and arcs, and two helpers of the pure core.
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
} from './track/index.js';
export type { PatternSpec, Span } from './pattern/index.js';
export type { MotionSpec, Random } from './motion/index.js';
export type { BandOverride, BandSpec, HudSpec, StateSpec } from './mount/index.js';

export { renderToString } from './mount/index.js';
export { fitPeriod } from './pattern/index.js';
export { createRandom } from './motion/index.js';
export { catalog } from './catalog/index.js';
