// HUD bar + keycap tray + vim statusline, updated every animation frame.
import * as game from '../engine/engine';
import { ui } from './state';

const $ = (id: string) => document.getElementById(id)!;

export function slMode(m: string): void {
  const el = $('sl-mode');
  el.textContent = `-- ${m} --`;
  el.classList.toggle('insert', m === 'INSERT');
}

// the Metroid item bar: collected vocab groups as chips, the rest as [?] slots
let lastTray = '';
function updateTray(inGame: boolean): void {
  const el = $('vocab');
  const vocab = game.getVocab();
  if (!inGame || !vocab) {
    if (lastTray !== '') { el.innerHTML = ''; lastTray = ''; }
    return;
  }
  const html = game.VOCAB_GROUPS.map(({ id, label }) =>
    vocab.has(id)
      ? `<span class="cap on">${label}</span>`
      : '<span class="cap">?</span>',
  ).join('');
  if (html !== lastTray) { el.innerHTML = html; lastTray = html; }
}

export function updateHud(): void {
  const inGame = ['GAME', 'PAUSE', 'DEAD', 'FAIL', 'CLEAR'].includes(ui.screen);
  updateTray(inGame && game.loaded());
  if (!game.loaded() || !inGame) {
    $('hud-level').textContent = 'VIMBERMAN';
    $('hud-keys').textContent = '';
    $('hud-right').textContent = 'v2.0';
    $('sl-pos').textContent = '';
    $('sl-pend').textContent = '';
    $('sl-last').textContent = '';
    if (!ui.exCmd) $('sl-echo').textContent = 'a game about typing your way out';
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
    `BOMBS ${st.player.arsenal.map((k) => k === 'grep' ? '≡' : k === 'sed' ? '§' : '●').join('')}${'○'.repeat(Math.max(0, 3 - st.player.arsenal.length))}  UNDO ${st.player.undo}  R${st.player.radius}`;
  if (ui.screen === 'GAME') {
    slMode(st.mode === 'terminal' ? (st.term && st.term.insert ? 'INSERT' : 'EDIT') : 'NORMAL');
  }
  $('sl-pos').textContent = (st.layer === 'sky' ? '~/sky ' : '') + `${st.player.x},${st.player.y}`;
  $('sl-pend').textContent = st.pending.count + (st.pending.op || '') +
    (st.mode === 'terminal' && st.term ? st.term.pending.count + (st.term.pending.op || '') : '');
  $('sl-last').textContent = st.lastCmd || '';
  const echoEl = $('sl-echo');
  if (ui.exCmd) {
    // the ex command line takes over the echo area while open
    echoEl.textContent = ':' + ui.exCmd + '▁';
    echoEl.className = '';
    return;
  }
  echoEl.textContent = st.echo || '';
  echoEl.className = (st.echo || '').startsWith('E:') ? 'echo' : '';
}
