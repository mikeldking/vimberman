// The code-tile editor overlay (buffer, cursor, per-minigame goal line).
import * as game from '../engine/engine';
import { sparkPos } from '../engine/engine';

export function updateTermbox(): void {
  const box = document.getElementById('termbox')!;
  if (!game.loaded()) { box.classList.add('hidden'); return; }
  const st = game.state();
  if (st.mode !== 'terminal' || !st.term) { box.classList.add('hidden'); return; }
  const T = st.term;
  const t = T.t;
  const ins = T.insert;
  const coinKind = t.kind === 'coins' || t.kind === 'spark';
  const spark = t.kind === 'spark' ? sparkPos(t, T) : -1;
  const cls = (i: number, c: string): string => {
    const out: string[] = [];
    if (i === t.cursor) { out.push('cur'); if (ins) out.push('ins'); }
    if (i === spark) out.push('zap');
    if (coinKind && c === t.coin) out.push('coin');
    if (t.kind === 'clean' && c === t.glitch) out.push('bad');
    return out.join(' ');
  };
  const chars = t.buffer.map((c, i) =>
    `<span class="${cls(i, c)}">${c}</span>`).join('');
  const tail = t.cursor >= t.buffer.length ? `<span class="${ins ? 'cur ins' : 'cur'}">&nbsp;</span>` : '';
  let goal: string;
  if (t.kind === 'clean') {
    const left = t.buffer.filter((c) => c === t.glitch).length;
    goal = `purge every <b>${t.glitch}</b> — ${left} left`;
  } else if (coinKind) {
    const left = t.buffer.filter((c) => c === t.coin).length;
    const clock = Math.max(0, t.deadline - T.ticks);
    goal = `land on every <b>${t.coin}</b> — ${left} left · respawns in ${clock}`;
    if (t.kind === 'spark') goal += ' · dodge the scan head';
  } else if (t.kind === 'golf') {
    const left = Math.max(0, t.strokes - T.used);
    goal = `make it say: <b>${t.target}</b> — ${left} stroke${left === 1 ? '' : 's'} left`;
  } else {
    goal = `make it say: <b>${t.target}</b>`;
  }
  goal += `  (hint: ${t.hint || 'edit it'})`;
  box.innerHTML = `<div class="buf">${chars}${tail}</div>
    <div class="tgt">${goal}</div>
    <div class="tmode">${ins ? '-- INSERT -- (Esc to commit)' : 'normal · h l f w b e x r ~ s cw ciw i a · Esc leave'}</div>`;
  box.classList.remove('hidden');
}
