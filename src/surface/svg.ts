import type { Dashes } from '../pattern/index.js';
import type { Track } from '../track/index.js';
import { dashLengths, hatchTravel, partsOf, travelOf, visible } from './dash.js';

/**
 * Diagonal stripes instead of a solid band. Lengths are CSS pixels,
 * measured across the stripes.
 */
export interface HatchSpec {
  readonly kind: 'hatch';
  /** Direction of the stripes in degrees; 0 is upright, 45 leans right. Default 45. */
  readonly angle?: number;
  /** Width of one stripe. Default 2. */
  readonly stripe?: number;
  /** Space between stripes. Default 4. */
  readonly gap?: number;
  /** Speed at which the stripes move across themselves, in pixels per second. Default 0. */
  readonly drift?: number;
}

/** A hatch with every number filled in, at one instant. */
export interface Hatch {
  readonly angle: number;
  readonly stripe: number;
  readonly gap: number;
  /** How far the stripes have moved across themselves, in pixels. */
  readonly shift: number;
}

/** One band, ready to draw: where it runs, how wide, which parts. */
export interface Layer {
  /**
   * Which band of the spec this is. A live surface keeps the elements of
   * each band and finds them again by this number on every frame.
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
  /** Stripes to paint the band with; solid when absent. */
  readonly hatch: Hatch | undefined;
  /**
   * Present on a band whose parts are drawn one by one: the brightness
   * of each part, 0–1, in the order `partCount` counts them.
   */
  readonly levels: readonly number[] | undefined;
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
 * How many parts a pattern has when its parts are drawn one by one. A
 * part is one drawn interval, except that on a band whose pattern wraps
 * around its seam the interval that crosses the seam counts once.
 */
export function partCount(dashes: Dashes, patternLength: number): number {
  return partsOf(dashes.intervals, patternLength).length / 2;
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
  let defs = '';
  let body = '';
  const known = new Set<string>();

  for (const layer of scene.layers) {
    if (!visible(layer)) continue;
    let common = `d="${layer.track.path}" stroke-width="${format(layer.width)}"`;
    if (layer.dashes.cap === 'round') common += ' stroke-linecap="round"';
    if (layer.hatch !== undefined) {
      // Named after what it looks like: two hatches that look the same
      // may share a pattern, in this document or any it is pasted into.
      const id = `hud-hatch-${hatchKey(layer.hatch).replace(/[^0-9a-z]/gi, '_')}`;
      if (!known.has(id)) {
        known.add(id);
        defs += `<pattern id="${id}" ${hatchAttributes(layer.hatch)}>${hatchTile(layer.hatch)}</pattern>`;
      }
      common += ` stroke="url(#${id})"`;
    }
    const travelled = travelOf(layer);

    if (layer.levels === undefined) {
      const array = dashArray(layer.dashes.intervals, layer.patternLength);
      const shift = array === undefined ? 0 : (layer.dashes.intervals[0] as number) + travelled;
      body += `<path ${common}${dashAttributes(array, shift)}${opacityAttribute(layer.opacity)}/>`;
      continue;
    }
    const parts = partsOf(layer.dashes.intervals, layer.patternLength);
    for (let i = 0; i < parts.length; i += 2) {
      const opacity = layer.opacity * (layer.levels[i / 2] ?? 1);
      if (!(opacity > 0)) continue;
      const array = partArray(parts[i + 1] as number, layer.patternLength);
      const shift = (parts[i] as number) + travelled;
      body += `<path ${common}${dashAttributes(array, shift)}${opacityAttribute(opacity)}/>`;
    }
  }
  if (defs !== '') defs = `<defs>${defs}</defs>`;
  return (
    `<svg xmlns="${SVG}" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}" fill="none" stroke="currentColor">${defs}${body}</svg>`
  );
}

/** One path element and what was last written to it. */
interface Cell {
  readonly path: Element;
  shown: boolean;
  track: Track | undefined;
  width: number;
  cap: string;
  array: string | undefined;
  shift: number;
  opacity: number;
  hatched: boolean;
}

/** The elements of one band. */
interface Slot {
  /** One cell for a band drawn whole; one per part otherwise. */
  readonly cells: Cell[];
  seen: number;
  // What the pattern works out to, kept until the pattern changes.
  dashes: Dashes | undefined;
  patternLength: number;
  wholeArray: string | undefined;
  parts: readonly number[];
  partArrays: (string | undefined)[];
  // The band's own hatch pattern, made when first needed.
  pattern: Element | undefined;
  patternId: string;
  patternKey: string;
  patternShift: number;
}

/** Hatch patterns need ids that are unique in the whole document. */
let patternsMade = 0;

/**
 * Puts a drawing into `host`: one `<svg>` child that covers the host's
 * padding box, lets pointer events through and is hidden from assistive
 * technology. It takes its colour from the host's CSS `color`. Bands are
 * stacked in the order of the spec.
 *
 * The host must be a positioned element for the drawing to cover it;
 * making it one is the caller's business.
 */
export function createSvgSurface(host: Element): SvgSurface {
  const create = (name: string) => host.ownerDocument.createElementNS(SVG, name);
  const root = create('svg');
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('fill', 'none');
  root.setAttribute('stroke', 'currentColor');
  root.setAttribute(
    'style',
    'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none',
  );
  host.appendChild(root);

  const slots: (Slot | undefined)[] = [];
  let defs: Element | undefined;
  let paints = 0;

  function slotFor(band: number): Slot {
    let slot = slots[band];
    if (slot === undefined) {
      slot = {
        cells: [],
        seen: 0,
        dashes: undefined,
        patternLength: Number.NaN,
        wholeArray: undefined,
        parts: [],
        partArrays: [],
        pattern: undefined,
        patternId: '',
        patternKey: '',
        patternShift: Number.NaN,
      };
      slots[band] = slot;
    }
    return slot;
  }

  function cellFor(band: number, slot: Slot, index: number): Cell {
    let cell = slot.cells[index];
    if (cell === undefined) {
      const path = create('path');
      // Bands are stacked in the order of the spec, whichever is drawn
      // first: the path goes in front of the next band that has one.
      let above: Element | null = null;
      for (let next = band + 1; next < slots.length && above === null; next++) {
        above = slots[next]?.cells[0]?.path ?? null;
      }
      root.insertBefore(path, above);
      cell = {
        path,
        shown: true,
        track: undefined,
        width: Number.NaN,
        cap: 'butt',
        array: undefined,
        shift: 0,
        opacity: 1,
        hatched: false,
      };
      slot.cells[index] = cell;
    }
    return cell;
  }

  function hide(cell: Cell): void {
    if (!cell.shown) return;
    cell.shown = false;
    cell.path.setAttribute('display', 'none');
  }

  /** Makes the band's hatch pattern match `hatch`, creating it if need be. */
  function hatchFor(slot: Slot, hatch: Hatch): string {
    if (slot.pattern === undefined) {
      if (defs === undefined) defs = root.insertBefore(create('defs'), root.firstChild);
      slot.patternId = `hud-hatch-${++patternsMade}`;
      slot.pattern = defs.appendChild(create('pattern'));
      slot.pattern.setAttribute('id', slot.patternId);
      slot.pattern.setAttribute('patternUnits', 'userSpaceOnUse');
      const stripe = slot.pattern.appendChild(create('rect'));
      stripe.setAttribute('fill', 'currentColor');
      stripe.setAttribute('stroke', 'none');
    }
    const period = hatch.stripe + hatch.gap;
    const key = `${hatch.angle} ${hatch.stripe} ${hatch.gap}`;
    if (slot.patternKey !== key) {
      slot.patternKey = key;
      slot.patternShift = Number.NaN;
      slot.pattern.setAttribute('width', format(period));
      slot.pattern.setAttribute('height', format(period));
      const stripe = slot.pattern.firstChild as Element;
      stripe.setAttribute('width', format(hatch.stripe));
      stripe.setAttribute('height', format(period));
    }
    if (slot.patternShift !== hatch.shift) {
      slot.patternShift = hatch.shift;
      slot.pattern.setAttribute('patternTransform', hatchTransform(hatch));
    }
    return slot.patternId;
  }

  function write(cell: Cell, layer: Layer, array: string | undefined, shift: number, opacity: number, paint: string | undefined): void {
    const path = cell.path;
    if (!(opacity > 0)) {
      hide(cell);
      return;
    }
    if (!cell.shown) {
      cell.shown = true;
      path.removeAttribute('display');
    }
    if (cell.track !== layer.track) {
      cell.track = layer.track;
      path.setAttribute('d', layer.track.path);
    }
    if (cell.width !== layer.width) {
      cell.width = layer.width;
      path.setAttribute('stroke-width', format(layer.width));
    }
    if (cell.cap !== layer.dashes.cap) {
      cell.cap = layer.dashes.cap;
      if (cell.cap === 'round') path.setAttribute('stroke-linecap', 'round');
      else path.removeAttribute('stroke-linecap');
    }
    if (cell.array !== array) {
      cell.array = array;
      if (array === undefined) path.removeAttribute('stroke-dasharray');
      else path.setAttribute('stroke-dasharray', array);
    }
    const offset = array === undefined ? 0 : shift;
    if (cell.shift !== offset) {
      cell.shift = offset;
      if (offset === 0) path.removeAttribute('stroke-dashoffset');
      else path.setAttribute('stroke-dashoffset', format(-offset));
    }
    const clamped = Math.min(1, opacity);
    if (cell.opacity !== clamped) {
      cell.opacity = clamped;
      if (clamped === 1) path.removeAttribute('opacity');
      else path.setAttribute('opacity', format(clamped));
    }
    const hatched = paint !== undefined;
    if (cell.hatched !== hatched) {
      cell.hatched = hatched;
      if (paint === undefined) path.removeAttribute('stroke');
      else path.setAttribute('stroke', `url(#${paint})`);
    }
  }

  return {
    paint(scene) {
      paints++;
      for (const layer of scene.layers) {
        const slot = slotFor(layer.band);
        slot.seen = paints;
        let used = 0;
        if (visible(layer)) {
          if (slot.dashes !== layer.dashes || slot.patternLength !== layer.patternLength) {
            slot.dashes = layer.dashes;
            slot.patternLength = layer.patternLength;
            slot.wholeArray = dashArray(layer.dashes.intervals, layer.patternLength);
            slot.parts = partsOf(layer.dashes.intervals, layer.patternLength);
            slot.partArrays.length = 0;
          }
          const paint = layer.hatch === undefined ? undefined : hatchFor(slot, layer.hatch);
          const travelled = travelOf(layer);
          if (layer.levels === undefined) {
            const shift = (layer.dashes.intervals[0] as number) + travelled;
            write(cellFor(layer.band, slot, 0), layer, slot.wholeArray, shift, layer.opacity, paint);
            used = 1;
          } else {
            used = slot.parts.length / 2;
            for (let part = 0; part < used; part++) {
              if (part >= slot.partArrays.length) {
                slot.partArrays[part] = partArray(slot.parts[part * 2 + 1] as number, layer.patternLength);
              }
              const array = slot.partArrays[part];
              const shift = (slot.parts[part * 2] as number) + travelled;
              const opacity = layer.opacity * (layer.levels[part] ?? 1);
              write(cellFor(layer.band, slot, part), layer, array, shift, opacity, paint);
            }
          }
        }
        for (let i = used; i < slot.cells.length; i++) hide(slot.cells[i] as Cell);
      }
      // Bands the scene left out this time.
      for (const slot of slots) {
        if (slot !== undefined && slot.seen !== paints) slot.cells.forEach(hide);
      }
    },
    remove() {
      root.remove();
    },
  };
}

/** `dashLengths` as the text of a `stroke-dasharray` attribute. */
function dashArray(intervals: readonly number[], length: number): string | undefined {
  return dashLengths(intervals, length)?.map(format).join(' ');
}

/** A dash array that shows one part and nothing else of the pattern. */
function partArray(partLength: number, patternLength: number): string | undefined {
  if (partLength >= patternLength) return undefined;
  return `${format(partLength)} ${format(patternLength - partLength)}`;
}

function dashAttributes(array: string | undefined, shift: number): string {
  if (array === undefined) return '';
  const offset = shift === 0 ? '' : ` stroke-dashoffset="${format(-shift)}"`;
  return ` stroke-dasharray="${array}"${offset}`;
}

function opacityAttribute(opacity: number): string {
  return opacity < 1 ? ` opacity="${format(opacity)}"` : '';
}

function hatchKey(hatch: Hatch): string {
  return `${format(hatch.angle)} ${format(hatch.stripe)} ${format(hatch.gap)} ${format(hatch.shift)}`;
}

/**
 * The stripes are drawn upright in the pattern's own space, moved across
 * themselves there, and the whole pattern is then turned to its angle.
 */
function hatchTransform(hatch: Hatch): string {
  const moved = hatchTravel(hatch.shift, hatch.stripe + hatch.gap);
  return `rotate(${format(hatch.angle)}) translate(${format(moved)} 0)`;
}

function hatchAttributes(hatch: Hatch): string {
  const period = format(hatch.stripe + hatch.gap);
  return `patternUnits="userSpaceOnUse" width="${period}" height="${period}" patternTransform="${hatchTransform(hatch)}"`;
}

function hatchTile(hatch: Hatch): string {
  const period = format(hatch.stripe + hatch.gap);
  return `<rect width="${format(hatch.stripe)}" height="${period}" fill="currentColor" stroke="none"/>`;
}

/** Three decimals are below anything a screen can show. */
function format(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 1000) / 1000;
  return rounded === 0 ? '0' : String(rounded);
}
