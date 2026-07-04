# Level Design

Vimberman has exactly ten levels, and they are not just ten maps — they're
a vim curriculum with a Bomberman skin. Every level introduces **exactly
one** new motion or concept (`levels.js` → `teaches`), stated once on the
intro card (`intro: [...]`), and that level's layout is built to require
that specific technique rather than merely permit it. Content lives
entirely in `levels.js`; this doc explains the pedagogy and tuning behind
it.

## The curriculum, level by level

| # | Name | Teaches | Par / Limit | Slack ratio | New enemy/hazard | Terminals |
|---|---|---|---|---|---|---|
| 1 | BABY STEPS | `h j k l` | 40 / 110 | 2.75× | — (no enemies) | 0 |
| 2 | COUNT THE CORRIDORS | counts: `10l` `6j` | 9 / 26 | 2.89× | Zombie (free-roam) | 0 |
| 3 | LEAP OF FAITH | `f{c}` `F{c}` (vs `t`/`T`) | 30 / 75 | 2.50× | Imp (leashed), gaps `~` | 0 |
| 4 | BUGFIX BOMBS | `i` `x` `r` — earn bombs | 62 / 135 | 2.18× | Zombie (free-roam) | 2 |
| 5 | WORD BRIDGES | `w` `b` `e` | 26 / 60 | 2.31× | Zombie (leashed) | 0 |
| 6 | THE LONG WAY | `0` `$` `gg` `G` | 55 / 115 | 2.09× | Zombie (free-roam) | 1 |
| 7 | REWRITE THE RULES | `cw` | 80 / 140 | 1.75× | Imp + Zombie (both leashed) | 2 |
| 8 | AGAINST THE CURRENT | one-way tiles `< > ^ v` | 75 / 130 | 1.73× | Imp (leashed) + Zombie (free-roam) | 1 |
| 9 | WARPED WORDS | `~` and `ciw`; hard rock `&` | 105 / 160 | 1.52× | Mage (free-roam) + Zombie (leashed) | 2 |
| 10 | THE FINAL REFACTOR | everything, no new trick | 115 / 175 | 1.52× | Zombie×2 (leashed) + Imp + Mage | 2 |

("Slack ratio" = `limit / par` — how much room for error the budget gives
you beyond a perfect run. See "Tuning the budget" below.)

## Why this order

The sequence climbs two ladders at once, kept in lockstep:

**Motion ladder** (what you can do):
`hjkl` → counted motions → dash-to-char (`f`/`F`) → bomb-crafting basics
(`i x r`) → word-hopping (`w b e`) → line/file jumps (`0 $ gg G`) →
whole-word replace (`cw`) → irreversible commitment (one-way tiles) →
precision edits (`~`, `ciw`) → synthesis (level 10 adds nothing new).

**Threat ladder** (what's hunting you)**:**
no enemies → slow greedy chaser (zombie) → a leashed obstacle version of a
new enemy (imp) before it ever roams free → environmental hazards (gaps,
rock, hard rock) layered in → multiple enemies at once → all three enemy
types simultaneously in the finale.

The two ladders are **deliberately offset by one rung**: a new motion is
taught in a level with an already-familiar threat configuration (or none),
so the player is never learning a new vim trick and a new enemy behavior
in the same level. Level 3, for example, teaches `f`/`F` against a
leashed (predictable) imp — the imp itself isn't the lesson, the dash
motion is. Compare level 8, which introduces no new enemy at all
(reuses imp + zombie) so that the one-way-tile mechanic gets the player's
undivided attention.

Bomb-crafting (`i x r`, level 4) is deliberately placed **after** movement
basics and counts are solid (levels 1–3) but **before** the more exotic
motions — because every subsequent level assumes the player already knows
how to detour to a code-tile, open it, and fix a word under time pressure.
It's the one "new system" lesson in an otherwise "new motion" curriculum,
so it gets its own dedicated level rather than being folded into a motion
lesson.

`cw` (level 7) and `~`/`ciw` (level 9) are separated by a full level
(one-way tiles, level 8) rather than taught back to back, even though
they're both "edit the code-tile buffer" tricks — this avoids stacking two
new editor commands in a row, keeping the "one new thing per level" rule
intact even for edit-mode-only lessons.

## Tuning the budget: par and limit

Every level sets two numbers, and the *gap* between them is itself a
tuning knob, not an afterthought:

- `par` is the number that assumes efficient play using the level's full
  taught vocabulary — it's effectively "solved with the intended
  technique," not "theoretical minimum keystrokes."
- `limit` is `par` plus headroom for exploration, mistakes, a bonk or two,
  and one avoidable detour.

The slack ratio (`limit/par`) **shrinks monotonically across the game**,
from ~2.9× on level 2 down to ~1.5× on levels 9–10. Early levels are
forgiving because the player is still learning a motion for the first
time and will fumble it; late levels assume mastery of everything taught
so far and punish inefficiency more sharply, because by level 9 falling
back to single-step `hjkl` instead of the newer motions should no longer
be "acceptable, just costly" — it should risk the budget outright. This is
the mechanical enforcement of pillar #3 in `docs/premise.md`
("efficiency is the score").

When adding or rebalancing a level, don't pick `par`/`limit` from feel
alone — `test/solve.mjs` encodes a scripted, hand-authored keystroke
solution for every level and asserts it wins within `limit`
(see `docs/architecture.md` → Testing). Treat that solution as the
reference "intended efficient playthrough," and set `par` close to its
length, then set `limit` per the slack-ratio trend above.

## Level anatomy: recurring structural choices

- **Bushes as a drip-feed, not a stockpile.** Every level places 1–3
  bushes, and the type of item hidden is chosen to matter *for that
  level specifically* — e.g. level 9/10 place `R` (radius) bushes because
  those levels contain hard rock `&`, which needs radius ≥ 3 to crack.
  Don't scatter items generically; place them to make one specific later
  decision (a rock, a budget crunch, a rescue) possible.
- **Leashed enemies are how a level author "reuses" a threat type safely.**
  Any enemy can be pinned to a row or column via `enemyOpts` regardless of
  its type — this is used constantly to introduce an enemy type gently
  (as a fixed hazard to route around) before or instead of unleashing its
  full AI. See `docs/bestiary.md`.
- **Terminal (code-tile) placement is a detour cost, not a gate.** Every
  level with terminals places them off the critical path, at a distance
  that costs a deliberate number of extra motions — the player always has
  the option to skip a code-tile if they don't need the bomb it grants
  (some levels don't strictly require any bomb use to reach `E`; bombs
  are there to open shortcuts through rock, not to gate the exit).
- **Hazard tiles are introduced textually before mechanically.** Gaps
  (`~`) appear starting level 3, the same level that teaches `f`/`F` — the
  intro card explicitly says "a dash flies clean over gaps," teaching the
  hazard and its counterplay in the same sentence. One-way tiles (level 8)
  and hard rock (level 9) follow the same pattern: the intro card names
  the hazard and its counterplay together.

## Adding an 11th level (or rebalancing)

If extending the curriculum:
1. Identify the **one** new thing (motion, hazard, or enemy behavior) it
   teaches — if you can't name it in one clause, it's not ready.
2. Reuse existing enemy types/hazards for everything else in that level;
   only add a new enemy type if you've exhausted reasonable escalations of
   the existing three (see `docs/bestiary.md` → "Adding a new enemy
   type").
3. Hand-author a keystroke solution first (extend
   `test/solve.mjs`'s `SOLUTIONS` map) — this is both the correctness
   proof and the basis for setting `par`.
4. Set `limit` using the slack-ratio trend (tighter than the previous
   level, looser than "solution length + 5").
5. Write the map, then verify with `node test/solve.mjs <n> --trace`.
