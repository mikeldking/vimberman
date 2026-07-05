# Terminal minigames

The code-tile terminal (`T`, opened with `i`) started life as a single
minigame: "edit the buffer until it equals the target." This doc is the
design space around that idea — a roster of quick, progressively harder
minigames that all live inside the same one-line vim editor, plus the
rules for authoring and tuning them. Implementation lives in
`src/engine/engine.ts` (`termKey`, `termValidate`, `termRewind`,
`sparkPos`) and each tile is authored in `src/levels.ts` via
`TerminalDef.kind`.

## Design principles

Every terminal minigame must obey the game's founding contract:

1. **Turn-based, never wall-clock.** All pressure is measured in *ticks*
   (completed keystroke commands), so thinking slowly is never punished —
   only moving inefficiently. A "timed" minigame is timed against your
   keystroke economy, which is exactly the thing vim motions optimize.
2. **Quick.** A tile is a 3–10 keystroke interaction, not a sub-game you
   get lost in. The world keeps ticking while you're inside (enemies keep
   hunting, fuses keep burning), which is the real difficulty dial.
3. **Each kind drills one motion family.** `fix` teaches `x`/`r`/`cw`;
   `clean` teaches in-buffer `f` + `x`; `coins` makes counts and finds
   *mechanically mandatory*; `golf` demands the single best edit; `spark`
   adds spatial timing on top. The minigame *is* the vim lesson.
4. **Failure is a reset, not a death.** Blowing a terminal clock or
   budget resets the tile (and dumps you out, for the scan head). The
   keystrokes you wasted are the punishment — the same currency as
   everything else in the game.

## The roster

| kind | name | win condition | pressure | teaches | debut |
|---|---|---|---|---|---|
| `fix` | Repair | buffer equals `target` | world keeps ticking | `x r ~ s cw ciw i a` | L4 |
| `clean` | Lint purge | no `glitch` chars remain | none (intro of in-buffer `f`) | `f{c} x` inside the buffer | L6 |
| `coins` | Cache grab | cursor has landed on every `coin` char | `deadline` ticks or the cache respawns | counts, `f`, `w` — spam provably loses | L8 |
| `golf` | Code golf | buffer equals `target` within `strokes` keypresses | over budget → tile resets | economy; the One True Edit | L11 |
| `spark` | The scan head | all coins, while a scan cell sweeps 1/tick | zap = ejected + reset; deadline still applies | everything, plus tick-parity timing | L13 |

All kinds pay out the same way (`grants` bombs, capped at 3 held) and
share the same editor, cursor, and rendering. A solved tile goes dark
forever.

### fix — Repair (the original)

Make the buffer say the target. Content is the difficulty dial: a
one-char typo (`bpmb`) is an `l`+`r` drill; a garbage word (`rusty`)
wants `ciw`; a case-mangled word (`b0mB`) wants a mixed `r`/`~` plan.
Prefer content that reads like code — `retrun`, `bomb(;)`, `whlie` — the
fiction is debugging.

### clean — Lint purge

The buffer is a code snippet infested with a glitch character
(`bomb(##);` → delete every `#`). No target to eyeball: you hunt
characters. The intended line is `f# x` repeated — the first taste of
`f` *inside* a buffer, right after the world taught `f` on lettered
tiles. Win check: `!buffer.includes(glitch)`.

- `glitch` defaults to `#`. Pick a char that reads as noise against the
  snippet (`#`, `;`, `%`).
- No clock. This is the gentle introduction to "terminals are not all
  the same."

### coins — Cache grab

Coins (`o`) sit in a dotted buffer (`.o..o..o`). Landing the cursor on a
coin collects it (it becomes `·`). Collect them all before `deadline`
session ticks or the whole cache respawns and your keystrokes were for
nothing. Escape-ing out mid-grab also respawns it — no cheesing the
clock in two visits.

The deadline is the teaching instrument: author it so the naive plan
fails and the vim plan wins. `.o..o..o` with `deadline: 6`: seven `l`
taps = 7 ticks = respawn one coin short; `l 3l 3l` or `fo ; ;` = 3 ticks
= trivial. The player *feels* the count.

### golf — Code golf

A `fix` with a hard in-tile budget: every keypress inside the tile
(including count digits and insert typing) spends one of `strokes`.
Going over resets the buffer and the budget — try again, smarter. The
L11 debut is the purest form: `Bomb` → `bomb`, `strokes: 1`. One key.
You know the one.

Author rule: `strokes` = the optimal solve, exactly. Golf with slack is
just fix.

### spark — The scan head

Coins plus a hazard: a scan cell sweeps the buffer one position per
tick, wrapping, starting mid-buffer (`sparkPos`). End any keystroke with
your cursor under it and you're zapped: ejected from the tile, tile
reset. The deadline still applies, so you can't camp on a safe cell —
and the scan head passes over your camp anyway.

It's the terminal-scale version of the linter rows: fully deterministic,
telegraphed on screen, and solved by *planning* rather than reflexes.
The L13 tile (`o......o`, deadline 8) is a two-stroke puzzle for a calm
player (`h` grabs the coin underfoot while the head is away, `$` takes
the far one) and a death spiral for a panicked one.

## In-terminal motions

Navigation minigames needed real motions, so the terminal normal
sub-mode now supports, beyond `h l 0 $ x r ~ s cw ciw i a A`:

- `f{c}` / `F{c}` — dash the cursor to the next/previous occurrence of a
  char; `;` repeats. Memo is per-session (`TermSession.find`).
- `w` / `b` / `e` — hop between `[a-zA-Z0-9]` word runs in the buffer,
  counts supported.

All of it is gated by the same keycap vocabulary as the world (`find`,
`word`, `count` groups) — a locked key is free and echoes its usual
excuse. The minigames therefore *compose* with the progression: the L6
clean tile lands right after the world taught `f`, and its hint says so.

## Authoring a tile

1. Put a `T` on a floor tile in the map.
2. Add its entry to the level's `terminals` keyed by `"x,y"`:

```ts
'7,5': { kind: 'clean', broken: 'bomb(##);', grants: 1, hint: 'f#  xx' },
'1,5': { kind: 'coins', broken: '.o..o..o', deadline: 6, grants: 1, hint: 'l 3l 3l — spam loses' },
'12,9': { kind: 'golf', broken: 'Bomb', target: 'bomb', strokes: 1, grants: 1, hint: 'one stroke.' },
'5,7': { kind: 'spark', broken: 'o......o', deadline: 8, grants: 1, hint: "h grabs, $ finishes — don't camp" },
```

3. Prove it in-level: add a route to `test/solve.test.ts` `ROUTES` (see
   the L6 `lint` and L8 `coins` routes) or at minimum an engine test in
   `test/engine.test.ts` → `terminal minigames`.

Tuning checklist:

- **coins/spark deadline**: count the naive plan's ticks and set the
  deadline one below it; verify the counted/find plan fits with ≥2 ticks
  of slack.
- **spark buffers**: the head starts at `broken.length >> 1` and moves
  +1/tick. Walk the intended solve on paper and check no step ends on
  `(ticks + start) % len`. Keep buffers ≤ 10 cells so the wrap is
  readable.
- **golf strokes**: exactly the optimal solve. If two optimal solves
  exist, fine — both should fit, nothing longer.
- **grants**: these tiles are optional detours; 1 bomb is the standard
  fee. Reserve 2 for tiles guarded by enemies or deep in a wing.

## The future pipeline (designed, not yet built)

Roughly in difficulty order. Each stays one-line, turn-based, and ≤ ~10
strokes:

- **Cloze** — the buffer has `_` holes and a visible target; only `r`
  edits are meaningful. A pure `f_ r{c}` drill. (Implementable today as
  `fix` content.)
- **Case police** — `~`-only tile: `bOmB(x);` with mixed case, win when
  every letter is lower. A `clean` variant where the "glitch" is a
  predicate, not a char — needs a `test`-style win hook.
- **Substitute** — `:s/foo/bomb/` on the tile's ex line: introduces ex
  commands in miniature. Needs an in-terminal `:` mode.
- **Dot drill** — the buffer has N identical flaws (`x!x!x!`); fix one,
  then `.` repeats the edit. Teaches the repeat operator the world
  doesn't have yet.
- **Sort** — letters out of order (`bmob`), fixed with `x`+`p`
  transposition. Needs a one-char yank register (`x` already deletes;
  add `p`).
- **Flash** — the target shows for 2 ticks, then hides; edit from
  memory. Pressure without any clock at all.
- **Two-line buffer** — `j`/`k` and a second row; the minimal step
  toward real-file editing. Big renderer change, big payoff late game.
- **Macro tile** — `qa … q @a`: record the fix for the left half,
  replay it on the right half. The endgame flex.

Rejected on principle: anything wall-clock (typing speed tests,
real-time dodging). The game's promise is that you may think forever;
only keystrokes are spent.
