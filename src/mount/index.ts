/**
 * mount — binding specs to hosts.
 *
 * Hides: how a spec is turned into a scene (which bands fit, how seeds
 * are mixed, how value and opacity apply); later, which observers and
 * events are used, the shared animation loop, element lifecycle and
 * cleanup, and how DOM events become states. Owns the public API and the
 * top-level spec types that combine shape, pattern and motion.
 *
 * The only library module allowed to import the other four.
 *
 * Interface today: `renderToString(spec, width, height) → string`.
 * `attach` arrives in milestone M4.
 */
export { renderToString } from './render.js';
export type { BandOverride, BandSpec, HudSpec, StateSpec } from './spec.js';
