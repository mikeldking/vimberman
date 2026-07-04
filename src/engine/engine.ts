// Vimberman — game engine. Pure logic, no DOM; the UI layer supplies fx hooks.
import { mulberry32 } from './rng';
import type {
  Bomb, Enemy, FindMemo, FxHooks, GameState, ItemType, LevelDef, Linter,
  LinterState, Terminal, VocabGroup,
} from './types';

const SOLID: Record<string, 1> = { '#': 1, '%': 1, '&': 1, '!': 1 };
const ONEWAY: Record<string, [number, number]> = {
  '<': [-1, 0], '>': [1, 0], '^': [0, -1], V: [0, 1],
};
const ITEMS: Record<string, ItemType> = { K: 'K', R: 'R', U: 'U', B: 'B' };
const isLetter = (c: string): boolean => c >= 'a' && c <= 'z';

// fx hooks — the UI overrides these; the engine works headless with no-ops.
export const fx: FxHooks = {
  error() {}, moved() {}, bomb() {}, explosion() {}, solved() {},
  item() {}, rescue() {}, death() {}, win() {}, fail() {}, wantPause() {},
  enterTerm() {}, exitTerm() {}, telegraph() {}, tick() {}, collectBush() {},
  flip() {}, squash() {}, sweep() {}, rise() {}, drop() {}, keycap() {}, locked() {},
};

let LEVEL_SET: LevelDef[] = [];
let st: GameState | null = null;

export function setLevels(levels: LevelDef[]): void {
  LEVEL_SET = levels;
}
export function getLevels(): LevelDef[] {
  return LEVEL_SET;
}
export function state(): GameState {
  if (!st) throw new Error('no level loaded');
  return st;
}
export function loaded(): boolean {
  return st !== null;
}

// ---------- motion vocabulary (keycap unlocks) ----------
// null = everything unlocked (headless/tests default). The UI opts in with
// the save's collected keycap groups; `?` tiles add to the set via enterTile.
let vocab: Set<VocabGroup> | null = null;

export function setVocab(groups: Set<VocabGroup> | null): void {
  vocab = groups;
}
export function getVocab(): Set<VocabGroup> | null {
  return vocab;
}

/** Display metadata for the HUD keycap tray, in campaign order. */
export const VOCAB_GROUPS: Array<{ id: VocabGroup; label: string }> = [
  { id: 'core', label: 'hjkl' },
  { id: 'count', label: '1-9' },
  { id: 'find', label: 'f t' },
  { id: 'edit', label: 'i' },
  { id: 'word', label: 'w b e' },
  { id: 'line', label: '0 $ G' },
  { id: 'cw', label: 'cw' },
  { id: 'inner', label: '~ ciw' },
  { id: 'sky', label: '^U ^D' },
];

const LOCKED_ECHO: Record<VocabGroup, (k: string) => string> = {
  core: () => 'E: unmapped',
  count: () => 'E: counts — unmapped. level 2 teaches you to count.',
  find: (k) => `E: '${k}' — unmapped. its keycap is lying around on level 3.`,
  edit: () => "E: 'i' — unmapped. you learn to edit on level 4. terrifying, I know.",
  word: (k) => `E: '${k}' — unmapped. that keycap ships with level 5.`,
  line: (k) => `E: '${k}' — unmapped. level 6 sells the long-distance plan.`,
  cw: () => "E: 'c' — unmapped. rewriting words is a level 8 privilege.",
  inner: (k) => `E: '${k}' — unmapped. level 11. patience.`,
  sky: () => 'E: the sky is a level 12 feature.',
};

const KEYCAP_INSTALLED: Record<VocabGroup, string> = {
  core: 'keycap [hjkl] installed — your starter kit',
  count: 'keycap [1-9] installed — ten moves, one turn',
  find: 'keycap [f t] installed — dash to any letter',
  edit: 'keycap [i] installed — i opens code-tiles',
  word: 'keycap [w b e] installed — words are load-bearing now',
  line: 'keycap [0 $ G] installed — whole rows in one key',
  cw: 'keycap [cw] installed — some words deserve it',
  inner: 'keycap [~ ciw] installed — surgical',
  sky: 'keycap [^U ^D] installed — the ceiling was a lie',
};

// which group (if any) a key needs and lacks right now; null = allowed
function lockedGroup(k: string): VocabGroup | null {
  if (!vocab || !st) return null;
  const s = st;
  const need = (g: VocabGroup): VocabGroup | null => (vocab!.has(g) ? null : g);
  if (s.mode === 'terminal') {
    const T = s.term!;
    if (T.insert) return null;
    const P = T.pending;
    if (P.op === 'r') return null;
    if (P.op === 'c' && k === 'i') return need('inner');
    if (P.op === 'c' || P.op === 'ci') return null;
    if (k === 'c') return need('cw');
    if (k === '~') return need('inner');
    if (k >= '1' && k <= '9') return need('count');
    return null;
  }
  const P = s.pending;
  if (P.op && 'fFtT'.includes(P.op)) return null; // char argument to a vetted find
  if (P.op === 'g') return null;
  if (k >= '1' && k <= '9') return need('count');
  if (k === '0' && P.count) return need('count');
  if (k.length === 1 && 'fFtT;,'.includes(k)) return need('find');
  if (k === 'i') return need('edit');
  if (k === 'w' || k === 'b' || k === 'e') return need('word');
  if (k === '0' || k === '$' || k === 'g' || k === 'G') return need('line');
  if (k === '<C-u>' || k === '<C-d>') return need('sky');
  return null;
}

// ---------- level loading ----------
export function loadLevel(idx: number): GameState {
  const lv = LEVEL_SET[idx];
  const grid = lv.map.map((r) => r.split(''));
  const H = grid.length;
  const W = grid[0].length;
  const enemies: Enemy[] = [];
  let player: { x: number; y: number } | null = null;
  const linters: Linter[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = grid[y][x];
      const key = x + ',' + y;
      const opts = (lv.enemyOpts ?? {})[key] ?? {};
      if (c === 'P') { player = { x, y }; grid[y][x] = '.'; }
      if (c === 'Z') { enemies.push({ type: 'zombie', x, y, phase: enemies.length, ...opts }); grid[y][x] = '.'; }
      if (c === 'I') { enemies.push({ type: 'imp', x, y, sinceBomb: 0, ...opts }); grid[y][x] = '.'; }
      if (c === 'M') { enemies.push({ type: 'mage', x, y, mstate: 'cool', timer: 3, target: null, immune: false, ...opts }); grid[y][x] = '.'; }
      if (c === 'Q') { enemies.push({ type: 'toad', x, y, hop: 3, flip: 0, ...opts }); grid[y][x] = '.'; }
      if (c === '!') {
        const cfg = (lv.linters ?? {})[key] ?? {};
        linters.push({ x, y, period: cfg.period ?? 6, warn: cfg.warn ?? 2, phase: cfg.phase ?? 0 });
      }
      if (c === '?') {
        const group = (lv.keycaps ?? {})[key];
        if (vocab && group && vocab.has(group)) grid[y][x] = '.'; // already owned — no theater
      }
    }
  }
  if (!player) throw new Error(`level ${idx + 1} has no player start`);
  let skyGrid: string[][] | null = null;
  if (lv.sky) {
    if (lv.sky.length !== H || lv.sky.some((r) => r.length !== W)) {
      throw new Error(`level ${idx + 1} sky layer does not match map dimensions`);
    }
    skyGrid = lv.sky.map((r) => r.split(''));
  }
  const terminals: Record<string, Terminal> = {};
  for (const k in lv.terminals) {
    const t = lv.terminals[k];
    terminals[k] = {
      key: k, broken: t.broken, target: t.target, grants: t.grants, hint: t.hint,
      buffer: t.broken.split(''), cursor: 0, solved: false,
    };
  }
  st = {
    idx, lv, grid, skyGrid, layer: 'ground', W, H,
    player: { ...player, bombs: 0, radius: 2, undo: 3, iframes: 0 },
    enemies, bombs: [], projectiles: [], terminals, linters,
    keys: 0, tick: 0, limit: lv.limit, par: lv.par,
    mode: 'normal', term: null,
    pending: { count: '', op: null },
    lastFind: null, lastCmd: '', echo: '',
    status: 'play', deathMsg: '',
    rng: mulberry32(0x9e3779b9 ^ (idx * 2654435761)),
    history: [],
    explosionsThisTick: [],
    bonks: 0, cmdCounts: {},
  };
  pushSnap();
  return st;
}

// ---------- snapshots / undo ----------
function snap(): string {
  const s = state();
  const terms: Record<string, { buffer: string[]; cursor: number; solved: boolean }> = {};
  for (const k in s.terminals) {
    const t = s.terminals[k];
    terms[k] = { buffer: t.buffer.slice(), cursor: t.cursor, solved: t.solved };
  }
  return JSON.stringify({
    grid: s.grid.map((r) => r.join('')),
    sky: s.skyGrid ? s.skyGrid.map((r) => r.join('')) : null,
    layer: s.layer,
    p: s.player, en: s.enemies, bo: s.bombs, pr: s.projectiles,
    terms, tick: s.tick, limit: s.limit,
  });
}
function pushSnap(): void {
  const s = state();
  s.history.push(snap());
  if (s.history.length > 80) s.history.shift();
}
function restore(raw: string): void {
  const s = state();
  const d = JSON.parse(raw);
  s.grid = d.grid.map((r: string) => r.split(''));
  s.skyGrid = d.sky ? d.sky.map((r: string) => r.split('')) : null;
  s.layer = d.layer ?? 'ground';
  s.player = d.p; s.enemies = d.en; s.bombs = d.bo; s.projectiles = d.pr;
  s.tick = d.tick; s.limit = d.limit;
  for (const k in d.terms) Object.assign(s.terminals[k], d.terms[k]);
}
function worldUndo(): void {
  const s = state();
  if (s.player.undo < 1 || s.history.length < 2) { bonk('nothing to undo'); return; }
  const u = s.player.undo;
  s.history.pop();
  restore(s.history[s.history.length - 1]);
  s.player.undo = u - 1;
  s.mode = 'normal'; s.term = null;
  s.echo = 'rewound one tick';
  fx.rescue();
}

// ---------- queries ----------
// `at` reads the GROUND grid — enemies, bombs and blasts live there.
const at = (x: number, y: number): string => (state().grid[y] ? state().grid[y][x] ?? '#' : '#');
// `pat` reads the grid of the layer the PLAYER currently occupies.
const pat = (x: number, y: number): string => {
  const s = state();
  const g = s.layer === 'sky' ? s.skyGrid! : s.grid;
  return g[y] ? g[y][x] ?? '#' : '#';
};
const enemyAt = (x: number, y: number): Enemy | undefined => state().enemies.find((e) => e.x === x && e.y === y);
const bombAt = (x: number, y: number): Bomb | undefined => state().bombs.find((b) => b.x === x && b.y === y);
const onPlayer = (x: number, y: number): boolean => state().player.x === x && state().player.y === y;
const flippedToad = (e: Enemy): boolean => e.type === 'toad' && (e.flip ?? 0) > 0;

function onewayOk(c: string, dx: number, dy: number): boolean {
  const d = ONEWAY[c];
  return !d || (d[0] === dx && d[1] === dy);
}
// terrain the player may occupy when arriving with motion (dx,dy), on the player's layer
function terrainOk(x: number, y: number, dx: number, dy: number): boolean {
  const c = pat(x, y);
  if (SOLID[c] || c === '~') return false;
  if (!onewayOk(c, dx, dy)) return false;
  return true;
}
function enemyTerrainOk(x: number, y: number, dx: number, dy: number): boolean {
  const c = at(x, y);
  if (SOLID[c] || c === '~' || c === '*') return false;
  if (!onewayOk(c, dx, dy)) return false;
  if (bombAt(x, y)) return false;
  return true;
}

// ---------- entering a tile ----------
function enterTile(): void {
  const s = state();
  const p = s.player;
  const sky = s.layer === 'sky';
  const g = sky ? s.skyGrid! : s.grid;
  const c = g[p.y] ? g[p.y][p.x] ?? '#' : '#';
  const key = (sky ? 'sky:' : '') + p.x + ',' + p.y;
  if (c === '*') {
    const item = (s.lv.bushes ?? {})[key] ?? { type: 'K' as ItemType, amt: 5 };
    g[p.y][p.x] = '.';
    applyItem(item.type, item.amt);
    fx.collectBush(item.type);
  } else if (ITEMS[c]) {
    const item = (s.lv.bushes ?? {})[key];
    g[p.y][p.x] = '.';
    applyItem(ITEMS[c], item ? item.amt : 1);
  } else if (c === '?' && !sky) {
    const group = (s.lv.keycaps ?? {})[key];
    g[p.y][p.x] = '.';
    if (group) {
      if (vocab) vocab.add(group);
      s.echo = KEYCAP_INSTALLED[group];
      fx.keycap(group);
    }
  } else if (c === 'E' && !sky) {
    win();
  }
  // stepping off a bomb (or rising away from it) seals it
  for (const b of s.bombs) if (b.soft && !(s.layer === 'ground' && onPlayer(b.x, b.y))) b.soft = false;
}
function applyItem(type: ItemType, amt: number): void {
  const s = state();
  const p = s.player;
  if (type === 'K') { s.limit += amt; s.echo = '+' + amt + ' keystrokes'; }
  if (type === 'R') { p.radius += 1; s.echo = 'blast radius +1'; }
  if (type === 'U') { p.undo += 1; s.echo = '+1 undo charge'; }
  if (type === 'B') { p.bombs = Math.min(3, p.bombs + 1); s.echo = '+1 bomb'; }
  fx.item(type, amt);
}
function win(): void {
  const s = state();
  if (s.status !== 'play') return;
  s.status = 'won';
  fx.win();
}

// ---------- player hits / death ----------
function hitPlayer(msg: string): void {
  const s = state();
  if (s.status !== 'play') return;
  if (s.player.iframes > 0) return;
  s.status = 'dead';
  s.deathMsg = msg;
  fx.death(msg);
}
export function canRescue(): boolean {
  const s = state();
  return s.status === 'dead' && s.player.undo > 0 && s.history.length > 0;
}
// how far back rescue() is willing to dig for a snapshot with breathing room
const RESCUE_LOOKBACK = 20;
export function rescue(): void {
  const s = state();
  const u = s.player.undo;
  let idx = s.history.length - 1;
  let clear = false;
  const oldest = Math.max(0, s.history.length - 1 - RESCUE_LOOKBACK);
  for (let i = s.history.length - 1; i >= oldest; i--) {
    const d = JSON.parse(s.history[i]) as { p: { x: number; y: number }; en: Array<{ x: number; y: number }> };
    // "clear" = no enemy within a step of the player, so the grace window can't be closed instantly
    if (!d.en.some((e) => Math.abs(e.x - d.p.x) + Math.abs(e.y - d.p.y) <= 1)) { idx = i; clear = true; break; }
  }
  restore(s.history[idx]);
  s.history = s.history.slice(0, idx + 1);
  s.player.undo = u - 1;
  s.player.iframes = 3;
  s.status = 'play';
  s.mode = 'normal'; s.term = null;
  s.echo = clear ? 'rewound to clear ground — go!' : 'rewound — go!';
  fx.rescue();
}

// ---------- toads: squash & flip ----------
function squashToad(t: Enemy): void {
  const s = state();
  s.enemies = s.enemies.filter((e) => e !== t);
  s.limit += 2;
  s.echo = 'dead code removed — +2 keystrokes';
  fx.squash();
}
// flip every toad strictly inside the horizontal span (x0, x1) on row y
function flipToadsAlong(x0: number, x1: number, y: number): void {
  const s = state();
  if (s.layer !== 'ground') return;
  const [a, b] = x0 < x1 ? [x0, x1] : [x1, x0];
  let n = 0;
  for (const e of s.enemies) {
    // 7 because the flipping command's own tick decrements it immediately:
    // the player sees a 6-tick countdown, same rhythm as a bomb fuse
    if (e.type === 'toad' && e.y === y && e.x > a && e.x < b) { e.flip = 7; n++; }
  }
  if (n) {
    s.echo = n > 1 ? `${n} toads flipped — they hate that` : 'toad flipped — it hates that';
    fx.flip(n);
  }
}

// ---------- bombs & explosions ----------
function dropBomb(): void {
  const s = state();
  const p = s.player;
  if (s.layer === 'sky') { bonk('no bombs in the clouds'); return; }
  if (p.bombs < 1) { bonk('no bombs — fix a code-tile (T) with i'); return; }
  if (bombAt(p.x, p.y)) { bonk('already a bomb here'); return; }
  p.bombs--;
  s.bombs.push({ x: p.x, y: p.y, fuse: 6, r: p.radius, soft: true });
  s.lastCmd = 'x';
  fx.bomb();
  tick();
}
function blastTiles(bomb: Bomb, destroy: boolean, chainQ: Bomb[] | null): Array<[number, number]> {
  const s = state();
  const tiles: Array<[number, number]> = [[bomb.x, bomb.y]];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    for (let i = 1; i <= bomb.r; i++) {
      const x = bomb.x + dx * i;
      const y = bomb.y + dy * i;
      const c = at(x, y);
      if (c === '#' || c === '!') break;
      if (c === '&') {
        if (bomb.r >= 3) { tiles.push([x, y]); if (destroy) s.grid[y][x] = '.'; }
        break;
      }
      if (c === '%') { tiles.push([x, y]); if (destroy) s.grid[y][x] = '.'; break; }
      if (c === '*') {
        tiles.push([x, y]);
        if (destroy) {
          const item = (s.lv.bushes ?? {})[x + ',' + y];
          s.grid[y][x] = item ? item.type : 'K';
        }
        break;
      }
      tiles.push([x, y]);
      const b2 = bombAt(x, y);
      if (b2 && !b2.done) { if (chainQ && !chainQ.includes(b2)) chainQ.push(b2); break; }
    }
  }
  return tiles;
}
function explode(initial: Bomb[]): void {
  const s = state();
  const q = initial.slice();
  const all: Array<[number, number]> = [];
  while (q.length) {
    const b = q.shift()!;
    if (b.done) continue;
    b.done = true;
    all.push(...blastTiles(b, true, q));
  }
  s.bombs = s.bombs.filter((b) => !b.done);
  const hit = new Set(all.map(([x, y]) => x + ',' + y));
  s.enemies = s.enemies.filter((e) => {
    if (!hit.has(e.x + ',' + e.y)) return true;
    if (e.type === 'mage' && e.immune) return true;
    return false;
  });
  s.projectiles = s.projectiles.filter((p) => !hit.has(p.x + ',' + p.y));
  s.explosionsThisTick = all;
  s.history = []; // no undoing past a detonation
  fx.explosion(all);
  if (s.layer === 'ground' && hit.has(s.player.x + ',' + s.player.y)) hitPlayer('caught in the blast');
}
function pendingBlast(): Set<string> {
  const s = state();
  const set = new Set<string>();
  for (const b of s.bombs) {
    if (b.fuse > 2) continue;
    for (const [x, y] of blastTiles(b, false, null)) set.add(x + ',' + y);
  }
  return set;
}

// ---------- linters ----------
export function linterCycle(l: Linter): LinterState {
  const s = state();
  const pos = (((s.tick + l.phase) % l.period) + l.period) % l.period;
  if (pos === l.period - 1) return 'fire';
  if (pos >= l.period - 1 - l.warn) return 'warn';
  return 'idle';
}
// tiles the emitter's beam covers right now (stops at solids, skips margins)
export function linterTiles(l: Linter): Array<[number, number]> {
  const s = state();
  const out: Array<[number, number]> = [];
  for (const dir of [1, -1] as const) {
    for (let x = l.x + dir; x >= 0 && x < s.W; x += dir) {
      const c = at(x, l.y);
      if (SOLID[c]) break;
      if (c !== '|') out.push([x, l.y]);
    }
  }
  return out;
}
function sweepLinters(): void {
  const s = state();
  const firing = s.linters.filter((l) => linterCycle(l) === 'fire');
  if (!firing.length) return;
  const swept = new Set<string>();
  const all: Array<[number, number]> = [];
  for (const l of firing) {
    for (const t of linterTiles(l)) {
      if (!swept.has(t[0] + ',' + t[1])) { swept.add(t[0] + ',' + t[1]); all.push(t); }
    }
  }
  s.enemies = s.enemies.filter((e) => !swept.has(e.x + ',' + e.y));
  s.projectiles = s.projectiles.filter((p) => !swept.has(p.x + ',' + p.y));
  fx.sweep(all);
  if (s.layer === 'ground' && swept.has(s.player.x + ',' + s.player.y)) hitPlayer('swept by the linter');
}

// ---------- enemies ----------
function neighbors(e: Enemy): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (e.leash === 'row' && dy !== 0) continue;
    const x = e.x + dx;
    const y = e.y + dy;
    if (!enemyTerrainOk(x, y, dx, dy)) continue;
    if (enemyAt(x, y)) continue;
    out.push([x, y]);
  }
  return out;
}
function tryStep(e: Enemy, dx: number, dy: number): boolean {
  if (dx === 0 && dy === 0) return false;
  if (e.leash === 'row' && dy !== 0) return false;
  if (e.leash === 'col' && dx !== 0) return false;
  const x = e.x + dx;
  const y = e.y + dy;
  if (!enemyTerrainOk(x, y, dx, dy)) return false;
  if (enemyAt(x, y)) return false;
  e.x = x; e.y = y;
  return true;
}
// leashed enemies patrol a lane (row or column): sweep until blocked, then turn
function patrolTick(e: Enemy): void {
  e.dir = e.dir || -1;
  const vert = e.leash === 'col';
  for (const d of [e.dir, -e.dir]) {
    const x = e.x + (vert ? 0 : d);
    const y = e.y + (vert ? d : 0);
    if (enemyTerrainOk(x, y, vert ? 0 : d, vert ? d : 0) && !enemyAt(x, y)) {
      e.x = x; e.y = y; e.dir = d;
      return;
    }
  }
}
function zombieTick(e: Enemy): void {
  const s = state();
  if ((s.tick + (e.phase ?? 0)) % 2 !== 0) return;
  if (e.leash) { patrolTick(e); return; }
  const p = s.player;
  const dx = Math.sign(p.x - e.x);
  const dy = Math.sign(p.y - e.y);
  const horizFirst = Math.abs(p.x - e.x) >= Math.abs(p.y - e.y);
  const moves: Array<[number, number]> = horizFirst ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
  for (const [mx, my] of moves) if (tryStep(e, mx, my)) return;
}
function impTick(e: Enemy): void {
  const s = state();
  if (e.leash) { patrolTick(e); return; }
  e.sinceBomb = (e.sinceBomb ?? 0) + 1;
  const p = s.player;
  const danger = pendingBlast();
  if (danger.has(e.x + ',' + e.y)) {
    const ns = neighbors(e);
    const safe = ns.filter(([x, y]) => !danger.has(x + ',' + y));
    const pick = safe.length ? safe : ns;
    if (pick.length) { const [x, y] = pick[Math.floor(s.rng() * pick.length)]; e.x = x; e.y = y; }
    return;
  }
  const cheb = Math.max(Math.abs(p.x - e.x), Math.abs(p.y - e.y));
  if (!e.leash && s.layer === 'ground' && e.sinceBomb >= 6 && cheb <= 4 && neighbors(e).length >= 2 && !bombAt(e.x, e.y)) {
    s.bombs.push({ x: e.x, y: e.y, fuse: 4, r: 1, soft: false, imp: true });
    e.sinceBomb = 0;
  }
  const ns = neighbors(e);
  if (!ns.length) return;
  if (s.rng() < 0.6) {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (const [x, y] of ns) {
      const d = Math.abs(p.x - x) + Math.abs(p.y - y);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    e.x = best![0]; e.y = best![1];
  } else {
    const [x, y] = ns[Math.floor(s.rng() * ns.length)];
    e.x = x; e.y = y;
  }
}
function mageTick(e: Enemy): void {
  const s = state();
  e.immune = false;
  if (e.leash) { patrolTick(e); return; }
  const p = s.player;
  if (e.mstate === 'cool') {
    e.timer = (e.timer ?? 0) - 1;
    if (e.timer <= 0) e.mstate = 'tele';
  } else if (e.mstate === 'tele') {
    const spots: Array<[number, number]> = [];
    for (let y = 1; y < s.H - 1; y++) {
      for (let x = 1; x < s.W - 1; x++) {
        const c = at(x, y);
        const d = Math.abs(p.x - x) + Math.abs(p.y - y);
        if (d < 3 || d > 6) continue;
        if (x === p.x || y === p.y) continue; // never port onto the player's row/col
        if (!(c === '.' || isLetter(c))) continue;
        if (enemyAt(x, y) || bombAt(x, y) || onPlayer(x, y)) continue;
        spots.push([x, y]);
      }
    }
    if (spots.length) e.target = spots[Math.floor(s.rng() * spots.length)];
    if (e.target) { e.mstate = 'port'; fx.telegraph(e.target); }
    else { e.mstate = 'cool'; e.timer = 3; }
  } else if (e.mstate === 'port') {
    const [tx, ty] = e.target!;
    if (!enemyAt(tx, ty) && !bombAt(tx, ty) && !onPlayer(tx, ty)) { e.x = tx; e.y = ty; }
    e.target = null; e.immune = true;
    // fire along aligned axis, else the closer axis — but never at a player in the clouds
    if (s.layer === 'ground') {
      let dx = 0;
      let dy = 0;
      if (e.y === p.y) dx = Math.sign(p.x - e.x);
      else if (e.x === p.x) dy = Math.sign(p.y - e.y);
      else if (Math.abs(p.x - e.x) <= Math.abs(p.y - e.y)) dx = Math.sign(p.x - e.x);
      else dy = Math.sign(p.y - e.y);
      if (dx || dy) {
        const x = e.x + dx;
        const y = e.y + dy;
        const c = at(x, y);
        if (!SOLID[c] && !bombAt(x, y)) {
          if (onPlayer(x, y)) hitPlayer('zapped by a mage bolt');
          else s.projectiles.push({ x, y, dx, dy });
        }
      }
    }
    e.mstate = 'cool'; e.timer = 3;
  }
}
// toads: crouch two ticks, then hop up to 2 tiles (flying over anything non-solid)
function toadHop(e: Enemy, dx: number, dy: number): boolean {
  if (dx === 0 && dy === 0) return false;
  const ix = e.x + dx;
  const iy = e.y + dy;
  if (!SOLID[at(ix, iy)]) {
    const lx = e.x + 2 * dx;
    const ly = e.y + 2 * dy;
    if (enemyTerrainOk(lx, ly, dx, dy) && !enemyAt(lx, ly)) { e.x = lx; e.y = ly; return true; }
  }
  if (enemyTerrainOk(ix, iy, dx, dy) && !enemyAt(ix, iy)) { e.x = ix; e.y = iy; return true; }
  return false;
}
function toadTick(e: Enemy): void {
  const s = state();
  if ((e.flip ?? 0) > 0) {
    e.flip = e.flip! - 1;
    if (e.flip === 0) e.hop = 2; // wake crouch: it can never hop on the tick it rights itself
    return;
  }
  e.hop = (e.hop ?? 3) - 1;
  if (e.hop > 0) return;
  e.hop = 3;
  if (e.leash) {
    e.dir = e.dir || -1;
    const vert = e.leash === 'col';
    for (const d of [e.dir, -e.dir]) {
      if (toadHop(e, vert ? 0 : d, vert ? d : 0)) { e.dir = d; return; }
    }
    return;
  }
  const p = s.player;
  const dx = Math.sign(p.x - e.x);
  const dy = Math.sign(p.y - e.y);
  const horizFirst = Math.abs(p.x - e.x) >= Math.abs(p.y - e.y);
  const moves: Array<[number, number]> = horizFirst ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
  for (const [mx, my] of moves) if (toadHop(e, mx, my)) return;
}
function moveProjectiles(): void {
  const s = state();
  const keep: typeof s.projectiles = [];
  for (const pr of s.projectiles) {
    const x = pr.x + pr.dx;
    const y = pr.y + pr.dy;
    const c = at(x, y);
    if (SOLID[c] || bombAt(x, y)) continue;
    pr.x = x; pr.y = y;
    if (s.layer === 'ground' && onPlayer(x, y)) { hitPlayer('zapped by a mage bolt'); continue; }
    const e = enemyAt(x, y);
    if (e) { s.enemies = s.enemies.filter((z) => z !== e); continue; }
    keep.push(pr);
  }
  s.projectiles = keep;
}

// ---------- world tick ----------
function tick(): void {
  const s = state();
  if (s.status !== 'play') return;
  s.tick++;
  s.explosionsThisTick = [];
  for (const b of s.bombs) b.fuse--;
  const due = s.bombs.filter((b) => b.fuse <= 0);
  if (due.length) explode(due);
  if (s.status !== 'play') { fx.tick(); return; }
  moveProjectiles();
  if (s.status !== 'play') { fx.tick(); return; }
  sweepLinters();
  if (s.status !== 'play') { fx.tick(); return; }
  for (const e of s.enemies.slice()) {
    if (!s.enemies.includes(e)) continue;
    if (e.type === 'zombie') zombieTick(e);
    else if (e.type === 'imp') impTick(e);
    else if (e.type === 'toad') toadTick(e);
    else mageTick(e);
    if (s.status !== 'play') { fx.tick(); return; }
  }
  if (s.layer === 'ground') {
    for (const e of s.enemies) {
      if (onPlayer(e.x, e.y) && !flippedToad(e)) {
        hitPlayer('slain by the ' + e.type);
        if (s.status !== 'play') { fx.tick(); return; }
      }
    }
  }
  if (s.player.iframes > 0) s.player.iframes--;
  pushSnap();
  fx.tick();
}

function bonk(msg?: string): void {
  const s = state();
  s.echo = 'E: ' + (msg || 'cannot go there');
  s.bonks++;
  fx.error(msg);
  tick(); // spam is punished
}

// ---------- motions ----------
function singleStep(dx: number, dy: number): void {
  const s = state();
  const p = s.player;
  const x = p.x + dx;
  const y = p.y + dy;
  const ground = s.layer === 'ground';
  if (!terrainOk(x, y, dx, dy) || (ground && bombAt(x, y))) { bonk(); return; }
  const e = ground ? enemyAt(x, y) : undefined;
  if (e && !flippedToad(e)) { hitPlayer('walked into the ' + e.type); if (s.status === 'play') tick(); return; }
  if (e) squashToad(e);
  p.x = x; p.y = y;
  enterTile();
  fx.moved();
  if (s.status === 'play') tick();
}
function slide(dx: number, dy: number, max: number): void {
  const s = state();
  const p = s.player;
  let moved = 0;
  while (moved < max) {
    const x = p.x + dx;
    const y = p.y + dy;
    if (!terrainOk(x, y, dx, dy)) break;
    if (s.layer === 'ground') {
      if (bombAt(x, y)) break;
      const e = enemyAt(x, y);
      if (e) {
        if (!flippedToad(e)) break;
        squashToad(e);
      }
    }
    p.x = x; p.y = y; moved++;
    enterTile();
    if (s.status !== 'play') return; // won or died mid-slide
  }
  if (moved === 0) { bonk(); return; }
  fx.moved();
  tick();
}
// words = runs of adjacent letter tiles in the player's row (on the player's layer)
function rowWords(): Array<[number, number]> {
  const s = state();
  const y = s.player.y;
  const words: Array<[number, number]> = [];
  let start = -1;
  for (let x = 0; x <= s.W; x++) {
    const lt = x < s.W && isLetter(pat(x, y));
    if (lt && start < 0) start = x;
    if (!lt && start >= 0) { words.push([start, x - 1]); start = -1; }
  }
  return words;
}
function flightBlocked(x0: number, x1: number, y: number): boolean {
  const [a, b] = x0 < x1 ? [x0, x1] : [x1, x0];
  for (let x = a + 1; x < b; x++) if (SOLID[pat(x, y)]) return true;
  return false;
}
function landAt(x: number, y: number, dx: number, dy: number): boolean {
  const s = state();
  const p = s.player;
  const ground = s.layer === 'ground';
  const foe = ground ? enemyAt(x, y) : undefined;
  if (foe && !flippedToad(foe)) return false;
  if (!terrainOk(x, y, dx, dy) || (ground && bombAt(x, y))) return false;
  if (flightBlocked(p.x, x, y)) return false;
  flipToadsAlong(p.x, x, y); // the flight itself is the weapon
  if (foe) squashToad(foe);
  p.x = x; p.y = y;
  enterTile();
  fx.moved();
  if (s.status === 'play') tick();
  return true;
}
function wordMotion(kind: 'w' | 'b' | 'e', count: number): void {
  const s = state();
  const p = s.player;
  const words = rowWords();
  let cx = p.x;
  for (let n = 0; n < count; n++) {
    let t: number | null = null;
    if (kind === 'w') { for (const [ws] of words) if (ws > cx) { t = ws; break; } }
    else if (kind === 'e') { for (const [, we] of words) if (we > cx) { t = we; break; } }
    else { for (let i = words.length - 1; i >= 0; i--) if (words[i][0] < cx) { t = words[i][0]; break; } }
    if (t === null) { bonk('no word to ' + (kind === 'b' ? 'hop back to' : 'hop to')); return; }
    cx = t;
  }
  const dx = Math.sign(cx - p.x) || 1;
  if (!landAt(cx, p.y, dx, 0)) bonk('landing blocked');
}
function findMotion(cmd: FindMemo['cmd'], ch: string): void {
  const s = state();
  const p = s.player;
  const dir = cmd === 'f' || cmd === 't' ? 1 : -1;
  let target = -1;
  for (let x = p.x + dir; x > 0 && x < s.W - 1; x += dir) {
    if (pat(x, p.y) === ch) { target = x; break; }
  }
  if (target < 0) { bonk('no "' + ch + '" in this row'); return; }
  const land = cmd === 't' || cmd === 'T' ? target - dir : target;
  if (land === p.x) { bonk(); return; }
  s.lastFind = { cmd, ch };
  if (!landAt(land, p.y, dir, 0)) bonk('landing blocked');
}

// ---------- layer motions (the sky) ----------
function riseToSky(): void {
  const s = state();
  const p = s.player;
  if (!s.skyGrid) { bonk('no sky above this level'); return; }
  if (s.layer !== 'ground' || at(p.x, p.y) !== '@') { bonk('no updraft here'); return; }
  const c = s.skyGrid[p.y][p.x];
  if (SOLID[c] || c === '~') { bonk('the cloud is closed here'); return; }
  s.layer = 'sky';
  s.lastCmd = '^U';
  s.echo = 'aloft — Ctrl-d to drop';
  enterTile();
  fx.rise();
  if (s.status === 'play') tick();
}
function dropToGround(): void {
  const s = state();
  const p = s.player;
  if (s.layer !== 'sky') { bonk('already on the ground'); return; }
  const c = at(p.x, p.y);
  if (SOLID[c] || c === '~' || ONEWAY[c]) { bonk('nothing to land on'); return; }
  const foe = enemyAt(p.x, p.y);
  if (bombAt(p.x, p.y) || (foe && !flippedToad(foe))) { bonk("something's down there"); return; }
  s.layer = 'ground';
  s.lastCmd = '^D';
  if (foe) squashToad(foe);
  enterTile();
  fx.drop();
  if (s.status === 'play') tick();
}

// ---------- terminal (code-tile) editor ----------
function termAtPlayer(): Terminal | undefined {
  const s = state();
  if (s.layer !== 'ground') return undefined;
  return s.terminals[s.player.x + ',' + s.player.y];
}
function termValidate(t: Terminal): boolean {
  const s = state();
  if (t.buffer.join('') === t.target) {
    t.solved = true;
    s.player.bombs = Math.min(3, s.player.bombs + t.grants);
    s.mode = 'normal'; s.term = null;
    s.echo = '"' + t.target + '" — armed! +' + t.grants + ' bomb' + (t.grants > 1 ? 's' : '');
    fx.solved(t);
    return true;
  }
  return false;
}
function wordSpan(t: Terminal): [number, number] {
  // word under cursor: letters/digits run
  const isW = (c: string) => /[a-zA-Z0-9]/.test(c);
  let s = t.cursor;
  let e = t.cursor;
  if (!isW(t.buffer[s] || '')) return [s, s - 1];
  while (s > 0 && isW(t.buffer[s - 1])) s--;
  while (e < t.buffer.length - 1 && isW(t.buffer[e + 1])) e++;
  return [s, e];
}
function termKey(k: string): void {
  const s = state();
  const T = s.term!;
  const t = T.t;
  const done = () => { if (!termValidate(t)) tick(); };
  if (T.insert) {
    if (k === 'Escape') {
      T.insert = false;
      t.cursor = Math.max(0, t.cursor - 1);
      if (!termValidate(t)) tick();
      return;
    }
    if (k === 'Backspace') {
      if (t.cursor > 0) { t.buffer.splice(t.cursor - 1, 1); t.cursor--; }
      tick(); return;
    }
    if (k.length === 1) {
      t.buffer.splice(t.cursor, 0, k); t.cursor++;
      tick(); return;
    }
    return;
  }
  // normal sub-mode
  const P = T.pending;
  if (P.op === 'r') {
    P.op = null;
    if (k.length === 1) { if (t.buffer.length) t.buffer[t.cursor] = k; s.lastCmd = 'r' + k; done(); }
    return;
  }
  if (P.op === 'c') {
    if (k === 'w') {
      const [, e] = wordSpan(t);
      const end = Math.max(t.cursor, e);
      t.buffer.splice(t.cursor, end - t.cursor + 1);
      T.insert = true; P.op = null; s.lastCmd = 'cw';
      tick(); return;
    }
    if (k === 'i') { P.op = 'ci'; return; }
    P.op = null; s.echo = 'E: c needs w or iw'; fx.error(); return;
  }
  if (P.op === 'ci') {
    P.op = null;
    if (k === 'w') {
      const [ws, we] = wordSpan(t);
      if (we >= ws) { t.buffer.splice(ws, we - ws + 1); t.cursor = Math.min(ws, Math.max(0, t.buffer.length)); }
      T.insert = true; s.lastCmd = 'ciw';
      tick(); return;
    }
    s.echo = 'E: ci needs w'; fx.error(); return;
  }
  if ((k >= '1' && k <= '9') || (k === '0' && P.count)) { P.count += k; return; }
  const n = Math.max(1, parseInt(P.count || '1', 10));
  P.count = '';
  const clamp = () => { t.cursor = Math.max(0, Math.min(t.buffer.length - 1, t.cursor)); };
  switch (k) {
    case 'h': t.cursor -= n; clamp(); tick(); break;
    case 'l': t.cursor += n; clamp(); tick(); break;
    case '0': t.cursor = 0; tick(); break;
    case '$': t.cursor = Math.max(0, t.buffer.length - 1); tick(); break;
    case 'x': t.buffer.splice(t.cursor, n); clamp(); s.lastCmd = 'x'; done(); break;
    case 'r': P.op = 'r'; break;
    case '~': {
      for (let i = 0; i < n && t.cursor < t.buffer.length; i++) {
        const c = t.buffer[t.cursor];
        t.buffer[t.cursor] = c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase();
        if (t.cursor < t.buffer.length - 1) t.cursor++;
      }
      s.lastCmd = '~'; done(); break;
    }
    case 's': t.buffer.splice(t.cursor, 1); T.insert = true; s.lastCmd = 's'; tick(); break;
    case 'c': P.op = 'c'; break;
    case 'i': T.insert = true; tick(); break;
    case 'a': t.cursor = Math.min(t.buffer.length, t.cursor + 1); T.insert = true; tick(); break;
    case 'A': t.cursor = t.buffer.length; T.insert = true; tick(); break;
    case 'u': worldUndo(); break;
    case 'Escape': s.mode = 'normal'; s.term = null; fx.exitTerm(); break;
    default:
      s.echo = 'E: not an edit command'; fx.error();
  }
}

// ---------- top-level key handling ----------
export function key(k: string): void {
  if (!st) return;
  const s = st;
  if (s.status === 'dead') {
    if (k === 'u' && canRescue()) { s.keys++; rescue(); }
    return; // r / Escape handled by UI
  }
  if (s.status !== 'play') return;

  // Escape with nothing pending = pause request (free)
  if (k === 'Escape' && s.mode === 'normal' && !s.pending.count && !s.pending.op) {
    fx.wantPause(); return;
  }
  if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta') return;

  // a locked key is not in your language yet — free, no tick, like arrow keys
  const lg = lockedGroup(k);
  if (lg) {
    s.echo = LOCKED_ECHO[lg](k);
    fx.locked(k);
    return;
  }

  s.keys++;
  if (s.mode === 'terminal') {
    termKey(k);
  } else {
    normalKey(k);
  }
  if (s.status === 'play' && s.keys >= s.limit) {
    s.status = 'fail';
    fx.fail();
  }
}

function normalKey(k: string): void {
  const s = state();
  const P = s.pending;
  const note = (name: string) => { s.cmdCounts[name] = (s.cmdCounts[name] ?? 0) + 1; };
  if (P.op === 'g') {
    P.op = null;
    if (k === 'g') { s.lastCmd = 'gg'; note('gg'); slide(0, -1, Infinity); }
    else { s.echo = 'E: g?'; fx.error(); }
    return;
  }
  if (P.op && 'fFtT'.includes(P.op)) {
    const op = P.op as FindMemo['cmd'];
    P.op = null; P.count = '';
    if (k.length === 1) { s.lastCmd = op + k; note(op); findMotion(op, k); }
    return;
  }
  if (k === 'Escape') { P.count = ''; P.op = null; s.echo = ''; return; }
  if ((k >= '1' && k <= '9') || (k === '0' && P.count)) { P.count += k; return; }

  const n = Math.max(1, parseInt(P.count || '1', 10));
  const counted = !!P.count;
  P.count = '';
  const step = (dx: number, dy: number, name: string) => {
    s.lastCmd = (counted ? n : '') + name;
    note(counted ? n + name : name);
    if (n === 1 && !counted) singleStep(dx, dy);
    else slide(dx, dy, n);
  };
  switch (k) {
    case 'h': step(-1, 0, 'h'); break;
    case 'j': step(0, 1, 'j'); break;
    case 'k': step(0, -1, 'k'); break;
    case 'l': step(1, 0, 'l'); break;
    case '0': s.lastCmd = '0'; note('0'); slide(-1, 0, Infinity); break;
    case '$': s.lastCmd = '$'; note('$'); slide(1, 0, Infinity); break;
    case 'G': s.lastCmd = 'G'; note('G'); slide(0, 1, Infinity); break;
    case 'g': P.op = 'g'; break;
    case 'w': s.lastCmd = (counted ? n : '') + 'w'; note('w'); wordMotion('w', n); break;
    case 'b': s.lastCmd = (counted ? n : '') + 'b'; note('b'); wordMotion('b', n); break;
    case 'e': s.lastCmd = (counted ? n : '') + 'e'; note('e'); wordMotion('e', n); break;
    case 'f': case 'F': case 't': case 'T': P.op = k; break;
    case ';':
      if (s.lastFind) { note(';'); findMotion(s.lastFind.cmd, s.lastFind.ch); }
      else { s.echo = 'E: no find to repeat'; fx.error(); }
      break;
    case ',': {
      if (s.lastFind) {
        const inv = ({ f: 'F', F: 'f', t: 'T', T: 't' } as const)[s.lastFind.cmd];
        const keep = s.lastFind;
        note(',');
        findMotion(inv, keep.ch);
        s.lastFind = keep;
      } else { s.echo = 'E: no find to repeat'; fx.error(); }
      break;
    }
    case 'x': note('x'); dropBomb(); break;
    case 'u': note('u'); worldUndo(); break;
    case '<C-u>': note('^U'); riseToSky(); break;
    case '<C-d>': note('^D'); dropToGround(); break;
    case 'i': {
      const t = termAtPlayer();
      if (t && !t.solved) {
        note('i');
        s.mode = 'terminal';
        s.term = { t, insert: false, pending: { count: '', op: null } };
        fx.enterTerm(t);
        tick();
      } else bonk(t ? 'already fixed' : 'nothing to edit here — find a T tile');
      break;
    }
    default:
      s.echo = 'E: "' + k + '" is not a motion';
      fx.error();
  }
}

/** Test-only introspection helpers. */
export const _internals = {
  blastTiles: (b: Bomb) => blastTiles(b, false, null),
  pendingBlast,
};
