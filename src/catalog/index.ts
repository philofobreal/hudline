/**
 * catalog — the primitive catalogue as data.
 *
 * Every entry of `docs/CATALOG.md` is written here as a typed constant,
 * so the compiler proves that the spec language covers it. Later this
 * grows into the preset library. Contains data only; imports types and nothing else.
 *
 * Every entry defines the states `enter`, `hover` and `alert`, so that
 * the gallery can show how each reacts.
 *
 * Rule for every entry: `hover` and `alert` must change the first band.
 * On a small host the inner bands and the steps are left out, and a
 * state that only touches those would change nothing that is visible.
 * The first band is the outermost and is there as long as anything is.
 */
import type { HudSpec } from '../mount/index.js';

/** Draw-on reads better slower than a hover change. */
const DRAW_ON = 0.9;

/** R1 Segmented ring: thin circle, thicker inner band of 12 segments. */
const segmentedRing: HudSpec = {
  shape: { kind: 'ring', inset: 2 },
  bands: [
    { id: 'outline', width: 1 },
    {
      id: 'segments',
      offset: 5,
      width: 8,
      pattern: { kind: 'segments', count: 12, gap: 4 },
      motion: { spin: 20 },
    },
  ],
  states: {
    enter: {
      bands: { outline: { value: 0 }, segments: { value: 0, opacity: 0 } },
      settle: DRAW_ON,
    },
    hover: {
      bands: { outline: { width: 2 }, segments: { offset: 5, width: 11, motion: { spin: 90 } } },
    },
    alert: {
      bands: {
        outline: { motion: { flicker: { seed: 8, rate: 9, depth: 0.5 } } },
        segments: { motion: { spin: -140, flicker: { seed: 1, rate: 9, depth: 0.7 } } },
      },
    },
  },
};

/**
 * R2 Scale ring: 60 short ticks and 12 long ones. Both tick bands share
 * an offset, so they share their outer edge; the short ticks thin out in
 * multiples of 12, so they stay lined up with the long ones.
 */
const scaleRing: HudSpec = {
  shape: { kind: 'ring', inset: 2 },
  bands: [
    { id: 'outline', width: 1 },
    {
      id: 'minor',
      offset: 4,
      width: 5,
      pattern: { kind: 'ticks', count: 60, minSpacing: 4, multipleOf: 12 },
    },
    {
      id: 'major',
      offset: 4,
      width: 10,
      pattern: { kind: 'ticks', count: 12, thickness: 2 },
    },
  ],
  states: {
    enter: {
      bands: { outline: { value: 0 }, minor: { value: 0 }, major: { value: 0 } },
      settle: DRAW_ON,
    },
    hover: { bands: { outline: { width: 2 }, minor: { width: 7 }, major: { width: 14 } } },
    alert: {
      bands: {
        outline: { motion: { flicker: { seed: 6, rate: 12, depth: 0.5 } } },
        minor: { motion: { flicker: { seed: 5, rate: 12, depth: 0.8 } } },
      },
    },
  },
};

/** R3 Irregular block ring: seeded bands turning against each other. */
const blockRing: HudSpec = {
  shape: { kind: 'ring', inset: 2 },
  bands: [
    {
      id: 'a',
      width: 3,
      pattern: { kind: 'blocks', seed: 1, min: 20, max: 90, gap: 6 },
      motion: { spin: 12 },
    },
    {
      id: 'b',
      offset: 7,
      width: 8,
      pattern: { kind: 'blocks', seed: 2, min: 8, max: 40, gap: 4, density: 0.8 },
      motion: { spin: -21 },
    },
    {
      id: 'c',
      offset: 19,
      width: 2,
      pattern: { kind: 'blocks', seed: 3, min: 30, max: 120, gap: 10 },
      motion: { spin: 7 },
    },
    {
      id: 'd',
      offset: 25,
      width: 5,
      pattern: { kind: 'blocks', seed: 4, min: 6, max: 24, gap: 3, density: 0.6 },
      motion: { spin: -33, flicker: { seed: 4, rate: 2, depth: 0.5 } },
      addressable: true,
    },
  ],
  states: {
    enter: {
      bands: {
        a: { opacity: 0, value: 0 },
        b: { opacity: 0 },
        c: { opacity: 0, value: 0 },
        d: { opacity: 0 },
      },
      settle: DRAW_ON,
    },
    hover: {
      bands: {
        a: { motion: { spin: 50 } },
        b: { motion: { spin: -70 } },
        c: { motion: { spin: 40 } },
      },
    },
    alert: {
      bands: {
        a: { motion: { spin: 120 } },
        b: { motion: { spin: -160, flicker: { seed: 2, rate: 10, depth: 0.6 } } },
        c: { motion: { spin: 90 } },
        d: { motion: { spin: -200, flicker: { seed: 4, rate: 14, depth: 0.8 } } },
      },
    },
  },
};

/** R4 Value arc: a 270° guide with a thicker band filled to a value. */
const valueArc: HudSpec = {
  shape: { kind: 'arc', start: -135, sweep: 270, inset: 2 },
  bands: [
    { id: 'guide', width: 1 },
    { id: 'value', offset: 3, width: 4, value: 0.7 },
  ],
  states: {
    enter: { bands: { guide: { value: 0 }, value: { value: 0 } }, settle: DRAW_ON },
    hover: { bands: { guide: { width: 2 }, value: { width: 6 } } },
    alert: {
      bands: {
        guide: { motion: { flicker: { seed: 4, rate: 6, depth: 0.5 } } },
        value: { value: 0.95, motion: { flicker: { seed: 9, rate: 6, depth: 0.6 } } },
      },
    },
  },
};

/** F1 Chamfered frame: two opposite corners cut at 45°. */
const chamferedFrame: HudSpec = {
  shape: {
    kind: 'frame',
    inset: 1,
    corners: { tl: { kind: 'chamfer', size: 12 }, br: { kind: 'chamfer', size: 12 } },
  },
  bands: [
    { id: 'outline', width: 1 },
    {
      id: 'runner',
      offset: 3,
      width: 2,
      opacity: 0,
      pattern: { kind: 'dashes', dash: 18, gap: 42 },
      motion: { drift: 40 },
    },
  ],
  states: {
    enter: { bands: { outline: { value: 0 } }, settle: DRAW_ON },
    hover: { bands: { outline: { width: 2 }, runner: { opacity: 1, motion: { drift: 40 } } } },
    alert: {
      bands: {
        outline: { width: 3 },
        runner: { opacity: 1, motion: { drift: 220, flicker: { seed: 3, rate: 10, depth: 0.6 } } },
      },
    },
  },
};

/**
 * F2 Tabbed frame: a tab raised from the top edge near its end, filled
 * by a band as deep as the tab. The base outline is inset by the tab's
 * depth so that the tab stays inside the host box.
 */
const tabbedFrame: HudSpec = {
  shape: {
    kind: 'frame',
    inset: 9,
    corners: { tl: { kind: 'chamfer', size: 12 }, br: { kind: 'chamfer', size: 12 } },
    edges: {
      top: [
        {
          kind: 'step',
          id: 'tab',
          from: { from: 'end', offset: 104 },
          to: { from: 'end', offset: 24 },
          depth: -8,
        },
      ],
    },
  },
  bands: [
    { id: 'outline', width: 1 },
    { id: 'fill', width: 8, pattern: { kind: 'spans', spans: [{ anchor: 'tab' }] } },
  ],
  states: {
    enter: { bands: { outline: { value: 0 }, fill: { opacity: 0 } }, settle: DRAW_ON },
    hover: { bands: { outline: { width: 2 }, fill: { width: 11 } } },
    alert: {
      bands: {
        outline: { motion: { flicker: { seed: 5, rate: 8, depth: 0.5 } } },
        fill: { motion: { flicker: { seed: 6, rate: 8, depth: 0.8 } } },
      },
    },
  },
};

/**
 * F3 Stepped frame: part of the bottom edge steps inward, and a short
 * notch on the top edge gives way first when the frame gets narrow.
 */
const steppedFrame: HudSpec = {
  shape: {
    kind: 'frame',
    inset: 1,
    corners: { kind: 'chamfer', size: 8 },
    edges: {
      top: [
        {
          kind: 'step',
          from: { from: 'center', offset: -24 },
          to: { from: 'center', offset: 24 },
          depth: 5,
        },
      ],
      bottom: [
        {
          kind: 'step',
          id: 'shelf',
          from: { from: 'start', offset: 40 },
          to: { fraction: 0.6 },
          depth: 6,
          priority: 1,
        },
      ],
    },
  },
  bands: [
    { id: 'outline', width: 1 },
    {
      id: 'shelf',
      offset: -5,
      width: 3,
      pattern: { kind: 'spans', spans: [{ anchor: 'shelf', before: -6, after: -6 }] },
    },
  ],
  states: {
    enter: { bands: { outline: { value: 0 }, shelf: { opacity: 0 } }, settle: DRAW_ON },
    hover: { bands: { outline: { width: 2 }, shelf: { offset: -6, width: 4 } } },
    alert: {
      bands: {
        outline: { motion: { flicker: { seed: 3, rate: 9, depth: 0.5 } } },
        shelf: { motion: { flicker: { seed: 2, rate: 9, depth: 0.8 } } },
      },
    },
  },
};

/** F4 Double frame with thick accents on two corners. */
const doubleFrame: HudSpec = {
  shape: {
    kind: 'frame',
    inset: 1,
    corners: { tl: { kind: 'chamfer', size: 14 }, br: { kind: 'chamfer', size: 14 } },
  },
  bands: [
    { id: 'outer', width: 1 },
    { id: 'inner', offset: 4, width: 1, opacity: 0.6 },
    {
      id: 'accents',
      width: 3,
      pattern: {
        kind: 'spans',
        spans: [
          { anchor: 'tl', before: 20, after: 20 },
          { anchor: 'br', before: 20, after: 20 },
        ],
      },
    },
  ],
  states: {
    enter: {
      bands: { outer: { value: 0 }, inner: { value: 0 }, accents: { opacity: 0 } },
      settle: DRAW_ON,
    },
    hover: { bands: { outer: { width: 2 }, inner: { offset: 6, opacity: 1 }, accents: { width: 5 } } },
    alert: {
      bands: {
        outer: { motion: { flicker: { seed: 1, rate: 11, depth: 0.4 } } },
        inner: { opacity: 1, motion: { flicker: { seed: 7, rate: 11, depth: 0.7 } } },
        accents: { width: 5 },
      },
    },
  },
};

/** F5 Corner brackets: only the four corners are drawn. */
const cornerBrackets: HudSpec = {
  shape: { kind: 'frame', inset: 1, corners: { kind: 'fillet', radius: 6 } },
  bands: [
    {
      id: 'brackets',
      width: 2,
      pattern: {
        kind: 'spans',
        spans: [
          { anchor: 'tl', before: 12, after: 12 },
          { anchor: 'tr', before: 12, after: 12 },
          { anchor: 'br', before: 12, after: 12 },
          { anchor: 'bl', before: 12, after: 12 },
        ],
      },
    },
  ],
  states: {
    enter: { bands: { brackets: { opacity: 0, offset: -8 } }, settle: DRAW_ON },
    hover: { bands: { brackets: { offset: 3 } } },
    alert: {
      bands: {
        brackets: { width: 3, motion: { breathe: { period: 0.5, amount: 2 } } },
      },
    },
  },
};

/**
 * F6 Hatched edge strip: diagonal stripes alongside the bottom edge,
 * starting where the bottom-right chamfer ends. The stripes move; the
 * strip does not.
 */
const hatchedFrame: HudSpec = {
  shape: {
    kind: 'frame',
    inset: 1,
    corners: { tl: { kind: 'chamfer', size: 10 }, br: { kind: 'chamfer', size: 10 } },
  },
  bands: [
    { id: 'outline', width: 1 },
    {
      id: 'strip',
      offset: 4,
      width: 7,
      // The corner anchor is the chamfer itself. Trimming its whole length
      // off the front and widening the back leaves a stretch that begins
      // at the chamfer's end and runs along the bottom edge.
      pattern: { kind: 'spans', spans: [{ anchor: 'br', before: -10, after: 72 }] },
      fill: { kind: 'hatch', angle: 45, stripe: 2, gap: 3, drift: 10 },
    },
  ],
  states: {
    enter: { bands: { outline: { value: 0 }, strip: { opacity: 0 } }, settle: DRAW_ON },
    hover: { bands: { outline: { width: 2 }, strip: { width: 10 } } },
    alert: {
      bands: {
        outline: { motion: { flicker: { seed: 9, rate: 9, depth: 0.5 } } },
        strip: { width: 10, motion: { flicker: { seed: 4, rate: 9, depth: 0.7 } } },
      },
    },
  },
};

/** The catalogue, keyed by the identifiers used in `docs/CATALOG.md`. */
export const catalog = {
  R1: segmentedRing,
  R2: scaleRing,
  R3: blockRing,
  R4: valueArc,
  F1: chamferedFrame,
  F2: tabbedFrame,
  F3: steppedFrame,
  F4: doubleFrame,
  F5: cornerBrackets,
  F6: hatchedFrame,
} as const satisfies Readonly<Record<string, HudSpec>>;
