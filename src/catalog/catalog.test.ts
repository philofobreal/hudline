import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HudSpec } from '../mount/index.js';
import { catalog } from './index.js';

const entries: readonly (readonly [string, HudSpec])[] = Object.entries(catalog);

test('the catalogue covers every expressible entry of docs/CATALOG.md', () => {
  assert.deepEqual(
    entries.map(([name]) => name),
    ['R1', 'R2', 'R3', 'R4', 'F1', 'F2', 'F3', 'F4', 'F5'],
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
