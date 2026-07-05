// Boot: wire engine fx hooks to sound + view effects, start the render loop.
import './style.css';
import * as game from './engine/engine';
import { LEVELS } from './levels';
import {
  addExplosion, addSweep, damageFlash, initRenderer, kick, sparkle, startLoop,
} from './render/renderer';
import { snd } from './ui/audio';
import {
  applyCrt, handleKeydown, noteDeath, resumeGame, showClear, showDead, showFail,
  showPause, toast, showTitle,
} from './ui/screens';
import { updateTermbox } from './ui/termbox';
import { persist, save } from './ui/save';
import type { ItemType, VocabGroup } from './engine/types';

game.setLevels(LEVELS);
// progressive disclosure: the UI plays with the collected vocabulary only
// (the engine itself defaults to everything-unlocked for tests/headless use)
game.setVocab(new Set<VocabGroup>(save.keycaps));

const ITEM_COLORS: Record<ItemType, string> = {
  K: '#ffd23f', R: '#ff8c1a', U: '#26c6da', B: '#33ff66',
};

game.fx.error = () => snd.error();
game.fx.moved = () => snd.move();
game.fx.bomb = () => snd.bomb();
game.fx.explosion = (tiles) => {
  kick(7);
  snd.boom();
  addExplosion(tiles);
};
game.fx.solved = () => { snd.solved(); updateTermbox(); };
game.fx.item = (type) => {
  snd.item();
  const p = game.state().player;
  sparkle(p.x, p.y, ITEM_COLORS[type]);
  toast(game.state().echo);
};
game.fx.win = () => setTimeout(showClear, 350);
game.fx.death = (msg) => {
  damageFlash();
  noteDeath(msg);
  setTimeout(() => showDead(msg), 450);
};
game.fx.fail = () => setTimeout(showFail, 250);
game.fx.rescue = () => { snd.rescue(); resumeGame(); };
game.fx.wantPause = () => showPause();
game.fx.enterTerm = () => { snd.slide(); updateTermbox(); };
game.fx.exitTerm = () => updateTermbox();
game.fx.telegraph = () => snd.port();
game.fx.tick = () => updateTermbox();
game.fx.collectBush = () => snd.item();
game.fx.flip = (n) => { snd.flip(); toast(n > 1 ? `${n} toads flipped` : 'toad flipped — squash it for +2'); };
game.fx.squash = () => {
  snd.squash();
  const p = game.state().player;
  sparkle(p.x, p.y, '#a4e552');
  toast(game.state().echo);
};
game.fx.sweep = (tiles) => { snd.sweep(); kick(3); addSweep(tiles); };
game.fx.cut = (n) => {
  snd.sweep();
  toast(n > 1 ? `${n} strings cut` : 'string cut — the TODO drifts away');
};
game.fx.sed = (tiles) => {
  snd.solved(); // a substitution, not a boom — no shake
  for (const [x, y] of tiles) sparkle(x, y, '#7ce9a2');
};
game.fx.rise = () => snd.rise();
game.fx.drop = () => snd.drop();
game.fx.coin = () => { snd.item(); updateTermbox(); };
game.fx.termReset = () => { snd.error(); updateTermbox(); };
game.fx.keycap = (group) => {
  snd.keycap();
  const p = game.state().player;
  sparkle(p.x, p.y, '#ffd23f');
  toast(game.state().echo);
  // keycaps persist across levels and sessions
  if (!save.keycaps.includes(group)) {
    save.keycaps.push(group);
    persist();
  }
};
game.fx.locked = () => {
  snd.error();
  toast('grey slots in the tray are keycaps you haven\'t found yet', 'locked');
};

initRenderer(document.getElementById('game') as HTMLCanvasElement);
window.addEventListener('keydown', handleKeydown);
applyCrt();
showTitle();
startLoop();
