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
import { LEVELS } from '../src/levels';

// tokens separated by spaces; each token is a sequence of single-char keys,
// except <e> = Escape, <C-u>/<C-d> = control chords. Example: "10l fa <C-u>"
export function expand(s: string): string[] {
  const out: string[] = [];
  for (const tok of s.trim().split(/\s+/)) {
    if (tok === '<e>') out.push('Escape');
    else if (tok === '<C-u>' || tok === '<C-d>') out.push(tok);
    else out.push(...tok.split(''));
  }
  return out;
}

function run(levelIdx: number, script: string) {
  const st = game.loadLevel(levelIdx);
  for (const k of expand(script)) {
    if (st.status === 'won' || st.status === 'fail') break;
    game.key(k);
  }
  return st;
}

// Alternate verified routes: level number -> route name -> script.
const ROUTES: Record<number, Record<string, string>> = {
  2: {
    // the loot lane: both bushes via the right rail, exits past the zombie
    safe: 'l 9l jj 5h 5l jj 5h 5l jj h',
  },
  5: {
    // down the left rail, flying clean over the caged imp
    clever: 'j 5j 2w lll',
    // through the word chamber, zero enemy contact
    safe: 'll jj jj 8l jj l',
  },
  7: {
    // left rail loot, flip the bottom toad in passing
    clever: '6j l 2w 3l',
    // the word chamber lane, flipping its toad
    safe: 'll jj 2w ll jj jj l',
  },
  8: {
    // the mid-drop: fall off the bridge, edit T2 inside the zombie's lane
    clever: '3l l j j l h l h l h l l i cw bomb <e> ll 2j x 3k h l h l 3j ll jj ll',
  },
  10: {
    // right-side descent, $-anchor personality
    greedy: 'jj 2l 4l jj 4l jj 0 jj',
  },
  12: {
    // drop west of the welcoming committee instead of beside it
    safe: 'l 3l <C-u> 6j 3h <C-d> h',
  },
  13: {
    // south arena: skip T1, G down the rail, ciw beside the mage
    safe: 'w w 3l j j h 2b 3h G ll ll i ciw bomb <e> ll x 4h h l h l l 7l k k',
    // hybrid: T1's two bombs, then the south wing skipping T2
    clever: 'w w ll i l ro 2l ~ l j j h 2b 3h G 6l x 4h h l h l l 7l k k',
  },
};

beforeAll(() => {
  game.setLevels(LEVELS);
});

describe('every level: the authored speedrun wins at or under par', () => {
  for (let n = 1; n <= LEVELS.length; n++) {
    it(`L${String(n).padStart(2, '0')} ${LEVELS[n - 1].name}`, () => {
      const lv = LEVELS[n - 1];
      expect(lv.solution, 'level is missing its par-proof solution').toBeTruthy();
      const st = run(n - 1, lv.solution!);
      expect(st.status, st.deathMsg || st.echo).toBe('won');
      expect(st.keys, 'speedrun must prove par is achievable').toBeLessThanOrEqual(st.par);
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
