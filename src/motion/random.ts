/** A deterministic source of numbers in the half-open range [0, 1). */
export type Random = () => number;

/**
 * Creates a seeded pseudo-random generator (mulberry32).
 *
 * The same seed always produces the same sequence, on every platform,
 * which is what makes seeded patterns and noise-driven motion
 * reproducible. Not suitable for anything security-related.
 *
 * @param seed Any number; it is reduced to an unsigned 32-bit integer.
 *   Non-finite seeds behave as 0.
 */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
