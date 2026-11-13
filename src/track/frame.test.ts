import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FrameShape, StepOp } from './shape.js';
import { clearance, holds, offset, portion, resolve, widest } from './track.js';

const near = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≉ ${expected}`);
const frame = (extra: Omit<FrameShape, 'kind'> = {}): FrameShape => ({ kind: 'frame', ...extra });
const anchor = (track: { anchors: Readonly<Record<string, { start: number; end: number }>> }, name: string) => {
  const found = track.anchors[name];
  assert.ok(found !== undefined, `no anchor ${name}`);
  return found;
};

test('a plain frame is the host box, travelling clockwise from the middle of the top', () => {
  const box = resolve(frame(), 200, 100);
  assert.equal(box.closed, true);
  near(box.length, 600);
  assert.equal(box.path, 'M100 0L200 0L200 100L0 100L0 0L100 0Z');
});

test('sharp corners are anchors of zero length in order of travel', () => {
  const box = resolve(frame(), 200, 100);
  assert.deepEqual(
    ['tr', 'br', 'bl', 'tl'].map((name) => anchor(box, name)),
    [100, 200, 400, 500].map((at) => ({ start: at, end: at })),
  );
});

test('inset moves the outline inward on every side', () => {
  const box = resolve(frame({ inset: 10 }), 200, 100);
  near(box.length, 2 * (180 + 80));
  assert.equal(box.path, 'M100 10L190 10L190 90L10 90L10 10L100 10Z');
});

test('chamfers cut corners at 45° and are anchors as long as the cut', () => {
  const cut = resolve(frame({ corners: { kind: 'chamfer', size: 10 } }), 200, 100);
  near(cut.length, 600 - 80 + 4 * 10 * Math.SQRT2);
  const tr = anchor(cut, 'tr');
  near(tr.start, 90);
  near(tr.end - tr.start, 10 * Math.SQRT2);
});

test('corners can differ', () => {
  const cut = resolve(frame({ corners: { tl: { kind: 'chamfer', size: 12 } } }), 200, 100);
  near(cut.length, 600 - 24 + 12 * Math.SQRT2);
  assert.equal(cut.path, 'M106 0L200 0L200 100L0 100L0 12L12 0L106 0Z');
});

test('fillets round corners with quarter circles', () => {
  const round = resolve(frame({ corners: { kind: 'fillet', radius: 10 } }), 200, 100);
  near(round.length, 600 - 80 + 2 * Math.PI * 10);
  assert.match(round.path, /^M100 0L190 0A10 10 0 0 1 200 10L200 90A10 10 0 0 1 190 100L/);
  near(anchor(round, 'tr').end - anchor(round, 'tr').start, (Math.PI / 2) * 10);
});

test('corners that ask for more than an edge has shrink together', () => {
  const diamond = resolve(frame({ corners: { kind: 'chamfer', size: 80 } }), 100, 100);
  near(diamond.length, 4 * 50 * Math.SQRT2);
  const lopsided = resolve(
    frame({ corners: { tl: { kind: 'chamfer', size: 90 }, tr: { kind: 'chamfer', size: 30 } } }),
    100,
    200,
  );
  // 90 and 30 on an edge of 100: both scale by 100 / 120.
  near(anchor(lopsided, 'tr').end - anchor(lopsided, 'tr').start, 25 * Math.SQRT2);
});

test('a step displaces a stretch of an edge, with 45° ramps by default', () => {
  const step = { kind: 'step', from: { from: 'start', offset: 40 }, to: { fraction: 0.6 }, depth: 6 } as const;
  const stepped = resolve(frame({ edges: { bottom: [step] } }), 200, 100);
  near(stepped.length, 600 + 2 * (6 * Math.SQRT2 - 6));
  assert.match(stepped.path, /L120 100L114 94L46 94L40 100L0 100/);
  const square = resolve(frame({ edges: { bottom: [{ ...step, ramp: 'square' }] } }), 200, 100);
  near(square.length, 600 + 12);
});

test('a step with negative depth is a tab that stands out of the outline', () => {
  const tab = { kind: 'step', from: { from: 'end', offset: 60 }, to: { from: 'end', offset: 20 }, depth: -8 } as const;
  const tabbed = resolve(frame({ inset: 8, edges: { top: [tab] } }), 200, 100);
  assert.match(tabbed.path, /L132 8L140 0L164 0L172 8L192 8/);
});

test('positions are read left to right and top to bottom on every edge', () => {
  const at = (edge: 'top' | 'right' | 'bottom' | 'left') =>
    resolve(
      frame({
        edges: {
          [edge]: [
            { kind: 'step', id: 's', from: { from: 'start', offset: 10 }, to: { from: 'start', offset: 40 }, depth: 5, ramp: 'square' },
          ],
        },
      }),
      200,
      200,
    ).path;
  assert.match(at('top'), /L10 0L10 5L40 5L40 0/);
  assert.match(at('bottom'), /L40 200L40 195L10 195L10 200/);
  assert.match(at('right'), /L200 10L195 10L195 40L200 40/);
  assert.match(at('left'), /L0 40L5 40L5 10L0 10/);
});

test('a step with an id publishes its flat part as an anchor', () => {
  const stepped = resolve(
    frame({
      edges: {
        bottom: [
          { kind: 'step', id: 'shelf', from: { from: 'start', offset: 10 }, to: { from: 'start', offset: 40 }, depth: 5, ramp: 'square' },
        ],
      },
    }),
    200,
    100,
  );
  // Half the top, the right side, the bottom back to x = 40, down 5.
  assert.deepEqual(anchor(stepped, 'shelf'), { start: 100 + 100 + 160 + 5, end: 100 + 100 + 160 + 5 + 30 });
});

test('a step that does not fit its edge is left out', () => {
  const step = { kind: 'step', id: 's', from: { from: 'start', offset: 40 }, to: { fraction: 0.6 }, depth: 6 } as const;
  const narrow = resolve(frame({ edges: { bottom: [step] } }), 60, 100);
  near(narrow.length, 320);
  assert.equal(narrow.anchors['s'], undefined);
  const tooDeep = resolve(frame({ edges: { top: [{ ...step, depth: 60 }] } }), 200, 100);
  near(tooDeep.length, 600);
  const offEdge = resolve(
    frame({ edges: { top: [{ ...step, from: { from: 'end', offset: 500 }, to: { from: 'end', offset: 450 } }] } }),
    200,
    100,
  );
  near(offEdge.length, 600);
});

test('where steps overlap, priority decides and declaration order breaks ties', () => {
  const a: StepOp = { kind: 'step', id: 'a', from: { from: 'start', offset: 10 }, to: { from: 'start', offset: 60 }, depth: 4 };
  const b: StepOp = { kind: 'step', id: 'b', from: { from: 'start', offset: 40 }, to: { from: 'start', offset: 90 }, depth: 4 };
  const names = (steps: readonly StepOp[]) =>
    Object.keys(resolve(frame({ edges: { top: steps } }), 200, 100).anchors).filter((name) => name.length === 1);
  assert.deepEqual(names([a, b]), ['a']);
  assert.deepEqual(names([a, { ...b, priority: 1 }]), ['b']);
  const apart: StepOp = { ...b, from: { from: 'start', offset: 100 }, to: { from: 'start', offset: 150 } };
  assert.deepEqual(names([apart, a]).sort(), ['a', 'b']);
});

test('offsetting a frame moves every side and keeps corners sharp', () => {
  const box = resolve(frame(), 200, 100);
  const inner = offset(box, 10);
  near(inner.length, 2 * (180 + 80));
  assert.equal(inner.path, 'M100 10L190 10L190 90L10 90L10 10L100 10Z');
  near(anchor(inner, 'tr').start, 90);
  near(offset(box, -10).length, 2 * (220 + 120));
});

test('a chamfer shrinks under an inward offset and vanishes when consumed', () => {
  const cut = resolve(frame({ corners: { tl: { kind: 'chamfer', size: 12 } } }), 200, 100);
  const shrink = 2 * Math.tan(Math.PI / 8);
  const tl = anchor(offset(cut, 5), 'tl');
  near(tl.end - tl.start, 12 * Math.SQRT2 - 5 * shrink);
  const gone = offset(cut, 25);
  near(gone.length, 2 * (150 + 50));
  // The outline starts at x = 106 on the top; the corner sits where the left side ends.
  assert.deepEqual(anchor(gone, 'tl'), { start: 69 + 50 + 150 + 50, end: 69 + 50 + 150 + 50 });
});

test('a fillet keeps its centre under an offset and turns sharp at radius zero', () => {
  const round = resolve(frame({ corners: { kind: 'fillet', radius: 10 } }), 200, 100);
  near(offset(round, 4).length, 2 * (192 + 92) - 8 * 6 + 2 * Math.PI * 6);
  near(offset(round, 10).length, 2 * (180 + 80));
  near(offset(round, 15).length, 2 * (170 + 70));
  near(offset(round, -5).length, 2 * (210 + 110) - 8 * 15 + 2 * Math.PI * 15);
});

test('a step keeps its shape under an offset and its anchor follows', () => {
  const tabbed = resolve(
    frame({
      inset: 8,
      edges: {
        top: [{ kind: 'step', id: 'tab', from: { from: 'end', offset: 60 }, to: { from: 'end', offset: 20 }, depth: -8 }],
      },
    }),
    200,
    100,
  );
  const flat = anchor(tabbed, 'tab');
  near(flat.end - flat.start, 24);
  const inner = anchor(offset(tabbed, 4), 'tab');
  near(inner.end - inner.start, 24 - 4 * 2 * Math.tan(Math.PI / 8));
});

test('an offset that makes opposite sides meet consumes the frame', () => {
  const box = resolve(frame(), 200, 100);
  assert.equal(offset(box, 50).length, 0);
  assert.equal(offset(box, 60).path, '');
  assert.ok(offset(box, 49).length > 0);
});

test('a frame holds a band as long as the band does not reach through it', () => {
  const box = resolve(frame(), 200, 40);
  assert.equal(holds(box, 0, 8), true);
  assert.equal(holds(box, 0, 19), true);
  assert.equal(holds(box, 0, 20), false);
  assert.equal(holds(box, 14, 22), false);
  assert.equal(holds(box, -30, -20), true);
});

test('a ring holds a band only while its inner edge stays wider than the band', () => {
  const ring = resolve({ kind: 'ring' }, 100, 100);
  assert.equal(holds(ring, 6, 14), true);
  // Inner radius 10 against a width of 20.
  assert.equal(holds(ring, 20, 40), false);
  assert.equal(holds(ring, 30, 34), true);
  assert.equal(holds(ring, 44, 48), false);
  assert.equal(holds(ring, 45, 50), false);
});

test('a step that was left out comes back only with room to spare', () => {
  const step: StepOp = { kind: 'step', id: 's', from: { from: 'end', offset: 80 }, to: { from: 'end', offset: 20 }, depth: 4 };
  const shape = frame({ edges: { top: [step] } });
  const has = (track: { anchors: Readonly<Record<string, unknown>> }) => track.anchors['s'] !== undefined;
  // The step needs a top edge of 80.
  assert.equal(has(resolve(shape, 80, 100)), true);
  const without = resolve(shape, 79, 100);
  assert.equal(has(without), false);
  // Growing back: not at 80, not at 83, but at 84.
  assert.equal(has(resolve(shape, 80, 100, without)), false);
  assert.equal(has(resolve(shape, 83, 100, without)), false);
  const back = resolve(shape, 84, 100, without);
  assert.equal(has(back), true);
  // Shrinking again: it stays down to the size where it truly stops fitting.
  assert.equal(has(resolve(shape, 80, 100, back)), true);
  assert.equal(has(resolve(shape, 79, 100, back)), false);
});

test('a band that is not shown needs room to spare before it is held', () => {
  const ring = resolve({ kind: 'ring' }, 100, 100);
  assert.equal(holds(ring, 20, 34), true);
  assert.equal(holds(ring, 20, 34, 4), false);
  assert.equal(holds(ring, 20, 30, 4), true);
});

test('widest gives the wanted width where it holds and the most that holds elsewhere', () => {
  const ring = resolve({ kind: 'ring' }, 100, 100);
  assert.equal(widest(ring, 10, 8), 8);
  // From offset 10 the inner edge stays wider than the band up to a width of 20.
  const most = widest(ring, 10, 35);
  assert.ok(most > 19.5 && most < 20, `got ${most}`);
  assert.equal(widest(ring, 49.9, 5) < 0.25, true);
  assert.equal(widest(ring, 10, 0), 0);
  assert.equal(widest(ring, 10, Number.NaN), 0);
  const box = resolve(frame(), 200, 40);
  const through = widest(box, 0, 60);
  assert.ok(through > 19.5 && through < 20, `got ${through}`);
});

test('clearance keeps content clear of bands, steps and corners', () => {
  const plain = resolve(frame({ inset: 2 }), 200, 100);
  assert.deepEqual(clearance(plain, 5), { top: 7, right: 7, bottom: 7, left: 7 });

  const stepped = resolve(
    frame({ edges: { bottom: [{ kind: 'step', from: { from: 'start', offset: 20 }, to: { from: 'end', offset: 20 }, depth: 6 }] } }),
    200,
    100,
  );
  assert.deepEqual(clearance(stepped, 1), { top: 1, right: 1, bottom: 7, left: 1 });

  const cut = resolve(frame({ corners: { tl: { kind: 'chamfer', size: 20 } } }), 200, 100);
  const cleared = clearance(cut, 2);
  near(cleared.top, 10 + 2 / Math.SQRT2);
  near(cleared.left, 10 + 2 / Math.SQRT2);
  assert.equal(cleared.right, 2);
  assert.equal(cleared.bottom, 2);

  const round = resolve(frame({ corners: { kind: 'fillet', radius: 20 } }), 200, 100);
  near(clearance(round, 0).top, 20 - 20 / Math.SQRT2);
  near(clearance(round, 30).top, 30);
});

test('clearance of a ring is the square inside its innermost band', () => {
  const ring = resolve({ kind: 'ring' }, 200, 100);
  const { top, left } = clearance(ring, 10);
  near(top, 50 - 40 / Math.SQRT2);
  near(left, 100 - 40 / Math.SQRT2);
  assert.deepEqual(clearance(offset(ring, 5), 0), { top: 0, right: 0, bottom: 0, left: 0 });
  assert.deepEqual(clearance(resolve(frame(), 0, 0), 3), { top: 0, right: 0, bottom: 0, left: 0 });
});

test('a portion of a frame is open and stops part-way along a side', () => {
  const half = portion(resolve(frame(), 200, 100), 0.5);
  assert.equal(half.closed, false);
  near(half.length, 300);
  assert.equal(half.path, 'M100 0L200 0L200 100L100 100');
});

test('a frame that does not fit the host is an empty track', () => {
  assert.equal(resolve(frame({ inset: 50 }), 200, 100).length, 0);
  assert.equal(resolve(frame({ inset: 80 }), 200, 100).path, '');
  assert.ok(resolve(frame({ inset: Number.NaN }), 200, 100).length > 0);
});
