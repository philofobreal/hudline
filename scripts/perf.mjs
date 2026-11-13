// Writes perf.html: fifty attached drawings on one page, with a timer
// around every animation frame the library runs. Open it in a browser;
// after a few seconds it reports how long the library's script work took
// per frame. Run with `npm run perf`.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from './bundle.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const library = bundle(join(root, 'dist', 'index.js'), 'hudline');

const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>hudline · 50 drawings</title>
<style>
  body { margin: 16px; background: #0a1017; color: #7fe3ff; font: 13px ui-monospace, Menlo, Consolas, monospace; }
  #grid { display: grid; grid-template-columns: repeat(10, 120px); gap: 12px; margin-top: 16px; }
  #grid > div { height: 90px; }
</style>
<pre id="result">measuring…</pre>
<div id="grid"></div>
<script>
// Time every animation-frame callback. Installed before the library, so
// the library's one loop is what gets measured.
const samples = [];
const native = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = (callback) =>
  native((stamp) => {
    const before = performance.now();
    callback(stamp);
    samples.push(performance.now() - before);
  });
${library}
const ids = Object.keys(hudline.presets);
const grid = document.querySelector('#grid');
const huds = [];
for (let i = 0; i < 50; i++) {
  const host = grid.appendChild(document.createElement('div'));
  huds.push(hudline.attach(host, hudline.presets[ids[i % ids.length]]));
}
// Everything in its busiest state: travelling and flickering.
setTimeout(() => huds.forEach((hud) => hud.set('alert')), 1200);
setTimeout(() => {
  const busy = samples.slice(Math.floor(samples.length / 3)).sort((a, b) => a - b);
  const at = (share) => busy[Math.min(busy.length - 1, Math.floor(busy.length * share))].toFixed(2);
  const text = 'PERF frames=' + busy.length + ' median=' + at(0.5) + 'ms p95=' + at(0.95) + 'ms max=' + at(1) + 'ms';
  document.querySelector('#result').textContent = text + ' (script time per frame, 50 drawings, alert state)';
  console.log(text);
}, 5000);
</script>
</html>
`;

writeFileSync(join(root, 'perf.html'), html);
console.log('perf: wrote perf.html');
