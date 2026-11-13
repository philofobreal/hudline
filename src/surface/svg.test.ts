import assert from 'node:assert/strict';
import { test } from 'node:test';
import { svgMarkup } from './svg.js';
import type { Layer } from './svg.js';

const track = { closed: true, length: 100, path: 'M0 0A1 1 0 0 1 2 0', anchors: {} };
const layer = (intervals: readonly number[], extra: Partial<Layer> = {}): Layer => ({
  band: 0,
  track,
  width: 4,
  dashes: { intervals, cap: 'butt' },
  patternLength: 100,
  phase: 0,
  opacity: 1,
  ...extra,
});
const paths = (markup: string) => markup.match(/<path [^>]*\/>/g) ?? [];

test('an empty scene is a valid empty document that inherits its colour', () => {
  assert.equal(
    svgMarkup({ width: 40, height: 30, layers: [] }),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 30" width="40" height="30" fill="none" stroke="currentColor"></svg>',
  );
});

test('a solid band needs no dash array', () => {
  assert.deepEqual(paths(svgMarkup({ width: 10, height: 10, layers: [layer([0, 100])] })), [
    '<path d="M0 0A1 1 0 0 1 2 0" stroke-width="4"/>',
  ]);
});

test('intervals become dashes and gaps that add up to the track length', () => {
  const [path] = paths(svgMarkup({ width: 10, height: 10, layers: [layer([10, 30, 50, 60])] }));
  assert.match(path as string, /stroke-dasharray="20 20 10 50" stroke-dashoffset="-10"/);
});

test('an interval starting at zero needs no offset', () => {
  const [path] = paths(svgMarkup({ width: 10, height: 10, layers: [layer([0, 5, 95, 100])] }));
  assert.match(path as string, /stroke-dasharray="5 90 5 0"\/>/);
});

test('travel moves the pattern forward and wraps at the pattern length', () => {
  const at = (phase: number) =>
    paths(svgMarkup({ width: 10, height: 10, layers: [layer([10, 30, 50, 60], { phase })] }))[0];
  assert.match(at(5) as string, /stroke-dashoffset="-15"/);
  assert.equal(at(105), at(5));
  assert.match(at(-10) as string, /stroke-dasharray="20 20 10 50" stroke-dashoffset="-100"/);
});

test('a shown share shorter than the pattern keeps the full dash array', () => {
  const half = { ...track, closed: false, length: 50 };
  const [path] = paths(
    svgMarkup({ width: 10, height: 10, layers: [layer([10, 30, 50, 60], { track: half })] }),
  );
  assert.match(path as string, /stroke-dasharray="20 20 10 50"/);
  const [solid] = paths(svgMarkup({ width: 10, height: 10, layers: [layer([0, 100], { track: half })] }));
  assert.doesNotMatch(solid as string, /dasharray/);
});

test('dots use round caps and opacity is written only when it matters', () => {
  const [path] = paths(
    svgMarkup({
      width: 10,
      height: 10,
      layers: [layer([0, 0, 50, 50], { dashes: { intervals: [0, 0, 50, 50], cap: 'round' }, opacity: 0.5 })],
    }),
  );
  assert.match(path as string, /stroke-linecap="round" stroke-dasharray="0 50 0 50" opacity="0.5"/);
});

test('layers with nothing to show are left out', () => {
  const layers = [
    layer([]),
    layer([0, 100], { width: 0 }),
    layer([0, 100], { opacity: 0 }),
    layer([0, 100], { track: { ...track, length: 0, path: '' } }),
  ];
  assert.equal(paths(svgMarkup({ width: 10, height: 10, layers })).length, 0);
});

test('a size that is not a number becomes zero instead of breaking the markup', () => {
  assert.match(svgMarkup({ width: Number.NaN, height: -4, layers: [] }), /viewBox="0 0 0 0"/);
});
