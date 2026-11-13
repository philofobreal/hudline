/**
 * A value on its way to a target, as immutable data. It moves like a
 * critically damped spring: fast at first, settling without overshoot
 * when it starts at rest, and it can be given a new target at any moment
 * without a jump in position or speed.
 */
export interface Transition {
  /** Value at `start`. */
  readonly from: number;
  /** Speed at `start`, in units per second. */
  readonly velocity: number;
  readonly to: number;
  /** Time, in seconds, at which this transition began. */
  readonly start: number;
  /** Stiffness as an angular rate; 0 means the value sits on its target. */
  readonly rate: number;
}

/**
 * After this many time constants a critically damped spring that started
 * at rest is within one percent of its target.
 */
const SETTLE_FACTOR = 6.64;

/** A value at rest. */
export function rest(value: number): Transition {
  return { from: value, velocity: 0, to: value, start: 0, rate: 0 };
}

/** The value at `time` (seconds). Before `start` it is the starting value. */
export function valueAt(transition: Transition, time: number): number {
  // Once settled the value is the target exactly, so that the last frame
  // of a transition shows the target and not a hair beside it.
  if (settled(transition, time)) return transition.to;
  const elapsed = Math.max(0, time - transition.start);
  const distance = transition.from - transition.to;
  const drive = transition.velocity + transition.rate * distance;
  return transition.to + (distance + drive * elapsed) * Math.exp(-transition.rate * elapsed);
}

/**
 * Starts moving toward a new target from wherever the value is at
 * `time`, keeping its current speed.
 *
 * @param settle Approximate seconds until the value is within one
 *   percent of the target. Zero, negative or not a number: it arrives at
 *   once.
 */
export function retarget(
  transition: Transition,
  to: number,
  time: number,
  settle: number,
): Transition {
  const rate = settle > 0 && Number.isFinite(settle) ? SETTLE_FACTOR / settle : 0;
  return {
    from: valueAt(transition, time),
    velocity: rate > 0 ? velocityAt(transition, time) : 0,
    to,
    start: time,
    rate,
  };
}

/**
 * Whether the value has arrived, to well below anything visible: twice
 * the settle time after its start, or at once if it never had to move.
 */
export function settled(transition: Transition, time: number): boolean {
  if (!(transition.rate > 0)) return true;
  if (transition.from === transition.to && transition.velocity === 0) return true;
  return (time - transition.start) * transition.rate > SETTLE_FACTOR * 2;
}

function velocityAt(transition: Transition, time: number): number {
  if (!(transition.rate > 0)) return 0;
  const elapsed = Math.max(0, time - transition.start);
  const distance = transition.from - transition.to;
  const drive = transition.velocity + transition.rate * distance;
  return (
    (drive - transition.rate * (distance + drive * elapsed)) *
    Math.exp(-transition.rate * elapsed)
  );
}
