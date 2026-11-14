import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToString } from '../mount/index.js';
import type { BandSpec, HudSpec } from '../mount/index.js';
import { presets } from './index.js';

/*
 * The examples of docs/CUSTOMIZING.md, compiled and run. If one of them
 * stops type-checking or stops drawing, the guide is wrong.
 */

const paths = (spec: HudSpec, width: number, height: number) =>
  (renderToString(spec, width, height).match(/<path/g) ?? []).length;

test('a spec written from scratch', () => {
  const badge: HudSpec = {
    shape: {
      kind: 'frame',
      inset: 1,
      corners: { tl: { kind: 'chamfer', size: 8 }, br: { kind: 'fillet', radius: 8 } },
      edges: {
        bottom: [
          { kind: 'step', id: 'lip', from: { from: 'start', offset: 16 }, to: { from: 'start', offset: 64 }, depth: 4 },
        ],
      },
    },
    bands: [
      { id: 'outline', width: 1 },
      { id: 'lip', offset: -4, width: 3, pattern: { kind: 'spans', spans: [{ anchor: 'lip' }] } },
      {
        id: 'scan',
        offset: 4,
        width: 2,
        opacity: 0.5,
        pattern: { kind: 'dashes', dash: 6, gap: 10 },
        motion: { drift: 30 },
      },
    ],
    states: {
      hover: { bands: { outline: { width: 2 }, scan: { opacity: 1, motion: { drift: 90 } } }, settle: 0.2 },
    },
  };
  assert.equal(paths(badge, 200, 70), 3);
});

test('a preset with its shape changed', () => {
  const base = presets['frame-tabbed'];
  const widerTab: HudSpec = {
    ...base,
    // The preset knows its shape is a frame, so it can be spread into one.
    shape: {
      ...base.shape,
      edges: {
        top: [
          { kind: 'step', id: 'tab', from: { from: 'start', offset: 20 }, to: { from: 'start', offset: 140 }, depth: -8 },
        ],
      },
    },
    settle: 0.15,
  };
  assert.equal(paths(widerTab, 240, 100), 2);
  // The tab's flat part now runs from about 49 to 153 along the top.
  assert.match(renderToString(widerTab, 240, 100), /L49\.207 1\.5L152\.793 1\.5/);
});

test('a preset with one band changed by id', () => {
  const retune = (spec: HudSpec, id: string, change: Partial<BandSpec>): HudSpec => ({
    ...spec,
    bands: spec.bands.map((band) => (band.id === id ? { ...band, ...change } : band)),
  });
  const slowGear = retune(presets['ring-gear'], 'teeth', {
    pattern: { kind: 'segments', count: 8, gap: 14 },
    motion: { spin: 4 },
  });
  assert.equal(paths(slowGear, 120, 120), 3);
  assert.notEqual(renderToString(slowGear, 120, 120), renderToString(presets['ring-gear'], 120, 120));
});

test('a family of specs from a function of options', () => {
  interface DialOptions {
    rings?: number;
    thickness?: number;
    gap?: number;
    speed?: number;
    seed?: number;
  }
  function dial({ rings = 3, thickness = 5, gap = 4, speed = 15, seed = 1 }: DialOptions = {}): HudSpec {
    const bands: BandSpec[] = [{ id: 'rim', width: 1 }];
    for (let i = 0; i < rings; i++) {
      bands.push({
        id: `ring${i}`,
        offset: 4 + i * (thickness + gap),
        width: thickness,
        pattern: { kind: 'blocks', seed: seed + i, min: 10, max: 50, gap: 5 },
        // Alternate directions; inner rings turn faster.
        motion: { spin: (i % 2 === 0 ? 1 : -1) * speed * (1 + i * 0.5) },
      });
    }
    return {
      shape: { kind: 'ring', inset: 2 },
      bands,
      states: { hover: { bands: { rim: { width: 2 } } } },
    };
  }
  assert.equal(paths(dial(), 160, 160), 4);
  assert.equal(paths(dial({ rings: 4, thickness: 4 }), 160, 160), 5);
  assert.notEqual(renderToString(dial({ seed: 1 }), 160, 160), renderToString(dial({ seed: 2 }), 160, 160));
});

test('a spec read from JSON', () => {
  const fromJson = JSON.parse(`{
    "shape": { "kind": "line", "edge": "top", "inset": 2 },
    "bands": [
      { "id": "rule", "width": 1 },
      { "id": "marks", "offset": 4, "width": 4, "pattern": { "kind": "ticks", "count": 40 } }
    ]
  }`) as HudSpec;
  assert.equal(paths(fromJson, 240, 24), 2);
});

test('a mistake in configuration draws less instead of throwing', () => {
  const careless = JSON.parse(`{
    "shape": { "kind": "ring" },
    "bands": [
      { "width": 2 },
      { "width": "wide" },
      { "offset": 6, "width": 4, "pattern": { "kind": "segments", "count": "many", "gap": 2 } }
    ]
  }`) as HudSpec;
  // The good band is drawn; the two with nonsense in them are not.
  assert.equal(paths(careless, 100, 100), 1);
});
