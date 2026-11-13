/**
 * surface — rendering.
 *
 * Hides: how bands become SVG elements and attributes, in particular how
 * drawn intervals are expressed as dash arrays; later, how the same
 * scene is kept up to date in a live DOM and drawn on a canvas. Receives
 * resolved tracks and compiled patterns; never computes geometry.
 *
 * Interface: `svgMarkup(scene) → string`. Live updates arrive with
 * `mount` in milestone M4.
 */
export { svgMarkup } from './svg.js';
export type { Layer, Scene } from './svg.js';
