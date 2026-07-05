// Solvability harness: plays every level through the real engine with
// scripted vim keystrokes.
//
// Two kinds of assertions, per docs/level-audit.md:
//  - the level's authored `solution` (in src/levels.ts) is the SPEEDRUN and
//    par-proof: it must win with keys <= par. Par is achievable, by test.
//  - ROUTES below are alternate lines (safe / clever / greedy) proving the
//    level is solvable multiple distinct ways within the keystroke limit.
import { describe, it, expect, beforeAll } from 'vitest';
import * as game from '../src/engine/engine';
import { expand } from '../src/engine/script';
import { LEVELS } from '../src/levels';
import { ROUTES } from './level-routes';

function run(levelIdx: number, script: string) {
  const st = game.loadLevel(levelIdx);
  for (const k of expand(script)) {
    if (st.status === 'won' || st.status === 'fail') break;
    game.key(k);
  }
  return st;
}

beforeAll(() => {
  game.setLevels(LEVELS);
});

describe('every level: the authored speedrun wins at exact par', () => {
  for (let n = 1; n <= LEVELS.length; n++) {
    it(`L${String(n).padStart(2, '0')} ${LEVELS[n - 1].name}`, () => {
      const lv = LEVELS[n - 1];
      expect(lv.solution, 'level is missing its par-proof solution').toBeTruthy();
      const st = run(n - 1, lv.solution!);
      expect(st.status, st.deathMsg || st.echo).toBe('won');
      expect(st.keys, 'par must equal the measured authored speedrun length').toBe(st.par);
    });
  }
});

describe('multi-path: alternate routes win within the limit', () => {
  for (const [n, routes] of Object.entries(ROUTES)) {
    for (const [name, script] of Object.entries(routes)) {
      it(`L${String(n).padStart(2, '0')} ${LEVELS[+n - 1].name} — ${name}`, () => {
        const st = run(+n - 1, script);
        expect(st.status, st.deathMsg || st.echo).toBe('won');
        expect(st.keys).toBeLessThanOrEqual(st.limit);
      });
    }
  }
});
