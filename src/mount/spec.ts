import type { MotionSpec } from '../motion/index.js';
import type { PatternSpec } from '../pattern/index.js';
import type { ShapeSpec } from '../track/index.js';

/**
 * One strip along the track.
 *
 * Placement: the band covers the distances `offset` to `offset + width`
 * from the track, measured toward the inside of the shape. A negative
 * offset starts outside the track. Bands that share an `offset` share
 * their outer edge, which is how ticks of two lengths line up.
 */
export interface BandSpec {
  /** Name used by states to address this band. Unique within a spec. */
  readonly id?: string;
  /** Default 0: the band starts on the track. */
  readonly offset?: number;
  readonly width: number;
  /** Default solid. */
  readonly pattern?: PatternSpec;
  /**
   * Share of the band that is shown, 0–1, counted from the track's
   * start. Default 1. Drives both progress display and draw-on. The
   * pattern is laid out for the whole band and is not squeezed.
   */
  readonly value?: number;
  /** 0–1. Default 1. */
  readonly opacity?: number;
  readonly motion?: MotionSpec;
  /**
   * Render every interval as its own element so that it can flicker or
   * be styled alone. Costs nodes; default false.
   */
  readonly addressable?: boolean;
  /**
   * Higher numbers survive longer when the host is too small for all
   * bands. Default 0.
   */
  readonly priority?: number;
}

/**
 * The band parameters a state may change. Numbers glide to their new
 * values. `motion` is not merged: a state that names it replaces the
 * band's whole motion description, and the pattern keeps its place.
 */
export type BandOverride = Partial<
  Pick<BandSpec, 'offset' | 'width' | 'value' | 'opacity' | 'motion'>
>;

/** A named parameter set: overrides per band `id`. */
export type StateSpec = Readonly<Record<string, BandOverride>>;

/** Everything `attach` will accept for one host. */
export interface HudSpec {
  readonly shape: ShapeSpec;
  readonly bands: readonly BandSpec[];
  /**
   * States by name. `idle` is implied and is the spec itself. If `enter`
   * is defined, bands start in it and move to idle at once, which is how
   * draw-on is described. `hover`, `focus` and `active` will be entered
   * automatically from pointer and focus events once `attach` exists;
   * any other name is entered with `set(name)`.
   */
  readonly states?: Readonly<Record<string, StateSpec>>;
  /**
   * Seed mixed into every seeded pattern and motion of this spec, so
   * that two hosts with the same spec can still differ. Default 0.
   */
  readonly seed?: number;
  /** Approximate seconds a state change takes to settle. Default 0.3. */
  readonly settle?: number;
}
