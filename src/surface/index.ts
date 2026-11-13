/**
 * surface — rendering.
 *
 * Hides: how bands become SVG elements and attributes, in particular how
 * drawn intervals are expressed as dash arrays; how a hatch is painted;
 * how a band is split into parts that are drawn one by one; which
 * elements exist in
 * a live drawing and what is written to them on each paint; how the
 * same scene is drawn on a canvas. Receives
 * resolved tracks and compiled patterns; never computes geometry.
 *
 * Interface: `svgMarkup(scene) → string` for a standalone document,
 * `createSvgSurface(host) → SvgSurface` for a drawing that is repainted
 * in place, `drawScene(context, scene, options?)` for a 2D canvas, and
 * `partCount(dashes, patternLength)`.
 */
export { drawScene } from './canvas.js';
export type { CanvasOptions } from './canvas.js';
export { createSvgSurface, partCount, svgMarkup } from './svg.js';
export type { Hatch, HatchSpec, Layer, Scene, SvgSurface } from './svg.js';
