import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attach } from './attach.js';
import { watch } from './watch.js';
import type { HudSpec } from './spec.js';

/*
 * A stand-in for the few parts of the DOM that `attach` touches. It
 * records what is written, which is what these tests are about. How a
 * real browser renders the result is checked by looking at the gallery.
 */

class FakeElement {
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, Set<() => void>>();
  readonly ownerDocument = fakeDocument;
  readonly nodeType = 1;
  parent: FakeElement | undefined;
  isConnected = true;
  clientWidth = 0;
  clientHeight = 0;
  computedPosition = 'static';
  /** Attribute writes and removals since the count was last reset. */
  writes = 0;
  readonly style = {
    position: '',
    properties: new Map<string, string>(),
    setProperty(name: string, value: string) {
      this.properties.set(name, value);
    },
    removeProperty(name: string) {
      this.properties.delete(name);
    },
  };

  constructor(readonly localName: string) {}

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    this.writes++;
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
    this.writes++;
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  /** Understands `[name]`, which is all the library asks for. */
  querySelectorAll(selector: string): FakeElement[] {
    const name = selector.slice(1, -1);
    return this.children.flatMap((child) => [
      ...(child.hasAttribute(name) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  contains(other: FakeElement): boolean {
    return this.children.some((child) => child === other || child.contains(other));
  }
  get firstChild(): FakeElement | null {
    return this.children[0] ?? null;
  }
  appendChild(child: FakeElement): FakeElement {
    return this.insertBefore(child, null);
  }
  insertBefore(child: FakeElement, before: FakeElement | null): FakeElement {
    child.parent = this;
    const at = before === null ? this.children.length : this.children.indexOf(before);
    this.children.splice(at, 0, child);
    return child;
  }
  remove(): void {
    const siblings = this.parent?.children;
    siblings?.splice(siblings.indexOf(this), 1);
  }
  addEventListener(type: string, listener: () => void): void {
    let set = this.listeners.get(type);
    if (set === undefined) this.listeners.set(type, (set = new Set()));
    set.add(listener);
  }
  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }
  fire(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

const fakeDocument = { createElementNS: (_: string, name: string) => new FakeElement(name) };

class FakeObserver<Entry> {
  static readonly all: FakeObserver<never>[] = [];
  readonly observed = new Set<FakeElement>();
  constructor(readonly callback: (entries: Entry[]) => void) {
    FakeObserver.all.push(this as FakeObserver<never>);
  }
  observe(element: FakeElement): void {
    this.observed.add(element);
  }
  unobserve(element: FakeElement): void {
    this.observed.delete(element);
  }
}
class FakeResizeObserver extends FakeObserver<{ target: FakeElement }> {}
interface FakeMutation {
  type: 'attributes' | 'childList';
  target: FakeElement;
  addedNodes: FakeElement[];
  removedNodes: FakeElement[];
}
class FakeMutationObserver extends FakeObserver<FakeMutation> {
  disconnect(): void {
    this.observed.clear();
  }
}
class FakeIntersectionObserver extends FakeObserver<{ target: FakeElement; isIntersecting: boolean }> {}

let milliseconds = 0;
let reduced = false;
const queue: (() => void)[] = [];
const mediaListeners: (() => void)[] = [];

Object.assign(globalThis, {
  document: fakeDocument,
  getComputedStyle: (element: FakeElement) => ({ position: element.computedPosition }),
  ResizeObserver: FakeResizeObserver,
  IntersectionObserver: FakeIntersectionObserver,
  MutationObserver: FakeMutationObserver,
  requestAnimationFrame: (callback: () => void) => queue.push(callback),
  matchMedia: () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_: string, listener: () => void) => mediaListeners.push(listener),
  }),
});
Object.defineProperty(globalThis, 'performance', { value: { now: () => milliseconds }, configurable: true });

/** Lets `count` animation frames pass, `step` seconds apart. */
function frames(count: number, step = 1 / 60): void {
  for (let i = 0; i < count; i++) {
    milliseconds += step * 1000;
    for (const callback of queue.splice(0)) callback();
  }
}
/** Runs frames until the loop has stopped by itself. */
function settle(): void {
  for (let i = 0; i < 400 && queue.length > 0; i++) frames(1, 0.05);
  assert.equal(queue.length, 0, 'the loop should have stopped');
}
function resize(host: FakeElement, width: number, height: number): void {
  host.clientWidth = width;
  host.clientHeight = height;
  for (const observer of FakeObserver.all) {
    if (observer instanceof FakeResizeObserver && observer.observed.has(host)) {
      observer.callback([{ target: host }]);
    }
  }
}
function sight(host: FakeElement, isIntersecting: boolean): void {
  for (const observer of FakeObserver.all) {
    if (observer instanceof FakeIntersectionObserver && observer.observed.has(host)) {
      observer.callback([{ target: host, isIntersecting }]);
    }
  }
}
function setReduced(value: boolean): void {
  reduced = value;
  for (const listener of mediaListeners) listener();
}

function host(width = 200, height = 100, name = 'div'): FakeElement {
  const element = new FakeElement(name);
  element.clientWidth = width;
  element.clientHeight = height;
  return element;
}
const mount = (element: FakeElement, spec: HudSpec) => attach(element as unknown as Element, spec);
const svgOf = (element: FakeElement) => element.children.filter((child) => child.localName === 'svg');
const pathsOf = (element: FakeElement) =>
  (svgOf(element)[0]?.children ?? []).filter((child) => child.localName === 'path');
const attribute = (element: FakeElement, band: number, name: string) =>
  pathsOf(element)[band]?.attributes.get(name);
const resetWrites = (element: FakeElement) => pathsOf(element).forEach((path) => (path.writes = 0));
const writes = (element: FakeElement) => pathsOf(element).reduce((sum, path) => sum + path.writes, 0);

const frameSpec: HudSpec = {
  shape: { kind: 'frame', inset: 2, corners: { tl: { kind: 'chamfer', size: 12 } } },
  bands: [
    { id: 'outline', width: 1 },
    { id: 'inner', offset: 4, width: 2 },
  ],
  states: {
    hover: { bands: { inner: { width: 4 } }, settle: 0.1 },
    active: { bands: { inner: { width: 6 } }, settle: 0.1 },
    alert: { bands: { outline: { width: 3 } }, settle: 0.1 },
  },
  settle: 0.1,
};
const spinning: HudSpec = {
  shape: { kind: 'ring' },
  bands: [{ width: 4, pattern: { kind: 'segments', count: 6, gap: 3 }, motion: { spin: 90 } }],
};

test('attach draws at once, as one svg child that does not disturb the host', () => {
  const element = host();
  mount(element, frameSpec);
  const [svg] = svgOf(element);
  assert.ok(svg !== undefined);
  assert.equal(element.children.length, 1);
  assert.match(svg.attributes.get('style') ?? '', /position:absolute;inset:0;.*pointer-events:none/);
  assert.equal(svg.attributes.get('aria-hidden'), 'true');
  assert.equal(svg.attributes.get('stroke'), 'currentColor');
  assert.equal(pathsOf(element).length, 2);
  // The outline band is 1 wide, so its centreline runs half a pixel inside the inset.
  assert.match(attribute(element, 0, 'd') ?? '', /^M106 2\.5L197\.5 2\.5/);
  assert.equal(attribute(element, 1, 'stroke-width'), '2');
  settle();
});

test('bands are stacked in the order of the spec, whichever is drawn first', () => {
  const element = host(100, 100);
  mount(element, {
    shape: { kind: 'ring' },
    bands: [
      { id: 'back', width: 2 },
      { id: 'middle', offset: 6, width: 5 },
      { id: 'front', offset: 14, width: 3 },
    ],
    // The back and middle bands are not there on the first paint.
    states: { enter: { bands: { back: { value: 0 }, middle: { value: 0 } }, settle: 0.1 } },
  });
  assert.deepEqual(pathsOf(element).map((path) => path.attributes.get('stroke-width')), ['3']);
  settle();
  assert.deepEqual(pathsOf(element).map((path) => path.attributes.get('stroke-width')), ['2', '5', '3']);
});

test('a hatched band gets its own pattern, and moving stripes cost one attribute per frame', () => {
  const element = host();
  const other = host();
  const spec: HudSpec = {
    shape: { kind: 'frame' },
    bands: [{ width: 8, fill: { kind: 'hatch', stripe: 3, gap: 3, drift: 12 } }],
  };
  const hud = mount(element, spec);
  const otherHud = mount(other, spec);
  const patternOf = (target: FakeElement) =>
    svgOf(target)[0]?.children.find((child) => child.localName === 'defs')?.children[0];
  const pattern = patternOf(element);
  assert.ok(pattern !== undefined);
  assert.equal(pattern.attributes.get('width'), '6');
  assert.equal(attribute(element, 0, 'stroke'), `url(#${pattern.attributes.get('id')})`);
  // Ids are unique in the document, so two hosts never share a pattern.
  assert.notEqual(pattern.attributes.get('id'), patternOf(other)?.attributes.get('id'));

  frames(3);
  resetWrites(element);
  pattern.writes = 0;
  const before = pattern.attributes.get('patternTransform');
  frames(10);
  assert.equal(writes(element), 0);
  assert.equal(pattern.writes, 10);
  assert.notEqual(pattern.attributes.get('patternTransform'), before);
  hud.detach();
  otherHud.detach();
  settle();
});

test('a band drawn part by part has one element per part, dimmed one by one', () => {
  const element = host(100, 100);
  const hud = mount(element, {
    shape: { kind: 'ring' },
    bands: [
      { width: 2 },
      {
        offset: 6,
        width: 6,
        pattern: { kind: 'segments', count: 5, gap: 4 },
        motion: { flicker: { seed: 3, rate: 8, depth: 0.9 } },
        addressable: true,
      },
      { offset: 16, width: 2 },
    ],
  });
  frames(5);
  const widths = pathsOf(element).map((path) => path.attributes.get('stroke-width'));
  // One outline, five parts in the middle, one inner line, in that order.
  assert.deepEqual(widths, ['2', '6', '6', '6', '6', '6', '2']);
  const levels = pathsOf(element).slice(1, 6).map((path) => path.attributes.get('opacity'));
  assert.ok(new Set(levels).size >= 4, `parts should differ: ${levels}`);
  hud.detach();
  settle();
});

test('a static host becomes relative; any other position is left alone', () => {
  const plain = host();
  mount(plain, frameSpec);
  assert.equal(plain.style.position, 'relative');
  const placed = host();
  placed.computedPosition = 'absolute';
  mount(placed, frameSpec);
  assert.equal(placed.style.position, '');
  settle();
});

test('the room content needs is published as custom properties', () => {
  const element = host();
  mount(element, frameSpec);
  // Inset 2, bands reaching 6 inward; the chamfer asks for 6 + 6/√2 on its two sides.
  assert.equal(element.style.properties.get('--hud-inset-right'), '8px');
  assert.equal(element.style.properties.get('--hud-inset-bottom'), '8px');
  assert.equal(element.style.properties.get('--hud-inset-top'), '13px');
  assert.equal(element.style.properties.get('--hud-inset-left'), '13px');
  settle();
});

test('attaching again replaces the spec and keeps one drawing and one handle', () => {
  const element = host();
  const first = mount(element, frameSpec);
  const second = mount(element, spinning);
  assert.equal(first, second);
  assert.equal(svgOf(element).length, 1);
  assert.match(attribute(element, 0, 'd') ?? '', /^M100 2A/);
  assert.equal(attribute(element, 1, 'display'), 'none');
  first.detach();
});

test('the drawing follows the size of the host', () => {
  const element = host();
  mount(element, frameSpec);
  settle();
  resize(element, 300, 150);
  frames(1);
  assert.match(attribute(element, 0, 'd') ?? '', /^M156 2\.5L297\.5 2\.5L297\.5 147\.5/);
  settle();
});

test('a drawing at rest writes nothing and the loop stops', () => {
  const element = host();
  mount(element, frameSpec);
  settle();
  resetWrites(element);
  frames(5);
  assert.equal(writes(element), 0);
  assert.equal(queue.length, 0);
});

test('a travelling pattern costs one attribute per frame', () => {
  const element = host(100, 100);
  const hud = mount(element, spinning);
  frames(3);
  resetWrites(element);
  const before = attribute(element, 0, 'stroke-dashoffset');
  frames(10);
  assert.equal(writes(element), 10);
  assert.notEqual(attribute(element, 0, 'stroke-dashoffset'), before);
  assert.equal(queue.length, 1);
  hud.detach();
  settle();
});

test('pointer and focus enter the automatic states the spec defines', () => {
  const element = host();
  mount(element, frameSpec);
  settle();
  const width = () => attribute(element, 1, 'stroke-width');

  element.fire('pointerenter');
  settle();
  assert.equal(width(), '4');
  element.fire('pointerdown');
  settle();
  assert.equal(width(), '6');
  element.fire('pointerup');
  settle();
  assert.equal(width(), '4');
  // The spec has no focus state: focus changes nothing.
  element.fire('focusin');
  settle();
  assert.equal(width(), '4');
  element.fire('pointerleave');
  settle();
  assert.equal(width(), '2');
});

test('a state that was asked for holds against the automatic ones', () => {
  const element = host();
  const hud = mount(element, frameSpec);
  hud.set('alert');
  settle();
  assert.equal(attribute(element, 0, 'stroke-width'), '3');
  element.fire('pointerenter');
  settle();
  assert.equal(attribute(element, 1, 'stroke-width'), '2');
  hud.set('idle');
  settle();
  assert.equal(attribute(element, 0, 'stroke-width'), '1');
  // Still hovered, so hover takes over now.
  assert.equal(attribute(element, 1, 'stroke-width'), '4');
  hud.set('no such state');
  settle();
  assert.equal(attribute(element, 1, 'stroke-width'), '2');
});

test('update changes a band for good and the value glides there', () => {
  const element = host(100, 100);
  const hud = mount(element, {
    shape: { kind: 'arc', start: 0, sweep: 180 },
    bands: [{ id: 'value', width: 4, value: 0.25 }],
    settle: 0.2,
  });
  settle();
  const quarter = attribute(element, 0, 'd');
  hud.update({ value: { value: 1 } });
  frames(2);
  const between = attribute(element, 0, 'd');
  assert.notEqual(between, quarter);
  settle();
  assert.equal(attribute(element, 0, 'd'), 'M50 2A48 48 0 0 1 50 98');
  assert.notEqual(between, attribute(element, 0, 'd'));
});

test('nothing is painted while the host is out of sight', () => {
  const element = host(100, 100);
  const hud = mount(element, spinning);
  frames(2);
  sight(element, false);
  frames(1);
  resetWrites(element);
  frames(5);
  assert.equal(writes(element), 0);
  assert.equal(queue.length, 0);
  sight(element, true);
  frames(2);
  assert.ok(writes(element) > 0);
  hud.detach();
  settle();
});

test('out of view the drawing waits: its draw-on plays when it is first seen', () => {
  const element = host(100, 100);
  const hud = mount(element, {
    shape: { kind: 'ring' },
    bands: [{ id: 'line', width: 2 }],
    states: { enter: { bands: { line: { value: 0 } }, settle: 1 } },
  });
  sight(element, false);
  // A long time passes out of view.
  frames(5, 10);
  sight(element, true);
  frames(2);
  const early = attribute(element, 0, 'd') ?? '';
  // Barely begun: a short arc, not the full circle.
  assert.doesNotMatch(early, /A49 49 0 0 1 50 99A/);
  settle();
  assert.match(attribute(element, 0, 'd') ?? '', /A49 49 0 0 1 50 99A49 49 0 0 1 50 1$/);
  hud.detach();
});

test('with reduced motion patterns stand still and states change at once', () => {
  setReduced(true);
  const element = host(100, 100);
  const hud = mount(element, {
    ...spinning,
    bands: [{ id: 'ring', width: 4, pattern: { kind: 'segments', count: 6, gap: 3 }, motion: { spin: 90 } }],
    states: { alert: { bands: { ring: { width: 9 } }, settle: 5 }, enter: { bands: { ring: { value: 0 } } } },
  });
  // Not drawn on, not spinning.
  assert.equal(attribute(element, 0, 'stroke-width'), '4');
  assert.match(attribute(element, 0, 'd') ?? '', /A48 48 0 0 1 50 2$/);
  settle();
  resetWrites(element);
  frames(5);
  assert.equal(writes(element), 0);
  hud.set('alert');
  frames(1);
  assert.equal(attribute(element, 0, 'stroke-width'), '9');
  settle();
  setReduced(false);
  frames(3);
  assert.equal(queue.length, 1, 'motion resumes when the preference changes');
  hud.detach();
  settle();
});

test('detach undoes everything and can be called twice', () => {
  const element = host();
  const hud = mount(element, frameSpec);
  hud.detach();
  hud.detach();
  assert.equal(element.children.length, 0);
  assert.equal(element.style.position, '');
  assert.equal(element.style.properties.size, 0);
  for (const set of element.listeners.values()) assert.equal(set.size, 0);
  for (const observer of FakeObserver.all) assert.equal(observer.observed.has(element), false);
  // The handle is dead but harmless.
  hud.set('alert');
  hud.update({ outline: { width: 9 } });
  settle();
  assert.equal(element.children.length, 0);
});

test('a host that leaves the document takes its drawing with it', () => {
  const resting = host();
  mount(resting, frameSpec);
  settle();
  resting.isConnected = false;
  resize(resting, 0, 0);
  assert.equal(resting.children.length, 0);

  const moving = host(100, 100);
  mount(moving, spinning);
  frames(2);
  moving.isConnected = false;
  frames(2);
  assert.equal(moving.children.length, 0);
  settle();
});

test('elements that cannot hold a drawing get a handle that does nothing', () => {
  const image = host(100, 100, 'img');
  const hud = mount(image, frameSpec);
  hud.set('alert');
  hud.update({});
  hud.detach();
  assert.equal(image.children.length, 0);
  assert.equal(image.style.position, '');
});

/** Tells every mutation observer that watches `root` about a change under it. */
function mutated(root: FakeElement, change: Partial<FakeMutation> & { target: FakeElement }): void {
  for (const observer of FakeObserver.all) {
    if (observer instanceof FakeMutationObserver && observer.observed.has(root)) {
      observer.callback([{ type: 'childList', addedNodes: [], removedNodes: [], ...change }]);
    }
  }
}
function marked(name: string, state?: string): FakeElement {
  const element = host();
  element.setAttribute('data-hud', name);
  if (state !== undefined) element.setAttribute('data-hud-state', state);
  return element;
}
const specs = { panel: frameSpec, dial: spinning };
const observe = (root: FakeElement) => watch(specs, root as unknown as ParentNode);

test('watch draws on every element that asks by name and ignores unknown names', () => {
  const root = host();
  const panel = root.appendChild(marked('panel'));
  const nested = root.appendChild(host()).appendChild(marked('dial'));
  const unknown = root.appendChild(marked('no such thing'));
  const plain = root.appendChild(host());
  const watching = observe(root);
  assert.equal(svgOf(panel).length, 1);
  assert.equal(svgOf(nested).length, 1);
  assert.equal(svgOf(unknown).length, 0);
  assert.equal(svgOf(plain).length, 0);
  watching.stop();
  assert.equal(svgOf(panel).length + svgOf(nested).length, 0);
  settle();
});

test('watch follows the state attribute', () => {
  const root = host();
  const panel = root.appendChild(marked('panel', 'alert'));
  const watching = observe(root);
  settle();
  assert.equal(attribute(panel, 0, 'stroke-width'), '3');
  panel.removeAttribute('data-hud-state');
  mutated(root, { type: 'attributes', target: panel });
  settle();
  assert.equal(attribute(panel, 0, 'stroke-width'), '1');
  panel.setAttribute('data-hud-state', 'alert');
  mutated(root, { type: 'attributes', target: panel });
  settle();
  assert.equal(attribute(panel, 0, 'stroke-width'), '3');
  watching.stop();
});

test('watch follows elements and names that come, change and go', () => {
  const root = host();
  const watching = observe(root);
  const late = root.appendChild(marked('panel'));
  mutated(root, { target: root, addedNodes: [late] });
  assert.equal(svgOf(late).length, 1);
  assert.match(attribute(late, 0, 'd') ?? '', /^M106 2\.5/);

  late.setAttribute('data-hud', 'dial');
  mutated(root, { type: 'attributes', target: late });
  assert.equal(svgOf(late).length, 1);
  assert.match(attribute(late, 0, 'd') ?? '', /^M100 2A/);

  late.removeAttribute('data-hud');
  mutated(root, { type: 'attributes', target: late });
  assert.equal(svgOf(late).length, 0);

  const wrapper = root.appendChild(host());
  const inside = wrapper.appendChild(marked('panel'));
  mutated(root, { target: root, addedNodes: [wrapper] });
  assert.equal(svgOf(inside).length, 1);
  // Moved within the document: still connected, so it keeps its drawing.
  mutated(root, { target: root, removedNodes: [wrapper], addedNodes: [wrapper] });
  assert.equal(svgOf(inside).length, 1);
  // Gone for good.
  wrapper.isConnected = false;
  inside.isConnected = false;
  mutated(root, { target: root, removedNodes: [wrapper] });
  assert.equal(svgOf(inside).length, 0);
  watching.stop();
  settle();
});

test('a stopped watch no longer reacts', () => {
  const root = host();
  const watching = observe(root);
  watching.stop();
  const late = root.appendChild(marked('panel'));
  mutated(root, { target: root, addedNodes: [late] });
  assert.equal(svgOf(late).length, 0);
});
