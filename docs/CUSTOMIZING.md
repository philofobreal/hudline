# Making your own

A drawing is described by a spec, and a spec is plain data. There is no separate configuration format: the spec is the configuration. The presets are specs like any other.

Every example below is compiled and run by `src/catalog/customise.test.ts`. If this guide and that file disagree, the file is right.

## What a spec consists of

| Part | Says | Choices |
|---|---|---|
| `shape` | Which track the host gets | `frame`, `ring`, `arc`, `line` |
| `bands` | Strips along the track: `offset` from it, `width` | any number of them; drawn in order, later over earlier |
| `pattern` (per band) | Which stretches are drawn | `solid`, `dashes`, `segments`, `ticks`, `dots`, `blocks`, `intervals`, `spans` |
| `fill` (per band) | What they are drawn with | solid (default), `hatch` |
| `motion` (per band) | What moves | `drift`, `spin`, `flicker`, `breathe` |
| `states` | Named sets of changes to bands, by band `id` | `enter`, `hover`, `focus`, `active`, and any name of your own |

Lengths are CSS pixels, angles degrees (0 is up, clockwise), times seconds. A positive `offset` or step `depth` points toward the inside of the shape.

## 1. From scratch

```ts
import { attach, type HudSpec } from 'hudline';

const badge: HudSpec = {
  shape: {
    kind: 'frame',
    inset: 1,
    corners: { tl: { kind: 'chamfer', size: 8 }, br: { kind: 'fillet', radius: 8 } },
    edges: {
      bottom: [
        { kind: 'step', id: 'lip', from: { from: 'start', offset: 16 }, to: { from: 'start', offset: 64 }, depth: 4 },
      ],
    },
  },
  bands: [
    { id: 'outline', width: 1 },
    // A thick mark in the recess the step makes, outside the track.
    { id: 'lip', offset: -4, width: 3, pattern: { kind: 'spans', spans: [{ anchor: 'lip' }] } },
    { id: 'scan', offset: 4, width: 2, opacity: 0.5, pattern: { kind: 'dashes', dash: 6, gap: 10 }, motion: { drift: 30 } },
  ],
  states: {
    hover: { bands: { outline: { width: 2 }, scan: { opacity: 1, motion: { drift: 90 } } }, settle: 0.2 },
  },
};

attach(element, badge);
```

## 2. From a preset

Keep what you like and replace what you do not. A preset knows its own shape, so its shape can be spread too.

```ts
import { presets, type HudSpec } from 'hudline';

const base = presets['frame-tabbed'];
const widerTab: HudSpec = {
  ...base,
  shape: {
    ...base.shape,
    edges: {
      top: [{ kind: 'step', id: 'tab', from: { from: 'start', offset: 20 }, to: { from: 'start', offset: 140 }, depth: -8 }],
    },
  },
  settle: 0.15,
};
```

Bands are a list, so changing one means mapping the list. A small helper does it by `id`:

```ts
import { presets, type BandSpec, type HudSpec } from 'hudline';

const retune = (spec: HudSpec, id: string, change: Partial<BandSpec>): HudSpec => ({
  ...spec,
  bands: spec.bands.map((band) => (band.id === id ? { ...band, ...change } : band)),
});

const slowGear = retune(presets['ring-gear'], 'teeth', {
  pattern: { kind: 'segments', count: 8, gap: 14 },
  motion: { spin: 4 },
});
```

The band ids of each preset are in `src/catalog/index.ts`.

## 3. A family of your own

When you want the same design with different numbers, write a function from options to a spec.

```ts
import type { BandSpec, HudSpec } from 'hudline';

interface DialOptions { rings?: number; thickness?: number; gap?: number; speed?: number; seed?: number }

function dial({ rings = 3, thickness = 5, gap = 4, speed = 15, seed = 1 }: DialOptions = {}): HudSpec {
  const bands: BandSpec[] = [{ id: 'rim', width: 1 }];
  for (let i = 0; i < rings; i++) {
    bands.push({
      id: `ring${i}`,
      offset: 4 + i * (thickness + gap),
      width: thickness,
      pattern: { kind: 'blocks', seed: seed + i, min: 10, max: 50, gap: 5 },
      // Alternate directions; inner rings turn faster.
      motion: { spin: (i % 2 === 0 ? 1 : -1) * speed * (1 + i * 0.5) },
    });
  }
  return { shape: { kind: 'ring', inset: 2 }, bands, states: { hover: { bands: { rim: { width: 2 } } } } };
}

attach(element, dial({ rings: 4, thickness: 4, speed: 20, seed: 7 }));
```

## 4. From a configuration file

A spec has no functions in it, so JSON is a spec.

```json
{
  "status-rule": {
    "shape": { "kind": "line", "edge": "top", "inset": 2 },
    "bands": [
      { "id": "rule", "width": 1 },
      { "id": "marks", "offset": 4, "width": 4, "pattern": { "kind": "ticks", "count": 40 } }
    ]
  }
}
```

```ts
import { presets, watch, type HudSpec } from 'hudline';

const mine = (await (await fetch('/hud.json')).json()) as Record<string, HudSpec>;
watch({ ...presets, ...mine });   // <div data-hud="status-rule"> now works
```

Nothing checks the file. A value that makes no sense does not throw: the band or the detail it belongs to is simply not drawn. That keeps a page alive, and it also means a typing mistake shows up as something missing, not as an error. In TypeScript, `satisfies HudSpec` catches such mistakes before they run; for JSON, look at the result.

## 5. Varying a drawing that is already there

| To change | Use | Note |
|---|---|---|
| Colour | CSS `color` on the element | the drawing is `currentColor` |
| A state | `hud.set('alert')`, or `data-hud-state="alert"` | numbers glide, in the state's `settle` time |
| A number of a band, for good | `hud.update({ value: { value: 0.7 } })` | by band `id`; for progress and the like |
| Two elements with the same spec that should not look identical | `seed` in the spec | changes seeded blocks and flicker only |
| The shape, a pattern or a fill | `attach(element, newSpec)` | replaces the spec; the draw-on plays again |

## 6. Recipes from the reference image

`examples/reference/hud.json` rebuilds the circle and rectangle forms of the maintainer's black-and-white reference from configuration alone; `npm run reference` writes the page. What it uses:

| Form | How |
|---|---|
| A panel with one round end | A frame whose two corners on that side are fillets with a radius far larger than the box (`999`). Corners that ask for more than an edge has shrink together, so each ends up half the height |
| A grey body | A wide, faint band: `width` just under half the box height, `opacity` around 0.1. It must fit in idle, so the height has to be known |
| The thick cap on the round end | A band on `spans` over both round corners. Spans that touch draw as one stretch |
| Arc fragments inside the round end | Bands further in, each on spans over the same corners, trimmed with negative `before` and `after`. A band that follows a round end at a deeper offset is a concentric arc |
| A thick foot at a corner | A span on a corner anchor, widened along both edges |
| A bar code | A `line` with a band of seeded `blocks`, a pixel or a few wide |
| A window of moving scan lines | A frame with a wide band filled with an upright `hatch` |
| A stepped envelope line | A `line` with one step; a thick band on the step's anchor marks its top |
| A dial | A ring with many bands: blocks, segments and ticks, turning at different speeds, one `addressable` and flickering |

A panel is several elements, one inside the other, each with its own `data-hud`: the library draws one shape per element and leaves the arrangement to the page.

What the reference has and none of this can make: waveforms, bars of differing height (a band has one width), perspective, and areas filled other than by a band.

## What cannot be varied

- A state changes `offset`, `width`, `value`, `opacity` and `motion` of a band. It cannot change a band's pattern or fill, or the shape.
- A state's `motion` replaces the band's whole motion; it is not merged with it.
- There is one colour per element. Bands differ by `opacity`, not by hue.
