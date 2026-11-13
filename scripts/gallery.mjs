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

const RINGS = { R1: 'Segmented ring', R2: 'Scale ring', R3: 'Irregular block ring', R4: 'Value arc' };
const FRAMES = {
  F1: 'Chamfered frame',
  F2: 'Tabbed frame',
  F3: 'Stepped frame',
  F4: 'Double frame',
  F5: 'Corner brackets',
  F6: 'Hatched edge strip',
};
const RING_SIZES = [48, 96, 200].map((size) => [size, size]);
const FRAME_SIZES = [
  [96, 44],
  [180, 90],
  [300, 150],
];

const cell = (id, [width, height], resizable = false) =>
  `<figure><div class="hud${resizable ? ' resizable' : ''}" data-id="${id}" tabindex="0" style="width:${width}px;height:${height}px"></div>` +
  `<figcaption>${resizable ? 'drag the corner' : `${width} × ${height}`}</figcaption></figure>`;

const section = (names, sizes, resizable) =>
  Object.entries(names)
    .map(([id, name]) => {
      const cells = sizes.map((size) => cell(id, size)).join('') + (resizable ? cell(id, [240, 120], true) : '');
      return `<section><h2>${id} · ${name}</h2><div class="row">${cells}</div></section>`;
    })
    .join('\n');

const inUse = `<section><h2>In use · content padded by the published insets, and a value kept up to date</h2><div class="row">
<div class="panel" data-id="F2"><strong>NAV-07</strong><span>The text keeps clear of the frame because its padding comes from the four inset properties the library sets on this element.</span></div>
<div class="panel" data-id="F4"><strong>LINK</strong><span>Resize me by the corner. The padding follows.</span></div>
<figure><div class="hud" id="gauge" data-id="R4" style="width:120px;height:120px"><output id="readout">70 %</output></div>
<figcaption><input id="level" type="range" min="0" max="100" value="70" aria-label="Level"></figcaption></figure>
</div></section>`;

const rows = `${inUse}\n${section(FRAMES, FRAME_SIZES, true)}\n${section(RINGS, RING_SIZES, false)}`;

// The page script. Everything on the page is attached with the library's
// own DOM binding; hovering a shape enters its hover state by itself.
const page = `
const hosts = [...document.querySelectorAll('[data-id]')];
const huds = new Map();
const attachAll = () => hosts.forEach((host) => huds.set(host, hudline.attach(host, hudline.catalog[host.dataset.id])));

function setState(name) {
  for (const hud of huds.values()) hud.set(name);
  for (const button of document.querySelectorAll('[data-state]')) {
    button.setAttribute('aria-pressed', String(button.dataset.state === name));
  }
}
for (const button of document.querySelectorAll('[data-state]')) {
  button.addEventListener('click', () => setState(button.dataset.state));
}
document.querySelector('[data-replay]').addEventListener('click', () => {
  for (const hud of huds.values()) hud.detach();
  attachAll();
  setState('idle');
});

const gauge = document.querySelector('#gauge');
const level = document.querySelector('#level');
const readout = document.querySelector('#readout');
level.addEventListener('input', () => {
  readout.textContent = level.value + ' %';
  huds.get(gauge).update({ value: { value: level.value / 100 } });
});

attachAll();
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
<p>Milestone M4: every shape here is attached to a plain element with the library's DOM binding. Point at a shape to see its hover state. The buttons put all of them into a state. The last frame of each row can be resized by its bottom-right corner: details keep their pixel sizes and drop out when they no longer fit.</p>
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
