# Architecture

Vimberman is a TypeScript + Vite project with a hard split between a pure,
headless game engine and everything presentational. This doc explains the
module layout and the invariants worth preserving if you extend the code.

## Module roles

| Path | Role | Depends on |
|---|---|---|
| `src/levels.ts` | Pure data — 18 levels as ASCII maps (+ optional sky layers), terminal definitions, bush contents, keycaps, linters, budgets, reference solutions, enemy leash options. | `engine/types` |
| `src/engine/types.ts` | All shared domain types (`GameState`, `Enemy`, `LevelDef`, `FxHooks`, …). | nothing |
| `src/engine/rng.ts` | Seeded mulberry32 PRNG. | nothing |
| `src/engine/engine.ts` | Pure game logic — motions, terminal editing, bombs/blast, enemy AI, undo, win/fail/death. No DOM access at all. | `rng`, `types` |
| `src/render/sprites.ts` | Procedural pixel-art atlas: every sprite is a 16×16 character grid rendered once into an offscreen canvas, with row-length and palette-key validation that throws on any miscounted grid. | DOM (canvas) |
| `src/render/renderer.ts` | The continuous draw loop: sprite animation frames, per-entity position tweening, directional flipping, particles, screen shake, glow. | `engine`, `sprites`, `ui/hud`, `ui/state` |
| `src/ui/state.ts` | Tiny shared mutable UI state (`screen`, `currentLevel`) so renderer/HUD/screens avoid import cycles. | nothing |
| `src/ui/save.ts` | `localStorage` persistence (progress, settings). | nothing |
| `src/ui/audio.ts` | WebAudio synth — every sound is generated, no assets. | `save` |
| `src/ui/hud.ts` | HUD bar + vim statusline. | `engine`, `state` |
| `src/ui/termbox.ts` | The code-tile editor overlay. | `engine` |
| `src/ui/screens.ts` | Overlay screens (title/select/help/settings/intro/pause/dead/fail/clear) and all keyboard routing. | most of the above |
| `src/main.ts` | Boot: registers levels, wires `fx` hooks to sound + view effects, starts the loop. | everything |

The engine/UI split is the single most important architectural decision in
this codebase — preserve it deliberately:

- `src/engine/**` never touches `document`, `window`, `canvas`, or
  `localStorage`. Every place it needs to notify the outside world, it calls a
  hook on the exported `fx` object (`fx.moved()`, `fx.explosion()`,
  `fx.death()`, …) — all no-ops by default, so the engine runs headless with
  zero side effects. `FxHooks` in `types.ts` is the complete contract.
- The UI overwrites `fx.*` with real implementations (sound, screen shake,
  toasts, screen transitions) but never reaches back into engine internals to
  mutate state directly — it only calls `key()`, `loadLevel()`, `rescue()`,
  `canRescue()`, and reads `state()`.

If you add a feature, ask "does this belong in engine or UI?" using this
test: **if it changes what a headless replay would compute, it's engine; if
it only changes what the player sees/hears, it's UI.**

## State shape

All engine state lives in one module-level `GameState` object (accessed
externally via `state()`), rebuilt from scratch on `loadLevel(idx)`. See
`src/engine/types.ts` for the authoritative, fully-typed shape — the notable
fields:

- `grid` — mutable 2D char grid; bombs and item drops mutate it directly.
- `mode: 'normal' | 'terminal'` with `term` holding the active editor session.
- `pending: { count, op }` — in-progress motion count/operator (`g`, `f/F/t/T`).
- `status: 'play' | 'won' | 'dead' | 'fail'`, `history` (undo snapshots,
  capped at 80), `rng` (see Determinism).

Everything the UI needs to render or react to is reachable from this one
object — there's no secondary derived-state cache to keep in sync.

## Determinism

Enemy AI that involves any randomness (imp's flee/chase mix, mage's teleport
target selection) draws from a **seeded PRNG** (`mulberry32`), seeded per
level as `0x9E3779B9 ^ (idx * 2654435761)` in `loadLevel`. This means:

- The same level plays out **identically every attempt**, given the same
  keystrokes — a level is a fixed puzzle, not a random gauntlet.
- This is why `test/solve.test.ts` can hard-code a keystroke script per level
  and assert a win — there's no flake risk from enemy randomness.
- If you add any new randomized behavior, pull randomness from `state().rng()`
  (never `Math.random()`), or you'll break both replayability and the tests.

## Rendering

`renderer.ts`'s `draw()` runs every `requestAnimationFrame`, always — a
continuous render loop independent of the turn-based engine, which is what
makes movement *look* smooth even though the simulation advances in discrete
ticks. **Simulation is turn-based, rendering is continuous** — don't couple
them.

- **Sprites** come from `buildSprites()`: 16×16 pixel grids drawn once into
  small offscreen canvases at boot, then blitted with
  `imageSmoothingEnabled = false` so scaling stays crisp. Two-frame walk/ambient
  cycles are selected by wall-clock time; explosion frames by age.
- **Tweening**: each entity gets an exponential position lerp (`WeakMap`
  keyed), which also derives facing for horizontal sprite flips.
- **Tile variants** (floor speckle, gap stars) come from `cellHash(x, y)` — a
  deterministic hash, so tiles don't flicker between frames.
- **Particles** (explosion sparks, item pickup bursts) are simulated in the
  draw loop with dt-based physics; they're pure view state, never engine state.
- Canvas sizing recomputes cell size from viewport dimensions on load and
  resize (DPR-aware), so the game fills available space.

## Save data

`src/ui/save.ts` owns all persistence — the engine has no concept of "levels
unlocked" or "best score." Shape, under `localStorage` key
`vimberman.save.v1`:

```
{ v: 2, unlocked: <int>, keycaps: [<vocab group ids>],
  levels: { [n]: { bestKeys, stars } }, settings: { sound } }
```

Written on level clear, keycap pickup, and settings changes; read once at
boot with a version check and merged over defaults so a corrupt/missing
save never crashes boot. v1 saves migrate transparently: reaching past a
teaching level implies owning its keycap (`GROUP_LEVEL` in `save.ts`).
The engine's vocabulary gate defaults to everything-unlocked; only
`main.ts` opts the UI into `save.keycaps` via `setVocab`.

## Testing & CI

`npm test` runs vitest; `.github/workflows/pages.yml` gates deploy on
typecheck + tests:

- **`test/solve.test.ts`** — imports the engine directly (no DOM) and replays
  a hand-authored keystroke script per level through `key()`. Asserts every
  level is winnable within its `limit` using only techniques taught by that
  point in the curriculum. This keeps `docs/level-design.md`'s solvability
  claims honest — if a layout or budget change breaks the reference solution,
  this fails loudly.
- **`test/engine.test.ts`** — unit tests for rules the solver only exercises
  implicitly: bonks cost a tick, counted slides stop at walls, one-way entry,
  blast radii vs rock/hard-rock, undo-after-explosion, terminal editing,
  death/rescue, item pickups. Uses tiny inline maps via `setLevels()`.
- **`test/ui-smoke.test.ts`** — stubs just enough DOM (`test/stubs.ts`) to
  boot the *real* `main.ts`, then drives it via the actual `keydown` listener
  to prove the full stack — menus, level intro, gameplay, win detection,
  star/save calculation, terminal-mode UI — works end to end. Also asserts a
  UX contract: arrow keys are rejected and free.
- **`test/sprites.test.ts`** — builds the full atlas; the grid validator
  throws on any miscounted row or unknown palette key, so pixel-art typos are
  caught in CI, not in the browser.

When changing engine behavior, run `npm test` before trusting a change —
solve tests catch balance/solvability regressions, the smoke test catches
integration regressions between the engine and the input/render layer.

## Deployment

`.github/workflows/pages.yml`: on push to `main`, typecheck + test, then
`vite build` (relative `base: './'`) and publish `dist/` to GitHub Pages.
