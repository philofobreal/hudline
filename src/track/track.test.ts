import assert from 'node:assert/strict';
import { test } from 'node:test';
import { offset, portion, resolve } from './track.js';

const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≉ ${expected}`);

test('a ring fills the smaller side of the host and is closed', () => {
  const ring = resolve({ kind: 'ring' }, 200, 100);
  assert.equal(ring.closed, true);
  near(ring.length, 2 * Math.PI * 50);
});

test('inset and fixed radius set the ring size', () => {
  near(resolve({ kind: 'ring', inset: 10 }, 100, 100).length, 2 * Math.PI * 40);
  near(resolve({ kind: 'ring', radius: 7 }, 100, 100).length, 2 * Math.PI * 7);
});

test('a ring path starts at the top and travels clockwise in two half turns', () => {
  const ring = resolve({ kind: 'ring' }, 100, 100);
  assert.equal(ring.path, 'M50 0A50 50 0 0 1 50 100A50 50 0 0 1 50 0');
});

test('an arc is open and as long as its sweep', () => {
  const arc = resolve({ kind: 'arc', start: -135, sweep: 270 }, 100, 100);
  assert.equal(arc.closed, false);
  near(arc.length, 50 * ((270 * Math.PI) / 180));
});

test('a quarter arc from the top ends on the right', () => {
  const arc = resolve({ kind: 'arc', start: 0, sweep: 90 }, 100, 100);
  assert.equal(arc.path, 'M50 0A50 50 0 0 1 100 50');
});

test('a counter-clockwise arc sweeps the other way', () => {
  const arc = resolve({ kind: 'arc', start: 0, sweep: -90 }, 100, 100);
  assert.equal(arc.path, 'M50 0A50 50 0 0 0 0 50');
});

test('offset moves toward the centre for both directions of travel', () => {
  const ring = resolve({ kind: 'ring' }, 100, 100);
  near(offset(ring, 10).length, 2 * Math.PI * 40);
  near(offset(ring, -10).length, 2 * Math.PI * 60);
  const reversed = resolve({ kind: 'arc', start: 0, sweep: -180 }, 100, 100);
  near(offset(reversed, 10).length, Math.PI * 40);
});

test('an offset that collapses the shape gives an empty track', () => {
  const ring = resolve({ kind: 'ring' }, 100, 100);
  assert.equal(offset(ring, 50).length, 0);
  assert.equal(offset(ring, 80).path, '');
});

test('degenerate input gives an empty track instead of an error', () => {
  for (const [width, height] of [
    [0, 100],
    [100, -1],
    [Number.NaN, 100],
    [Number.POSITIVE_INFINITY, 100],
  ] as const) {
    assert.equal(resolve({ kind: 'ring' }, width, height).length, 0);
  }
  assert.equal(resolve({ kind: 'ring', inset: 60 }, 100, 100).length, 0);
  assert.equal(resolve({ kind: 'arc', start: 0, sweep: 0 }, 100, 100).length, 0);
  assert.equal(offset({ closed: true, length: 5, path: 'M0 0', anchors: {} }, 1).length, 0);
});

test('a sweep beyond a full turn is clamped', () => {
  near(resolve({ kind: 'arc', start: 0, sweep: 900 }, 100, 100).length, 2 * Math.PI * 50);
});

test('a portion is the first share of a track and is open', () => {
  const ring = resolve({ kind: 'ring' }, 100, 100);
  const quarter = portion(ring, 0.25);
  assert.equal(quarter.closed, false);
  near(quarter.length, ring.length / 4);
  assert.equal(quarter.path, 'M50 0A50 50 0 0 1 100 50');
  near(portion(ring, 0.75).length, ring.length * 0.75);
  // Three quarters of a turn is drawn as two equal arcs of 135°.
  assert.equal(portion(ring, 0.75).path, 'M50 0A50 50 0 0 1 85.355 85.355A50 50 0 0 1 0 50');
});

test('a portion of everything is the track, of nothing an empty track', () => {
  const ring = resolve({ kind: 'ring' }, 100, 100);
  assert.equal(portion(ring, 1), ring);
  assert.equal(portion(ring, 7), ring);
  assert.equal(portion(ring, Number.NaN), ring);
  assert.equal(portion(ring, 0).length, 0);
  assert.equal(portion(ring, -1).path, '');
  assert.equal(portion(offset(portion(ring, 0.5), 10), 0.5).closed, false);
});

test('frames resolve to an empty track until they are implemented', () => {
  assert.equal(resolve({ kind: 'frame' }, 100, 100).length, 0);
});
