/**
 * Smooth, repeatable noise along one axis.
 *
 * @param seed Selects the curve; non-finite seeds behave as 0.
 * @param x Position along the curve. The curve takes a new random level
 *   at every whole number and glides between them.
 * @returns A value in [0, 1], the same for the same arguments on every
 *   platform. Not a number in, 0 out.
 */
export function noise(seed: number, x: number): number {
  if (!Number.isFinite(x)) return 0;
  const cell = Math.floor(x);
  const t = x - cell;
  const ease = t * t * (3 - 2 * t);
  const a = lattice(seed, cell);
  return a + (lattice(seed, cell + 1) - a) * ease;
}

/** A fixed pseudo-random level in [0, 1) for one whole-number position. */
function lattice(seed: number, cell: number): number {
  let h = (seed | 0) ^ Math.imul(cell | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
