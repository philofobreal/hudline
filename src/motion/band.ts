import { noise } from './noise.js';
import type { MotionSpec } from './spec.js';
import { rest, retarget, valueAt } from './spring.js';
import type { Transition } from './spring.js';

/** Where one band's parameters should be heading. */
export interface BandTarget {
  readonly offset: number;
  readonly width: number;
  /** Revealed share, 0–1. */
  readonly value: number;
  /** 0–1. */
  readonly opacity: number;
  readonly motion: MotionSpec | undefined;
}

/**
 * One band's parameters at one instant. Callers own the object and pass
 * it to `sample` to be filled, so sampling allocates nothing.
 */
export interface BandFrame {
  offset: number;
  width: number;
  value: number;
  opacity: number;
  /** How far the pattern has travelled along the band, in pixels. */
  phase: number;
}

/**
 * Everything needed to know a band's parameters at any later time.
 * Immutable; `steer` returns a new one.
 */
export interface BandState {
  readonly offset: Transition;
  readonly width: Transition;
  readonly value: Transition;
  readonly opacity: Transition;
  readonly motion: MotionSpec | undefined;
  /** Time from which `motion` has applied. */
  readonly since: number;
  /** Pixels of drift and laps of spin accumulated before `since`. */
  readonly drifted: number;
  readonly turned: number;
}

/** A band at rest on a target, at time 0. */
export function begin(target: BandTarget): BandState {
  return {
    offset: rest(target.offset),
    width: rest(target.width),
    value: rest(target.value),
    opacity: rest(target.opacity),
    motion: target.motion,
    since: 0,
    drifted: 0,
    turned: 0,
  };
}

/**
 * Sends a band toward a new target from wherever it is at `time`.
 * Numeric parameters glide there in about `settle` seconds. The motion
 * description switches at once, but the pattern keeps its place: travel
 * so far is carried over, so a change of speed never makes it jump.
 */
export function steer(state: BandState, target: BandTarget, time: number, settle: number): BandState {
  const elapsed = Math.max(0, time - state.since);
  return {
    offset: retarget(state.offset, target.offset, time, settle),
    width: retarget(state.width, target.width, time, settle),
    value: retarget(state.value, target.value, time, settle),
    opacity: retarget(state.opacity, target.opacity, time, settle),
    motion: target.motion,
    since: Math.max(time, state.since),
    drifted: state.drifted + speed(state.motion?.drift) * elapsed,
    turned: state.turned + (speed(state.motion?.spin) / 360) * elapsed,
  };
}

/**
 * Whether the band's pattern travels along it. A travelling pattern has
 * to join end to start, which the pattern needs to know when it is laid
 * out.
 *
 * @param closed Whether the band's track is closed; spin applies to
 *   closed tracks only.
 */
export function travels(state: BandState, closed: boolean): boolean {
  return speed(state.motion?.drift) !== 0 || (closed && speed(state.motion?.spin) !== 0);
}

/**
 * Writes the band's parameters at `time` into `out` and returns it.
 *
 * Width and opacity never leave their valid ranges, whatever the spec
 * asked for. Flicker lowers opacity; breathing shifts the offset.
 *
 * @param length Arc length of the band, which turns laps of spin into
 *   pixels.
 */
export function sample(
  state: BandState,
  length: number,
  closed: boolean,
  time: number,
  out: BandFrame,
): BandFrame {
  const motion = state.motion;
  const elapsed = Math.max(0, time - state.since);

  let offset = valueAt(state.offset, time);
  const breathe = motion?.breathe;
  if (breathe !== undefined && breathe.period > 0) {
    offset += finite(breathe.amount) * Math.sin((time / breathe.period) * Math.PI * 2);
  }

  let opacity = clamp01(valueAt(state.opacity, time));
  const flicker = motion?.flicker;
  if (flicker !== undefined) {
    opacity *= 1 - clamp01(flicker.depth) * noise(flicker.seed, time * finite(flicker.rate));
  }

  const laps = closed ? state.turned + (speed(motion?.spin) / 360) * elapsed : 0;
  out.offset = offset;
  out.width = Math.max(0, valueAt(state.width, time));
  out.value = clamp01(valueAt(state.value, time));
  out.opacity = opacity;
  out.phase = state.drifted + speed(motion?.drift) * elapsed + laps * length;
  return out;
}

function speed(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : 0;
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
