// Writes selftest.html: the DOM binding exercised in a real browser with
// real events, real observers and real layout. The unit tests run against
// a stand-in DOM; this page is the check that the stand-in tells the
// truth. Open it in a browser and read the list, or run it headless and
// read the console. Run with `npm run selftest`.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from './bundle.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const library = bundle(join(root, 'dist', 'index.js'), 'hudline');

const page = `
const { attach, presets, watch, createPlayer, drawScene } = hudline;
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail: String(detail) });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const frames = (count) => new Promise((resolve) => {
  const step = () => (count-- > 0 ? requestAnimationFrame(step) : resolve());
  step();
});
const stage = document.querySelector('#stage');
function host(width, height, extra = '') {
  const element = stage.appendChild(document.createElement('div'));
  element.style.cssText = 'width:' + width + 'px;height:' + height + 'px;' + extra;
  return element;
}
const paths = (element) => [...element.querySelectorAll(':scope > svg > path')];
const shown = (path) => path.getAttribute('display') !== 'none';
/** Counts attribute writes to an element's drawing over a stretch of time. */
async function writesDuring(element, ms) {
  let count = 0;
  const observer = new MutationObserver((records) => (count += records.length));
  observer.observe(element, { attributes: true, subtree: true });
  await wait(ms);
  observer.disconnect();
  return count;
}

async function run() {
  // 1. Attaching.
  const frame = host(200, 100);
  const hud = attach(frame, presets['frame-double']);
  check('draws at once as one svg child', frame.children.length === 1 && frame.firstElementChild.localName === 'svg');
  check('a static host becomes relative', getComputedStyle(frame).position === 'relative');
  check('the svg covers the host and lets the pointer through', (() => {
    const box = frame.firstElementChild.getBoundingClientRect();
    return box.width === 200 && box.height === 100 && getComputedStyle(frame.firstElementChild).pointerEvents === 'none';
  })());
  check('insets are published', frame.style.getPropertyValue('--hud-inset-top').endsWith('px'), frame.style.getPropertyValue('--hud-inset-top'));
  check('attaching again keeps one drawing and one handle', attach(frame, presets['frame-double']) === hud && frame.querySelectorAll('svg').length === 1);

  // 2. Draw-on runs and ends.
  await wait(2200);
  check('the loop stops once the draw-on has settled', (await writesDuring(frame, 300)) === 0);

  // 3. Real pointer events.
  const accents = () => paths(frame)[2].getAttribute('stroke-width');
  check('idle accent width', accents() === '3', accents());
  frame.dispatchEvent(new PointerEvent('pointerenter'));
  await wait(900);
  check('pointerenter enters hover', accents() === '5', accents());
  frame.dispatchEvent(new PointerEvent('pointerleave'));
  await wait(900);
  check('pointerleave returns to idle', accents() === '3', accents());

  // 4. A requested state holds against the pointer.
  hud.set('alert');
  frame.dispatchEvent(new PointerEvent('pointerenter'));
  await wait(900);
  check('alert is shown and keeps flickering', (await writesDuring(frame, 300)) > 0);
  hud.set('idle');
  frame.dispatchEvent(new PointerEvent('pointerleave'));
  await wait(900);

  // 5. Real resizing through the ResizeObserver.
  const before = paths(frame)[0].getAttribute('d');
  frame.style.width = '320px';
  await frames(4);
  const after = paths(frame)[0].getAttribute('d');
  // Inset 1 and a band 1 wide: the centreline runs 1.5 inside the right edge.
  check('the outline follows the host size', after !== before && after.includes('318.5'), after);

  // 6. Details drop out and come back with room to spare.
  const tabbed = host(260, 90);
  attach(tabbed, presets['frame-tabbed']);
  await wait(2200);
  const fill = () => shown(paths(tabbed)[1]);
  check('the tab is filled when it fits', fill());
  tabbed.style.width = '120px';
  await frames(4);
  check('the fill goes when the tab no longer fits', !fill());
  tabbed.style.width = '260px';
  await frames(4);
  check('the fill comes back', fill());

  // 7. A band asked to grow past what a small ring holds stays visible.
  const small = host(48, 48);
  const smallHud = attach(small, presets['ring-segmented']);
  await wait(2200);
  small.dispatchEvent(new PointerEvent('pointerenter'));
  await wait(900);
  const segments = paths(small)[1];
  check('hover on the smallest ring keeps its segments', shown(segments) && Number(segments.getAttribute('stroke-width')) > 8, segments.getAttribute('stroke-width'));
  small.dispatchEvent(new PointerEvent('pointerleave'));
  smallHud.detach();

  // 8. Focus, on a spec that defines it.
  const button = stage.appendChild(document.createElement('button'));
  button.textContent = 'focus me';
  button.style.cssText = 'width:140px;height:40px;background:none;color:inherit;border:0';
  attach(button, {
    shape: { kind: 'frame', corners: { kind: 'chamfer', size: 6 } },
    bands: [{ id: 'line', width: 1 }],
    states: { focus: { bands: { line: { width: 3 } }, settle: 0.1 }, active: { bands: { line: { width: 5 } }, settle: 0.1 } },
    settle: 0.1,
  });
  const line = () => paths(button)[0].getAttribute('stroke-width');
  button.focus();
  await wait(500);
  check('focus enters the focus state', line() === '3', line());
  button.dispatchEvent(new PointerEvent('pointerdown'));
  await wait(500);
  check('pointerdown enters active over focus', line() === '5', line());
  button.dispatchEvent(new PointerEvent('pointerup'));
  button.blur();
  await wait(500);
  check('blur returns to idle', line() === '1', line());
  check('the button still works as a button', button.textContent === 'focus me' && button.querySelector('svg') !== null);

  // 9. A value kept up to date.
  const gauge = host(120, 120);
  const gaugeHud = attach(gauge, presets['arc-value']);
  await wait(2200);
  const partial = paths(gauge)[1].getAttribute('d');
  gaugeHud.update({ value: { value: 1 } });
  await wait(900);
  const full = paths(gauge)[1].getAttribute('d');
  // A full 270° arc from lower left ends at lower right.
  check('update moves the value', full !== partial && full.endsWith('97.477 97.477'), partial + ' -> ' + full);

  // 10. Out of sight, nothing is written.
  const far = host(100, 100, 'margin-top:3000px');
  attach(far, presets['ring-blocks']);
  await wait(600);
  check('a spinning ring out of view writes nothing', (await writesDuring(far, 400)) === 0);
  far.scrollIntoView();
  await wait(300);
  check('and animates once it is in view', (await writesDuring(far, 400)) > 0);
  // A drawing that was never seen has its draw-on ahead of it.
  const unseen = host(100, 100, 'margin-top:3000px');
  attach(unseen, presets['ring-scale']);
  await wait(2500);
  unseen.scrollIntoView();
  await frames(4);
  const outline = paths(unseen)[0];
  check('a drawing scrolled to for the first time is still drawing on', outline.getAttribute('d').split('A').length <= 2, outline.getAttribute('d'));
  await wait(2200);
  check('and finishes once in view', outline.getAttribute('d').split('A').length === 3, outline.getAttribute('d'));
  unseen.remove();
  window.scrollTo(0, 0);

  // 11. Leaving.
  far.remove();
  await wait(300);
  check('a host removed from the document loses its drawing', far.querySelector('svg') === null);
  hud.detach();
  check('detach removes the svg', frame.querySelector('svg') === null);
  check('detach restores position and insets', frame.style.position === '' && frame.style.getPropertyValue('--hud-inset-top') === '');
  hud.detach();
  hud.set('alert');

  // 12. Hatch and part-by-part bands, as a browser sees them.
  const hatched = host(240, 100);
  attach(hatched, presets['frame-hatched']);
  await wait(2200);
  const pattern = hatched.querySelector('svg > defs > pattern');
  const strip = paths(hatched)[1];
  check('a hatched band is painted with its own pattern', pattern !== null && strip.getAttribute('stroke') === 'url(#' + pattern.id + ')');
  check('the stripes take the host colour', pattern !== null && getComputedStyle(pattern.firstElementChild).fill === getComputedStyle(hatched).color, pattern && getComputedStyle(pattern.firstElementChild).fill);
  const moved = pattern.getAttribute('patternTransform');
  await wait(400);
  check('the stripes move', pattern.getAttribute('patternTransform') !== moved);
  const stripLength = Number(strip.getAttribute('stroke-dasharray').split(' ')[0]);
  check('the strip is one stretch of the length the span asks for', stripLength > 55 && stripLength < 75, strip.getAttribute('stroke-dasharray'));

  const blocks = host(200, 200);
  attach(blocks, presets['ring-blocks']);
  await wait(2200);
  const drawn = paths(blocks).filter(shown);
  const levels = new Set(drawn.map((path) => path.getAttribute('opacity')));
  check('a band drawn part by part has many elements with differing brightness', drawn.length > 8 && levels.size > 3, drawn.length + ' paths, ' + levels.size + ' levels');

  // 13. Asking in markup.
  const zone = stage.appendChild(document.createElement('div'));
  zone.innerHTML = '<div data-hud="frame-double" style="width:160px;height:80px"></div><div data-hud="nothing by that name" style="width:40px;height:40px"></div>';
  const [asked, unknown] = zone.children;
  const watching = watch(presets, zone);
  check('watch draws on an element that asks by name', asked.querySelector('svg') !== null);
  check('and leaves an unknown name alone', unknown.querySelector('svg') === null);
  const late = zone.appendChild(document.createElement('div'));
  late.style.cssText = 'width:80px;height:80px';
  late.dataset.hud = 'ring-segmented';
  await frames(3);
  check('an element added later is drawn on', late.querySelector('svg') !== null);
  await wait(2200);
  asked.dataset.hudState = 'hover';
  await wait(900);
  check('the state attribute sets the state', paths(asked)[2].getAttribute('stroke-width') === '5', paths(asked)[2].getAttribute('stroke-width'));
  delete asked.dataset.hud;
  await frames(3);
  check('removing the attribute removes the drawing', asked.querySelector('svg') === null);
  watching.stop();
  check('stopping the watch removes what it drew', late.querySelector('svg') === null);

  // 14. Canvas draws what SVG draws.
  // The same scene is rendered both ways at 3× and compared pixel by
  // pixel. Edges are antialiased a little differently by the two
  // renderers, so a pixel counts as different only if it is far off,
  // and the share of such pixels among the drawn ones has to be small.
  async function parity(name, width, height, time) {
    const scale = 3;
    const player = createPlayer(presets[name], width, height);
    const markup = player.markup(time)
      .replace('<svg ', '<svg color="#ffffff" ')
      .replace('width="' + width + '" height="' + height + '"', 'width="' + width * scale + '" height="' + height * scale + '"');
    const image = new Image();
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
    await image.decode();
    const make = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      return canvas.getContext('2d', { willReadFrequently: true });
    };
    const fromSvg = make();
    fromSvg.drawImage(image, 0, 0);
    const fromCanvas = make();
    fromCanvas.scale(scale, scale);
    drawScene(fromCanvas, player.scene(time), { color: '#ffffff' });
    const a = fromSvg.getImageData(0, 0, width * scale, height * scale).data;
    const b = fromCanvas.getImageData(0, 0, width * scale, height * scale).data;
    let drawn = 0;
    let off = 0;
    for (let i = 3; i < a.length; i += 4) {
      if (a[i] > 40 || b[i] > 40) drawn++;
      if (Math.abs(a[i] - b[i]) > 96) off++;
    }
    return { drawn, share: drawn === 0 ? 1 : off / drawn };
  }
  for (const [name, width, height] of [
    ['ring-segmented', 120, 120], ['ring-scale', 120, 120], ['ring-blocks', 160, 160], ['arc-value', 120, 120],
    ['frame-chamfered', 240, 110], ['frame-tabbed', 240, 110], ['frame-stepped', 240, 110],
    ['frame-double', 240, 110], ['frame-brackets', 240, 110], ['frame-hatched', 240, 110],
    ['ring-gear', 120, 120], ['line-divider', 260, 28], ['line-callout', 260, 30],
    ['ring-scale', 48, 48], ['frame-tabbed', 96, 44],
  ]) {
    // Late enough for the draw-on to be over, at a moment when things are mid-travel.
    const { drawn, share } = await parity(name, width, height, 3.37);
    check('canvas matches svg: ' + name + ' ' + width + '×' + height, drawn > 200 && share < 0.02, (share * 100).toFixed(2) + ' % of ' + drawn + ' drawn pixels differ');
    console.log('SELFTEST PARITY ' + name + ' ' + width + '×' + height + ': ' + (share * 100).toFixed(2) + ' % of ' + drawn + ' drawn pixels differ');
  }
  {
    const dots = { shape: { kind: 'ring' }, bands: [{ width: 5, pattern: { kind: 'dots', count: 12 } }] };
    const player = createPlayer(dots, 100, 100);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 100;
    const context = canvas.getContext('2d');
    drawScene(context, player.scene(0), { color: '#fff' });
    const data = context.getImageData(0, 0, 100, 100).data;
    let lit = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 128) lit++;
    // Twelve discs 5 wide cover about 12 × π × 2.5² ≈ 236 pixels.
    check('canvas draws dots as discs', lit > 150 && lit < 320, lit + ' lit pixels');
  }

  // 15. Elements that cannot hold a drawing.
  const image = stage.appendChild(document.createElement('img'));
  attach(image, presets['frame-chamfered']).set('alert');
  check('an img is left alone', image.children.length === 0 && image.style.position === '');
}

run()
  .catch((error) => check('the run itself', false, error && error.stack))
  .finally(() => {
    const failed = results.filter((result) => !result.ok);
    const summary = 'SELFTEST ' + (results.length - failed.length) + '/' + results.length + ' passed';
    document.querySelector('#summary').textContent = summary;
    document.querySelector('#list').innerHTML = results
      .map((result) => '<li class="' + (result.ok ? 'ok' : 'bad') + '">' + (result.ok ? 'ok   ' : 'FAIL ') + result.name + (result.ok ? '' : ' — ' + result.detail) + '</li>')
      .join('');
    console.log(summary);
    for (const result of failed) console.log('SELFTEST FAIL ' + result.name + ' :: ' + result.detail);
  });
`;

const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>hudline · browser self-test</title>
<style>
  body { margin: 16px; background: #0a1017; color: #7fe3ff; font: 13px/1.5 ui-monospace, Menlo, Consolas, monospace; }
  #stage { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; margin-top: 16px; }
  ul { list-style: none; padding: 0; white-space: pre; }
  .bad { color: #ff8a7a; }
</style>
<strong id="summary">running, about 35 seconds…</strong>
<ul id="list"></ul>
<div id="stage"></div>
<script>
${library}
${page}
</script>
</html>
`;

writeFileSync(join(root, 'selftest.html'), html);
console.log('selftest: wrote selftest.html');
