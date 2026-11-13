import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlayer } from '../mount/index.js';
import type { HudSpec } from '../mount/index.js';
import { catalog, presets } from './index.js';

const entries: readonly (readonly [string, HudSpec])[] = Object.entries(catalog);

test('the catalogue covers every entry of docs/CATALOG.md', () => {
  assert.deepEqual(
    entries.map(([name]) => name),
    ['R1', 'R2', 'R3', 'R4', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6'],
  );
});

test('every entry has bands with positive widths', () => {
  for (const [name, spec] of entries) {
    assert.ok(spec.bands.length > 0, name);
    for (const band of spec.bands) assert.ok(band.width > 0, name);
  }
});

test('band ids are unique within an entry and states refer to existing ids', () => {
  for (const [name, spec] of entries) {
    const ids = spec.bands.flatMap((band) => (band.id === undefined ? [] : [band.id]));
    assert.equal(new Set(ids).size, ids.length, name);
    for (const state of Object.values(spec.states ?? {})) {
      for (const id of Object.keys(state.bands)) assert.ok(ids.includes(id), `${name}: ${id}`);
    }
  }
});

test('spans refer to corners or to steps declared on the same frame', () => {
  for (const [name, spec] of entries) {
    const anchors = new Set(['tl', 'tr', 'br', 'bl']);
    if (spec.shape.kind === 'frame') {
      for (const ops of Object.values(spec.shape.edges ?? {})) {
        for (const op of ops) if (op.id !== undefined) anchors.add(op.id);
      }
    }
    for (const band of spec.bands) {
      if (band.pattern?.kind !== 'spans') continue;
      assert.equal(spec.shape.kind, 'frame', name);
      for (const span of band.pattern.spans) assert.ok(anchors.has(span.anchor), name);
    }
  }
});

test('hover and alert change the first band of every entry', () => {
  for (const [name, spec] of entries) {
    const first = spec.bands[0]?.id;
    assert.ok(first !== undefined, `${name}: the first band needs an id`);
    for (const state of ['hover', 'alert']) {
      assert.ok(spec.states?.[state]?.bands[first] !== undefined, `${name}: ${state} must change "${first}"`);
    }
  }
});

test('every state shows at every size at which anything is drawn', () => {
  // From comfortable down to smaller than anyone should use.
  const sizes = [
    [300, 150],
    [200, 200],
    [96, 44],
    [60, 30],
    [48, 48],
    [32, 32],
    [20, 20],
  ] as const;
  const moments = [3.1, 3.37, 4.9];
  for (const [name, spec] of entries) {
    for (const [width, height] of sizes) {
      const idle = createPlayer(spec, width, height, true);
      if (idle.scene(0).layers.length === 0) continue;
      for (const state of ['hover', 'alert']) {
        const changed = createPlayer(spec, width, height, true);
        changed.set(state, 0);
        const differs = moments.some((time) => idle.markup(time) !== changed.markup(time));
        assert.ok(differs, `${name} at ${width}×${height}: ${state} changes nothing`);
      }
    }
  }
});

test('every catalogue entry is offered as a preset under a readable name', () => {
  const offered = Object.values(presets) as readonly HudSpec[];
  assert.equal(offered.length, entries.length);
  for (const [name, spec] of entries) assert.ok(offered.includes(spec), name);
  for (const name of Object.keys(presets)) assert.match(name, /^(ring|arc|frame)-[a-z]+$/);
});
