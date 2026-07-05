// Title-screen attract mode: after a stretch of idle time on TITLE, the game
// ghost-plays a short authored solution behind the menu overlay, looping,
// until any keypress. It drives the REAL engine, so three guards keep it
// side-effect free: all fx hooks are muted (no sounds, and crucially no
// fx.win -> showClear -> save write), vocabulary is un-gated for the demo and
// restored after, and the loop only ever starts while the TITLE screen is up.
import * as game from '../engine/engine';
import { expand } from '../engine/script';
import { resetEffects, sizeCanvas } from '../render/renderer';
import type { FxHooks, VocabGroup } from '../engine/types';
import { save } from './save';
import { ui } from './state';

const DEMO_LEVEL = 1; // level 2 (0-based): four commands of pure count flexing
const IDLE_MS = 8000;
const STEP_MS = 340; // one keypress per step — an unhurried typist
const HOLD_STEPS = 4; // linger on the won board before looping

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let stepTimer: ReturnType<typeof setInterval> | null = null;
let fxBackup: FxHooks | null = null;
let keys: string[] = [];
let ki = 0;
let hold = 0;

export function attractActive(): boolean {
  return stepTimer !== null;
}

function muteFx(): void {
  fxBackup = { ...game.fx };
  const hooks = game.fx as unknown as Record<string, () => void>;
  for (const k of Object.keys(hooks)) hooks[k] = () => {};
}
function restoreFx(): void {
  if (fxBackup) Object.assign(game.fx, fxBackup);
  fxBackup = null;
}

function startRun(): void {
  game.loadLevel(DEMO_LEVEL);
  sizeCanvas();
  resetEffects();
  keys = expand(game.getLevels()[DEMO_LEVEL].solution!);
  ki = 0;
  hold = HOLD_STEPS;
}

function step(): void {
  if (ki >= keys.length || game.state().status !== 'play') {
    if (--hold <= 0) startRun();
    return;
  }
  game.key(keys[ki++]);
}

function startAttract(): void {
  if (attractActive() || ui.screen !== 'TITLE') return;
  muteFx();
  game.setVocab(null); // the demo owns the whole keyboard
  startRun();
  stepTimer = setInterval(step, STEP_MS);
}

/** kill the demo and the idle timer; safe to call when neither is running */
export function stopAttract(): void {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (!attractActive()) return;
  clearInterval(stepTimer!);
  stepTimer = null;
  restoreFx();
  game.setVocab(new Set<VocabGroup>(save.keycaps));
  // the demo board stays on screen behind the menu; entering a real level
  // goes through startLevel -> loadLevel, which resets everything anyway
}

/** (re)start the idle countdown — call when TITLE renders or gets a key */
export function armIdle(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(startAttract, IDLE_MS);
}
