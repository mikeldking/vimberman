# VIMBERMAN

A Bomberman-like for the browser where every move is a vim motion. Ten levels
that teach vim progressively — from `hjkl` to `ciw` — under bomb fuses,
keystroke budgets, and enemies that move only when you type.

## Play

Open `index.html` in any modern browser. No build, no dependencies, works offline.

```sh
open index.html        # macOS
# or: npx serve .
```

### GitHub Pages

The repo deploys itself: `.github/workflows/pages.yml` runs the level-solver
and UI tests on every push to `main`, then publishes the repo root to Pages.
One-time setup: repo **Settings → Pages → Source → GitHub Actions**.

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
| `i` | edit the code-tile underfoot |
| `x` | drop an armed bomb |
| `u` | rewind one tick |

### The world

`▒` rocks bomb open · `▓` hard rock needs a widened blast · black gaps can only
be jumped by `w`/`f` motions · `‹ › ˄ ˅` one-way tiles only admit you moving
that direction · `♣` bushes hide items (keystrokes, bomb radius, undo charges,
extra bombs) · `E` is the exit.

### The bestiary

- **Zombie `Z`** — half-speed chaser. Punishes wasted keystrokes.
- **Imp `&`** — drops its own bombs. Its blasts open rocks too; bait it into
  mining for you, or into fragging its friends.
- **Mage `M`** — teleports on a readable 5-turn cycle and fires bolts down its
  row and column. Never linger aligned with the rune.

Some enemies patrol fixed lanes; the free-roamers hunt.

## Architecture

| File | Role |
|---|---|
| `levels.js` | 10 levels as ASCII maps + terminals, bushes, budgets |
| `engine.js` | pure game logic — motions, terminals, bombs, AI, undo. No DOM. |
| `ui.js` | canvas renderer, vim statusline HUD, menus, WebAudio synth, saves |
| `index.html` | shell + CRT styling |

Enemies use a seeded RNG, so every level plays identically on every retry —
plan like a puzzle, execute like a speedrun.

## Tests

```sh
node test/solve.mjs        # plays all 10 levels with scripted vim keystrokes
node test/solve.mjs 7 --trace
node test/ui-smoke.mjs     # boots the real UI headlessly and beats level 1
```

`solve.mjs` proves every level is completable within its keystroke budget using
only the commands taught so far. Progress saves to `localStorage`
(`vimberman.save.v1`).
