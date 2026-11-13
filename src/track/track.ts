import type { ShapeSpec } from './shape.js';

/** A named interval on a track, as arc lengths from the track's start. */
export interface Anchor {
  readonly start: number;
  readonly end: number;
}

/**
 * A resolved centreline. Callers treat it as opaque geometry: they read
 * its length and anchors, draw its `path`, and ask this module for
 * offsets. An empty track (`length` 0, empty `path`) means "nothing to
 * draw" and is what every degenerate input resolves to.
 */
export interface Track {
  /** Whether the end meets the start. */
  readonly closed: boolean;
  /** Arc length in CSS pixels. */
  readonly length: number;
  /**
   * The centreline as path data (`M` and `A` commands), valid for an SVG
   * `d` attribute and for `Path2D`. Arc length along it runs from 0 at
   * the first point to `length` at the last.
   */
  readonly path: string;
  readonly anchors: Readonly<Record<string, Anchor>>;
}

/**
 * A circular arc. Angles are radians measured from straight up, growing
 * clockwise, so the point at angle a is (cx + r·sin a, cy − r·cos a).
 * Straight segments join this in milestone M3.
 */
interface Arc {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly start: number;
  /** Signed angular length; positive is clockwise. */
  readonly sweep: number;
}

/** What this module keeps on a track beyond the public fields. */
interface TrackData extends Track {
  readonly arcs: readonly Arc[];
  /** Which side of the direction of travel is the inside: 1 right, −1 left. */
  readonly side: 1 | -1;
}

const TAU = Math.PI * 2;
const EMPTY: TrackData = { closed: false, length: 0, path: '', anchors: {}, arcs: [], side: 1 };

/**
 * Turns a shape description into a track for a host of the given size.
 *
 * @param shape What to draw.
 * @param width Host width in CSS pixels.
 * @param height Host height in CSS pixels.
 * @returns The track, or an empty track when the size is not positive
 *   and finite, when the shape does not fit (a radius of zero or less),
 *   or when the shape is a frame: frames arrive in milestone M3.
 */
export function resolve(shape: ShapeSpec, width: number, height: number): Track {
  if (!(width > 0 && height > 0) || !Number.isFinite(width + height)) return EMPTY;
  if (shape.kind === 'frame') return EMPTY;

  const inset = finiteOr(shape.inset, 0);
  const radius = finiteOr(shape.radius, Math.min(width, height) / 2 - inset);
  if (!(radius > 0)) return EMPTY;
  const centre = { cx: width / 2, cy: height / 2, radius };

  if (shape.kind === 'ring') {
    return build([{ ...centre, start: 0, sweep: TAU }], true, 1);
  }
  const sweep = clamp(finiteOr(shape.sweep, 0), -360, 360) * (Math.PI / 180);
  if (sweep === 0) return EMPTY;
  const start = finiteOr(shape.start, 0) * (Math.PI / 180);
  return build([{ ...centre, start, sweep }], false, sweep > 0 ? 1 : -1);
}

/**
 * Returns the track that runs parallel to `track` at `distance` pixels
 * toward the inside of the shape (negative: toward the outside).
 *
 * @returns An empty track when the offset collapses the shape, that is
 *   when any arc's radius would reach zero, or when `track` is empty or
 *   was not produced by this module.
 */
export function offset(track: Track, distance: number): Track {
  const data = track as Partial<TrackData>;
  if (data.arcs === undefined || data.arcs.length === 0 || data.side === undefined) return EMPTY;
  const shift = finiteOr(distance, 0) * data.side;
  if (shift === 0) return track;

  const arcs: Arc[] = [];
  for (const arc of data.arcs) {
    const radius = arc.radius - shift * Math.sign(arc.sweep);
    if (!(radius > 0)) return EMPTY;
    arcs.push({ ...arc, radius });
  }
  return build(arcs, track.closed, data.side);
}

function build(arcs: readonly Arc[], closed: boolean, side: 1 | -1): TrackData {
  let length = 0;
  let path = '';
  for (const arc of arcs) {
    length += arc.radius * Math.abs(arc.sweep);
    path += arcPath(arc, path === '');
  }
  return { closed, length, path, anchors: {}, arcs, side };
}

/**
 * Path data for one arc. An SVG arc command cannot describe more than a
 * half turn unambiguously, so longer arcs are split into equal pieces.
 */
function arcPath(arc: Arc, moveToStart: boolean): string {
  const pieces = Math.max(1, Math.ceil(Math.abs(arc.sweep) / Math.PI - 1e-9));
  const step = arc.sweep / pieces;
  const flag = arc.sweep > 0 ? 1 : 0;
  const r = format(arc.radius);
  let path = moveToStart ? `M${point(arc, arc.start)}` : '';
  for (let i = 1; i <= pieces; i++) {
    path += `A${r} ${r} 0 0 ${flag} ${point(arc, arc.start + step * i)}`;
  }
  return path;
}

function point(arc: Arc, angle: number): string {
  const x = arc.cx + arc.radius * Math.sin(angle);
  const y = arc.cy - arc.radius * Math.cos(angle);
  return `${format(x)} ${format(y)}`;
}

/** Three decimals are below anything a screen can show. */
function format(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return rounded === 0 ? '0' : String(rounded);
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
