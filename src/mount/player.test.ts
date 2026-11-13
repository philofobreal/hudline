import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlayer, renderToString } from './player.js';
import type { HudSpec } from './spec.js';

const ring: HudSpec = {
  shape: { kind: 'ring' },
  bands: [
    { width: 2 },
    { id: 'segments', offset: 6, width: 8, pattern: { kind: 'segments', count: 4, gap: 2 } },
    { offset: 20, width: 4, pattern: { kind: 'blocks', seed: 3, min: 5, max: 20, gap: 2 } },
  ],
};
const near = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≉ ${expected}`);
const still = (spec: HudSpec, width: number, height: number) =>
  createPlayer(spec, width, height, true).scene(0).layers;

test('each band is drawn on its own centreline', () => {
  const layers = still(ring, 100, 100);
  assert.equal(layers.length, 3);
  [49, 40, 28].forEach((radius, i) => near((layers[i]?.track.length as number) / (2 * Math.PI), radius));
});

test('bands that do not fit a small host are left out, the rest stay', () => {
  // Radius 28: the third band would leave no room inside itself.
  assert.equal(still(ring, 56, 56).length, 2);
  // Radius 20: the second band needs 6 + 2 × 8 = 22.
  assert.equal(still(ring, 40, 40).length, 1);
  assert.equal(still(ring, 6, 6).length, 0);
});

test('the same spec, size and times always give the same markup', () => {
  const spec: HudSpec = {
    ...ring,
    bands: ring.bands.map((band) => ({
      ...band,
      motion: { spin: 30, flicker: { seed: 2, rate: 3, depth: 0.5 } },
    })),
  };
  const play = () => {
    const player = createPlayer(spec, 120, 120);
    player.set('hover', 0.4);
    return [0, 0.5, 1.7].map((time) => player.markup(time));
  };
  assert.deepEqual(play(), play());
  assert.notEqual(play()[0], play()[2]);
  assert.equal(renderToString(ring, 120, 120), renderToString(ring, 120, 120));
});

test('the host seed changes seeded patterns only', () => {
  const a = still(ring, 100, 100);
  const b = still({ ...ring, seed: 5 }, 100, 100);
  assert.deepEqual(a[1]?.dashes, b[1]?.dashes);
  assert.notDeepEqual(a[2]?.dashes, b[2]?.dashes);
});

test('value shows a share of the band without touching its pattern', () => {
  const spec: HudSpec = {
    shape: { kind: 'arc', start: 0, sweep: 180 },
    bands: [{ width: 2, value: 0.25, opacity: 7, pattern: { kind: 'dashes', dash: 4, gap: 4 } }],
  };
  const [layer] = still(spec, 100, 100);
  assert.ok(layer !== undefined);
  near(layer.track.length, layer.patternLength * 0.25);
  assert.equal(layer.dashes.intervals.at(-1), layer.patternLength);
  assert.equal(layer.opacity, 1);
});

test('spin turns the pattern by laps of each band', () => {
  const spec: HudSpec = {
    shape: { kind: 'ring' },
    bands: [{ width: 4, pattern: { kind: 'segments', count: 4, gap: 2 }, motion: { spin: 90 } }],
  };
  const player = createPlayer(spec, 100, 100);
  const [layer] = player.scene(2).layers;
  assert.ok(layer !== undefined);
  near(layer.phase, layer.patternLength / 2);
});

test('a travelling pattern on an open band joins end to start', () => {
  const arc = (drift: number): HudSpec => ({
    shape: { kind: 'arc', start: 0, sweep: 180 },
    bands: [{ width: 2, pattern: { kind: 'segments', count: 3, gap: 4 }, motion: { drift } }],
  });
  // At rest the row starts and ends on a segment; travelling, it has a
  // gap at the seam like a closed band.
  assert.equal(still(arc(0), 100, 100)[0]?.dashes.intervals[0], 0);
  assert.equal(still(arc(10), 100, 100)[0]?.dashes.intervals[0], 2);
});

test('an enter state draws bands on from it', () => {
  const spec: HudSpec = {
    shape: { kind: 'ring' },
    bands: [{ id: 'line', width: 2 }],
    states: { enter: { bands: { line: { value: 0 } }, settle: 1 } },
  };
  const player = createPlayer(spec, 100, 100);
  assert.equal(player.scene(0).layers.length, 0);
  const lengths = [0.1, 0.3, 0.6, 5].map((time) => player.scene(time).layers[0]?.track.length ?? 0);
  for (let i = 1; i < lengths.length; i++) assert.ok((lengths[i] as number) > (lengths[i - 1] as number));
  near(lengths[3] as number, 2 * Math.PI * 49, 1e-6);
  assert.equal(still(spec, 100, 100).length, 1);
});

test('states glide, can be interrupted, and unknown names mean idle', () => {
  const spec: HudSpec = {
    ...ring,
    states: { hover: { bands: { segments: { width: 12 } }, settle: 0.5 } },
    settle: 0.5,
  };
  const player = createPlayer(spec, 100, 100);
  const width = (time: number) => player.scene(time).layers[1]?.width as number;
  assert.equal(width(1), 8);
  player.set('hover', 1);
  const mid = width(1.1);
  assert.ok(mid > 8 && mid < 12);
  player.set('nonsense', 1.1);
  near(width(1.1), mid);
  near(width(9), 8, 1e-6);
  player.set('hover', 9);
  near(width(19), 12, 1e-6);
  player.set('idle', 19);
  near(width(29), 8, 1e-6);
});

test('a state that asks for more width than fits narrows the band instead of hiding it', () => {
  const spec: HudSpec = {
    shape: { kind: 'ring', inset: 2 },
    bands: [
      { id: 'outline', width: 1 },
      { id: 'segments', offset: 5, width: 8, pattern: { kind: 'segments', count: 12, gap: 4 } },
    ],
    states: { hover: { bands: { segments: { offset: 4, width: 11 } } } },
  };
  // Radius 22: from offset 4 a band holds while it is narrower than 9.
  const small = createPlayer(spec, 48, 48, true);
  assert.equal(small.scene(0).layers.length, 2);
  small.set('hover', 0);
  const [, segments] = small.scene(10).layers;
  assert.ok(segments !== undefined, 'the band must stay');
  assert.ok(segments.width > 8.5 && segments.width < 9, `width ${segments.width}`);

  // With room, the state gets what it asked for.
  const large = createPlayer(spec, 200, 200, true);
  large.set('hover', 0);
  assert.equal(large.scene(10).layers[1]?.width, 11);
});

test('a band that does not fit in idle stays out whatever a state asks', () => {
  const spec: HudSpec = {
    shape: { kind: 'ring' },
    bands: [{ id: 'thick', offset: 10, width: 12 }],
    states: { hover: { bands: { thick: { width: 2 } } } },
  };
  const player = createPlayer(spec, 40, 40, true);
  assert.equal(player.scene(0).layers.length, 0);
  player.set('hover', 0);
  assert.equal(player.scene(10).layers.length, 0);
});

test('resizing keeps motion going and re-fits the bands', () => {
  const spec: HudSpec = {
    shape: { kind: 'ring' },
    bands: [{ width: 4, pattern: { kind: 'segments', count: 4, gap: 2 }, motion: { spin: 90 } }],
  };
  const player = createPlayer(spec, 100, 100);
  player.scene(1);
  player.resize(200, 200);
  const [layer] = player.scene(1).layers;
  assert.ok(layer !== undefined);
  near(layer.patternLength, 2 * Math.PI * 98);
  near(layer.phase, layer.patternLength / 4);
});

test('nothing drawable gives an empty document instead of an error', () => {
  const empty = /^<svg [^>]*><\/svg>$/;
  assert.match(renderToString(ring, 0, 0), empty);
  assert.match(renderToString(ring, Number.NaN, 50), empty);
  assert.match(renderToString({ shape: { kind: 'frame', inset: 60 }, bands: [{ width: 1 }] }, 100, 100), empty);
  assert.match(renderToString({ shape: { kind: 'ring' }, bands: [{ width: -1 }] }, 100, 100), empty);
});
