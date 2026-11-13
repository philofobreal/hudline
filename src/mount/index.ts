/**
 * mount — binding specs to hosts.
 *
 * Hides: how a spec is played (which bands fit, how seeds are mixed, how
 * states map to targets, what is recomputed when); which observers and
 * events are used; the one animation loop all drawings share and when it
 * runs; how pointer and focus events become states; how markup asks for
 * a drawing; element lifecycle and cleanup. Owns the public API and the top-level spec types that
 * combine shape, pattern and motion.
 *
 * The only library module allowed to import the other four.
 *
 * Interface: `attach(host, spec) → Hud` and `watch(specs, root?) → Watch`
 * for the DOM, and
 * `createPlayer(spec, width, height) → Player` and
 * `renderToString(spec, width, height) → string` without one.
 */
export { attach } from './attach.js';
export type { Hud } from './attach.js';
export { createPlayer, renderToString } from './player.js';
export { watch } from './watch.js';
export type { Watch } from './watch.js';
export type { Player } from './player.js';
export type { BandOverride, BandSpec, HudSpec, StateSpec } from './spec.js';
