/**
 * pattern — dash patterns along a length.
 *
 * Hides: how each pattern kind is laid out, how a pattern is fitted to a
 * band so that a closed band shows no seam, how counts thin out on short
 * bands, how intervals are wrapped, clipped and merged. Knows nothing
 * about shapes, the DOM or time. Pure.
 *
 * Interface: `compile(spec, context) → Dashes` and
 * `reveal(dashes, length, value) → Dashes`.
 */
export { compile, reveal } from './compile.js';
export type { Dashes, PatternContext } from './compile.js';
export { fitPeriod } from './fit.js';
export type { PatternSpec, Span } from './spec.js';
