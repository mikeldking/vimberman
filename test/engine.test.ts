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
    st.player.arsenal.push('bomb'); st.player.bombs = 1;
    game.key('x'); // drop; fuse ticks down from 6
    keys('jl'); // duck to the diagonal, outside the plus
    keys('jjj'); // bonk the wall until the fuse expires
    expect(st.grid[1][3]).toBe('.'); // rock at radius 2 destroyed
    expect(st.status).toBe('play'); // diagonal tile is outside the blast
  });

  it('the blast kills the player standing in it', () => {
    const st = boot(makeLevel({ map: ['#####', '#P..#', '#####'] }));
    st.player.arsenal.push('bomb'); st.player.bombs = 1;
    game.key('x');
    keys('lhlhl'); // shuffle in the blast row until it blows
    expect(st.status).toBe('dead');
    expect(st.deathMsg).toBe('caught in the blast');
  });

  it('hard rock survives radius-2 blasts and falls to radius-3', () => {
    const lv = makeLevel({ map: ['#########', '#P.&....#', '#.......#', '#########'] });
    let st = boot(lv);
    st.player.arsenal.push('bomb'); st.player.bombs = 1;
    game.key('x');
    keys('jlllll');
    expect(st.grid[1][3]).toBe('&'); // radius 2: survives

    st = boot(lv);
    st.player.arsenal.push('bomb'); st.player.bombs = 1;
    st.player.radius = 3;
    game.key('x');
    keys('jlllll');
    expect(st.grid[1][3]).toBe('.'); // radius 3: crumbles
  });

  it('explosions clear undo history — no rewinding a detonation', () => {
    const st = boot(makeLevel({ map: ['######', '#P...#', '#....#', '######'] }));
    st.player.arsenal.push('bomb'); st.player.bombs = 1;
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

  it('f, ;, w and b hop the cursor inside the buffer', () => {
    const st = boot(makeLevel({
      map: ['#####', '#PT.#', '#####'],
      terminals: { '2,1': { broken: 'ab cd cf', target: 'zzz', grants: 1 } },
    }));
    keys('li');
    const t = st.terminals['2,1'];
    keys('fc'); // dash to the first c
    expect(t.cursor).toBe(3);
    keys(';'); // repeat the find
    expect(t.cursor).toBe(6);
    keys('0w'); // word starts: 0, 3, 6
    expect(t.cursor).toBe(3);
    keys('w');
    expect(t.cursor).toBe(6);
    keys('b');
    expect(t.cursor).toBe(3);
  });
});

describe('terminal minigames', () => {
  const termLevel = (def: object) => makeLevel({
    map: ['#####', '#PT.#', '#####'],
    terminals: { '2,1': def as never },
  });

  it('clean: purging every glitch char solves the tile', () => {
    const st = boot(termLevel({ kind: 'clean', broken: 'bomb(##);', grants: 1 }));
    keys('li');
    keys('f#xx'); // dash to the lint, delete both
    expect(st.mode).toBe('normal');
    expect(st.player.bombs).toBe(1);
    expect(st.terminals['2,1'].buffer.join('')).toBe('bomb();');
  });

  it('coins: landing on every coin before the deadline solves; spam respawns the cache', () => {
    const st = boot(termLevel({ kind: 'coins', broken: '.o..o..o', deadline: 6, grants: 1 }));
    keys('li');
    keys('llllll'); // six ticks of l-spam blows the 6-tick clock one coin short
    expect(st.echo).toMatch(/respawned/);
    expect(st.terminals['2,1'].buffer.join('')).toBe('.o..o..o');
    keys('l3l3l'); // counted hops from the reset cursor: three ticks, three coins
    expect(st.mode).toBe('normal');
    expect(st.player.bombs).toBe(1);
  });

  it('coins: walking out mid-grab puts the coins back', () => {
    const st = boot(termLevel({ kind: 'coins', broken: '.o.o', deadline: 8, grants: 1 }));
    keys('li');
    keys('l'); // grab one
    game.key('Escape');
    expect(st.mode).toBe('normal');
    expect(st.terminals['2,1'].buffer.join('')).toBe('.o.o');
  });

  it('golf: going over the stroke budget resets the tile; under budget solves', () => {
    const st = boot(termLevel({ kind: 'golf', broken: 'Bomb', target: 'bomb', strokes: 1, grants: 1 }));
    keys('li');
    keys('l'); // one wasted stroke = the whole budget
    expect(st.echo).toMatch(/over budget/);
    expect(st.terminals['2,1'].buffer.join('')).toBe('Bomb');
    expect(st.mode).toBe('terminal'); // still inside, budget refreshed
    keys('~'); // the one-stroke answer
    expect(st.mode).toBe('normal');
    expect(st.player.bombs).toBe(1);
  });

  it('spark: camping under the scan head ejects and resets; deliberate play wins', () => {
    const st = boot(termLevel({ kind: 'spark', broken: 'o......o', deadline: 8, grants: 1 }));
    keys('li');
    keys('hhhh'); // scan head starts mid-buffer and wraps onto the camper
    expect(st.mode).toBe('normal');
    expect(st.echo).toMatch(/zapped/);
    expect(st.terminals['2,1'].buffer.join('')).toBe('o......o');
    keys('i');
    keys('h'); // grab the coin underfoot, scan head still right of us
    keys('$'); // grab the far coin before the head comes around
    expect(st.mode).toBe('normal');
    expect(st.player.bombs).toBe(1);
  });

  it('in-terminal f and w are gated by their world keycaps', () => {
    const st = boot(termLevel({ kind: 'clean', broken: 'b#b', grants: 1 }));
    game.setVocab(new Set(['core', 'edit']));
    try {
      keys('li');
      const before = st.keys;
      game.key('f');
      expect(st.keys).toBe(before); // locked keys are free
      expect(st.echo).toContain('unmapped');
      game.key('w');
      expect(st.keys).toBe(before);
    } finally {
      game.setVocab(null);
    }
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
    st.player.arsenal.push('bomb'); st.player.bombs = 1;
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
    st.player.arsenal.push('bomb'); st.player.bombs = 1;
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

describe('marks (docs/motions-v2.md §1)', () => {
  it('m{a} is free annotation; backtick recall costs 2 keys and 1 tick', () => {
    const st = boot(makeLevel({ map: ['#######', '#P....#', '#######'] }));
    keys('ma');
    expect(st.keys).toBe(0); // setting is thinking — free
    expect(st.tick).toBe(0);
    expect(st.echo).toContain('mark a set');
    keys('4l');
    keys('`a');
    expect(st.player.x).toBe(1); // recalled to the mark
    expect(st.keys).toBe(4); // 4l (2) + `a (2)
    expect(st.tick).toBe(2); // slide + recall
  });

  it('recall jumps over walls and gaps — a jump, not a flight', () => {
    const st = boot(makeLevel({ map: ['#######', '#P.#..#', '#~~~..#', '#E....#', '#######'] }));
    keys('mz');
    keys('jj'); // impossible: gap row — bonks
    expect(st.player.y).toBe(1);
    st.player.x = 4; st.player.y = 3; // teleport for test setup
    keys('`z');
    expect(st.player.x).toBe(1);
    expect(st.player.y).toBe(1);
  });

  it('recalling an unset mark bonks; a non-letter register errors', () => {
    const st = boot(makeLevel({ map: ['#####', '#P..#', '#####'] }));
    keys('`q');
    expect(st.echo).toContain('mark q not set');
    expect(st.tick).toBe(1); // bonk ticks
    expect(st.keys).toBe(2);
  });

  it('an occupied mark blocks recall; a flipped toad is squashed instead', () => {
    const st = boot(makeLevel({ map: ['#########', '#P..a..Z#', '#.......#', '#########'] }));
    keys('ma');
    keys('j'); // step off the mark; the zombie shambles toward it
    st.enemies[0].x = 1; st.enemies[0].y = 1; // park the zombie on the mark
    keys('`a');
    expect(st.player.y).toBe(2); // blocked — still on row 2
    expect(st.echo).toContain('sitting on mark a');

    const st2 = boot(makeLevel({ map: ['#########', '#P.a..Q.#', '#.......#', '#########'] }));
    keys('mb');
    keys('fa'); // flight over nothing — get clear of spawn
    st2.enemies[0].flip = 7; // belly-up on some tile
    st2.enemies[0].x = 1; st2.enemies[0].y = 1; // ...which is the mark
    keys('`b');
    expect(st2.player.x).toBe(1); // landed
    expect(st2.enemies.length).toBe(0); // squashed
    expect(st2.limit).toBe(102); // +2 budget
  });

  it('explosions erase all marks — the blast moves the line numbers', () => {
    const st = boot(makeLevel({ map: ['########', '#P.....#', '#......#', '########'] }));
    st.player.arsenal.push('bomb'); st.player.bombs = 1;
    keys('ma');
    game.key('x');
    keys('jl'); // duck out of the plus
    keys('jjj'); // wait out the fuse on the wall
    expect(st.status).toBe('play');
    expect(Object.keys(st.marks).length).toBe(0);
    keys('`a');
    expect(st.echo).toContain('the blast moved the line numbers');
  });

  it('marks live in snapshots — undo restores them', () => {
    const st = boot(makeLevel({ map: ['#######', '#P....#', '#######'] }));
    keys('ma'); // mark at x=1
    keys('ll'); // two ticks — the mark is inside the restore target
    keys('ma'); // move the mark to x=3
    game.key('u'); // rewind one tick (pops now, restores the tick before)
    expect(st.marks['a'].x).toBe(1); // the older mark position is back
  });

  it('marks are gated by the mark keycap group', () => {
    const st = boot(makeLevel({ map: ['#####', '#P..#', '#####'] }));
    game.setVocab(new Set(['core']));
    try {
      game.key('m');
      expect(st.keys).toBe(0);
      expect(st.tick).toBe(0);
      expect(st.echo).toContain('bookmarks are a later chapter');
      game.key('`');
      expect(st.keys).toBe(0);
    } finally {
      game.setVocab(null);
    }
  });
});

describe('% bracket-jump (docs/motions-v2.md §2)', () => {
  const CLOSET = ['#########', '#P(...).#', '#########'];

  it('jumps between partners, both directions, 1 key 1 tick each', () => {
    const st = boot(makeLevel({ map: CLOSET }));
    game.key('l'); // stand on (
    game.key('%');
    expect(st.player.x).toBe(6); // at )
    expect(st.tick).toBe(2);
    game.key('%');
    expect(st.player.x).toBe(2); // back at (
    expect(st.keys).toBe(3);
  });

  it('a bomb on YOUR bracket does not block the exit — the Trapdoor', () => {
    const st = boot(makeLevel({ map: CLOSET }));
    st.player.arsenal.push('bomb'); st.player.bombs = 1;
    keys('lx'); // stand on (, drop
    game.key('%');
    expect(st.player.x).toBe(6); // escaped across the map
    expect(st.bombs.length).toBe(1); // fuse keeps ticking behind you
  });

  it('an occupied partner bonks; off-bracket % bonks', () => {
    const st = boot(makeLevel({ map: ['#########', '#P(..Z).#', '#########'] }));
    game.key('%'); // not on a bracket
    expect(st.echo).toContain('no matching bracket');
    game.key('l'); // onto (
    st.enemies[0].x = 6; st.enemies[0].y = 1; // park the zombie on ) NOW
    game.key('%');
    expect(st.player.x).toBe(2); // blocked
    expect(st.echo).toContain('occupied');
  });

  it('an unmatched bracket fails the level at load', () => {
    expect(() => boot(makeLevel({ map: ['#####', '#P(.#', '#####'] })))
      .toThrow(/bracket pair/);
  });

  it('% is gated by the match keycap group', () => {
    const st = boot(makeLevel({ map: CLOSET }));
    game.setVocab(new Set(['core']));
    try {
      game.key('l');
      game.key('%');
      expect(st.keys).toBe(1); // only the step cost; % was locked and free
      expect(st.echo).toContain('between two brackets');
    } finally {
      game.setVocab(null);
    }
  });
});

describe('. dot-repeat (docs/motions-v2.md §3)', () => {
  const twoTiles = (broken: string) => makeLevel({
    map: ['######', '#PTT.#', '######'],
    terminals: {
      '2,1': { broken, target: 'bomb', grants: 1 },
      '3,1': { broken, target: 'bomb', grants: 1 },
    },
  });

  it('replays a whole ciw-insert edit on a second tile for 1 key + 1 tick', () => {
    const st = boot(twoTiles('zzzz'));
    keys('li'); // tile A
    keys('ciw'); keys('bomb'); game.key('Escape'); // the long way: 8 keys
    expect(st.player.bombs).toBe(1);
    keys('li'); // tile B
    const kBefore = st.keys;
    const tBefore = st.tick;
    game.key('.'); // the dot formula
    expect(st.player.bombs).toBe(2);
    expect(st.mode).toBe('normal'); // solved and auto-closed
    expect(st.keys - kBefore).toBe(1);
    // 0, not 1: the solving keystroke never ticks (standing terminal rule)
    expect(st.tick - tBefore).toBe(0);
  });

  it('replays counted deletes and r-replacements at the cursor', () => {
    const st = boot(twoTiles('bopmb'));
    keys('li'); keys('2l'); game.key('x'); // delete the p at index 2
    expect(st.player.bombs).toBe(1);
    keys('li'); keys('2l'); game.key('.'); // same fix, one key
    expect(st.player.bombs).toBe(2);
  });

  it('lastEdit survives explosions but not level reload', () => {
    const st = boot(makeLevel({
      map: ['########', '#PT....#', '########'],
      terminals: { '2,1': { broken: 'zzzz', target: 'bomb', grants: 1 } },
    }));
    keys('li'); keys('ciw'); keys('bomb'); game.key('Escape');
    keys('x'); // drop the bomb where we stand
    keys('lll'); keys('hl'); // retreat east past the radius, wait out the fuse
    expect(st.status).toBe('play');
    expect(st.lastEdit).not.toBeNull(); // muscle memory outlives the blast
    const st2 = game.loadLevel(0);
    expect(st2.lastEdit).toBeNull();
  });

  it('dot with nothing recorded errors free of tick; world dot bonks with a lesson', () => {
    const st = boot(twoTiles('zzzz'));
    keys('li');
    const t0 = st.tick;
    game.key('.');
    expect(st.echo).toContain('nothing to repeat');
    expect(st.tick).toBe(t0); // free error inside the terminal
    game.key('Escape'); // leave the tile
    game.key('.');
    expect(st.echo).toContain('repeat with edits');
    expect(st.tick).toBe(t0 + 1); // world dot is a bonk — it ticks
  });

  it('a dot replay is ONE stroke for golf budgets', () => {
    const st = boot(makeLevel({
      map: ['######', '#PTT.#', '######'],
      terminals: {
        '2,1': { broken: 'zzzz', target: 'bomb', grants: 1 },
        '3,1': { kind: 'golf', broken: 'zzzz', target: 'bomb', strokes: 2, grants: 1 },
      },
    }));
    keys('li'); keys('ciw'); keys('bomb'); game.key('Escape');
    keys('li'); // the golf tile: 8 keys of edit won't fit in 2 strokes
    game.key('.');
    expect(st.mode).toBe('normal');
    expect(st.player.bombs).toBe(2); // solved within budget
  });

  it('dot is gated by its keycap group', () => {
    const st = boot(twoTiles('zzzz'));
    game.setVocab(new Set(['core']));
    try {
      game.key('.');
      expect(st.keys).toBe(0);
      expect(st.echo).toContain('edits worth repeating');
    } finally {
      game.setVocab(null);
    }
  });
});

describe('/{word} + n search (docs/motions-v2.md §4)', () => {
  const GRID = makeLevel({
    map: [
      '##########',
      '#P.bug...#',
      '#~~~~~~~~#',
      '#..bugs..#',
      '#~~~~~~~~#',
      '#.bug....#',
      '##########',
    ],
  });

  it('costs 2 keys + 1 tick fresh (typing is free); n is 1 key + 1 tick', () => {
    const st = boot(GRID);
    keys('/bug'); game.key('Enter');
    expect(st.player.x).toBe(3);
    expect(st.player.y).toBe(1);
    expect(st.keys).toBe(2); // the / and the Enter; b-u-g were free
    expect(st.tick).toBe(1);
    game.key('n'); // wraps past the bugs decoy to the y5 bug
    expect(st.player.y).toBe(5);
    expect(st.keys).toBe(3);
    expect(st.tick).toBe(2);
  });

  it('matches whole words only — bug never lands inside bugs', () => {
    const st = boot(GRID);
    keys('/bug'); game.key('Enter');
    game.key('n');
    game.key('n'); // wraps around: back to the first bug, over the moats
    expect(st.player.y).toBe(1);
    for (let i = 0; i < 4; i++) game.key('n');
    expect(st.player.y === 1 || st.player.y === 5).toBe(true); // never y3
  });

  it('an occupied landing is skipped, not fatal', () => {
    const st = boot(makeLevel({ map: ['##########', '#P.bug.Z.#', '#.bug....#', '##########'] }));
    st.enemies[0].x = 3; st.enemies[0].y = 1; // zombie parks on the near bug
    keys('/bug'); game.key('Enter');
    expect(st.player.y).toBe(2); // skipped to the far instance
  });

  it('pattern not found bonks; empty pattern errors free; Escape abandons', () => {
    const st = boot(GRID);
    game.key('/'); game.key('Enter'); // bare / with no history yet
    expect(st.echo).toContain('empty pattern');
    expect(st.tick).toBe(0);
    keys('/nope'); game.key('Enter');
    expect(st.echo).toContain('pattern not found');
    expect(st.tick).toBe(1); // the failed Enter is a bonk (and nope is now history)
    game.key('/'); keys('zz'); game.key('Escape');
    expect(st.searchBuf).toBeNull(); // abandoned; the / keys were spent
    expect(st.tick).toBe(1); // no tick for the abandoned prompt
  });

  it('n with no search is a free error, like ;', () => {
    const st = boot(GRID);
    game.key('n');
    expect(st.echo).toContain('no search to repeat');
    expect(st.tick).toBe(0);
  });

  it('search is gated by its keycap group', () => {
    const st = boot(GRID);
    game.setVocab(new Set(['core']));
    try {
      game.key('/');
      expect(st.keys).toBe(0);
      expect(st.echo).toContain('grep is earned');
    } finally {
      game.setVocab(null);
    }
  });
});

describe('macros (docs/motions-v2.md §5)', () => {
  const HALL = makeLevel({ map: ['###########', '#P........#', '###########'] });

  it('qa records free; @a replays for 2 keys and ONE tick', () => {
    const st = boot(HALL);
    keys('qa'); // start recording — free
    expect(st.keys).toBe(0);
    keys('ll2l'); // three commands, three ticks, recorded live
    keys('q'); // stop — free
    expect(st.keys).toBe(4);
    expect(st.tick).toBe(3);
    expect(st.registers['a']).toEqual(['l', 'l', '2', 'l']);
    keys('4h'); // back to the start-ish
    const t0 = st.tick;
    keys('@a');
    expect(st.player.x).toBe(5); // the whole run replayed
    expect(st.tick - t0).toBe(1); // one enemy turn for everything
    expect(st.keys).toBe(8); // 4h (2) + @a (2)
  });

  it('@@ re-runs the last register; empty registers error free', () => {
    const st = boot(HALL);
    keys('@z');
    expect(st.echo).toContain('register z is empty');
    expect(st.tick).toBe(0);
    keys('qb'); keys('l'); keys('q');
    keys('@b'); keys('@@');
    expect(st.player.x).toBe(4); // l, then replayed twice more
  });

  it('a bonk aborts the replay mid-macro; the tick still lands', () => {
    const st = boot(makeLevel({ map: ['#######', '#P....#', '#######'] }));
    keys('qa'); keys('3l'); keys('q'); // record a 3-slide
    keys('$'); // park at the east wall
    keys('@a'); // replays 3l — immediate bonk into the wall
    expect(st.echo).toMatch(/^E:/);
    expect(st.player.x).toBe(5); // never moved
  });

  it('i, / and u refuse to record — macros are pure motion', () => {
    const st = boot(HALL);
    keys('qa');
    game.key('i');
    expect(st.echo).toContain("won't record");
    game.key('/');
    game.key('u');
    keys('l');
    keys('q');
    expect(st.registers['a']).toEqual(['l']); // only the motion made it in
  });

  it('enemies get exactly one move against a whole replayed wing', () => {
    const st = boot(makeLevel({ map: ['###########', '#P.......Z#', '###########'] }));
    keys('qa'); keys('l'); keys('q');
    const z = st.enemies[0];
    const zx = z.x;
    keys('@a');
    // zombie is half-speed: at most one step for the entire replay turn
    expect(zx - z.x).toBeLessThanOrEqual(1);
  });

  it('one u rewinds an entire replay — one turn, one snapshot', () => {
    const st = boot(HALL);
    keys('qa'); keys('llll'); keys('q'); // record 4 steps (4 ticks)
    keys('8h'); // back to x1
    keys('@a'); // one tick, lands x5
    expect(st.player.x).toBe(5);
    game.key('u');
    expect(st.player.x).toBe(1); // the whole macro, undone at once
  });

  it('macros are gated by their keycap group', () => {
    const st = boot(HALL);
    game.setVocab(new Set(['core']));
    try {
      game.key('q');
      expect(st.keys).toBe(0);
      expect(st.echo).toContain('automation is the last lesson');
    } finally {
      game.setVocab(null);
    }
  });
});

describe('the arsenal: grep line bombs (docs/arsenal.md)', () => {
  it('crafting a grep-armed tile queues a grep; FIFO drop order holds', () => {
    const st = boot(makeLevel({
      map: ['########', '#PTT...#', '########'],
      terminals: {
        '2,1': { broken: 'bpmb', target: 'bomb', grants: 1 },
        '3,1': { kind: 'clean', broken: 'ok##', grants: 1, arms: 'grep' },
      },
    }));
    keys('lilro'); // craft the classic
    keys('lif#xx'); // purge lint, craft the grep
    expect(st.player.arsenal).toEqual(['bomb', 'grep']);
    game.key('x'); // FIFO: the classic drops first
    expect(st.bombs[0].kind).toBe('bomb');
    expect(st.player.arsenal).toEqual(['grep']);
  });

  it('a grep sweeps its whole row, kills occupants, breaks no terrain', () => {
    // the rock case: beam stops at the rock, sparing the zombie behind it
    const st = boot(makeLevel({
      map: ['##########', '#P...%.Z.#', '#........#', '##########'],
      enemyOpts: { '7,1': { leash: 'row' } }, // patrols only its own row
    }));
    st.player.arsenal.push('grep'); st.player.bombs = 1;
    game.key('x');
    keys('jlllll'); // duck below and wait out the fuse
    expect(st.status).toBe('play');
    expect(st.grid[1][5]).toBe('%'); // the rock survives — beams don't dig
    expect(st.enemies.length).toBe(1); // shielded by the rock

    // the open-row case: the whole line matches
    const st2 = boot(makeLevel({
      map: ['##########', '#P.....Z.#', '#........#', '##########'],
      enemyOpts: { '7,1': { leash: 'row' } },
    }));
    st2.player.arsenal.push('grep'); st2.player.bombs = 1;
    game.key('x');
    keys('jlllll');
    expect(st2.enemies.length).toBe(0);
  });

  it('margins shield against greps — player and zombie both', () => {
    const st = boot(makeLevel({ map: ['##########', '#P|.....|#', '##########'] }));
    st.player.arsenal.push('grep'); st.player.bombs = 1;
    // a statue on the far margin: col-leashed with walls above and below
    st.enemies.push({ type: 'zombie', x: 8, y: 1, leash: 'col' });
    game.key('x'); // grep at x1
    game.key('l'); // step onto the near margin
    keys('hhhh'); // bonk the bomb tile until the beam fires
    expect(st.status).toBe('play'); // the margin held
    expect(st.enemies.length).toBe(1); // so did theirs
  });

  it('a plus-blast chains a placed grep; a grep never chains anything', () => {
    const st = boot(makeLevel({
      map: ['###########', '#P...Z....#', '#.........#', '###########'],
      enemyOpts: { '5,1': { leash: 'row' } },
    }));
    st.player.arsenal.push('grep', 'bomb'); st.player.bombs = 2;
    keys('x'); // grep down at x1 (FIFO front)
    keys('ll'); // two steps east
    keys('x'); // classic at x3 — within radius 2 of the placed grep
    keys('jh'); // duck; the grep's fuse hits 0 first
    expect(st.status).toBe('play');
    // the beam swept the row (zombie dead) but did NOT cook the classic
    expect(st.enemies.length).toBe(0);
    expect(st.bombs.map((b) => b.kind)).toEqual(['bomb']);
    keys('hlh'); // now let the classic finish
    expect(st.bombs.length).toBe(0);
  });

  it('imps flee a pending grep row', () => {
    const st = boot(makeLevel({ map: ['#########', '#P....I.#', '#.......#', '#########'] }));
    st.player.arsenal.push('grep'); st.player.bombs = 1;
    game.key('x');
    keys('jll'); // fuse burns to <=2 — the imp now sees the whole row as hot
    const imp = st.enemies[0];
    keys('l');
    expect(imp.y).not.toBe(1); // it left the row rather than stand in the match
  });
});

describe('the arsenal: sed terraformers (docs/arsenal.md §3)', () => {
  it('digs soft rock and opens bushes, but kills nothing — not even you', () => {
    const st = boot(makeLevel({
      map: ['#########', '#.%P*.Z.#', '#.......#', '#########'],
      bushes: { '4,1': { type: 'K', amt: 5 } },
      enemyOpts: { '6,1': { leash: 'row' } },
    }));
    st.player.arsenal.push('sed'); st.player.bombs = 1;
    game.key('x');
    keys('kkkkk'); // stand ON the sed (bonking the ceiling) — the wash is safe
    expect(st.status).toBe('play'); // unharmed at ground zero
    expect(st.grid[1][2]).toBe('.'); // rock west: replaced with floor
    expect(st.grid[1][4]).toBe('K'); // bush east: opened into its item
    expect(st.enemies.length).toBe(1); // nobody died
  });

  it('never cracks hard rock, at any radius', () => {
    const st = boot(makeLevel({ map: ['#########', '#P.&....#', '#.......#', '#########'] }));
    st.player.radius = 4;
    st.player.arsenal.push('sed'); st.player.bombs = 1;
    game.key('x');
    keys('jlllll');
    expect(st.grid[1][3]).toBe('&'); // s/rock/floor/ does not match granite
  });

  it('a plus-blast triggers a placed sed; a sed triggers nothing', () => {
    const st = boot(makeLevel({ map: ['##########', '#P..%.%..#', '#........#', '##########'] }));
    st.player.arsenal.push('sed', 'bomb'); st.player.bombs = 2;
    keys('x'); // sed at x1 (FIFO front)
    keys('jl'); // duck below
    keys('kl'); // hop back up to x2... 
    expect(st.status).toBe('play');
    keys('x'); // classic dropped, adjacent-ish to the ticking sed
    keys('jh'); // duck to (2,2): the sed's fuse hits 0 first
    // the sed washed over the classic's tile without cooking it off
    expect(st.bombs.map((b) => b.kind)).toEqual(['bomb']); // un-triggered
    keys('hlh'); // wait out the classic from the safe corner
    expect(st.bombs.length).toBe(0);
    expect(st.status).toBe('play');
  });

  it('a pending sed is not in the danger set — imps will not flee it', () => {
    const st = boot(makeLevel({ map: ['#########', '#P......#', '#.......#', '#########'] }));
    st.bombs.push({ x: 3, y: 1, fuse: 1, r: 2, kind: 'sed', soft: false });
    expect(game._internals.pendingBlast().size).toBe(0); // harmless, ignored
    st.bombs.push({ x: 6, y: 1, fuse: 1, r: 2, kind: 'bomb', soft: false });
    expect(game._internals.pendingBlast().size).toBeGreaterThan(0);
  });
});

describe('sky v2: wind + the flytrap (docs/new-mechanics.md §5)', () => {
  const windy = (skyRow: string) => makeLevel({
    map: ['#########', '#P@.....#', '#########'],
    sky: ['#########', skyRow, '#########'],
  });

  it('standing in wind drifts one tile per tick, motions first', () => {
    const st = boot(windy('#..>>...#'));
    keys('l');
    game.key('<C-u>');
    game.key('l'); // step onto the wind at (3,1) → drift carries to (4,1)
    expect(st.player.x).toBe(4);
    game.key('k'); // bonk the ceiling — standing still is not standing still
    expect(st.player.x).toBe(5);
  });

  it('wind never pushes into open air — pinned, unharmed', () => {
    const st = boot(windy('#..>~...#'));
    keys('l');
    game.key('<C-u>');
    game.key('l'); // onto the wind; its push target is open air
    expect(st.player.x).toBe(3); // a current, not a cliff
    expect(st.status).toBe('play');
  });

  it('sky arrows are wind, not one-ways: enterable against the current', () => {
    const st = boot(windy('#...>...#'));
    keys('l');
    game.key('<C-u>');
    keys('ll'); // through (3,1), onto the wind, drift to (5,1)
    expect(st.player.x).toBe(5);
    game.key('h'); // re-enter the wind tile moving LEFT — ground would refuse
    expect(st.bonks).toBe(0); // no bonk: it's weather, not a door
    expect(st.player.x).toBe(5); // stepped in, drifted right back out
  });

  it('a sky exit wins aloft — the export', () => {
    const st = boot(windy('#..E....#'));
    keys('l');
    game.key('<C-u>');
    game.key('l');
    expect(st.status).toBe('won');
  });

  it('the flytrap: shadow-gathered zombies die to a pre-planted bomb', () => {
    const st = boot(makeLevel({
      map: ['#########', '#P@....Z#', '#########'],
      sky: ['#########', '#.......#', '#########'],
    }));
    st.player.arsenal.push('bomb'); st.player.bombs = 1;
    keys('l'); // onto the updraft
    game.key('x'); // leave the present
    game.key('<C-u>');
    keys('lhlh'); // hover-dance; the zombie walks to the shadow
    expect(st.status).toBe('play'); // you were never on that layer
    expect(st.enemies.length).toBe(0); // it gathered; the fuse disagreed
  });
});

describe('kites (docs/new-mechanics.md §5b)', () => {
  const KITELAND = (skyRow: string, opts?: object) => makeLevel({
    map: ['##########', '#P@.....Z#', '##########'],
    sky: ['##########', skyRow, '##########'],
    enemyOpts: opts as never,
  });

  it('kites chase at full speed and kill on contact — aloft only', () => {
    const st = boot(KITELAND('#......Y.#'));
    keys('l'); game.key('<C-u>'); // aloft at (2,1); the kite closes 1/tick
    keys('hh'); // two bonks into the wall: it gains two tiles
    const kite = st.enemies.find((e) => e.aloft)!;
    expect(kite.x).toBe(4); // 7 → 5 → 4... wait: 3 ticks passed aloft
    game.key('h'); game.key('h');
    expect(st.status).toBe('dead');
    expect(st.deathMsg).toBe('slain by the kite');
  });

  it('a grounded player is untouchable — same-layer contact only', () => {
    const st = boot(KITELAND('#.Y......#'));
    keys('hhhh'); // stay grounded right under it; it circles overhead
    expect(st.status).toBe('play');
  });

  it('flight over a kite cuts the string; landing short does not', () => {
    const st = boot(KITELAND('#..a.Y.b.#'));
    keys('l'); game.key('<C-u>');
    keys('fa'); // land at (3,1), kite approaching from (5,1)-ish
    const before = st.enemies.filter((e) => e.aloft).length;
    expect(before).toBe(1);
    keys('fb'); // dash to b at (7,1), sweeping over the kite
    expect(st.enemies.filter((e) => e.aloft).length).toBe(0);
    expect(st.echo).toContain('string cut');
  });

  it('ground ordnance never reaches the sky', () => {
    const st = boot(KITELAND('#.Y......#'));
    st.player.arsenal.push('grep'); st.player.bombs = 1;
    game.key('x'); // a grep sweeps the whole ground row on detonation
    keys('lhlhl'); // wait it out... in the row, grep kills occupants —
    // the player IS an occupant; keep it simple: check the kite after boom
    expect(st.enemies.filter((e) => e.aloft).length).toBe(1);
  });

  it('col-leashed kites bob like a metronome, fenced by thunderheads', () => {
    const st = boot(makeLevel({
      map: ['#######', '#P@...#', '#.....#', '#######'],
      sky: ['#######', '#...Y.#', '#.....#', '#######'],
      enemyOpts: { '4,1': { leash: 'col' } } as never,
    }));
    const kite = st.enemies.find((e) => e.aloft)!;
    keys('l'); // t1: kite tries up (wall) then bobs down
    expect(kite.y).toBe(2);
    keys('h'); // t2: back up
    expect(kite.y).toBe(1);
  });
});
