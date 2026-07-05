# The Arsenal — word-keyed bomb variants

Design spec for making the *word you craft* select the weapon. The
terminal already validates `buffer === target`; this doc gives that fact
teeth: fix a tile to say `bomb` and get the classic plus-blast, fix it to
say `grep` and get a row-sweeping line bomb, fix it to say `sed` and get
a terraformer that hurts no one. The fiction has been waiting for this —
bombs come from editing, so different edits should build different tools.

Implementation items: 4.2 (grep), 4.3 (sed) in `docs/TODO.md`; yank/put
is specced here as wave 2. Each section is self-contained so the arsenal
can ship **one variant at a time**; the inventory rework in §1 is the
only shared prerequisite.

## The design triangle

| Word | Kills? | Digs? | Shape | One-liner |
|---|---|---|---|---|
| `bomb` | yes | yes | plus, radius r | the generalist (current behavior, unchanged) |
| `grep` | yes | **no** | its whole row | a handheld linter: finds every match in the line |
| `sed`  | **no** | yes | plus, radius r | `s/rock/floor/` — the pacifist's key |

Every variant keeps the same clock: **all fuses are 6.** The word changes
the shape, never the timing — the player reads one countdown their whole
career. Crafting costs are the edit keys, exactly as today; note that
`sed` is a three-letter word, so the gentlest tool is also the cheapest
to type. That is not an accident.

---

## 1. The typed inventory (shared prerequisite)

`player.bombs: number` becomes `player.arsenal: BombKind[]` — an ordered
queue, capped at 3 as today.

- **Crafting** pushes `grants` copies of the tile's kind onto the queue
  (clamped at the cap, oldest kept — you can't overwrite what you carry).
- **Dropping** (`x`) places the queue's **front** bomb: first crafted,
  first dropped. FIFO keeps a planned route plannable — craft in usage
  order. No selection UI, no new keys; the plan IS the interface.
- The `B` bush grants one `bomb` (the generalist), as today.
- **Which kind a tile arms**: `TerminalDef.arms?: BombKind`. Default:
  if the tile's `target` is itself a known kind name (`bomb`, `grep`,
  `sed`), that kind; otherwise `bomb`. `arms` exists for the minigame
  tiles (clean/coins/golf/spark) whose targets aren't words.
- **HUD**: the bomb readout becomes the queue, leftmost = next drop:
  `x: [b][g][s]` — chips in the variant's color (bomb amber, grep red,
  sed green). Placed bombs render distinctly: grep pulses a horizontal
  bar; sed glows green and doesn't shake the screen when it goes.
- Engine compat: `Bomb` gains `kind: BombKind`; imp bombs are always
  `bomb` (kind `'bomb'`, radius 1, as today).

```ts
type BombKind = 'bomb' | 'grep' | 'sed';
// Player: arsenal: BombKind[] (replaces bombs: number; length is the count)
// Bomb: + kind: BombKind
// TerminalDef: + arms?: BombKind
// FxHooks: explosion(tiles) unchanged; grep reuses fx.sweep; + fx.sed(tiles)
```

Tests currently poke `st.player.bombs = 1`; they migrate to pushing onto
`arsenal`. A `bombs` getter may remain for the HUD during transition but
the queue is the truth.

---

## 2. `grep` — the line bomb (item 4.2)

**Detonation:** sweeps the bomb's **entire row**, both directions,
stopping at walls (`#`/`!`) exactly like a linter beam (`linterTiles`
logic, and the same `fx.sweep` presentation — the player already knows
this beam).

- **Kills occupants only**: enemies, projectiles, and the player if
  they're standing in the row (ground layer only, like all bombs). It
  does **not** break rock or bushes, does **not** crack `&`, and does
  **not** detonate other bombs — identical to the linter contract, which
  players already trust. A grep bomb through a rock wall gap kills the corridor, not the
  corridor's walls.
- Margins `|` shield against grep sweeps too (same beam rules, no new
  exceptions).
- **Chained BY a plus-blast**: yes — a `bomb` blast touching a placed
  grep detonates it (its shape). Chains never propagate *from* a grep
  (beams don't burn).
- **Imp AI**: `pendingBlast()` must include a soon-to-fire grep's row —
  imps flee it (self-preservation reads all shapes). Toads stay dumb.
- History/marks: any detonation wipes undo history and marks — one
  uniform commitment boundary, all kinds.
- **Pedagogy / first home**: retrofit level 6 THE LONG WAY's `clean`
  tile (`bomb(##);` — the lint-purge minigame) with `arms: 'grep'`:
  purging lint arms you with a linter. The comb geometry's long shafts
  and rows make a row-sweep legible, and the level's zombie lane gives
  it a target. Par may tighten; re-prove routes.

---

## 3. `sed` — the terraformer (item 4.3)

**Detonation:** plus-shaped, radius r (player radius), but it's a
substitution, not an explosion:

- Converts soft rock `%` → floor; opens bushes `*` into their items
  (like a blast does); leaves hard rock `&` alone at ANY radius —
  `s/rock/floor/` doesn't match granite, and R-pickups stay relevant.
- **Kills nothing.** Enemies, the player, projectiles: unharmed. You can
  stand on a sed bomb when it goes. An imp caught in it shrugs.
- Sed never detonates anything else, but a plus-blast touching a placed
  sed DOES trigger it (heat runs the script early) — see the chain
  matrix below.
- `explosionsThisTick`/fx: sed uses its own `fx.sed(tiles)` — green
  wash, no screen shake, a soft chord instead of a boom.
- History/marks wipe: yes — terrain changed forever; same boundary.
- Imps do NOT flee a pending sed (it can't hurt them). This is readable
  cruelty: the pacifist's tool doesn't clear the room, and the room
  knows it.
- **Pedagogy / first home**: retrofit level 8 REWRITE THE RULES' second
  terminal (`fizz`, currently target `bomb`) to target `sed` — `cw sed
  Esc` is literally a shorter edit, and the level's rock gates make the
  choice real: the sed opens the plug next to E without killing the
  col-leashed zombie you might have wanted dead. Alternatively a new
  "STREAM EDITOR" level in the 6.3 growth; whichever lands first.
- **Showcase (shipped 2026-07-05)**: L18 CHOOSE YOUR WORDS is the
  arsenal's load-bearing home — three terminals, three word-gated bands,
  one exit; the crafted word IS the route decision. The sed lane is the
  par proof of "the gentlest tool is also the cheapest to type."

---

## 4. Wave 2 — `y`/`p` yank & put (spec only; schedule with 6.3)

Not a crafted kind: a pair of world commands over **placed** bombs.

- `y` on a tile with a placed bomb picks it up into a single "hand"
  slot: 1 key, 1 tick. **The fuse keeps ticking in your hand.**
- `p` places it on the current tile (1 key, 1 tick). `x` still drops
  from the arsenal queue; the hand is separate and holds at most one.
- Fuse reaching 0 in hand: you die — `hoisted by your own yank`.
- You CAN yank an imp's bomb. Returning it to the imp's doorstep is the
  entire reason this exists.
- While holding: `u` still works (the hand snapshots); riding an updraft
  with a lit bomb is legal and extremely funny (`no bombs in the clouds`
  applies to `p`, not to carrying).
- Vocab group `yank`, gated late (with or after `macro`).

---

## Chain-reaction matrix (the one table to keep true)

| ...touches a placed → | bomb | grep | sed |
|---|---|---|---|
| **bomb blast** | detonates | detonates | triggers |
| **grep beam** | nothing | nothing | nothing |
| **sed wash** | nothing | nothing | nothing |
| **linter beam** | nothing (as today) | nothing | nothing |

Only plus-blasts propagate. Beams kill, washes edit, and neither burns.

## Rejected alternatives

Bomb variants as floor pickups (breaks the crafting fiction — weapons
come from editing) · per-kind fuse lengths (two clocks to read; the
tension system lives on one number) · a selection key to reorder the
queue (crafting order is the plan; adding UI would un-vim it) ·
`rm -rf` mega-bomb (tempting, but "destroys items too" punishes loot
routes randomly; revisit only if a level design begs for it) · typed
caps per kind (inventory Tetris is not the fantasy).
