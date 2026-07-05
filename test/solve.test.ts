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
  6: {
    // the lint route: both tiles (fix + clean), then pin the zombie behind a
    // bomb at the trio-3 choke and take column 11 while it's ash
    lint: 'j G ll gg ll 4j i 2l x G ll 4k i f# x x gg ll G x gg h h l l G'
      + ' k k j k j k j k j k j j l x h k j k k G ll gg ll G',
  },
  7: {
    // left rail loot, flip the bottom toad in passing
    clever: '6j l 2w 3l',
    // the word chamber lane, flipping its toad
    safe: 'll jj 2w ll jj jj l',
  },
  8: {
    // the mid-drop: fall off the bridge, edit T2 inside the zombie's lane
    clever: '3l l j j l h l h l h l l i cw sed <e> ll 2j x 3k h l h l 3j ll jj ll',
    // the coin cache: counted hops beat the 6-tick clock, bomb the east gate
    coins: '4j i l 3l 3l gg l l l w l l j x k h h h h l l j j j j j j l',
  },
  10: {
    // right-side descent, $-anchor personality
    greedy: 'jj 2l 4l jj 4l jj 0 jj',
  },
  12: {
    // the flytrap: leave a bomb by the updraft, hover while the shadow
    // gathers a zombie onto it, then sweep the cleared top shelf for loot
    flytrap: 'l l 2l x <C-u> j k j k <C-d> 8l 8h <C-u> 6j 3h <C-d>',
  },
  13: {
    // the under-pass: skip the cut entirely — ground loot, then thread the
    // kite's col-patrol on the tick it bobs out of the lane
    loot: '3l <C-u> j fc l k l <C-d> j l h h 2h k 3l <C-u> j ft k l',
  },
  14: {
    // the loot line: left-pocket undo, mark at the chute instead of the gate,
    // sweep the vault cache too, then walk the bomb east and wait out the
    // fuse west of the blast — a different mark placement IS the personality
    safe: 'l l j j h h k k l 3l ma 2j 2l `a 8l x 4h h l h l 4l 2j',
  },
  15: {
    // the unhurried line: nook loot first (no fuse pressure), then the
    // closet, trapdoor out, and shuffling out the fuse in the top corridor
    safe: 'l l % j k % 2h 2j l 2l i l ro l x % h l h l h 7h 2j l 8l fE',
  },
  16: {
    // the loot lane: sweep all three bushes along the same /bug chain
    greedy: 'l /bug<cr> 7l n n 5l n 3h fE',
  },
  17: {
    // south arena: skip T1, G down the rail, ciw beside the mage
    safe: 'w w 3l j j h 2b 3h G ll ll i ciw bomb <e> ll x 4h h l h l l 7l k k',
    // hybrid: T1's two bombs, then the south wing skipping T2
    clever: 'w w ll i l ro 2l ~ l j j h 2b 3h G 6l x 4h h l h l l 7l k k',
  },
  18: {
    // belt-and-suspenders: automate wing 2, hand-fly wing 3 (the linter
    // phases are tuned so THIS cadence threads them; full-manual dies)
    mixed: 'l qa l 2j 2l 2k 3l q @a l 2j 2l 2k 3l',
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
