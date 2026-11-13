import { fitPeriod } from './fit.js';
import type { PatternSpec } from './spec.js';

/**
 * The drawn stretches of one band: a flat list of start and end arc
 * lengths (`[s0, e0, s1, e1, …]`), sorted, not overlapping, all within
 * 0 and the length the pattern was compiled for. An interval that wraps
 * around the seam of a cyclic band is stored as two, one ending at the
 * length and one starting at 0.
 */
export interface Dashes {
  readonly intervals: readonly number[];
  /**
   * `'round'` means every interval is a dot: it has zero length and is
   * drawn as a disc as wide as the band.
   */
  readonly cap: 'butt' | 'round';
}

/** What a pattern needs to know about the band it is compiled for. */
export interface PatternContext {
  /** Arc length of the band's centreline, in CSS pixels. */
  readonly length: number;
  /**
   * Whether the pattern must join seamlessly from the band's end to its
   * start. True for a closed band, and for an open band whose pattern
   * travels along it: what leaves at the end comes back in at the start.
   */
  readonly cyclic: boolean;
  /** Band width in CSS pixels. */
  readonly width: number;
  /** Named intervals on the band that span patterns may refer to. */
  readonly anchors?: Readonly<Record<string, { readonly start: number; readonly end: number }>>;
  /**
   * Supplies a deterministic generator of numbers in [0, 1) for a seed.
   * Seeded patterns draw all their randomness from it, so the caller
   * decides how seeds are mixed and the result stays reproducible.
   */
  readonly random: (seed: number) => () => number;
}

/**
 * More intervals than this cannot be told apart on a screen and would
 * only cost time; patterns are thinned or drawn solid instead.
 */
const MAX_INTERVALS = 2048;
/**
 * How far a span's ends are pulled in from where the anchor arithmetic
 * puts them, in pixels: too little to see, enough to stay clear of the
 * rounding of path coordinates and dash lengths.
 */
const SPAN_INSET = 0.05;
/** The shortest segment worth drawing, in pixels. */
const MIN_SEGMENT = 1;

const NONE: Dashes = { intervals: [], cap: 'butt' };

/**
 * Works out which stretches of a band a pattern draws.
 *
 * Never throws: a length that is not positive and finite, or parameters
 * that leave nothing to draw, give an empty result. Counts are reduced
 * when the band is too short for them, as each pattern kind documents.
 */
export function compile(spec: PatternSpec, context: PatternContext): Dashes {
  const { length, cyclic: closed } = context;
  if (!(length > 0) || !Number.isFinite(length)) return NONE;

  switch (spec.kind) {
    case 'solid':
      return { intervals: [0, length], cap: 'butt' };

    case 'dashes':
      return dashes(spec.dash, spec.gap, length, closed);

    case 'segments':
      return segments(spec.count, spec.gap, length, closed);

    case 'ticks': {
      const thickness = positiveOr(spec.thickness, 1);
      const spacing = thickness + nonNegativeOr(spec.minSpacing, 3);
      return marks(spec.count, thickness, spacing, spec.multipleOf, 0, 'butt', length, closed);
    }

    case 'dots': {
      const width = positiveOr(context.width, 1);
      const spacing = positiveOr(spec.minSpacing, width * 2);
      return marks(spec.count, 0, spacing, undefined, width, 'round', length, closed);
    }

    case 'blocks':
      return blocks(spec, context.random(spec.seed), length, closed);

    case 'intervals':
      return normalize(
        spec.intervals.flatMap(({ from, to }) => {
          const a = clamp01(from) * length;
          const b = clamp01(to) * length;
          if (b > a) return [[a, b] as const];
          return closed && b < a ? [[a, b + length] as const] : [];
        }),
        length,
        closed,
        'butt',
      );

    case 'spans':
      return normalize(
        spec.spans.flatMap((span) => {
          const anchor = context.anchors?.[span.anchor];
          if (anchor === undefined) return [];
          // An anchor's ends are corners of the track. A dash that ends
          // exactly on a corner picks up a sliver of the turn there, or
          // not, depending on the last decimal; pulled in by a hair, its
          // end is a clean cut across the band whatever the rounding.
          const start = anchor.start - finiteOr(span.before, 0) + SPAN_INSET;
          const end = anchor.end + finiteOr(span.after, 0) - SPAN_INSET;
          return end > start ? [[start, end] as const] : [];
        }),
        length,
        closed,
        'butt',
      );
  }
}

function dashes(dash: number, gap: number, length: number, closed: boolean): Dashes {
  if (!(dash > 0) || !Number.isFinite(dash)) return NONE;
  if (!(gap > 0) || !Number.isFinite(gap)) return { intervals: [0, length], cap: 'butt' };

  const period = closed ? fitPeriod(length, dash + gap) : dash + gap;
  const drawn = dash * (period / (dash + gap));
  const count = closed ? Math.round(length / period) : Math.ceil(length / period);
  // Too fine to see as dashes: a solid band is the honest rendering.
  if (count > MAX_INTERVALS) return { intervals: [0, length], cap: 'butt' };

  const intervals: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = i * period;
    intervals.push(start, Math.min(start + drawn, length));
  }
  return { intervals, cap: 'butt' };
}

function segments(requested: number, rawGap: number, length: number, closed: boolean): Dashes {
  const gap = nonNegativeOr(rawGap, 0);
  // A closed band has one gap per segment, an open one a gap less.
  const fits = Math.floor((closed ? length : length + gap) / (MIN_SEGMENT + gap));
  const count = Math.min(wholeOr(requested, 0), fits, MAX_INTERVALS);
  if (count < 1) return NONE;

  const intervals: number[] = [];
  if (closed) {
    // Gaps are centred on the slot boundaries, so one sits at the seam.
    const slot = length / count;
    for (let i = 0; i < count; i++) intervals.push(i * slot + gap / 2, (i + 1) * slot - gap / 2);
  } else {
    const size = (length - (count - 1) * gap) / count;
    for (let i = 0; i < count; i++) intervals.push(i * (size + gap), i * (size + gap) + size);
  }
  return { intervals, cap: 'butt' };
}

/**
 * Evenly spaced marks of one size: ticks, or dots when `size` is 0.
 *
 * When the band is too short for `requested` marks at `spacing` pixels
 * from centre to centre, the count drops to the largest that fits. With
 * `multipleOf`, it drops to the largest multiple of that number instead,
 * so that marks of another band with that count keep lining up.
 *
 * @param margin Distance kept free at both ends of an open band.
 */
function marks(
  requested: number,
  size: number,
  spacing: number,
  multipleOf: number | undefined,
  margin: number,
  cap: 'butt' | 'round',
  length: number,
  closed: boolean,
): Dashes {
  const usable = closed ? length : length - Math.max(size, margin);
  const fits = closed ? Math.floor(usable / spacing) : Math.floor(usable / spacing) + 1;
  const limit = Math.min(wholeOr(requested, 0), usable < 0 ? 0 : fits, MAX_INTERVALS);
  const step = Math.max(1, wholeOr(multipleOf, 1));
  const count = limit >= step ? limit - (limit % step) : limit;
  if (count < 1) return NONE;

  const pieces: (readonly [number, number])[] = [];
  for (let i = 0; i < count; i++) {
    let centre: number;
    if (closed) centre = (i * length) / count;
    else if (count === 1) centre = length / 2;
    else centre = (length - usable) / 2 + (i * usable) / (count - 1);
    pieces.push([centre - size / 2, centre + size / 2]);
  }
  return normalize(pieces, length, closed, cap);
}

function blocks(
  spec: { readonly min: number; readonly max: number; readonly gap: number; readonly density?: number },
  random: () => number,
  length: number,
  closed: boolean,
): Dashes {
  const min = Math.max(MIN_SEGMENT, finiteOr(spec.min, MIN_SEGMENT));
  const max = Math.max(min, finiteOr(spec.max, min));
  const gap = nonNegativeOr(spec.gap, 0);
  const density = clamp01(finiteOr(spec.density, 1));

  // Draw block sizes until they cover the band, then scale the whole row
  // so that it ends exactly at the band's end and a closed band has no seam.
  const sizes: number[] = [];
  let total = 0;
  while (total < length && sizes.length < MAX_INTERVALS) {
    const size = min + random() * (max - min);
    sizes.push(size);
    total += size + gap;
  }
  if (!closed) total -= gap;
  const scale = length / total;

  // On a closed band the row starts at a seeded position; otherwise every
  // block band of a ring would begin at the same angle and the starts
  // would line up into a visible spoke.
  const phase = closed ? random() * length : 0;
  const pieces: (readonly [number, number])[] = [];
  let position = 0;
  for (const size of sizes) {
    const end = Math.min(position + size * scale, length);
    // The generator is consulted for every block so that changing the
    // density does not reshuffle the sizes.
    if (random() < density) pieces.push([position + phase, end + phase]);
    position = end + gap * scale;
  }
  return normalize(pieces, length, closed, 'butt');
}

/**
 * Brings raw intervals into the form `Dashes` promises: wrapped around
 * the seam on closed bands or clipped on open ones, sorted and merged.
 * Zero-length intervals survive only as dots.
 */
function normalize(
  pieces: readonly (readonly [number, number])[],
  length: number,
  closed: boolean,
  cap: 'butt' | 'round',
): Dashes {
  const placed: [number, number][] = [];
  for (const [rawStart, rawEnd] of pieces) {
    if (!Number.isFinite(rawStart + rawEnd) || rawEnd < rawStart) continue;
    if (rawEnd - rawStart >= length) return { intervals: [0, length], cap };
    if (closed) {
      const shift = Math.floor(rawStart / length) * length;
      const start = rawStart - shift;
      const end = rawEnd - shift;
      if (end > length) placed.push([start, length], [0, end - length]);
      else placed.push([start, end]);
    } else {
      const start = Math.max(0, rawStart);
      const end = Math.min(length, rawEnd);
      if (end >= start) placed.push([start, end]);
    }
  }
  placed.sort((a, b) => a[0] - b[0]);

  const intervals: number[] = [];
  for (const [start, end] of placed) {
    if (cap === 'butt' && end - start < 1e-9) continue;
    const last = intervals.length - 1;
    if (last > 0 && start <= (intervals[last] as number)) {
      intervals[last] = Math.max(intervals[last] as number, end);
    } else {
      intervals.push(start, end);
    }
  }
  return { intervals, cap };
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function positiveOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegativeOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** A count: the whole part of a finite number, or the fallback. */
function wholeOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? Math.floor(value) : fallback;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
