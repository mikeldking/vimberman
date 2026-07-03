// UI smoke test: boots ui.js against a stub DOM, navigates menus with vim keys,
// plays level 1 via the real keydown handler, and asserts the clear screen + save.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);

// ---- stubs ----
function makeEl() {
  return {
    textContent: '', innerHTML: '', className: '', style: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
  };
}
const anyFn = new Proxy(function () {}, { get: () => anyFn, apply: () => anyFn });
const ctx2d = new Proxy({}, {
  get: (t, p) => (typeof p === 'string' ? (t[p] ??= () => {}) : undefined),
  set: () => true,
});
const els = {};
const canvasEl = { ...makeEl(), width: 0, height: 0, getContext: () => ctx2d };
const listeners = {};
global.window = globalThis;
global.document = {
  getElementById: (id) => (id === 'game' ? canvasEl : (els[id] ??= makeEl())),
};
window.addEventListener = (ev, fn) => { listeners[ev] = fn; };
const store = {};
global.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
};
global.AudioContext = function () {
  return new Proxy({ state: 'running', currentTime: 0, sampleRate: 44100, destination: {} }, {
    get: (t, p) => (p in t ? t[p] : (...a) => new Proxy({ getChannelData: () => new Float32Array(16), gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(x) { return this; }, start() {}, stop() {} }, { get: (tt, pp) => pp in tt ? tt[pp] : (() => {}) })),
  });
};
let rafCb = null;
global.requestAnimationFrame = (fn) => { rafCb = fn; return 1; };

// ---- load game ----
require('../levels.js');
global.LEVELS = require('../levels.js').LEVELS;
const VB = require('../engine.js');
global.VB = VB;
require('../ui.js');

const key = (k) => listeners.keydown({ key: k, preventDefault() {}, metaKey: false, ctrlKey: false });
const frames = (n) => { for (let i = 0; i < n; i++) rafCb && rafCb(performance.now() + i * 16); };

let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};

// title -> select -> intro -> game
frames(2);
check(els.panel.innerHTML.includes('PLAY'), 'title screen shows');
key('j'); key('k'); key('Enter');
check(els.panel.innerHTML.includes('SELECT LEVEL'), 'level select opens');
check(els.panel.innerHTML.includes('LOCKED'), 'later levels locked');
key('Enter');
check(els.panel.innerHTML.includes('LEVEL 01'), 'intro card for level 1');
key('Enter');
check(els.overlay.classList.contains('hidden'), 'game started, overlay hidden');
frames(5);

// arrow key should nag, not move
const px = VB.state.player.x;
key('ArrowRight');
check(VB.state.player.x === px && VB.state.keys === 0, 'arrow keys ignored + free');

// play the real solution
const sol = 'jjjjjjllllkklljjllkkkkhhkkllll jjjjjj'.replace(/ /g, '');
for (const k of sol) key(k);
frames(30);
check(VB.state.status === 'won', 'level 1 won through UI input');
await new Promise((r) => setTimeout(r, 500)); // showClear fires on a 350ms delay
check(els.panel.innerHTML.includes('LEVEL CLEAR'), 'clear screen shows');
check(els.panel.innerHTML.includes('★'), 'stars awarded');
const saved = JSON.parse(store['vimberman.save.v1']);
check(saved.unlocked === 2, 'level 2 unlocked in save');
check(saved.levels['1'].bestKeys === 36, 'best keys recorded (36)');

// next level flow + terminal editing on level 4 quickly
key('Enter');
check(els.panel.innerHTML.includes('LEVEL 02'), 'advanced to level 2 intro');
key('Escape');
// unlock all for a terminal test
VB.loadLevel(3); // level 4 internally
els.overlay.classList.add('hidden');
// walk to terminal (3,3) and edit — direct engine drive for terminal UI check
'4l jj hh'.split(' ').join('').split('').forEach((k) => VB.key(k));
VB.key('i');
frames(2);
check(VB.state.mode === 'terminal', 'terminal opens on i');
check(!els.termbox.classList.contains('hidden'), 'terminal box visible');
VB.key('l'); VB.key('r'); VB.key('o');
frames(2);
check(VB.state.player.bombs === 1, 'bpmb fixed -> bomb armed');
check(VB.state.mode === 'normal', 'terminal auto-closes on solve');

// pause menu
// (screen is GAME only in UI's mind if we went through startLevel; skip deep pause test)

console.log(failures ? `\n${failures} FAILURES` : '\nUI SMOKE OK');
process.exit(failures ? 1 : 0);
