// Vimberman — game engine. Pure logic, no DOM; the UI layer supplies fx hooks.
import { mulberry32 } from './rng';
import type {
  Bomb, BombKind, Enemy, FindMemo, FxHooks, GameState, ItemType, LevelDef,
  Linter, LinterState, Terminal, TermSession, VocabGroup,
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
  coin() {}, termReset() {}, sed() {}, cut() {},
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
  { id: 'mark', label: 'm `' },
  { id: 'match', label: '%' },
  { id: 'dot', label: '.' },
  { id: 'search', label: '/ n' },
  { id: 'macro', label: 'q @' },
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
  mark: () => "E: 'm' — unmapped. bookmarks are a later chapter.",
  match: () => "E: '%' — unmapped. its keycap is waiting between two brackets.",
  dot: () => "E: '.' — unmapped. first learn the edits worth repeating.",
  search: () => "E: '/' — unmapped. grep is earned.",
  macro: (k) => `E: '${k}' — unmapped. automation is the last lesson.`,
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
  mark: 'keycap [m `] installed — the file remembers where you\'ve been',
  match: 'keycap [%] installed — every bracket has a partner',
  dot: 'keycap [.] installed — do it again, for one key',
  search: 'keycap [/ n] installed — the whole file is one hop away',
  macro: 'keycap [q @] installed — teach the file to play itself',
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
    if (P.op === 'r' || P.op === 'f' || P.op === 'F') return null; // char arguments
    if (P.op === 'c' && k === 'i') return need('inner');
    if (P.op === 'c' || P.op === 'ci') return null;
    if (k === 'c') return need('cw');
    if (k === '~') return need('inner');
    if (k === 'f' || k === 'F' || k === ';') return need('find');
    if (k === 'w' || k === 'b' || k === 'e') return need('word');
    if (k >= '1' && k <= '9') return need('count');
    if (k === '.') return need('dot');
    return null;
  }
  const P = s.pending;
  if (P.op && 'fFtT'.includes(P.op)) return null; // char argument to a vetted find
  if (P.op === 'g' || P.op === 'm' || P.op === '`' || P.op === 'q' || P.op === '@') return null;
  if (k >= '1' && k <= '9') return need('count');
  if (k === '0' && P.count) return need('count');
  if (k.length === 1 && 'fFtT;,'.includes(k)) return need('find');
  if (k === 'i') return need('edit');
  if (k === 'w' || k === 'b' || k === 'e') return need('word');
  if (k === '0' || k === '$' || k === 'g' || k === 'G') return need('line');
  if (k === '<C-u>' || k === '<C-d>') return need('sky');
  if (k === 'm' || k === '`') return need('mark');
  if (k === '%') return need('match');
  if (k === '.') return need('dot');
  if (k === '/' || k === 'n') return need('search');
  if (k === 'q' || k === '@') return need('macro');
  return null;
}

// ---------- level loading ----------
// bracket-pair doors (docs/motions-v2.md §2): each kind must appear exactly
// 0 or 2 times per layer (one opener, one closer) so `%` is never ambiguous
const BRACKET_KINDS: Array<[string, string]> = [['(', ')'], ['[', ']'], ['{', '}']];
function buildPairs(idx: number, grid: string[][], layer: 'ground' | 'sky', pairs: Record<string, string>): void {
  const found: Record<string, Array<[number, number]>> = {};
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const c = grid[y][x];
      if ('()[]{}'.includes(c)) (found[c] ??= []).push([x, y]);
    }
  }
  for (const [open, close] of BRACKET_KINDS) {
    const o = found[open] ?? [];
    const c = found[close] ?? [];
    if (!o.length && !c.length) continue;
    if (o.length !== 1 || c.length !== 1) {
      throw new Error(`level ${idx + 1}: bracket pair ${open}${close} must appear exactly once each on the ${layer} layer`);
    }
    pairs[layer + ':' + o[0][0] + ',' + o[0][1]] = c[0][0] + ',' + c[0][1];
    pairs[layer + ':' + c[0][0] + ',' + c[0][1]] = o[0][0] + ',' + o[0][1];
  }
}

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
  const pairs: Record<string, string> = {};
  buildPairs(idx, grid, 'ground', pairs);
  if (skyGrid) buildPairs(idx, skyGrid, 'sky', pairs);
  if (skyGrid) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (skyGrid[y][x] === 'Y') {
          const opts = (lv.enemyOpts ?? {})[x + ',' + y] ?? {};
          enemies.push({ type: 'kite', x, y, aloft: true, ...opts });
          skyGrid[y][x] = '.';
        }
      }
    }
  }
  const terminals: Record<string, Terminal> = {};
  for (const k in lv.terminals) {
    const t = lv.terminals[k];
    const word = t.target ?? '';
    terminals[k] = {
      key: k, kind: t.kind ?? 'fix', broken: t.broken, target: word,
      glitch: t.glitch ?? '#', coin: t.coin ?? 'o',
      deadline: t.deadline ?? 8, strokes: t.strokes ?? 8,
      grants: t.grants, hint: t.hint,
      arms: t.arms ?? (word === 'grep' || word === 'sed' ? word : 'bomb'),
      buffer: t.broken.split(''), cursor: 0, solved: false,
    };
  }
  st = {
    idx, lv, grid, skyGrid, layer: 'ground', W, H,
    player: { ...player, arsenal: [], bombs: 0, radius: 2, undo: 3, iframes: 0 },
    enemies, bombs: [], projectiles: [], terminals, linters,
    keys: 0, tick: 0, limit: lv.limit, par: lv.par,
    mode: 'normal', term: null,
    pending: { count: '', op: null },
    lastFind: null, marks: {}, marksWiped: false, pairs, lastEdit: null,
    searchBuf: null, lastSearch: null,
    registers: {}, recording: null, lastMacro: null,
    lastCmd: '', echo: '',
    status: 'play', deathMsg: '',
    rng: mulberry32(0x9e3779b9 ^ ((lv.seed ?? idx) * 2654435761)),
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
    terms, tick: s.tick, limit: s.limit, marks: s.marks, le: s.lastEdit,
    ls: s.lastSearch, reg: s.registers, lm: s.lastMacro,
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
  s.tick = d.tick; s.limit = d.limit; s.marks = d.marks ?? {};
  s.lastEdit = d.le ?? null;
  s.lastSearch = d.ls ?? null;
  s.registers = d.reg ?? {};
  s.lastMacro = d.lm ?? null;
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
// ground entities only — every legacy call site is ground-semantic
const enemyAt = (x: number, y: number): Enemy | undefined =>
  state().enemies.find((e) => !e.aloft && e.x === x && e.y === y);
const kiteAt = (x: number, y: number): Enemy | undefined =>
  state().enemies.find((e) => e.aloft && e.x === x && e.y === y);
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
  // arrows are layer-scoped (docs/new-mechanics.md §5a): ground = one-way
  // doors; sky = wind, standable from any direction
  if (state().layer === 'ground' && !onewayOk(c, dx, dy)) return false;
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
  } else if (c === 'E') {
    win(); // ground or sky — v2 allows winning aloft (the export)
  }
  // stepping off a bomb (or rising away from it) seals it
  for (const b of s.bombs) if (b.soft && !(s.layer === 'ground' && onPlayer(b.x, b.y))) b.soft = false;
}
// push crafted bombs onto the typed FIFO queue, clamped at the carry cap
function grantBombs(kind: BombKind, n: number): void {
  const p = state().player;
  for (let i = 0; i < n && p.arsenal.length < 3; i++) p.arsenal.push(kind);
  p.bombs = p.arsenal.length;
}
function applyItem(type: ItemType, amt: number): void {
  const s = state();
  const p = s.player;
  if (type === 'K') { s.limit += amt; s.echo = '+' + amt + ' keystrokes'; }
  if (type === 'R') { p.radius += 1; s.echo = 'blast radius +1'; }
  if (type === 'U') { p.undo += 1; s.echo = '+1 undo charge'; }
  if (type === 'B') { grantBombs('bomb', 1); s.echo = '+1 bomb'; }
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
    const d = JSON.parse(s.history[i]) as {
      p: { x: number; y: number };
      en: Array<{ x: number; y: number; aloft?: boolean }>;
      layer?: string;
    };
    // "clear" = no same-layer enemy within a step of the player, so the
    // grace window can't be closed instantly
    const aloftThen = (d.layer ?? 'ground') === 'sky';
    if (!d.en.some((e) => (e.aloft ?? false) === aloftThen
      && Math.abs(e.x - d.p.x) + Math.abs(e.y - d.p.y) <= 1)) { idx = i; clear = true; break; }
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
  if (s.layer !== 'ground') {
    // aloft, the same swept interval cuts kite strings (§5b): killed
    // outright, no corpse, no refund — it was a comment
    const [a, b] = x0 < x1 ? [x0, x1] : [x1, x0];
    const cut = s.enemies.filter((e) => e.aloft && e.y === y && e.x > a && e.x < b);
    if (cut.length) {
      s.enemies = s.enemies.filter((e) => !cut.includes(e));
      s.echo = cut.length > 1 ? cut.length + ' strings cut' : 'string cut — the TODO drifts away';
      fx.cut(cut.length);
    }
    return;
  }
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
  if (p.arsenal.length < 1) { bonk('no bombs — fix a code-tile (T) with i'); return; }
  if (bombAt(p.x, p.y)) { bonk('already a bomb here'); return; }
  const kind = p.arsenal.shift()!;
  p.bombs = p.arsenal.length;
  s.bombs.push({ x: p.x, y: p.y, fuse: 6, r: p.radius, kind, soft: true });
  s.lastCmd = 'x';
  fx.bomb();
  tick();
}
function blastTiles(bomb: Bomb, destroy: boolean, chainQ: Bomb[] | null, sed = false): Array<[number, number]> {
  const s = state();
  const tiles: Array<[number, number]> = [[bomb.x, bomb.y]];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    for (let i = 1; i <= bomb.r; i++) {
      const x = bomb.x + dx * i;
      const y = bomb.y + dy * i;
      const c = at(x, y);
      if (c === '#' || c === '!') break;
      if (c === '&') {
        // s/rock/floor/ doesn't match granite — sed never cracks hard rock
        if (!sed && bomb.r >= 3) { tiles.push([x, y]); if (destroy) s.grid[y][x] = '.'; }
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
// grep line bomb: its whole row, both ways, exactly a linter beam — stops at
// solids, spares margins, kills occupants only (docs/arsenal.md §2)
function grepTiles(b: Bomb): Array<[number, number]> {
  const s = state();
  const out: Array<[number, number]> = [[b.x, b.y]];
  for (const dir of [1, -1] as const) {
    for (let x = b.x + dir; x >= 0 && x < s.W; x += dir) {
      const c = at(x, b.y);
      if (SOLID[c]) break;
      if (c !== '|') out.push([x, b.y]);
    }
  }
  return out;
}
function explode(initial: Bomb[]): void {
  const s = state();
  const q = initial.slice();
  const plus: Array<[number, number]> = [];
  const beams: Array<[number, number]> = [];
  const washes: Array<[number, number]> = [];
  while (q.length) {
    const b = q.shift()!;
    if (b.done) continue;
    b.done = true;
    // beams don't burn and washes don't either: neither grep nor sed
    // chains outward, but a plus-blast touching a placed one triggers it
    // (blastTiles pushes any discovered bomb into q)
    if (b.kind === 'grep') beams.push(...grepTiles(b));
    else if (b.kind === 'sed') washes.push(...blastTiles(b, true, null, true));
    else plus.push(...blastTiles(b, true, q));
  }
  s.bombs = s.bombs.filter((b) => !b.done);
  // sed tiles are deliberately NOT in the kill set — substitution, not fire
  const hit = new Set([...plus, ...beams].map(([x, y]) => x + ',' + y));
  s.enemies = s.enemies.filter((e) => {
    if (e.aloft) return true; // bombs are a ground phenomenon
    if (!hit.has(e.x + ',' + e.y)) return true;
    if (e.type === 'mage' && e.immune) return true;
    return false;
  });
  s.projectiles = s.projectiles.filter((p) => !hit.has(p.x + ',' + p.y));
  s.explosionsThisTick = plus;
  s.history = []; // no undoing past a detonation
  // the blast rearranges the file — bookmarks rot with the history
  if (Object.keys(s.marks).length) { s.marks = {}; s.marksWiped = true; }
  if (plus.length) fx.explosion(plus);
  if (beams.length) fx.sweep(beams);
  if (washes.length) fx.sed(washes);
  if (s.layer === 'ground' && hit.has(s.player.x + ',' + s.player.y)) hitPlayer('caught in the blast');
}
function pendingBlast(): Set<string> {
  const s = state();
  const set = new Set<string>();
  for (const b of s.bombs) {
    if (b.fuse > 2) continue;
    if (b.kind === 'sed') continue; // a sed can't hurt anyone — imps know it
    const tiles = b.kind === 'grep' ? grepTiles(b) : blastTiles(b, false, null);
    for (const [x, y] of tiles) set.add(x + ',' + y);
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
  s.enemies = s.enemies.filter((e) => e.aloft || !swept.has(e.x + ',' + e.y));
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
    s.bombs.push({ x: e.x, y: e.y, fuse: 4, r: 1, kind: 'bomb', soft: false, imp: true });
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
// kites (docs/new-mechanics.md §5b): full speed every tick, greedy chase,
// cross open air, blocked only by thunderheads. Wind never moves them.
function kiteOk(x: number, y: number): boolean {
  const s = state();
  const c = s.skyGrid && s.skyGrid[y] ? s.skyGrid[y][x] ?? '#' : '#';
  return c !== '#';
}
function kiteStep(e: Enemy, dx: number, dy: number): boolean {
  if (dx === 0 && dy === 0) return false;
  const x = e.x + dx;
  const y = e.y + dy;
  if (!kiteOk(x, y) || kiteAt(x, y)) return false;
  e.x = x;
  e.y = y;
  return true;
}
function kiteTick(e: Enemy): void {
  const s = state();
  if (e.leash) {
    e.dir = e.dir || -1;
    const vert = e.leash === 'col';
    for (const d of [e.dir, -e.dir]) {
      if (kiteStep(e, vert ? 0 : d, vert ? d : 0)) { e.dir = d; return; }
    }
    return;
  }
  const p = s.player;
  const dx = Math.sign(p.x - e.x);
  const dy = Math.sign(p.y - e.y);
  const horizFirst = Math.abs(p.x - e.x) >= Math.abs(p.y - e.y);
  const moves: Array<[number, number]> = horizFirst ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
  for (const [mx, my] of moves) if (kiteStep(e, mx, my)) return;
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
// true while @{a} is re-feeding recorded commands through normalKey — the
// whole replay is ONE enemy turn, so per-command ticks are suppressed
let macroReplaying = false;
let macroAborted = false;

function tick(): void {
  if (macroReplaying) return;
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
    else if (e.type === 'kite') kiteTick(e);
    else mageTick(e);
    if (s.status !== 'play') { fx.tick(); return; }
  }
  // contact is same-layer only: kites touch aloft players, walkers grounded
  for (const e of s.enemies) {
    if ((e.aloft ?? false) !== (s.layer === 'sky')) continue;
    if (onPlayer(e.x, e.y) && !flippedToad(e)) {
      hitPlayer('slain by the ' + e.type);
      if (s.status !== 'play') { fx.tick(); return; }
    }
  }
  if (s.player.iframes > 0) s.player.iframes--;
  windDrift();
  if (s.status !== 'play') { fx.tick(); return; } // drifted onto a sky exit
  pushSnap();
  fx.tick();
}

// wind (docs/new-mechanics.md §5a): standing on a sky arrow at tick-end
// drifts you one tile with the current. Pinned (no move, no damage) if the
// push target is solid or open air — wind is a current, not a cliff.
function windDrift(): void {
  const s = state();
  if (s.layer !== 'sky' || !s.skyGrid) return;
  const p = s.player;
  const d = ONEWAY[s.skyGrid[p.y] ? s.skyGrid[p.y][p.x] ?? '' : ''];
  if (!d) return;
  const x = p.x + d[0];
  const y = p.y + d[1];
  const t = s.skyGrid[y] ? s.skyGrid[y][x] ?? '#' : '#';
  if (SOLID[t] || t === '~') return;
  p.x = x;
  p.y = y;
  enterTile();
  fx.moved();
}

function bonk(msg?: string): void {
  const s = state();
  s.echo = 'E: ' + (msg || 'cannot go there');
  s.bonks++;
  fx.error(msg);
  if (macroReplaying) macroAborted = true; // vim stops a macro on error
  tick(); // spam is punished
}

// ---------- macros (docs/motions-v2.md §5) ----------
// recording start/stop are free annotation; replay = 2 keys, ONE tick total
function startRecording(ch: string): void {
  const s = state();
  if (!(ch.length === 1 && ch >= 'a' && ch <= 'z')) {
    s.echo = 'E: registers are letters a-z';
    fx.error();
    return;
  }
  s.recording = { reg: ch, keys: [] };
  s.echo = 'recording @' + ch + ' — q to stop';
}
function stopRecording(): void {
  const s = state();
  const r = s.recording!;
  s.recording = null;
  s.registers[r.reg] = r.keys;
  s.echo = 'recorded ' + r.keys.length + ' key' + (r.keys.length === 1 ? '' : 's') + ' into @' + r.reg;
}
function replayMacro(ch: string): void {
  const s = state();
  const reg = ch === '@' ? s.lastMacro : ch;
  const keysArr = reg ? s.registers[reg] : undefined;
  if (!reg || !keysArr || !keysArr.length) {
    s.echo = 'E: register ' + (reg ?? '@') + ' is empty';
    fx.error();
    return;
  }
  s.lastMacro = reg;
  macroReplaying = true;
  macroAborted = false;
  for (const rk of keysArr) {
    if (s.status !== 'play' || s.mode !== 'normal' || macroAborted) break;
    normalKey(rk);
  }
  macroReplaying = false;
  s.lastCmd = '@' + reg;
  if (s.status === 'play') tick(); // the single enemy turn
}

// ---------- motions ----------
function singleStep(dx: number, dy: number): void {
  const s = state();
  const p = s.player;
  const x = p.x + dx;
  const y = p.y + dy;
  const ground = s.layer === 'ground';
  if (!terrainOk(x, y, dx, dy) || (ground && bombAt(x, y))) { bonk(); return; }
  const e = ground ? enemyAt(x, y) : kiteAt(x, y);
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
    } else if (kiteAt(x, y)) break; // slides stop short of a kite
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
  const foe = ground ? enemyAt(x, y) : kiteAt(x, y);
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

// ---------- marks (docs/motions-v2.md §1) ----------
// setting is FREE — annotation, the same class as the `:` prompt
function setMark(ch: string): void {
  const s = state();
  if (!(ch.length === 1 && ch >= 'a' && ch <= 'z')) {
    s.echo = 'E: mark wants a letter a-z';
    fx.error();
    return;
  }
  s.marks[ch] = { x: s.player.x, y: s.player.y, layer: s.layer };
  s.echo = 'mark ' + ch + ' set. the file remembers.';
}
// recall is a jump: nothing in between matters, no swept interval, no flips
function recallMark(ch: string): void {
  const s = state();
  const p = s.player;
  const m = s.marks[ch];
  if (!m) {
    bonk(s.marksWiped ? 'the blast moved the line numbers' : 'mark ' + ch + ' not set');
    return;
  }
  if (m.layer !== s.layer) { bonk('mark ' + ch + ' is in another layer'); return; }
  if (m.x === p.x && m.y === p.y) { bonk('already at mark ' + ch); return; }
  const g = s.layer === 'sky' ? s.skyGrid! : s.grid;
  const c = g[m.y] ? g[m.y][m.x] ?? '#' : '#';
  if (SOLID[c] || c === '~' || ONEWAY[c]) { bonk('mark ' + ch + ' is unreachable now'); return; }
  const ground = s.layer === 'ground';
  if (ground && bombAt(m.x, m.y)) { bonk('something is sitting on mark ' + ch); return; }
  const foe = ground ? enemyAt(m.x, m.y) : undefined;
  if (foe && !flippedToad(foe)) { bonk('something is sitting on mark ' + ch); return; }
  if (foe) squashToad(foe);
  p.x = m.x;
  p.y = m.y;
  enterTile();
  fx.moved();
  if (s.status === 'play') tick();
}

// ---------- % — jump to the matching bracket (docs/motions-v2.md §2) ----------
// jump semantics like mark recall: only the destination matters; a bomb on
// YOUR bracket doesn't block the exit — that's the Trapdoor
function matchJump(): void {
  const s = state();
  const p = s.player;
  const partner = s.pairs[s.layer + ':' + p.x + ',' + p.y];
  if (!partner) { bonk('no matching bracket here'); return; }
  const [px, py] = partner.split(',').map(Number);
  const ground = s.layer === 'ground';
  if (ground && bombAt(px, py)) { bonk('the matching bracket is occupied'); return; }
  const foe = ground ? enemyAt(px, py) : undefined;
  if (foe && !flippedToad(foe)) { bonk('the matching bracket is occupied'); return; }
  if (foe) squashToad(foe);
  p.x = px;
  p.y = py;
  s.lastCmd = '%';
  enterTile();
  fx.moved();
  if (s.status === 'play') tick();
}

// ---------- /{word} + n — search across the file (docs/motions-v2.md §4) ----------
// horizontal letter runs on every row of the player's layer — the same word
// rule w/b/e use, lifted from one row to the whole grid
function gridWordStarts(word: string): Array<[number, number]> {
  const s = state();
  const g = s.layer === 'sky' ? s.skyGrid! : s.grid;
  const out: Array<[number, number]> = [];
  for (let y = 0; y < s.H; y++) {
    let run = '';
    let start = 0;
    for (let x = 0; x <= s.W; x++) {
      const lt = x < s.W && isLetter(g[y][x] ?? '#');
      if (lt && !run) start = x;
      if (lt) run += g[y][x];
      else {
        if (run === word) out.push([start, y]); // whole-word matches only
        run = '';
      }
    }
  }
  return out;
}
function doSearch(word: string): void {
  const s = state();
  const p = s.player;
  if (!word) {
    // bare `/` Enter repeats the last search, like vim
    if (!s.lastSearch) { s.echo = 'E: empty pattern'; fx.error(); return; }
    word = s.lastSearch;
  }
  s.lastSearch = word;
  const hits = gridWordStarts(word);
  if (!hits.length) { bonk('pattern not found: ' + word); return; }
  // row-major from just past the player, wrapping — deterministic, learnable
  const after = hits.filter(([x, y]) => y > p.y || (y === p.y && x > p.x));
  const before = hits.filter(([x, y]) => !(y > p.y || (y === p.y && x > p.x)));
  const ground = s.layer === 'ground';
  for (const [x, y] of [...after, ...before]) {
    if (x === p.x && y === p.y) continue;
    // an occupied landing is skipped, not fatal — the chain routes around
    if (ground && bombAt(x, y)) continue;
    const foe = ground ? enemyAt(x, y) : undefined;
    if (foe && !flippedToad(foe)) continue;
    if (foe) squashToad(foe);
    p.x = x;
    p.y = y;
    s.lastCmd = '/' + word;
    enterTile();
    fx.moved();
    if (s.status === 'play') tick();
    return;
  }
  bonk('every "' + word + '" is spoken for');
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
const isCoinKind = (t: Terminal): boolean => t.kind === 'coins' || t.kind === 'spark';

/** Where the spark terminal's scan head sits for a given session clock. */
export function sparkPos(t: Terminal, T: TermSession): number {
  const len = t.buffer.length;
  if (!len) return 0;
  // starts mid-buffer so entering at cursor 0 is never an instant collision
  return (T.ticks + (t.broken.length >> 1)) % len;
}

function termGoalMet(t: Terminal): boolean {
  if (t.kind === 'clean') return !t.buffer.includes(t.glitch);
  if (isCoinKind(t)) return !t.buffer.includes(t.coin);
  return t.buffer.join('') === t.target;
}
function termValidate(t: Terminal): boolean {
  const s = state();
  if (termGoalMet(t)) {
    t.solved = true;
    grantBombs(t.arms, t.grants);
    s.mode = 'normal'; s.term = null;
    const label = t.kind === 'clean' ? 'lint purged'
      : t.kind === 'coins' ? 'cache grabbed'
      : t.kind === 'spark' ? 'cache grabbed under the scanner'
      : t.kind === 'golf' ? '"' + t.target + '" under budget'
      : '"' + t.target + '"';
    s.echo = label + ' — armed! +' + t.grants + ' bomb' + (t.grants > 1 ? 's' : '');
    fx.solved(t);
    return true;
  }
  return false;
}
// put a timed/budgeted tile back to its authored state (session clocks too)
function termRewind(t: Terminal, T: TermSession, msg: string): void {
  const s = state();
  t.buffer = t.broken.split('');
  t.cursor = 0;
  T.insert = false;
  T.pending = { count: '', op: null };
  T.ticks = 0;
  T.used = 0;
  s.echo = 'E: ' + msg;
  fx.termReset(t);
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
// words inside the buffer = runs of [a-zA-Z0-9], same rule as wordSpan
function bufWords(t: Terminal): Array<[number, number]> {
  const isW = (c: string) => /[a-zA-Z0-9]/.test(c);
  const out: Array<[number, number]> = [];
  let start = -1;
  for (let i = 0; i <= t.buffer.length; i++) {
    const w = i < t.buffer.length && isW(t.buffer[i]);
    if (w && start < 0) start = i;
    if (!w && start >= 0) { out.push([start, i - 1]); start = -1; }
  }
  return out;
}

function termKey(k: string): void {
  const s = state();
  const T = s.term!;
  const t = T.t;
  T.used++;
  termKeyInner(k, s, T, t);
  // golf: the budget counts every keypress in the tile; going over resets it
  if (s.mode === 'terminal' && s.term === T && !t.solved
      && t.kind === 'golf' && T.used >= t.strokes && !termGoalMet(t)) {
    termRewind(t, T, 'over budget — the tile reset');
  }
}

// true while `.` is re-feeding a recorded edit through termKeyInner — the
// replay must cost exactly one tick, so per-key afters are suppressed
let replaying = false;

function termKeyInner(k: string, s: GameState, T: TermSession, t: Terminal): void {
  // runs after every completed command: coin pickup, win check, world tick,
  // then the session hazards (scan head, respawn clock)
  const after = (validate: boolean) => {
    if (replaying) return;
    if (isCoinKind(t) && t.buffer[t.cursor] === t.coin) {
      t.buffer[t.cursor] = '·';
      fx.coin(t.buffer.filter((c) => c === t.coin).length);
    }
    if ((validate || isCoinKind(t)) && termValidate(t)) return;
    T.ticks++; // before tick() so the fx.tick repaint shows a fresh clock
    tick();
    if (s.status !== 'play' || s.mode !== 'terminal') return;
    if (t.kind === 'spark' && sparkPos(t, T) === t.cursor) {
      termRewind(t, T, 'zapped by the scan head — tile reset');
      s.mode = 'normal'; s.term = null;
      fx.exitTerm();
      return;
    }
    if (isCoinKind(t) && T.ticks >= t.deadline && t.buffer.includes(t.coin)) {
      termRewind(t, T, 'too slow — the cache respawned');
    }
  };
  const done = () => after(true);
  if (T.insert) {
    if (k === 'Escape') {
      T.insert = false;
      t.cursor = Math.max(0, t.cursor - 1);
      // the whole insert-class edit (opener + typing) commits as one dot unit
      if (T.rec) { s.lastEdit = { keys: [...T.rec, 'Escape'] }; T.rec = null; }
      after(true);
      return;
    }
    if (k === 'Backspace') {
      if (t.cursor > 0) { t.buffer.splice(t.cursor - 1, 1); t.cursor--; }
      T.rec?.push(k);
      after(false); return;
    }
    if (k.length === 1) {
      t.buffer.splice(t.cursor, 0, k); t.cursor++;
      T.rec?.push(k);
      after(false); return;
    }
    return;
  }
  // normal sub-mode
  const P = T.pending;
  if (P.op === 'r') {
    P.op = null;
    if (k.length === 1) {
      if (t.buffer.length) t.buffer[t.cursor] = k;
      s.lastCmd = 'r' + k;
      s.lastEdit = { keys: ['r', k] };
      done();
    }
    return;
  }
  const doFind = (cmd: 'f' | 'F', ch: string): void => {
    const dir = cmd === 'f' ? 1 : -1;
    let hit = -1;
    for (let i = t.cursor + dir; i >= 0 && i < t.buffer.length; i += dir) {
      if (t.buffer[i] === ch) { hit = i; break; }
    }
    if (hit < 0) { s.echo = 'E: no "' + ch + '" that way'; fx.error(); return; }
    T.find = { cmd, ch };
    t.cursor = hit;
    s.lastCmd = cmd + ch;
    done();
  };
  if (P.op === 'f' || P.op === 'F') {
    const cmd = P.op as 'f' | 'F';
    P.op = null;
    if (k.length === 1) doFind(cmd, k);
    return;
  }
  if (P.op === 'c') {
    if (k === 'w') {
      const [, e] = wordSpan(t);
      const end = Math.max(t.cursor, e);
      t.buffer.splice(t.cursor, end - t.cursor + 1);
      T.insert = true; P.op = null; s.lastCmd = 'cw';
      T.rec = ['c', 'w'];
      after(false); return;
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
      T.rec = ['c', 'i', 'w'];
      after(false); return;
    }
    s.echo = 'E: ci needs w'; fx.error(); return;
  }
  if ((k >= '1' && k <= '9') || (k === '0' && P.count)) { P.count += k; return; }
  const cnt = P.count;
  const n = Math.max(1, parseInt(P.count || '1', 10));
  P.count = '';
  const clamp = () => { t.cursor = Math.max(0, Math.min(t.buffer.length - 1, t.cursor)); };
  switch (k) {
    case 'h': t.cursor -= n; clamp(); after(true); break;
    case 'l': t.cursor += n; clamp(); after(true); break;
    case '0': t.cursor = 0; after(true); break;
    case '$': t.cursor = Math.max(0, t.buffer.length - 1); after(true); break;
    case 'f': case 'F': P.op = k; break;
    case ';':
      if (T.find) doFind(T.find.cmd as 'f' | 'F', T.find.ch);
      else { s.echo = 'E: no find to repeat'; fx.error(); }
      break;
    case 'w': case 'b': case 'e': {
      const words = bufWords(t);
      let cx = t.cursor;
      let hit: number | null = 0;
      for (let i = 0; i < n && hit !== null; i++) {
        hit = null;
        if (k === 'w') { for (const [ws] of words) if (ws > cx) { hit = ws; break; } }
        else if (k === 'e') { for (const [, we] of words) if (we > cx) { hit = we; break; } }
        else { for (let j = words.length - 1; j >= 0; j--) if (words[j][0] < cx) { hit = words[j][0]; break; } }
        if (hit !== null) cx = hit;
      }
      if (hit === null) { s.echo = 'E: no word to hop to'; fx.error(); break; }
      t.cursor = cx; s.lastCmd = k; after(true); break;
    }
    case 'x':
      t.buffer.splice(t.cursor, n); clamp(); s.lastCmd = 'x';
      s.lastEdit = { keys: [...cnt.split(''), 'x'] };
      done(); break;
    case 'r': P.op = 'r'; break;
    case '~': {
      for (let i = 0; i < n && t.cursor < t.buffer.length; i++) {
        const c = t.buffer[t.cursor];
        t.buffer[t.cursor] = c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase();
        if (t.cursor < t.buffer.length - 1) t.cursor++;
      }
      s.lastCmd = '~';
      s.lastEdit = { keys: [...cnt.split(''), '~'] };
      done(); break;
    }
    case 's': t.buffer.splice(t.cursor, 1); T.insert = true; s.lastCmd = 's'; T.rec = ['s']; after(false); break;
    case 'c': P.op = 'c'; break;
    case 'i': T.insert = true; T.rec = ['i']; after(false); break;
    case 'a': t.cursor = Math.min(t.buffer.length, t.cursor + 1); T.insert = true; T.rec = ['a']; after(false); break;
    case 'A': t.cursor = t.buffer.length; T.insert = true; T.rec = ['A']; after(false); break;
    case '.': {
      // the dot formula (docs/motions-v2.md §3): replay the last completed
      // edit at the cursor for ONE key and ONE tick, whatever its length
      if (!s.lastEdit) { s.echo = 'E: nothing to repeat'; fx.error(); break; }
      replaying = true;
      for (const rk of s.lastEdit.keys) termKeyInner(rk, s, T, t);
      replaying = false;
      s.lastCmd = '.';
      done(); break;
    }
    case 'u': worldUndo(); break;
    case 'Escape':
      // walking out on a timed cache puts the coins back — no cheesing the clock
      if (isCoinKind(t) && !t.solved) { t.buffer = t.broken.split(''); t.cursor = 0; }
      s.mode = 'normal'; s.term = null; fx.exitTerm(); break;
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

  // the open search prompt swallows keys: typing is free thinking; Enter
  // executes for 1 key + 1 tick; Escape abandons (the opening / is spent)
  if (s.mode === 'normal' && s.searchBuf !== null) {
    if (k === 'Escape') { s.searchBuf = null; s.echo = ''; return; }
    if (k === 'Enter') {
      const word = s.searchBuf;
      s.searchBuf = null;
      s.keys++;
      doSearch(word);
      if (s.status === 'play' && s.keys >= s.limit) { s.status = 'fail'; fx.fail(); }
      return;
    }
    if (k === 'Backspace') { s.searchBuf = s.searchBuf.slice(0, -1); s.echo = '/' + s.searchBuf; return; }
    if (k.length === 1) { s.searchBuf += k; s.echo = '/' + s.searchBuf; }
    return;
  }

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

  // mark-set and macro record/stop are free annotation (docs/motions-v2.md):
  // they change nothing in the world — recall/replay pay full fare
  if (s.mode === 'normal') {
    if (s.pending.op === 'm') {
      s.pending.op = null;
      if (k !== 'Escape') setMark(k);
      return;
    }
    if (s.pending.op === 'q') {
      s.pending.op = null;
      if (k !== 'Escape') startRecording(k);
      return;
    }
    if (k === 'm' && !s.pending.op) {
      s.pending.count = '';
      s.pending.op = 'm';
      return;
    }
    if (k === 'q' && !s.pending.op) {
      if (s.recording) { stopRecording(); return; }
      s.pending.count = '';
      s.pending.op = 'q';
      return;
    }
    // recording captures every world command as pressed; the keys that
    // can't replay coherently are refused (macros are pure motion)
    if (s.recording) {
      if (k === 'i' || k === '/' || k === 'u' || k === '@') {
        s.echo = "E: that won't record. macros are pure motion.";
        fx.error();
        return;
      }
      s.recording.keys.push(k);
    }
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
  if (P.op === '`') {
    P.op = null; P.count = '';
    if (k.length === 1 && k >= 'a' && k <= 'z') { s.lastCmd = '`' + k; note('`'); recallMark(k); }
    else if (k !== 'Escape') { s.echo = 'E: mark wants a letter a-z'; fx.error(); }
    return;
  }
  if (P.op === '@') {
    P.op = null; P.count = '';
    if (k === '@' || (k.length === 1 && k >= 'a' && k <= 'z')) { note('@'); replayMacro(k); }
    else if (k !== 'Escape') { s.echo = 'E: registers are letters a-z'; fx.error(); }
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
    case '`': P.count = ''; P.op = '`'; break;
    case '@': P.count = ''; P.op = '@'; break;
    case '%': note('%'); matchJump(); break;
    case '.': note('.'); bonk('nothing to repeat. move with motions, repeat with edits'); break;
    case '/': P.count = ''; s.searchBuf = ''; s.echo = '/'; break;
    case 'n':
      if (s.lastSearch) { note('n'); doSearch(s.lastSearch); }
      else { s.echo = 'E: no search to repeat'; fx.error(); } // free, like ;
      break;
    case 'x': note('x'); dropBomb(); break;
    case 'u': note('u'); worldUndo(); break;
    case '<C-u>': note('^U'); riseToSky(); break;
    case '<C-d>': note('^D'); dropToGround(); break;
    case 'i': {
      const t = termAtPlayer();
      if (t && !t.solved) {
        note('i');
        s.mode = 'terminal';
        s.term = { t, insert: false, pending: { count: '', op: null }, ticks: 0, used: 0, find: null };
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
