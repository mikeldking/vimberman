// HUD bar + vim statusline, updated every animation frame.
import * as game from '../engine/engine';
import { ui } from './state';

const $ = (id: string) => document.getElementById(id)!;

export function slMode(m: string): void {
  const el = $('sl-mode');
  el.textContent = `-- ${m} --`;
  el.classList.toggle('insert', m === 'INSERT');
}

export function updateHud(): void {
  const inGame = ['GAME', 'PAUSE', 'DEAD', 'FAIL', 'CLEAR'].includes(ui.screen);
  if (!game.loaded() || !inGame) {
    $('hud-level').textContent = 'VIMBERMAN';
    $('hud-keys').textContent = '';
    $('hud-right').textContent = 'v2.0';
    $('sl-pos').textContent = '';
    $('sl-pend').textContent = '';
    $('sl-last').textContent = '';
    $('sl-echo').textContent = 'a game about typing your way out';
    return;
  }
  const st = game.state();
  $('hud-level').textContent = `L${String(ui.currentLevel).padStart(2, '0')} · ${st.lv.name}`;
  const rem = st.limit - st.keys;
  const frac = rem / st.limit;
  const keysEl = $('hud-keys');
  keysEl.textContent = `KEYS ${st.keys}/${st.limit}`;
  keysEl.className = frac > 0.5 ? '' : frac > 0.2 ? 'warn' : 'danger';
  $('hud-right').textContent =
    `BOMBS ${'●'.repeat(st.player.bombs)}${'○'.repeat(Math.max(0, 3 - st.player.bombs))}  UNDO ${st.player.undo}  R${st.player.radius}`;
  if (ui.screen === 'GAME') {
    slMode(st.mode === 'terminal' ? (st.term && st.term.insert ? 'INSERT' : 'EDIT') : 'NORMAL');
  }
  $('sl-pos').textContent = `${st.player.x},${st.player.y}`;
  $('sl-pend').textContent = st.pending.count + (st.pending.op || '') +
    (st.mode === 'terminal' && st.term ? st.term.pending.count + (st.term.pending.op || '') : '');
  $('sl-last').textContent = st.lastCmd || '';
  const echoEl = $('sl-echo');
  echoEl.textContent = st.echo || '';
  echoEl.className = (st.echo || '').startsWith('E:') ? 'echo' : '';
}
