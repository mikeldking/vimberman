// Attract-mode contract: idling on the title starts a ghost demo that drives
// the real engine, loops forever, never touches the save, and dies (restoring
// the gated vocabulary) on the first real keypress.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { installDom, type StubDom } from './stubs';

const IDLE_MS = 8000;
const STEP_MS = 340;

let dom: StubDom;
let game: typeof import('../src/engine/engine');

beforeAll(async () => {
  vi.useFakeTimers();
  dom = installDom();
  await import('../src/main');
  game = await import('../src/engine/engine');
});

describe('title attract mode', () => {
  it('starts a ghost demo after idling on the title, without saving anything', () => {
    expect(game.loaded()).toBe(false);
    vi.advanceTimersByTime(IDLE_MS);
    expect(game.loaded()).toBe(true); // the demo level is on the board
    vi.advanceTimersByTime(STEP_MS * 8); // 'l 9l 6j h' = 6 keys, then holding
    expect(game.state().status).toBe('won');
    expect(dom.store['vimberman.save.v1']).toBeUndefined(); // fx.win was muted
    expect(dom.els.panel.innerHTML).toContain('PLAY'); // menu never went away
  });

  it('loops back to a fresh run after lingering on the won board', () => {
    vi.advanceTimersByTime(STEP_MS * 6);
    expect(game.state().status).toBe('play');
    expect(game.getVocab()).toBeNull(); // demo plays with the full keyboard
  });

  it('any keypress kills the demo and restores the gated vocabulary', () => {
    dom.key('j');
    const frozen = game.state().keys;
    vi.advanceTimersByTime(STEP_MS * 10); // well under the idle threshold
    expect(game.state().keys).toBe(frozen); // no more ghost keystrokes
    expect([...game.getVocab()!]).toEqual(['core']); // fresh-save gating is back
  });
});
