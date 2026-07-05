# Vimberman — Enhancement TODO

This is the working roadmap. It was produced by a whole-game review (2026-07-04)
and is meant to be executed **one item at a time** by whoever picks it up next
(human or agent).

## How to work this list

1. Pick the **topmost unchecked item** in the earliest unfinished phase, unless
   an item is marked `blocked:`.
2. Do that one item completely, then stop. Small and shipped beats big and half.
3. For anything touching the engine or levels: **spec in docs first** if the
   item says so, follow the authoring checklist in `docs/level-design.md`
   ("Adding a 14th level"), and keep `docs/mechanics.md` in sync.
4. Tests are the contract: `npx vitest run` must pass. New levels need routes in
   `test/solve.test.ts` (speedrun ≤ par is mandatory). New engine behavior needs
   `test/engine.test.ts` coverage.
5. When done: check the box, add a one-line `done:` note (date + anything the
   next agent must know), and commit with a focused message.
6. Design pillars are law (`docs/premise.md`): every keystroke is a decision;
   teach by doing; efficiency is the score; determinism; the fiction IS the
   mechanic. The audit anti-patterns (`docs/level-audit.md`) are the law's case
   history — especially: no forced waits, no 1-wide patrolled corridors, no
   single-route corridors.

## Review summary (why these items)

- **Menu/shell**: title screen is 3 static items; no CONTINUE, no progress
  display, no attract mode; settings are sound+reset only.
- **Story**: zero arc — no protagonist identity, no antagonist, no chapters.
  The deadpan voice is great but nothing accumulates across 13 levels.
- **Mechanics/shapes**: all maps are ~13×9 rectangles; missing vim motions with
  huge game potential (marks, `%`, `.`, `/`, macros); "the motion is the
  weapon" (toad-flip) is the game's best idea and is used exactly once.
- **Bombs/items**: one bomb type, four item types. The word-crafting fiction
  trivially supports bomb variants keyed to the word you type.
- **Sky**: one cloud level, v1-empty (no hazards/terminals/exits aloft); the
  shadow-gathering behavior has no payoff.
- **Curriculum**: 13 levels ends at fluency; `t/T ; ,` never forced; no
  challenge modifiers; no drills.

---

## Phase 1 — Menu & shell (quick wins)

- [x] **1.1 CONTINUE + progress on the title screen.**
  Add a `CONTINUE` menu item (jumps straight to `showIntro(save.unlocked)`)
  shown only when `save.unlocked > 1`, and a progress line under the tagline:
  `★ 17/39 · 6/13 levels refactored`. Files: `src/ui/screens.ts` (`showTitle`,
  `titlePick`), read from `save`. AC: fresh save shows no CONTINUE; a save with
  progress defaults the cursor to CONTINUE; star total matches level select;
  `test/ui-smoke.test.ts` still passes.
  done: 2026-07-04 — title menu is now data-driven (`titleItems()`); also fixed
  a latent bug where `showTitle` was the rerender callback and reset `menuIdx`
  on every j/k, so the title cursor never moved. Split into
  `showTitle`/`renderTitle` like the other screens. 70/70 tests pass.

- [x] **1.2 Settings: CRT-effects toggle.**
  `save.settings.crt: boolean` (default true) toggling the scanline/vignette/
  glow classes on `#crt`. Files: `src/ui/screens.ts` (settings menu),
  `src/ui/save.ts` (setting + migration), `src/style.css` (a `.no-crt` escape
  hatch), applied on boot in `src/main.ts`. AC: toggle persists across reload;
  no visual change when ON.
  done: 2026-07-04 — `#crt.no-crt` hides the scanline/vignette pseudo-elements
  and drops the outer phosphor bloom (inner shade kept so contrast survives).
  `applyCrt()` exported from screens.ts, called at boot and on toggle; setting
  migrates via the existing `{...defaults, ...d.settings}` spread. 70/70 pass.

- [x] **1.3 Title attract mode.**
  After ~8s idle on TITLE, ghost-replay a short authored script (level 2's
  solution is ideal — it's 4 commands and shows off counts) on a dimmed board
  behind the menu, looping; any keypress kills it. Reuse `LevelDef.solution`
  parsing from `test/solve.test.ts` (extract the script-runner into a shared
  helper — also pays down test duplication). Files: `src/ui/screens.ts`,
  `src/render/renderer.ts`, maybe `src/engine/engine.ts` (headless step API
  already exists). AC: deterministic loop, zero effect on save/game state.
  done: 2026-07-04 — new `src/ui/attract.ts` drives the real engine behind the
  overlay (8s idle → one key per 340ms, 4-step hold on the won board, loop).
  Three guards keep it side-effect-free: all fx hooks muted (no sounds, no
  fx.win→showClear→save write), `setVocab(null)` during / restored from
  `save.keycaps` after, and it only starts while TITLE is up. `expand()` moved
  to `src/engine/script.ts` (solve tests now import it). New
  `test/attract.test.ts` (fake timers) asserts: demo runs+loops, save never
  written, keypress freezes it and restores gated vocab. 73/73 pass.

## Phase 2 — Story arc & characters (cheap, high flavor)

- [x] **2.1 Write `docs/story.md` — the arc, the cast, the voice.**
  Docs only. Keep the deadpan senior-engineer tone; the fiction stays
  functional (premise.md's rule) but gains a spine: a protagonist identity
  (you are The Cursor — the last responsive process in a dying codebase), an
  antagonist (proposal: **THE LEGACY** — the rot itself; it never appears as a
  sprite, it *is* the enemies/lint/broken words; its voice can leak into FAIL
  and DEAD cards), and a 3-chapter structure over the current 13 levels:
  Ch.1 "Onboarding" (1–4), Ch.2 "The Rot Spreads" (5–10), Ch.3 "Merge Conflict"
  (11–13). Give each enemy one line of lore consistent with its bestiary
  behavior. Define where copy lives so it's data, not scattered strings.
  AC: doc covers cast, chapter beats, tone rules, and a copy inventory that
  items 2.2/2.3 can implement without new decisions.
  done: 2026-07-04 — `docs/story.md` written and indexed in docs/README.md.
  Key decisions locked in: The Legacy speaks only in lowercase `//` comments,
  only on FAIL/DEAD (never on CLEAR — silence is the reward); every enemy is a
  named symptom of the rot mapped to its real mechanics; the sky is "the
  comment layer — nothing executes there"; copy lives in a future
  `src/ui/story.ts` (interface specced); save shape for 2.2 is
  `save.chapters: number[]`. All chapter-card and Legacy copy is verbatim in
  the doc — 2.2/2.3 are now unblocked, pure implementation.

- [x] **2.2 Chapter interstitial cards.** (blocked: 2.1)
  A 4–6 line card shown before levels 1, 5, 11 (first entry only per save).
  Files: `src/ui/screens.ts` (new screen, keyed off `docs/story.md` copy),
  `src/ui/save.ts` (seen-chapters). AC: shows once, Esc/Enter skips, replays
  from level select do not re-show.
  done: 2026-07-04 — `src/ui/story.ts` created (CHAPTERS + LEGACY_FAIL/
  LEGACY_DEAD + ENEMY_LORE, all verbatim from docs/story.md — Legacy lines are
  ready for 2.3). New 'CHAPTER' screen intercepts inside `showIntro`, so every
  entry path (select / CONTINUE / clear-advance) gets the card exactly once;
  seen-list is `save.chapters` (reset by resetProgress). Smoke test updated
  for the new flow + a dedicated never-re-shows test. 74/74 pass.

- [x] **2.3 Antagonist voice on DEAD/FAIL cards.** (blocked: 2.1)
  Rotate 2–3 THE LEGACY one-liners into `showDead`/`showFail` (below the
  existing postmortem, never replacing the mechanical lesson). AC: lines come
  from one copy table; postmortem hints unchanged.
  done: 2026-07-04 — `legacySays()` in screens.ts appends one line from
  story.ts's LEGACY_FAIL/LEGACY_DEAD below all mechanical content, rotated
  deterministically by `failsThisLevel`. New `test/story.test.ts` encodes the
  story.md tone contract (// prefix, lowercase-except-I-and-acronyms, no
  bangs, card size, chapter levels 1/5/11) — it immediately caught a 64-char
  chapter line and the CI-acronym ambiguity; both copy (story.ts + story.md)
  and the tone rule were reconciled. 80/80 pass. PHASE 2 COMPLETE.

## Phase 3 — New motions as abilities ("the motion is the weapon", ×4)

- [x] **3.1 Spec doc: `docs/motions-v2.md`.**
  Docs only — exact tick rules, keycap groups, and pedagogy for the four
  motions below, in bestiary/new-mechanics style (edge cases, rejected
  alternatives, data shapes). Cover: marks (`m{a}`, backtick-`{a}` recall as a
  1-tick teleport to a set mark; proposal: setting is free, recall costs 1 key
  + 1 tick, marks cleared by explosions like undo history), `%` (jump between
  paired bracket tiles `(){}[]` placed in maps — instant paired-door
  teleports; flight rules apply), `.` dot-repeat (repeat last *completed*
  world command for one keystroke — the efficiency fantasy), and `/{word}\n` +
  `n` search (cross-map flight to a word's start tile; the only motion that
  crosses rows). AC: each motion has one named ability/puzzle hook the way
  toad-flip hooks flight.
  done: 2026-07-04 — `docs/motions-v2.md` written and indexed. Named hooks:
  marks = The Round Trip (one-ways stop feet, not bookmarks; explosions erase
  marks like undo history), `%` = The Trapdoor Exit (drop bomb on `(`, jump to
  `)` — first guaranteed fuse escape; 0-or-2-per-kind load validation), `.` =
  The Dot Formula, `/`+`n` = Grep the Dungeon (costs mirror f/;: 2 keys+tick
  fresh, 1 key+tick repeat; occupied matches are skipped). NOTE one refinement
  vs this item's original sketch: `.` repeats the last terminal EDIT only
  (vim-faithful), never world commands — 3.5 implements that version. New
  vocab groups: mark/match/dot/search with locked-key echoes specced.

- [x] **3.2 Implement marks + recall in the engine.** (blocked: 3.1)
  `test/engine.test.ts` coverage: set/recall/explosion-clears/undo-snapshot.
  done: 2026-07-04 — engine implements motions-v2 §1 exactly: `m{a}` free
  (handled in `key()` before `keys++`, same class as locked keys), backtick
  recall = 2 keys + 1 tick through the normal bonk gate; jump semantics (no
  sweep, no toad flips, flipped-toad landing squashes); explosion wipes marks
  + sets `marksWiped` for the "blast moved the line numbers" echo; marks in
  snapshots (undo-restorable). New `mark` vocab group everywhere (VocabGroup,
  tray, LOCKED_ECHO, GROUP_LEVEL→14 placeholder — no keycap grants it until
  level 14 lands, so UI players can't reach it yet; tests use setVocab(null)).
  7 new engine tests; mechanics.md motions table updated. 87/87 pass.
- [x] **3.3 Level 14 "BOOKMARKED" teaching marks.** (blocked: 3.2)
  A map whose loot loop only pays off if you mark the fork before committing —
  e.g. a one-way chute you *want* to take twice. Full authoring checklist.
  done: 2026-07-04 — landed as level 13 (BEFORE the finale, which moved to 14
  — "no new tricks" must stay last; solve ROUTES + ui-smoke indices + all doc
  level-counts renumbered). The map is "the vault": a one-way chute into a
  sealed pocket holding the only bomb; the rock gate to E needs it; recall is
  the only exit (undo = escape hatch for the unmarked, intro card warns).
  Speedrun 22 keys (mark at the gate; fuse spent on a pocket-loot errand with
  exactly 1 dead key — the leashed pocket zombie steps into the vacated bush
  tile, "the guard takes your place"); safe route 30 keys (mark at the chute
  instead — mark PLACEMENT is the route personality). par 22 / limit 52
  (~2.4x new-system slack), both engine-proven. GROUP_LEVEL mark: 13 live.
  89/89 pass.
- [x] **3.4 Implement `%` bracket-jump + a teaching level.** (blocked: 3.1)
  done: 2026-07-04 — engine: bracket tiles `()[]{}` with 0-or-2-per-kind load
  validation (throws — pars can't rot on an unmatched bracket), `matchJump` =
  1 key + 1 tick, destination-only checks (bomb on your own bracket doesn't
  block: the Trapdoor), `match` vocab group, renderer draws paired amber
  glyphs. Level 14 "BALANCED BRACKETS" (finale → 15): a one-way bomb closet
  whose blast fills it — % is the only survival; plus an optional [ ] nook
  whose loot round-trip is the perfect 5-tick fuse errand; lint zombie on the
  exit row is fenced by a second one-way and answered with fE flight (old
  motions stay load-bearing). par 27 / limit 62, speedrun+safe proven.
  IMPORTANT infra fix discovered here: RNG was seeded by level INDEX, so
  inserting levels shifted later levels' dice and rotted their solutions —
  added `LevelDef.seed` pin; the finale is pinned to seed 12 forever. Rule
  added to level-design.md's authoring checklist. 96/96 pass.
- [x] **3.5 Implement `.` dot-repeat.** (blocked: 3.1)
  No dedicated level — it should be introduced by a keycap in an existing-style
  level 16 and then quietly make every later level's par assume it.
  done: 2026-07-04 — terminal-only per motions-v2 §3. Recording is
  reconstruct-at-commit (x/r/~ commit inline with their counts; insert-class
  edits s/i/a/A/cw/ciw record opener+typing on `TermSession.rec`, commit on
  Escape) so motion digits never pollute the record. Replay: `.` re-feeds the
  keys through termKeyInner under a `replaying` flag that suppresses per-key
  after()/ticks — 1 key, ≤1 tick, and exactly ONE golf stroke (verified: an
  8-key ciw fix replays inside a strokes:2 golf tile). lastEdit snapshots for
  undo, survives explosions (muscle memory), clears on load. World `.` bonks
  with "move with motions, repeat with edits". `dot` group live in
  engine/tray; GROUP_LEVEL placeholder 16 until its teaching slot (6.3) —
  note: the solving keystroke never ticks (standing terminal rule), so a
  solving dot is 1 key + 0 ticks. 6 new tests; 102/102 pass. No level grants
  the keycap yet — that ships with the level-16 slot in 6.3.
- [x] **3.6 Implement `/` search + `n`, teaching level.** (blocked: 3.1)
  done: 2026-07-04 — engine-side prompt (`searchBuf`): typing free with the
  world frozen, `/`+Enter cost a key each, execution 1 tick; whole-word
  matches over letter runs, row-major from the player with wrap; occupied
  landings SKIPPED (the chain routes around); bare `/`+Enter re-runs history;
  `n` = 1 key + 1 tick, no-history `n` is a free error like `;` (motions-v2
  §4 updated to match). Script notation grew `<cr>` ("/bug<cr>"). Level 15
  "GREP" (finale → 16): full-width gap-moat bands — the first geometry only
  search can cross — with "bug" ×4 as the transit chain and a "bugs" decoy;
  par 8 / limit 20, speedrun (l /bug<cr> n n n fE) + greedy loot line proven
  on first probe. `search` keycap live at GROUP_LEVEL 15; dot placeholder
  moved to 17. Help card gained rows for all four v2 motions. 110/110 pass.
- [x] **3.7 Macros (`qa…q`, `@a`): spec then implement as the endgame power.**
  Record a command sequence, replay it as a SINGLE enemy tick. This is the
  radius-3 of motions — gate it late, build the final-final level around it.
  done: 2026-07-04 — specced as motions-v2.md §5, implemented, and shipped
  with level 17 "AUTOMATE YOURSELF" as the post-finale epilogue (the TODO's
  "final-final level"; the :wq ending card moves there — the true ending is
  automating yourself out of the job, and story.md's chapter-three beat now
  says so). Rules: q{a}/q free annotation; recorded commands execute+cost
  live; @{a} = 2 keys + ONE tick (ticks suppressed during replay, single
  snapshot so one u rewinds a whole replay); bonk aborts mid-replay; i / u @
  refuse to record (macros are pure motion — terminals belong to `.`);
  registers survive explosions, @@ re-runs. The level: three identical
  linter-pocket wings with phases TUNED so the natural manual cadence dies in
  wing 2 ("the linters have learned your rhythm") while replays end outside
  the swept row before the world moves; probe proved speedrun 14 = par,
  mixed 21 ≤ 26, full-manual death. macro keycap live at 17; dot placeholder
  → 18. 7 new engine tests; 119/119 pass. PHASE 3 COMPLETE.

## Phase 4 — Bomb variants & items

- [x] **4.1 Spec doc: `docs/arsenal.md` — word-keyed bomb variants.**
  Docs only. The terminal already validates `buffer === target`; make the
  *word you craft* select the weapon. Proposals to develop: `bomb` (current,
  plus blast), `grep` (line bomb: sweeps its whole row like a linter beam,
  stops at walls), `sed`  (terraform: converts soft rock in radius to floor,
  kills nothing — the pacifist's key), `yank`/`put` (`y`/`p`: pick a placed
  bomb back up, place it elsewhere — fuse keeps ticking). Each variant needs:
  which levels' terminals offer it (a `target` is already per-tile data — zero
  schema change), HUD/inventory display for mixed bombs, blast rendering, and
  the chain-reaction rules between types. AC: spec is implementable one
  variant at a time.
  done: 2026-07-04 — `docs/arsenal.md` written and indexed. Core decisions:
  the design triangle (bomb kills+digs / grep kills-only, a handheld linter
  beam reusing linterTiles+fx.sweep / sed digs-only, s/rock/floor/, spares
  even hard rock so R stays relevant); ONE fuse (6) for all kinds — the word
  changes shape, never timing; typed FIFO arsenal `Player.arsenal:
  BombKind[]` (craft order = drop order = the plan, no selection UI);
  `TerminalDef.arms` for minigame tiles, else the target word IS the kind;
  chain matrix: only plus-blasts propagate (beams kill, washes edit, neither
  burns); imps flee pending greps but NOT pending seds. First homes: grep →
  L6's clean tile (purging lint arms a linter), sed → L8's fizz tile (cw sed
  is a shorter edit — pacifist discount). yank/put specced as wave 2 (hand
  slot, fuse ticks in hand, steal imp bombs). 4.2/4.3 are unblocked.
- [x] **4.2 Implement `grep` line bomb + retrofit one mid-campaign terminal.**
  (blocked: 4.1)
  done: 2026-07-04 — typed arsenal landed per arsenal.md §1: `Player.arsenal:
  BombKind[]` is the truth (FIFO; `bombs` kept as a synced count for
  HUD/back-compat), `Bomb.kind`, `Terminal.arms` (word-derived default),
  `grantBombs()` clamps at 3. Grep per §2: `grepTiles` = linter-beam rules
  (stops at solids incl. rock, spares margins, kills occupants only),
  `explode()` dispatches by kind — beams never chain outward but plus-blasts
  chain placed greps; `pendingBlast` is kind-aware so imps flee hot rows.
  HUD shows the typed queue (● ≡ §); placed greps wear a ≡ bar. Retrofit:
  L6's clean tile `arms: 'grep'` (purging lint arms a linter) — both L6
  routes re-proved untouched (speedrun skips the tile; lint route never
  drops its grep), so the grep there is player experimentation space until
  the 6.3 showcase level. 5 new tests (FIFO, beam-vs-rock, margins for both
  parties, chain matrix both directions, imp flight). 124/124 pass.
- [x] **4.3 Implement `sed` terraformer + a level whose safe route needs it.**
  (blocked: 4.1)
  done: 2026-07-04 — sed per arsenal.md §3: shares blastTiles propagation via
  a `sed` flag (digs %, opens bushes, & never breaks at any radius), its
  tiles never enter the kill set (stand on it — tested), chains nothing
  (null chainQ) but is triggered by plus-blasts, excluded from pendingBlast
  (imps ignore it — verified via _internals, not AI observation), own
  fx.sed (green sparkles, no shake, solved-chime). Retrofit per spec: L8's
  fizz tile now targets 'sed' (cw sed — shorter edit, gentler tool); the
  clever route re-proven typing sed and digging its gates pacifistically.
  4 new tests. 128/128 pass. Wave-1 arsenal complete (bomb/grep/sed all
  live); yank/put (wave 2) and the S-shield (4.4) remain.
- [~] **4.4 One new item type.** Proposal: `S` shield bush (+2 iframes, once) —
  the "spend now or bank it" counterpart to U. Spec in `docs/mechanics.md`
  items table first; keep the four-item austerity in mind — only add it if a
  Phase 5/6 level design actually wants it.
  deferred: 2026-07-04 — by its own criterion: no Phase 5/6 level design has
  asked for it yet. Moved to the parking lot; revisit when a sky-v2 or
  campaign-growth level needs a shield beat. Do NOT implement speculatively.

## Phase 5 — The sky, for real

- [x] **5.1 Spec doc: sky v2 in `docs/new-mechanics.md` (extend §4).**
  Docs only. Three systems: **wind currents** (sky tiles that push you one
  tile per tick — the sky's one-way analog; standing still is not standing
  still), **kites/birds** (one sky-native enemy; flight motions should
  interact with it the way they do toads — pick ONE lesson), and the
  **shadow-lure payoff**: ground enemies already gather under your shadow —
  let a bomb pre-planted on the ground pay that off (drop, rise, gather, boom;
  fuse timing makes it a real puzzle, not a free kill). Also: sky exits (`E`
  aloft) and whether cloud gaps let you *see* the ground layer (rendering
  question — answer it in the spec).
  done: 2026-07-04 — new-mechanics.md §5 written (+ conflict-register entries
  9–11). Decisions: `<>^V` in SKY grids = wind (layer-scoped semantics, no
  new glyphs); drift resolves at tick-end after motions, never pushes into
  open air (pinned, no damage), moves the player only; kite `Y` = sky-only
  full-speed greedy chaser, crosses air, blocked by thunderheads, and any
  horizontal flight over it CUTS THE STRING (toad lesson at lethal stakes);
  the flytrap (shadow-lure) needs NO engine change — codified as an
  authoring pattern (bomb, rise, ring forms, boom); sky `E` legal in v2;
  rendering contract codified (aloft sees ground ghosts; grounded sees sky
  silhouettes incl. kites for pre-reading). Bombing run stays rejected —
  comment-layer law. 5.2/5.3 unblocked.
- [x] **5.2 Implement wind + shadow-lure; rework level 12 to use both.**
  (blocked: 5.1) Level 12's current sky route is two chords and zero
  decisions; after rework it should still be the gentle sky intro but with one
  wind lane and one optional shadow-lure kill for loot.
  done: 2026-07-04 — engine: `windDrift()` at tick-end (player-only, pinned
  at solids/open air, enterTile fires so drift sweeps bushes), `terrainOk`
  one-way check now ground-only (sky arrows are weather — enterable against
  the current, tested), sky `E` wins (enterTile guard lifted). The flytrap
  needed zero engine change, exactly as specced — proven by an engine test
  (bomb, rise, hover, shadow-gathered zombie dies) AND L12's new proven
  route. L12 rework: B bush at spawn shelf, westward wind river on the sky's
  bottom row, intro rewritten; speedrun now rides the river to par 9 (was
  10) and ends by dropping straight onto E; alternate route = the full
  flytrap loop (bomb by the updraft, hover-dance, top-shelf loot sweep, 21 ≤
  26). 5 new wind/flytrap tests. 133/133 pass.
- [x] **5.3 New cloud level "CUMULUS GOLF" (ground+sky interleaved).**
  (blocked: 5.2) Mid-difficulty, multiple rises/drops, the sky-native enemy
  debuts here (leashed first, per the threat-ladder rule).
  done: 2026-07-04 — kites landed per new-mechanics §5b: layered enemies
  (`Enemy.aloft`, `enemyAt` is now ground-only + `kiteAt`), full-speed greedy
  chase blocked only by thunderheads, same-layer contact (contact loop is
  layer-aware for ALL enemies now), ground ordnance (blasts/beams/linters)
  never reaches the sky, aloft flights CUT strings via the flipToadsAlong
  sky branch (fx.cut, "the TODO drifts away"), rescue scan same-layer only,
  kites glyph-rendered aloft + silhouetted from the ground (pre-read rule).
  Level 13 CUMULUS GOLF inserted after HEAD IN THE CLOUDS (renumber sweep:
  GROUP_LEVEL mark/match/search/macro → 14/15/16/18, dot placeholder 19,
  ROUTES +1, smoke spark idx 16): sealed ground vault pocket reachable only
  from the sky, col-leashed kite bobbing across the lane, the word c-u-t as
  f-targets — the last dash is the scissors. Speedrun cuts (par 10); loot
  route threads UNDER the kite on its off-tick instead. NOTE: this iteration
  survived a mid-flight upstream history rewrite — recovered by finishing
  the user's in-progress pull-rebase; their "loop iteration 5.3"/"test"
  checkpoint commits of in-flight work are kept in history. 140/140 pass.

## Phase 6 — Campaign growth & curriculum tightening

- [x] **6.1 Force `t/T` and `;`/`,` somewhere.**
  Audit-style pass: no current level *requires* stop-short or find-repeat.
  Either retrofit level 3 (a toad/hazard ON the `f`-target tile so `t` is the
  safe landing, `;` chains the row) or make it level 15's one-new-thing.
  done: 2026-07-04 — took the retrofit path (no renumber churn). L3 LEAP OF
  FAITH: the row-1 descent shaft now sits ONE SHORT of the `a` (ta lands on
  it exactly; fa pays a backtrack), and the c-row and f-row now RHYME
  (repeated letters) so `;` chains both dashes at a one-key discount each.
  Par 25 → 21 with the entire saving coming from t + ;×2 — economy-forced,
  which is this game's definition of forced. Intro/hint teach the idea
  ("sometimes the door is BESIDE the letter", "these rows rhyme"). Kept as
  a single-route teaching corridor per the audit's L3 verdict. Note for
  future authors: a t-landing tile must be FLOOR — the first draft stopped
  short onto a gap. 140/140 pass.
- [ ] **6.2 Challenge modifiers ("broken keyboard" levels).**
  `LevelDef.banned?: string[]` — keys that error with flavor (`E: the h key
  snapped off`). One remix level: BABY STEPS with `hjkl` banned (counts/finds
  only) as an unlockable "nightmare" variant. Engine change is small
  (vocabulary system already gates keys); the design rule to uphold: banned ≠
  locked ≠ bonk — banned keys are free like locked ones.
- [ ] **6.3 Grow the campaign to ~20 levels with chapter select.**
  (blocked: most of phases 3–5) Slot the new-motion levels into the chapter
  structure from 2.1; level select gains chapter headers; re-run the pacing
  audit (breather cadence, slack ratios) across the full set.
- [ ] **6.4 Drill mode.** Freeform practice: pick any owned motion group, get a
  procedurally-lite arena (static, no enemies, coin-style targets), no save
  impact. Entry from title menu. This is the "arcade excuse" for audience #1
  in premise.md.

## Parking lot (unranked, revisit when phases close)

- `S` shield bush (+2 iframes, once) — deferred from 4.4; add only when a
  level design wants a shield beat.
- Level-shape variety: a 40-wide "one-liner" map (pure `0 $ f ;` fantasy), a
  tall shaft map for `gg/G` — needs camera/scroll work in the renderer first;
  renderer currently assumes the whole map fits the canvas.
- `:s/foo/bomb/` as a late terminal minigame (progression doc already flags it).
- Ghost replay v2 (full solution ghost, `assisted` flag) — progression doc §2.
- Flow-streak juice (progression doc §3c).
- Sound design pass: per-variant blast sounds once Phase 4 lands.
