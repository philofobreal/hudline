import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitPeriod } from './fit.js';

test('fitted period divides the length into a whole number of periods', () => {
  const length = 2 * Math.PI * 50;
  const fitted = fitPeriod(length, 12);
  const count = length / fitted;
  assert.ok(Math.abs(count - Math.round(count)) < 1e-9);
});

test('fitted period stays close to the requested one', () => {
  assert.equal(fitPeriod(100, 10), 10);
  assert.equal(fitPeriod(100, 9), 100 / 11);
});

test('a period longer than the track becomes one full turn', () => {
  assert.equal(fitPeriod(40, 500), 40);
});

test('degenerate input yields no pattern instead of an error', () => {
  assert.equal(fitPeriod(0, 10), 0);
  assert.equal(fitPeriod(100, 0), 0);
  assert.equal(fitPeriod(-5, 10), 0);
  assert.equal(fitPeriod(Number.NaN, 10), 0);
  assert.equal(fitPeriod(100, Number.POSITIVE_INFINITY), 0);
});
