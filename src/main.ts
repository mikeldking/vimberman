// Boot: wire engine fx hooks to sound + view effects, start the render loop.
import './style.css';
import * as game from './engine/engine';
import { LEVELS } from './levels';
import {
  addExplosion, damageFlash, initRenderer, kick, sparkle, startLoop,
} from './render/renderer';
import { snd } from './ui/audio';
import {
  handleKeydown, resumeGame, showClear, showDead, showFail, showPause, toast, showTitle,
} from './ui/screens';
import { updateTermbox } from './ui/termbox';
import type { ItemType } from './engine/types';

game.setLevels(LEVELS);

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

initRenderer(document.getElementById('game') as HTMLCanvasElement);
window.addEventListener('keydown', handleKeydown);
showTitle();
startLoop();
