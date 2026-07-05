# Level Audit & Multi-Path Solvability Framework

*A designer audit of the original ten levels, and the framework that drove
the 13-level rework. All keystroke counts below were measured by replaying
scripts through the real engine, not estimated. "Ref" = the scripted
solution that lived in `test/solve.test.ts` at audit time.*

## Headline findings

1. **Three levels had unreachable-looking pars.** The reference solutions
   for L6 (**59 keys vs par 55**), L9 (**108 vs 105**) and L10 (**130 vs
   115**) all *missed par*. A `speedrun ≤ par` test assertion (see
   framework below) would have caught all three; it now exists.
2. **The wait-tax was the game's biggest fun problem.** There is no "wait"
   key; killing time = bonking into walls or shuffling `h l h l`. Measured
   dead keys in the reference solutions: L6 ≈ 19, L7 ≈ 20, L8 ≈ 19,
   L9 ≈ 19, **L10 ≈ 52** (18 `l`-bonks + 34 single `h` steps — 40% of the
   finale's solution was filler). Root cause is always the same: a
   patroller in a 1-wide corridor you must cross, plus 6-tick fuses with
   nowhere useful to move.
3. **8 of 10 levels were single-route corridors.** Only L2 had genuine
   route choice; L6 had minor order freedom. L3, L5 and L9 were literally
   the same serpentine skeleton (one-door-per-row snake) three times.
4. **Motions are not actually gated per level by the engine.** The engine
   accepts every motion from level 1; "teaches X" is enforced purely by
   map layout — so layouts that don't require their motion teach nothing.
   (The keycap vocabulary system in `docs/progression-and-juice.md` now
   gates motions at the UI layer; the engine still defaults to
   everything-unlocked for tests.)
5. **Doc/code drift found while auditing** (fixed alongside the rework):
   - `docs/level-design.md` said L5 had a leashed *zombie*; the map had an
     imp.
   - `docs/mechanics.md` said hard rock needs "at least two `R` pickups";
     radius starts at 2, so **one** R reaches the required radius 3.
   - `docs/bestiary.md` claimed any enemy can be leashed, but `mageTick`
     never checked `e.leash` — mages could not be leashed. (Engine now
     supports it.)

## Part A — Level-by-level audit (original 10)

| # | Level | Ref keys / par / limit | Requires taught motion? | Routes | Verdict |
|---|---|---|---|---|---|
| 1 | BABY STEPS | 36 / 40 / 110 | Yes | 1 (two cosmetic left-half variants) | Fine tutorial; forced spiral through the single (6,5) choke. Harmless. |
| 2 | COUNT THE CORRIDORS | 6 / 9 / 26 | **Yes for par** — min 17 keys without counts | **3** (top sprint 6k; bush lane 9k = par; zombie-side gauntlet) | **Best level in the game.** Short, real choice, par = the loot route, speedrun beats it. This is the template the framework generalizes. |
| 3 | LEAP OF FAITH | 23 / 30 / 75 | Yes — gaps uncrossable without flight | 1 (strict serpentine) | Teaches well but is a corridor. Par loose (23 vs 30). Acceptable as an early teaching corridor. |
| 4 | BUGFIX BOMBS | 55 / 62 / 135 | Yes — E sealed behind rock; both bombs forced | 1; the B bush at (11,2) is a decoy detour | Correctly forced for the teaching level. The zombie parked beside T(8,7) is the drama. First real difficulty spike (fine here). |
| 5 | WORD BRIDGES | 22 / 26 / 60 | Yes (gaps) — but identical topology to L3 | 1 | **Weakest #1.** A re-tread of L3's snake with `w` instead of `f`. The leashed imp barely interacts. Zero decisions, zero tension. |
| 6 | THE LONG WAY | **59 / 55** / 115 | Partially — `gg`/`G` ideal but counts substitute | ~1.5 (east region sealed behind rock; shaft order free) | Great comb geometry, item-sweeping slides feel great. But par < ref, and ~19 keys were fuse-wait bonks. |
| 7 | REWRITE THE RULES | 76 / 80 / 140 | Encouraged, not required: `cw` = 7 keys vs `xxx`+insert = 9 per terminal | 1 — three chambers connected only through rocks; strict order | **Weakest #2.** Pure forced chain; the B bush was a dead reward (past every rock). ~20 wait keys for patrol phasing. Feels like filling out a form. |
| 8 | AGAINST THE CURRENT | 72 / 75 / 130 | Yes — chute commitment is load-bearing | 1 big loop, forced order; all 3 bombs forced | The one-way *chute of no return* is the campaign's best "commit" moment. But "plan the whole loop" was a bluff — there was only one loop. R bush was a dud (no `&` in the level). |
| 9 | WARPED WORDS | **108 / 105** / 160 | Yes (both terminals mandatory) | 1 — serpentine enforced by one-ways; a forced zombie kill needed 8 `j`-bonks of phase-waiting | Mage debut is genuinely good (readable, scary). Everything else is L3's snake with more steps. Par unreachable. |
| 10 | THE FINAL REFACTOR | **130 / 115** / 175 | Synthesis, yes | 1 loop | **Weakest #3, most damaging.** 40% of the optimal line was waiting: two leashed patrollers caged a 1-wide row crossed twice (18 `l`-bonks + 34 `h`-shuffles). "Golf it," said the intro; then the level forced idling. |

### Fun ranking

- **Most fun:** L2 (choice + counts payoff), L8 (chute commitment +
  bomb-crafting beside a zombie), L6 (comb geometry, item-sweeping
  slides).
- **Least fun:** L5 (nothing happens), L7 (form-filling), L10 (wait
  simulator as a finale).
- **Difficulty curve:** flat 1–3, spike at 4 (fine), *sag* at 5, ramp
  6–8, then 9–10 were less "hard" than *tedious* — the challenge shifted
  from planning to patience, betraying pillar #1 ("every keystroke is a
  decision" — a bonk-wait is not a decision).

## Part B — Multi-path solvability framework

Every level should be solvable via multiple distinct paths: a fast risky
route (3 stars, tight execution), a safe slow route (fits the limit with
slack), and often a clever route (uses bombs/items/an earlier motion in a
non-obvious way). **L2 was already the perfect Vimberman level — the
whole rework is L2's structure (fast line, loot line, danger line, par on
the skilled route) applied to the rest of the campaign.**

### Authoring principles for this tile system

1. **Loops, not corridors — but remember distance is nearly free.** With
   counts, a 10-tile straight costs 3 keys. Route cost = **turns + edits
   + waits**, not tiles. A "slow safe route" must be slow in *commands*
   or compensated with loot; a "fast route" must be fast in commands.
2. **Alternate gates, one skill each.** Every wall between regions should
   have ≥2 doors answering different vocabularies: a rock `%` you bomb
   **or** a gap span you word-fly; a one-way chute **or** the long way
   round; hard rock `&` (needs R) **or** a guarded corridor. Keep **one**
   mandatory door per *teaching* gate so the taught motion stays
   load-bearing.
3. **Vertical gaps are absolute walls; flight is row-only.** `w b e f t`
   only work horizontally, and `%`/`&` block flight (they're SOLID).
   Sky-bridges must be horizontal and wall-free along the span.
4. **Risk asymmetry via landings, not damage.** The speedrun's risk
   should be *landing precision*: a naive `w` lands inside a patrol
   lane, a counted `2w` clears it. Undo/rescue (3 charges) makes this
   fair.
5. **Items compensate the slow path; never place dead rewards.** K bushes
   on the scenic route (they literally refund its cost); R only in levels
   containing `&`; B bushes only *before* rock gates. Slides sweep items
   for free — a bush mid-shaft rewards `gg`/`G` without costing a detour.
6. **Patrollers in 1-wide corridors are forced kills + forced waits.
   Don't.** You cannot pass, you cannot lure them onto bombs (patrollers
   bounce off bomb tiles), and leashed imps don't fear blasts. Either
   give the corridor a bay/parallel row, make the lane flyable (letters +
   gaps → `2w`/`2b` over the whole cage), or make one blast cover it.
7. **Fuse time should be travel time.** Fuse 6 means ~4 dead ticks unless
   the map offers a useful 4-tick errand from the bomb site: a bush to
   sweep, a word to orbit, or the next leg of the route. Note the blast
   stops at the rock it cracks, and the player's own R pickups extend
   their own kill zone — flee distances must scale with collected R.
8. **Opening a gate can release its guard.** Cracking a rock extends a
   leashed patroller's lane through it. Use deliberately ("you let it
   out") or leash on the perpendicular axis.
9. **Free mages are global.** A free mage will eventually teleport beside
   any 1-wide mandatory passage (it can't port onto rocks/bushes/
   one-ways, so shafts can be shielded by keeping their tiles non-floor).
   Budget a spare bomb or undo for mage variance, or leash the mage
   (supported now).
10. **Enemy tick-rates are design material:** leashed zombie = half-speed
    sweeper (easy timing), leashed imp = full-speed sweeper (hard
    timing), free zombie = stalls forever on walls (great for
    bait-past-the-dead-end puzzles).

### Verification: N named routes per level

`test/solve.test.ts` asserts multiple named routes per level:

- **speedrun** — must win with `keys <= par` (par is always achievable,
  by proof).
- **safe** — must win with headroom (`keys <= limit - slack`), using a
  lower-risk line.
- **clever** (where applicable) — a route with a different *identity*
  (skips a terminal, skips a bomb, flies over a guard), optionally
  asserted via a probe (e.g. a terminal is still unsolved at the win).

This institutionalizes: par is achievable, the safe route has fumble
headroom, and routes stay distinct. When adding or rebalancing a level,
author the speedrun first, set `par` to its measured length, then set
`limit` per the slack-ratio trend in `docs/level-design.md`.

### Campaign pacing

- **Breathers:** L2 and the rebuilt WORD BRIDGES are the model (par < 12,
  one threat, big choice density).
- **Boss set pieces:** the mage debut should be staged as an arena, and
  the finale should synthesize without wait-filler — density, not length.
- **Level count:** each of toads / linter rows / cloud layer deserves its
  own one-new-thing level per `docs/level-design.md`'s rule; the campaign
  has since grown past 13 levels (see the curriculum table there).
