# Progression & Juice

How Vimberman turns a vim curriculum into a power fantasy: motions as
collectible powerups, hints that respect the player's dignity, and
celebration systems that make efficiency *feel* like the score it already
is. Everything here respects the prime directive from `docs/premise.md`:
**thinking is free, moving costs.**

---

## 1. Keycaps: motions are Metroid powerups

### The design (hybrid, weighted toward in-world pickup)

Every motion group is **locked until you collect its keycap** — a
physical `?` tile placed in the level that teaches it, sitting on the
forced path within 1–3 tiles of spawn, reachable using only
previously-taught vocabulary. You step on it, the HUD tray pops a new
chip, and the rest of the level (which the layout already makes
impossible without the new motion) is now solvable. The curriculum
doesn't change; the *acquisition moment* becomes diegetic. Pickup is the
fiction; level-reach is the fallback (see migration rules below).

Why not unlock-on-intro-card: that's menu progression wearing a
trenchcoat — no moment of acquisition, nothing to *touch*. Why not
mid-level unlocks with "second half needs it" redesigns: the teaching
maps require their motion from tile one, and redesigning all of them
violates "the level layout is the lesson." Putting the keycap at the
mouth of the level keeps every map intact minus one floor tile.

### Vocabulary groups and where their keycaps live

| Group id | Keys gated | Keycap lives in |
|---|---|---|
| `core` | `h j k l`, `u`, `x`, `Escape` | Baseline — granted on a fresh save. |
| `count` | digit prefixes `1–9` (and `0` inside a count) | COUNT THE CORRIDORS |
| `find` | `f F t T ; ,` | LEAP OF FAITH |
| `edit` | `i` (world) + terminal basics (`x r h l 0 $ s a A i`) | BUGFIX BOMBS |
| `word` | `w b e` | WORD BRIDGES |
| `line` | bare `0`, `$`, `gg`, `G` | THE LONG WAY |
| `cw` | `c` operator in terminals | REWRITE THE RULES |
| `inner` | `~` and `ci` in terminals | WARPED WORDS |
| `sky` | `Ctrl-u`, `Ctrl-d` | HEAD IN THE CLOUDS |

Levels that teach a hazard or a synthesis grant no keycap — the tray
visibly *not* growing is itself a signal that the lesson is judgment, not
vocabulary.

### Exact rules

- **A locked keypress is FREE.** No `keys++`, no `tick()`, no enemy turn.
  It is not a `bonk()` — a bonk is a *legal command that failed* (spam is
  punished); a locked key is *not in your language yet*, exactly like
  arrow keys, which are already free and rejected. Punishing exploration
  teaches "don't experiment," which is the opposite of the game's job.
  The ui-smoke contract extends to this: locked keys must cost zero and
  move nothing.
- Locked keypress feedback: error tone + echo, every time; plus a
  one-time toast explaining the tray.
- **Pickup**: stepping on `?` (or sweeping it mid-slide — tile entry
  fires per tile) grants the group permanently, plays a pickup sting, and
  pops the tray chip. Enemies treat `?` as floor so determinism is
  identical whether or not it's been collected.
- **Persistence**: collected groups are saved (`save.keycaps`). On
  replaying a teaching level when the group is already owned, `loadLevel`
  strips the `?` to floor — no re-collection theater.
- **Migration / fallback**: on load, grant every group whose teaching
  level index is below `save.unlocked` (covers v1 saves and any future
  level-skip). Reach implies ownership; the pickup is only ever the
  *first* acquisition.
- Tests and headless use: engine vocabulary defaults to **everything
  unlocked** (`setVocab(null)`); only the UI opts in.

### HUD: the keycap tray

A single line in the HUD, always visible in GAME: collected groups as
bright chips, uncollected as dim `[?]` slots so the row visibly grows
Metroid-item-bar style across the campaign:

```
[hjkl] [1-9] [f t] [?] [?] [?] [?] [?] [?]
```

When a locked key is pressed, its `[?]` slot flickers once — "the thing
you just asked for lives *here*."

### Copy (locked-key echoes, dry and specific)

- digits: `E: counts — unmapped. level 2 teaches you to count.`
- `f`/`F`/`t`/`T`: `E: 'f' — unmapped. its keycap is lying around on level 3.`
- `i`: `E: 'i' — unmapped. you learn to edit on level 4. terrifying, I know.`
- `w`/`b`/`e`: `E: 'w' — unmapped. that keycap ships with level 5.`
- `0`/`$`/`g`/`G`: `E: '$' — unmapped. level 6 sells the long-distance plan.`
- `c` (terminal): `E: 'c' — unmapped. rewriting words is a level 8 privilege.`
- `~`/`ci` (terminal): `E: '~' — unmapped. level 11. patience.`
- `Ctrl-u`/`Ctrl-d`: `E: the sky is a level 12 feature.`
- One-time toast: `grey slots in the tray are keycaps you haven't found yet`
- Pickup echo: `keycap [w b e] installed — words are load-bearing now`

---

## 2. Contextual hints: five layers, escalating, each earned

**Layer 1 — intro card** (exists). Unchanged.

**Layer 2 — environmental** (exists: lettered tiles are `f` targets,
words are bridges, terminal `hint` fields). Authoring rule: every
teaching level's letters should be usable to *demonstrate* the motion in
its first two rows. No lettered tiles spelling "PRESS W" — that's a
tutorial, not a level.

**Layer 3 — adaptive nudges** (generalizing the `4l` toast). All toasts,
all rate-limited via the existing `toastCount`:

| Nudge | Trigger (precise) | Copy |
|---|---|---|
| Count (exists) | 4 consecutive identical uncounted `hjkl` presses | `try 4l instead of llll` |
| Find | Run of ≥6 same-direction uncounted `h`/`l` steps AND the row has a lettered tile beyond the player in the travel direction AND `find` unlocked | `psst — f{c} was one keystroke. your pinky is doing cardio.` |
| Gap | Last press was `h`/`l`, it bonked, the adjacent tile that way is `~`, `word` unlocked, and a word exists beyond the gap | `gaps stop feet, not flights — w soars over ~` |
| Bonk-spam | 3 `E:` echoes within the last 6 keypresses | `three bonks. the wall remains undefeated. Esc, breathe, look.` |
| Enemy postmortem | 2nd death to the same enemy type on the same level this session — extra line on the DEAD card, not a toast | zombie: `zombies step every other turn. you have counts. do the math.` · imp: `imps flee lit fuses. herd it, don't chase it.` · mage: `the mage telegraphs ◌ a full turn early. stop sharing rows with it.` · toad: `toads hop every third turn — or fly over one and see what happens.` |

**Layer 4 — hints on demand, via the command line** (§4). `:help`
reopens the reference card mid-level; `:hint` prints the level's authored
hint line (`LevelDef.hint`, one sentence, technique not route). Both are
**free and unmarked** — reading the manual is the most vim-sanctioned
activity there is. Dignity is preserved by tone, not by penalty.

**Layer 5 — the ghost of par.** After **3 combined fails/deaths on the
same level in one session**, the FAIL/DEAD card gains a line:

> `the ghost of par whispers: 10l 6j 9l ...`

— the first 4 commands of the reference solution (`LevelDef.solution`,
shared with `test/solve.test.ts` so it can never rot). Free and unmarked
— four commands is a nudge, not an answer. **Later (v2):** full ghost
replay rendered as a dim `@` one command ahead, marking the clear
`assisted` (never capping stars — copying a vim solution keystroke for
keystroke *is* the pedagogy).

---

## 3. Rewards: best effort-to-fun ratio first

**3a. Golf scoring (display only).** Below par renders in gold with golf
notation: `best 37 (−3) GOLFED`. The CLEAR card, when under par:
`GOLFED −3. par was a suggestion, apparently.` At exactly par:
`par. machine-precise.`

**3b. End-of-level stats card.** The engine counts `bonks` (in `bonk()`)
and per-command usage (`cmdCounts`). CLEAR card grows a postmortem block,
the vim equivalent of `:profile`:

```
KEYS 37 / par 40  (−3 GOLFED) — new best!
bonks 2 · favorite motion f ×9
```

With one dry reactive line: bonks 0 → `zero bonks. the walls never felt
you.` · bonks ≥ 6 → `the level won ${bonks} arguments.` Efficiency must
be *legible* — players can't chase a number they can't see.

**3c. Flow streak (v2, pure presentation).** Consecutive compound
commands with no bonk light a small `~flow ×N` tag on the statusline and
raise the slide-sound pitch; any bonk resets silently. Deprioritized
behind 3a/3b.

**Explicitly deprioritized:** cosmetics, per-motion mastery badges, daily
golf seeds.

---

## 4. The `:` command line

`:` in normal mode opens an ex prompt in the statusline echo area.
**Entirely free** — intercepted in the UI before the engine (the engine
would charge a keystroke via the "not a motion" default). Typing in the
prompt costs nothing, enemies stay frozen — this is thinking, and
thinking is free. `Esc` cancels, `Enter` executes.

**v1:**

| Command | Effect |
|---|---|
| `:help` | Opens the HELP card mid-game (Esc returns to GAME). |
| `:map` | Lists unlocked groups + `N keycaps still in the box.` |
| `:hint` | Prints `LevelDef.hint`; falls back to `no hint. the map is the hint.` |
| `:q` | Quit to level select. |
| `:q!` | Restart level instantly. |
| `:wq` | Easter egg: `you're not done refactoring.` |
| anything else | `E: not an editor command: {cmd}` |

**Later:** `:s/foo/bomb/` as a terminal-mode teaching moment (the natural
next rung after `ciw`); `:reg` showing recent commands; `/` search.

---

## 5. Data and save-shape changes

```ts
// types.ts — LevelDef additions
hint?: string;         // one-line :hint text
solution?: string;     // reference keystroke script (shared with solve tests)
gutter?: boolean;      // line-number gutter (default true; level 1 sets false)
keycaps?: Record<string, string>;  // "x,y" -> vocab group granted by the ? tile
sky?: string[];        // cloud layer (see docs/new-mechanics.md)
linters?: Record<string, LinterDef>;

// GameState additions
bonks: number;
cmdCounts: Record<string, number>;
layer: 'ground' | 'sky';

// FxHooks additions
keycap(group: string): void;   // pickup fanfare
locked(key: string): void;     // locked-key feedback (distinct from error())
sweep(tiles): void; rise(): void; drop(): void;

// engine — new API
setVocab(groups: Set<string> | null): void;  // null = all unlocked (default; tests unaffected)
```

```ts
// save.ts — bump to v2
interface SaveData {
  v: 2;
  unlocked: number;
  keycaps: string[];                    // group ids
  levels: Record<string, LevelRecord>;
  settings: { sound: boolean };
}
// migration v1→v2: keycaps = all groups taught by levels < unlocked, plus 'core'.
```

UI state additions (session-only, no save): key ring buffer, per-level
fail/death counters, `deathsBy`.

---

## 6. Purity flags — keystroke-budget conflicts, resolved

1. **Locked keys are free** — locked ≠ bonk. A bonk is a command in your
   vocabulary that failed (costs, ticks); a locked key is outside your
   language, same class as arrow keys (free, rejected, mocked). Tested
   invariant.
2. **`:` prompt is free with the world frozen** — consistent with the
   Escape-pause precedent; there is no clock, so nothing to exploit.
3. **Keycap pickups cost real keystrokes** (1–2 single steps before the
   new motion is usable). Placement rule: the keycap sits on the forced
   path so the tax is those 1–2 keys and never a detour; pars are tuned
   with the pickup included.
4. **`:hint`/`:help` free and unmarked** — manuals are free; only the
   (v2) full ghost marks `assisted`, and even that never caps stars.
5. **Stats are pure presentation** — no engine costs, no currency. The
   only spendable resource remains the keystroke.
