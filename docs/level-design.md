# Level Design

Vimberman has 21 levels, and they are not just 21 maps — they're
a vim curriculum with a Bomberman skin. Every level introduces **exactly
one** new motion or concept (`src/levels.ts` → `teaches`), stated once on the
intro card (`intro: [...]`), and that level's layout is built to require
that specific technique rather than merely permit it. Content lives
entirely in `src/levels.ts`; this doc explains the pedagogy and tuning behind
it. For the audit that produced this campaign shape and the multi-path
authoring rules, see `docs/level-audit.md`; for the keycap unlock system,
`docs/progression-and-juice.md`.

## The curriculum, level by level

| # | Name | Teaches | Keycap granted | Par / Limit | New enemy/hazard | Routes proven |
|---|---|---|---|---|---|---|
| 1 | BABY STEPS | `h j k l` | — (`core` is free) | 36 / 110 | — (no enemies) | 1 |
| 2 | COUNT THE CORRIDORS | counts + the gutter | `count` | 6 / 26 | Zombie (free-roam) | 2 |
| 3 | LEAP OF FAITH | `f F t ;` — dash, stop short, repeat | `find` | 21 / 52 | Imp (leashed), gaps `~` | 1 |
| 4 | BUGFIX BOMBS | `i` `x` `r` — earn bombs | `edit` | 55 / 135 | Zombie (free-roam) | 1 |
| 5 | WORD BRIDGES | `w` `b` `e` | `word` | 8 / 18 | Imp (leashed) | 3 |
| 6 | THE LONG WAY | `0` `$` `gg` `G` | `line` | 60 / 118 | Zombie (free-roam) | 2 |
| 7 | FLIP THE SCRIPT | flight motions flip toads | — | 9 / 22 | Toads ×4 | 3 |
| 8 | REWRITE THE RULES | `cw` | `cw` | 31 / 65 | Zombie (col-leashed) | 3 |
| 9 | AGAINST THE CURRENT | one-way tiles | — | 72 / 130 | Imp (leashed) + Zombie | 1 |
| 10 | MIND THE MARGINS | `0`/`$` as linter anchors | — | 15 / 34 | Linter rows `!` `\|` | 2 |
| 11 | WARPED WORDS | `~` and `ciw`; hard rock `&` | `inner` | 108 / 165 | Mage (free-roam) | 1 |
| 12 | HEAD IN THE CLOUDS | `Ctrl-u` / `Ctrl-d` | `sky` | 9 / 26 | The sky layer; zombies ×4 | 2 |
| 13 | CUMULUS GOLF | kites — flight cuts the string | — | 10 / 30 | Kite (sky-native, full speed); sky exit | 2 |
| 14 | BOOKMARKED | `m{a}` / `` `{a} `` — marks | `mark` | 22 / 52 | The vault (a sealed one-way pocket) | 2 |
| 15 | BALANCED BRACKETS | `%` — matching bracket | `match` | 27 / 62 | The trapdoor closet; lint zombie | 2 |
| 16 | GREP | `/{word}` `n` — search | `search` | 8 / 20 | Moat bands (full gap rows) | 2 |
| 17 | DON'T REPEAT YOURSELF | `.` — repeat the last edit | `dot` | 43 / 76 | The two-stroke golf gate; overlapping fuses | 3 |
| 18 | CHOOSE YOUR WORDS | the arsenal — the crafted word IS the route | — | 14 / 34 | Three word-gated bands (sed / grep / bomb) | 3 |
| 19 | THE FINAL REFACTOR | everything, two wings | — | 34 / 60 | all threats | 3 |
| 20 | BABY STEPS, PROMOTED | worn keys — the tap tax | — | 24 / 28 | Bare hjkl refused; brutal budget | 2 |
| 21 | AUTOMATE YOURSELF | `q`/`@` — macros (epilogue) | `macro` | 14 / 26 | Phased linter wings; manual play dies | 2 |

"Routes proven" = distinct scripted lines asserted in `test/solve.test.ts`
(speedrun always; safe/clever/greedy where the map supports them).

## Why this order

The sequence climbs two ladders at once, kept in lockstep:

**Motion ladder** (what you can do):
`hjkl` → counted motions (with the relative-number gutter as instrument) →
dash-to-char (`f`/`F`) → bomb-crafting basics (`i x r`) → word-hopping
(`w b e`) → line/file jumps (`0 $ gg G`) → flight-as-weapon (toads) →
whole-word replace (`cw`) → irreversible commitment (one-way tiles) →
line anchors under fire (linter rows) → precision edits (`~`, `ciw`) →
the vertical axis (`Ctrl-u`/`Ctrl-d`) → flight as scissors (kites, the
sky's toad lesson at lethal stakes) → bookmarks as un-commitment
(`m`/`` ` ``, the vault) → paired doors (`%`, the trapdoor) → search as
transit (`/`+`n`, the moats) → edits as muscle memory (`.`, the
two-stroke golf gate) → arsenal route choice (18, CHOOSE YOUR WORDS) →
synthesis (19, THE FINAL REFACTOR — adds nothing new) → the worn-keys
remix (20) → the epilogue: automation
(`q`/`@`, one turn per wing).

**Threat ladder** (what's hunting you):
no enemies → slow greedy chaser (zombie) → a leashed obstacle version of a
new enemy (imp) before it ever roams free → environmental hazards (gaps,
rock) → toads (the enemy that walking cannot answer) → periodic row hazards
(linter) → the mage → all threats simultaneously in the finale.

Three placement rules worth preserving:

- **New-mechanic levels reinforce old motions.** Toads (7) weaponize the
  flight motions taught in 3 and 5; the linter (10) sharpens the `0`/`$`
  taught in 6; the sky (12) reuses word-flight aloft. A new system is never
  introduced alongside a new motion.
- **Keycap-less levels are deliberate.** Levels 7, 9, 10 and 13 grant no
  keycap — their lesson is judgment (flip timing, commitment, anchors,
  synthesis), not vocabulary. The HUD tray visibly not growing is itself
  the signal.
- **Breathers are short and choice-dense, not easy-long.** Levels 2, 5, 7,
  12–13 and 16 all have single-digit-to-low pars with real route choice;
  they sit between the long edit-heavy levels (4, 6, 8, 11, 17) as palate
  cleansers. The 17–18 heavy pair is deliberately fronted by the
  campaign's shortest breather (16, par 8).

## Tuning the budget: par and limit

Every level sets two numbers, and both are now **proven by test**, not
picked from feel:

- `par` equals the measured length of the level's authored `solution`
  (the speedrun) — `test/solve.test.ts` asserts the solution wins with
  `keys <= par`, so *3 stars is always achievable* and par can never
  silently rot when a map changes.
- `limit` is par plus headroom for exploration, mistakes, a bonk or two,
  and one avoidable detour. Alternate routes (safe/clever) are asserted to
  win within `limit`.

Slack (`limit/par`) is no longer strictly monotonic. The 21-level re-audit
(2026-07-04) shows three regimes: levels that teach a new *system* (7
toads, 10 linter, 12 sky, 13 kites) run generous (~2.4–3.0×) because the
player is learning rules; the mid-campaign new-motion levels (14–16) hold
~2.3–2.5×; and the tail tightens on purpose — 17 runs 1.77× because its
dot lesson demands finale-grade fuse choreography, the arsenal showcase
(18) runs 2.43×, the finale (19) runs 1.76×, the worn-keys remix (20) is
the deliberate outlier at 1.17×, and the epilogue (21) relaxes to 1.86×
so macros get experimentation room.
The precision levels (9 at 1.81×, 11 at 1.53×) remain the mid-campaign
skill checks. The finale's slack budget assumes the speedrun's four
deliberate mage-dodge keys, not wait-filler — see the wait-tax findings
in `docs/level-audit.md`.

## Level anatomy: recurring structural choices

- **Multi-path by construction.** Since the audit, maps are loops with
  alternate gates, not corridors: a rock you bomb OR a gap you word-fly, a
  zombie lane you time OR a bridge you fall from mid-span. One mandatory
  door per teaching gate keeps the taught motion load-bearing; everything
  else has at least two answers. The verified route scripts live in
  `test/solve.test.ts` — treat them as the map's documentation.
- **Keycaps sit at the mouth of the level.** A `?` tile within 1–3 tiles
  of spawn, on (or beside) the forced path, reachable with only prior
  vocabulary. When a level has two route mouths (5, 8), each gets a `?` of
  the same group — spares in the box.
- **Bushes as a drip-feed, not a stockpile.** The item type is chosen to
  matter *for that level*: K bushes refund the scenic route's cost, `R`
  only appears where blast radius changes rock play (`&` or distant `%`
  work), `B` only appears before a bomb beat. Slides sweep items for free,
  so a bush mid-shaft rewards `gg`/`G` without costing a detour.
- **Leashed enemies are how a level author "reuses" a threat type safely** —
  but never in a 1-wide corridor the player must cross (that's a forced
  wait, the anti-pattern the audit measured at 52 dead keys in the old
  finale). Give the lane letters and gaps so `2w`/`2b` flies the whole cage
  in one keystroke.
- **Enemy phase is an authoring knob.** `enemyOpts` can set a zombie's
  tick-parity (`phase`) so a level plays identically after an opening-move
  change — used in level 6 to keep its scripted chase intact after the
  keycap pickup added a tick.
- **Hazard tiles are introduced textually before mechanically.** Gaps
  arrive with `f` ("a dash flies clean over gaps"); the linter's cadence is
  spelled out on level 10's card; the sky's rules on level 12's. The intro
  card names the hazard and its counterplay in the same sentence.

## Adding a level (or rebalancing)

1. Identify the **one** new thing it teaches — if you can't name it in one
   clause, it's not ready.
2. Reuse existing enemy types/hazards for everything else; see
   `docs/bestiary.md` before inventing an enemy.
3. Author the speedrun first, then at least one alternate route with a
   different personality (safe loot line, or a clever skip). Add them to
   `LevelDef.solution` and `test/solve.test.ts`'s `ROUTES`.
4. Set `par` = measured speedrun length; set `limit` per the slack
   guidance above (generous for new systems, tight for synthesis).
5. Run `npx vitest run test/solve.test.ts` — it is the proof of all of the
   above.
6. If any level with free-roaming imps or mages sits AFTER your insertion
   point, its RNG stream would shift with its index and rot its solutions —
   those levels must carry a pinned `LevelDef.seed` (the finale already
   does). Pin your own level too if it uses free-roaming RNG enemies.
