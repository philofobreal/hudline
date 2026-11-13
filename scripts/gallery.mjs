// Writes gallery.html: every catalogue entry that can be rendered today,
// at three sizes, playing. Self-contained: the library is inlined, so the
// file works opened straight from disk. For looking at, not for tests.
// Run with `npm run gallery`.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from './bundle.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const library = bundle(join(root, 'dist', 'index.js'), 'hudline');

const SIZES = [48, 96, 200];
const NAMES = {
  R1: 'Segmented ring',
  R2: 'Scale ring',
  R3: 'Irregular block ring',
  R4: 'Value arc',
};

const rows = Object.entries(NAMES)
  .map(([id, name]) => {
    const cells = SIZES.map(
      (size) =>
        `<figure><div class="hud" data-id="${id}" data-size="${size}" style="width:${size}px;height:${size}px"></div><figcaption>${size} px</figcaption></figure>`,
    ).join('');
    return `<section><h2>${id} · ${name}</h2><div class="row">${cells}</div></section>`;
  })
  .join('\n');

// The page script: a plain demo loop that asks each player for markup
// once per frame. The library's own DOM binding (milestone M4) will
// update attributes in place instead of replacing markup.
const page = `
const players = [];
let started = performance.now();
const now = () => (performance.now() - started) / 1000;

function build() {
  players.length = 0;
  started = performance.now();
  for (const host of document.querySelectorAll('.hud')) {
    const size = Number(host.dataset.size);
    players.push({ host, player: hudline.createPlayer(hudline.catalog[host.dataset.id], size, size) });
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

const still = matchMedia('(prefers-reduced-motion: reduce)');
function draw() {
  // With reduced motion the rings are shown settled and at rest.
  const time = still.matches ? 0 : now();
  for (const { host, player } of players) {
    host.innerHTML = still.matches
      ? hudline.renderToString(hudline.catalog[host.dataset.id], Number(host.dataset.size), Number(host.dataset.size))
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
</style>
<h1>hudline · catalogue rings</h1>
<p>Milestone M2: motion and states. Every ring draws on when the page opens. The buttons put all rings into a state; each ring reacts in its own way. Frames arrive in M3.</p>
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
