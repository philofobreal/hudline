import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRandom } from './random.js';

test('the same seed gives the same sequence', () => {
  const a = createRandom(7);
  const b = createRandom(7);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test('different seeds give different sequences', () => {
  const a = createRandom(1);
  const b = createRandom(2);
  let same = 0;
  for (let i = 0; i < 100; i++) if (a() === b()) same++;
  assert.ok(same < 5);
});

test('values stay in [0, 1)', () => {
  const random = createRandom(123456);
  for (let i = 0; i < 10000; i++) {
    const value = random();
    assert.ok(value >= 0 && value < 1);
  }
});

test('a non-finite seed behaves as seed 0', () => {
  assert.equal(createRandom(Number.NaN)(), createRandom(0)());
});
