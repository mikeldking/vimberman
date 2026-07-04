# VIMBERMAN

A Bomberman-like for the browser where every move is a vim motion. Thirteen
levels that teach vim progressively — from `hjkl` to `ciw` and `Ctrl-u` —
under bomb fuses, keystroke budgets, and enemies that move only when you type.
Motions are Metroid-style powerups: collect a keycap `?` to add its motion to
your vocabulary, permanently.

## Play

```sh
npm install
npm run dev        # Vite dev server with HMR
npm run build      # production build into dist/
npm run preview    # serve the production build
```

### GitHub Pages

The repo deploys itself: `.github/workflows/pages.yml` typechecks, runs the
level-solver + engine + UI tests on every push to `main`, then builds and
publishes `dist/` to Pages. One-time setup: repo
**Settings → Pages → Source → GitHub Actions**.

## How it plays

- **Turn-based on your keystrokes.** Every completed command is one world tick:
  enemies step, fuses burn. Twelve presses of `l` give the zombies twelve moves;
  `12l` gives them one. Keystroke economy is literally survival.
- **Keystroke budget.** Each level has a hard budget and a par. Beat par for
  3 stars. Run dry and the cursor grows still.
- **Bombs come from editing.** Stand on a code-tile `:` and press `i` to open
  it, then fix the broken word (`bmob` → `bomb`) with real vim edits —
  `x`, `r`, `~`, `s`, `cw`, `ciw`. A correct word arms a bomb; drop it with `x`
  and get out of the plus-shaped blast.
- **`u` is your lives.** Undo rewinds one world tick — even death — but charges
  are scarce and no undo crosses an explosion.

### Motions

| Keys | Effect |
|---|---|
| `h j k l` | step (bonking a wall still costs a turn) |
| `5l`, `3j`… | counted motion — many tiles, one enemy turn |
| `w` `b` `e` | hop between words of lettered tiles, soaring over gaps and enemies |
| `f{c}` `F{c}` `t{c}` `T{c}` `;` `,` | dash along the row to letter `{c}` |
| `0` `$` `gg` `G` | slide to row/column ends, sweeping up items |
| `Ctrl-u` `Ctrl-d` | ride an updraft into the cloud layer / drop back down |
| `i` | edit the code-tile underfoot |
| `x` | drop an armed bomb |
| `u` | rewind one tick |
| `:` | free ex command line — `:help` `:map` `:hint` `:q` `:q!` |

Flying over a **toad** (`w`/`e`/`f`…) flips it helpless for six turns; walk
onto a flipped toad to squash it for +2 budget. The playfield reads like a
buffer with `relativenumber`: the gutter counts rows for you (see 4 → type
`4j`), the ruler counts columns, and a pending count lights up its landing
tiles.

### The world

Boulders bomb open · steel blocks need a widened blast · starfield gaps can
only be jumped by `w`/`f` motions · chevron one-way tiles only admit you moving
that direction · bushes hide items (keystrokes, bomb radius, undo charges,
extra bombs) · the glowing portal is the exit. Everything is rendered from a
procedural 16×16 pixel-art sprite atlas — zombies shamble, bombs spark, the
mage telegraphs its teleport with a rune circle.

### The bestiary

- **Zombie `Z`** — half-speed chaser. Punishes wasted keystrokes.
- **Imp `&`** — drops its own bombs. Its blasts open rocks too; bait it into
  mining for you, or into fragging its friends.
- **Toad `Q`** — hops two tiles every third turn, clearing pits. Walking
  can't shake it; a flight motion over it flips it onto its back.
- **Mage `M`** — teleports on a readable 5-turn cycle and fires bolts down its
  row and column. Never linger aligned with the rune.
- **The linter `!`** — not a creature, a hazard: sweeps its whole row on a
  six-turn cycle (three dark, two amber, then fire). Only the margins `|` at
  the row ends are safe — `0` and `$` snap you to them from anywhere.

Some enemies patrol fixed lanes; the free-roamers hunt.

## Architecture

TypeScript throughout (strict mode), bundled by Vite. The engine stays pure —
no DOM — and notifies the UI through overridable `fx` hooks.

| Path | Role |
|---|---|
| `src/levels.ts` | 13 levels as ASCII maps + terminals, bushes, keycaps, linters, sky layers, budgets |
| `src/engine/` | pure game logic — motions, terminals, bombs, AI, undo. No DOM. |
| `src/render/sprites.ts` | procedural pixel-art atlas: 16×16 sprites as validated character grids |
| `src/render/renderer.ts` | canvas draw loop: sprite animation, tweening, particles, shake, glow |
| `src/ui/` | screens/menus, HUD + statusline, WebAudio synth, saves, code-tile editor |
| `src/main.ts` | boot — wires fx hooks to sound and view effects |

Enemies use a seeded RNG, so every level plays identically on every retry —
plan like a puzzle, execute like a speedrun.

## Tests

```sh
npm test               # vitest: solvability + engine rules + UI smoke + sprite atlas
npx tsc --noEmit       # strict typecheck
```

`test/solve.test.ts` replays hand-authored keystroke scripts per level through
the real engine: the authored speedrun must win at or under par (par is
achievable, by proof), and named alternate routes (safe/clever) must win within
the budget — every level is solvable multiple distinct ways. `test/engine.test.ts` pins the
core rules (bonk costs, blast shapes, hard-rock thresholds, undo limits).
`test/ui-smoke.test.ts` boots the full app against a stub DOM and beats level 1
through the real keydown handler. `test/sprites.test.ts` validates every pixel
grid in the atlas. Progress saves to `localStorage` (`vimberman.save.v1`).
