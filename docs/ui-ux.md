# UI/UX

How the game presents itself: screen flow, HUD, audio, and the feedback
loops that make the turn-based engine feel responsive. All of this is
implemented in `src/ui`, `src/render`, and `index.html`; the engine (`src/engine/engine.ts`) has no
opinion about any of it beyond calling the `fx` hooks described in
`docs/architecture.md`.

## Screen state machine

`src/ui/screens.ts` keeps a single `screen` variable (in `src/ui/state.ts`) driving one big `switch` in the
global `keydown` handler. States:

```
TITLE → SELECT → INTRO → GAME → (CLEAR | DEAD | FAIL) → back to SELECT/INTRO
                          ↕
                        PAUSE
TITLE → DRILL → GAME → (CLEAR | DEAD | FAIL) → back to DRILL
TITLE → HELP / SETTINGS → back to TITLE
```

- **TITLE** — logo, PLAY / DRILL / HOW TO PLAY / SETTINGS menu.
- **SELECT** — level list with lock state, stars, best keystroke count,
  and par, navigated with `j`/`k`/`gg`/`G`/`Enter` — **the menus are vim
  too** (see below).
- **DRILL** — practice-arena picker (docs/TODO.md 6.4, premise.md
  audience #1). One static arena per vocabulary group (`src/ui/drills.ts`):
  no enemies, no linters, no keycaps, coin `K` tiles marking the reps, and
  **zero save impact** — `ui.drill` steers every end screen back here and
  `showClear` is guarded so nothing persists. A drill is listed once its
  group's keycap is owned; the arena rides at the end of the engine's
  level set only while the drill runs (`showDrill`/`startLevel` reset it).
  Arena solvability and par proofs live in `test/drill.test.ts`.
- **HELP** — a static reference card of every motion (`showHelp`),
  reachable from the title screen, not gatekept behind gameplay.
- **INTRO** — per-level card: level name, the one new technique
  (`NEW: ...`), the level's `intro` copy, and the budget/par, before
  committing to `Enter` ("jack in").
- **GAME** — the actual play screen; input routes through `gameKey`, which
  wraps `VB.key()` with UI-only side effects (coaching toasts, terminal
  box refresh, slide sound).
- **PAUSE** — reachable via bare `Escape` in normal mode with nothing
  pending (a *free* action — doesn't cost a keystroke, see
  `src/engine/engine.ts`'s `key()` early-return for `Escape` with empty `pending`).
- **DEAD / FAIL / CLEAR** — end-of-attempt cards, each offering the
  appropriate next action (`u` rescue, `r` retry, `Enter` continue, `Esc`
  back to select).

## The menus are vim too

This is a small detail worth calling out because it's a strong identity
signal: **every menu in the game — title, level select, settings, pause —
is navigated with `j`/`k` (and `gg`/`G` to jump to ends), not arrow keys or
a mouse** (`menuNav` in `src/ui/screens.ts`). The title screen's footer literally says
so: "j/k move · Enter select — yes, the menus are vim too." This isn't
just flavor — it means the player is drilling the core input language
from the very first screen they see, before gameplay even starts.

## Onboarding stance: no arrow keys, ever

Arrow keys and spacebar are explicitly intercepted and rejected across
every screen that matters (`window.addEventListener('keydown', ...)`):
`e.preventDefault()` fires, the input is dropped, and (in TITLE/SELECT/
GAME) a toast fires: "h j k l — arrows are for tourists," paired with an
error tone. This is a **firm, funny, non-negotiable stance**: the game
will not quietly accept a "normal" control scheme as a crutch. The
`ui-smoke.test.ts` test enforces this as a real contract (arrow key press
must be free — zero keystroke cost, zero movement), not just a joke —
see `docs/architecture.md` → Testing.

## HUD and statusline

Two feedback surfaces, both always visible during play:

- **HUD** (`#hud`, top) — current level name, `KEYS used/limit` (color
  escalates from default → `warn` amber at 50% remaining → `danger` red
  with a pulse animation at 20% remaining), and bombs/undo/radius on the
  right (`● ● ○` style pip display for held bombs).
- **Statusline** (`#statusline`, bottom) — deliberately styled to *look
  like an actual vim statusline*: a mode chip (`-- NORMAL --` / `--
  INSERT --` / `-- EDIT --` for terminal-normal-mode, color-coded), an
  echo area for error/info messages (`E: ...` styled distinctly, matching
  real vim's error highlighting convention), the last completed command
  (`sl-last`), pending count/operator (`sl-pend`), and cursor position
  (`sl-pos`).

The design intent: a vim user's eye already knows how to read this bar
from muscle memory built outside the game. It's not a game HUD wearing a
vim costume — it's positioned to be read exactly like the real thing,
which is also why terminal-mode shows as `EDIT`/`INSERT` using the same
mental model as vim's own mode indicator.

## Audio

All sound is synthesized on the fly via WebAudio (`tone()` for
oscillator blips, `noiseBoom()` for a filtered-noise explosion) — **no
audio assets are loaded**, which keeps the game a true zero-dependency,
offline-playable single page. Distinct short stingers exist for: move,
slide (word/find/line motions), bomb-drop, explosion, error, item pickup,
terminal-solve (two-note rising chime), level-clear (four-note arpeggio),
star award, death, rescue, and mage teleport. Sound is a global on/off
toggle in Settings, persisted to save data.

## Juice and feedback

- **Screen shake** on explosions (`shake`, decaying each frame, applied as
  a random translate in `draw()`).
- **Red damage flash** (`flashRed`) on death.
- **Explosion particles**: each hit tile gets a short-lived glyph
  animation (`✳`/`✺` cycling colors white → amber → red over 350ms).
- **Mage telegraph**: a blinking `◌` rune appears on the tile the mage is
  about to teleport to, one tick before it happens — this is the primary
  fairness mechanism for a ranged enemy (see `docs/bestiary.md`).
- **Bomb fuse readout**: each live bomb draws its remaining fuse count
  next to it, pulsing faster and switching to red once `fuse <= 2` —
  giving the player the same "pendingBlast" information the imp AI itself
  uses to flee.
- **Coaching toast**: if the player presses the same directional key 4
  times in a row without a count prefix, a toast suggests `4l` instead of
  `llll` (`gameKey`'s repeat-tracking) — a rare case of the game directly
  interrupting to teach efficient play, rate-limited via `toastCount` so
  it doesn't nag repeatedly.
- **Interpolated movement** (`lerpPos`): entities visually glide between
  tiles each frame even though the simulation moves them in discrete
  jumps — see `docs/architecture.md` → Rendering for why this is safe to
  do without touching turn logic.

## Design guidance for future UI work

- Keep new feedback **diegetic to the vim conceit** where possible — the
  statusline, the mode indicator, and the "arrows are for tourists" stance
  are all reinforcing the same idea. A new HUD element should ask "would
  a vim user recognize this metaphor?"
- Any new toast/coaching message should be rate-limited like the existing
  ones (`toastCount`) — this game already teaches by letting the *level
  design* be the lesson (see `docs/level-design.md`); toasts should stay
  reserved for meta-technique nudges, not moment-to-moment hints.
- If you add a new enemy or hazard, it should get a *telegraph* if it's
  not immediately obvious how to avoid it, following the mage's precedent
  — silent, unfair threats break the "the game always warns you" contract
  established in `docs/bestiary.md`.
