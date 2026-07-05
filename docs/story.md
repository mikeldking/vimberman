# Story — The Cursor, The Legacy, and the Merge Conflict

The narrative spine for Vimberman. This upgrades the framing device in
`docs/premise.md` ("the world is broken code") into an actual arc without
betraying its rule: **the fiction exists to motivate the mechanics.** The
entire story budget is ~30 lines of copy across three chapter cards, a
handful of antagonist one-liners, and one lore line per enemy. No
cutscenes, no lore walls, nothing longer than one card, everything
skippable. If a line of fiction doesn't map to a real rule of the game, it
doesn't ship.

Implementation targets: item 2.2 (chapter cards) and 2.3 (antagonist
voice) in `docs/TODO.md`. Both should be implementable from this doc with
zero new creative decisions.

---

## The cast

### THE CURSOR — the player

The last responsive process in an abandoned codebase. A blinking block of
pure intent. It never speaks — its entire personality is expressed through
motion efficiency, and its only voice is the statusline. The game's
existing smug-but-rooting-for-you narrator voice (intro cards, toasts,
quips) is the *editor* talking to its cursor; that voice is unchanged by
this doc.

### THE LEGACY — the antagonist

The rot itself. **It never appears as a sprite and never will** — it is
the accumulated neglect of the codebase, and every hostile thing in the
game is a symptom of it:

| Symptom | What it "really" is | Mechanical truth it maps to |
|---|---|---|
| Zombie | a deprecated call nobody deleted | runs its old loop at half speed, forever (alternating ticks) |
| Imp | a hotfix that went feral | still ships patches (bombs) on a fixed cadence; flees lit fuses — even a hotfix recognizes a rollback |
| Toad | a flaky test | passes twice, lunges on the third (3-tick hop cycle); hops the gaps in coverage (`~`) |
| Mage | a race condition | never where you check (never ports onto your row/column); strikes along the axis you share; always shows in the logs first (telegraph) |
| Linter | the old CI, still running | rules intact, judgment gone; sweeps on schedule; the margins survive because nothing was ever written there |
| Broken words on code-tiles | The Legacy's handwriting | fixing a word is taking territory back — which is why it arms you |

**Voice:** The Legacy speaks only in code comments — lowercase, leading
`//`, no exclamation marks, no menace theatrics. It is not evil; it is
entropy with seniority. It calls the player "the cursor," "the intern,"
or "the new process," never by anything grand. It is allowed to be
funny exactly the way a burnt-out staff engineer is funny.

**Where it speaks:** FAIL and DEAD cards only. **The Legacy never speaks
on a CLEAR card** — winning shuts it up. That silence is the reward.

### The sky — the comment layer

The cloud layer (level 12+) gets one sentence of fiction that is also its
exact rulebook: **the sky is the comment layer — nothing up there
executes.** No bombs, no enemies, no explosions aloft, because comments
don't run. Ground enemies gathering under your shadow are processes
polling a reference they can't dereference. Use this line anywhere the
sky needs explaining; never invent a second metaphor for it.

### The exit

`E` is a clean write-quit. The campaign's last words are already in the
game ("`:wq` and go touch grass") — the arc simply earns them: you are
not escaping the codebase, you are *finishing the refactor* so you're
allowed to leave.

---

## The arc — three chapters over 17 levels

Chapter boundaries match the existing difficulty/curriculum structure
(see `docs/level-design.md`): cards appear before levels 1, 5, and 11.

**CHAPTER ONE — ONBOARDING (levels 1–4).** A cursor blinks on in a repo
where the build has been failing for years. Learn to move, learn to
count, learn that the broken words are weapons if you fix them. Beat: the
first bomb is the first time the codebase pushes back on the rot instead
of accumulating it.

**CHAPTER TWO — THE ROT SPREADS (levels 5–10).** The deeper files. The
Legacy has noticed the edits. Its symptoms escalate from shambling
(zombies) to systemic (flaky tests, one-way flows you can't un-take, CI
sweeping rows on a timer). Beat: the world's *rules* are hostile now, not
just its inhabitants.

**CHAPTER THREE — MERGE CONFLICT (levels 11–17).** The core modules
nobody was allowed to touch. The rot stops shambling and starts racing
you for the cycle (the mage debuts). Above the code floats the comment
layer, where nothing executes. One refactor left. Beat: everything the
game taught, spent all at once — and then the epilogue: the last level
teaches macros, and the true ending is automating yourself out of the
job. The codebase no longer needs you. `:wq`, earned.

---

## Tone rules (binding for all story copy)

1. **Dry, deadpan, software-native.** Vocabulary comes from engineering:
   deprecation, CI, rollback, merge, entropy. Never fantasy: no realms,
   no destiny, no darkness-rising.
2. **The Legacy writes lowercase comments** (`// like this.`). The
   pronoun I and acronyms (CI) keep their caps — entropy is lazy, not
   illiterate. The editor/narrator voice keeps its existing sentence
   case. Never confuse the two registers.
3. **One card, max 6 lines, ~60 chars per line, always skippable**
   (Enter/Esc). Chapter cards show once per save, ever.
4. **Fiction must map to mechanics.** Every story line must be literally
   true of the rules ("nothing executes in the comment layer" = no bombs,
   no enemies aloft). If the rules change, the line changes.
5. **At most one joke per card**; the rest is atmosphere. No exclamation
   marks anywhere in Legacy or chapter copy.
6. **The Legacy never gives gameplay advice.** Mechanical lessons stay in
   the existing POSTMORTEM/tip lines; Legacy lines are appended *below*
   them and never replace them.

---

## Copy inventory (implement verbatim)

### Chapter cards (item 2.2)

Shown before the level, ahead of the normal intro card; once per save.

**Before level 1 — `CHAPTER ONE — ONBOARDING`**
```
somewhere below, a build has been failing for nine years.
nobody reads the logs. nobody runs the tests.
tonight, in an abandoned buffer, a cursor blinks on.
that's you. move like you mean it.
```

**Before level 5 — `CHAPTER TWO — THE ROT SPREADS`**
```
you fixed four files, and something noticed.
the deprecations are walking. the tests are hopping.
deeper in, the rules themselves stop being on your side.
all of this was written by someone. all of it was left here.
keep your words together and your rows clean.
```

**Before level 11 — `CHAPTER THREE — MERGE CONFLICT`**
```
the core modules. the ones nobody was allowed to touch.
in here the rot doesn't shamble. it races you for the cycle.
above the code, the comment layer. nothing executes there.
one refactor left. write it clean, quit clean.
:wq is earned, not typed.
```

### The Legacy — FAIL card lines (item 2.3)

Appended below the existing tip, dim, rotated per-session by fail count
(deterministic: `lines[failsThisLevel % lines.length]`, not random):

```
// the cursor grows still. like all the others did.
// out of budget. I shipped worse than this, in my day.
// don't take it hard. entropy is a team player.
```

### The Legacy — DEAD card lines (item 2.3)

Same placement and rotation rule (below the postmortem lesson, never
replacing it):

```
// another process joins the legacy. plenty of room.
// I was efficient once, too. then I accumulated.
// stay. the maintenance never ends, and nobody minds it here.
```

### Enemy lore (one line each — future `:help` bestiary or card use)

```
zombie: a deprecated call nobody removed. it still runs, every other tick, forever.
imp:    a hotfix that went feral. still ships patches on schedule. still doesn't check the radius.
toad:   a flaky test. green twice, then it lunges. flip it and it finally reports consistently.
mage:   a race condition. never where you checked. always aligned the moment you stop looking.
linter: the old CI. rules intact, judgment gone. the margins survive because nothing was written there.
```

---

## Where the copy lives (data, not scattered strings)

Create `src/ui/story.ts` as the single home for all narrative copy:

```ts
export interface Chapter { level: number; title: string; lines: string[] }
export const CHAPTERS: Chapter[];        // the three cards above
export const LEGACY_FAIL: string[];      // FAIL one-liners
export const LEGACY_DEAD: string[];      // DEAD one-liners
export const ENEMY_LORE: Record<'zombie'|'imp'|'toad'|'mage'|'linter', string>;
```

- `src/ui/screens.ts` imports from `story.ts`; no narrative strings are
  ever inlined in screen code. (Existing mechanical copy — tips,
  postmortems, quips — stays where it is; it's the editor's voice, not
  story.)
- Save shape for 2.2: `save.chapters: number[]` — chapter `level` values
  whose cards have been shown. Default `[]`; migration is the usual
  defaults-spread in `src/ui/save.ts`. Replays via level select do not
  re-show (membership check on entry).
- Rendering: chapter cards reuse the overlay panel; title in the existing
  `h2` style, lines in `.dim`, Legacy lines in `.dim` with a `//` prefix
  kept in the copy itself.

## What stays out (rejected)

- A visible antagonist sprite/boss — The Legacy being unfaceable is the
  point; the finale is a level, not a duel.
- Mid-level dialogue, NPC terminals, collectible lore notes — all violate
  "thinking is free, but reading walls isn't fun."
- Renaming levels or rewriting existing intro cards to be story-flavored
  — the curriculum voice already works; the story wraps around it.
