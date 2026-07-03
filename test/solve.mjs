// Headless solvability harness: plays every level through the real engine
// with scripted vim keystrokes and asserts a win within the keystroke budget.
// Usage: node test/solve.mjs [levelNum] [--trace]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const VB = require('../engine.js');

const trace = process.argv.includes('--trace');
const only = process.argv.find((a) => /^\d+$/.test(a));

// tokens separated by spaces; each token is a sequence of single-char keys,
// except <e> = Escape. Example: "10l fa i cw bomb <e>"
function expand(s) {
  const out = [];
  for (const tok of s.trim().split(/\s+/)) {
    if (tok === '<e>') out.push('Escape');
    else out.push(...tok.split(''));
  }
  return out;
}

const SOLUTIONS = {
  1: 'jjjjjj llll kk ll jj ll kk kk hh kk llll jjjjjj',
  2: '10l 6j h',
  3: 'll fa jj l Fb jj fc fd l jj Ff Fe h',
  4: '4l jj hh i l ro ll kk 4h 4j x kkk h h 3j 4k h h h 4j 4l jj ll l i ll x h x h h k l l l j 6l',
  5: 'w w ll jj b b hh jj w w ll jj b b hh',
  6: 'G ll gg ll 4j i ll x G ll gg ll G x gg l l l l l G ll l l l l l l l l l l l x h h gg l l l G ll gg ll G',
  7: '3j i cw bomb <e> jjj ll kkk x kkk k k k jjj l j j j j l 3k ll jjj jjj i cw bomb <e> kkk x jjj j j j kkk h h h ll 3k ll 6j',
  8: 'w w ll 7j l l l l l l l x 3k l l l l l 4j hhhh i cw bomb <e> hhhh x lll j j 7h gg w j j w k x b j j j j w lll 4j hhhh k k',
  9: 'w w ll jj l l l l hh hhh hh i ~~~~ hhhhh x llll k k hhhh j 3j l ll l i ciw bomb <e> lll ll l ll jj l l hhhh j j j j j j j j h x llll j j 7h hhhh 4k lll x hhh k h h j 5l l',
  10: 'w w ll i l ro ll ~ l j j hh l l l l l l l l l l l l l l l l l l hhhh x lll l l hhh jj k h h h h h h h h h h h h h h h h h h h h h h h h h h h h h h h h h h k h k k k k k x l l l l l 8h h 6j lll i ciw bomb <e> lll x hhhh j 5l lll k k',
};

let pass = 0, fail = 0;
const levels = only ? [parseInt(only, 10)] : Array.from({ length: VB.LEVELS.length }, (_, i) => i + 1);

for (const n of levels) {
  const st = VB.loadLevel(n - 1);
  const script = expand(SOLUTIONS[n] || '');
  for (const k of script) {
    if (st.status === 'won' || st.status === 'fail') break;
    VB.key(k);
    if (trace) {
      const en = st.enemies.map((e) => `${e.type[0]}(${e.x},${e.y})`).join(' ');
      const bo = st.bombs.map((b) => `B(${b.x},${b.y}:${b.fuse})`).join(' ');
      console.log(
        `k=${k === 'Escape' ? '<e>' : k} pos=(${st.player.x},${st.player.y}) mode=${st.mode}` +
        ` keys=${st.keys}/${st.limit} tick=${st.tick} bombs=${st.player.bombs} st=${st.status}` +
        (st.deathMsg ? ' DEATH:' + st.deathMsg : '') + ` | ${en} ${bo} ${st.echo || ''}`
      );
      if (st.mode === 'terminal' && st.term) {
        console.log(`   term: [${st.term.t.buffer.join('')}] cur=${st.term.t.cursor} ins=${st.term.insert}`);
      }
    }
  }
  const ok = st.status === 'won' && st.keys <= st.limit;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  L${n} ${VB.LEVELS[n - 1].name.padEnd(24)} ` +
    `keys=${st.keys}/${st.limit} (par ${st.par}) status=${st.status}` +
    (st.deathMsg ? ` (${st.deathMsg})` : '') +
    ` endpos=(${st.player.x},${st.player.y})`
  );
  ok ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
