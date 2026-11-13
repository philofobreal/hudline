import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layout, renderToString } from './render.js';
import type { HudSpec } from './spec.js';

const ring: HudSpec = {
  shape: { kind: 'ring' },
  bands: [
    { width: 2 },
    { offset: 6, width: 8, pattern: { kind: 'segments', count: 4, gap: 2 } },
    { offset: 20, width: 4, pattern: { kind: 'blocks', seed: 3, min: 5, max: 20, gap: 2 } },
  ],
};

test('each band is drawn on its own centreline', () => {
  const { layers } = layout(ring, 100, 100);
  assert.equal(layers.length, 3);
  const radii = layers.map((layer) => layer.track.length / (2 * Math.PI));
  [49, 40, 28].forEach((expected, i) => assert.ok(Math.abs((radii[i] as number) - expected) < 1e-9));
});

test('bands that do not fit a small host are left out, the rest stay', () => {
  // Radius 28: the third band would leave no room inside itself.
  assert.equal(layout(ring, 56, 56).layers.length, 2);
  // Radius 20: the second band needs 6 + 2 × 8 = 22.
  assert.equal(layout(ring, 40, 40).layers.length, 1);
  assert.equal(layout(ring, 6, 6).layers.length, 0);
});

test('the same spec and size always give the same markup', () => {
  assert.equal(renderToString(ring, 120, 120), renderToString(ring, 120, 120));
});

test('the host seed changes seeded patterns only', () => {
  const a = layout(ring, 100, 100).layers;
  const b = layout({ ...ring, seed: 5 }, 100, 100).layers;
  assert.deepEqual(a[1]?.dashes, b[1]?.dashes);
  assert.notDeepEqual(a[2]?.dashes, b[2]?.dashes);
});

test('value reveals a share of the band and opacity is clamped', () => {
  const spec: HudSpec = {
    shape: { kind: 'arc', start: 0, sweep: 180 },
    bands: [{ width: 2, value: 0.25, opacity: 7 }],
  };
  const [layer] = layout(spec, 100, 100).layers;
  assert.ok(layer !== undefined);
  const length = layer.track.length;
  assert.deepEqual(layer.dashes.intervals, [0, length * 0.25]);
  assert.equal(layer.opacity, 1);
});

test('nothing drawable gives an empty document instead of an error', () => {
  const empty = /^<svg [^>]*><\/svg>$/;
  assert.match(renderToString(ring, 0, 0), empty);
  assert.match(renderToString(ring, Number.NaN, 50), empty);
  assert.match(renderToString({ shape: { kind: 'frame' }, bands: [{ width: 1 }] }, 100, 100), empty);
  assert.match(renderToString({ shape: { kind: 'ring' }, bands: [{ width: -1 }] }, 100, 100), empty);
});
