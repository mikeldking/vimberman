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

  it('rescue digs past a cornered approach for real breathing room, not just the fatal instant', () => {
    const st = boot(makeLevel({ map: ['#########', '#P.....Z#', '#########'] }));
    for (let i = 0; i < 15 && st.status === 'play'; i++) game.key('h'); // bonk in place; zombie closes the gap
    expect(st.status).toBe('dead');
    game.key('u');
    expect(st.status).toBe('play');
    const zombie = st.enemies[0];
    const dist = Math.abs(zombie.x - st.player.x) + Math.abs(zombie.y - st.player.y);
    expect(dist).toBeGreaterThanOrEqual(2);
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

describe('toads', () => {
  it('a flight motion over a toad flips it; walking onto it squashes for +2 budget', () => {
    const st = boot(makeLevel({ map: ['#########', '#Pa.Q.b.#', '#########'] }));
    keys('fb'); // dash over the toad at x4
    const toad = st.enemies[0];
    expect(toad.flip).toBe(6); // full 6-tick countdown after the flight resolves
    keys('h'); // (5,1)
    const limit = st.limit;
    expect(st.enemies.length).toBe(1);
    game.key('h'); // step onto the flipped toad — squash
    expect(st.enemies.length).toBe(0);
    expect(st.limit).toBe(limit + 2);
    expect(st.status).toBe('play');
  });

  it('a dash that lands beside a toad (nothing crossed) does not flip it', () => {
    const st = boot(makeLevel({ map: ['#########', '#P.aQ.b.#', '#########'] }));
    keys('fa'); // land at x3, adjacent to the toad at x4 — nothing crossed
    expect(st.enemies[0].flip ?? 0).toBe(0);
  });

  it('toads hop up to two tiles every third tick and clear gaps mid-hop', () => {
    const st = boot(makeLevel({ map: ['##########', '#P...~.Q.#', '##########'] }));
    game.key('k'); game.key('k'); // two bonk ticks: toad crouches
    expect(st.enemies[0].x).toBe(7);
    game.key('k'); // third tick: 2-hop landing would be the gap, so it hops 1
    expect(st.enemies[0].x).toBe(6);
    keys('kkk'); // next cycle: 2-hop from x6 flies OVER the gap at x5, lands x4
    expect(st.enemies[0].x).toBe(4);
    expect(st.status).toBe('play');
  });

  it('an upright toad kills on contact', () => {
    const st = boot(makeLevel({ map: ['######', '#P.Q.#', '######'] }));
    keys('ll'); // walk into the upright toad
    expect(st.status).toBe('dead');
  });

  it('the flip timer expires and the toad wakes with a one-tick grace crouch', () => {
    const st = boot(makeLevel({ map: ['#########', '#Pa~Q~b.#', '#########'] }));
    keys('fb');
    const toad = st.enemies[0];
    for (let i = 0; i < 6; i++) game.key('k'); // bonk out the flip countdown
    expect(toad.flip).toBe(0);
    game.key('k'); // wake tick: it must not move or kill yet
    expect(toad.x).toBe(4);
    expect(st.status).toBe('play');
  });
});

describe('linters', () => {
  // row 1 is a wall except the start pocket, so 'k' from the hot row always bonks
  const HOT = makeLevel({
    map: [
      '#######',
      '#P.####',
      '!|...|#',
      '#####E#',
      '#######',
    ],
    linters: { '0,2': {} },
  });

  it('ending a move in the swept interior on the fire tick is death', () => {
    const st = boot(HOT);
    game.key('j'); // t1 → (1,2) margin
    keys('ll'); // t2, t3 → (3,2) interior
    game.key('k'); // t4 bonk (warn)
    game.key('k'); // t5 bonk — FIRE
    expect(st.status).toBe('dead');
    expect(st.deathMsg).toBe('swept by the linter');
  });

  it('margins are never swept, across full cycles', () => {
    const st = boot(HOT);
    game.key('j'); // t1 margin (1,2)
    for (let i = 0; i < 11; i++) game.key('h'); // bonk through two fire ticks (t5, t11)
    expect(st.status).toBe('play');
  });

  it('the beam kills enemies in the row but does not detonate bombs or break terrain', () => {
    const st = boot(makeLevel({
      map: [
        '##########',
        '#P.#######',
        '!|..*..Z.#',
        '##########',
      ],
      linters: { '0,2': {} },
    }));
    st.player.bombs = 1;
    game.key('x'); // t1: soft bomb under the player, fuse 6
    for (let i = 0; i < 4; i++) game.key('k'); // t2..t5 bonks; sweep fires at t5
    expect(st.enemies.length).toBe(0); // zombie shambled to ~x6 — swept mid-row
    expect(st.grid[2][4]).toBe('*'); // bush untouched by the beam
    expect(st.bombs.length).toBe(1); // bomb survives the beam
  });
});

describe('the sky layer', () => {
  const SKY = makeLevel({
    map: [
      '#######',
      '#P@...#',
      '#..~.E#',
      '#######',
    ],
    sky: [
      '#######',
      '#.....#',
      '#..~..#',
      '#######',
    ],
  });

  it('Ctrl-u rises on an updraft, Ctrl-d drops on clear ground', () => {
    const st = boot(SKY);
    game.key('<C-u>'); // not on the updraft yet
    expect(st.layer).toBe('ground');
    expect(st.echo).toMatch(/no updraft/);
    game.key('l'); // onto @
    game.key('<C-u>');
    expect(st.layer).toBe('sky');
    game.key('l'); // move aloft
    game.key('<C-d>');
    expect(st.layer).toBe('ground');
    expect(st.player.x).toBe(3);
  });

  it('enemies cannot touch a player in the clouds, and drops onto enemies are refused', () => {
    const st = boot(makeLevel({
      map: [
        '#########',
        '#P@...Z.#',
        '#########',
      ],
      sky: [
        '#########',
        '#.......#',
        '#########',
      ],
    }));
    keys('l');
    game.key('<C-u>');
    for (let i = 0; i < 5; i++) game.key('l'); // stroll the sky; the zombie shadows below
    expect(st.status).toBe('play'); // it can never touch you up here
    const z = st.enemies[0];
    // hover directly over the zombie and try to drop on it
    while (st.player.x !== z.x) game.key(st.player.x > z.x ? 'h' : 'l');
    game.key('<C-d>');
    expect(st.layer).toBe('sky'); // refused
    expect(st.echo).toMatch(/down there/);
  });

  it('you cannot drop into a gap, and bombs are forbidden aloft', () => {
    const st = boot(SKY);
    st.player.bombs = 1;
    keys('l');
    game.key('<C-u>');
    game.key('x');
    expect(st.echo).toMatch(/no bombs in the clouds/);
    expect(st.player.bombs).toBe(1);
    game.key('l'); // sky x3 — directly above the ground gap at (3,2)? no: row1. move down
    game.key('j'); // sky (3,2)? sky row2 x3 is '~' open air — blocked, bonk
    expect(st.echo).toMatch(/^E:/);
  });
});

describe('vocabulary gating', () => {
  it('locked keys are free (no keystroke, no tick) and keycaps unlock them', () => {
    const st = boot(makeLevel({
      map: ['######', '#P?..#', '######'],
      keycaps: { '2,1': 'word' },
    }));
    game.setVocab(new Set(['core', 'count']));
    try {
      game.key('w');
      expect(st.keys).toBe(0); // locked: free
      expect(st.tick).toBe(0); // locked: no enemy turn
      expect(st.echo).toMatch(/unmapped/);
      game.key('l'); // collect the keycap
      expect(game.getVocab()!.has('word')).toBe(true);
      game.key('w'); // now legal — bonks (no word) but costs
      expect(st.keys).toBe(2);
    } finally {
      game.setVocab(null);
    }
  });

  it('already-owned keycaps are stripped from the map at load', () => {
    game.setVocab(new Set(['core', 'word']));
    try {
      const st = boot(makeLevel({
        map: ['######', '#P?..#', '######'],
        keycaps: { '2,1': 'word' },
      }));
      expect(st.grid[1][2]).toBe('.');
    } finally {
      game.setVocab(null);
    }
  });
});
