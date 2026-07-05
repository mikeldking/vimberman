# Terminal Prompt Audit

This is the authoring ledger for every `T` code-tile in `src/levels.ts`.
`test/level-design.test.ts` mirrors this table with executable terminal
proofs, so prompt drift fails in CI.

| Level | Coord | Kind | Prompt | Target / Goal | Intended solve |
|---|---:|---|---|---|---|
| 4 BUGFIX BOMBS | `3,3` | fix | `bpmb` | `bomb` | `l ro` |
| 4 BUGFIX BOMBS | `8,7` | fix | `boamb` | `bomb` | `2l x` |
| 6 THE LONG WAY | `5,5` | fix | `bo0mb` | `bomb` | `2l x` |
| 6 THE LONG WAY | `7,5` | clean | `bomb(##);` | purge `#`, grants `grep` | `f# x x` |
| 8 REWRITE THE RULES | `2,3` | fix | `dud` | `bomb` | `cw bomb Esc` |
| 8 REWRITE THE RULES | `7,3` | fix | `fizz` | `sed` | `cw sed Esc` |
| 8 REWRITE THE RULES | `1,5` | coins | `.o..o..o` | collect all `o` before 6 ticks | `l 3l 3l` |
| 9 AGAINST THE CURRENT | `9,9` | fix | `dirt` | `bomb` | `cw bomb Esc` |
| 11 WARPED WORDS | `6,3` | fix | `BOMB` | `bomb` | `~ ~ ~ ~` |
| 11 WARPED WORDS | `5,7` | fix | `zzzz` | `bomb` | `ciw bomb Esc` |
| 11 WARPED WORDS | `12,9` | golf | `Bomb` | `bomb` in 1 stroke | `~` |
| 15 BALANCED BRACKETS | `4,3` | fix | `b(mb` | `bomb` | `l ro` |
| 17 DON'T REPEAT YOURSELF | `5,1` | fix | `zzzz` | `bomb` | `cw bomb Esc` |
| 17 DON'T REPEAT YOURSELF | `11,1` | fix | `pppp` | repeat previous `bomb` edit | `.` |
| 17 DON'T REPEAT YOURSELF | `14,1` | golf | `qqqq` | repeat previous `bomb` edit in 2 strokes | `.` |
| 18 CHOOSE YOUR WORDS | `2,1` | fix | `sad` | `sed` | `l re` |
| 18 CHOOSE YOUR WORDS | `7,1` | fix | `grip` | `grep` | `ll re` |
| 18 CHOOSE YOUR WORDS | `12,1` | fix | `b0mb` | `bomb` | `l ro` |
| 19 THE FINAL REFACTOR | `12,1` | fix | `b0mB` | `bomb` | `l ro 2l ~` |
| 19 THE FINAL REFACTOR | `5,9` | fix | `rusty` | `bomb` | `ciw bomb Esc` |
| 19 THE FINAL REFACTOR | `5,7` | spark | `o......o` | collect both `o` before scan/deadline | `h $` |

## Current Read

- The prompt curve is coherent: one-character repairs in L4-L6, whole-word
  replacement in L8-L9, precision/case in L11, repetition pressure in L17,
  route-defining arsenal words in L18, and synthesis in L19.
- The two dot prompts in L17 intentionally depend on the previous edit. The
  automated proof primes `lastEdit` to make that dependency explicit.
- The spark prompt is currently finale-only. It is proven in isolation and
  in the L19 speedrun, but it has no earlier low-pressure campaign practice.
