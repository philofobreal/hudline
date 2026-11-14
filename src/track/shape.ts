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
 * How a frame corner is shaped. Sizes are fixed pixels; when the two
 * corners of an edge ask for more than the edge has, both shrink by the
 * same factor.
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
   * Name of the anchor this step publishes: its displaced flat part,
   * without the ramps. Patterns can refer to it to place spans on the
   * step. A name that is also a corner name (`tl`, `tr`, `br`, `bl`)
   * replaces that corner's anchor.
   */
  readonly id?: string;
  readonly from: Along;
  readonly to: Along;
  /** Displacement in pixels: positive moves the edge inward, negative outward. */
  readonly depth: number;
  /** How the edge reaches the displaced level. Default `'diagonal'` (45°). */
  readonly ramp?: 'diagonal' | 'square';
  /**
   * Higher numbers are placed first when the edge is too short for all
   * of its steps, or when steps would overlap. Default 0. Among equals,
   * the one declared earlier is placed first. A step needs room for both
   * ramps and at least a pixel of flat part within the edge's straight
   * run, or it is left out.
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

/**
 * An open line along one side of the host box, with the same steps a
 * frame edge can have: a divider, an underline, a callout rule.
 *
 * It travels in reading direction, left to right or top to bottom. Its
 * inside, where bands with a positive offset go and where a step with a
 * positive depth points, is the side toward the middle of the box. Its
 * two ends are published as the anchors `start` and `end`.
 *
 * A step that reaches an end of the line has no ramp there: the line
 * starts or ends at the step's level. That is how a line changes level
 * once and stays there.
 */
export interface LineShape {
  readonly kind: 'line';
  /** The side it runs along. Default `'bottom'`. */
  readonly edge?: Edge;
  /** Distance from that side, toward the middle of the box. Default 0. */
  readonly inset?: number;
  /** Distance kept free at both ends. Default 0. */
  readonly pad?: number;
  readonly steps?: readonly EdgeOp[];
}

/** Everything `track.resolve` will accept. */
export type ShapeSpec = FrameShape | RingShape | ArcShape | LineShape;
