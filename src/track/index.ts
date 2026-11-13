/**
 * track — geometry.
 *
 * Hides: how a shape description becomes a centreline of straight
 * segments and circular arcs; corner operators (chamfer, fillet) and
 * edge operators (tab, step, notch); which details drop out when space
 * is short; offsets for bands; arc length. Knows nothing about the DOM,
 * rendering or time. Pure.
 *
 * Planned interface: `resolve(shape, width, height) → Track`
 * (rings in milestone M1, frames in M3).
 */
export {};
