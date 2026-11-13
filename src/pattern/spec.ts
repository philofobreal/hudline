/**
 * Pattern descriptions: which stretches of a band are drawn.
 *
 * A pattern knows only a length and, for spans, named anchors on it. It
 * does not know whether the track is a ring or a frame. Lengths are CSS
 * pixels measured along the band's centreline.
 */

/**
 * An interval tied to a named anchor of the track (a frame corner, or a
 * step that has an `id`). It covers the anchor's own extent, widened by
 * `before` and `after` pixels; negative values trim it. A span whose
 * anchor does not exist on the resolved track draws nothing.
 */
export interface Span {
  readonly anchor: string;
  /** Pixels added before the anchor's start. Default 0. */
  readonly before?: number;
  /** Pixels added after the anchor's end. Default 0. */
  readonly after?: number;
}

export type PatternSpec =
  /** The whole band. */
  | { readonly kind: 'solid' }
  /**
   * Repeating dash and gap. On a closed track the period is fitted so
   * that no seam shows; dash and gap keep their ratio.
   */
  | { readonly kind: 'dashes'; readonly dash: number; readonly gap: number }
  /**
   * `count` equal intervals separated by `gap` pixels. When the band is
   * too short for that many, the count drops to the largest that leaves
   * each interval at least a pixel long.
   */
  | { readonly kind: 'segments'; readonly count: number; readonly gap: number }
  /**
   * `count` evenly spaced marks, each `thickness` pixels long (default 1).
   * When the band is too short to keep `minSpacing` pixels (default 3)
   * between neighbours, the count drops to the largest that fits. With
   * `multipleOf`, it drops to the largest multiple of that number, so a
   * second band with exactly that many marks stays lined up with this
   * one: 60 minor ticks with `multipleOf: 12` thin to 48, 36, 24, 12.
   */
  | {
      readonly kind: 'ticks';
      readonly count: number;
      readonly thickness?: number;
      readonly minSpacing?: number;
      readonly multipleOf?: number;
    }
  /**
   * `count` evenly spaced round dots as wide as the band. Thins out like
   * ticks; `minSpacing`, here from centre to centre, defaults to twice
   * the band width.
   */
  | { readonly kind: 'dots'; readonly count: number; readonly minSpacing?: number }
  /**
   * Seeded irregular intervals: block lengths vary between `min` and
   * `max`, separated by `gap`. `density` (0–1, default 1) is the share of
   * blocks that are drawn. The same seed and length give the same result.
   */
  | {
      readonly kind: 'blocks';
      readonly seed: number;
      readonly min: number;
      readonly max: number;
      readonly gap: number;
      readonly density?: number;
    }
  /**
   * Explicit intervals as fractions of the band length, 0 to 1. On a
   * ring a fraction is an angle divided by 360.
   */
  | {
      readonly kind: 'intervals';
      readonly intervals: readonly { readonly from: number; readonly to: number }[];
    }
  /** Intervals tied to named anchors of the track. */
  | { readonly kind: 'spans'; readonly spans: readonly Span[] };
