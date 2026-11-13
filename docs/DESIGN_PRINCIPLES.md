# Design principles

The code follows the modular design ideas of John Ousterhout's *A Philosophy of Software Design*. This file states how they apply here. It governs the TypeScript source, not the visual model.

The aim throughout is to lower complexity: fewer things a reader must hold in mind, fewer places a change must touch, fewer facts that are not obvious from the code.

## Rules

1. **Deep modules.** A module's interface must be much simpler than what it hides. `track.resolve(shape, w, h)` hides all trigonometry, operators and detail dropping behind one call. A module whose interface is as complex as its body is not worth having.

2. **Information hiding.** Each design decision lives in exactly one module:

   | Decision | Owner |
   |---|---|
   | How a shape becomes lines and arcs; what drops out when space is short | `track` |
   | How a pattern is fitted to a length; how two patterns blend | `pattern` |
   | How time, seeds, springs and noise become values | `motion` |
   | Which SVG nodes and attributes exist | `surface` |
   | Which observers and events are used; element lifecycle | `mount` |

   If a change to one decision forces edits in two modules, information has leaked.

3. **Pull complexity downward.** When something is awkward, the module absorbs it so its callers do not. Callers never fit periods, clamp radii or check for zero sizes.

4. **Define errors out of existence.** Prefer semantics under which the "error" is a normal result: an invalid length yields no pattern, a too-small box yields a simpler shape, a second `attach` is an update. Exceptions are for programming mistakes inside the library, not for input.

5. **General-purpose interfaces.** Interfaces describe what the module does in general terms; special cases belong to the caller or to presets. `pattern` knows intervals on a length, not "radar ticks".

6. **Different layer, different abstraction.** No pass-through functions that only forward arguments. If two adjacent modules speak in the same terms, merge them or move the boundary.

7. **Comments first.** Write the interface comment before the body. It states what the function does, what each parameter means including units and ranges, and what is returned for degenerate input. Comments say what the code cannot: intent, units, invariants, reasons. They do not repeat the code.

8. **Design it twice.** For any new or changed interface, sketch a second design and pick deliberately.

9. **Strategic over tactical.** A working feature that leaves the structure worse is not finished. Small investments in structure are part of every task.

10. **Consistency.** Same names for the same things (see `GLOSSARY.md`), same units everywhere: lengths in CSS pixels, angles in degrees at the public interface and radians internally, time in seconds.

## Red flags

Walk through this list before calling a task done.

- **Shallow module:** the interface is not simpler than the implementation.
- **Information leakage:** the same decision appears in two modules.
- **Temporal decomposition:** code is split by the order things happen in rather than by what knowledge it hides.
- **Pass-through function:** it only calls another function with the same signature.
- **Conjoined functions:** one cannot be understood without reading the other.
- **Special-general mixture:** a general module contains code for one specific use.
- **Repetition:** the same non-trivial snippet appears twice.
- **Vague or hard-to-pick name:** usually a sign that the thing has no clear purpose.
- **Comment repeats code**, or the interface comment describes the implementation.
- **Non-obvious code:** behaviour that a reader cannot predict from the interface.
- **Overexposure:** using a common feature forces the caller to learn rare ones.

## TypeScript conventions

- `strict` and the stricter flags in `tsconfig.json` stay on. No `any`; no non-null assertions without a comment that proves the value exists.
- Each module exposes its interface through its `index.ts` only. Other modules never import from a module's internal files.
- Plain data and functions are preferred; a class is used when it owns a lifecycle (as in `mount`).
- Readonly data across module boundaries.
- Numeric hot paths use preallocated typed arrays and write into an output argument.
