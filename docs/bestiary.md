# Bestiary

Four enemy types, each teaching a different lesson about the turn system
and each introduced to the player before it's used against them at full
difficulty. All enemy logic lives in `src/engine/engine.ts` (`zombieTick`, `impTick`,
`mageTick`, `toadTick`); rendering is in `src/render/renderer.ts` (the `enemies` draw pass over the pixel-art atlas).

Enemies share one structural choice: patrol-leashed enemies (`e.leash ===
'row'|'col'`, set per-instance via a level's `enemyOpts`) never chase —
they sweep their lane back and forth (`patrolTick`; toads patrol in hops)
regardless of type, mages included. Only un-leashed enemies run their
type's hunting AI. This lets a level author place the *same* enemy type as
either a predictable obstacle (leashed) or an active threat (free-roaming)
without new code. Zombies additionally accept `enemyOpts.phase` to control
which tick-parity they step on — an authoring knob for keeping scripted
chases intact when a level's opening changes.

## Zombie (`Z`)

**Role: punishes wasted keystrokes directly.**

- Moves on alternating ticks only (`(st.tick + e.phase) % 2 !== 0` skips
  half of them) — a genuine half-speed chaser. `phase` is assigned by
  spawn order so multiple zombies don't all skip the same ticks.
- Greedy chase: compares `|dx|` vs `|dy|` to the player and tries the
  larger-magnitude axis first, then the other, via `tryStep`
  (`zombieTick`). No pathfinding, no memory — it's a straight-line
  greedy walk that stalls on obstacles rather than routing around them.
- Design intent: because it's slow and dumb, a zombie is *only* dangerous
  if you feed it extra turns by moving inefficiently (spamming `lllll`
  instead of `5l`) or by dawdling near it. It's the mechanical embodiment
  of pillar #1 in `docs/premise.md` ("every keystroke is a decision") —
  introduced in level 2 specifically to make that lesson visceral.

## Imp (`&`, ASCII glyph `&`)

**Role: an active bomb-placing threat with its own risk/reward logic.**

- Never chases with zombie-style greedy-axis logic; instead it evaluates
  `neighbors(e)` each tick (open, non-solid, unoccupied, gap-safe
  adjacent tiles) and:
  - If it's currently standing in a **predicted blast zone**
    (`pendingBlast()` — any tile a bomb with `fuse <= 2` will hit), it
    flees to a safe neighbor if one exists. Self-preservation beats
    everything else.
  - Otherwise, roughly 60% of the time it greedily steps toward the
    player (Manhattan-nearest neighbor); 40% of the time it picks a
    random legal neighbor. This mix keeps it readable but not perfectly
    predictable.
  - Every 6 ticks (`sinceBomb >= 6`), if the player is within Chebyshev
    distance 4 and it has at least 2 open neighbors and isn't standing on
    a bomb already, it drops its own bomb (fuse 4, radius 1, flagged
    `imp: true`).
- Imp-planted bombs use the **same blast/chain logic as player bombs** —
  they crack soft rock, they chain into other bombs (including the
  player's), and they can kill other enemies caught in the blast. The
  bestiary note in the top-level `README.md` puts this plainly: "bait it
  into mining for you, or into fragging its friends." This is the design
  payoff of routing imp bombs through the exact same `blastTiles`/
  `explode` path as player bombs — no special-casing needed, so the
  environmental interactions (rock-cracking, chain reactions, friendly
  fire on other enemies) fall out for free.
- Introduced in level 3 ("LEAP OF FAITH") as a leashed patrol first,
  before appearing free-roaming and bomb-planting in later levels.

## Toad (`Q`)

**Role: the enemy that walking cannot answer — flight is the weapon.**

- Runs a readable 3-tick hop cycle (`toadTick`): two crouch ticks, then a
  hop of **up to 2 tiles** toward the player, greedy-axis like the zombie.
  The hop's intermediate tile is *flown over* — only solid terrain blocks
  it — so toads clear the gaps `~` that stop every other walker. You
  cannot ditch a toad at a pit.
- The renderer shows the tell: it visibly squats on the tick before it
  hops (`hop === 1`).
- **Flipping:** any completed horizontal flight motion (`w b e f F t T ;
  ,`) whose swept span crosses the toad knocks it onto its back for a
  6-tick countdown (rendered like a bomb fuse). While flipped it is
  harmless and walkable; the player entering its tile squashes it for
  **+2 keystrokes** of budget. `t`/`T` stopping one short flips nothing —
  the `f` vs `t` distinction has teeth. On wake-up it spends one full
  crouch tick before it may hop (telegraph contract).
- Dies to blasts and linter sweeps like anything else (no squash refund —
  only the boot pays out).
- Introduced in level 7 ("FLIP THE SCRIPT") with free-roamers and a
  row-leashed metronome variant; design rationale in
  `docs/new-mechanics.md`.

## Mage (`M`)

**Role: a telegraphed ranged threat that punishes staying aligned.**

Runs a strict 3-state cycle, each state lasting a readable number of
ticks (`mageTick`):

1. **`cool`** (default 3 ticks) — idle, harmless, just counting down.
2. **`tele`** — on the tick the cooldown expires, it scans the whole
   level for a valid teleport spot: floor or letter tile, Manhattan
   distance 3–6 from the player, **not on the player's current row or
   column**, and unoccupied. It picks one at random and immediately
   starts telegraphing it (`fx.telegraph`, an animated rune-circle sprite drawn by `src/render/renderer.ts`)
   one tick *before* it actually appears there.
3. **`port`** — it warps to the telegraphed tile (becoming `immune` to
   bomb blasts for this one tick — see below), then fires a bolt along
   whichever axis is aligned with the player (or the closer axis if
   somehow neither is aligned), pushing a `projectile` that then travels
   one tile per subsequent tick via `moveProjectiles` until it hits a
   wall, a bomb, an enemy, or the player.

Two details make this readable rather than cheap:
- It **deliberately never teleports onto the player's row or column**
  (`if (x === p.x || y === p.y) continue;`) — so the moment right after a
  teleport is always safe; the danger is the bolt it fires *after*
  landing, and only if you're aligned with its new position on your next
  move.
- `e.immune = true` for the teleport tick prevents a bomb blast from
  killing it mid-warp, which would otherwise feel like the game cheated
  the player out of a kill they lined up — the mage is only vulnerable
  while actually sitting still in `cool`/waiting.
- The `README.md` bestiary summary distills the counterplay perfectly:
  "teleports on a readable 5-turn cycle and fires bolts down its row and
  column. Never linger aligned with the rune." (3 cooldown + 1 telegraph +
  1 port ≈ the "5-turn" framing players experience.)

Introduced in level 11 ("WARPED WORDS") alongside `~`/`ciw`, and again in
the finale (level 13) alongside every other enemy type at once.

## Design rationale: why these four, and this order

- **Zombie** teaches "the clock is your keystrokes, not your reflexes."
- **Imp** teaches "the environment (rocks, bushes, other enemies) is
  interactive, and enemies can be used against each other/the terrain."
- **Toad** teaches "your motions are not just travel — the right motion
  is also the counterplay."
- **Mage** teaches "position relative to threats matters even at a
  distance, and the game will always warn you before it hurts you."

Together they escalate from *reactive positioning* (zombie) to *active
environmental play* (imp) to *motion-as-weapon* (toad) to *anticipatory
reasoning* (mage) — which mirrors the escalation in the vim-motion
curriculum itself, from raw movement (`hjkl`) to structural awareness
(`w`/`b`/`e`, one-way tiles) to precise, deliberate edits (`ciw`, `~`).
The linter (a row-sweeping hazard, not a creature) is documented in
`docs/new-mechanics.md`. See `docs/level-design.md` for how enemy
introductions are paced against motion introductions level-by-level.

## Adding a new enemy type (guidance for future work)

If a fourth enemy type is ever considered, keep to the pattern that makes
the existing three cheap to reason about:
- Give it one clear *tell* the player can learn (zombie: visibly slow;
  imp: fixed bomb cadence; mage: telegraph glyph).
- Route any bomb/hazard it creates through the existing `blastTiles`/
  `explode`/`pendingBlast` machinery rather than inventing a parallel
  hazard system — this is what let the imp's bombs "just work" with
  chaining, rock-cracking, and friendly fire for free.
- Support `leash: 'row' | 'col'` from the start via `patrolTick` so level
  authors can dial its threat level down to "obstacle" when a level needs
  a gentler introduction.
