// Looks for jumps in motion. Every preset is played through its
// transitions, each frame is rasterised, and consecutive frames are
// compared. Smooth motion changes about as much from one frame to the
// next as it did the frame before; a frame that changes several times
// more than both its neighbours is reported.
//
// This is a development aid, not part of `npm run check`: it needs
// `rsvg-convert` (librsvg) on the PATH, a rasteriser that antialiases
// stroke widths properly. One that snaps them to whole pixels reports
// every slow change of width as a row of jumps. Run with `npm run motion`.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { createPlayer, presets } from '../dist/index.js';

const FPS = 30;
const SCALE = 3; // Rasterise magnified, so that sub-pixel artefacts count.
const SIZES = { ring: [[48, 48], [120, 120]], arc: [[48, 48], [120, 120]], frame: [[96, 44], [240, 110]] };
// What happens when, in seconds. Each change is followed long enough to settle.
const SCRIPT = [
  [1.6, 'hover'],
  [2.3, 'idle'],
  [3.0, 'alert'],
  [3.7, 'idle'],
];
const END = 4.4;

const folder = mkdtempSync(join(tmpdir(), 'hudline-motion-'));
const file = join(folder, 'frame.svg');

function raster(markup, width, height) {
  writeFileSync(
    file,
    markup
      .replace('<svg ', '<svg color="#fff" ')
      .replace(`width="${width}" height="${height}"`, `width="${width * SCALE}" height="${height * SCALE}"`),
  );
  return decodePng(execFileSync('rsvg-convert', ['-b', 'black', file], { maxBuffer: 64 * 1024 * 1024 }));
}

/**
 * The red channel of an 8-bit, non-interlaced PNG, which is all a white
 * drawing on black needs.
 */
function decodePng(png) {
  let at = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const data = [];
  while (at < png.length) {
    const length = png.readUInt32BE(at);
    const type = png.toString('latin1', at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[body[9]];
      if (body[8] !== 8 || channels === undefined || body[12] !== 0) throw new Error('unexpected PNG format');
    } else if (type === 'IDAT') {
      data.push(body);
    }
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height);
  let above = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? line[x - channels] : 0;
      const up = above[x];
      const upLeft = x >= channels ? above[x - channels] : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      line[x] = (line[x] + predicted) & 255;
    }
    for (let x = 0; x < width; x++) pixels[y * width + x] = line[x * channels];
    above = line;
  }
  return pixels;
}

function difference(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / 255;
}

const findings = [];
let frames = 0;
try {
  for (const [name, spec] of Object.entries(presets)) {
    for (const [width, height] of SIZES[name.split('-')[0]]) {
      const player = createPlayer(spec, width, height);
      const changes = [];
      let previous;
      let step = 0;
      for (let i = 0; i <= END * FPS; i++) {
        const time = i / FPS;
        while (step < SCRIPT.length && SCRIPT[step][0] <= time) player.set(SCRIPT[step++][1], time);
        const image = raster(player.markup(time), width, height);
        frames++;
        if (previous !== undefined) changes.push({ time, amount: difference(previous, image) });
        previous = image;
      }
      // A jump: far more change than on either side, and more than a
      // few pixels' worth, so that rounding noise is not reported.
      const floor = 4 * SCALE * SCALE;
      for (let i = 1; i < changes.length - 1; i++) {
        const { time, amount } = changes[i];
        const around = Math.max(changes[i - 1].amount, changes[i + 1].amount);
        // The frame on which a state changes may differ a lot by design
        // (motion switches at once); it is not a jump.
        const scripted = SCRIPT.some(([at]) => time - at >= 0 && time - at < 1.5 / FPS);
        if (!scripted && amount > floor && amount > around * 4) {
          findings.push(`${name} ${width}×${height} at ${time.toFixed(2)} s: ${amount.toFixed(0)} px against ${around.toFixed(0)} around it`);
        }
      }
    }
  }
} finally {
  rmSync(folder, { recursive: true, force: true });
}

console.log(`motion: ${frames} frames of ${Object.keys(presets).length} presets compared`);
if (findings.length > 0) {
  console.log(`motion: ${findings.length} possible jump(s)\n` + findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log('motion: no jumps found');
}
