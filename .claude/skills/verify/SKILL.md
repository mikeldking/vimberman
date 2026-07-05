---
name: verify
description: Drive Vimberman in a real headless browser to verify gameplay/UI changes end-to-end (dev server + playwright-core + cached Chromium).
---

# Verifying Vimberman changes at the surface

The surface is a browser: canvas board + DOM overlay (`#panel`, `#statusline`).
Solve tests prove engine routes; this recipe proves the UI actually plays them.

## Recipe that works

1. `npx vite --port 5199` (background). No build step needed.
2. No playwright in this repo — install `playwright-core` into the session
   scratchpad (`npm i --prefix <scratchpad> playwright-core`) and launch the
   cached browser at
   `~/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
   (note: `chrome-mac-arm64`, not `chrome-mac`; the binary is "Google Chrome
   for Testing", not "Chromium").
3. Seed progress BEFORE boot with `page.addInitScript` writing
   `localStorage['vimberman.save.v1']` — shape per `src/ui/save.ts` (v: 2,
   unlocked, keycaps[], levels{}, chapters[], settings). This controls
   CONTINUE, level select locks, and vocab gating.
4. Drive with `page.keyboard.press` (~80–120ms gaps). Menus are vim keys.
   A level's `solution` script from `src/levels.ts` can be replayed key by
   key (expand tokens: `<e>`→Escape, digits and letters are separate
   presses; `F` needs `Shift+F` via press).
5. Read outcomes from `#panel` (cards) and `#statusline` (echo/mode), and
   screenshot the canvas for board/HUD checks.

## Flows worth driving

- Level select (chapter headers, locks, stars) → intro card → play.
- A full authored speedrun: expect LEVEL CLEAR with `KEYS <= par`.
- Echo probes: locked keycap press (free refusal), bonk echoes, hints.

## Gotchas

- Sound: seed `settings.sound: false` — headless has no audio device drama,
  but it keeps logs clean.
- The title attract mode starts after ~8s idle; any keypress kills it, but
  don't sleep >8s on TITLE between presses or screenshots change.
- A stale agent worktree under `.claude/worktrees/` may double `vitest run`
  counts — scope with `npx vitest run --dir test`.
