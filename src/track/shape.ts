/**
 * Shape descriptions: what the author writes to say which track a host
 * gets. All lengths are CSS pixels, all angles degrees.
 *
 * Angle convention: 0° points up (12 o'clock) and angles grow clockwise.
 *
 * Edge convention: positions along an edge are measured in reading
 * direction, left to right on `top` and `bottom`, top to bottom on `left`
 * and `right`, regardless of the direction in which the track travels.
 */

/** A frame corner, named by its position on the host box. */
export type Corner = 'tl' | 'tr' | 'br' | 'bl';

/** A frame edge, named by its position on the host box. */
export type Edge = 'top' | 'right' | 'bottom' | 'left';

/**
 * How a frame corner is shaped. Sizes are fixed pixels; when two corners
 * on one edge do not fit, the track shrinks both in proportion.
 */
export type CornerOp =
  | { readonly kind: 'sharp' }
  /** A 45° cut; `size` is the length removed from each adjoining edge. */
  | { readonly kind: 'chamfer'; readonly size: number }
  /** A circular arc tangent to both adjoining edges. */
  | { readonly kind: 'fillet'; readonly radius: number };

/**
 * A position along one edge.
 *
 * - `from: 'start'`: `offset` pixels after the edge's start.
 * - `from: 'end'`: `offset` pixels before the edge's end.
 * - `from: 'center'`: `offset` pixels after the midpoint; may be negative.
 * - `fraction`: 0 is the start, 1 the end.
 *
 * The edge here is the straight run between its two corner operators.
 */
export type Along =
  | { readonly from: 'start' | 'center' | 'end'; readonly offset: number }
  | { readonly fraction: number };

/**
 * Displaces a stretch of an edge. This is the only edge operator: a tab
 * is a step with negative depth, a notch is a short step with positive
 * depth.
 */
export interface StepOp {
  readonly kind: 'step';
  /**
   * Name of the anchor this step publishes. Patterns can refer to it to
   * place spans on the step. Must not collide with a corner name.
   */
  readonly id?: string;
  readonly from: Along;
  readonly to: Along;
  /** Displacement in pixels: positive moves the edge inward, negative outward. */
  readonly depth: number;
  /** How the edge reaches the displaced level. Default `'diagonal'` (45°). */
  readonly ramp?: 'diagonal' | 'square';
  /**
   * Higher numbers survive longer when the edge is too short for all of
   * its steps. Default 0. Ties drop in reverse order of declaration.
   */
  readonly priority?: number;
}

/** An edge operator. One kind exists today; see {@link StepOp}. */
export type EdgeOp = StepOp;

/**
 * A closed outline that follows the host box. Corners are published as
 * anchors named `tl`, `tr`, `br` and `bl`.
 */
export interface FrameShape {
  readonly kind: 'frame';
  /** Distance of the track from the host box on every side. Default 0. */
  readonly inset?: number;
  /** One operator for all corners, or one per corner. Default sharp. */
  readonly corners?: CornerOp | Readonly<Partial<Record<Corner, CornerOp>>>;
  readonly edges?: Readonly<Partial<Record<Edge, readonly EdgeOp[]>>>;
}

/** A full circle centred in the host box. */
export interface RingShape {
  readonly kind: 'ring';
  /** Distance of the track from the nearer sides of the host box. Default 0. */
  readonly inset?: number;
  /** Fixed radius. Default: half the host's smaller side minus `inset`. */
  readonly radius?: number;
}

/** An open circular track centred in the host box. */
export interface ArcShape {
  readonly kind: 'arc';
  /** Angle at which the track starts. */
  readonly start: number;
  /** Angular length; positive is clockwise. Clamped to ±360. */
  readonly sweep: number;
  readonly inset?: number;
  readonly radius?: number;
}

/** Everything `track.resolve` will accept. */
export type ShapeSpec = FrameShape | RingShape | ArcShape;
