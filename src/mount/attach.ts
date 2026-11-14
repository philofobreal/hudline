import { createSvgSurface } from '../surface/index.js';
import type { SvgSurface } from '../surface/index.js';
import { createPlayer } from './player.js';
import type { Player } from './player.js';
import type { BandOverride, HudSpec } from './spec.js';

/** A drawing attached to an element. */
export interface Hud {
  /**
   * Moves to a named state. `'idle'` and any name the spec does not
   * define mean the spec itself. While the state is anything but idle,
   * the automatic states (`hover`, `focus`, `active`) stand back.
   */
  set(state: string): void;
  /**
   * Changes band parameters for good, by band `id`; numbers glide to
   * their new values. This is how a value shown as progress is kept up
   * to date: `hud.update({ value: { value: 0.7 } })`.
   */
  update(bands: Readonly<Record<string, BandOverride>>): void;
  /**
   * Takes the drawing off the element and undoes everything `attach`
   * did to it. Safe to call more than once.
   */
  detach(): void;
}

/**
 * Draws a spec on an existing element and keeps it up to date.
 *
 * The drawing is one `<svg>` child that covers the element's padding box
 * and lets pointer events through. The element's layout is not touched,
 * with one exception: if it is `position: static`, it becomes
 * `relative`, so that the drawing can be placed over it.
 *
 * What the drawing reacts to:
 * - the element's size;
 * - the pointer and focus: the states `hover`, `focus` and `active` are
 *   entered and left automatically if the spec defines them, `active`
 *   before `focus` before `hover`;
 * - leaving the viewport, a hidden page and `prefers-reduced-motion`:
 *   nothing is animated then. Out of view the drawing's time stands
 *   still, so its draw-on plays when it is first seen. With reduced
 *   motion states change at once and patterns stand still;
 * - the element leaving the document: the drawing detaches itself.
 *
 * The room content should leave around the edges is published on the
 * element as `--hud-inset-top`, `--hud-inset-right`, `--hud-inset-bottom`
 * and `--hud-inset-left`, in pixels. Using them is up to the author.
 *
 * Attaching to an element that already has a drawing replaces that
 * drawing's spec and returns the same handle. Where there is no DOM, or
 * on an element that cannot hold children (`img`, `input` and the like),
 * nothing happens and the handle does nothing. Never throws.
 */
export function attach(host: Element, spec: HudSpec): Hud {
  if (typeof document === 'undefined' || typeof requestAnimationFrame === 'undefined') return INERT;
  if (VOID_ELEMENTS.has(host.localName)) return INERT;

  const existing = instances.get(host);
  if (existing !== undefined) {
    existing.respec(spec);
    return existing.hud;
  }
  const instance = createInstance(host, spec);
  instances.set(host, instance);
  return instance.hud;
}

const INERT: Hud = { set() {}, update() {}, detach() {} };

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr',
]);
const INSET_PROPERTIES = [
  ['--hud-inset-top', 'top'],
  ['--hud-inset-right', 'right'],
  ['--hud-inset-bottom', 'bottom'],
  ['--hud-inset-left', 'left'],
] as const;
const AUTOMATIC = ['active', 'focus', 'hover'] as const;

/** One attached drawing and everything needed to keep it going. */
interface Instance {
  readonly hud: Hud;
  respec(spec: HudSpec): void;
  /** Called when the element's size may have changed. */
  measure(): void;
  setVisible(visible: boolean): void;
  /** Paints if there is anything new to show; says whether it still animates. */
  frame(now: number): boolean;
  /** Paints on the next frame whatever else is true. */
  invalidate(): void;
}

const instances = new WeakMap<Element, Instance>();
/** The drawings that are attached, in order of attachment. */
const attached = new Set<Instance>();

let resizes: ResizeObserver | undefined;
let sightings: IntersectionObserver | undefined;
let reducedMotion: MediaQueryList | undefined;
let scheduled = false;

/** Seconds on the page's clock. */
const clock = (): number => performance.now() / 1000;
const stillness = (): boolean => reducedMotion?.matches === true;

/** Makes sure a frame is coming. One loop serves every drawing. */
function wake(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    const now = clock();
    let animating = false;
    for (const instance of attached) animating = instance.frame(now) || animating;
    // The loop stops by itself when nothing moves any more.
    if (animating) wake();
  });
}

function observers(): { resizes: ResizeObserver; sightings: IntersectionObserver | undefined } {
  if (resizes === undefined) {
    resizes = new ResizeObserver((entries) => {
      for (const entry of entries) instances.get(entry.target)?.measure();
    });
    if (typeof IntersectionObserver !== 'undefined') {
      sightings = new IntersectionObserver((entries) => {
        for (const entry of entries) instances.get(entry.target)?.setVisible(entry.isIntersecting);
      });
    }
    if (typeof matchMedia !== 'undefined') {
      reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      reducedMotion.addEventListener('change', () => {
        for (const instance of attached) instance.invalidate();
      });
    }
  }
  return { resizes, sightings };
}

function createInstance(host: Element, initialSpec: HudSpec): Instance {
  const { resizes: sizes, sightings: sights } = observers();
  const style = (host as Partial<ElementCSSInlineStyle>).style;

  // The drawing is placed over the host, which therefore has to be a
  // positioned element. This is the one thing changed on it.
  const madeRelative = style !== undefined && getComputedStyle(host).position === 'static';
  if (madeRelative) style.position = 'relative';

  const surface: SvgSurface = createSvgSurface(host);
  let spec = initialSpec;
  let player: Player = createPlayer(spec, host.clientWidth, host.clientHeight);
  /** The page time at which the player's own time was 0. */
  let origin = clock();
  let width = host.clientWidth;
  let height = host.clientHeight;
  let requested = 'idle';
  let shownState = 'idle';
  let visible = true;
  /** The page time at which the host went out of view, while it is. */
  let hiddenAt: number | undefined;
  let dirty = true;
  let wasAnimating = false;
  let detached = false;
  const flags = { hover: false, focus: false, active: false };

  /**
   * The drawing's own time. It stands still while the host is out of
   * view, so a drawing that is scrolled to starts where it left off, and
   * one that has never been seen still has its draw-on ahead of it.
   */
  const playerTime = (): number => (hiddenAt ?? clock()) - origin;

  /** The state to show: what was asked for, or an automatic one over idle. */
  function resolveState(): void {
    let next = requested;
    if (requested === 'idle') {
      for (const name of AUTOMATIC) {
        if (flags[name] && spec.states?.[name] !== undefined) {
          next = name;
          break;
        }
      }
    }
    if (next === shownState) return;
    shownState = next;
    player.set(next, playerTime());
    invalidate();
  }

  function publishInsets(): void {
    if (style === undefined) return;
    const insets = player.insets();
    for (const [property, side] of INSET_PROPERTIES) {
      style.setProperty(property, `${Math.ceil(insets[side])}px`);
    }
  }

  function invalidate(): void {
    dirty = true;
    wake();
  }

  const listeners: readonly (readonly [string, () => void])[] = [
    ['pointerenter', () => flag('hover', true)],
    ['pointerleave', () => { flags.active = false; flag('hover', false); }],
    ['pointerdown', () => flag('active', true)],
    ['pointerup', () => flag('active', false)],
    ['pointercancel', () => flag('active', false)],
    ['focusin', () => flag('focus', true)],
    ['focusout', () => flag('focus', false)],
  ];
  function flag(name: keyof typeof flags, value: boolean): void {
    flags[name] = value;
    resolveState();
  }

  function detach(): void {
    if (detached) return;
    detached = true;
    attached.delete(instance);
    instances.delete(host);
    sizes.unobserve(host);
    sights?.unobserve(host);
    for (const [type, listener] of listeners) host.removeEventListener(type, listener);
    surface.remove();
    if (style !== undefined) {
      for (const [property] of INSET_PROPERTIES) style.removeProperty(property);
      if (madeRelative) style.position = '';
    }
  }

  const instance: Instance = {
    hud: {
      set(state) {
        if (detached) return;
        requested = state;
        resolveState();
      },
      update(bands) {
        if (detached) return;
        player.update(bands, playerTime());
        publishInsets();
        invalidate();
      },
      detach,
    },
    respec(next) {
      spec = next;
      origin = clock();
      if (hiddenAt !== undefined) hiddenAt = origin;
      player = createPlayer(spec, width, height);
      requested = 'idle';
      shownState = 'idle';
      publishInsets();
      surface.paint(player.scene(0, stillness()));
      resolveState();
      invalidate();
    },
    measure() {
      // A host that has left the document takes its drawing with it.
      if (!host.isConnected) {
        detach();
        return;
      }
      if (host.clientWidth === width && host.clientHeight === height) return;
      width = host.clientWidth;
      height = host.clientHeight;
      player.resize(width, height);
      publishInsets();
      invalidate();
    },
    setVisible(next) {
      if (next === visible) return;
      visible = next;
      if (!next) {
        hiddenAt = clock();
        return;
      }
      // Take the time spent out of view out of the drawing's clock.
      if (hiddenAt !== undefined) origin += clock() - hiddenAt;
      hiddenAt = undefined;
      invalidate();
    },
    frame(now) {
      if (detached) return false;
      if (!host.isConnected) {
        detach();
        return false;
      }
      if (!visible) return false;
      const time = now - origin;
      const still = stillness();
      const animating = !still && player.active(time);
      // The frame on which motion ends is painted too: it is the one
      // that shows everything arrived.
      if (dirty || animating || wasAnimating) {
        dirty = false;
        surface.paint(player.scene(time, still));
      }
      wasAnimating = animating;
      return animating;
    },
    invalidate,
  };

  for (const [type, listener] of listeners) host.addEventListener(type, listener, { passive: true });
  sizes.observe(host);
  sights?.observe(host);
  attached.add(instance);
  publishInsets();
  // The first paint happens at once, so the host is never seen bare.
  surface.paint(player.scene(0, stillness()));
  dirty = false;
  wake();
  return instance;
}
