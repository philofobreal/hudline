import type { Dashes } from '../pattern/index.js';
import type { Track } from '../track/index.js';
import { dashLengths, hatchTravel, partsOf, travelOf, visible } from './dash.js';
import type { Hatch, Scene } from './svg.js';

/** Where and in which colour a scene is drawn on a canvas. */
export interface CanvasOptions {
  /** Where the scene's top-left corner goes, in the context's units. Default 0, 0. */
  readonly x?: number;
  readonly y?: number;
  /**
   * Any CSS colour. Default: the context's current stroke style if that
   * is a colour, otherwise black.
   */
  readonly color?: string;
}

/**
 * Draws a scene on a 2D canvas context: the same drawing a live SVG
 * surface shows for that scene, to within a pixel.
 *
 * The scene is drawn over whatever the canvas holds; clearing is the
 * caller's business, as is scaling the context for the device's pixel
 * ratio. The context is left as it was found.
 *
 * Does nothing where there is no canvas support (`Path2D` missing).
 */
export function drawScene(
  context: CanvasRenderingContext2D,
  scene: Scene,
  options: CanvasOptions = {},
): void {
  if (typeof Path2D === 'undefined') return;
  const color =
    options.color ?? (typeof context.strokeStyle === 'string' ? context.strokeStyle : '#000');
  const alpha = context.globalAlpha;

  context.save();
  context.translate(finiteOr(options.x, 0), finiteOr(options.y, 0));
  context.lineJoin = 'miter';
  context.miterLimit = 4;

  for (const layer of scene.layers) {
    if (!visible(layer)) continue;
    const path = pathOf(layer.track);
    const laid = layoutOf(layer.dashes, layer.patternLength);
    const travelled = travelOf(layer);
    context.lineWidth = layer.width;
    context.lineCap = layer.dashes.cap;
    context.strokeStyle =
      layer.hatch === undefined ? color : hatchPaint(context, layer.hatch, color) ?? color;

    if (layer.levels === undefined) {
      context.setLineDash(laid.whole ?? SOLID);
      context.lineDashOffset =
        laid.whole === undefined ? 0 : -((layer.dashes.intervals[0] as number) + travelled);
      context.globalAlpha = alpha * Math.min(1, layer.opacity);
      context.stroke(path);
      continue;
    }
    for (let part = 0; part < laid.parts.length / 2; part++) {
      const opacity = layer.opacity * (layer.levels[part] ?? 1);
      if (!(opacity > 0)) continue;
      const length = laid.parts[part * 2 + 1] as number;
      context.setLineDash(length >= layer.patternLength ? SOLID : [length, layer.patternLength - length]);
      context.lineDashOffset = -((laid.parts[part * 2] as number) + travelled);
      context.globalAlpha = alpha * Math.min(1, opacity);
      context.stroke(path);
    }
  }
  context.restore();
}

const SOLID: number[] = [];

/** A pattern as canvas wants it, kept for as long as the pattern lives. */
interface Laid {
  readonly length: number;
  readonly whole: number[] | undefined;
  readonly parts: readonly number[];
}

// Tracks and patterns are rebuilt only when their inputs change, so what
// is derived from them is kept alongside them and goes when they go.
const paths = new WeakMap<Track, Path2D>();
const layouts = new WeakMap<Dashes, Laid>();

function pathOf(track: Track): Path2D {
  let path = paths.get(track);
  if (path === undefined) paths.set(track, (path = new Path2D(track.path)));
  return path;
}

function layoutOf(dashes: Dashes, length: number): Laid {
  let laid = layouts.get(dashes);
  if (laid === undefined || laid.length !== length) {
    laid = {
      length,
      whole: dashLengths(dashes.intervals, length),
      parts: partsOf(dashes.intervals, length),
    };
    layouts.set(dashes, laid);
  }
  return laid;
}

/** A stripe tile and the paint made from it. */
interface Tile {
  readonly pattern: CanvasPattern;
  /** Canvas pixels per stripe and gap. */
  readonly size: number;
}

/** Tiles per context, by colour and stripe sizes. */
const tiles = new WeakMap<object, Map<string, Tile | null>>();
/** Tile pixels per unit, so that thin stripes stay crisp when magnified. */
const TILE_DETAIL = 4;

/**
 * A paint of upright stripes, turned to the hatch's angle and moved
 * across itself, in the same way the SVG surface builds its pattern.
 *
 * @returns `undefined` where a tile cannot be made; the band is then
 *   drawn solid.
 */
function hatchPaint(
  context: CanvasRenderingContext2D,
  hatch: Hatch,
  color: string,
): CanvasPattern | undefined {
  const period = hatch.stripe + hatch.gap;
  if (!(period > 0) || typeof DOMMatrix === 'undefined') return undefined;

  let made = tiles.get(context);
  if (made === undefined) tiles.set(context, (made = new Map()));
  const key = `${color} ${hatch.stripe} ${hatch.gap}`;
  let tile = made.get(key);
  if (tile === undefined) {
    tile = makeTile(context, hatch, color);
    made.set(key, tile);
  }
  if (tile === null) return undefined;

  tile.pattern.setTransform(
    new DOMMatrix()
      .rotate(hatch.angle)
      .translate(hatchTravel(hatch.shift, period), 0)
      .scale(period / tile.size),
  );
  return tile.pattern;
}

function makeTile(context: CanvasRenderingContext2D, hatch: Hatch, color: string): Tile | null {
  const period = hatch.stripe + hatch.gap;
  const size = Math.max(1, Math.ceil(period * TILE_DETAIL));
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(size, size)
      : context.canvas.ownerDocument?.createElement('canvas');
  if (canvas === undefined) return null;
  canvas.width = size;
  canvas.height = size;
  const brush = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (brush === null) return null;
  brush.fillStyle = color;
  brush.fillRect(0, 0, (hatch.stripe / period) * size, size);
  const pattern = context.createPattern(canvas, 'repeat');
  return pattern === null ? null : { pattern, size };
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}
