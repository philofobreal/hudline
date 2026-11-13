// Writes gallery.html: every catalogue entry that can be rendered today,
// at several sizes, playing. Self-contained: the library is inlined, so the
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
};
const RING_SIZES = [48, 96, 200].map((size) => [size, size]);
const FRAME_SIZES = [
  [96, 44],
  [180, 90],
  [300, 150],
];

const cell = (id, [width, height], resizable = false) =>
  `<figure><div class="hud${resizable ? ' resizable' : ''}" data-id="${id}" style="width:${width}px;height:${height}px"></div>` +
  `<figcaption>${resizable ? 'drag the corner' : `${width} × ${height}`}</figcaption></figure>`;

const section = (names, sizes, resizable) =>
  Object.entries(names)
    .map(([id, name]) => {
      const cells = sizes.map((size) => cell(id, size)).join('') + (resizable ? cell(id, [240, 120], true) : '');
      return `<section><h2>${id} · ${name}</h2><div class="row">${cells}</div></section>`;
    })
    .join('\n');

const rows = `${section(FRAMES, FRAME_SIZES, true)}\n${section(RINGS, RING_SIZES, false)}`;

// The page script: a plain demo loop that asks each player for markup
// once per frame. The library's own DOM binding (milestone M4) will
// update attributes in place instead of replacing markup.
const page = `
const players = [];
let started = performance.now();
const now = () => (performance.now() - started) / 1000;
const sizeOf = (host) => [host.clientWidth, host.clientHeight];

function build() {
  players.length = 0;
  started = performance.now();
  for (const host of document.querySelectorAll('.hud')) {
    const [width, height] = sizeOf(host);
    players.push({ host, player: hudline.createPlayer(hudline.catalog[host.dataset.id], width, height) });
  }
}

function setState(name) {
  const time = now();
  for (const { player } of players) player.set(name, time);
  for (const button of document.querySelectorAll('[data-state]')) {
    button.setAttribute('aria-pressed', String(button.dataset.state === name));
  }
}

for (const button of document.querySelectorAll('[data-state]')) {
  button.addEventListener('click', () => setState(button.dataset.state));
}
document.querySelector('[data-replay]').addEventListener('click', () => { build(); setState('idle'); });

// The resizable hosts tell their player about every new size.
const resizes = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const found = players.find(({ host }) => host === entry.target);
    if (found) found.player.resize(...sizeOf(entry.target));
  }
  if (still.matches) draw();
});
for (const host of document.querySelectorAll('.hud.resizable')) resizes.observe(host);

const still = matchMedia('(prefers-reduced-motion: reduce)');
function draw() {
  // With reduced motion everything is shown settled and at rest.
  const time = still.matches ? 0 : now();
  for (const { host, player } of players) {
    host.innerHTML = still.matches
      ? hudline.renderToString(hudline.catalog[host.dataset.id], ...sizeOf(host))
      : player.markup(time);
  }
  if (!still.matches) requestAnimationFrame(draw);
}
still.addEventListener('change', draw);

build();
draw();
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
  .hud.resizable { resize: both; overflow: hidden; min-width: 16px; min-height: 16px; max-width: 100%; }
</style>
<h1>hudline · catalogue</h1>
<p>Milestone M3: frames join the rings. Everything draws on when the page opens. The buttons put every shape into a state; each reacts in its own way. The last frame of each row can be resized by its bottom-right corner: details keep their pixel sizes and drop out when they no longer fit.</p>
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
