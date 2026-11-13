import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drawScene } from './canvas.js';
import type { Layer, Scene } from './svg.js';

/*
 * A stand-in for the parts of the canvas API that `drawScene` uses. It
 * records what is asked of it. That a browser then draws the same
 * picture as the SVG surface is checked in the browser self-test.
 */

class FakePath {
  constructor(readonly d: string) {}
}
class FakeMatrix {
  readonly steps: string[] = [];
  rotate(angle: number): this {
    this.steps.push(`rotate ${angle}`);
    return this;
  }
  translate(x: number, y: number): this {
    this.steps.push(`translate ${x} ${y}`);
    return this;
  }
  scale(factor: number): this {
    this.steps.push(`scale ${factor}`);
    return this;
  }
}
class FakePattern {
  transform: FakeMatrix | undefined;
  constructor(readonly tile: FakeCanvas) {}
  setTransform(matrix: FakeMatrix): void {
    this.transform = matrix;
  }
}
class FakeCanvas {
  readonly fills: string[] = [];
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext() {
    const canvas = this;
    return {
      fillStyle: '',
      fillRect(x: number, y: number, w: number, h: number) {
        canvas.fills.push(`${this.fillStyle} ${x} ${y} ${w} ${h}`);
      },
    };
  }
}
Object.assign(globalThis, { Path2D: FakePath, DOMMatrix: FakeMatrix, OffscreenCanvas: FakeCanvas });

interface Stroke {
  d: string;
  width: number;
  cap: string;
  dash: number[];
  offset: number;
  alpha: number;
  style: unknown;
  origin: string;
}
class FakeContext {
  strokeStyle: unknown = '#123456';
  globalAlpha = 1;
  lineWidth = 1;
  lineCap = 'butt';
  lineJoin = 'bevel';
  miterLimit = 10;
  lineDashOffset = 0;
  dash: number[] = [];
  origin = '0 0';
  readonly strokes: Stroke[] = [];
  readonly patterns: FakePattern[] = [];
  private readonly saved: object[] = [];
  save(): void {
    const { strokeStyle, globalAlpha, lineWidth, lineCap, lineJoin, miterLimit, lineDashOffset, dash, origin } = this;
    this.saved.push({ strokeStyle, globalAlpha, lineWidth, lineCap, lineJoin, miterLimit, lineDashOffset, dash, origin });
  }
  restore(): void {
    Object.assign(this, this.saved.pop());
  }
  translate(x: number, y: number): void {
    this.origin = `${x} ${y}`;
  }
  setLineDash(dash: number[]): void {
    this.dash = [...dash];
  }
  createPattern(tile: FakeCanvas): FakePattern {
    const pattern = new FakePattern(tile);
    this.patterns.push(pattern);
    return pattern;
  }
  stroke(path: FakePath): void {
    this.strokes.push({
      d: path.d,
      width: this.lineWidth,
      cap: this.lineCap,
      dash: this.dash,
      offset: this.lineDashOffset,
      alpha: this.globalAlpha,
      style: this.strokeStyle,
      origin: this.origin,
    });
  }
}

const track = { closed: true, length: 100, path: 'M0 0L10 0Z', anchors: {} };
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
const scene = (...layers: Layer[]): Scene => ({ width: 50, height: 50, layers });
function draw(target: Scene, options?: Parameters<typeof drawScene>[2], context = new FakeContext()): FakeContext {
  drawScene(context as unknown as CanvasRenderingContext2D, target, options);
  return context;
}

test('a solid band is one undashed stroke in the context colour', () => {
  const { strokes } = draw(scene(layer([0, 100])));
  assert.deepEqual(strokes, [
    { d: 'M0 0L10 0Z', width: 4, cap: 'butt', dash: [], offset: 0, alpha: 1, style: '#123456', origin: '0 0' },
  ]);
});

test('intervals become dash lengths that add up to the pattern length, moved by travel', () => {
  const [stroke] = draw(scene(layer([10, 30, 50, 60], { phase: 105 }))).strokes;
  assert.deepEqual(stroke?.dash, [20, 20, 10, 50]);
  assert.equal(stroke?.offset, -15);
});

test('position, colour and opacity come from the options and the layer, and the context is left as found', () => {
  const context = new FakeContext();
  context.globalAlpha = 0.5;
  draw(scene(layer([0, 100], { opacity: 0.4 })), { x: 30, y: 12, color: 'tomato' }, context);
  const [stroke] = context.strokes;
  assert.equal(stroke?.origin, '30 12');
  assert.equal(stroke?.style, 'tomato');
  assert.equal(stroke?.alpha, 0.2);
  assert.deepEqual(
    [context.globalAlpha, context.strokeStyle, context.origin, context.lineJoin, context.dash],
    [0.5, '#123456', '0 0', 'bevel', []],
  );
});

test('dots are drawn with round caps', () => {
  const [stroke] = draw(scene(layer([0, 0, 50, 50], { dashes: { intervals: [0, 0, 50, 50], cap: 'round' } }))).strokes;
  assert.equal(stroke?.cap, 'round');
  assert.deepEqual(stroke?.dash, [0, 50, 0, 50]);
});

test('a band drawn part by part is one stroke per part with its own brightness', () => {
  const { strokes } = draw(scene(layer([0, 5, 40, 60, 90, 100], { levels: [0.5, 1], opacity: 0.8, phase: 3 })));
  assert.equal(strokes.length, 2);
  assert.deepEqual([strokes[0]?.dash, strokes[0]?.offset, strokes[0]?.alpha], [[20, 80], -43, 0.4]);
  // The interval that crosses the seam is one part of 15.
  assert.deepEqual([strokes[1]?.dash, strokes[1]?.offset, strokes[1]?.alpha], [[15, 85], -93, 0.8]);
  assert.equal(draw(scene(layer([10, 30, 50, 60], { levels: [0, 1] }))).strokes.length, 1);
});

test('a hatched band is stroked with a pattern of turned, shifted stripes', () => {
  const context = new FakeContext();
  const hatch = { angle: 45, stripe: 2, gap: 4, shift: 7 };
  draw(scene(layer([0, 100], { hatch }), layer([0, 50], { hatch: { ...hatch, shift: 8 } })), { color: 'red' }, context);
  // One tile serves every band with the same colour and stripes.
  assert.equal(context.patterns.length, 1);
  const [pattern] = context.patterns;
  assert.ok(pattern !== undefined);
  assert.equal(context.strokes[0]?.style, pattern);
  // A tile of 24 pixels for a period of 6; the stripe covers a third.
  assert.equal(pattern.tile.width, 24);
  assert.deepEqual(pattern.tile.fills, ['red 0 0 8 24']);
  assert.deepEqual(pattern.transform?.steps, ['rotate 45', 'translate 2 0', 'scale 0.25']);
});

test('the path of a track is built once', () => {
  const made: FakePath[] = [];
  class CountingPath extends FakePath {
    constructor(d: string) {
      super(d);
      made.push(this);
    }
  }
  Object.assign(globalThis, { Path2D: CountingPath });
  const own = { ...track };
  draw(scene(layer([0, 100], { track: own })));
  draw(scene(layer([0, 100], { track: own })));
  assert.equal(made.length, 1);
  Object.assign(globalThis, { Path2D: FakePath });
});

test('layers with nothing to show are skipped, and so is everything without canvas support', () => {
  const nothing = [
    layer([]),
    layer([0, 100], { width: 0 }),
    layer([0, 100], { opacity: 0 }),
    layer([0, 100], { track: { ...track, length: 0, path: '' } }),
  ];
  assert.equal(draw(scene(...nothing)).strokes.length, 0);
  Object.assign(globalThis, { Path2D: undefined });
  assert.equal(draw(scene(layer([0, 100]))).strokes.length, 0);
  Object.assign(globalThis, { Path2D: FakePath });
});
