import { createRandom } from '../motion/index.js';
import { compile, reveal } from '../pattern/index.js';
import { svgMarkup } from '../surface/index.js';
import type { Layer, Scene } from '../surface/index.js';
import { offset, resolve } from '../track/index.js';
import type { HudSpec } from './spec.js';

/**
 * Works out everything that is drawn for a spec on a host of the given
 * size, at rest: motion is not applied.
 *
 * A band is left out when the host is too small for it: when less than
 * the band's own width would remain between its inner edge and the
 * centre of the shape. Never throws.
 */
export function layout(spec: HudSpec, width: number, height: number): Scene {
  const base = resolve(spec.shape, width, height);
  const hostSeed = finiteOr(spec.seed, 0);
  const random = (seed: number) => createRandom(mixSeeds(seed, hostSeed));

  const layers: Layer[] = [];
  for (const band of spec.bands) {
    const bandWidth = finiteOr(band.width, 0);
    if (!(bandWidth > 0)) continue;
    const start = finiteOr(band.offset, 0);
    // Room for one more band width must remain inside the band. Closer
    // to the centre than that, a band stops reading as a strip and
    // clots into a blob.
    if (offset(base, start + bandWidth * 2).length <= 0) continue;
    const track = offset(base, start + bandWidth / 2);

    const pattern = compile(band.pattern ?? { kind: 'solid' }, {
      length: track.length,
      closed: track.closed,
      width: bandWidth,
      anchors: track.anchors,
      random,
    });
    layers.push({
      track,
      width: bandWidth,
      dashes: reveal(pattern, track.length, finiteOr(band.value, 1)),
      opacity: Math.min(1, Math.max(0, finiteOr(band.opacity, 1))),
    });
  }
  return { width, height, layers };
}

/**
 * Renders a spec as a standalone SVG document for a box of the given
 * size, at rest. Useful where there is no DOM: server rendering, tests,
 * exporting a still. The drawing takes its colour from CSS `color`.
 *
 * Never throws; a size or spec that leaves nothing to draw gives an
 * empty SVG.
 */
export function renderToString(spec: HudSpec, width: number, height: number): string {
  return svgMarkup(layout(spec, width, height));
}

/** Combines a pattern's seed with the host's, so each affects the result. */
function mixSeeds(seed: number, hostSeed: number): number {
  return ((seed | 0) ^ Math.imul(hostSeed | 0, 0x9e3779b1)) >>> 0;
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}
