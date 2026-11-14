// Writes reference.html: an attempt to rebuild the circle and rectangle
// forms of the maintainer's black-and-white reference image from
// configuration alone. Every drawing on the page comes from
// examples/reference/hud.json; the page only places plain elements and
// lets `watch` draw on them. Run with `npm run reference`.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from './bundle.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const library = bundle(join(root, 'dist', 'index.js'), 'hudline');
const config = readFileSync(join(root, 'examples', 'reference', 'hud.json'), 'utf8');

const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>hudline · reference forms from configuration</title>
<style>
  body { margin: 0; padding: 28px; background: #fff; color: #111;
         font: 11px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  h1 { font-size: 14px; margin: 0 0 4px; }
  p { margin: 0 0 20px; color: #666; max-width: 70ch; }
  .board { position: relative; width: 760px; height: 330px; }
  .board > *, .panel > * { position: absolute; }
  .panel { height: 84px; }
  .label { color: #666; letter-spacing: 0.2em; text-transform: uppercase; font-size: 9px; }
</style>
<h1>Reference forms, from configuration</h1>
<p>Every shape below is a plain element with a <code>data-hud</code> attribute; the drawings come from one JSON file. Point at a shape for its hover state. What the reference has and this does not: waveforms, bars of differing height, perspective and its lettering.</p>
<div class="board">
  <div data-hud="dial" style="left:0;top:0;width:150px;height:150px"></div>

  <div class="panel" data-hud="panel-right" style="left:190px;top:14px;width:430px">
    <div data-hud="window" style="left:12px;top:9px;width:300px;height:36px"></div>
    <div class="label" style="left:14px;top:49px">data 4/12 565. 32 540</div>
    <div data-hud="barcode" style="left:12px;top:58px;width:320px;height:20px"></div>
  </div>
  <div data-hud="lead" style="left:612px;top:70px;width:148px;height:30px"></div>

  <div data-hud="envelope" style="left:330px;top:146px;width:330px;height:50px"></div>
  <div class="label" style="left:520px;top:140px">experience envelope</div>
  <div class="panel" data-hud="panel-left" style="left:230px;top:210px;width:440px">
    <div data-hud="bars" style="left:104px;top:8px;width:324px;height:46px"></div>
    <div class="label" style="left:106px;top:62px">adsr dkm 025 23. 32 540</div>
  </div>
  <div data-hud="lead" style="left:60px;top:262px;width:178px;height:30px;transform:scaleX(-1)"></div>
</div>
<script>
${library}
hudline.watch(${config});
</script>
</html>
`;

writeFileSync(join(root, 'reference.html'), html);
console.log('reference: wrote reference.html');
