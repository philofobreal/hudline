/**
 * mount — binding to the DOM.
 *
 * Hides: which observers and events are used, the shared animation
 * loop, element lifecycle and cleanup, and how DOM events become
 * states. Owns the public API (`attach` and its handle) and the
 * top-level spec types that combine shape, pattern and motion.
 *
 * The only library module allowed to import the other four
 * (`attach` arrives in milestone M4).
 */
export type { BandOverride, BandSpec, HudSpec, StateSpec } from './spec.js';
