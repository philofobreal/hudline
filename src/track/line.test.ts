import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LineShape } from './shape.js';
import { clearance, holds, offset, portion, resolve } from './track.js';

const near = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≉ ${expected}`);
const line = (extra: Omit<LineShape, 'kind'> = {}): LineShape => ({ kind: 'line', ...extra });

test('a line runs along the bottom by default, left to right, and is open', () => {
  const rule = resolve(line(), 200, 100);
  assert.equal(rule.closed, false);
  near(rule.length, 200);
  assert.equal(rule.path, 'M0 100L200 100');
  assert.deepEqual(rule.anchors, { start: { start: 0, end: 0 }, end: { start: 200, end: 200 } });
});

test('each side is travelled in reading direction', () => {
  assert.equal(resolve(line({ edge: 'top' }), 200, 100).path, 'M0 0L200 0');
  assert.equal(resolve(line({ edge: 'left' }), 200, 100).path, 'M0 0L0 100');
  assert.equal(resolve(line({ edge: 'right' }), 200, 100).path, 'M200 0L200 100');
});

test('inset moves the line toward the middle and pad shortens it at both ends', () => {
  assert.equal(resolve(line({ inset: 6, pad: 10 }), 200, 100).path, 'M10 94L190 94');
  assert.equal(resolve(line({ edge: 'top', inset: 6 }), 200, 100).path, 'M0 6L200 6');
  assert.equal(resolve(line({ edge: 'left', inset: 6, pad: 5 }), 200, 100).path, 'M6 5L6 95');
  assert.equal(resolve(line({ edge: 'right', inset: 6 }), 200, 100).path, 'M194 0L194 100');
});

test('a positive step depth points toward the middle of the box on every side', () => {
  const step = { kind: 'step', id: 'jog', from: { from: 'start', offset: 20 }, to: { from: 'start', offset: 60 }, depth: 8, ramp: 'square' } as const;
  assert.equal(resolve(line({ steps: [step] }), 200, 100).path, 'M0 100L20 100L20 92L60 92L60 100L200 100');
  assert.equal(resolve(line({ edge: 'top', steps: [step] }), 200, 100).path, 'M0 0L20 0L20 8L60 8L60 0L200 0');
  assert.equal(resolve(line({ edge: 'left', steps: [step] }), 200, 100).path, 'M0 0L0 20L8 20L8 60L0 60L0 100');
  assert.equal(resolve(line({ edge: 'right', steps: [step] }), 200, 100).path, 'M200 0L200 20L192 20L192 60L200 60L200 100');
});

test('a step that runs to the end makes a line that changes level and stays there', () => {
  const rise = { kind: 'step', id: 'high', from: { fraction: 0.5 }, to: { from: 'end', offset: 0 }, depth: 10 } as const;
  const callout = resolve(line({ steps: [rise] }), 200, 100);
  // Up a 45° ramp at the middle and along to the end, with no ramp back down.
  assert.equal(callout.path, 'M0 100L100 100L110 90L200 90');
  assert.deepEqual(callout.anchors['high'], { start: 100 + 10 * Math.SQRT2, end: 190 + 10 * Math.SQRT2 });
  assert.deepEqual(callout.anchors['end'], { start: callout.length, end: callout.length });
  const fall = { ...rise, from: { from: 'start', offset: 0 }, to: { fraction: 0.5 } } as const;
  assert.equal(resolve(line({ steps: [fall] }), 200, 100).path, 'M0 90L90 90L100 100L200 100');
});

test('steps keep to the rules of frame edges, hysteresis included', () => {
  const step = { kind: 'step', id: 's', from: { from: 'end', offset: 80 }, to: { from: 'end', offset: 20 }, depth: 4 } as const;
  const has = (track: { anchors: Readonly<Record<string, unknown>> }) => track.anchors['s'] !== undefined;
  const shape = line({ steps: [step] });
  assert.equal(has(resolve(shape, 80, 40)), true);
  const without = resolve(shape, 79, 40);
  assert.equal(has(without), false);
  assert.equal(has(resolve(shape, 82, 40, without)), false);
  assert.equal(has(resolve(shape, 84, 40, without)), true);
  // A step that sits flush with an end can come back too.
  const flush = line({ steps: [{ ...step, from: { fraction: 0.4 }, to: { from: 'end', offset: 0 }, depth: 10 }] });
  // A box 18 high leaves a depth of 9 at most.
  const low = resolve(flush, 200, 18);
  assert.equal(has(low), false);
  assert.equal(has(resolve(flush, 200, 40, low)), true);
  // Too deep for the box.
  near(resolve(line({ steps: [{ ...step, depth: 30 }] }), 200, 40).length, 200);
});

test('bands lie toward the middle of the box, on either side of travel', () => {
  assert.equal(offset(resolve(line(), 200, 100), 5).path, 'M0 95L200 95');
  assert.equal(offset(resolve(line({ edge: 'top' }), 200, 100), 5).path, 'M0 5L200 5');
  assert.equal(offset(resolve(line({ edge: 'left' }), 200, 100), 5).path, 'M5 0L5 100');
  assert.equal(offset(resolve(line({ edge: 'right' }), 200, 100), -5).path, 'M205 0L205 100');
});

test('a stepped line keeps its ends and its anchors under an offset', () => {
  const step = { kind: 'step', id: 'jog', from: { from: 'start', offset: 20 }, to: { from: 'start', offset: 60 }, depth: 8 } as const;
  const inner = offset(resolve(line({ steps: [step] }), 200, 100), 3);
  assert.match(inner.path, /^M0 97L/);
  assert.match(inner.path, /L200 97$/);
  near(inner.anchors['start']?.start ?? -1, 0);
  near(inner.anchors['end']?.end ?? -1, inner.length);
  const flat = inner.anchors['jog'];
  assert.ok(flat !== undefined);
  // The flat part lies between two inward corners and grows with an inward offset.
  near(flat.end - flat.start, 24 + 3 * 2 * Math.tan(Math.PI / 8));
});

test('a line holds any band, and asks for room on its own side only', () => {
  const rule = resolve(line({ inset: 4 }), 200, 100);
  assert.equal(holds(rule, 0, 30), true);
  assert.deepEqual(clearance(rule, 3), { top: 0, right: 0, bottom: 7, left: 0 });
  const stepped = resolve(
    line({ edge: 'top', steps: [{ kind: 'step', from: { fraction: 0.2 }, to: { fraction: 0.8 }, depth: 6 }] }),
    200,
    100,
  );
  assert.deepEqual(clearance(stepped, 2), { top: 8, right: 0, bottom: 0, left: 0 });
});

test('a portion of a line draws it on from its start', () => {
  assert.equal(portion(resolve(line(), 200, 100), 0.25).path, 'M0 100L50 100');
});

test('a line that does not fit is an empty track', () => {
  assert.equal(resolve(line({ pad: 100 }), 200, 100).length, 0);
  assert.equal(resolve(line({ pad: 150 }), 200, 100).path, '');
  assert.equal(resolve(line(), 0, 100).length, 0);
});
