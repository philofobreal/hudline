import type { Layer } from './svg.js';

/** Whether a layer has anything to show. */
export function visible(layer: Layer): boolean {
  return (
    layer.track.length > 0 &&
    layer.width > 0 &&
    layer.opacity > 0 &&
    layer.dashes.intervals.length > 0
  );
}

/**
 * Expresses intervals as alternating dash and gap lengths, or
 * `undefined` when they cover the whole pattern length and no dashing is
 * needed. The lengths add up to the pattern length, so the pattern never
 * repeats within the path; the gap after the last dash runs on to the
 * first dash. SVG and canvas both take dashes in this form.
 */
export function dashLengths(intervals: readonly number[], length: number): number[] | undefined {
  const first = intervals[0] as number;
  if (intervals.length === 2 && first <= 0 && (intervals[1] as number) >= length) return undefined;

  const lengths: number[] = [];
  for (let i = 0; i < intervals.length; i += 2) {
    const start = intervals[i] as number;
    const end = intervals[i + 1] as number;
    const next = i + 2 < intervals.length ? (intervals[i + 2] as number) : length + first;
    lengths.push(end - start, next - end);
  }
  return lengths;
}

/**
 * The parts of a pattern as a flat list of start and length. Where the
 * first interval starts at 0 and the last ends at the pattern length,
 * the two are one interval that crosses the seam, and one part.
 */
export function partsOf(intervals: readonly number[], length: number): number[] {
  const parts: number[] = [];
  for (let i = 0; i < intervals.length; i += 2) {
    parts.push(intervals[i] as number, (intervals[i + 1] as number) - (intervals[i] as number));
  }
  const last = parts.length - 2;
  if (last >= 2 && parts[0] === 0 && (parts[last] as number) + (parts[last + 1] as number) >= length) {
    parts[last + 1] = (parts[last + 1] as number) + (parts[1] as number);
    parts.splice(0, 2);
  }
  return parts;
}

/**
 * How far the pattern has travelled, within one pattern length. Because
 * a dash pattern is as long as the band, what leaves at the end comes
 * back in at the start.
 */
export function travelOf(layer: Layer): number {
  const { phase, patternLength: length } = layer;
  return Number.isFinite(phase) && length > 0 ? phase - Math.floor(phase / length) * length : 0;
}

/** How far a hatch's stripes have moved, within one stripe and gap. */
export function hatchTravel(shift: number, period: number): number {
  return period > 0 && Number.isFinite(shift) ? shift - Math.floor(shift / period) * period : 0;
}
