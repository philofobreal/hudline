/**
 * motion — values as a function of time.
 *
 * Hides: clock handling, springs, noise, seeded randomness and state
 * transitions. Never reads the wall clock or `Math.random`; time and
 * seeds are parameters, so output is reproducible. Pure.
 *
 * Planned interface: `drive(params, time) → values` (milestone M2).
 */
export { createRandom } from './random.js';
export type { Random } from './random.js';
