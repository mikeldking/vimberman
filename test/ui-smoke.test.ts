// UI smoke test: boots the full app against a stub DOM, navigates menus with
// vim keys, plays level 1 through the real keydown handler, and asserts the
// clear screen + save state.
import { describe, it, expect, beforeAll } from 'vitest';
import { installDom, type StubDom } from './stubs';

let dom: StubDom;
let game: typeof import('../src/engine/engine');

beforeAll(async () => {
  dom = installDom();
  await import('../src/main');
  game = await import('../src/engine/engine');
});

describe('ui smoke', () => {
  it('boots to the title screen', () => {
    dom.frames(2);
    expect(dom.els.panel.innerHTML).toContain('PLAY');
  });

  it('navigates title -> select -> intro -> game with vim keys', () => {
    dom.key('j'); dom.key('k'); dom.key('Enter');
    expect(dom.els.panel.innerHTML).toContain('SELECT LEVEL');
    expect(dom.els.panel.innerHTML).toContain('LOCKED');
    dom.key('Enter');
    expect(dom.els.panel.innerHTML).toContain('LEVEL 01');
    dom.key('Enter');
    expect(dom.els.overlay.classList.contains('hidden')).toBe(true);
    dom.frames(5);
  });

  it('ignores arrow keys without spending budget', () => {
    const px = game.state().player.x;
    dom.key('ArrowRight');
    expect(game.state().player.x).toBe(px);
    expect(game.state().keys).toBe(0);
  });

  it('wins level 1 through real keydown input', async () => {
    const sol = 'jjjjjjllllkklljjllkkkkhhkklllljjjjjj';
    for (const k of sol) dom.key(k);
    dom.frames(30);
    expect(game.state().status).toBe('won');
    await new Promise((r) => setTimeout(r, 500)); // showClear fires on a 350ms delay
    expect(dom.els.panel.innerHTML).toContain('LEVEL CLEAR');
    expect(dom.els.panel.innerHTML).toContain('★');
    const saved = JSON.parse(dom.store['vimberman.save.v1']);
    expect(saved.unlocked).toBe(2);
    expect(saved.levels['1'].bestKeys).toBe(36);
  });

  it('advances to the next intro from the clear screen', () => {
    dom.key('Enter');
    expect(dom.els.panel.innerHTML).toContain('LEVEL 02');
    dom.key('Escape');
  });

  it('locked motions are free and refused until their keycap is collected', () => {
    game.loadLevel(3); // level 4 teaches `i`; a fresh save hasn't collected it
    dom.els.overlay.classList.add('hidden');
    game.key('i');
    expect(game.state().keys).toBe(0); // locked keys cost nothing
    expect(game.state().tick).toBe(0); // and give enemies no turn
    expect(game.state().echo).toContain('unmapped');
  });

  it('opens the terminal editor UI on a code-tile', () => {
    // drive level 4 through the engine; the first step sweeps the edit keycap
    game.loadLevel(3);
    dom.els.overlay.classList.add('hidden');
    for (const k of 'lllljjhh') game.key(k);
    game.key('i');
    dom.frames(2);
    expect(game.state().mode).toBe('terminal');
    expect(dom.els.termbox.classList.contains('hidden')).toBe(false);
    game.key('l'); game.key('r'); game.key('o');
    dom.frames(2);
    expect(game.state().player.bombs).toBe(1);
    expect(game.state().mode).toBe('normal');
  });
});
