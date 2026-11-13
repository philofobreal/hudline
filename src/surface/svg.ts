import type { Dashes } from '../pattern/index.js';
import type { Track } from '../track/index.js';

/** One band, ready to draw: where it runs, how wide, which parts. */
export interface Layer {
  /**
   * Which band of the spec this is. A live surface keeps one element per
   * band and finds it again by this number on every frame.
   */
  readonly band: number;
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

/** A drawing that lives in a host element and is repainted in place. */
export interface SvgSurface {
  /**
   * Makes the drawing show `scene`. Only what differs from the previous
   * paint is written to the DOM: a band that merely travels costs one
   * attribute per frame.
   */
  paint(scene: Scene): void;
  /** Takes the drawing out of the host. */
  remove(): void;
}

const SVG = 'http://www.w3.org/2000/svg';

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
  for (const layer of scene.layers) {
    if (!visible(layer)) continue;
    const array = dashArray(layer.dashes.intervals, layer.patternLength);
    const shift = array === undefined ? 0 : dashShift(layer);
    body += `<path d="${layer.track.path}" stroke-width="${format(layer.width)}"`;
    if (layer.dashes.cap === 'round') body += ' stroke-linecap="round"';
    if (array !== undefined) body += ` stroke-dasharray="${array}"`;
    if (shift !== 0) body += ` stroke-dashoffset="${format(-shift)}"`;
    if (layer.opacity < 1) body += ` opacity="${format(layer.opacity)}"`;
    body += '/>';
  }
  return (
    `<svg xmlns="${SVG}" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}" fill="none" stroke="currentColor">${body}</svg>`
  );
}

/** What was last written for one band, so that it is not written again. */
interface Slot {
  readonly path: Element;
  shown: boolean;
  seen: number;
  track: Track | undefined;
  width: number;
  cap: string;
  dashes: Dashes | undefined;
  patternLength: number;
  dashed: boolean;
  shift: number;
  opacity: number;
}

/**
 * Puts a drawing into `host`: one `<svg>` child that covers the host's
 * padding box, lets pointer events through and is hidden from assistive
 * technology. It takes its colour from the host's CSS `color`.
 *
 * The host must be a positioned element for the drawing to cover it;
 * making it one is the caller's business.
 */
export function createSvgSurface(host: Element): SvgSurface {
  const root = host.ownerDocument.createElementNS(SVG, 'svg');
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('fill', 'none');
  root.setAttribute('stroke', 'currentColor');
  root.setAttribute(
    'style',
    'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none',
  );
  host.appendChild(root);

  const slots: (Slot | undefined)[] = [];
  let paints = 0;

  function slotFor(band: number): Slot {
    let slot = slots[band];
    if (slot === undefined) {
      const path = host.ownerDocument.createElementNS(SVG, 'path');
      // Bands are stacked in the order of the spec, whichever is drawn
      // first: the path goes in front of the next band that has one.
      let above: Element | null = null;
      for (let next = band + 1; next < slots.length && above === null; next++) {
        above = slots[next]?.path ?? null;
      }
      root.insertBefore(path, above);
      slot = {
        path,
        shown: true,
        seen: 0,
        track: undefined,
        width: Number.NaN,
        cap: 'butt',
        dashes: undefined,
        patternLength: Number.NaN,
        dashed: false,
        shift: 0,
        opacity: 1,
      };
      slots[band] = slot;
    }
    return slot;
  }

  function hide(slot: Slot): void {
    if (!slot.shown) return;
    slot.shown = false;
    slot.path.setAttribute('display', 'none');
  }

  return {
    paint(scene) {
      paints++;
      for (const layer of scene.layers) {
        const slot = slotFor(layer.band);
        slot.seen = paints;
        if (!visible(layer)) {
          hide(slot);
          continue;
        }
        const path = slot.path;
        if (!slot.shown) {
          slot.shown = true;
          path.removeAttribute('display');
        }
        if (slot.track !== layer.track) {
          slot.track = layer.track;
          path.setAttribute('d', layer.track.path);
        }
        if (slot.width !== layer.width) {
          slot.width = layer.width;
          path.setAttribute('stroke-width', format(layer.width));
        }
        if (slot.cap !== layer.dashes.cap) {
          slot.cap = layer.dashes.cap;
          if (slot.cap === 'round') path.setAttribute('stroke-linecap', 'round');
          else path.removeAttribute('stroke-linecap');
        }
        if (slot.dashes !== layer.dashes || slot.patternLength !== layer.patternLength) {
          slot.dashes = layer.dashes;
          slot.patternLength = layer.patternLength;
          const array = dashArray(layer.dashes.intervals, layer.patternLength);
          slot.dashed = array !== undefined;
          if (array === undefined) path.removeAttribute('stroke-dasharray');
          else path.setAttribute('stroke-dasharray', array);
        }
        const shift = slot.dashed ? dashShift(layer) : 0;
        if (slot.shift !== shift) {
          slot.shift = shift;
          if (shift === 0) path.removeAttribute('stroke-dashoffset');
          else path.setAttribute('stroke-dashoffset', format(-shift));
        }
        const opacity = Math.min(1, layer.opacity);
        if (slot.opacity !== opacity) {
          slot.opacity = opacity;
          if (opacity === 1) path.removeAttribute('opacity');
          else path.setAttribute('opacity', format(opacity));
        }
      }
      // Bands the scene left out this time.
      for (const slot of slots) {
        if (slot !== undefined && slot.seen !== paints) hide(slot);
      }
    },
    remove() {
      root.remove();
    },
  };
}

function visible(layer: Layer): boolean {
  return (
    layer.track.length > 0 &&
    layer.width > 0 &&
    layer.opacity > 0 &&
    layer.dashes.intervals.length > 0
  );
}

/**
 * Expresses intervals as a dash array, or `undefined` when they cover
 * the whole pattern length and no dashing is needed. The array
 * alternates dash and gap and its sum equals the pattern length, so the
 * pattern never repeats within the path; the gap after the last dash
 * runs on to the first dash.
 */
function dashArray(intervals: readonly number[], length: number): string | undefined {
  const first = intervals[0] as number;
  if (intervals.length === 2 && first <= 0 && (intervals[1] as number) >= length) return undefined;

  let array = '';
  for (let i = 0; i < intervals.length; i += 2) {
    const start = intervals[i] as number;
    const end = intervals[i + 1] as number;
    const next = i + 2 < intervals.length ? (intervals[i + 2] as number) : length + first;
    array += `${i === 0 ? '' : ' '}${format(end - start)} ${format(next - end)}`;
  }
  return array;
}

/**
 * How far the dash array has to be moved forward: to where its first
 * dash belongs, plus the pattern's travel. Because the array is as long
 * as the band, what leaves at the end comes back in at the start.
 */
function dashShift(layer: Layer): number {
  const { phase, patternLength: length } = layer;
  const travelled =
    Number.isFinite(phase) && length > 0 ? phase - Math.floor(phase / length) * length : 0;
  return (layer.dashes.intervals[0] as number) + travelled;
}

/** Three decimals are below anything a screen can show. */
function format(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 1000) / 1000;
  return rounded === 0 ? '0' : String(rounded);
}
