import type { Dashes } from '../pattern/index.js';
import type { Track } from '../track/index.js';

/** One band, ready to draw: where it runs, how wide, which parts. */
export interface Layer {
  /** The part of the band's centreline that is shown. */
  readonly track: Track;
  /** Band width in CSS pixels. */
  readonly width: number;
  /** Drawn stretches, compiled for `patternLength`. */
  readonly dashes: Dashes;
  /**
   * The length the pattern was laid out for: the whole centreline, which
   * is longer than `track` when only a share of the band is shown.
   */
  readonly patternLength: number;
  /** How far the pattern has travelled along the band, in pixels. */
  readonly phase: number;
  /** 0–1. */
  readonly opacity: number;
}

/** Everything drawn for one host, back to front. */
export interface Scene {
  readonly width: number;
  readonly height: number;
  readonly layers: readonly Layer[];
}

/**
 * Serialises a scene as a standalone SVG document. The drawing takes its
 * colour from the CSS `color` of wherever it is placed.
 *
 * Layers with nothing to show (empty track, no intervals, zero width or
 * opacity) are left out, so an empty scene is a valid, empty SVG.
 */
export function svgMarkup(scene: Scene): string {
  const width = format(Math.max(0, scene.width));
  const height = format(Math.max(0, scene.height));
  let body = '';
  for (const layer of scene.layers) body += layerMarkup(layer);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}" fill="none" stroke="currentColor">${body}</svg>`
  );
}

function layerMarkup(layer: Layer): string {
  const { track, dashes } = layer;
  const visible =
    track.length > 0 && layer.width > 0 && layer.opacity > 0 && dashes.intervals.length > 0;
  if (!visible) return '';

  let attributes = `d="${track.path}" stroke-width="${format(layer.width)}"`;
  if (dashes.cap === 'round') attributes += ' stroke-linecap="round"';
  attributes += dashAttributes(dashes.intervals, layer.patternLength, layer.phase);
  if (layer.opacity < 1) attributes += ` opacity="${format(layer.opacity)}"`;
  return `<path ${attributes}/>`;
}

/**
 * Expresses intervals as a dash array. The array alternates dash and gap
 * and its sum equals the pattern length, so the pattern never repeats
 * within the path; the gap after the last dash runs on to the first
 * dash. A negative dash offset moves the first dash to where it belongs
 * and carries the pattern's travel: because the array is as long as the
 * band, what leaves at the end comes back in at the start.
 */
function dashAttributes(intervals: readonly number[], length: number, phase: number): string {
  const first = intervals[0] as number;
  const solid = intervals.length === 2 && first <= 0 && (intervals[1] as number) >= length;
  if (solid) return '';

  const parts: string[] = [];
  for (let i = 0; i < intervals.length; i += 2) {
    const start = intervals[i] as number;
    const end = intervals[i + 1] as number;
    const next = i + 2 < intervals.length ? (intervals[i + 2] as number) : length + first;
    parts.push(format(end - start), format(next - end));
  }
  const travelled = Number.isFinite(phase) && length > 0 ? phase - Math.floor(phase / length) * length : 0;
  const shift = first + travelled;
  const offset = shift === 0 ? '' : ` stroke-dashoffset="${format(-shift)}"`;
  return ` stroke-dasharray="${parts.join(' ')}"${offset}`;
}

/** Three decimals are below anything a screen can show. */
function format(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 1000) / 1000;
  return rounded === 0 ? '0' : String(rounded);
}
