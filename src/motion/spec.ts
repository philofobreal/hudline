/**
 * Motion descriptions: how a band's parameters change with time.
 *
 * Every field describes behaviour, not a rendering technique; whether a
 * phase change becomes a transform or a dash offset is the surface's
 * business. Time is in seconds.
 */
export interface MotionSpec {
  /**
   * Speed at which the pattern travels along the track, in pixels per
   * second. Positive follows the track's direction (clockwise).
   */
  readonly drift?: number;
  /**
   * The same travel expressed in degrees per second, where 360° is one
   * full lap of a closed track. Adds to `drift`. Ignored on open tracks.
   */
  readonly spin?: number;
  /**
   * Noise-driven opacity changes. `rate` is how many times per second
   * the level changes on average; `depth` (0–1) is how far opacity may
   * fall. On an addressable band every segment flickers on its own.
   */
  readonly flicker?: {
    readonly seed: number;
    readonly rate: number;
    readonly depth: number;
  };
  /**
   * A slow oscillation of the band's offset: `amount` pixels either way,
   * once every `period` seconds.
   */
  readonly breathe?: { readonly period: number; readonly amount: number };
}
