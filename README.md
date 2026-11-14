# hudline

Dependency-free TypeScript library for animated, monochrome HUD-style frames and rings on existing DOM elements.

**Status:** early, and usable: frames, rings and arcs attach to existing elements, follow their size and react to pointer, focus and state changes, and the same drawings can be put on a 2D canvas. Tried in Chrome only. See `docs/ROADMAP.md`.

## Idea

Every shape is a **track** (lines and circular arcs), one or more **bands** along it, and a dash **pattern** on each band. Animating a shape means driving the pattern's phase and proportions, so motion always follows the outline, on straight edges, corners and circles alike.

The quickest way is to ask in markup and let one call do the rest:

```html
<section data-hud="frame-tabbed">…</section>
<button data-hud="frame-chamfered">Launch</button>
<div data-hud="ring-scale" data-hud-state="alert"></div>
```

```ts
import { presets, watch } from 'hudline';

watch(presets);   // draws on every element that asks, now and as the page changes
```

Thirteen presets come with the library: frames, rings, an arc and lines; `docs/CATALOG.md` lists them. They are plain data, so your own specs sit beside them:

```ts
import { attach, presets, watch, type HudSpec } from 'hudline';

const panel: HudSpec = {
  shape: { kind: 'frame', corners: { tl: { kind: 'chamfer', size: 12 } } },
  bands: [
    { id: 'outline', width: 1 },
    { id: 'strip', offset: 4, width: 6, pattern: { kind: 'dashes', dash: 18, gap: 42 },
      fill: { kind: 'hatch', drift: 10 }, motion: { drift: 40 } },
  ],
  states: {
    hover: { bands: { outline: { width: 2 } } },
  },
};

watch({ ...presets, panel });        // data-hud="panel" now works too

const hud = attach(element, panel);  // or attach by hand: draws at once, follows the element's size
hud.set('alert');                    // any state the spec defines
hud.update({ strip: { width: 9 } }); // a lasting change, by band id
hud.detach();
```

The drawing takes its colour from the element's CSS `color`, never changes the element's layout, and publishes the room content needs as `--hud-inset-top`, `-right`, `-bottom` and `-left`:

```css
.panel { padding: var(--hud-inset-top) var(--hud-inset-right) var(--hud-inset-bottom) var(--hud-inset-left); }
```

On a canvas, in a game or a visualisation with a loop of its own, a player does the thinking and `drawScene` the drawing:

```ts
import { createPlayer, drawScene, presets } from 'hudline';

const player = createPlayer(presets['ring-blocks'], 140, 140);

function frame(now: number) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawScene(context, player.scene(now / 1000), { x: 20, y: 20, color: '#7fe3ff' });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

player.set('alert', performance.now() / 1000);   // states and sizes are yours to drive
```

Both renderers draw the same scene; in Chrome they agree pixel for pixel within antialiasing. Without any DOM, `renderToString(spec, width, height)` gives a still SVG.

## Development

```
npm install
npm run check
npm run gallery   # writes a self-contained, animated gallery.html
npm run perf      # writes perf.html: 50 drawings with a frame timer
npm run selftest  # writes selftest.html: checks the DOM binding and canvas parity in a real browser
npm run motion    # looks for jumps in every preset's transitions (needs rsvg-convert)
```

Requires Node 22 or newer.

## Documents

- [AGENTS.md](./AGENTS.md) — rules for AI agents and the working agreement
- [docs/VISION.md](./docs/VISION.md) — scope and non-goals
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — visual model and modules
- [docs/DESIGN_PRINCIPLES.md](./docs/DESIGN_PRINCIPLES.md) — code design rules
- [docs/ROADMAP.md](./docs/ROADMAP.md) — milestones and acceptance criteria
- [docs/DECISIONS.md](./docs/DECISIONS.md) — decision log
- [docs/CATALOG.md](./docs/CATALOG.md) — the primitive catalogue
- [docs/GLOSSARY.md](./docs/GLOSSARY.md) — vocabulary

## Licence

[MIT](./LICENSE)
