# Vimberman — Enhancement TODO

This is the working roadmap, meant to be executed **one item at a time** by
whoever picks it up next (human or agent).

Phases 1–5 and items 6.1–6.3 of the original 2026-07-04 roadmap are **done and
shipped**: menu/shell polish, the story arc, all five v2 motions (marks, `%`,
`.`, `/`+`n`, macros), the typed bomb arsenal (bomb/grep/sed), sky v2
(wind/kites/flytrap), and the 20-level campaign with chapter select. See git
history and the `done:` notes in prior revisions of this file for the details.

## How to work this list

1. Pick the **topmost unchecked item**, unless it's marked `blocked:`.
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

## Remaining

- [x] **6.4 Drill mode.** Freeform practice: pick any owned motion group, get a
  procedurally-lite arena (static, no enemies, coin-style targets), no save
  impact. Entry from title menu. This is the "arcade excuse" for audience #1
  in premise.md.
  done: 2026-07-05 — DRILL on the title menu → picker of 14 arenas (one per
  vocab group, `src/ui/drills.ts`), listed once the group's keycap is owned.
  Arenas are static K-coin rep tracks; end cards are save-neutral
  (`ui.drill` guard in `showClear` + routing). Par proofs + invariants in
  `test/drill.test.ts`; smoke flow + save-immutability in ui-smoke. Next
  agent: drills assume core + their own group only — keep it that way.

## Parking lot (unranked, revisit now that 6.4 closed)

- ~~Arsenal showcase level~~ — shipped 2026-07-05 as L18 CHOOSE YOUR WORDS:
  three terminals (sad→sed / grip→grep / b0mb→bomb), three word-gated
  bands, one exit. sed digs the plug shaft and never hurts you (speedrun,
  par 15); grep is the row answer to a 7-wide triple-zombie corridor no
  single plus-blast can cover; bomb does the plug-and-zombie shaft with
  two drops, priced accordingly. Routes proven in solve tests. Note for
  the next agent: blast rays are ABSORBED by the first `%` they break —
  stacked plugs cannot be cleared by one radius-2 blast.
- `S` shield bush (+2 iframes, once) — deferred from 4.4; add only when a
  level design wants a shield beat.
- Level-shape variety: a 40-wide "one-liner" map (pure `0 $ f ;` fantasy), a
  tall shaft map for `gg/G` — needs camera/scroll work in the renderer first;
  renderer currently assumes the whole map fits the canvas.
- `:s/foo/bomb/` as a late terminal minigame (progression doc already flags it).
- Ghost replay v2 (full solution ghost, `assisted` flag) — progression doc §2.
- Flow-streak juice (progression doc §3c).
- Sound design pass: per-variant blast sounds once Phase 4 lands.
- yank/put bomb handling (`y`/`p`, arsenal.md wave 2) — pick a placed bomb
  back up while its fuse ticks; steal imp bombs.
