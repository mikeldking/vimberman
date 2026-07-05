# Campaign Playthrough Audit

Current verification source:

- `test/solve.test.ts` plays every authored `solution` through the real engine.
- The authored speedrun must win and `keys === par`; par is now an exact
  measured score, not a loose ceiling.
- Alternate named routes live in `test/level-routes.ts` and must win within
  `limit`.
- `test/level-design.test.ts` keeps this campaign metadata, the curriculum
  table, coordinate data, item rules, and terminal prompts from drifting.

| # | Level | Speedrun / Par | Limit | Routes Proven | Audit Read |
|---:|---|---:|---:|---:|---|
| 1 | BABY STEPS | 36 / 36 | 110 | 1 | Set-piece core movement tutorial; intentionally linear. |
| 2 | COUNT THE CORRIDORS | 6 / 6 | 26 | 2 | Counted speedrun plus loot lane; strong early choice density. |
| 3 | LEAP OF FAITH | 21 / 21 | 52 | 1 | Find/stop-short teaching corridor; acceptable early set-piece. |
| 4 | BUGFIX BOMBS | 55 / 55 | 135 | 1 | Bomb-edit onboarding; forced chain is justified by first terminal lesson. |
| 5 | WORD BRIDGES | 8 / 8 | 18 | 3 | Breather with multiple word-flight personalities. |
| 6 | THE LONG WAY | 60 / 60 | 118 | 2 | Slide comb plus lint route; no longer documented as single-route. |
| 7 | FLIP THE SCRIPT | 9 / 9 | 22 | 3 | Short toad lesson with fast/safe route variety. |
| 8 | REWRITE THE RULES | 31 / 31 | 65 | 3 | `cw`, sed, and coin-cache routes are all proven. |
| 9 | AGAINST THE CURRENT | 72 / 72 | 130 | 1 | One-way commitment set-piece; keep under watch for route variety. |
| 10 | MIND THE MARGINS | 15 / 15 | 34 | 2 | Linter anchor lesson with a second descent personality. |
| 11 | WARPED WORDS | 108 / 108 | 165 | 1 | Mage/case/hard-rock skill check; long and single-route by current proof. |
| 12 | HEAD IN THE CLOUDS | 9 / 9 | 26 | 2 | Sky route and flytrap route both proven. |
| 13 | CUMULUS GOLF | 10 / 10 | 30 | 2 | Kite cut and timed under-pass both proven. |
| 14 | BOOKMARKED | 22 / 22 | 52 | 2 | Mark placement creates distinct route identity. |
| 15 | BALANCED BRACKETS | 27 / 27 | 62 | 2 | Bracket closet and loot line both proven. |
| 16 | GREP | 8 / 8 | 20 | 2 | Search-as-transit breather; compact and readable. |
| 17 | DON'T REPEAT YOURSELF | 43 / 43 | 76 | 3 | Dot lesson has honest/vault variants plus speedrun. |
| 18 | CHOOSE YOUR WORDS | 14 / 14 | 34 | 3 | Arsenal showcase: sed, grep, and bomb identities are all proven. |
| 19 | THE FINAL REFACTOR | 34 / 34 | 60 | 3 | Finale has north/south/hybrid proofs; spark remains finale-only. |
| 20 | BABY STEPS, PROMOTED | 24 / 24 | 28 | 2 | Tight worn-key remix; strict by design. |
| 21 | AUTOMATE YOURSELF | 14 / 14 | 26 | 2 | Macro epilogue plus mixed manual/automation proof. |

## Strategic Follow-Up

- Keep L1, L3, and L4 single-route unless the tutorial pacing starts feeling
  brittle in playtests; their linearity supports first-contact teaching.
- Revisit L9 and L11 first if the campaign needs more route variety. They are
  later, longer, and currently have only the speedrun proof.
- Consider a low-pressure `spark` tile before L19 if finale playtests show the
  scan-head prompt reads as surprise rather than synthesis.
