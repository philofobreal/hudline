/**
 * Public entry point of hudline.
 *
 * Only what is exported here is public API; changing it needs the
 * maintainer's approval (see AGENTS.md, section 3).
 *
 * `attach` is not implemented yet (milestone M4). The exports below are
 * the pieces of the pure core that exist today.
 */
export { fitPeriod } from './pattern/index.js';
export { createRandom } from './motion/index.js';
export type { Random } from './motion/index.js';
