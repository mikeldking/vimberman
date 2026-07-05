# Contributing to Vimberman

First: thank you. Vimberman gets better the way any codebase gets better —
one well-aimed edit at a time.

The bar for a PR is simple: **does it make the game more fun, and does CI
still prove every level is winnable?** New levels, absurd enemies, sharper
tutorials, better juice, tastier sound, funnier terminal copy, smarter tests,
and wild-but-on-premise ideas are all extremely welcome.

## Quickstart

```sh
git clone https://github.com/mikeldking/vimberman.git
cd vimberman
npm install
npm run dev     # play your changes at the printed URL
npm test        # the whole suite — solvability, engine, UI smoke, sprites
npm run build   # strict typecheck + production build (CI runs this too)
```

Node.js 22+ is what CI uses.

## The five pillars

Every addition should preserve the core contract. If your idea fights one of
these, redesign the idea, not the pillar:

1. **Every keystroke is a decision.** No filler input. If a section is solved
   by mashing `l`, it's not done.
2. **Teach by doing.** One new trick should become load-bearing in the level
   that introduces it. If the player can clear the level without the new
   motion, the level hasn't taught it.
3. **Efficiency is the score.** Budgets and pars reward Vim fluency, not
   real-time reflexes. There are no timers, only turns.
4. **Determinism makes it a puzzle.** Every retry must play out identically.
   If you add randomness, seed it and test it.
5. **Fiction and mechanic are the same object.** If a feature needs a
   paragraph of lore to justify it, simplify the feature.

## Adding a level

Levels live in [`src/levels.ts`](src/levels.ts) as ASCII maps plus metadata
(terminals, bushes, keycaps, linters, sky layers, budgets, pars). The legend
is at the top of the file.

The one hard rule: **add a solver route.**
[`test/solve.test.ts`](test/solve.test.ts) replays your `solution` string
through the real engine, so CI proves the level can be won and par is
achievable. A level without a passing solution script doesn't merge. Alternate
routes that also fit the budget make the test even stronger.

Tuning intent, curriculum order, and how pars are chosen are documented in
[`docs/level-design.md`](docs/level-design.md).

## Adding mechanics or enemies

Read [`docs/mechanics.md`](docs/mechanics.md) and
[`docs/bestiary.md`](docs/bestiary.md) first — every existing system is
documented, including *why* it exists. The engine
([`src/engine/`](src/engine/)) is pure TypeScript with no DOM: new rules go
there, with tests in `test/engine.test.ts`, and the UI hears about effects
through `fx` hooks only.

Sprites are procedural character grids in
[`src/render/sprites.ts`](src/render/sprites.ts), validated by
`test/sprites.test.ts` — no image files, ever.

## Docs are load-bearing

If a doc and the code disagree, the code wins — update the doc in the same
PR. The design bible lives in [`docs/`](docs/), and it exists so a future
contributor (human or agent) never has to reverse-engineer intent from the
engine.

## Checklist before you open the PR

- [ ] `npm test` passes (including your new solver route, if you added a level)
- [ ] `npm run build` passes (strict typecheck)
- [ ] Docs updated if behavior changed
- [ ] It's more fun than it was before

That's it. Bring chaos, keep it deterministic.
