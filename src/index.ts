/**
 * Public entry point of hudline.
 *
 * Only what is exported here is public API; changing it needs the
 * maintainer's approval (see AGENTS.md, section 3).
 *
 * `attach` draws a spec on an element and keeps it up to date.
 * `createPlayer` and `renderToString` do the same work without a DOM.
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
export type { BandOverride, BandSpec, HatchSpec, HudSpec, StateSpec } from './mount/index.js';

export { attach, createPlayer, renderToString } from './mount/index.js';
export type { Hud, Player } from './mount/index.js';
export { fitPeriod } from './pattern/index.js';
export { createRandom } from './motion/index.js';
export { catalog } from './catalog/index.js';
