import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compile } from './compile.js';
import type { PatternContext } from './compile.js';

/** A small deterministic generator; the real one lives in `motion`. */
function random(seed: number): () => number {
  let state = (seed >>> 0) + 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const closed = (length: number, width = 4): PatternContext => ({
  length,
  cyclic: true,
  width,
  random,
});
const open = (length: number, width = 4): PatternContext => ({ ...closed(length, width), cyclic: false });

const near = (actual: readonly number[], expected: readonly number[]) => {
  assert.equal(actual.length, expected.length, `${actual} vs ${expected}`);
  actual.forEach((value, i) =>
    assert.ok(Math.abs(value - (expected[i] as number)) < 1e-6, `${actual} vs ${expected}`),
  );
};
const count = (intervals: readonly number[]) => intervals.length / 2;

test('solid covers the whole band', () => {
  near(compile({ kind: 'solid' }, closed(100)).intervals, [0, 100]);
});

test('dashes on a closed band repeat a whole number of times', () => {
  const { intervals } = compile({ kind: 'dashes', dash: 6, gap: 3 }, closed(100));
  assert.equal(count(intervals), 11);
  const period = 100 / 11;
  near(intervals.slice(0, 4), [0, (period * 6) / 9, period, period + (period * 6) / 9]);
});

test('dashes on an open band keep their size and are clipped at the end', () => {
  near(compile({ kind: 'dashes', dash: 6, gap: 4 }, open(25)).intervals, [0, 6, 10, 16, 20, 25]);
});

test('dashes without a gap are solid, without a dash nothing', () => {
  near(compile({ kind: 'dashes', dash: 5, gap: 0 }, closed(50)).intervals, [0, 50]);
  assert.equal(count(compile({ kind: 'dashes', dash: 0, gap: 5 }, closed(50)).intervals), 0);
});

test('segments on a closed band centre a gap on the seam', () => {
  near(compile({ kind: 'segments', count: 4, gap: 2 }, closed(100)).intervals, [
    1, 24, 26, 49, 51, 74, 76, 99,
  ]);
});

test('segments on an open band start and end on the band ends', () => {
  near(compile({ kind: 'segments', count: 3, gap: 2 }, open(32)).intervals, [
    0, 9.333333, 11.333333, 20.666667, 22.666667, 32,
  ]);
});

test('segments drop to the largest count that fits', () => {
  assert.equal(count(compile({ kind: 'segments', count: 12, gap: 4 }, closed(30)).intervals), 6);
  assert.equal(count(compile({ kind: 'segments', count: 12, gap: 4 }, closed(3)).intervals), 0);
});

test('ticks on a closed band put the first tick across the seam', () => {
  near(compile({ kind: 'ticks', count: 4, thickness: 2 }, closed(100)).intervals, [
    0, 1, 24, 26, 49, 51, 74, 76, 99, 100,
  ]);
});

test('ticks on an open band stay inside it', () => {
  near(compile({ kind: 'ticks', count: 3, thickness: 2 }, open(20)).intervals, [0, 2, 9, 11, 18, 20]);
});

test('ticks thin out to the largest count that keeps the spacing', () => {
  const spec = { kind: 'ticks', count: 60, minSpacing: 4 } as const;
  assert.equal(count(compile(spec, closed(400)).intervals), 60 + 1);
  assert.equal(count(compile(spec, closed(187)).intervals), 37 + 1);
});

test('ticks with multipleOf thin out in steps that keep a coarser grid aligned', () => {
  const spec = { kind: 'ticks', count: 60, minSpacing: 4, multipleOf: 12 } as const;
  const major = { kind: 'ticks', count: 12, thickness: 2 } as const;
  for (const [length, expected] of [
    [400, 60],
    [187, 36],
    [130, 24],
    [70, 12],
    [40, 8],
  ] as const) {
    const minor = compile(spec, closed(length)).intervals;
    // The tick at the seam is stored as two halves, hence the extra one.
    assert.equal(count(minor) - 1, expected, `length ${length}`);
    if (expected % 12 !== 0) continue;
    // Every major tick centre must coincide with a minor tick centre.
    const centres = new Set<number>();
    for (let i = 0; i < expected; i++) centres.add(Math.round(((i * length) / expected) * 1e6));
    for (let i = 0; i < 12; i++) assert.ok(centres.has(Math.round(((i * length) / 12) * 1e6)));
    assert.equal(count(compile(major, closed(length)).intervals) - 1, 12);
  }
});

test('dots are zero-length round intervals and keep clear of open ends', () => {
  const dots = compile({ kind: 'dots', count: 3 }, open(20, 4));
  assert.equal(dots.cap, 'round');
  near(dots.intervals, [2, 2, 10, 10, 18, 18]);
});

test('dots thin out by centre distance', () => {
  assert.equal(count(compile({ kind: 'dots', count: 100 }, closed(80, 4)).intervals), 10);
});

test('blocks are reproducible, ordered and end exactly at the band end', () => {
  const spec = { kind: 'blocks', seed: 7, min: 10, max: 40, gap: 5 } as const;
  const a = compile(spec, closed(300)).intervals;
  const b = compile(spec, closed(300)).intervals;
  assert.deepEqual(a, b);
  assert.ok(count(a) >= 6);
  for (let i = 1; i < a.length; i++) assert.ok((a[i] as number) >= (a[i - 1] as number));
  assert.ok((a[0] as number) >= 0 && (a.at(-1) as number) <= 300);
  // An open band starts and ends on a block.
  const row = compile(spec, open(300)).intervals;
  assert.equal(row[0], 0);
  assert.ok(Math.abs((row.at(-1) as number) - 300) < 1e-6);
});

test('block bands on a closed track do not all start at the seam', () => {
  const starts = [1, 2, 3, 4].map((seed) => {
    const spec = { kind: 'blocks', seed, min: 10, max: 40, gap: 5 } as const;
    const { intervals } = compile(spec, closed(300));
    // Total gap length is the same wherever the row starts.
    let drawn = 0;
    for (let i = 0; i < intervals.length; i += 2) drawn += (intervals[i + 1] as number) - (intervals[i] as number);
    assert.ok(drawn > 150 && drawn < 300);
    return intervals[0] === 0 ? (intervals[1] as number) : (intervals[0] as number);
  });
  assert.ok(new Set(starts.map((value) => Math.round(value))).size >= 3);
});

test('block seeds and density change the result', () => {
  const base = { kind: 'blocks', min: 10, max: 40, gap: 5 } as const;
  const one = compile({ ...base, seed: 1 }, closed(300)).intervals;
  const two = compile({ ...base, seed: 2 }, closed(300)).intervals;
  assert.notDeepEqual(one, two);
  const sparse = compile({ ...base, seed: 1, density: 0.5 }, closed(300)).intervals;
  assert.ok(count(sparse) < count(one));
  assert.equal(count(compile({ ...base, seed: 1, density: 0 }, closed(300)).intervals), 0);
});

test('intervals are fractions of the length, merged, and wrap on closed bands', () => {
  const spec = {
    kind: 'intervals',
    intervals: [
      { from: 0.5, to: 0.6 },
      { from: 0.1, to: 0.2 },
      { from: 0.15, to: 0.3 },
      { from: 0.9, to: 0.05 },
    ],
  } as const;
  near(compile(spec, closed(100)).intervals, [0, 5, 10, 30, 50, 60, 90, 100]);
  near(compile(spec, open(100)).intervals, [10, 30, 50, 60]);
});

test('spans follow anchors, widen and trim, and ignore unknown names', () => {
  const context = { ...closed(100), anchors: { tl: { start: 0, end: 10 }, tab: { start: 40, end: 60 } } };
  const spec = {
    kind: 'spans',
    spans: [
      { anchor: 'tl', before: 5, after: 5 },
      { anchor: 'tab', before: -4, after: -4 },
      { anchor: 'missing' },
    ],
  } as const;
  near(compile(spec, context).intervals, [0, 15, 44, 56, 95, 100]);
  near(compile(spec, { ...context, cyclic: false }).intervals, [0, 15, 44, 56]);
});

test('degenerate input yields no pattern instead of an error', () => {
  for (const length of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(count(compile({ kind: 'solid' }, closed(length)).intervals), 0);
  }
  assert.equal(count(compile({ kind: 'ticks', count: Number.NaN }, closed(100)).intervals), 0);
  assert.equal(count(compile({ kind: 'segments', count: -3, gap: 1 }, closed(100)).intervals), 0);
  assert.equal(count(compile({ kind: 'dots', count: 5 }, open(1, 4)).intervals), 0);
});

test('a pattern too fine to see is capped', () => {
  near(compile({ kind: 'dashes', dash: 0.001, gap: 0.001 }, closed(100)).intervals, [0, 100]);
  assert.ok(count(compile({ kind: 'ticks', count: 1e9, minSpacing: 0, thickness: 0.001 }, closed(100)).intervals) <= 2049);
});
