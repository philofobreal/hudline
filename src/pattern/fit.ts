/**
 * Adjusts the period of a repeating pattern so that a whole number of
 * periods covers a closed track exactly. Without this the pattern shows
 * a seam where the track closes, which becomes visible as soon as the
 * pattern moves.
 *
 * @param length Arc length of the closed track, in CSS pixels.
 * @param period Desired period, in CSS pixels.
 * @returns The fitted period, the value closest to `period` that divides
 *   `length` evenly. At least one period always fits, so the result never
 *   exceeds `length`. Returns 0, meaning "no pattern", when either
 *   argument is not a positive finite number.
 */
export function fitPeriod(length: number, period: number): number {
  if (!Number.isFinite(length) || !Number.isFinite(period)) return 0;
  if (length <= 0 || period <= 0) return 0;
  const count = Math.max(1, Math.round(length / period));
  return length / count;
}
