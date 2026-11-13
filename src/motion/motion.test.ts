import assert from 'node:assert/strict';
import { test } from 'node:test';
import { begin, moving, sample, steer, travels } from './band.js';
import type { BandFrame, BandTarget } from './band.js';
import { noise } from './noise.js';
import { rest, retarget, settled, valueAt } from './spring.js';

const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≉ ${expected}`);
const frame = (): BandFrame => ({ offset: 0, width: 0, value: 0, opacity: 0, phase: 0 });
const idle: BandTarget = { offset: 4, width: 6, value: 1, opacity: 1, motion: undefined };

test('a value at rest stays where it is', () => {
  assert.equal(valueAt(rest(3), 0), 3);
  assert.equal(valueAt(rest(3), 100), 3);
});

test('a transition is within one percent of its target after the settle time', () => {
  const moving = retarget(rest(0), 10, 2, 0.5);
  assert.equal(valueAt(moving, 2), 0);
  near(valueAt(moving, 2.5), 10, 0.1);
  assert.ok(valueAt(moving, 2.25) > 5);
  near(valueAt(moving, 60), 10, 1e-9);
});

test('a transition from rest never overshoots', () => {
  const moving = retarget(rest(0), 1, 0, 1);
  let previous = 0;
  for (let time = 0; time <= 2; time += 0.01) {
    const value = valueAt(moving, time);
    assert.ok(value >= previous - 1e-12 && value <= 1);
    previous = value;
  }
});

test('retargeting mid-flight keeps position and speed continuous', () => {
  const first = retarget(rest(0), 10, 0, 1);
  const second = retarget(first, -5, 0.2, 1);
  const step = 1e-5;
  near(valueAt(second, 0.2), valueAt(first, 0.2));
  const speedBefore = (valueAt(first, 0.2) - valueAt(first, 0.2 - step)) / step;
  const speedAfter = (valueAt(second, 0.2 + step) - valueAt(second, 0.2)) / step;
  near(speedAfter, speedBefore, 0.01);
  near(valueAt(second, 30), -5, 1e-9);
});

test('a settle time of zero or nonsense arrives at once', () => {
  for (const settle of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(valueAt(retarget(rest(0), 7, 1, settle), 1), 7);
  }
});

test('a transition reports when it has arrived', () => {
  assert.equal(settled(rest(3), 0), true);
  const moving = retarget(rest(0), 10, 1, 0.5);
  assert.equal(settled(moving, 1.2), false);
  assert.equal(settled(moving, 1.9), false);
  assert.equal(settled(moving, 2.1), true);
  assert.equal(settled(retarget(rest(4), 4, 1, 0.5), 1), true);
  assert.equal(settled(retarget(rest(0), 7, 1, 0), 1), true);
});

test('a band is moving while it travels, flickers, breathes or is in transition', () => {
  assert.equal(moving(begin(idle), true, 0), false);
  assert.equal(moving(begin({ ...idle, motion: { spin: 10 } }), true, 0), true);
  assert.equal(moving(begin({ ...idle, motion: { spin: 10 } }), false, 0), false);
  assert.equal(moving(begin({ ...idle, motion: { flicker: { seed: 1, rate: 1, depth: 1 } } }), true, 0), true);
  assert.equal(moving(begin({ ...idle, motion: { breathe: { period: 1, amount: 1 } } }), true, 0), true);
  const steered = steer(begin(idle), { ...idle, width: 9 }, 2, 0.5);
  assert.equal(moving(steered, true, 2.1), true);
  assert.equal(moving(steered, true, 4), false);
});

test('noise is repeatable, bounded, smooth and differs by seed', () => {
  assert.equal(noise(3, 1.25), noise(3, 1.25));
  let differs = 0;
  for (let x = -5; x < 5; x += 0.013) {
    const value = noise(9, x);
    assert.ok(value >= 0 && value <= 1);
    assert.ok(Math.abs(noise(9, x + 0.001) - value) < 0.01);
    if (Math.abs(noise(10, x) - value) > 0.05) differs++;
  }
  assert.ok(differs > 300);
  assert.equal(noise(1, Number.NaN), 0);
});

test('a band at rest samples its target', () => {
  assert.deepEqual(sample(begin(idle), 100, true, 5, frame()), {
    offset: 4,
    width: 6,
    value: 1,
    opacity: 1,
    phase: 0,
  });
});

test('drift is pixels per second; spin is laps of the band and closed tracks only', () => {
  const state = begin({ ...idle, motion: { drift: 10, spin: 90 } });
  near(sample(state, 200, true, 2, frame()).phase, 20 + 0.5 * 200);
  near(sample(state, 200, false, 2, frame()).phase, 20);
  assert.equal(travels(state, false), true);
  assert.equal(travels(begin({ ...idle, motion: { spin: 90 } }), false), false);
  assert.equal(travels(begin({ ...idle, motion: { spin: 90 } }), true), true);
  assert.equal(travels(begin(idle), true), false);
});

test('a change of speed does not make the pattern jump', () => {
  const slow = begin({ ...idle, motion: { spin: 36 } });
  const fast = steer(slow, { ...idle, motion: { spin: 360 } }, 5, 0.3);
  near(sample(fast, 100, true, 5, frame()).phase, sample(slow, 100, true, 5, frame()).phase);
  near(sample(fast, 100, true, 6, frame()).phase, 50 + 100);
  const stopped = steer(fast, idle, 6, 0.3);
  near(sample(stopped, 100, true, 60, frame()).phase, 150);
});

test('steering glides numeric parameters and can be interrupted', () => {
  const opening = steer(begin({ ...idle, value: 0 }), idle, 0, 1);
  const half = sample(opening, 100, true, 0.2, frame()).value;
  assert.ok(half > 0 && half < 1);
  const closing = steer(opening, { ...idle, value: 0 }, 0.2, 1);
  near(sample(closing, 100, true, 0.2, frame()).value, half);
  // It was still opening, so it keeps rising for a moment before it turns.
  assert.ok(sample(closing, 100, true, 0.21, frame()).value > half);
  near(sample(closing, 100, true, 30, frame()).value, 0, 1e-9);
});

test('flicker lowers opacity by at most its depth and is repeatable', () => {
  const state = begin({ ...idle, motion: { flicker: { seed: 4, rate: 5, depth: 0.6 } } });
  let lowest = 1;
  for (let time = 0; time < 10; time += 0.01) {
    const { opacity } = sample(state, 100, true, time, frame());
    assert.ok(opacity >= 0.4 - 1e-12 && opacity <= 1);
    lowest = Math.min(lowest, opacity);
  }
  assert.ok(lowest < 0.6);
  assert.equal(
    sample(state, 100, true, 3.3, frame()).opacity,
    sample(state, 100, true, 3.3, frame()).opacity,
  );
});

test('breathing swings the offset around its resting value', () => {
  const state = begin({ ...idle, motion: { breathe: { period: 4, amount: 2 } } });
  near(sample(state, 100, true, 0, frame()).offset, 4);
  near(sample(state, 100, true, 1, frame()).offset, 6);
  near(sample(state, 100, true, 3, frame()).offset, 2);
});

test('samples stay in range whatever the targets ask for', () => {
  const wild = begin({ offset: 0, width: -5, value: 9, opacity: -2, motion: undefined });
  const out = sample(wild, 100, true, 1, frame());
  assert.deepEqual([out.width, out.value, out.opacity], [0, 1, 0]);
});
