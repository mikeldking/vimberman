# Mechanics

This is the systems reference. Everything here is implemented in
`src/engine/engine.ts`, which is intentionally pure logic with no DOM — read it
alongside this doc as the ground truth.

## The core loop

1. Look at the room: enemies, gaps, code-tiles, bushes, the exit.
2. Plan a route in terms of vim motions, not individual steps.
3. Execute — every *completed* command (not every keypress) advances the
   world by one tick.
4. If you need a bomb, detour to a code-tile, fix its word, drop the bomb,
   get clear of the blast.
5. Reach `E` before your keystroke budget runs out, ideally under par.

The loop is identical on level 1 and level 10. What changes is the
vocabulary of motions available (taught progressively) and how unforgiving
the budget is relative to that vocabulary. See `docs/level-design.md`.

## The turn system (the load-bearing idea)

The world is **turn-based on completed keystroke commands**, not on
individual keypresses and not on wall-clock time:

- `l` → one enemy tick, moves you one tile.
- `12l` → **one** enemy tick, moves you twelve tiles (assuming the path is
  clear the whole way — see "Slides" below).
- A bonked motion (walking into a wall) still consumes a tick — spam is
  punished exactly like a real move (`src/engine/engine.ts` → `bonk()` calls `tick()`).

This is the entire reason vim motions matter mechanically, not just
thematically: **counted/compound motions are strictly better than
button-mashing** because they cover more ground per enemy turn. A player
who taps `l` twelve times gives zombies twelve free moves; a player who
types `12l` gives them one. The UI even nags about this directly — see
`src/ui/screens.ts` → `gameKey`'s "try 4l instead of llll" toast after four repeats of
the same directional key.

Ticks drive:
- Bomb fuses counting down (`fuse--` in `tick()`).
- Enemy AI steps (zombie/imp/mage, one decision each per tick).
- Mage projectile movement.
- Iframe decay after a rescue.
- Snapshotting state for `u` (undo).

### Keystroke budget vs. par

Every level has two numbers (`src/levels.ts` → `limit`, `par`):
- `limit` — hard cap. Hit it and the level ends in **FAIL** ("the cursor
  grows still"). This is a soft-fail, not a death — no enemy touched you,
  you just ran out of runway.
- `par` — the target for full marks. Star rating on clear
  (`src/ui/screens.ts` → `showClear`): `keys <= par` → 3 stars, `keys <= par*1.5` → 2
  stars, else → 1 star.

Because `limit` and `par` are both keystroke counts (not real seconds),
the game never punishes you for *thinking slowly* — only for moving
inefficiently. This is a deliberate choice: Vimberman is a puzzle you
solve with your brain and then execute with your hands, not a
twitch-reflex game. See `docs/level-design.md` for how these numbers are
tuned per level.

## Motions

| Keys | What it does | Engine entry point |
|---|---|---|
| `h j k l` | Step one tile. Walking into a wall/rock/enemy still costs a tick. | `singleStep` |
| `5l`, `3j`, … | Count + direction: slides up to N tiles, stopping at the first obstruction, as **one** enemy tick. | `slide` |
| `w` `b` `e` | Word motions: hop to next/previous word start, or word end, among runs of lettered tiles in your row. Flies clean over gaps and even over enemies standing on the flight path (only walls block the flight — see `flightBlocked`). | `wordMotion` |
| `f{c}` `F{c}` | Dash right/left along the row and land **on** the next occurrence of character `{c}`. | `findMotion` |
| `t{c}` `T{c}` | Same as `f`/`F` but land **one tile short**. | `findMotion` |
| `;` / `,` | Repeat the last `f`/`F`/`t`/`T`, `,` reverses direction. | `st.lastFind` |
| `0` / `$` | Slide to the start/end of the row (`Infinity` max distance). | `slide` |
| `gg` / `G` | Slide to the top/bottom of the column. | `slide` |
| `i` | On a code-tile (`T`), opens the terminal editor. Elsewhere, a no-op error. | `normalKey` case `i` |
| `x` | In the world: drops an armed bomb. In a code-tile: deletes a character. | `dropBomb` / `termKey` |
| `u` | Rewinds one world tick (see Undo below). Also the death-rescue key. | `worldUndo` / `rescue` |
| `m{a}` / `` `{a} `` | Set a bookmark (free — annotation, no key/tick) / teleport back to it (1 tick; jumps over everything; blocked only by an occupied or unreachable target). Explosions erase all marks, like undo history. Full spec: `docs/motions-v2.md`. | `setMark` / `recallMark` |
| `%` | On a bracket tile `()[]{}`: jump to its partner (1 key, 1 tick, both directions). Only the destination matters — a bomb on your own bracket doesn't block the exit. Pairs validated 0-or-2 per kind at load. | `matchJump` |
| `/{word}` `n` | Search: fly to a whole-word match anywhere on your layer, row-major from the player, wrapping. Prompt typing is free; `/`+Enter cost a key each, execution 1 tick; `n` repeats for 1 key + 1 tick. Occupied landings are skipped. The only motion that crosses rows. | `doSearch` |
| `q{a}…q` / `@{a}` | Record world commands (recording free; commands cost normally) / replay the whole register as ONE enemy turn (2 keys, 1 tick). Bonks abort the replay; `i` `/` `u` refuse to record; `@@` re-runs. One `u` rewinds an entire replay. | `replayMacro` |
| `Ctrl-u` / `Ctrl-d` | On an updraft `@`: rise to the sky layer / drop back to clear ground. | `riseToSky` / `dropToGround` |
| `:` | Opens the free ex command line (UI-side; the engine never sees it). | `src/ui/screens.ts` → `exKey` |

Motions are **gated by vocabulary**: until a motion group's keycap (`?`
tile) has been collected, pressing its key is *free* — no keystroke, no
tick, just a dry echo. A level may also declare **worn keys**
(`LevelDef.banned`): bare presses of those normal-mode keys are refused
free (same class as locked), but counted presses work and find-argument
positions are exempt — the tap tax, taught in BABY STEPS, PROMOTED. Locked ≠ bonk: a bonk is a legal command that
failed (costs a turn); a locked key is not in your language yet, same
class as arrow keys. The engine defaults to everything-unlocked
(`setVocab(null)`) so tests and headless use are unaffected; the UI opts
in with the save's collected groups. See
`docs/progression-and-juice.md`.

All motions accept a numeric count prefix (`P.pending.count`), and all of
them go through the same "did this move actually happen" gate before
calling `tick()` — a motion that changes nothing (blocked immediately)
calls `bonk()` instead, which still burns a tick, matching real vim's
"beep and do nothing" except here the world still moves on without you.

### One-way tiles and gaps

- `~` (gap/pit): impassable to normal steps and slides; only `w`/`b`/`e`/`f`/`t`
  "flight" motions can cross it, because those motions don't check
  intermediate tiles for anything except solid walls (`flightBlocked`).
  This is the mechanical reason word-hop and find-motions feel like
  "soaring" — they're the only tools that ignore gaps.
- `<` `>` `^` `V` (one-way tiles, rendered `‹ › ˄ ˅`): can only be *entered*
  while moving in their allowed direction (`ONEWAY` map + `onewayOk`).
  Step off in the wrong direction later and you simply can't re-enter —
  there's no backtracking through a one-way tile. This turns route
  planning into a real commitment, taught explicitly in AGAINST THE
  CURRENT.

### Terrain that blocks bombs specifically

- `%` (soft rock, rendered `▒`): destroyed by any blast, no radius
  requirement.
- `&` (hard rock, rendered `▓`): only destroyed by a blast with radius
  `>= 3` — the player starts at radius 2, so one `R` (radius) pickup
  reaches the threshold. This is a deliberate late-game gate — see the
  `R` bush placement in the levels that contain `&`.
- `#` (wall): always blocks blast propagation entirely.

## Bombs: the fiction *is* the mechanic

Bombs are not found lying around. The only way to gain one is:

1. Stand on a code-tile (`T`, drawn as a glowing `:`).
2. Press `i` to enter **terminal mode** (a nested vim-editor mini-game,
   see below).
3. Edit the broken word shown in `t.buffer` until it equals `t.target`
   (almost always the literal string `"bomb"`).
4. On a correct match, `termValidate` auto-commits: the terminal closes,
   you're granted `t.grants` bombs (1 or 2, capped at 3 held at once), and
   a satisfying two-note chime plays. **The word you craft selects the
   weapon** (`docs/arsenal.md`): the tile's `arms` kind (default: the
   target word if it names a kind) is pushed onto a typed FIFO arsenal —
   craft order is drop order.
5. Back in the world, press `x` to drop the front of the queue. The
   classic `bomb`: fuse of 6 ticks, blast radius `p.radius` (starts
   at 2), plus-shaped (`blastTiles`). The `grep` line bomb: same fuse,
   but detonation sweeps its whole row exactly like a linter beam
   (`grepTiles`) — kills occupants, breaks no terrain, spares margins,
   and never detonates other bombs (though a plus-blast will detonate a
   placed grep). Imps flee a pending grep's row. The `sed` terraformer:
   same fuse and plus shape, but a substitution, not a fire — digs soft
   rock and opens bushes, never cracks hard rock `&`, kills nothing
   (stand on it if you like), triggers nothing, and imps don't fear it.

Blast propagation stops at walls, destroys soft rock unconditionally,
destroys hard rock only at radius ≥ 3, opens bushes into their hidden item,
and **chains into other bombs** it touches (`explode`'s `chainQ`) — so
bombs can be used to detonate each other, including enemy-planted ones.

### The terminal editor (bomb-crafting minigames)

This is a scoped-down vim inside the vim game — its own mode
(`st.mode === 'terminal'`), its own pending-key state, and its own subset
of commands (`termKey` in `src/engine/engine.ts`):

- Movement: `h` `l` `0` `$`, plus `f{c}`/`F{c}`/`;` char-finds and
  `w`/`b`/`e` word hops within the buffer (no `j`/`k` — it's a single
  line buffer). The extra motions share the world's keycap gating.
- Edits: `x` (delete char), `r{c}` (replace char), `~` (toggle case),
  `s` (substitute char + enter insert), `i`/`a`/`A` (enter insert at
  cursor / after cursor / at end).
- Word ops: `cw` (change to word end), `ciw` (change the whole word under
  the cursor, from anywhere inside it) — the REWRITE THE RULES and
  WARPED WORDS teaching moments respectively.
- `.` (dot, keycap-gated): replays the last completed edit at the cursor
  for ONE keystroke and one tick, whatever the edit's length — `ciw bomb
  Esc` on tile A becomes `i` `.` on tile B. Edit memory persists across
  terminals and explosions within a level; it is also a single stroke for
  golf budgets. In the world, `.` is a bonk with a lesson. Spec:
  `docs/motions-v2.md` §3.
- `Escape` from insert commits the current buffer and re-validates.
- `u` even works *inside* the terminal (falls through to `worldUndo`).

"Make it say the target" is only the first of several terminal
minigames. A tile's `TerminalDef.kind` selects the puzzle: `fix`
(default, buffer → target), `clean` (purge every glitch char), `coins`
(land on every coin before a tick deadline or the cache respawns),
`golf` (fix it within a hard keystroke budget or the tile resets), and
`spark` (coins plus a scan head sweeping one cell per tick — end a
stroke under it and you're ejected). All are turn-based, all pay out in
bombs, and each drills a motion family. Full specs, authoring guide and
tuning rules: `docs/terminal-minigames.md`.

Every keypress inside the terminal still calls `tick()` — **fixing a bomb
costs keystroke budget and gives enemies free turns**, exactly like moving
in the world. This is why the game frequently plants an enemy near a
code-tile (see `docs/bestiary.md`): the terminal doesn't pause the world,
so bomb-crafting under pressure is itself a challenge, not a rest stop.

## Items and bushes

Bushes (`*`) hide one of four item types, defined per-tile in a level's
`bushes` map (falls back to `{ type: 'K', amt: 5 }` if unspecified):

| Type | Effect | Notes |
|---|---|---|
| `K` | +N keystroke budget (`st.limit += amt`) | The only item that's pure economy, not power. |
| `R` | +1 permanent blast radius | Needed in pairs to reach radius 3 and crack hard rock `&`. |
| `U` | +1 undo charge | Extends both your rewind and your death-insurance pool. |
| `B` | +1 bomb held (capped at 3) | Skips a code-tile detour for one extra bomb. |

Bushes are consumed on entry (`enterTile`), replaced with `.`. An item can
also be exposed by a bomb blast hitting a bush directly, per `blastTiles`
— destroying a bush with a bomb still yields its hidden item rather than
just clearing the tile.

## Undo (`u`) — the double-duty system

`u` does two jobs, and both are the same underlying mechanic (rewind one
snapshot from `st.history`):

1. **Mid-play rewind**: pressing `u` during normal play pops the most
   recent world-tick snapshot and restores it, refunding nothing but
   costing one undo charge (`worldUndo`).
2. **Death insurance**: on death, if `st.player.undo > 0` and history
   exists, pressing `u` (handled specially — see `key()`'s `dead` branch
   and the UI's `DEAD` screen) calls `rescue()` instead: same restore,
   but also grants 2 iframe ticks so you don't immediately re-die on the
   same enemy contact.

Constraints that make undo a resource, not a safety net:
- History is capped at 80 snapshots (`pushSnap`), effectively unbounded
  for level lengths seen so far.
- **History is wiped entirely the instant any bomb explodes**
  (`st.history = []` in `explode()`). You cannot undo across a detonation
  — once something has blown up, that's permanent. This is a deliberate
  boundary: it stops players from using undo to "peek" at safe blast
  timing risk-free, and it means bomb commitment is always final.
  Design implication: never rely on undo to survive your *own* blast —
  plan the exit before you drop the bomb.
- Undo charges start at 3 and are topped up only by `U` bushes.

## The newer systems (summaries — full specs in docs/new-mechanics.md)

- **Toads (`Q`)** — flippable hoppers: any flight motion passing over one
  knocks it belly-up for 6 ticks; walking onto a flipped toad squashes it
  for +2 budget. See `docs/bestiary.md` → Toad.
- **Linter rows (`!` emitter, `|` margins)** — a row-sweeping hazard on a
  6-tick cycle (3 idle, 2 amber warn, 1 fire). Everything standing in the
  swept interior dies; margins are never swept; `0`/`$` snap to them from
  anywhere. The beam kills occupants only — it never breaks terrain,
  detonates bombs, or wipes undo history (only explosions do that). State
  is derived from the tick counter (`linterCycle`), so it snapshots for
  free.
- **The sky layer (`sky` map, `@` updrafts, `Ctrl-u`/`Ctrl-d`)** — a
  second grid above the ground. Damage and contact are same-layer only;
  ground enemies keep hunting your coordinates while you're aloft (the
  imp won't lay bombs and the mage won't fire at a player in the clouds)
  — and a bomb left beside the updraft makes that gathering their
  problem (the flytrap). Sky v2: arrows in sky grids are WIND (drift one
  tile per tick at tick-end; never into open air), and `E` aloft wins.
  Still no bombs or terminals up there — nothing executes in the
  comment layer. Full spec: `docs/new-mechanics.md` §5. All motions work
  identically aloft on the sky grid.
- **Keycaps (`?`)** — motion-unlock pickups; see the vocabulary note in
  Motions above.
- **The gutter** — pure presentation: relative line numbers, a column
  ruler, and count-pending highlights (`src/render/renderer.ts` →
  `drawGutterAndRuler`). Level 1 opts out via `LevelDef.gutter: false`.

## Win / fail / death states

Three distinct end states, all handled as `st.status` transitions:

- **`won`** — stepped onto `E`. Triggers star calculation against `par`
  and unlocks the next level.
- **`fail`** — `st.keys >= st.limit` after any keypress. Not lethal
  fiction-wise; it's simply "you ran out of budget." No undo applies here
  — the level just ends and offers retry.
- **`dead`** — an enemy occupies your tile, you walk into one, or a mage
  bolt/projectile hits you (`hitPlayer`). This is the only state `u` can
  reverse (via `rescue`), and only if undo charges remain.

`iframes` (invulnerability frames) exist solely to prevent an immediate
re-death after a rescue — they decay by 1 per tick and are otherwise
always 0 during normal play.
