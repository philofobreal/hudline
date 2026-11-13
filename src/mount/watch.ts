import { attach } from './attach.js';
import type { Hud } from './attach.js';
import type { HudSpec } from './spec.js';

/** A running watch over part of a document. */
export interface Watch {
  /** Stops watching and detaches every drawing the watch attached. */
  stop(): void;
}

const NAME = 'data-hud';
const STATE = 'data-hud-state';
const INERT: Watch = { stop() {} };

/**
 * Draws on every element that asks for it in markup, and keeps doing so
 * as the document changes.
 *
 * An element asks with `data-hud="name"`, where the name is a key of
 * `specs`; a name that is not is ignored. `data-hud-state="name"` puts
 * the drawing into that state, as `Hud.set` would. Both attributes may
 * be added, changed and removed at any time, and elements may come and
 * go: the drawings follow.
 *
 * @param specs The drawings that may be asked for, by name. Pass the
 *   library's `presets`, your own, or both spread into one object.
 * @param root Where to look. Default: the whole document.
 * @returns A handle that stops the watch. Where there is no DOM, a
 *   handle that does nothing.
 */
export function watch(specs: Readonly<Record<string, HudSpec>>, root?: ParentNode): Watch {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return INERT;
  const scope = root ?? document;
  /** What this watch attached, and under which name. */
  const drawn = new Map<Element, { name: string; hud: Hud }>();

  /** Makes one element's drawing match its attributes. */
  function sync(element: Element): void {
    const name = element.getAttribute(NAME);
    const spec = name !== null && Object.hasOwn(specs, name) ? specs[name] : undefined;
    let entry = drawn.get(element);
    if (name === null || spec === undefined) {
      entry?.hud.detach();
      drawn.delete(element);
      return;
    }
    if (entry === undefined || entry.name !== name) {
      entry = { name, hud: attach(element, spec) };
      drawn.set(element, entry);
    }
    entry.hud.set(element.getAttribute(STATE) ?? 'idle');
  }

  function scan(node: Node): void {
    if (node.nodeType !== 1 && node.nodeType !== 9) return;
    const parent = node as Element | Document;
    if ('hasAttribute' in parent && parent.hasAttribute(NAME)) sync(parent);
    for (const element of parent.querySelectorAll(`[${NAME}]`)) sync(element);
  }

  /** Lets go of everything in a subtree that has left the document. */
  function forget(node: Node): void {
    for (const [element, entry] of drawn) {
      if (node === element || node.contains(element)) {
        entry.hud.detach();
        drawn.delete(element);
      }
    }
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') {
        sync(record.target as Element);
        continue;
      }
      // A node that was only moved is connected again by now and keeps
      // its drawing; one that is gone for good is let go.
      for (const node of record.removedNodes) if (!node.isConnected) forget(node);
      for (const node of record.addedNodes) scan(node);
    }
  });
  observer.observe(scope, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [NAME, STATE],
  });
  scan(scope);

  return {
    stop() {
      observer.disconnect();
      for (const entry of drawn.values()) entry.hud.detach();
      drawn.clear();
    },
  };
}
