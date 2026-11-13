import { begin, createRandom, sample, steer, travels } from '../motion/index.js';
import type { BandFrame, BandState, BandTarget } from '../motion/index.js';
import { compile } from '../pattern/index.js';
import type { Dashes } from '../pattern/index.js';
import { svgMarkup } from '../surface/index.js';
import type { Layer, Scene } from '../surface/index.js';
import { holds, offset, portion, resolve } from '../track/index.js';
import type { Track } from '../track/index.js';
import type { BandSpec, HudSpec } from './spec.js';

/**
 * A spec being played for a box of some size, without a DOM. The caller
 * supplies the time, in seconds on any clock that only moves forward;
 * the same calls with the same times always give the same output.
 */
export interface Player {
  /**
   * Moves to a named state from wherever every band is at `time`.
   * `'idle'` and any name the spec does not define mean the spec itself.
   */
  set(state: string, time: number): void;
  /** Changes the box. Motion carries on; nothing restarts. */
  resize(width: number, height: number): void;
  /** What is drawn at `time`. */
  scene(time: number): Scene;
  /** The drawing at `time` as a standalone SVG document. */
  markup(time: number): string;
}

const DEFAULT_SETTLE = 0.3;

/** What one band needs between frames. */
interface BandRuntime {
  readonly spec: BandSpec;
  readonly idle: BandTarget;
  state: BandState;
  readonly frame: BandFrame;
  // Geometry and pattern are kept until the inputs they depend on change.
  centreAt: number;
  centre: Track;
  dashesFor: Track | undefined;
  dashesCyclic: boolean;
  dashes: Dashes;
}

const NO_TRACK = resolve({ kind: 'ring' }, 0, 0);
const NO_DASHES: Dashes = { intervals: [], cap: 'butt' };

/**
 * Starts playing a spec.
 *
 * If the spec defines a state named `enter`, every band starts in it at
 * time 0 and moves to idle at once, which is how draw-on is described.
 * Otherwise bands start at rest in idle.
 *
 * @param still Start at rest in idle even if `enter` is defined.
 */
export function createPlayer(spec: HudSpec, width: number, height: number, still = false): Player {
  const settleIdle = finiteOr(spec.settle, DEFAULT_SETTLE);
  const settleInto = (state: string) => finiteOr(spec.states?.[state]?.settle, settleIdle);
  const hostSeed = finiteOr(spec.seed, 0);
  const random = (seed: number) => createRandom(mixSeeds(seed, hostSeed));
  const enters = !still && spec.states?.['enter'] !== undefined;

  let base = resolve(spec.shape, width, height);
  let size = { width, height };

  const bands: BandRuntime[] = spec.bands.map((band) => {
    const idle = targetOf(band);
    const start = enters ? targetIn(spec, band, idle, 'enter') : idle;
    return {
      spec: band,
      idle,
      state: enters ? steer(begin(start), idle, 0, settleInto('enter')) : begin(idle),
      frame: { offset: 0, width: 0, value: 0, opacity: 0, phase: 0 },
      centreAt: Number.NaN,
      centre: NO_TRACK,
      dashesFor: undefined,
      dashesCyclic: false,
      dashes: NO_DASHES,
    };
  });

  function scene(time: number): Scene {
    const layers: Layer[] = [];
    for (const band of bands) {
      // Length is needed to turn spin into pixels, and it depends on the
      // offset being sampled; the previous centreline is close enough to
      // sample with, and exact whenever the band is not changing shape.
      const frame = sample(band.state, band.centre.length, band.centre.closed, time, band.frame);
      if (!(frame.width > 0)) continue;
      // A host too small for this band: leave the band out.
      if (!holds(base, frame.offset, frame.offset + frame.width)) continue;

      const centreAt = frame.offset + frame.width / 2;
      if (centreAt !== band.centreAt) {
        band.centreAt = centreAt;
        band.centre = offset(base, centreAt);
        sample(band.state, band.centre.length, band.centre.closed, time, frame);
      }
      const centre = band.centre;
      const cyclic = centre.closed || travels(band.state, centre.closed);
      if (band.dashesFor !== centre || band.dashesCyclic !== cyclic) {
        band.dashesFor = centre;
        band.dashesCyclic = cyclic;
        band.dashes = compile(band.spec.pattern ?? { kind: 'solid' }, {
          length: centre.length,
          cyclic,
          width: frame.width,
          anchors: centre.anchors,
          random,
        });
      }

      const shown = portion(centre, frame.value);
      if (shown.length <= 0) continue;
      layers.push({
        track: shown,
        width: frame.width,
        dashes: band.dashes,
        patternLength: centre.length,
        phase: frame.phase,
        opacity: frame.opacity,
      });
    }
    return { width: size.width, height: size.height, layers };
  }

  return {
    set(state, time) {
      const settle = settleInto(state);
      for (const band of bands) {
        band.state = steer(band.state, targetIn(spec, band.spec, band.idle, state), time, settle);
      }
    },
    resize(nextWidth, nextHeight) {
      size = { width: nextWidth, height: nextHeight };
      base = resolve(spec.shape, nextWidth, nextHeight);
      for (const band of bands) band.centreAt = Number.NaN;
    },
    scene,
    markup: (time) => svgMarkup(scene(time)),
  };
}

/**
 * Renders a spec as a standalone SVG document for a box of the given
 * size, at rest in its idle state. Useful where there is no DOM: server
 * rendering, tests, exporting a still. The drawing takes its colour from
 * CSS `color`.
 *
 * Never throws; a size or spec that leaves nothing to draw gives an
 * empty SVG.
 */
export function renderToString(spec: HudSpec, width: number, height: number): string {
  return createPlayer(spec, width, height, true).markup(0);
}

function targetOf(band: BandSpec): BandTarget {
  return {
    offset: finiteOr(band.offset, 0),
    width: finiteOr(band.width, 0),
    value: finiteOr(band.value, 1),
    opacity: finiteOr(band.opacity, 1),
    motion: band.motion,
  };
}

/** A band's target in a named state: idle with that state's overrides. */
function targetIn(spec: HudSpec, band: BandSpec, idle: BandTarget, state: string): BandTarget {
  const override = band.id === undefined ? undefined : spec.states?.[state]?.bands[band.id];
  if (override === undefined) return idle;
  return {
    offset: finiteOr(override.offset, idle.offset),
    width: finiteOr(override.width, idle.width),
    value: finiteOr(override.value, idle.value),
    opacity: finiteOr(override.opacity, idle.opacity),
    motion: 'motion' in override ? override.motion : idle.motion,
  };
}

/** Combines a pattern's seed with the host's, so each affects the result. */
function mixSeeds(seed: number, hostSeed: number): number {
  return ((seed | 0) ^ Math.imul(hostSeed | 0, 0x9e3779b1)) >>> 0;
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}
