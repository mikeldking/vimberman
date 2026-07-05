# New Mechanics — Toads, Margins, The Gutter, and The Sky

Design spec for four mechanic additions. Each section gives exact
tick-by-tick rules, edge cases, interactions with existing systems
(`src/engine/engine.ts` is ground truth), pedagogy, legend characters,
and data shapes. See `docs/progression-and-juice.md` for the keycap
vocabulary system and `docs/level-audit.md` for the level framework these
mechanics slot into.

**New map-legend characters** (verified against the existing set
`# % & . ~ < > ^ V a-z * E P Z I M T K R U B`):

| Char | Meaning | Layer |
|---|---|---|
| `Q` | Toad spawn (enemy; tile becomes `.` on load, like `Z`/`I`/`M`) | ground |
| `!` | Linter emitter (replaces a `#` in the border wall; solid) | any |
| `\|` | Margin tile (walkable floor; safe from linter beams) | any |
| `@` | Updraft (walkable floor; `Ctrl-u` here rises to the sky layer) | ground |
| `?` | Keycap pickup (motion unlock — see progression doc) | ground |

---

## 1. Toads — flippable small enemies

**One-line pitch:** a hopping nuisance that walking cannot safely deal
with, but any flight motion passing *over* it knocks it onto its back —
the motion IS the weapon.

### Unflipped AI (the threat)

Readable 3-tick hop cycle, deliberately unlike the zombie's
every-other-tick shamble:

- **Ticks 1–2 (crouch):** stationary. Sprite visibly squashes down on the
  tick before the hop (the tell, per the bestiary's "one clear tell"
  rule).
- **Tick 3 (hop):** leaps **up to 2 tiles** toward the player, greedy
  axis (same `|dx|` vs `|dy|` choice as `zombieTick`). The intermediate
  tile is *flown over* — it ignores gaps `~` and bombs; only solid
  terrain (`# % &`) blocks it, mirroring `flightBlocked`. The landing
  tile must satisfy normal enemy terrain rules (`enemyTerrainOk`,
  unoccupied). If the 2-tile landing is bad but the 1-tile step is legal,
  it hops 1; if both are bad, it stays crouched.
- Landing on the player kills ("slain by the toad").
- Net speed 2/3 tile per tick — faster than a zombie in a straight line,
  but with two dead ticks per cycle that a player who counts can exploit.
  It hops over the gaps that stop every other walker, so **you cannot
  ditch a toad at a pit** — the pit-crossing tools (flight motions) are
  also the anti-toad tools. That symmetry is the level-design hook.
- Toads ignore `pendingBlast` (dumb and squishy — they die to any blast).
- **Leashed variant:** `leash: 'row'|'col'` supported — a leashed toad
  patrols only on its hop tick, sweeping 2 tiles per hop (1 if blocked).
  A metronome gate: passable two ticks out of three.

### Flipping

- **Trigger:** any completed horizontal flight motion — `w` `b` `e` `f`
  `F` `t` `T` `;` `,` — whose swept interval (strictly between start
  column and landing column, same row) crosses the toad's tile. Every
  toad in the interval flips; one `f{c}` over a toad row flips them all.
- **Only toads flip.** Zombies/imps/mages are man-sized; flight passes
  over them with no effect (as today). Each enemy keeps its one lesson.
- **Cost: nothing extra.** The motion's normal keystroke(s) and single
  tick are the entire price. Rewarding the flight motion with a free
  disable is the whole pedagogy.
- **A bonked motion flips nothing.** If the landing is blocked, no
  movement happened, no flip — vim's "failed motion does nothing." The
  bonk still ticks.
- **`t`/`T` stopping one short of a toad does NOT flip it** — this gives
  the `f` vs `t` distinction real teeth: `f` past the toad flips it; `t`
  short of it leaves it live in your face.

### Flipped state

- **Duration: 6 ticks** — the same number as a bomb fuse, a countdown the
  player already reads. Rendered belly-up with a fuse-style countdown
  numeral (amber → red at ≤2).
- While flipped: **harmless and walkable for the player.** Contact does
  not kill. It does not move or tick its hop cycle.
- **Squash:** the player entering its tile (step, slide-through, or
  flight landing) kills it instantly and refunds **+2 keystrokes** to the
  budget ("dead code removed — +2 keystrokes"). Slides squash mid-slide
  and continue. Because entry = instant squash, "flip expires under the
  player" cannot occur.
- Other enemies treat a flipped toad's tile as occupied — they won't
  squash their buddy.
- Re-flying over a flipped toad **resets the timer to 6**. Juggling is
  legal and occasionally the right play.
- **Wake-up:** at timer 0 the toad rights itself and spends **1 full
  crouch tick** before it may hop — it can never kill on the tick it
  wakes (telegraph contract from `docs/ui-ux.md`).
- Bombs and linter beams kill flipped toads like any enemy — no refund;
  only a boot delivers the bonus.
- Undo: flip timers live on the `Enemy` object and serialize in snapshots
  for free. `rescue()`'s clear-ground scan counts a harmless flipped toad
  as an adjacent enemy — acceptable false positive.

### Pedagogy

Levels 1–4 teach players to *walk*; flight levels teach `w`/`f` but a
stubborn player can often route around them. Toads close that loophole:
against a toad, walking is strictly worse (it out-hops you across the
terrain that only flight crosses), and the flight motion you should have
used anyway *also disarms it*. Pillar #1 with a face: the efficient
motion and the safe motion are the same keystroke.

### Data shapes

- `EnemyType` gains `'toad'`; map char `Q`.
- `Enemy` gains `flip?: number` (flipped ticks remaining) and a hop
  timer; reuses `dir` for leashed patrol.
- No `LevelDef` changes (`enemyOpts` leash generalizes).

### Rejected alternatives

Flip on `t` stop-short (mushy rule, kills the f/t lesson) · flip costs a
keystroke surcharge (violates "the motion is the weapon") · flippable
zombies/imps (dilutes each enemy's single lesson) · flipped = blocking
obstacle (walkable+squash creates a reward decision instead of a new
wall type).

---

## 2. The Linter Sweep — `0` / `$` with teeth

**One crisp idea:** rows patrolled by a linter beam that periodically
wipes the whole line — everything except the **margin tiles** at the
row's ends. The one-keystroke answer, from anywhere in the row, at any
distance, with zero counting, is `0` or `$`.

### Rules, tick by tick

A **linter emitter** `!` sits *in the border wall* at the end of a row
(solid — blocks movement and blasts exactly like `#`). Each emitter runs
an independent cycle, default period 6:

- **Idle (3 ticks):** dark lamp. Nothing.
- **Warn (2 ticks):** lamp blinks amber; the row's swept tiles get a
  faint amber wash (telegraph, mage-precedent). Two full player turns of
  warning, always.
- **Fire (1 tick):** lamp flashes; a beam sweeps the row for this one
  tick. **Anything standing on a swept tile dies** — player ("swept by
  the linter"), enemies, toads, projectiles. Then back to idle.

Beam coverage: from the emitter along the row, **stops at solid terrain**
(`# % &` — same intuition as blast propagation), **skips `|` margin
tiles** (never swept), and otherwise covers every tile including gaps,
letters, one-ways, and bushes. The beam **destroys nothing and detonates
nothing** — it is a lint pass, not fire: terrain, bushes and bombs are
untouched; only occupants die. Bombs in the row survive, fuses keep
counting.

**Margin tiles `|`:** ordinary walkable floor placed at the extreme ends
of the hot row (the first/last open tile against the wall). Rendered as a
thin bracket, styled like vim's fold/sign column. Because `0`/`$` slide
until obstructed and the margin hugs the wall, **`0` and `$` land you
exactly on the margin** — the motion and the safe spot are the same
object.

### Resolution order (critical)

Player motion resolves fully, *then* `tick()` runs hazards. The beam
checks occupancy at tick resolution. Therefore:

- Sliding **through** a hot row with `gg`/`G` on its fire tick is safe —
  only your final tile matters.
- **Ending** any motion in the swept interior on the fire tick is death —
  including a bonk (bonks tick too; spam is punished, as ever).
- Terminal editing while standing in a hot row is legal but every editor
  keystroke ticks the world — a `T` inside a hot row is a deliberately
  evil expert-level placement.

### Edge cases

- An enemy or bomb sitting **on the margin** blocks your `0`/`$` slide
  one tile short — you die in the interior. Intended depth: a zombie
  camping the margin turns "snap to safety" into "clear the margin
  first." The imp fleeing `pendingBlast` can be herded onto a margin —
  cruel, legal, delightful.
- Items mid-row don't stop slides, so `$` through a bush both loots and
  saves you.
- Undo: the beam is not an explosion — **history is NOT wiped**; `u` can
  rewind a sweep death. Deterministic cadence + 2-tick telegraph means
  undo-scouting gains little anyway.
- Leashed enemies placed in a hot row get periodically executed by it.
  Legal; occasionally the intended solution ("let the linter clean up").

### Pedagogy

Counts (`9l`) require knowing the distance; `0`/`$` are *anchors* — one
keystroke, correct from anywhere, no arithmetic under pressure. The
linter manufactures exactly the situation where anchor-thinking beats
count-thinking. This upgrades `0`/`$` from "convenience" to "reflex,"
which is what vim's line motions actually are.

`^` (first non-blank) is rejected for v1 — its spatial analog is already
where a `0` slide stops when terrain blocks it.

### Data shapes

- `LevelDef` gains `linters?: Record<string, { period?: number; warn?:
  number; phase?: number }>` keyed `"x,y"` of the `!` tile. Defaults:
  period 6, warn 2, phase 0.
- The sweep state is **derived from `tick`** — fully deterministic, no
  snapshot changes. New fx hook: `fx.sweep(tiles)` for the beam flash.
- `!` is in `SOLID`. `|` is plain floor to every existing rule.

### Rejected alternatives

Crusher/collapsing rows (physics vim doesn't have) · "tiles only
reachable by slamming" (a slide and a counted slide are indistinguishable
to the engine) · beam detonates bombs (muddies the "undo survives sweeps,
not explosions" boundary).

---

## 3. The Gutter — grid, relative line numbers, ruler

Pure presentation (renderer + a settings flag; **zero engine changes**).
The playfield becomes legibly *a vim buffer with `set number
relativenumber`*.

### Visual spec

- **Gridlines:** hairlines at cell boundaries, phosphor green at low
  alpha; the player's row and column get a `cursorline`/`cursorcolumn`
  wash. Present from level 1 (it's just texture).
- **Left gutter:** a narrow band left of the playfield (canvas widens;
  `sizeCanvas` accounts for it). Every row shows its **relative
  distance** `|y − player.y|` in dim green; the player's row shows its
  **absolute** number (`y+1`, 1-based) in amber bold — vim's
  `CursorLineNr` convention exactly.
- **Bottom ruler:** a matching band under the playfield showing relative
  **column** distances, digits `1`–`9`, blank beyond 9, `0` under the
  player. An invention (vim has no relative columns), justified as the
  spatial cousin of `:set ruler`; it exists because `f`-counts and `7l`
  are horizontal.
- **Count-pending flash:** while a count is pending (say `3` typed), the
  gutter cells at distance 3 above/below and the ruler cells at distance
  3 left/right pulse bright. The moment the motion key lands, the flash
  resolves into the move. "See 4 in the gutter → type 4j," confirmed
  *before* commit.
- **Find-pending highlight:** while `f/F/t/T` awaits its character, every
  letter tile in the player's row brightens — "these are your targets."
- **Terminal mode:** gutter and ruler dim — you're focused in another
  buffer.
- **Sky layer:** the gutter numbers the *active* layer; rows align by
  construction.

### Progressive disclosure

- **Level 1 (BABY STEPS):** gridlines only. No numbers — the first `hjkl`
  lesson stays visually quiet. (`LevelDef.gutter: false`.)
- **Level 2 (COUNT THE CORRIDORS) onward:** gutter + ruler on,
  permanently. The level 2 intro card gains one line: *"The margin counts
  the distance for you. See 6? Type 6j."*

### Pedagogy

Counts are the single highest-leverage habit the game teaches, and the
one with the highest arithmetic friction — players count tiles with their
eyes. Real vim users solve this with `relativenumber`; giving the game
the same instrument teaches not just counts but *the tooling vim users
actually configure*.

---

## 4. The Sky — a cloud layer above

**Minimal v1:** one optional second map, same dimensions, no sky enemies,
no cross-layer damage. The sky is a *toll road*: 2 keystrokes of overhead
(up + down) to bypass what the ground won't let you cross.

### Keys: `Ctrl-u` rises, `Ctrl-d` drops

Vim's scroll-half-page-**u**p / -**d**own, with the mnemonic doing double
duty (u = up into the clouds, d = down to earth). `Ctrl-w` chords would
close the browser tab; `H`/`L`, `gt`/`gT`, `zt`/`zb` carry the wrong
semantics. `Ctrl-u/d` are preventDefault-able, are among the
highest-value real-vim commands a learner can drill, and their fiction
("scroll up — the lines above the page were the sky all along") is
exactly the game's register. Each is one keystroke and one tick.

### Rules

- **Rise:** `Ctrl-u` while standing on an updraft `@` (ground layer)
  moves you to the same `(x,y)` on the sky layer. The destination sky
  tile must be standable — level authors guarantee this by construction.
  `Ctrl-u` anywhere else: bonk, "no updraft here."
- **Drop:** `Ctrl-d` anywhere on the sky layer, provided the ground tile
  below is landable (no wall/gap, no enemy, no bomb). Otherwise bonk:
  "nothing to land on" / "something's down there." Rise at fixed points,
  drop almost anywhere — that asymmetry makes the sky a routing tool
  rather than a corridor.
- **Sky terrain reuses the legend:** `.` cloud floor, `~` open air (same
  semantics as ground gaps), `#` thunderhead (solid), `a-z` cloud words,
  `*` bushes (loot in the sky is the toll's reward). **Not allowed in sky
  v1:** `P`, `E`, enemies, `T`, one-ways. The exit and all bomb-crafting
  stay grounded.
- **All motions work identically aloft** — the engine's tile queries read
  the active layer's grid.
- **`x` (bomb) in the sky: bonk** — "no bombs in the clouds" (v1).
  **`i` in the sky: bonk** (no terminals there).

### Cross-layer rules (v1, strict)

- **Damage and contact are same-layer only.** No blast, bolt, beam, or
  body touches across layers, ever.
- **Ground enemies keep ticking and keep targeting your coordinates**
  while you're aloft — zombies gather under your shadow, the mage
  teleports around your ghost. Deliberately zero extra AI code, and it
  produces the mechanic's best moment: looking down at the welcoming
  committee assembling beneath you, choosing a different landing. Two
  same-layer guards: imps don't lay bombs while you're aloft, and the
  mage doesn't fire its bolt (port/teleport continue).
- The world does **not** pause aloft: fuses burn, linters sweep, flip
  timers run. The sky costs ticks like everywhere else.

### Rendering

- **Grounded:** sky layer drawn as faint silhouettes over the board — you
  can pre-read the cloud route (determinism pillar: no hidden
  information).
- **Aloft:** layers swap — sky at full opacity, ground ghosted *with
  enemies and bombs still visible* (you must track your landing). The
  player gains a soft halo; the statusline reads `~/sky`.
- Updrafts render as animated thermal spirals, visible from both layers.

### Data shapes

- `LevelDef` gains `sky?: string[]` (same W×H, validated at load); sky
  bushes use the key convention `"sky:x,y"` in the existing `bushes`
  record.
- `GameState` gains `layer: 'ground' | 'sky'` and `skyGrid: string[][] |
  null`; both serialize into snapshots (undo across a layer change works
  for free; rescue restores layer).
- New fx hooks: `fx.rise()`, `fx.drop()`.

### Budget implications

The sky toll is 2 keystrokes + 2 ticks minimum. Tuning rule: the intended
cloud shortcut must save **≥ 4 keystrokes** over the best ground route,
so taking it is clearly correct, not a wash; `par` assumes the cloud
route, and the authored solution in `test/solve.test.ts` proves it.

### Extensions (explicitly not v1, in priority order)

1. **Bombing run:** `x` aloft drops the bomb onto the ground tile below.
2. **The Bird:** a sky-only leashable patrol enemy for the finale.
3. **Down-shafts:** sky-side `@` required for descent in expert levels.

### Rejected alternatives

Tunnels below instead of clouds (identical mechanics, worse rendering
story, loses the mnemonic) · free rise anywhere (deletes the routing
puzzle; updrafts are the author's control surface) · full cross-layer
interactions in v1 (quadruples the interaction matrix for content no
early level needs).

---

## 5. Sky v2 — wind, kites, and the flytrap (TODO 5.1)

The v1 sky is admitted empty: no hazards, no exits, nothing to do aloft
but cross. Sky v2 adds exactly three systems, all inside the fiction's
one law (`docs/story.md`): **the sky is the comment layer — nothing
executes there.** No bombs, no terminals aloft, ever. Wind, kites and
exits don't execute anything; they ARE the comments.

### 5a. Wind currents — the sky's one-way analog

New semantics for `<` `>` `^` `V` **when they appear in a `sky` grid**:
wind tiles, not one-ways (the ground meaning is unchanged; the sky has
no one-ways in any level and the arrow mnemonic — a directional force —
is the same idea blowing instead of blocking).

- A wind tile is ordinary standable cloud. At the END of every world
  tick, a player standing on wind is pushed **one tile** in its
  direction. Standing still is not standing still: a bonk, a mark-set
  tick, any tick — you drift.
- Motions resolve first, then the drift. Landing on wind from any
  motion is legal; the push happens on that same tick's end.
- A blocked push (thunderhead, closed cloud edge, open air `~`) pins
  you: no move, no damage. **Wind never pushes you into open air** — it
  is a current, not a cliff.
- Drift enters tiles fully (`enterTile` fires): drifting across a sky
  bush sweeps it. Chained wind tiles carry you one tile per tick, a
  river you ride while doing other things — the authoring payoff: a
  wind lane crossing a level is free eastward travel and a tax on
  westward plans.
- Wind moves the player only. Kites ignore it (they were born there);
  there is nothing else aloft.
- Undo: the drift happens inside the tick, so snapshots capture
  post-drift positions — `u` works with no special cases.

### 5b. The kite (`Y`) — the sky-native enemy

**One-line pitch:** the fastest chaser in the game, in the layer with
no walls to hide behind — and any flight motion over it cuts the
string. Lore (story.md register): *a TODO from 2019. still circling.
still load-bearing, somehow.*

- Sky-only spawn glyph `Y` (sky grids only; `EnemyType` gains
  `'kite'`, `Enemy.aloft: true`). Contact rules are same-layer, as all
  damage already is: a kite can never touch a grounded player.
- Moves **every tick** (no half-speed, no hop cycle — the sky's open
  geometry is balanced by pure speed), greedy-axis toward the player,
  crosses open air `~` freely, blocked only by thunderheads `#`.
- **Cutting the string:** any completed horizontal flight motion
  (`w b e f F t T ; ,`) whose swept span crosses the kite kills it
  outright — no corpse, no refund; it was a comment. This extends the
  toad lesson to lethal stakes: aloft, flight is not just travel, it is
  the only weapon. `flipToadsAlong`'s ground-only guard grows a
  sky branch (cut instead of flip).
- One kite per level to start; it makes the sky a place you cross with
  intent rather than a rest stop. Leashable (`patrolTick`) like
  everything else for gentler introductions.
- Rescue: the clear-ground scan counts same-layer kites only.

### 5c. The flytrap — the shadow-lure payoff

**No engine change required** — this is an authoring pattern the
existing rules already support, now codified: ground enemies path
toward your coordinates while you're aloft (the shadow), enemies never
step onto bomb tiles, and blasts kill grounded enemies regardless of
where the player is. Therefore:

1. Drop a bomb beside an updraft.
2. `Ctrl-u`. The zombies converge on your shadow and pile up around
   the hover point (they can't stack, so they ring it).
3. The fuse does the rest. Drop back down onto the ash.

Authoring rules: the updraft must be reachable from the bomb spot
within the fuse (≤4 ticks); the plaza needs ≥3 open tiles adjacent to
the shadow point so the ring forms inside blast radius; par assumes
drop → rise → two gathering ticks → boom. The intro-card line writes
itself: *processes polling a reference they can't dereference.*

### 5d. Sky exits and the rendering contract

- `E` is now legal in a sky grid: winning aloft is allowed (the
  export). `enterTile`'s ground-only guard on `E` is lifted for v2.
  Terminals and bombs stay forbidden aloft — that law is load-bearing
  fiction and mechanics both.
- Rendering (the open question, answered — mostly by existing code):
  **aloft you always see the ground** (ghost pass at 0.25 alpha,
  enemies/bombs at 0.35 — required for flytrap play and safe drops);
  **grounded you see sky silhouettes** at 0.13 so cloud routes can be
  pre-read (the audit's pre-read rule). v2 adds kites to the
  silhouette pass — a route you can't pre-read is a trap, not a
  puzzle. Open air `~` in the sky grid shows the ground through at
  full strength, as today.

### Rollout

- **5.2**: wind + the flytrap, and rework level 12 (HEAD IN THE
  CLOUDS) to use both — its sky route today is two chords and zero
  decisions; after rework: one wind lane, one optional flytrap kill
  for loot, same gentle-intro budget class.
- **5.3**: "CUMULUS GOLF" — mid-difficulty ground+sky interleave,
  kite debut (leashed first, per the threat ladder), sky exit.
- The old "Extensions" list above (bombing run, The Bird, down-shafts)
  is superseded by this section; the bombing run remains rejected for
  v2 (it breaks the comment-layer law).

### Rejected alternatives

Distinct wind glyphs instead of reusing arrows (burns four legend
chars for a distinction the layer already makes) · wind affecting
kites (two drifting systems compound into unreadable trajectories) ·
kites diving to the ground layer (breaks the same-layer damage
invariant that makes the sky legible) · sky terminals ("nothing
executes there" is the whole fiction — and the rest stop the sky must
not become) · wind pushing into open air for a fall-back-to-ground
mechanic (stealth damage; falling should never be a surprise).

---

## Conflict register (cross-mechanic and legacy)

1. **Toads × flight-over-enemies:** flight already ignores all enemies;
   toads add a reaction, no rule change for Z/I/M. A counted `wordMotion`
   computes one final landing — the flip interval is start → final
   landing.
2. **Toads × rescue:** flipped (harmless) toads count as adjacent in the
   clear-ground scan — minor false positive, accepted.
3. **Linter × undo:** sweeps don't wipe history (only `explode()` does).
4. **Linter × camped margins:** `0`/`$` stop one short — intended depth;
   authored levels must stay soluble (cover `%` or timing).
5. **Sky × mage:** the bolt gains a same-layer gate; teleport targeting
   is unchanged.
6. **Sky × imp bombs:** laying gains a same-layer gate; movement
   untouched.
7. **Legend:** `Q ! | @ ?` verified free. Render care: `|` as a thin edge
   bracket, not a glyph; `!` lives in the wall band, never on floor.
8. **`Ctrl-u` vs `u`:** distinct keys; the death screen's `u`-rescue must
   not fire on `Ctrl-u`. The key handler passes `<C-u>`/`<C-d>` tokens —
   the one genuinely new input-path requirement in this spec.
9. **Arrow glyphs are layer-scoped (sky v2):** `<>^V` on the ground =
   one-way tiles; in a sky grid = wind. One glyph set, two semantics,
   disambiguated entirely by which grid it sits in — `terrainOk`
   (one-way checks) reads the player layer already; wind resolution is
   a separate sky-only pass. Level authors: never describe sky arrows
   as one-ways in intro copy.
10. **Kite × flight-over-enemies:** ground flights still ignore all
    enemies; the sky branch of the swept-interval check cuts kites.
    Toads flip, kites die, Z/I/M remain indifferent — one lesson per
    enemy, per the bestiary rule.
11. **Wind × updraft/drop:** `Ctrl-d` legality is checked on the tile
    you occupy AFTER any drift that tick; drifting onto a sky `@` is
    just floor (sky `@` remains cosmetic in v2).
