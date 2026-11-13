# hudline

Dependency-free TypeScript library for animated, monochrome HUD-style frames and rings on existing DOM elements.

**Status:** seed. The project structure, governance and two small core functions exist; `attach` is not implemented yet. See `docs/ROADMAP.md`.

## Idea

Every shape is a **track** (lines and circular arcs), one or more **bands** along it, and a dash **pattern** on each band. Animating a shape means driving the pattern's phase and proportions, so motion always follows the outline, on straight edges, corners and circles alike.

Planned usage:

```ts
import { attach, ring, segments, ticks } from 'hudline';

const hud = attach(element, ring({
  bands: [
    { at: 0,  width: 1 },
    { at: 6,  width: 8, pattern: segments(12, { gap: 4 }), spin: 20 },
    { at: 26, width: 6, pattern: ticks(60, { major: 5 }) },
  ],
}));

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
- [docs/CATALOG.md](./docs/CATALOG.md) — the primitive catalogue (draft)
- [docs/GLOSSARY.md](./docs/GLOSSARY.md) — vocabulary

## Licence

Not chosen yet. Until the maintainer adds a licence, all rights are reserved.
