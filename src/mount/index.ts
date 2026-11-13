/**
 * mount — binding specs to hosts.
 *
 * Hides: how a spec is played (which bands fit, how seeds are mixed, how
 * states map to targets, what is recomputed when); later, which
 * observers and events are used, the shared animation loop, element
 * lifecycle and cleanup, and how DOM events become states. Owns the
 * public API and the top-level spec types that combine shape, pattern
 * and motion.
 *
 * The only library module allowed to import the other four.
 *
 * Interface today: `createPlayer(spec, width, height) → Player` and
 * `renderToString(spec, width, height) → string`, both without a DOM.
 * `attach` arrives in milestone M4.
 */
export { createPlayer, renderToString } from './player.js';
export type { Player } from './player.js';
export type { BandOverride, BandSpec, HudSpec, StateSpec } from './spec.js';
