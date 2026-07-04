<p align="center">
  <a href="https://mikeldking.github.io/vimberman/">
    <img src="assets/vimberman-banner.svg" alt="VIMBERMAN — Vim motions. Bomb fuses. Keystroke economy." width="100%">
  </a>
</p>

<p align="center">
  <a href="https://mikeldking.github.io/vimberman/"><strong>▶ Play Vimberman</strong></a>
  ·
  <a href="https://github.com/mikeldking/vimberman">GitHub</a>
  ·
  <a href="docs/README.md">Design docs</a>
  ·
  <a href="docs/mechanics.md">Mechanics</a>
  ·
  <a href="docs/level-design.md">Level design</a>
</p>

<p align="center">
  <a href="https://github.com/mikeldking/vimberman/actions/workflows/pages.yml"><img alt="Pages deploy" src="https://github.com/mikeldking/vimberman/actions/workflows/pages.yml/badge.svg"></a>
  <a href="https://mikeldking.github.io/vimberman/"><img alt="GitHub Pages" src="https://img.shields.io/badge/play-GitHub%20Pages-2ea44f?logo=github"></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-browser%20arcade-646cff?logo=vite&logoColor=white">
</p>

# VIMBERMAN

**Vim motions. Bomb fuses. Keystroke economy.**

Vimberman is a browser-based Bomberman-like where every move is a Vim command.
You do not walk with arrow keys and place bombs with spacebar; you survive by
using `hjkl`, counts, word motions, find motions, line jumps, edits, and undo as
an arcade input language.

The world advances **one tick per completed command**. Twelve taps of `l` give
the zombies twelve turns. `12l` gives them one. Vim's editing philosophy — move
farther, with fewer keys — becomes the difference between a clean escape and a
very educational explosion.

Built entirely with **Hermes Agent** and **Fable 5**. PRs are extremely welcome:
bring weird levels, meaner enemies, better juice, sillier jokes, and anything
that makes the game **unimaginably more fun**.

> Bombs · zombies · and the world's most portable skill.

## Play

- **Live game:** <https://mikeldking.github.io/vimberman/>
- **Source:** <https://github.com/mikeldking/vimberman>
- **Design reference:** [`docs/README.md`](docs/README.md)

The published build is deployed by GitHub Actions from `main` to GitHub Pages.

## At a glance

| Feature | What it means |
|---|---|
| **13 puzzle-action levels** | A compact campaign that teaches Vim progressively, from `hjkl` to `ciw` and `Ctrl-u`/`Ctrl-d`. |
| **Turn-based on keystrokes** | Every completed command advances enemies, bombs, hazards, and fuses by one tick. Counts are survival tech. |
| **Bombs from editing** | Stand on a code tile, enter terminal mode with `i`, fix a broken word using real Vim edits, then drop the armed bomb with `x`. |
| **Metroid-style motion unlocks** | Keycap pickups permanently add motion groups to your vocabulary. You learn by needing the new tool. |
| **Deterministic enemies** | Seeded RNG makes every retry play the same way: solve it like a puzzle, execute it like a speedrun. |
| **Golf scoring** | Each level has a hard key budget and a par target for 3-star clears. |
| **Pure engine, browser UI** | TypeScript engine logic is DOM-free and tested separately from the Vite/canvas UI. |

## How it plays

- **Move with Vim, not arrows.** `h`, `j`, `k`, `l` step one tile; counts like
  `5l` or `3j` slide multiple tiles as one world turn.
- **Hop words and find letters.** `w`, `b`, `e`, `f{char}`, `t{char}`, `;`, and
  `,` become flight paths over gaps, enemies, and trap layouts.
- **Edit to arm bombs.** Code tiles open a one-line Vim-ish terminal where `x`,
  `r`, `~`, `s`, `cw`, and `ciw` repair broken identifiers into `bomb`.
- **Undo is a resource.** `u` rewinds one world tick — even death — but charges
  are limited and explosions erase history.
- **Read the terminal.** The gutter behaves like `relativenumber`, the statusline
  echoes pending keys, and the ruler helps you count like a real Vim user.

## Controls / motion vocabulary

| Keys | Effect |
|---|---|
| `h j k l` | Step left/down/up/right. Bonking a wall still costs a turn. |
| `5l`, `3j`, ... | Counted motion: travel many tiles for one enemy tick. |
| `w` `b` `e` | Hop between word starts/ends on lettered tiles; flight crosses gaps and enemies. |
| `f{c}` `F{c}` `t{c}` `T{c}` | Dash along a row to, or just before, character `{c}`. |
| `;` `,` | Repeat or reverse the last find/till motion. |
| `0` `$` | Snap to the start/end of the current row. Excellent when a linter row goes hot. |
| `gg` `G` | Slam to the top/bottom of the current column. |
| `i` | Open the code tile underfoot and enter terminal-editing mode. |
| `x` | Drop an armed bomb in the world; delete a character in terminal mode. |
| `u` | Rewind one tick if you have undo charges. |
| `Ctrl-u` `Ctrl-d` | Ride an updraft into the cloud layer / drop back down. |
| `:` | Open ex commands: `:help`, `:map`, `:hint`, `:q`, `:q!`. |

## The world

The dungeon is source code with teeth:

- `▒` soft rocks crumble under any blast.
- `▓` hard rocks need a widened blast radius.
- `~` gaps stop walking but not word/find flight motions.
- `‹ › ˄ ˅` one-way tiles turn routes into commitments.
- `*` bushes hide key budget, undo, bomb, and radius pickups.
- `?` keycaps unlock motion families.
- `:` code tiles are broken identifiers waiting to become bombs.
- `E` is the glowing exit portal.

The bestiary is tuned to punish inefficient editing:

| Enemy / hazard | Role |
|---|---|
| **Zombie `Z`** | Half-speed chaser. It loves wasted keystrokes. |
| **Imp `&`** | Drops bombs of its own. Bait it into mining rocks or fragging friends. |
| **Toad `Q`** | Hops over pits; flight motions flip it onto its back for a squash bonus. |
| **Mage `M`** | Teleports on a readable cycle and fires down rows/columns. Never idle aligned. |
| **Linter `!`** | Row-sweeping hazard with warning phases. Margins and `0`/`$` are your friends. |

## Project map

| Path | Role |
|---|---|
| [`src/levels.ts`](src/levels.ts) | 13 levels as ASCII maps, terminals, bushes, keycaps, sky layers, budgets, and solution scripts. |
| [`src/engine/`](src/engine/) | Pure game logic: motions, terminals, bombs, AI, undo, deterministic ticks. No DOM. |
| [`src/render/sprites.ts`](src/render/sprites.ts) | Procedural 16×16 pixel-art sprite atlas, validated by tests. |
| [`src/render/renderer.ts`](src/render/renderer.ts) | Canvas renderer: animation, tweening, particles, shake, glow, gutter, ruler. |
| [`src/ui/`](src/ui/) | Menus, HUD/statusline, save state, terminal editor, WebAudio synth hooks. |
| [`docs/`](docs/) | Design docs for premise, mechanics, bestiary, level design, UI/UX, architecture, and v2 systems. |

## Design docs

Start here if you want to understand or extend the game:

1. [`docs/premise.md`](docs/premise.md) — the pitch, tone, audience, and design pillars.
2. [`docs/mechanics.md`](docs/mechanics.md) — rulebook for movement, bombs, undo, items, win/fail states.
3. [`docs/bestiary.md`](docs/bestiary.md) — enemies, AI roles, and tuning intent.
4. [`docs/level-design.md`](docs/level-design.md) — curriculum, par/budget tuning, level curve.
5. [`docs/ui-ux.md`](docs/ui-ux.md) — CRT shell, HUD/statusline, onboarding, audio, juice.
6. [`docs/architecture.md`](docs/architecture.md) — engine/UI split, determinism, save format, test strategy.
7. [`docs/new-mechanics.md`](docs/new-mechanics.md) — toads, linter rows, gutter/ruler, cloud layer.
8. [`docs/progression-and-juice.md`](docs/progression-and-juice.md) — unlocks, hints, scoring, command line.

## Development

Requirements: Node.js 22+ is what CI uses.

```sh
npm install
npm run dev        # Vite dev server with HMR
npm run build      # strict typecheck + production build into dist/
npm run preview    # serve the production build locally
npm test           # vitest: solvability, engine rules, UI smoke, sprite atlas
```

Useful one-offs:

```sh
npx tsc --noEmit   # typecheck only
npx vite --host    # dev server visible on your LAN
```

## Tests and guarantees

The tests are part of the design, not just safety rails:

- `test/solve.test.ts` replays hand-authored keystroke scripts through the real
  engine. Par is achievable by proof, and alternate routes must fit the budget.
- `test/engine.test.ts` pins core movement, bonk, blast, hard-rock, and undo
  rules.
- `test/ui-smoke.test.ts` boots the app against a stub DOM and clears level 1
  through the real keydown handler.
- `test/sprites.test.ts` validates every sprite-grid in the procedural atlas.

Progress saves to `localStorage` under `vimberman.save.v1`.

## Deployment

`.github/workflows/pages.yml` runs on every push to `main`:

1. `npm ci`
2. `npx tsc --noEmit`
3. `npm test`
4. `npm run build`
5. Upload `dist/` to GitHub Pages

The Pages URL is the canonical playable build:

<https://mikeldking.github.io/vimberman/>

## Contributing notes

Vimberman was built entirely with **Hermes Agent** and **Fable 5**, and the door
is wide open for more chaos. PRs are welcome — especially PRs that make the game
**unimaginably more fun**: new levels, absurd enemies, sharper tutorials,
better juice, tastier sound, funnier terminal copy, smarter tests, or wild ideas
that somehow still fit the Vim/Bomberman premise.

Vimberman works best when every addition preserves the core contract:

1. **Every keystroke is a decision.** No filler input.
2. **Teach by doing.** One new trick should become load-bearing in the level that introduces it.
3. **Efficiency is the score.** Budgets and pars should reward Vim fluency, not real-time reflexes.
4. **Determinism makes it a puzzle.** If randomness changes retries, seed it and test it.
5. **Fiction and mechanic should be the same object.** If a feature needs a paragraph of lore to justify it, simplify it.

If you add a level, add or update a solver route so the CI proves it can be won.

## Status

Playable browser prototype with a tested 13-level campaign, procedural sprite
atlas, CRT canvas UI, GitHub Pages deployment, and design docs. The repo is
ready for level iteration, balancing, polish, and more mean little Vim jokes.
