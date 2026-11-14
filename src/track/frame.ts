import type { Along, Corner, CornerOp, Edge, FrameShape, LineShape, StepOp } from './shape.js';
import type { AnchorRef, Arc, Line, Piece } from './track.js';

/** Which steps a layout placed, so that the next layout can keep them steady. */
export interface Placement {
  /** The steps that were placed, as `edge:index`. */
  readonly placed: ReadonlySet<string>;
}

/** What a laid-out line remembers about how it was laid out. */
export interface LineInfo extends Placement {
  readonly edge: Edge;
  /** Distance of the line from the side it runs along. */
  readonly inset: number;
  /** The deepest inward step placed on it; 0 if none. */
  readonly stepDepth: number;
  /** Which side of the direction of travel is the inside: 1 right, −1 left. */
  readonly side: 1 | -1;
}

/** What a laid-out frame remembers about how it was laid out. */
export interface FrameInfo extends Placement {
  /** Distance of the outline from the host box. */
  readonly inset: number;
  /** How much of each adjoining edge every corner takes, after fitting. */
  readonly extent: Readonly<Record<Corner, number>>;
  readonly corner: Readonly<Record<Corner, CornerOp['kind']>>;
  /** The deepest inward step placed on each edge; 0 if none. */
  readonly stepDepth: Readonly<Record<Edge, number>>;
}

/**
 * A step that was not there on the previous layout needs this much room
 * to spare before it appears. Without it, a host whose size hovers
 * around the point where a step starts to fit would show it flickering.
 */
const HYSTERESIS = 4;

/**
 * Lays a frame out as lines and arcs for a host of the given size.
 *
 * The outline travels clockwise. Corner sizes that do not fit an edge
 * are scaled down together. Steps keep their pixel sizes; those that do
 * not fit their edge, or that would overlap a step of higher priority,
 * are left out.
 *
 * @param previous The layout this one replaces, if any. Steps it had
 *   placed stay as long as they fit; steps it had left out come back
 *   only once they fit with room to spare.
 * @returns The pieces in order of travel, starting in the middle of the
 *   first straight run of the top edge, where the anchors lie, and what
 *   to remember. Fewer than three pieces means the frame does not fit
 *   the host at all.
 */
export function layoutFrame(
  shape: FrameShape,
  width: number,
  height: number,
  previous?: FrameInfo,
): { pieces: Piece[]; refs: Record<string, AnchorRef>; info: FrameInfo } {
  const inset = finiteOr(shape.inset, 0);
  const left = inset;
  const top = inset;
  const boxWidth = width - inset * 2;
  const boxHeight = height - inset * 2;
  const placedKeys = new Set<string>();
  const stepDepth = { top: 0, right: 0, bottom: 0, left: 0 };
  if (!(boxWidth > 0 && boxHeight > 0)) {
    const none = { tl: 0, tr: 0, br: 0, bl: 0 };
    const sharp = { tl: 'sharp', tr: 'sharp', br: 'sharp', bl: 'sharp' } as const;
    return {
      pieces: [],
      refs: {},
      info: { inset, extent: none, corner: sharp, stepDepth, placed: placedKeys },
    };
  }

  const ops = cornerOps(shape.corners);
  const extent = fitCorners(ops, boxWidth, boxHeight);
  // An inward step deeper than this would reach past the middle of the box.
  const maxDepth = Math.min(boxWidth, boxHeight) / 2;

  const right = left + boxWidth;
  const bottom = top + boxHeight;
  const edges: readonly Side[] = [
    { name: 'top', px: left, py: top, ux: 1, uy: 0, length: boxWidth, from: 'tl', to: 'tr', reversed: false, turn: 1 },
    { name: 'right', px: right, py: top, ux: 0, uy: 1, length: boxHeight, from: 'tr', to: 'br', reversed: false, turn: 1 },
    { name: 'bottom', px: right, py: bottom, ux: -1, uy: 0, length: boxWidth, from: 'br', to: 'bl', reversed: true, turn: 1 },
    { name: 'left', px: left, py: bottom, ux: 0, uy: -1, length: boxHeight, from: 'bl', to: 'tl', reversed: true, turn: 1 },
  ];

  // Pieces are collected as plain objects and numbered at the end, once
  // their final order is known. Anchors point at the objects until then.
  const drawn: (Line | Arc)[] = [];
  const anchors: { name: string; covers: (Line | Arc)[]; after: Line | Arc | undefined }[] = [];
  const first = edges[0] as Side;
  let cursor = pointOn(first, extent[first.from], 0);

  const lineTo = (x: number, y: number): Line | undefined => {
    const from = cursor;
    cursor = { x, y };
    if (Math.hypot(x - from.x, y - from.y) < 1e-9) return undefined;
    const line: Line = { kind: 'line', x0: from.x, y0: from.y, x1: x, y1: y };
    drawn.push(line);
    return line;
  };

  edges.forEach((edge, index) => {
    const runStart = extent[edge.from];
    const runEnd = edge.length - extent[edge.to];

    const steps = placeSteps(shape.edges?.[edge.name] ?? [], edge, runStart, runEnd, maxDepth, previous);
    for (const step of steps) {
      placedKeys.add(step.key);
      stepDepth[edge.name] = Math.max(stepDepth[edge.name], step.depth);
      const rise = pointOn(edge, step.start, 0);
      lineTo(rise.x, rise.y);
      const up = pointOn(edge, step.start + step.ramp, step.depth);
      lineTo(up.x, up.y);
      const before = drawn[drawn.length - 1];
      const flatEnd = pointOn(edge, step.end - step.ramp, step.depth);
      const flat = lineTo(flatEnd.x, flatEnd.y);
      const down = pointOn(edge, step.end, 0);
      lineTo(down.x, down.y);
      if (step.id !== undefined && flat !== undefined) {
        anchors.push({ name: step.id, covers: [flat], after: before });
      }
    }
    const end = pointOn(edge, runEnd, 0);
    lineTo(end.x, end.y);

    // The corner that ends this edge.
    const next = edges[(index + 1) % edges.length] as Side;
    const size = extent[edge.to];
    const before = drawn[drawn.length - 1];
    const entry = pointOn(next, size, 0);
    if (size < 1e-9) {
      anchors.push({ name: edge.to, covers: [], after: before });
    } else if (ops[edge.to].kind === 'fillet') {
      // The centre lies `size` back along this edge and `size` inward; the
      // arc leaves this edge pointing outward from it and turns a quarter.
      const corner = pointOn(edge, edge.length, 0);
      const arc: Arc = {
        kind: 'arc',
        cx: corner.x - edge.ux * size - edge.uy * size,
        cy: corner.y - edge.uy * size + edge.ux * size,
        radius: size,
        start: Math.atan2(edge.uy, edge.ux),
        sweep: Math.PI / 2,
      };
      drawn.push(arc);
      cursor = entry;
      anchors.push({ name: edge.to, covers: [arc], after: before });
    } else {
      const cut = lineTo(entry.x, entry.y);
      anchors.push({ name: edge.to, covers: cut === undefined ? [] : [cut], after: before });
    }
  });

  moveSeamToStraightRun(drawn, anchors);

  const ids = new Map<Line | Arc, number>(drawn.map((piece, id) => [piece, id]));
  const refs: Record<string, AnchorRef> = {};
  for (const anchor of anchors) {
    refs[anchor.name] = {
      ids: anchor.covers.map((piece) => ids.get(piece) as number),
      after: anchor.after === undefined ? -1 : (ids.get(anchor.after) as number),
    };
  }
  return {
    pieces: drawn.map((piece, id) => ({ ...piece, id })),
    refs,
    info: {
      inset,
      extent,
      corner: { tl: ops.tl.kind, tr: ops.tr.kind, br: ops.br.kind, bl: ops.bl.kind },
      stepDepth,
      placed: placedKeys,
    },
  };
}

/**
 * Lays a line out along one side of the host box, with its steps, in
 * reading direction. Steps follow the rules of frame edges.
 *
 * @returns The pieces from the line's start to its end, where the
 *   anchors lie (`start`, `end` and the flat part of every step with an
 *   id), and what to remember. No pieces means the line does not fit.
 */
export function layoutLine(
  shape: LineShape,
  width: number,
  height: number,
  previous?: Placement,
): { pieces: Piece[]; refs: Record<string, AnchorRef>; info: LineInfo } {
  const edge = shape.edge ?? 'bottom';
  const inset = finiteOr(shape.inset, 0);
  const pad = Math.max(0, finiteOr(shape.pad, 0));
  const horizontal = edge === 'top' || edge === 'bottom';
  const length = horizontal ? width : height;
  // Travel is in reading direction, so the inside is on the right for
  // the top and right sides and on the left for the bottom and left.
  const turn = edge === 'top' || edge === 'right' ? 1 : -1;
  const side: Side = {
    name: edge,
    px: edge === 'right' ? width : 0,
    py: edge === 'bottom' ? height : 0,
    ux: horizontal ? 1 : 0,
    uy: horizontal ? 0 : 1,
    length,
    from: 'tl',
    to: 'tl',
    reversed: false,
    turn,
  };
  const placedKeys = new Set<string>();
  const drawn: Line[] = [];
  const refs: Record<string, AnchorRef> = {};
  let stepDepth = 0;
  const info = (): LineInfo => ({ edge, inset, stepDepth, side: turn, placed: placedKeys });
  if (!(length - pad * 2 > 0)) return { pieces: [], refs, info: info() };

  const runEnd = length - pad;
  // An inward step may not reach past the middle of the box.
  const maxDepth = (horizontal ? height : width) / 2 - inset;
  const steps = placeSteps(shape.steps ?? [], side, pad, runEnd, maxDepth, previous);
  // A step that reaches an end of the line has no ramp there: the line
  // simply starts or ends at the step's level.
  const first = steps[0];
  const opensHigh = first !== undefined && first.start <= pad + 1e-9;

  let cursor = pointOn(side, pad, inset + (opensHigh ? first.depth : 0));
  const lineTo = (along: number, inward: number): number => {
    const to = pointOn(side, along, inset + inward);
    const from = cursor;
    cursor = to;
    if (Math.hypot(to.x - from.x, to.y - from.y) < 1e-9) return -1;
    drawn.push({ kind: 'line', x0: from.x, y0: from.y, x1: to.x, y1: to.y });
    return drawn.length - 1;
  };

  refs['start'] = { ids: [], after: -1 };
  let closesHigh = false;
  for (const step of steps) {
    placedKeys.add(step.key);
    stepDepth = Math.max(stepDepth, step.depth);
    const atStart = step.start <= pad + 1e-9;
    const atEnd = step.end >= runEnd - 1e-9;
    if (!atStart) {
      lineTo(step.start, 0);
      lineTo(step.start + step.ramp, step.depth);
    }
    const before = drawn.length - 1;
    const flat = lineTo(atEnd ? runEnd : step.end - step.ramp, step.depth);
    if (atEnd) closesHigh = true;
    else lineTo(step.end, 0);
    if (step.id !== undefined && flat >= 0) refs[step.id] = { ids: [flat], after: before };
  }
  if (!closesHigh) lineTo(runEnd, 0);
  refs['end'] = { ids: [], after: drawn.length - 1 };
  return { pieces: drawn.map((piece, id) => ({ ...piece, id })), refs, info: info() };
}

/** One side of the box, in the direction the outline travels along it. */
interface Side {
  readonly name: Edge;
  /** Where travel along this side starts. */
  readonly px: number;
  readonly py: number;
  /** Unit direction of travel. */
  readonly ux: number;
  readonly uy: number;
  readonly length: number;
  /** The corners at the start and end of travel. */
  readonly from: Corner;
  readonly to: Corner;
  /** Whether travel runs against reading direction. */
  readonly reversed: boolean;
  /** Which side of the direction of travel is the inside: 1 right, −1 left. */
  readonly turn: 1 | -1;
}

/** A step that fits, in distances of travel along its side. */
interface PlacedStep {
  /** `edge:index`, which identifies the step across layouts. */
  readonly key: string;
  readonly id: string | undefined;
  readonly start: number;
  readonly end: number;
  readonly depth: number;
  /** Distance along the side that each ramp takes. */
  readonly ramp: number;
}

/**
 * The point `along` pixels of travel down a side and `inward` pixels
 * toward the inside of the box.
 */
function pointOn(side: Side, along: number, inward: number): { x: number; y: number } {
  return {
    x: side.px + side.ux * along - side.uy * inward * side.turn,
    y: side.py + side.uy * along + side.ux * inward * side.turn,
  };
}

function cornerOps(corners: FrameShape['corners']): Record<Corner, CornerOp> {
  const sharp: CornerOp = { kind: 'sharp' };
  if (corners === undefined) return { tl: sharp, tr: sharp, br: sharp, bl: sharp };
  if ('kind' in corners) return { tl: corners, tr: corners, br: corners, bl: corners };
  return {
    tl: corners.tl ?? sharp,
    tr: corners.tr ?? sharp,
    br: corners.br ?? sharp,
    bl: corners.bl ?? sharp,
  };
}

/**
 * How much of each adjoining edge every corner takes. Where the two
 * corners of an edge ask for more than the edge has, both shrink by the
 * same factor, so their proportion is kept.
 */
function fitCorners(
  ops: Record<Corner, CornerOp>,
  boxWidth: number,
  boxHeight: number,
): Record<Corner, number> {
  const wanted = (op: CornerOp): number => {
    const size = op.kind === 'chamfer' ? op.size : op.kind === 'fillet' ? op.radius : 0;
    return Number.isFinite(size) && size > 0 ? size : 0;
  };
  const extent = { tl: wanted(ops.tl), tr: wanted(ops.tr), br: wanted(ops.br), bl: wanted(ops.bl) };
  const scale = { tl: 1, tr: 1, br: 1, bl: 1 };
  const sides: readonly (readonly [Corner, Corner, number])[] = [
    ['tl', 'tr', boxWidth],
    ['tr', 'br', boxHeight],
    ['br', 'bl', boxWidth],
    ['bl', 'tl', boxHeight],
  ];
  for (const [a, b, length] of sides) {
    const sum = extent[a] + extent[b];
    if (sum <= length) continue;
    scale[a] = Math.min(scale[a], length / sum);
    scale[b] = Math.min(scale[b], length / sum);
  }
  return {
    tl: extent.tl * scale.tl,
    tr: extent.tr * scale.tr,
    br: extent.br * scale.br,
    bl: extent.bl * scale.bl,
  };
}

/**
 * Chooses the steps of one side that fit its straight run and each
 * other, in order of travel. Higher priority is placed first; among
 * equals, earlier declaration wins.
 */
function placeSteps(
  steps: readonly StepOp[],
  side: Side,
  runStart: number,
  runEnd: number,
  maxDepth: number,
  previous: Placement | undefined,
): PlacedStep[] {
  // The straight run in reading direction, where authors measure.
  const readStart = side.reversed ? side.length - runEnd : runStart;
  const readEnd = side.reversed ? side.length - runStart : runEnd;

  const candidates = steps.map((step, order) => {
    const a = positionOf(step.from, readStart, readEnd);
    const b = positionOf(step.to, readStart, readEnd);
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    const depth = finiteOr(step.depth, 0);
    const key = `${side.name}:${order}`;
    // Whether the step is declared to sit on an end of the run, in
    // reading direction and then in direction of travel.
    const ends = [declaredEnd(step.from), declaredEnd(step.to)];
    const onReadStart = ends.includes('start');
    const onReadEnd = ends.includes('end');
    return {
      key,
      flushStart: side.reversed ? onReadEnd : onReadStart,
      flushEnd: side.reversed ? onReadStart : onReadEnd,
      // Room to spare is asked only of steps that are coming back.
      spare: previous === undefined || previous.placed.has(key) ? 0 : HYSTERESIS,
      id: step.id,
      start: side.reversed ? side.length - high : low,
      end: side.reversed ? side.length - low : high,
      depth,
      ramp: step.ramp === 'square' ? 0 : Math.abs(depth),
      priority: finiteOr(step.priority, 0),
      order,
    };
  });
  candidates.sort((a, b) => b.priority - a.priority || a.order - b.order);

  const placed: PlacedStep[] = [];
  for (const step of candidates) {
    const fits =
      step.depth !== 0 &&
      step.depth < maxDepth &&
      // Within the run; and a step that is coming back needs room to
      // spare at each end, unless it is meant to sit flush with that end.
      step.start >= runStart - 1e-9 &&
      step.end <= runEnd + 1e-9 &&
      (step.flushStart || step.start >= runStart + step.spare) &&
      (step.flushEnd || step.end <= runEnd - step.spare) &&
      // Both ramps and at least a pixel of flat part.
      step.end - step.start >= step.ramp * 2 + 1 + step.spare &&
      placed.every((other) => step.end <= other.start || step.start >= other.end);
    if (fits) placed.push(step);
  }
  return placed.sort((a, b) => a.start - b.start);
}

/** Which end of its run a position is declared to be, if either. */
function declaredEnd(along: Along): 'start' | 'end' | undefined {
  if ('fraction' in along) return along.fraction <= 0 ? 'start' : along.fraction >= 1 ? 'end' : undefined;
  return along.offset === 0 && along.from !== 'center' ? along.from : undefined;
}

/** Not a number when the description is unusable, which then fits nowhere. */
function positionOf(along: Along, start: number, end: number): number {
  if ('fraction' in along) {
    return start + Math.min(1, Math.max(0, along.fraction)) * (end - start);
  }
  if (along.from === 'start') return start + along.offset;
  if (along.from === 'end') return end - along.offset;
  return (start + end) / 2 + along.offset;
}

/**
 * Makes the outline start in the middle of its first line instead of at
 * that line's start, which is next to the top-left corner. A dash that
 * crosses the seam is drawn as two, and two dash ends do not form a
 * corner; on a straight run they simply continue each other.
 */
function moveSeamToStraightRun(
  drawn: (Line | Arc)[],
  anchors: { covers: (Line | Arc)[]; after: Line | Arc | undefined }[],
): void {
  const first = drawn[0];
  if (first === undefined || first.kind !== 'line') return;
  // A line that an anchor covers stays whole, so that the anchor does.
  if (anchors.some((anchor) => anchor.covers.includes(first))) return;

  const mx = (first.x0 + first.x1) / 2;
  const my = (first.y0 + first.y1) / 2;
  const tail: Line = { ...first, x1: mx, y1: my };
  drawn[0] = { ...first, x0: mx, y0: my };
  drawn.push(tail);
  for (const anchor of anchors) {
    // What came after the whole line now comes after its second half,
    // which opens the outline.
    if (anchor.after === first) anchor.after = drawn[0];
  }
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}
