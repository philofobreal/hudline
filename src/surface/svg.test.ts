import assert from 'node:assert/strict';
import { test } from 'node:test';
import { partCount, svgMarkup } from './svg.js';
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
  hatch: undefined,
  levels: undefined,
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

test('a hatched band is painted with a pattern of turned, shifted stripes', () => {
  const hatch = { angle: 45, stripe: 2, gap: 4, shift: 7 };
  const markup = svgMarkup({ width: 10, height: 10, layers: [layer([0, 100], { hatch }), layer([0, 50], { hatch })] });
  const patterns = markup.match(/<pattern [^>]*>/g) ?? [];
  // Two bands that look the same share one pattern.
  assert.equal(patterns.length, 1);
  assert.match(patterns[0] as string, /patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate\(45\) translate\(1 0\)"/);
  assert.match(markup, /<rect width="2" height="6" fill="currentColor" stroke="none"\/>/);
  const id = /id="([^"]+)"/.exec(patterns[0] as string)?.[1];
  assert.equal(paths(markup).filter((path) => path.includes(`stroke="url(#${id})"`)).length, 2);
});

test('a band drawn part by part gets one path per part, each with its own brightness', () => {
  const dashes = { intervals: [10, 30, 50, 60], cap: 'butt' } as const;
  assert.equal(partCount(dashes, 100), 2);
  const drawn = paths(
    svgMarkup({ width: 10, height: 10, layers: [layer(dashes.intervals, { levels: [1, 0.5], phase: 5 })] }),
  );
  assert.equal(drawn.length, 2);
  assert.match(drawn[0] as string, /stroke-dasharray="20 80" stroke-dashoffset="-15"\/>/);
  assert.match(drawn[1] as string, /stroke-dasharray="10 90" stroke-dashoffset="-55" opacity="0.5"\/>/);
});

test('an interval that crosses the seam is one part', () => {
  const dashes = { intervals: [0, 5, 40, 60, 90, 100], cap: 'butt' } as const;
  assert.equal(partCount(dashes, 100), 2);
  const drawn = paths(svgMarkup({ width: 10, height: 10, layers: [layer(dashes.intervals, { levels: [1, 1] })] }));
  assert.match(drawn[0] as string, /stroke-dasharray="20 80" stroke-dashoffset="-40"/);
  assert.match(drawn[1] as string, /stroke-dasharray="15 85" stroke-dashoffset="-90"/);
  // A part that is fully dark is not drawn at all.
  assert.equal(paths(svgMarkup({ width: 10, height: 10, layers: [layer(dashes.intervals, { levels: [0, 1] })] })).length, 1);
});
