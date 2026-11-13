// Writes gallery.html: every catalogue entry that can be rendered today,
// at several sizes, attached to plain elements. Self-contained: the library is inlined, so the
// file works opened straight from disk. For looking at, not for tests.
// Run with `npm run gallery`.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from './bundle.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const library = bundle(join(root, 'dist', 'index.js'), 'hudline');

// Preset name → what the gallery calls it.
const RINGS = {
  'ring-segmented': 'R1 · Segmented ring',
  'ring-scale': 'R2 · Scale ring',
  'ring-blocks': 'R3 · Irregular block ring',
  'arc-value': 'R4 · Value arc',
};
const FRAMES = {
  'frame-chamfered': 'F1 · Chamfered frame',
  'frame-tabbed': 'F2 · Tabbed frame',
  'frame-stepped': 'F3 · Stepped frame',
  'frame-double': 'F4 · Double frame',
  'frame-brackets': 'F5 · Corner brackets',
  'frame-hatched': 'F6 · Hatched edge strip',
};
const RING_SIZES = [48, 96, 200].map((size) => [size, size]);
const FRAME_SIZES = [
  [96, 44],
  [180, 90],
  [300, 150],
];

const cell = (id, [width, height], resizable = false) =>
  `<figure><div class="hud${resizable ? ' resizable' : ''}" data-hud="${id}" tabindex="0" style="width:${width}px;height:${height}px"></div>` +
  `<figcaption>${resizable ? 'drag the corner' : `${width} × ${height}`}</figcaption></figure>`;

const section = (names, sizes, resizable) =>
  Object.entries(names)
    .map(([id, name]) => {
      const cells = sizes.map((size) => cell(id, size)).join('') + (resizable ? cell(id, [240, 120], true) : '');
      return `<section><h2>${name} <code>${id}</code></h2><div class="row">${cells}</div></section>`;
    })
    .join('\n');

const inUse = `<section><h2>In use · content padded by the published insets, and a value kept up to date</h2><div class="row">
<div class="panel" data-hud="frame-tabbed"><strong>NAV-07</strong><span>The text keeps clear of the frame because its padding comes from the four inset properties the library sets on this element.</span></div>
<div class="panel" data-hud="frame-double"><strong>LINK</strong><span>Resize me by the corner. The padding follows.</span></div>
<figure><div class="hud" id="gauge" data-hud="arc-value" style="width:120px;height:120px"><output id="readout">70 %</output></div>
<figcaption><input id="level" type="range" min="0" max="100" value="70" aria-label="Level"></figcaption></figure>
</div></section>`;

const onCanvas = `<section><h2>On a canvas · the same presets drawn with <code class="plain">drawScene</code> in one 2D context</h2>
<canvas id="board" width="640" height="150" style="width:640px;height:150px;max-width:100%"></canvas></section>`;

const rows = `${inUse}\n${onCanvas}\n${section(FRAMES, FRAME_SIZES, true)}\n${section(RINGS, RING_SIZES, false)}`;

// The page script. Nothing here attaches anything by hand: the elements
// ask in markup and one watch draws on them. The canvas is the one
// place with a loop of its own, as a game would have.
const page = `
const { presets, watch, attach, createPlayer, drawScene } = hudline;

// The canvas: players with a clock of our own, drawn into one context.
const canvas = document.querySelector('#board');
const context = canvas.getContext('2d');
const ratio = window.devicePixelRatio || 1;
canvas.width = 640 * ratio;
canvas.height = 150 * ratio;
let started = performance.now();
const clock = () => (performance.now() - started) / 1000;
const placed = [
  ['frame-tabbed', 0, 20, 200, 110],
  ['ring-blocks', 225, 5, 140, 140],
  ['frame-hatched', 390, 20, 130, 110],
  ['ring-scale', 540, 25, 100, 100],
];
let board = [];
const deal = () => {
  started = performance.now();
  board = placed.map(([name, x, y, width, height]) => ({ x, y, player: createPlayer(presets[name], width, height) }));
};
deal();
const still = matchMedia('(prefers-reduced-motion: reduce)');
function drawBoard() {
  const time = clock();
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, 640, 150);
  const color = getComputedStyle(canvas).color;
  for (const { x, y, player } of board) drawScene(context, player.scene(time, still.matches), { x, y, color });
  requestAnimationFrame(drawBoard);
}
drawBoard();

let watching = watch(presets);
const asking = () => document.querySelectorAll('[data-hud]');

function setState(name) {
  for (const element of asking()) element.dataset.hudState = name;
  board.forEach(({ player }) => player.set(name, clock()));
  for (const button of document.querySelectorAll('[data-state]')) {
    button.setAttribute('aria-pressed', String(button.dataset.state === name));
  }
}
for (const button of document.querySelectorAll('[data-state]')) {
  button.addEventListener('click', () => setState(button.dataset.state));
}
document.querySelector('[data-replay]').addEventListener('click', () => {
  watching.stop();
  deal();
  setState('idle');
  watching = watch(presets);
});

// Attaching to an element that already has a drawing returns its handle.
const gauge = document.querySelector('#gauge');
const level = document.querySelector('#level');
const readout = document.querySelector('#readout');
level.addEventListener('input', () => {
  readout.textContent = level.value + ' %';
  attach(gauge, presets['arc-value']).update({ value: { value: level.value / 100 } });
});
`;

const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>hudline gallery</title>
<style>
  :root { color-scheme: light dark; --bg: #f4f6f8; --fg: #10202c; --muted: #5d6b76; --line: #c5ced6; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0a1017; --fg: #7fe3ff; --muted: #6a8494; --line: #1d3442; } }
  body { margin: 0; padding: 24px; background: var(--bg); color: var(--fg);
         font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  h1 { font-size: 15px; margin: 0 0 4px; }
  p { margin: 0 0 16px; color: var(--muted); max-width: 60ch; }
  h2 { font-size: 12px; font-weight: 400; margin: 0 0 12px; color: var(--muted); }
  h2 code { font: inherit; opacity: 0.7; margin-left: 8px; }
  h2 code:not(.plain)::before { content: 'data-hud="'; } h2 code:not(.plain)::after { content: '"'; }
  h2 code.plain { margin: 0; }
  section { margin-bottom: 32px; }
  .bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
  button { font: inherit; color: inherit; background: none; border: 1px solid var(--line);
           padding: 6px 12px; cursor: pointer; }
  button:hover { border-color: currentColor; }
  button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  button[aria-pressed="true"] { background: var(--fg); color: var(--bg); border-color: var(--fg); }
  .row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 32px; }
  figure { margin: 0; display: grid; justify-items: center; gap: 8px; }
  figcaption { color: var(--muted); font-size: 11px; }
  svg { display: block; }
  .hud { position: relative; }
  .hud:focus-visible { outline: 1px dashed var(--muted); outline-offset: 4px; }
  .panel { width: 260px; min-height: 110px; box-sizing: border-box; resize: both; overflow: hidden; display: grid; align-content: start; gap: 6px;
           padding: var(--hud-inset-top) var(--hud-inset-right) var(--hud-inset-bottom) var(--hud-inset-left); }
  .panel span { color: var(--muted); }
  #gauge { display: grid; place-items: center; }
  input[type=range] { width: 120px; accent-color: currentColor; }
  .hud.resizable { resize: both; overflow: hidden; min-width: 16px; min-height: 16px; max-width: 100%; }
</style>
<h1>hudline · catalogue</h1>
<p>Every shape here is a plain element that asks for a drawing in markup, with the attribute shown beside its name; one call to <code>watch(presets)</code> does the rest. Point at a shape to see its hover state. The buttons set <code>data-hud-state</code> on all of them. The last frame of each row can be resized by its bottom-right corner: details keep their pixel sizes and drop out when they no longer fit.</p>
<div class="bar">
  <button type="button" data-state="idle" aria-pressed="true">idle</button>
  <button type="button" data-state="hover" aria-pressed="false">hover</button>
  <button type="button" data-state="alert" aria-pressed="false">alert</button>
  <button type="button" data-replay>replay draw-on</button>
</div>
${rows}
<script>
${library}
${page}
</script>
</html>
`;

writeFileSync(join(root, 'gallery.html'), html);
console.log('gallery: wrote gallery.html');
