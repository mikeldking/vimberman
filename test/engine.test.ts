// Targeted unit tests for engine rules that the solvability harness only
// exercises implicitly.
import { describe, it, expect } from 'vitest';
import * as game from '../src/engine/engine';
import type { LevelDef } from '../src/engine/types';

function makeLevel(overrides: Partial<LevelDef> & { map: string[] }): LevelDef {
  return {
    name: 'TEST', teaches: 'test', intro: [],
    terminals: {}, par: 10, limit: 100,
    ...overrides,
  };
}

function boot(lv: LevelDef) {
  game.setLevels([lv]);
  return game.loadLevel(0);
}

const keys = (s: string) => { for (const k of s) game.key(k); };

describe('motions', () => {
  it('a bonk (invalid move) costs a keystroke and advances the world tick', () => {
    const st = boot(makeLevel({ map: ['#####', '#P..#', '#####'] }));
    game.key('k'); // wall above
    expect(st.keys).toBe(1);
    expect(st.tick).toBe(1);
    expect(st.echo).toMatch(/^E:/);
  });

  it('counts slide up to N and stop at walls', () => {
    const st = boot(makeLevel({ map: ['#######', '#P....#', '#######'] }));
    keys('9l');
    expect(st.player.x).toBe(5); // stopped at the wall, not bonked
    expect(st.keys).toBe(2);
    expect(st.tick).toBe(1); // one world tick for the whole motion
  });

  it('f dashes to a letter and flies over gaps; ; repeats', () => {
    const st = boot(makeLevel({ map: ['#########', '#P~~a~~a#', '#########'] }));
    keys('fa');
    expect(st.player.x).toBe(4);
    game.key(';');
    expect(st.player.x).toBe(7);
  });

  it('w hops between words but bonks with no word ahead', () => {
    const st = boot(makeLevel({ map: ['########', '#Pab~cd#', '########'] }));
    keys('ww');
    expect(st.player.x).toBe(5);
    game.key('w');
    expect(st.echo).toMatch(/no word/);
  });

  it('one-way tiles only admit travel in their direction', () => {
    const st = boot(makeLevel({ map: ['#####', '#P<.#', '#####'] }));
    game.key('l'); // entering '<' moving right is blocked
    expect(st.player.x).toBe(1);
    expect(st.echo).toMatch(/^E:/);
  });
});

describe('bombs', () => {
  it('bombs detonate after 6 ticks in a plus shape, crumbling rocks', () => {
    const st = boot(makeLevel({ map: ['######', '#P.%.#', '#..###', '######'] }));
    st.player.bombs = 1;
    game.key('x'); // drop; fuse ticks down from 6
    keys('jl'); // duck to the diagonal, outside the plus
    keys('jjj'); // bonk the wall until the fuse expires
    expect(st.grid[1][3]).toBe('.'); // rock at radius 2 destroyed
    expect(st.status).toBe('play'); // diagonal tile is outside the blast
  });

  it('the blast kills the player standing in it', () => {
    const st = boot(makeLevel({ map: ['#####', '#P..#', '#####'] }));
    st.player.bombs = 1;
    game.key('x');
    keys('lhlhl'); // shuffle in the blast row until it blows
    expect(st.status).toBe('dead');
    expect(st.deathMsg).toBe('caught in the blast');
  });

  it('hard rock survives radius-2 blasts and falls to radius-3', () => {
    const lv = makeLevel({ map: ['#########', '#P.&....#', '#.......#', '#########'] });
    let st = boot(lv);
    st.player.bombs = 1;
    game.key('x');
    keys('jlllll');
    expect(st.grid[1][3]).toBe('&'); // radius 2: survives

    st = boot(lv);
    st.player.bombs = 1;
    st.player.radius = 3;
    game.key('x');
    keys('jlllll');
    expect(st.grid[1][3]).toBe('.'); // radius 3: crumbles
  });

  it('explosions clear undo history — no rewinding a detonation', () => {
    const st = boot(makeLevel({ map: ['######', '#P...#', '#....#', '######'] }));
    st.player.bombs = 1;
    game.key('x');
    keys('jllll');
    expect(st.status).toBe('play');
    const undosBefore = st.player.undo;
    game.key('u');
    // history was wiped by the blast, so undo refuses (history too short)
    expect(st.echo).toMatch(/nothing to undo/);
    expect(st.player.undo).toBe(undosBefore);
  });
});

describe('terminals', () => {
  it('i opens, edits fix the word, solving grants bombs', () => {
    const st = boot(makeLevel({
      map: ['#####', '#PT.#', '#####'],
      terminals: { '2,1': { broken: 'bpmb', target: 'bomb', grants: 2 } },
    }));
    keys('li'); // step on T, open
    expect(st.mode).toBe('terminal');
    keys('lro'); // cursor to the p, replace with o
    expect(st.mode).toBe('normal'); // auto-closes on solve
    expect(st.player.bombs).toBe(2);
    expect(st.terminals['2,1'].solved).toBe(true);
  });

  it('cw wipes to word end and insert-typing commits on Escape', () => {
    const st = boot(makeLevel({
      map: ['#####', '#PT.#', '#####'],
      terminals: { '2,1': { broken: 'dud', target: 'bomb', grants: 1 } },
    }));
    keys('licw');
    keys('bomb');
    game.key('Escape');
    expect(st.player.bombs).toBe(1);
  });
});

describe('death and rescue', () => {
  it('walking into a zombie kills; u rewinds with an iframe grace', () => {
    const st = boot(makeLevel({ map: ['#####', '#PZ.#', '#####'] }));
    game.key('l');
    expect(st.status).toBe('dead');
    expect(game.canRescue()).toBe(true);
    game.key('u');
    expect(st.status).toBe('play');
    expect(st.player.iframes).toBeGreaterThan(0);
    expect(st.player.undo).toBe(2);
  });

  it('running out of keystrokes fails the level', () => {
    const st = boot(makeLevel({ map: ['#####', '#P..#', '#####'], limit: 2 }));
    keys('ll');
    expect(st.status).toBe('fail');
  });
});

describe('items', () => {
  it('bushes yield their configured drop when walked over', () => {
    const st = boot(makeLevel({
      map: ['#####', '#P*.#', '#####'],
      bushes: { '2,1': { type: 'K', amt: 7 } },
    }));
    const limit = st.limit;
    game.key('l');
    expect(st.limit).toBe(limit + 7);
    expect(st.grid[1][2]).toBe('.');
  });
});
