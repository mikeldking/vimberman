// The code-tile editor overlay (buffer, cursor, target hint).
import * as game from '../engine/engine';

export function updateTermbox(): void {
  const box = document.getElementById('termbox')!;
  if (!game.loaded()) { box.classList.add('hidden'); return; }
  const st = game.state();
  if (st.mode !== 'terminal' || !st.term) { box.classList.add('hidden'); return; }
  const t = st.term.t;
  const ins = st.term.insert;
  const chars = t.buffer.map((c, i) =>
    `<span class="${i === t.cursor ? (ins ? 'cur ins' : 'cur') : ''}">${c}</span>`).join('');
  const tail = t.cursor >= t.buffer.length ? `<span class="${ins ? 'cur ins' : 'cur'}">&nbsp;</span>` : '';
  box.innerHTML = `<div class="buf">${chars}${tail}</div>
    <div class="tgt">make it say: <b>${t.target}</b>  (hint: ${t.hint || 'edit it'})</div>
    <div class="tmode">${ins ? '-- INSERT -- (Esc to commit)' : 'normal · h l x r ~ s cw ciw i a · Esc leave'}</div>`;
  box.classList.remove('hidden');
}
