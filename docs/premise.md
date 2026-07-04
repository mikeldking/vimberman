# Premise

## The pitch

**A Bomberman-like where vim motions are the entire input language.** You
don't walk with arrow keys and place bombs with spacebar — you navigate a
dungeon of code with `hjkl`, `w`/`b`/`e`, `f`/`t`, `0`/`$`/`gg`/`G`, and you
manufacture your bombs by literally fixing broken code with `x`, `r`,
`cw`, `ciw`, `~`. It is simultaneously an arcade action game and a vim
trainer, and neither half is decoration for the other — the action *is*
the lesson.

## The hook

Two genres that already share a surprising amount of DNA get fused
directly:

- Bomberman: grid movement, plus-shaped bomb blasts, crumbling soft walls,
  enemies that punish hesitation, a ticking pressure to keep moving.
- Vim: modal editing, motions with counts, word objects, the philosophy
  that *the fewer keystrokes, the better you're playing*.

Bomberman already rewards efficient movement. Vim already rewards efficient
editing. Vimberman collapses "efficient movement" and "efficient editing"
into the same currency: **the keystroke**. That's the whole idea in one
sentence — everything else in the design is downstream of it.

## Tone and voice

- **CRT terminal aesthetic.** Green phosphor glow, scanlines, a vignette,
  monospace everything. See `index.html`'s `#crt` styling and the
  IBM Plex Mono / Menlo font stack.
- **Dry, deadpan, dev-humor copy.** "Arrow keys are for tourists." "It
  compiles. Barely." ":wq and go touch grass." The game talks to the
  player like a slightly smug senior engineer who is nonetheless rooting
  for you.
- **No hand-holding beyond the intro card.** Each level's intro screen
  states the one new trick and gets out of the way (`levels.js` →
  `intro: [...]`). The game trusts that showing the mechanic once, in
  context, teaches better than an explainer wall.
- **A real statusline.** The bottom bar mimics vim's actual statusline
  (mode indicator, echo area, last command, pending keys, cursor
  position) — see `ui.js` → `updateHud`. This isn't cosmetic: it's the
  same feedback surface a vim user already trusts, repurposed as the HUD.

## Who it's for

Two audiences, on purpose:

1. **Vim users** who want an arcade excuse to drill motions they already
   half-know (counts, `f`/`t`, word objects) until they're reflexive.
2. **Non-vim-users / vim-curious players** who'll absorb the muscle memory
   because the game *makes them use it to survive*, not because they read
   a cheat sheet. The bushes, the enemies, the fuses — all of it is
   spaced-repetition dressed as a dungeon crawl.

The `README.md` tagline captures this directly: "bombs · zombies · and the
world's most portable skill."

## Narrative frame (minimal, functional)

There isn't a plot beyond the framing device: the world is made of broken
code. Corridors are files, code-tiles (`T`, rendered as `:`) are broken
identifiers waiting for a fix, and "fixing" a word is literally how you
craft a weapon. The final level is titled **"THE FINAL REFACTOR"** and the
end card reads "You beat VIMBERMAN. `:wq` and go touch grass." — the whole
game is a light conceit that you are debugging your way out of a codebase,
and it's played for a joke, not lore. Don't over-invest in narrative here;
the fiction exists only to motivate the mechanics (why do words unlock
bombs? because this dungeon *is* source code).

## Design pillars

These are the values every new level, enemy, or mechanic should be checked
against:

1. **Every keystroke is a decision.** No filler input. If a motion doesn't
   cost/save a turn in a legible way, it's not pulling its weight.
2. **Teach by doing, not by telling.** One new trick per level, introduced
   in a single intro-card sentence, then immediately load-bearing in the
   map layout for that level (see `docs/level-design.md`).
3. **Efficiency is the score.** Stars are earned by beating *par*
   keystrokes, not by speed-running in real time. The game has no clock —
   it has a budget. This keeps it a puzzle-then-execute game, not a
   reflex game (see `docs/mechanics.md` → Turn system).
4. **Determinism makes it a puzzle.** Enemies use a seeded RNG per level
   attempt, so the same level plays out identically every retry. You're
   allowed — expected — to memorize and solve it like a puzzle, then
   execute it like a speedrun (see `docs/architecture.md` → Determinism).
5. **The fiction and the mechanic are the same object.** Bombs come from
   *editing*, not from a pickup. Undo is *both* your rewind button and your
   extra life. The dungeon is code. Don't add a system that needs a
   separate coat of flavor text to make sense.
