# hudline

Dependency-free TypeScript library for animated, monochrome HUD-style frames and rings on existing DOM elements.

**Status:** early. Rings and arcs render and animate through a headless player. No frames and no DOM binding yet: `attach` is not implemented. See `docs/ROADMAP.md`.

## Idea

Every shape is a **track** (lines and circular arcs), one or more **bands** along it, and a dash **pattern** on each band. Animating a shape means driving the pattern's phase and proportions, so motion always follows the outline, on straight edges, corners and circles alike.

What works today, and what is planned:

```ts
import { createPlayer, renderToString, type HudSpec } from 'hudline';

const spec: HudSpec = {
  shape: { kind: 'ring', inset: 2 },
  bands: [
    { width: 1 },
    { offset: 5, width: 8, pattern: { kind: 'segments', count: 12, gap: 4 }, motion: { spin: 20 } },
    { offset: 17, width: 5, pattern: { kind: 'ticks', count: 60 } },
  ],
};

// Works today: a standalone SVG at rest, coloured by CSS `color`.
const svg = renderToString(spec, 200, 200);

// Works today: play it yourself; you supply the time in seconds.
const player = createPlayer(spec, 200, 200);
element.innerHTML = player.markup(performance.now() / 1000);

// Planned for milestone M4:
// const hud = attach(element, spec);
// hud.set('alert');
// hud.detach();
```

## Development

```
npm install
npm run check
npm run gallery   # writes a self-contained, animated gallery.html
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
