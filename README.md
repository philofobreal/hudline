# hudline

Dependency-free TypeScript library for animated, monochrome HUD-style frames and rings on existing DOM elements.

**Status:** early. The governance, the spec language (types) and the catalogue exist; no geometry or rendering yet, and `attach` is not implemented. See `docs/ROADMAP.md`.

## Idea

Every shape is a **track** (lines and circular arcs), one or more **bands** along it, and a dash **pattern** on each band. Animating a shape means driving the pattern's phase and proportions, so motion always follows the outline, on straight edges, corners and circles alike.

Planned usage (`attach` does not exist yet; the spec types do):

```ts
import { attach, type HudSpec } from 'hudline';

const spec: HudSpec = {
  shape: { kind: 'ring', inset: 2 },
  bands: [
    { width: 1 },
    { offset: 5, width: 8, pattern: { kind: 'segments', count: 12, gap: 4 }, motion: { spin: 20 } },
    { offset: 17, width: 5, pattern: { kind: 'ticks', count: 60 } },
  ],
};

const hud = attach(element, spec);
hud.set('alert');
hud.detach();
```

## Development

```
npm install
npm run check
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
