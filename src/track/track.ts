import { layoutFrame } from './frame.js';
import type { FrameInfo } from './frame.js';
import type { ShapeSpec } from './shape.js';

/** A named interval on a track, as arc lengths from the track's start. */
export interface Anchor {
  readonly start: number;
  readonly end: number;
}

/**
 * A resolved centreline. Callers treat it as opaque geometry: they read
 * its length and anchors, draw its `path`, and ask this module for
 * offsets and portions. An empty track (`length` 0, empty `path`) means
 * "nothing to draw" and is what every degenerate input resolves to.
 *
 * Closed tracks travel clockwise. A ring starts at the top; a frame
 * starts in the middle of its top edge, so the seam lies on a straight
 * run and never on a corner.
 */
export interface Track {
  /** Whether the end meets the start. */
  readonly closed: boolean;
  /** Arc length in CSS pixels. */
  readonly length: number;
  /**
   * The centreline as path data (`M`, `L`, `A` and `Z` commands), valid
   * for an SVG `d` attribute and for `Path2D`. Arc length along it runs
   * from 0 at the first point to `length` at the last.
   */
  readonly path: string;
  /**
   * Named intervals: the corners of a frame (`tl`, `tr`, `br`, `bl`) and
   * the displaced flat part of every step that has an `id`. A sharp
   * corner is an interval of zero length.
   */
  readonly anchors: Readonly<Record<string, Anchor>>;
}

/** A straight piece of a track. */
export interface Line {
  readonly kind: 'line';
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/**
 * A circular piece of a track. Angles are radians measured from straight
 * up, growing clockwise, so the point at angle a is
 * (cx + r·sin a, cy − r·cos a).
 */
export interface Arc {
  readonly kind: 'arc';
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly start: number;
  /** Signed angular length; positive is clockwise. */
  readonly sweep: number;
}

/**
 * A piece with the identity it was given when the shape was laid out.
 * Offsets keep identities, which is how anchors find their pieces again
 * on a parallel track.
 */
export type Piece = (Line | Arc) & { readonly id: number };

/**
 * Where an anchor lies, in terms of pieces: the pieces it covers, and
 * the piece that precedes it, which locates it when it covers none (a
 * sharp corner) or when its pieces did not survive an offset.
 */
export interface AnchorRef {
  readonly ids: readonly number[];
  readonly after: number;
}

/** Distances from the four sides of the host box. */
export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** What a resolved shape remembers about itself, beyond its pieces. */
type Layout =
  | { readonly kind: 'frame'; readonly info: FrameInfo }
  | { readonly kind: 'round'; readonly radius: number; readonly width: number; readonly height: number };

/** What this module keeps on a track beyond the public fields. */
interface TrackData extends Track {
  readonly pieces: readonly Piece[];
  /** Which side of the direction of travel is the inside: 1 right, −1 left. */
  readonly side: 1 | -1;
  readonly refs: Readonly<Record<string, AnchorRef>>;
  /** Present on tracks that `resolve` returned, not on ones derived from them. */
  readonly layout?: Layout;
}

const TAU = Math.PI * 2;
const EPSILON = 1e-9;
const EMPTY: TrackData = {
  closed: false,
  length: 0,
  path: '',
  anchors: {},
  pieces: [],
  side: 1,
  refs: {},
};

/**
 * Turns a shape description into a track for a host of the given size.
 *
 * @param shape What to draw.
 * @param width Host width in CSS pixels.
 * @param height Host height in CSS pixels.
 * @param previous The track this one replaces after a resize, if any.
 *   Details it showed stay as long as they fit; details it had left out
 *   come back only once they fit with a few pixels to spare, so that a
 *   size hovering around a threshold does not make them flicker.
 * @returns The track, or an empty track when the size is not positive
 *   and finite or the shape does not fit (a ring radius of zero or less,
 *   a frame whose inset leaves no box).
 */
export function resolve(shape: ShapeSpec, width: number, height: number, previous?: Track): Track {
  if (!(width > 0 && height > 0) || !Number.isFinite(width + height)) return EMPTY;

  if (shape.kind === 'frame') {
    const before = (previous as Partial<TrackData> | undefined)?.layout;
    const { pieces, refs, info } = layoutFrame(
      shape,
      width,
      height,
      before?.kind === 'frame' ? before.info : undefined,
    );
    return pieces.length < 3 ? EMPTY : build(pieces, true, 1, refs, { kind: 'frame', info });
  }

  const inset = finiteOr(shape.inset, 0);
  const radius = finiteOr(shape.radius, Math.min(width, height) / 2 - inset);
  if (!(radius > 0)) return EMPTY;
  const circle = { kind: 'arc', id: 0, cx: width / 2, cy: height / 2, radius } as const;

  const round: Layout = { kind: 'round', radius, width, height };
  if (shape.kind === 'ring') {
    return build([{ ...circle, start: 0, sweep: TAU }], true, 1, {}, round);
  }
  const sweep = clamp(finiteOr(shape.sweep, 0), -360, 360) * (Math.PI / 180);
  if (sweep === 0) return EMPTY;
  const start = finiteOr(shape.start, 0) * (Math.PI / 180);
  return build([{ ...circle, start, sweep }], false, sweep > 0 ? 1 : -1, {}, round);
}

/**
 * Returns the track that runs parallel to `track` at `distance` pixels
 * toward the inside of the shape (negative: toward the outside).
 *
 * Details too small to survive the offset disappear instead of folding
 * over: a chamfer or a step's flat part that the offset consumes is
 * dropped and its neighbours meet, and a fillet whose radius reaches
 * zero becomes a sharp corner. Anchors follow their pieces; an anchor
 * whose pieces are gone shrinks to the point where they were.
 *
 * @returns An empty track when the offset consumes the shape itself
 *   (opposite sides meet, or a ring's radius reaches zero), or when
 *   `track` is empty or was not produced by this module.
 */
export function offset(track: Track, distance: number): Track {
  const data = track as Partial<TrackData>;
  if (data.pieces === undefined || data.pieces.length === 0 || data.side === undefined) return EMPTY;
  const shift = finiteOr(distance, 0) * data.side;
  if (shift === 0) return track;

  const pieces = offsetPieces(data.pieces, shift, track.closed);
  return pieces === undefined ? EMPTY : build(pieces, track.closed, data.side, data.refs ?? {});
}

/**
 * Whether a band that covers the distances `from` to `to` inward from
 * the track reads as a strip there.
 *
 * It does not when its inner edge would pass through the shape, and, on
 * a shape made of arcs alone, when its inner edge would curve tighter
 * than the band is wide: that close to the centre a band clots into a
 * blob. A host that is too small for a band is how this usually arises.
 *
 * @param spare Extra room, in pixels, the band must leave. Callers pass
 *   it for a band that is not shown at the moment, so that a band does
 *   not flicker while the host's size hovers around the point where it
 *   starts to fit.
 */
export function holds(track: Track, from: number, to: number, spare = 0): boolean {
  const inner = offset(track, Math.max(from, to) + spare) as Partial<TrackData>;
  if (inner.pieces === undefined || inner.pieces.length === 0) return false;
  const width = Math.abs(to - from) + spare;
  const round = inner.pieces.every((piece) => piece.kind === 'arc');
  return !round || inner.pieces.every((piece) => piece.kind !== 'arc' || piece.radius > width);
}

/**
 * How far from each side of the host box content must stay to be clear
 * of a shape whose bands reach `depth` pixels inward from its track.
 *
 * For a frame this accounts for the frame's own inset, inward steps on
 * each side, and corners: a rectangle with these insets does not touch a
 * chamfer or a fillet. For a ring or an arc it is the largest rectangle
 * with the host's centre that fits inside the innermost band.
 *
 * @returns Zeros for an empty track or one that `resolve` did not return.
 */
export function clearance(track: Track, depth: number): Insets {
  const layout = (track as Partial<TrackData>).layout;
  const reach = Math.max(0, finiteOr(depth, 0));
  if (layout === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };

  if (layout.kind === 'round') {
    const half = Math.max(0, layout.radius - reach) / Math.SQRT2;
    const x = Math.max(0, layout.width / 2 - half);
    const y = Math.max(0, layout.height / 2 - half);
    return { top: y, right: x, bottom: y, left: x };
  }

  const { info } = layout;
  // What a corner asks of the two sides that meet in it, so that the
  // corner of the content box stays inside the innermost band there.
  const corner = (name: 'tl' | 'tr' | 'br' | 'bl'): number => {
    const size = info.extent[name];
    if (info.corner[name] === 'chamfer') return size / 2 + reach / Math.SQRT2;
    if (info.corner[name] === 'fillet' && size > reach) return size - (size - reach) / Math.SQRT2;
    return reach;
  };
  const side = (edge: 'top' | 'right' | 'bottom' | 'left', a: 'tl' | 'tr' | 'br' | 'bl', b: typeof a) =>
    info.inset + Math.max(reach + info.stepDepth[edge], corner(a), corner(b));
  return {
    top: side('top', 'tl', 'tr'),
    right: side('right', 'tr', 'br'),
    bottom: side('bottom', 'br', 'bl'),
    left: side('left', 'bl', 'tl'),
  };
}

/**
 * Returns the first `share` of a track, measured by arc length from its
 * start. This is how a band shows progress and how it draws on.
 *
 * @param share 0–1. One or more, or not a number, returns the track
 *   itself; zero or less returns an empty track. The result is open.
 */
export function portion(track: Track, share: number): Track {
  if (Number.isNaN(share) || share >= 1) return track;
  const data = track as Partial<TrackData>;
  if (!(share > 0) || data.pieces === undefined || data.side === undefined) return EMPTY;

  let remaining = share * track.length;
  const pieces: Piece[] = [];
  for (const piece of data.pieces) {
    const length = lengthOf(piece);
    if (length <= remaining) {
      pieces.push(piece);
      remaining -= length;
      continue;
    }
    const part = remaining / length;
    if (part > 0) {
      pieces.push(
        piece.kind === 'arc'
          ? { ...piece, sweep: piece.sweep * part }
          : {
              ...piece,
              x1: piece.x0 + (piece.x1 - piece.x0) * part,
              y1: piece.y0 + (piece.y1 - piece.y0) * part,
            },
      );
    }
    break;
  }
  return pieces.length === 0 ? EMPTY : build(pieces, false, data.side, data.refs ?? {});
}

function build(
  pieces: readonly Piece[],
  closed: boolean,
  side: 1 | -1,
  refs: Readonly<Record<string, AnchorRef>>,
  layout?: Layout,
): TrackData {
  // Where each surviving piece lies along the track.
  const spans = new Map<number, Anchor>();
  let length = 0;
  let path = '';
  let straight = false;
  for (const piece of pieces) {
    const start = length;
    length += lengthOf(piece);
    spans.set(piece.id, { start, end: length });
    if (path === '') path = `M${pointText(startOf(piece))}`;
    if (piece.kind === 'line') {
      straight = true;
      path += `L${pointText({ x: piece.x1, y: piece.y1 })}`;
    } else {
      path += arcCommands(piece);
    }
  }
  // Closing the path gives the seam a proper corner join. A ring has no
  // corners and its last arc already ends on its first point.
  if (closed && straight) path += 'Z';

  const anchors: Record<string, Anchor> = {};
  for (const [name, ref] of Object.entries(refs)) {
    const kept = ref.ids.map((id) => spans.get(id)).filter((span) => span !== undefined);
    const first = kept[0];
    const last = kept[kept.length - 1];
    if (first !== undefined && last !== undefined) {
      anchors[name] = { start: first.start, end: last.end };
      continue;
    }
    // Nothing of the anchor is left: it sits where the nearest surviving
    // piece before it ends.
    let at = 0;
    for (let id = ref.after; id >= 0; id--) {
      const span = spans.get(id);
      if (span !== undefined) {
        at = span.end;
        break;
      }
    }
    anchors[name] = { start: at, end: at };
  }
  return layout === undefined
    ? { closed, length, path, anchors, pieces, side, refs }
    : { closed, length, path, anchors, pieces, side, refs, layout };
}

/** One piece while a parallel track is being worked out. */
type Shifted =
  | {
      readonly piece: Piece & Line;
      readonly ux: number;
      readonly uy: number;
      readonly px: number;
      readonly py: number;
    }
  | { readonly piece: Piece & Arc; readonly radius: number };

/**
 * Moves every piece `shift` pixels to the right of its direction of
 * travel and finds where neighbours now meet. Lines that end up running
 * backwards have been consumed by the offset; they are removed one at a
 * time, worst first, and their neighbours joined, until none is left.
 *
 * @returns The new pieces, or `undefined` when the shape itself is
 *   consumed.
 */
function offsetPieces(
  pieces: readonly Piece[],
  shift: number,
  closed: boolean,
): Piece[] | undefined {
  const items: Shifted[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i] as Piece;
    if (piece.kind === 'line') {
      const length = lengthOf(piece);
      const ux = (piece.x1 - piece.x0) / length;
      const uy = (piece.y1 - piece.y0) / length;
      items.push({ piece, ux, uy, px: piece.x0 - uy * shift, py: piece.y0 + ux * shift });
      continue;
    }
    const radius = piece.radius - shift * Math.sign(piece.sweep);
    if (radius > 0) {
      items.push({ piece, radius });
      continue;
    }
    // A fillet between two lines turns into the sharp corner where they
    // meet. An arc with no lines around it is the shape itself.
    const before = pieces[i - 1] ?? (closed ? pieces[pieces.length - 1] : undefined);
    const after = pieces[i + 1] ?? (closed ? pieces[0] : undefined);
    if (before?.kind !== 'line' || after?.kind !== 'line' || pieces.length < 3) return undefined;
  }

  for (;;) {
    const count = items.length;
    if (count === 0) return undefined;
    const looped = closed && count > 1;
    const joints: { x: number; y: number }[] = [];
    for (let i = 0; i < (looped ? count : count - 1); i++) {
      const joint = meet(items[i] as Shifted, items[(i + 1) % count] as Shifted, shift);
      if (joint === undefined) return undefined;
      joints.push(joint);
    }

    const result: Piece[] = [];
    let worst = -1;
    let worstLength = -EPSILON;
    for (let i = 0; i < count; i++) {
      const item = items[i] as Shifted;
      if ('radius' in item) {
        result.push({ ...item.piece, radius: item.radius });
        continue;
      }
      const start =
        looped || i > 0
          ? (joints[(i - 1 + count) % count] as { x: number; y: number })
          : { x: item.px, y: item.py };
      const end =
        looped || i < count - 1
          ? (joints[i] as { x: number; y: number })
          : { x: item.piece.x1 - item.uy * shift, y: item.piece.y1 + item.ux * shift };
      const length = (end.x - start.x) * item.ux + (end.y - start.y) * item.uy;
      if (length < worstLength) {
        worst = i;
        worstLength = length;
      }
      if (length > EPSILON) {
        result.push({ ...item.piece, x0: start.x, y0: start.y, x1: end.x, y1: end.y });
      }
    }
    if (worst < 0) {
      // Sides that have just met leave lines of no length behind, and
      // what remains encloses nothing: it is no longer an outline.
      const outline = closed && result.some((piece) => piece.kind === 'line');
      return outline && Math.abs(enclosedArea(result)) < EPSILON ? undefined : result;
    }

    // Joining across a removed line only works between straight pieces.
    const before = items[(worst - 1 + count) % count] as Shifted;
    const after = items[(worst + 1) % count] as Shifted;
    if ('radius' in before || 'radius' in after) return undefined;
    items.splice(worst, 1);
    if (closed && items.length < 3) return undefined;
  }
}

/** The point where two neighbouring shifted pieces meet. */
function meet(a: Shifted, b: Shifted, shift: number): { x: number; y: number } | undefined {
  // Arcs are tangent to their neighbours, so they meet them at their own ends.
  if ('radius' in a) return arcPoint(a.piece, a.radius, a.piece.start + a.piece.sweep);
  if ('radius' in b) return arcPoint(b.piece, b.radius, b.piece.start);

  const cross = a.ux * b.uy - a.uy * b.ux;
  if (Math.abs(cross) < 1e-12) {
    // Parallel: one line carrying on meets itself where it used to;
    // opposite sides that have reached each other consume the shape.
    if (a.ux * b.ux + a.uy * b.uy < 0) return undefined;
    return { x: a.piece.x1 - a.uy * shift, y: a.piece.y1 + a.ux * shift };
  }
  const along = ((b.px - a.px) * b.uy - (b.py - a.py) * b.ux) / cross;
  return { x: a.px + a.ux * along, y: a.py + a.uy * along };
}

/** Area of the polygon through the pieces' starting points. */
function enclosedArea(pieces: readonly Piece[]): number {
  let doubled = 0;
  for (let i = 0; i < pieces.length; i++) {
    const a = startOf(pieces[i] as Piece);
    const b = startOf(pieces[(i + 1) % pieces.length] as Piece);
    doubled += a.x * b.y - b.x * a.y;
  }
  return doubled / 2;
}

function lengthOf(piece: Line | Arc): number {
  return piece.kind === 'line'
    ? Math.hypot(piece.x1 - piece.x0, piece.y1 - piece.y0)
    : piece.radius * Math.abs(piece.sweep);
}

function startOf(piece: Line | Arc): { x: number; y: number } {
  return piece.kind === 'line'
    ? { x: piece.x0, y: piece.y0 }
    : arcPoint(piece, piece.radius, piece.start);
}

function arcPoint(arc: Arc, radius: number, angle: number): { x: number; y: number } {
  return { x: arc.cx + radius * Math.sin(angle), y: arc.cy - radius * Math.cos(angle) };
}

/**
 * Path commands for one arc, from the current point. An SVG arc command
 * cannot describe more than a half turn unambiguously, so longer arcs
 * are split into equal pieces.
 */
function arcCommands(arc: Arc): string {
  const count = Math.max(1, Math.ceil(Math.abs(arc.sweep) / Math.PI - 1e-9));
  const step = arc.sweep / count;
  const flag = arc.sweep > 0 ? 1 : 0;
  const r = format(arc.radius);
  let commands = '';
  for (let i = 1; i <= count; i++) {
    commands += `A${r} ${r} 0 0 ${flag} ${pointText(arcPoint(arc, arc.radius, arc.start + step * i))}`;
  }
  return commands;
}

function pointText(point: { x: number; y: number }): string {
  return `${format(point.x)} ${format(point.y)}`;
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
