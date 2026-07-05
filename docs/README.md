# VIMBERMAN — Design Documentation

This is the design reference for Vimberman, kept separate from the top-level
`README.md` (which is the player/dev-facing quickstart). These docs exist so a
future contributor — human or agent — can pick up the project without having
to reverse-engineer intent from `src/engine/engine.ts`.

Read in this order if you're new to the project:

1. **[premise.md](premise.md)** — what the game is, why it exists, the pitch,
   the tone, who it's for.
2. **[mechanics.md](mechanics.md)** — the core loop and every system: the
   turn clock, motions, the bomb-from-editing loop, items, undo, win/fail.
3. **[bestiary.md](bestiary.md)** — the three enemy types, their AI, and the
   design role each plays.
4. **[level-design.md](level-design.md)** — the level curriculum, what
   each level teaches, how budgets/pars are tuned, and the shape of the
   difficulty curve.
5. **[ui-ux.md](ui-ux.md)** — screen flow, HUD/statusline, audio, juice,
   the "arrows are for tourists" stance on onboarding.
6. **[architecture.md](architecture.md)** — how the code is organized
   (engine vs. UI), the state shape, determinism/seeded RNG, save format,
   and the test/CI strategy that keeps all of the above honest.

Design expansions (the v2 rework):

7. **[level-audit.md](level-audit.md)** — the designer audit of the
   original ten levels and the multi-path solvability framework that
   grew the campaign to its current twenty levels.
8. **[new-mechanics.md](new-mechanics.md)** — toads (flippable enemies),
   the linter sweep (`0`/`$` with teeth), the relative-number gutter, and
   the cloud layer (`Ctrl-u`/`Ctrl-d`).
9. **[progression-and-juice.md](progression-and-juice.md)** — keycap
   motion unlocks (progressive disclosure), the layered hint system, golf
   scoring/stats, and the `:` command line.
10. **[terminal-minigames.md](terminal-minigames.md)** — the code-tile
    puzzle roster: repair, lint purge, cache grab, code golf, and the
    scan head, plus authoring/tuning rules and the future pipeline.

11. **[story.md](story.md)** — the narrative spine: The Cursor, The
    Legacy (the rot as antagonist), the three-chapter arc, tone rules,
    and the verbatim copy inventory for chapter cards and Legacy voice.

12. **[motions-v2.md](motions-v2.md)** — spec for the five motions-v2
    additions: marks, `%` bracket-jump, `.` dot-repeat, `/` search, and
    `q`/`@` macros — each with a named puzzle hook, costs, data shapes.

13. **[arsenal.md](arsenal.md)** — word-keyed bomb variants: the
    bomb/grep/sed design triangle (kills+digs / kills / digs), the typed
    FIFO arsenal, chain-reaction matrix, and yank/put as wave 2.

Working roadmap:

14. **[TODO.md](TODO.md)** — the phased enhancement roadmap (menu, story,
    new motions, bomb variants, sky v2, campaign growth). Pick the topmost
    unchecked item; each entry is self-contained with acceptance criteria.

## One-paragraph summary

Vimberman is a Bomberman-like where the only inputs are vim motions and
edits. The world advances one tick per completed keystroke command — so
`12l` costs the enemies one turn, but `llllllllllll` costs them twelve.
Bombs aren't picked up; they're earned by opening a broken code-tile with
`i` and fixing the word inside using real vim edit commands, then armed and
dropped with `x`. Motions themselves are collectible: each level's keycap
pickup adds its motion group to your permanent vocabulary. Twenty levels
teach vim from `hjkl` up through `ciw`, `Ctrl-u`/`Ctrl-d` (a cloud
layer), and macros, tightening keystroke budgets as the moveset grows, so the game's
difficulty curve **is** a vim curriculum — and every level is proven by
test to be solvable along multiple distinct routes, with par achievable.

## Source of truth

These docs describe the game as implemented in `src/engine/engine.ts`, `src/levels.ts`,
the UI layer (`src/ui`, `src/render`), and `index.html` as of this writing. If a doc and the code
disagree, the code wins — update the doc, not your assumptions. In
particular:

- Level content (maps, budgets, pars, teach order) lives in `src/levels.ts`.
- Every rule about what a keystroke does lives in `src/engine/engine.ts`, which is
  pure logic with no DOM dependency — it's the actual rulebook.
- `docs/architecture.md` explains why that split exists and how to keep it.
