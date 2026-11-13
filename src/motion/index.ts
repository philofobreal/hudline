/**
 * motion — values as a function of time.
 *
 * Hides: how a parameter glides to a new target and stays smooth when
 * interrupted (springs), how flicker is generated (noise), how travel
 * along a band accumulates across changes of speed, and the seeded
 * random generator. Never reads the wall clock or `Math.random`; time
 * and seeds are arguments, so output is reproducible. Pure.
 *
 * Interface: `begin(target) → BandState`, `steer(state, target, time,
 * settle) → BandState` and `sample(state, length, closed, time, out)`,
 * plus `travels`, `moving` and `createRandom`.
 */
export { begin, moving, sample, steer, travels } from './band.js';
export type { BandFrame, BandState, BandTarget } from './band.js';
export { createRandom } from './random.js';
export type { Random } from './random.js';
export type { MotionSpec } from './spec.js';
