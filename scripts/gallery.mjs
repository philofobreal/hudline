// Writes gallery.html: every catalogue entry that can be rendered today,
// at three sizes, in both colour schemes. For looking at, not for tests.
// Run with `npm run gallery`.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalog, renderToString } from '../dist/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
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
      (size) => `<figure>${renderToString(catalog[id], size, size)}<figcaption>${size} px</figcaption></figure>`,
    ).join('');
    return `<section><h2>${id} · ${name}</h2><div class="row">${cells}</div></section>`;
  })
  .join('\n');

const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>hudline gallery</title>
<style>
  :root { color-scheme: light dark; --bg: #f4f6f8; --fg: #10202c; --muted: #5d6b76; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0a1017; --fg: #7fe3ff; --muted: #6a8494; } }
  body { margin: 0; padding: 24px; background: var(--bg); color: var(--fg);
         font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  h1 { font-size: 15px; margin: 0 0 4px; }
  p { margin: 0 0 24px; color: var(--muted); }
  h2 { font-size: 12px; font-weight: 400; margin: 0 0 12px; color: var(--muted); }
  section { margin-bottom: 32px; }
  .row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 32px; }
  figure { margin: 0; display: grid; justify-items: center; gap: 8px; }
  figcaption { color: var(--muted); font-size: 11px; }
  svg { display: block; }
</style>
<h1>hudline · catalogue rings at rest</h1>
<p>Static output of milestone M1. No motion yet; frames arrive in M3.</p>
${rows}
</html>
`;

writeFileSync(join(root, 'gallery.html'), html);
console.log('gallery: wrote gallery.html');
