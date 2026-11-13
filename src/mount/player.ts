import { begin, createRandom, moving, sample, steer, travels } from '../motion/index.js';
import type { BandFrame, BandState, BandTarget } from '../motion/index.js';
import { compile } from '../pattern/index.js';
import type { Dashes } from '../pattern/index.js';
import { svgMarkup } from '../surface/index.js';
import type { Layer, Scene } from '../surface/index.js';
import { clearance, holds, offset, portion, resolve } from '../track/index.js';
import type { Insets, Track } from '../track/index.js';
import type { BandOverride, BandSpec, HudSpec } from './spec.js';

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
  /**
   * Changes band parameters for good, by band `id`: the new values hold
   * in every state that does not override them. Numbers glide there.
   * This is how a value shown as progress is kept up to date.
   */
  update(bands: Readonly<Record<string, BandOverride>>, time: number): void;
  /** Changes the box. Motion carries on; nothing restarts. */
  resize(width: number, height: number): void;
  /**
   * What is drawn at `time`. The returned scene and its layers are
   * reused by the next call; read them before calling again.
   *
   * @param atRest Show every band on its target and without motion,
   *   whatever the time: no travel, flicker or breathing, and no
   *   transitions. This is what reduced motion asks for.
   */
  scene(time: number, atRest?: boolean): Scene;
  /** The drawing at `time` as a standalone SVG document. */
  markup(time: number): string;
  /**
   * Whether the drawing still changes at `time`. While it does not, the
   * scene is the same on every later frame until the next call to
   * `set`, `update` or `resize`.
   */
  active(time: number): boolean;
  /**
   * How far from each side of the box content must stay to be clear of
   * the drawing in its idle state.
   */
  insets(): Insets;
}

const DEFAULT_SETTLE = 0.3;
/**
 * A band that is not shown needs this much room to spare before it is
 * shown again, so that it does not flicker around the size where it
 * starts to fit.
 */
const HYSTERESIS = 4;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** What one band needs between frames. */
interface BandRuntime {
  readonly spec: BandSpec;
  /** The spec's own values, changed for good by `update`. */
  idle: BandTarget;
  /** Where the band is heading now: idle with the current state's overrides. */
  target: BandTarget;
  state: BandState;
  readonly frame: BandFrame;
  readonly layer: Mutable<Layer>;
  // Everything below is kept until the inputs it depends on change.
  fitFor: number;
  fitTo: number;
  fits: boolean;
  /** Whether `fits` has ever been worked out. */
  fitKnown: boolean;
  centreAt: number;
  centre: Track;
  dashesFor: Track | undefined;
  dashesCyclic: boolean;
  dashes: Dashes;
  shownFor: Track | undefined;
  shownValue: number;
  shown: Track;
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
  let current = 'idle';
  const scene: Mutable<Scene> & { layers: Layer[] } = { width, height, layers: [] };

  const bands: BandRuntime[] = spec.bands.map((band, index) => {
    const idle = targetOf(band);
    const start = enters ? withOverride(idle, overrideIn(spec, band, 'enter')) : idle;
    return {
      spec: band,
      idle,
      target: idle,
      state: enters ? steer(begin(start), idle, 0, settleInto('enter')) : begin(idle),
      frame: { offset: 0, width: 0, value: 0, opacity: 0, phase: 0 },
      layer: {
        band: index,
        track: NO_TRACK,
        width: 0,
        dashes: NO_DASHES,
        patternLength: 0,
        phase: 0,
        opacity: 0,
      },
      fitFor: Number.NaN,
      fitTo: Number.NaN,
      fits: false,
      fitKnown: false,
      centreAt: Number.NaN,
      centre: NO_TRACK,
      dashesFor: undefined,
      dashesCyclic: false,
      dashes: NO_DASHES,
      shownFor: undefined,
      shownValue: Number.NaN,
      shown: NO_TRACK,
    };
  });

  /**
   * Forgets the geometry worked out for the previous box. Whether each
   * band was shown is remembered: a band that was left out comes back
   * only once it fits with room to spare.
   */
  function invalidate(): void {
    for (const band of bands) {
      band.fitFor = Number.NaN;
      band.centreAt = Number.NaN;
    }
  }

  function retargetAll(time: number, settle: number): void {
    for (const band of bands) {
      band.target = withOverride(band.idle, overrideIn(spec, band.spec, current));
      band.state = steer(band.state, band.target, time, settle);
    }
  }

  function draw(time: number, atRest = false): Scene {
    scene.layers.length = 0;
    for (const band of bands) {
      const frame = band.frame;
      if (atRest) {
        frame.offset = band.target.offset;
        frame.width = Math.max(0, band.target.width);
        frame.value = Math.min(1, Math.max(0, band.target.value));
        frame.opacity = Math.min(1, Math.max(0, band.target.opacity));
        frame.phase = 0;
      } else {
        // Length is needed to turn spin into pixels, and it depends on
        // the offset being sampled; the previous centreline is close
        // enough to sample with, and exact whenever the band is not
        // changing shape.
        sample(band.state, band.centre.length, band.centre.closed, time, frame);
      }
      if (!(frame.width > 0)) continue;

      // A host too small for this band: leave the band out.
      const to = frame.offset + frame.width;
      if (band.fitFor !== frame.offset || band.fitTo !== to) {
        band.fitFor = frame.offset;
        band.fitTo = to;
        const spare = band.fitKnown && !band.fits ? HYSTERESIS : 0;
        band.fits = holds(base, frame.offset, to, spare);
        band.fitKnown = true;
      }
      if (!band.fits) continue;

      const centreAt = frame.offset + frame.width / 2;
      if (centreAt !== band.centreAt) {
        band.centreAt = centreAt;
        band.centre = offset(base, centreAt);
        if (!atRest) sample(band.state, band.centre.length, band.centre.closed, time, frame);
      }
      const centre = band.centre;
      const cyclic = centre.closed || (!atRest && travels(band.state, centre.closed));
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
      if (band.shownFor !== centre || band.shownValue !== frame.value) {
        band.shownFor = centre;
        band.shownValue = frame.value;
        band.shown = portion(centre, frame.value);
      }
      if (band.shown.length <= 0) continue;

      const layer = band.layer;
      layer.track = band.shown;
      layer.width = frame.width;
      layer.dashes = band.dashes;
      layer.patternLength = centre.length;
      layer.phase = frame.phase;
      layer.opacity = frame.opacity;
      scene.layers.push(layer);
    }
    return scene;
  }

  return {
    set(state, time) {
      current = state;
      retargetAll(time, settleInto(state));
    },
    update(overrides, time) {
      for (const band of bands) {
        const override = band.spec.id === undefined ? undefined : overrides[band.spec.id];
        if (override !== undefined) band.idle = withOverride(band.idle, override);
      }
      retargetAll(time, settleIdle);
    },
    resize(nextWidth, nextHeight) {
      scene.width = nextWidth;
      scene.height = nextHeight;
      base = resolve(spec.shape, nextWidth, nextHeight, base);
      invalidate();
    },
    scene: draw,
    markup: (time) => svgMarkup(draw(time)),
    active(time) {
      for (const band of bands) {
        if (moving(band.state, band.centre.closed, time)) return true;
      }
      return false;
    },
    insets() {
      let depth = 0;
      for (const band of bands) depth = Math.max(depth, band.idle.offset + band.idle.width);
      return clearance(base, depth);
    },
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

function overrideIn(spec: HudSpec, band: BandSpec, state: string): BandOverride | undefined {
  return band.id === undefined ? undefined : spec.states?.[state]?.bands[band.id];
}

/** A target with an override applied; a named `motion` replaces the whole motion. */
function withOverride(target: BandTarget, override: BandOverride | undefined): BandTarget {
  if (override === undefined) return target;
  return {
    offset: finiteOr(override.offset, target.offset),
    width: finiteOr(override.width, target.width),
    value: finiteOr(override.value, target.value),
    opacity: finiteOr(override.opacity, target.opacity),
    motion: 'motion' in override ? override.motion : target.motion,
  };
}

/** Combines a pattern's seed with the host's, so each affects the result. */
function mixSeeds(seed: number, hostSeed: number): number {
  return ((seed | 0) ^ Math.imul(hostSeed | 0, 0x9e3779b1)) >>> 0;
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}
