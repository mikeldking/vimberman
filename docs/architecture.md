# Architecture

Vimberman is deliberately tiny and dependency-free: four files, no build
step, no framework. This doc explains the split between them and the
invariants worth preserving if you extend the code.

## File roles

| File | Role | Depends on |
|---|---|---|
| `levels.js` | Pure data — 10 levels as ASCII maps, terminal definitions, bush contents, budgets, enemy leash options. | nothing |
| `engine.js` | Pure game logic — motions, terminal editing, bombs/blast, enemy AI, undo, win/fail/death. No DOM access at all. | `levels.js` |
| `ui.js` | Canvas renderer, statusline HUD, menu screens, WebAudio synth, `localStorage` saves, keyboard event wiring. | `engine.js`, DOM, `window` |
| `index.html` | Shell markup + CRT/terminal CSS. Loads the three scripts in order. | all of the above |

The engine/UI split is the single most important architectural decision
in this codebase, and it's enforced by convention, not by tooling — so
preserve it deliberately:

- `engine.js` never touches `document`, `window` (beyond the
  `typeof window !== 'undefined'` UMD-style export check), `canvas`, or
  `localStorage`. Every place it needs to notify the outside world, it
  calls a hook on the `fx` object (`fx.moved()`, `fx.explosion()`,
  `fx.death()`, etc.) — all no-ops by default, so the engine runs
  headless with zero side effects.
- `ui.js` overwrites `VB.fx.*` with real implementations (sound, screen
  shake, toasts, screen transitions) but never reaches back into engine
  internals to mutate state directly — it only calls `VB.key()`,
  `VB.loadLevel()`, `VB.rescue()`, `VB.canRescue()`, and reads
  `VB.state`.

This split is *why* both test scripts exist and are cheap to write (see
Testing below): `solve.mjs` drives the entire game with zero DOM, and
`ui-smoke.mjs` only needs to stub the DOM API surface `ui.js` actually
touches (a handful of `getElementById` targets, a fake canvas context, a
fake `AudioContext`, a fake `localStorage`) — see the stubs at the top of
`test/ui-smoke.mjs`.

If you ever add a feature, ask "does this belong in engine or UI?" using
this test: **if it changes what a headless replay would compute, it's
engine; if it only changes what the player sees/hears, it's UI.**

## State shape

All engine state lives in one module-level object, `st` (accessed
externally via `VB.state`, a getter). Rebuilt from scratch on
`loadLevel(idx)`:

```
st = {
  idx, lv,                 // level index and the raw level def from LEVELS
  grid, W, H,              // mutable 2D char grid (bombs/items mutate this directly)
  player: { x, y, bombs, radius, undo, iframes },
  enemies: [ {type, x, y, ...type-specific fields} ],
  bombs: [ {x, y, fuse, r, soft, imp?} ],
  projectiles: [ {x, y, dx, dy} ],   // mage bolts
  terminals: { 'x,y': {key, broken, target, grants, hint, buffer, cursor, solved} },
  keys, tick, limit, par,  // budget bookkeeping
  mode: 'normal' | 'terminal',
  term: null | { t, insert, pending },  // active terminal-editor sub-state
  pending: { count, op },  // in-progress motion count/operator (g, f/F/t/T)
  lastFind, lastCmd, echo,
  status: 'play' | 'won' | 'dead' | 'fail',
  deathMsg,
  rng,                     // seeded mulberry32 generator, see Determinism
  history: [ ...snapshots ],  // for undo, capped at 80
  explosionsThisTick: [],  // consumed by ui.js for the flash effect
}
```

Everything the UI needs to render or react to is reachable from this one
object — there's no secondary derived-state cache to keep in sync.

## Determinism

Enemy AI that involves any randomness (imp's flee/chase mix, imp bomb
placement variety, mage's teleport target selection) draws from a
**seeded PRNG** (`mulberry32`), seeded per level as
`0x9E3779B9 ^ (idx * 2654435761)` in `loadLevel`. This means:

- The same level plays out **identically every attempt**, given the same
  keystrokes — a level is a fixed puzzle, not a random gauntlet.
- This is why `test/solve.mjs` can hard-code a keystroke script per level
  and assert a win — there's no flake risk from enemy randomness.
- If you add any new randomized behavior, pull randomness from `st.rng()`
  (never `Math.random()`), or you'll break both replayability and the
  test suite.

## Save data

`ui.js` owns all persistence — the engine has no concept of "levels
unlocked" or "best score." Shape, under `localStorage` key
`vimberman.save.v1`:

```
{ v: 1, unlocked: <int>, levels: { [n]: { bestKeys, stars } }, settings: { sound } }
```

Written on level clear (`showClear`) and settings changes; read once at
boot with a version check (`d.v === 1`) and merged over defaults so a
corrupt/missing save never crashes the boot sequence.

## Rendering

`ui.js`'s `draw()` runs every `requestAnimationFrame`, always — it's a
continuous render loop independent of the turn-based engine, which is
what makes movement *look* smooth (via `lerpPos`, an exponential
position-smoothing lerp keyed per-entity in a `WeakMap`) even though the
underlying simulation only advances in discrete ticks. This is a common
and important pattern to preserve: **simulation is turn-based, rendering
is continuous** — don't couple them.

Canvas sizing (`sizeCanvas`) recomputes cell size from viewport dimensions
on load and resize, so the game fills available space rather than using a
fixed resolution.

## Testing & CI

Two headless Node scripts, both run in `.github/workflows/pages.yml`
before every Pages deploy (`test` job gates `deploy`):

- **`test/solve.mjs`** — requires `engine.js` directly (no DOM at all),
  and replays a hand-authored keystroke script (`SOLUTIONS` map, one entry
  per level) through `VB.key()`. Asserts every level is winnable within
  its `limit` using only techniques taught by that point in the
  curriculum. This is the mechanism that keeps `docs/level-design.md`'s
  claims about solvability honest — if a level layout or budget changes
  and breaks the reference solution, this fails loudly.
- **`test/ui-smoke.mjs`** — stubs just enough of `document`/`window`/
  `AudioContext`/`localStorage` to boot the *real* `ui.js`, then drives it
  via the actual `keydown` listener (not by calling engine functions
  directly) to prove the full stack — menu navigation, level intro,
  gameplay, win detection, star/save calculation, and terminal-mode UI —
  works end to end. It also asserts a UX contract: arrow keys are
  rejected and free (don't consume a keystroke or move the player).

Run locally:
```sh
node test/solve.mjs            # all levels
node test/solve.mjs 7 --trace  # one level, with a per-tick state trace
node test/ui-smoke.mjs
```

When changing engine behavior, run both before trusting a change —
`solve.mjs` catches balance/solvability regressions, `ui-smoke.mjs`
catches integration regressions between the engine and the input/render
layer.

## Deployment

`.github/workflows/pages.yml`: on push to `main`, run both test scripts,
then (only if they pass) publish the repo root to GitHub Pages as a
static site. No build/bundle step — `index.html` loads the three `.js`
files as plain `<script>` tags, so what's committed is exactly what
ships.
