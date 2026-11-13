/**
 * surface — rendering.
 *
 * Hides: how bands become SVG elements and attributes, in particular how
 * drawn intervals are expressed as dash arrays; which elements exist in
 * a live drawing and what is written to them on each paint; later, how
 * the same scene is drawn on a canvas. Receives
 * resolved tracks and compiled patterns; never computes geometry.
 *
 * Interface: `svgMarkup(scene) → string` for a standalone document and
 * `createSvgSurface(host) → SvgSurface` for a drawing that is repainted
 * in place.
 */
export { createSvgSurface, svgMarkup } from './svg.js';
export type { Layer, Scene, SvgSurface } from './svg.js';
