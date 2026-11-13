/**
 * catalog — the primitive catalogue as data.
 *
 * Every entry of `docs/CATALOG.md` that the spec language can express is
 * written here as a typed constant, so the compiler proves that the
 * language covers it. In milestone M5 this grows into the preset
 * library. Contains data only; imports types and nothing else.
 */
import type { HudSpec } from '../mount/index.js';

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
    enter: { outline: { value: 0 }, segments: { value: 0, opacity: 0 } },
    hover: { segments: { offset: 4, width: 11, motion: { spin: 90 } } },
    alert: {
      segments: { motion: { spin: -140, flicker: { seed: 1, rate: 9, depth: 0.7 } } },
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
      priority: 1,
    },
    {
      id: 'major',
      offset: 4,
      width: 10,
      pattern: { kind: 'ticks', count: 12, thickness: 2 },
      priority: 2,
    },
  ],
  states: {
    enter: { outline: { value: 0 }, minor: { value: 0 }, major: { value: 0 } },
    hover: { major: { width: 14 } },
    alert: { minor: { motion: { flicker: { seed: 5, rate: 12, depth: 0.8 } } } },
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
      priority: 3,
    },
    {
      id: 'b',
      offset: 7,
      width: 8,
      pattern: { kind: 'blocks', seed: 2, min: 8, max: 40, gap: 4, density: 0.8 },
      motion: { spin: -21 },
      priority: 2,
    },
    {
      id: 'c',
      offset: 19,
      width: 2,
      pattern: { kind: 'blocks', seed: 3, min: 30, max: 120, gap: 10 },
      motion: { spin: 7 },
      priority: 1,
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
      a: { opacity: 0, value: 0 },
      b: { opacity: 0 },
      c: { opacity: 0, value: 0 },
      d: { opacity: 0 },
    },
    hover: { b: { motion: { spin: -70 } }, c: { motion: { spin: 40 } } },
    alert: {
      a: { motion: { spin: 120 } },
      b: { motion: { spin: -160, flicker: { seed: 2, rate: 10, depth: 0.6 } } },
      c: { motion: { spin: 90 } },
      d: { motion: { spin: -200, flicker: { seed: 4, rate: 14, depth: 0.8 } } },
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
    enter: { guide: { value: 0 }, value: { value: 0 } },
    hover: { value: { width: 6 } },
    alert: { value: { value: 0.95, motion: { flicker: { seed: 9, rate: 6, depth: 0.6 } } } },
  },
};

/** F1 Chamfered frame: two opposite corners cut at 45°. */
const chamferedFrame: HudSpec = {
  shape: {
    kind: 'frame',
    corners: { tl: { kind: 'chamfer', size: 12 }, br: { kind: 'chamfer', size: 12 } },
  },
  bands: [{ width: 1 }],
};

/**
 * F2 Tabbed frame: a tab raised from the top edge near its end, filled
 * by a band as deep as the tab. The base outline is inset by the tab's
 * depth so that the tab stays inside the host box.
 */
const tabbedFrame: HudSpec = {
  shape: {
    kind: 'frame',
    inset: 8,
    corners: { tl: { kind: 'chamfer', size: 12 }, br: { kind: 'chamfer', size: 12 } },
    edges: {
      top: [
        {
          kind: 'step',
          id: 'tab',
          from: { from: 'end', offset: 104 },
          to: { from: 'end', offset: 24 },
          depth: -8,
          priority: 1,
        },
      ],
    },
  },
  bands: [
    { width: 1 },
    {
      id: 'tab-fill',
      width: 8,
      pattern: { kind: 'spans', spans: [{ anchor: 'tab', before: -8, after: -8 }] },
    },
  ],
};

/** F3 Stepped frame: part of the bottom edge steps inward. */
const steppedFrame: HudSpec = {
  shape: {
    kind: 'frame',
    corners: { kind: 'chamfer', size: 8 },
    edges: {
      bottom: [
        {
          kind: 'step',
          from: { from: 'start', offset: 40 },
          to: { fraction: 0.6 },
          depth: 6,
        },
      ],
    },
  },
  bands: [{ width: 1 }],
};

/** F4 Double frame with thick accents on two corners. */
const doubleFrame: HudSpec = {
  shape: {
    kind: 'frame',
    corners: { tl: { kind: 'chamfer', size: 14 }, br: { kind: 'chamfer', size: 14 } },
  },
  bands: [
    { width: 1, priority: 2 },
    { offset: 4, width: 1 },
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
      priority: 1,
    },
  ],
};

/** F5 Corner brackets: only the four corners are drawn. */
const cornerBrackets: HudSpec = {
  shape: { kind: 'frame' },
  bands: [
    {
      width: 2,
      pattern: {
        kind: 'spans',
        spans: [
          { anchor: 'tl', before: 14, after: 14 },
          { anchor: 'tr', before: 14, after: 14 },
          { anchor: 'br', before: 14, after: 14 },
          { anchor: 'bl', before: 14, after: 14 },
        ],
      },
    },
  ],
};

/*
 * F6 Hatched edge strip is not expressible yet: diagonal hatching is not
 * an interval pattern. It is scheduled for milestone M5.
 */

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
} as const satisfies Readonly<Record<string, HudSpec>>;
