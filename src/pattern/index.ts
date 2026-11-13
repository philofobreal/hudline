/**
 * pattern — dash patterns along a length.
 *
 * Hides: how a pattern is fitted to a track length, how phase is applied,
 * and how two patterns are blended. Knows nothing about shapes, the DOM
 * or time. Pure.
 *
 * Planned interface: `compile(spec, length, anchors) → Dashes`
 * (milestone M1).
 */
export { fitPeriod } from './fit.js';
export type { PatternSpec, Span } from './spec.js';
