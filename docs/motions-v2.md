# Motions v2 — Marks, Bracket-Jump, Dot-Repeat, Search

Design spec for four motion additions, written to the same standard as
`docs/new-mechanics.md`: exact rules, costs, edge cases, interactions with
existing systems, pedagogy, data shapes, and rejected alternatives.
Implementation items: 3.2–3.6 in `docs/TODO.md` (macros are 3.7 and get
their own spec later — they are deliberately NOT in this doc).

The design bar, set by toad-flipping: **each motion must carry one named
ability/puzzle hook** — a way level geometry can make the motion
load-bearing, not just available. They are listed first because they are
the point:

| Motion | Keycap group | The hook |
|---|---|---|
| `m{a}` + `` `{a} `` | `mark` | **The Round Trip** — one-way tiles stop feet, not bookmarks |
| `%` | `match` | **The Trapdoor Exit** — the only guaranteed bomb escape |
| `.` | `dot` | **The Dot Formula** — mass-produce bombs across identical broken words |
| `/{word}` + `n` | `search` | **Grep the Dungeon** — duplicate words as an authored teleport bus |

New legend characters: `( ) [ ] { }` (paired bracket tiles, walkable).
Marks, dot and search add no map glyphs.

Cost vocabulary used below (see `docs/progression-and-juice.md` §6 for the
purity rules): a key is `st.keys++`; a tick is one world turn; "free"
means neither, the class that `:`,  locked keys, and arrow keys occupy.

---

## 1. Marks — `m{a}` set, `` `{a} `` recall

**One-line pitch:** bookmark a tile, teleport back to it later. The only
motion that un-commits a commitment.

### Rules

- `m` + any lowercase letter sets mark `{a}` at the player's tile, on the
  player's current layer. **Setting is free** — no key, no tick. It is
  annotation, the same class as the `:` prompt: it changes nothing in the
  world. Echo: `mark a set. the file remembers.`
- Re-setting a letter moves that mark. No cap on live marks (levels will
  rarely need more than two).
- `` ` `` + letter **recalls**: teleports the player to the mark. Costs
  its 2 keypresses and **1 tick**. Nothing between the two tiles matters
  — walls, gaps, one-ways, enemies, lit bombs are all overflown. It is a
  jump, not a flight: **no swept interval, so no toad flips** (flips stay
  exclusive to horizontal flight motions).
- Recall fails as a **bonk** (2 keys, 1 tick, no move) if: the mark
  doesn't exist (`E: mark z not set`), the mark is on the other layer
  (`E: mark a is in another layer`), or the mark tile is currently
  occupied by an enemy or a bomb (`E: something is sitting on mark a`).
- **Explosions erase all marks**, exactly like they erase undo history
  and for the same reason (the no-free-peek boundary): `explode()` does
  `st.marks = {}`. Echo on the next failed recall: `E: the blast moved
  the line numbers.` Marks are otherwise permanent within a level.
- Marks live in snapshots, so `u` restores them (including un-erasing on
  an undo that... cannot cross an explosion anyway — consistent for
  free).
- Not available inside terminals (world-only). `m` in a terminal is not
  a terminal command → standard terminal error.
- Enemies never see or use marks. Determinism unaffected (recall is just
  a player move).

### The Round Trip (puzzle hook)

Every commitment mechanic in the game — one-way chutes, linter timing,
sealed loot pockets — currently ends the same way: what's taken is taken.
A mark set *before* the plunge turns a chute into a round trip: drop into
the sealed pocket, grab the loot, `` `a `` back out. Authoring pattern:
place a `?`-adjacent fork where the greedy line dives into a one-way
pocket whose only walking exit is long; par assumes mark-set at the fork.
The teaching level (3.3, "BOOKMARKED") should make the *un-marked* run
visibly miserable: solvable, but 20+ keys longer.

### Costs & purity

- Set free / recall costs is the same asymmetry as `:hint` vs. moving:
  planning is free, acting is not.
- Recall cannot be used to dodge during a mage volley for free — it costs
  the tick, so bolts advance.

### Data shapes

```ts
// GameState
marks: Record<string, { x: number; y: number; layer: 'ground' | 'sky' }>;
// pending: 'm' and '`' become two-key pending ops like 'f'/'r'
```

### Rejected alternatives

Recall grants iframes (makes it a panic button; it should be a plan) ·
marks survive explosions (re-opens the undo-peek exploit the history-wipe
closed) · cross-layer recall (the sky is the comment layer; bookmarks in
comments don't resolve) · capping marks at 1 (pointless friction; the
letter register IS the vim lesson).

---

## 2. `%` — jump to the matching bracket

**One-line pitch:** paired bracket tiles are doors; `%` is the knob.
Standing on `(` teleports you to `)`, and vice versa.

### Rules

- New walkable tiles: `(` `)` `[` `]` `{` `}` — floor with a glowing
  glyph, same walkability as letters. Enemies treat them as plain floor
  and never jump.
- A **pair** is one opener + its closer of the same kind on the same
  layer. Authoring rule, validated in `loadLevel`: each kind appears
  exactly 0 or 2 times per layer (one `(` requires exactly one `)`), so a
  level offers at most three pairs per layer. Load throws on violation —
  pars can't rot on an unmatched bracket.
- Standing on either tile of a pair, `%` teleports to the partner: **1
  key, 1 tick**. Jump semantics identical to mark recall: everything in
  between is ignored, no swept interval, no toad flips.
- `%` anywhere else, or with the partner occupied (enemy/bomb): **bonk**
  (`E: no matching bracket here` / `E: the matching bracket is
  occupied`). A bomb sitting on YOUR bracket doesn't block the jump —
  only the destination matters.
- Bombs can be dropped on bracket tiles. Blasts pass over them without
  destroying them (they're floor, not terrain).

### The Trapdoor Exit (puzzle hook)

The fuse-6 escape problem is the game's oldest tension: drop a bomb, then
spend 4+ ticks getting clear (see the fuse-time-is-travel-time rule in
`docs/level-audit.md`). A bracket pair is the first *guaranteed* exit:
drop on `(`, press `%`, and you are across the map when it blows —
1 key, 1 tick, provably safe. The price is authored into the geometry:
bracket tiles sit where getting TO them is the puzzle, and the partner
may drop you somewhere with its own problems (a linter row, a mage's
open sightline). Secondary use: zombies path toward your position, so
jumping parks pursuit at the mouth of one bracket while you work the
other side — a leash the player builds out of geometry.

### Data shapes

```ts
// no LevelDef field: pairs are discovered from the map glyphs at load
// GameState
pairs: Record<string, string>; // "x,y" -> "x,y", both directions, per layer
```

### Rejected alternatives

Row-scan `%` like real vim (duplicates `f`, unreadable at a glance which
bracket matches) · auto-pairing nearest same-kind bracket with >2
instances (silent ambiguity — the 0-or-2 validation is the whole
readability guarantee) · enemies using pairs (kills determinism
readability; doors belong to the player) · brackets as terrain that
blocks movement (walkable floor keeps them multi-use: stand, fight,
bomb, jump).

---

## 3. `.` — dot-repeat (the change, not the motion)

**One-line pitch:** repeat your last completed edit for one keystroke.
The vim "dot formula," imported whole.

### Rules

- **Vim-fidelity decision** (this refines the TODO 3.1 sketch, which
  floated repeating world commands): in vim, `.` repeats the last
  *change*, never a motion. Vimberman keeps that law. `.` works **inside
  terminals only** and replays the last completed edit; in the world it
  errors free-of-tick like any unmapped... no — it is a legal command
  with nothing to repeat: **bonk** with `E: nothing to repeat. move with
  motions, repeat with edits.` (Punishing `.`-spam in the world is
  itself the lesson that dot is an edit tool.)
- A "completed edit" is any of: `x`, `r{c}`, `~`, `s{c}…Esc`, a whole
  insert session (`i`/`a`/`A` … `Esc`), `cw…Esc`, `ciw…Esc` — recorded
  with its typed content (`ciw` + `bomb` + Esc replays all of it).
  Motions inside terminals (`h l 0 $ f w b e`) do not touch the record.
- `.` replays the recorded edit **at the current cursor position** in
  the current terminal buffer, for **1 key, 1 tick — regardless of the
  replayed edit's original length.** That super-linear payoff is the
  entire point and is bounded: dot can only edit buffers, never move the
  player, so the world-motion economy is untouched.
- `lastEdit` persists across terminals within a level (fix tile A, walk
  to tile B, replay there), lives in snapshots (undo-safe), is cleared
  on level load, and — unlike marks — **survives explosions**: it is
  muscle memory, not a thing in the world.
- If the replay is illegal at the cursor (e.g. `x` at the end of an
  empty buffer): terminal-standard error, tick still spent.

### The Dot Formula (puzzle hook)

Author three-plus terminals in one level whose broken words all die to
the same edit (`zzzz`, `qqqq`, `pppp` — all `ciw bomb Esc`). The first
fix costs ~9 keys; every subsequent tile costs 3 (`i`, `.`, and the
walk). Par assumes the formula; the un-dotted route visibly cannot make
par. This is the strongest efficiency-as-score moment in the game and
needs **no new geometry** — per TODO 3.5 it ships as a keycap inside an
existing-style terminal-heavy level, and later levels' pars quietly
assume it. (Landed as level 17, DON'T REPEAT YOURSELF: three `bomb`
tiles behind rock gates, the last a `strokes: 2` golf tile that cannot
be typed — only replayed. The par route dots twice and misses par by 8
without the dot.)

### Data shapes

```ts
// GameState
lastEdit: { keys: string[] } | null; // replayable keypress sequence, terminal-mode
```

### Rejected alternatives

Repeating world motions (un-vim — teaches a falsehood the player would
have to unlearn in a real editor; counts already own that fantasy) ·
repeating bomb drops (`x` is already 1 key) · dot costing the replayed
length (kills the entire fantasy; the discount IS the feature) · dot
usable in the world as "repeat last command" (that's `@@`, a macro
concern — see TODO 3.7).

---

## 4. `/{word}` + `n` — search across the file

**One-line pitch:** type a word, fly to it — the only motion that
crosses rows. `n` re-flies. Find, generalized from the row to the file.

### Rules

- `/` opens a search prompt in the statusline echo area. **Engine-side**
  pending state (unlike the UI-only `:` prompt) so headless tests and
  the solve harness can script it. The world is frozen while the prompt
  is open.
- Costs mirror the `f`/`;` structure exactly, one octave up: `/` costs
  **1 key** on open; typed word characters are **free** (thinking);
  `Enter` costs **1 key + 1 tick** and executes. A fresh search is 2
  keys + 1 tick; `n` (repeat last search) is **1 key + 1 tick**.
  `Escape` cancels the prompt (the opening key is spent — hesitation has
  a price, same as a canceled `f`).
- Execution scans for the word among lettered-tile runs (the same runs
  `w`/`b`/`e` read) **row-major from the player's position, wrapping**,
  current layer only, and teleports the player to the word's first
  letter. Jump semantics as marks/`%`: nothing between matters, no toad
  flips.
- The match must be the **whole word** (run of letters), not a
  substring — `vim` does not match inside `vimberman`. (Runs are short;
  whole-word keeps targets legible on the board.)
- No match → bonk (`E: pattern not found: {word}`) — the Enter's key and
  tick are spent. Landing tile occupied (enemy/bomb on the first
  letter) → the search **skips to the next occurrence**; if all are
  occupied, bonk. (Skipping keeps `n`-chains alive in busy rooms and
  matches vim's "search finds the next usable thing" spirit.)
- `n` with no prior search: a free error (`E: no search to repeat`) —
  matching `;`'s established no-find behavior, not a bonk. A bare `/`
  + Enter re-runs the last search, like vim. Search memory
  (`lastSearch`) persists through the level like `lastFind`, snapshots
  for undo, survives explosions.

### Grep the Dungeon (puzzle hook)

Duplicate words become an authored transit network: scatter `bug` in
four corners of a large map and `/bug` + `n n n` rides the whole loop
for 5 keys. The author controls the route (scan order is row-major from
the player — deterministic and learnable), and controls the risk: one
instance sits in a mage's preferred quadrant, one beyond a linter row.
The count lesson returns at altitude: an occupied instance is skipped,
so the cautious player searches early and lets the skip rules route
around danger, while the greedy player `n`s straight into it. Teaching
level ("GREP") should be the biggest map yet — search is the first
motion that makes a big map cheap.

### Data shapes

```ts
// GameState
pending.search: string | null;  // open prompt buffer (engine-side)
lastSearch: string | null;
// script notation (src/engine/script.ts): '/word<cr>' expands to
// ['/', 'w','o','r','d', 'Enter']; 'n' is just n.
```

### Rejected alternatives

Charging per typed character (punishes long words; teaches nothing —
vim users type long patterns happily) · substring matching (illegible
targets; whole-word keeps the board readable) · cross-layer search (the
comment layer is a different namespace; also removes the sky's
"nothing reaches you" guarantee) · UI-side prompt like `:` (would make
search unscriptable in the solve harness, and pars must be provable).

---

## 5. Macros — `q{a}…q` record, `@{a}` replay (the endgame power)

**One-line pitch:** record a run of world commands, replay the whole run
as ONE enemy turn. The radius-3 of motions; gated last.

### Rules

- `q` + letter starts recording into that register; `q` stops. Both are
  **free** (annotation class, like `m`). While recording, every completed
  world command executes normally, costs normally, AND is captured. Echo:
  `recording @a — q to stop.`
- `@` + letter replays the register: **2 keys, 1 tick total.** Replayed
  commands cost no keystrokes and tick no clocks — the world advances
  exactly once, after the last command. `@@` re-runs the last-replayed
  register.
- **World commands only.** `i`, `/`, and `u` are refused while recording
  (free error: `that won't record. macros are pure motion.`) — terminal
  editing already has `.`, prompts and undo don't replay coherently, and
  the restriction is itself the lesson in tool boundaries. `m{a}` sets a
  mark at record time (it's free annotation) and is not captured;
  backtick-recall, `%`, counts, finds, words and slides all record fine.
- A **bonk aborts the replay** at that command (vim stops a macro on
  error); the single tick still fires. Dying or winning mid-replay stops
  it immediately — you can win inside a macro.
- Registers persist for the level, snapshot for undo (one replay = one
  snapshot, so a single `u` rewinds an entire replay), and survive
  explosions. An empty register: free error.
- Fiction: this is CI. You are automating yourself out of the job, and
  that is the victory condition.

### The One-Turn Wing (puzzle hook)

Repetitive geometry is the forcing function: N identical wings, each
crossable by the same command sequence. Wing 1 is safe to record in;
wings 2..N are hazard-timed (linter pockets) such that a manual crossing
must thread the sweep cycle but a replay crosses the whole wing in one
tick and **ends outside the swept rows before the world moves** — the
sweep cannot hit what has already left. The limit is set between
manual-cost and macro-cost, so automating at least one wing is the only
line that fits the budget.

### Data shapes

```ts
// GameState
registers: Record<string, string[]>;      // raw replayable keys
recording: { reg: string; keys: string[] } | null; // transient, not snapshot
lastMacro: string | null;                 // for @@
```

### Rejected alternatives

Macros that record terminal edits (crosses the `.` boundary and drags
prompt/session state into replay) · replay costing per-command (kills the
one-turn fantasy — the whole point is the turn economy) · allowing `@`
inside a recording (recursion in a family game) · persisting registers
across levels (each level's geometry is its own lesson).

## Keycap groups & curriculum slots

Four new vocabulary groups: `mark`, `match`, `dot`, `search`. Locked-key
echoes, in the established register (`docs/progression-and-juice.md`):

- `m`/`` ` ``: `E: 'm' — unmapped. bookmarks are a later chapter.`
- `%`: `E: '%' — unmapped. its keycap is waiting between two brackets.`
- `.`: `E: '.' — unmapped. first learn the edits worth repeating.`
- `/`/`n`: `E: '/' — unmapped. grep is earned.`

Teaching order (rationale in `docs/level-design.md`'s two-ladder model):
this doc sketched `mark` → `match` → `dot` → `search`; the campaign
landed `mark` (14) → `match` (15) → `search` (16) → `dot` (17). Search
moved ahead of dot because GREP wanted the mid-tail breather slot and
dot's level grew into the pre-finale heavy (DON'T REPEAT YOURSELF, with
a strokes-2 golf tile as the forcing function). The pedagogy holds:
marks extend the commitment lesson (one-ways, level 9); `%` extends
bomb-escape planning (level 4 onward); `search` assumes word-literacy
(level 5) and count-literacy (level 2); `dot` extends terminal editing
(`cw`/`ciw`, levels 8/11) and hands the finale its edit economy.
`GROUP_LEVEL` in `src/ui/save.ts` carries the final slots.

## Shared engine notes

- All four are world commands going through the same
  did-anything-happen gate as existing motions: change → `tick()`, no
  change → `bonk()`. No new timing systems.
- Snapshots: `marks`, `lastEdit`, `lastSearch`, `pairs` (static),
  pending-prompt state all serialize with the existing snapshot shape —
  undo works on everything above with no special cases.
- Determinism: none of the four consults RNG. Teleports are
  player-only; enemy AI reads player position exactly as before.
