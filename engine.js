// Vimberman — game engine (pure logic; no DOM. ui.js supplies VB.fx hooks.)
/* global LEVELS, module, require */

(function (root) {
  const L = typeof LEVELS !== 'undefined' ? LEVELS : require('./levels.js').LEVELS;

  // ---------- seeded RNG (deterministic per level attempt) ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SOLID = { '#': 1, '%': 1, '&': 1 };
  const ONEWAY = { '<': [-1, 0], '>': [1, 0], '^': [0, -1], V: [0, 1] };
  const ITEMS = { K: 'K', R: 'R', U: 'U', B: 'B' };
  const isLetter = (c) => c >= 'a' && c <= 'z';

  // fx hooks — ui.js overrides these; engine works with no-ops (headless).
  const fx = {
    error() {}, moved() {}, bomb() {}, explosion() {}, solved() {},
    item() {}, rescue() {}, death() {}, win() {}, fail() {}, wantPause() {},
    enterTerm() {}, exitTerm() {}, telegraph() {}, tick() {}, collectBush() {},
  };

  let st = null; // current game state

  // ---------- level loading ----------
  function loadLevel(idx) {
    const lv = L[idx];
    const grid = lv.map.map((r) => r.split(''));
    const H = grid.length, W = grid[0].length;
    const enemies = [];
    let player = null;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = grid[y][x];
        const opts = (lv.enemyOpts || {})[x + ',' + y] || {};
        if (c === 'P') { player = { x, y }; grid[y][x] = '.'; }
        if (c === 'Z') { enemies.push({ type: 'zombie', x, y, phase: enemies.length, ...opts }); grid[y][x] = '.'; }
        if (c === 'I') { enemies.push({ type: 'imp', x, y, sinceBomb: 0, ...opts }); grid[y][x] = '.'; }
        if (c === 'M') { enemies.push({ type: 'mage', x, y, mstate: 'cool', timer: 3, target: null, immune: false, ...opts }); grid[y][x] = '.'; }
      }
    }
    const terminals = {};
    for (const k in lv.terminals) {
      const t = lv.terminals[k];
      terminals[k] = { key: k, broken: t.broken, target: t.target, grants: t.grants, hint: t.hint, buffer: t.broken.split(''), cursor: 0, solved: false };
    }
    st = {
      idx, lv, grid, W, H,
      player: { ...player, bombs: 0, radius: 2, undo: 3, iframes: 0 },
      enemies, bombs: [], projectiles: [], terminals,
      keys: 0, tick: 0, limit: lv.limit, par: lv.par,
      mode: 'normal', term: null,
      pending: { count: '', op: null },
      lastFind: null, lastCmd: '', echo: '',
      status: 'play', deathMsg: '',
      rng: mulberry32(0x9E3779B9 ^ (idx * 2654435761)),
      history: [],
      explosionsThisTick: [],
    };
    pushSnap();
    return st;
  }

  // ---------- snapshots / undo ----------
  function snap() {
    const terms = {};
    for (const k in st.terminals) {
      const t = st.terminals[k];
      terms[k] = { buffer: t.buffer.slice(), cursor: t.cursor, solved: t.solved };
    }
    return JSON.stringify({
      grid: st.grid.map((r) => r.join('')),
      p: st.player, en: st.enemies, bo: st.bombs, pr: st.projectiles,
      terms, tick: st.tick, limit: st.limit,
    });
  }
  function pushSnap() {
    st.history.push(snap());
    if (st.history.length > 80) st.history.shift();
  }
  function restore(s) {
    const d = JSON.parse(s);
    st.grid = d.grid.map((r) => r.split(''));
    st.player = d.p; st.enemies = d.en; st.bombs = d.bo; st.projectiles = d.pr;
    st.tick = d.tick; st.limit = d.limit;
    for (const k in d.terms) Object.assign(st.terminals[k], d.terms[k]);
  }
  function worldUndo() {
    if (st.player.undo < 1 || st.history.length < 2) { bonk('nothing to undo'); return; }
    const u = st.player.undo;
    st.history.pop();
    restore(st.history[st.history.length - 1]);
    st.player.undo = u - 1;
    st.mode = 'normal'; st.term = null;
    st.echo = 'rewound one tick';
    fx.rescue();
  }

  // ---------- queries ----------
  const at = (x, y) => (st.grid[y] ? st.grid[y][x] : '#');
  const enemyAt = (x, y) => st.enemies.find((e) => e.x === x && e.y === y);
  const bombAt = (x, y) => st.bombs.find((b) => b.x === x && b.y === y);
  const onPlayer = (x, y) => st.player.x === x && st.player.y === y;

  function onewayOk(c, dx, dy) {
    const d = ONEWAY[c];
    return !d || (d[0] === dx && d[1] === dy);
  }
  // terrain the player may occupy when arriving with motion (dx,dy)
  function terrainOk(x, y, dx, dy) {
    const c = at(x, y);
    if (SOLID[c] || c === '~') return false;
    if (!onewayOk(c, dx, dy)) return false;
    return true;
  }
  function enemyTerrainOk(x, y, dx, dy) {
    const c = at(x, y);
    if (SOLID[c] || c === '~' || c === '*') return false;
    if (!onewayOk(c, dx, dy)) return false;
    if (bombAt(x, y)) return false;
    return true;
  }

  // ---------- entering a tile ----------
  function enterTile() {
    const p = st.player;
    const c = at(p.x, p.y);
    const key = p.x + ',' + p.y;
    if (c === '*') {
      const item = (st.lv.bushes || {})[key] || { type: 'K', amt: 5 };
      st.grid[p.y][p.x] = '.';
      applyItem(item.type, item.amt);
      fx.collectBush(item.type);
    } else if (ITEMS[c]) {
      const item = (st.lv.bushes || {})[key];
      st.grid[p.y][p.x] = '.';
      applyItem(c, item ? item.amt : 1);
    } else if (c === 'E') {
      win();
    }
    // stepping off a bomb seals it
    for (const b of st.bombs) if (b.soft && !onPlayer(b.x, b.y)) b.soft = false;
  }
  function applyItem(type, amt) {
    const p = st.player;
    if (type === 'K') { st.limit += amt; st.echo = '+' + amt + ' keystrokes'; }
    if (type === 'R') { p.radius += 1; st.echo = 'blast radius +1'; }
    if (type === 'U') { p.undo += 1; st.echo = '+1 undo charge'; }
    if (type === 'B') { p.bombs = Math.min(3, p.bombs + 1); st.echo = '+1 bomb'; }
    fx.item(type, amt);
  }
  function win() {
    if (st.status !== 'play') return;
    st.status = 'won';
    fx.win();
  }

  // ---------- player hits / death ----------
  function hitPlayer(msg) {
    if (st.status !== 'play') return;
    if (st.player.iframes > 0) return;
    st.status = 'dead';
    st.deathMsg = msg;
    fx.death(msg);
  }
  function canRescue() {
    return st.status === 'dead' && st.player.undo > 0 && st.history.length > 0;
  }
  function rescue() {
    const u = st.player.undo;
    restore(st.history[st.history.length - 1]);
    st.player.undo = u - 1;
    st.player.iframes = 2;
    st.status = 'play';
    st.mode = 'normal'; st.term = null;
    st.echo = 'rewound — go!';
    fx.rescue();
  }

  // ---------- bombs & explosions ----------
  function dropBomb() {
    const p = st.player;
    if (p.bombs < 1) { bonk('no bombs — fix a code-tile (T) with i'); return; }
    if (bombAt(p.x, p.y)) { bonk('already a bomb here'); return; }
    p.bombs--;
    st.bombs.push({ x: p.x, y: p.y, fuse: 6, r: p.radius, soft: true });
    st.lastCmd = 'x';
    fx.bomb();
    tick();
  }
  function blastTiles(bomb, destroy, chainQ) {
    const tiles = [[bomb.x, bomb.y]];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let i = 1; i <= bomb.r; i++) {
        const x = bomb.x + dx * i, y = bomb.y + dy * i;
        const c = at(x, y);
        if (c === '#') break;
        if (c === '&') {
          if (bomb.r >= 3) { tiles.push([x, y]); if (destroy) st.grid[y][x] = '.'; }
          break;
        }
        if (c === '%') { tiles.push([x, y]); if (destroy) st.grid[y][x] = '.'; break; }
        if (c === '*') {
          tiles.push([x, y]);
          if (destroy) {
            const item = (st.lv.bushes || {})[x + ',' + y];
            st.grid[y][x] = item ? item.type : 'K';
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
  function explode(initial) {
    const q = initial.slice();
    const all = [];
    while (q.length) {
      const b = q.shift();
      if (b.done) continue;
      b.done = true;
      all.push(...blastTiles(b, true, q));
    }
    st.bombs = st.bombs.filter((b) => !b.done);
    const hit = new Set(all.map(([x, y]) => x + ',' + y));
    st.enemies = st.enemies.filter((e) => {
      if (!hit.has(e.x + ',' + e.y)) return true;
      if (e.type === 'mage' && e.immune) return true;
      return false;
    });
    st.projectiles = st.projectiles.filter((p) => !hit.has(p.x + ',' + p.y));
    st.explosionsThisTick = all;
    st.history = []; // no undoing past a detonation
    fx.explosion(all);
    if (hit.has(st.player.x + ',' + st.player.y)) hitPlayer('caught in the blast');
  }
  function pendingBlast() {
    const set = new Set();
    for (const b of st.bombs) {
      if (b.fuse > 2) continue;
      for (const [x, y] of blastTiles(b, false, null)) set.add(x + ',' + y);
    }
    return set;
  }

  // ---------- enemies ----------
  function neighbors(e) {
    const out = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (e.leash === 'row' && dy !== 0) continue;
      const x = e.x + dx, y = e.y + dy;
      if (!enemyTerrainOk(x, y, dx, dy)) continue;
      if (enemyAt(x, y)) continue;
      out.push([x, y]);
    }
    return out;
  }
  function tryStep(e, dx, dy) {
    if (dx === 0 && dy === 0) return false;
    if (e.leash === 'row' && dy !== 0) return false;
    if (e.leash === 'col' && dx !== 0) return false;
    const x = e.x + dx, y = e.y + dy;
    if (!enemyTerrainOk(x, y, dx, dy)) return false;
    if (enemyAt(x, y)) return false;
    e.x = x; e.y = y;
    return true;
  }
  // leashed enemies patrol a lane (row or column): sweep until blocked, then turn
  function patrolTick(e) {
    e.dir = e.dir || -1;
    const vert = e.leash === 'col';
    for (const d of [e.dir, -e.dir]) {
      const x = e.x + (vert ? 0 : d), y = e.y + (vert ? d : 0);
      if (enemyTerrainOk(x, y, vert ? 0 : d, vert ? d : 0) && !enemyAt(x, y)) {
        e.x = x; e.y = y; e.dir = d;
        return;
      }
    }
  }
  function zombieTick(e) {
    if ((st.tick + e.phase) % 2 !== 0) return;
    if (e.leash) { patrolTick(e); return; }
    const p = st.player;
    const dx = Math.sign(p.x - e.x), dy = Math.sign(p.y - e.y);
    const horizFirst = Math.abs(p.x - e.x) >= Math.abs(p.y - e.y);
    const moves = horizFirst ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
    for (const [mx, my] of moves) if (tryStep(e, mx, my)) return;
  }
  function impTick(e) {
    if (e.leash) { patrolTick(e); return; }
    e.sinceBomb++;
    const p = st.player;
    const danger = pendingBlast();
    if (danger.has(e.x + ',' + e.y)) {
      const ns = neighbors(e);
      const safe = ns.filter(([x, y]) => !danger.has(x + ',' + y));
      const pick = (safe.length ? safe : ns);
      if (pick.length) { const [x, y] = pick[Math.floor(st.rng() * pick.length)]; e.x = x; e.y = y; }
      return;
    }
    const cheb = Math.max(Math.abs(p.x - e.x), Math.abs(p.y - e.y));
    if (!e.leash && e.sinceBomb >= 6 && cheb <= 4 && neighbors(e).length >= 2 && !bombAt(e.x, e.y)) {
      st.bombs.push({ x: e.x, y: e.y, fuse: 4, r: 1, soft: false, imp: true });
      e.sinceBomb = 0;
    }
    const ns = neighbors(e);
    if (!ns.length) return;
    if (st.rng() < 0.6) {
      let best = null, bd = Infinity;
      for (const [x, y] of ns) {
        const d = Math.abs(p.x - x) + Math.abs(p.y - y);
        if (d < bd) { bd = d; best = [x, y]; }
      }
      e.x = best[0]; e.y = best[1];
    } else {
      const [x, y] = ns[Math.floor(st.rng() * ns.length)];
      e.x = x; e.y = y;
    }
  }
  function mageTick(e) {
    e.immune = false;
    const p = st.player;
    if (e.mstate === 'cool') {
      e.timer--;
      if (e.timer <= 0) e.mstate = 'tele';
    } else if (e.mstate === 'tele') {
      const spots = [];
      for (let y = 1; y < st.H - 1; y++) {
        for (let x = 1; x < st.W - 1; x++) {
          const c = at(x, y);
          const d = Math.abs(p.x - x) + Math.abs(p.y - y);
          if (d < 3 || d > 6) continue;
          if (x === p.x || y === p.y) continue; // never port onto the player's row/col
          if (!(c === '.' || isLetter(c))) continue;
          if (enemyAt(x, y) || bombAt(x, y) || onPlayer(x, y)) continue;
          spots.push([x, y]);
        }
      }
      if (spots.length) e.target = spots[Math.floor(st.rng() * spots.length)];
      if (e.target) { e.mstate = 'port'; fx.telegraph(e.target); }
      else { e.mstate = 'cool'; e.timer = 3; }
    } else if (e.mstate === 'port') {
      const [tx, ty] = e.target;
      if (!enemyAt(tx, ty) && !bombAt(tx, ty) && !onPlayer(tx, ty)) { e.x = tx; e.y = ty; }
      e.target = null; e.immune = true;
      // fire along aligned axis, else the closer axis
      let dx = 0, dy = 0;
      if (e.y === p.y) dx = Math.sign(p.x - e.x);
      else if (e.x === p.x) dy = Math.sign(p.y - e.y);
      else if (Math.abs(p.x - e.x) <= Math.abs(p.y - e.y)) dx = Math.sign(p.x - e.x);
      else dy = Math.sign(p.y - e.y);
      if (dx || dy) {
        const x = e.x + dx, y = e.y + dy;
        const c = at(x, y);
        if (!SOLID[c] && !bombAt(x, y)) {
          if (onPlayer(x, y)) hitPlayer('zapped by a mage bolt');
          else st.projectiles.push({ x, y, dx, dy });
        }
      }
      e.mstate = 'cool'; e.timer = 3;
    }
  }
  function moveProjectiles() {
    const keep = [];
    for (const pr of st.projectiles) {
      const x = pr.x + pr.dx, y = pr.y + pr.dy;
      const c = at(x, y);
      if (SOLID[c] || bombAt(x, y)) continue;
      pr.x = x; pr.y = y;
      if (onPlayer(x, y)) { hitPlayer('zapped by a mage bolt'); continue; }
      const e = enemyAt(x, y);
      if (e) { st.enemies = st.enemies.filter((z) => z !== e); continue; }
      keep.push(pr);
    }
    st.projectiles = keep;
  }

  // ---------- world tick ----------
  function tick() {
    if (st.status !== 'play') return;
    st.tick++;
    st.explosionsThisTick = [];
    for (const b of st.bombs) b.fuse--;
    const due = st.bombs.filter((b) => b.fuse <= 0);
    if (due.length) explode(due);
    if (st.status !== 'play') { fx.tick(); return; }
    moveProjectiles();
    if (st.status !== 'play') { fx.tick(); return; }
    for (const e of st.enemies.slice()) {
      if (!st.enemies.includes(e)) continue;
      if (e.type === 'zombie') zombieTick(e);
      else if (e.type === 'imp') impTick(e);
      else mageTick(e);
      if (st.status !== 'play') { fx.tick(); return; }
    }
    for (const e of st.enemies) {
      if (onPlayer(e.x, e.y)) { hitPlayer('slain by the ' + e.type); if (st.status !== 'play') { fx.tick(); return; } }
    }
    if (st.player.iframes > 0) st.player.iframes--;
    pushSnap();
    fx.tick();
  }

  function bonk(msg) {
    st.echo = 'E: ' + (msg || 'cannot go there');
    fx.error(msg);
    tick(); // spam is punished
  }

  // ---------- motions ----------
  function singleStep(dx, dy) {
    const p = st.player;
    const x = p.x + dx, y = p.y + dy;
    if (!terrainOk(x, y, dx, dy) || bombAt(x, y)) { bonk(); return; }
    const e = enemyAt(x, y);
    if (e) { hitPlayer('walked into the ' + e.type); if (st.status === 'play') tick(); return; }
    p.x = x; p.y = y;
    enterTile();
    fx.moved();
    if (st.status === 'play') tick();
  }
  function slide(dx, dy, max) {
    const p = st.player;
    let moved = 0;
    while (moved < max) {
      const x = p.x + dx, y = p.y + dy;
      if (!terrainOk(x, y, dx, dy) || bombAt(x, y) || enemyAt(x, y)) break;
      p.x = x; p.y = y; moved++;
      enterTile();
      if (st.status !== 'play') return; // won or died mid-slide
    }
    if (moved === 0) { bonk(); return; }
    fx.moved();
    tick();
  }
  // words = runs of adjacent letter tiles in the player's row
  function rowWords() {
    const y = st.player.y, words = [];
    let start = -1;
    for (let x = 0; x <= st.W; x++) {
      const lt = x < st.W && isLetter(at(x, y));
      if (lt && start < 0) start = x;
      if (!lt && start >= 0) { words.push([start, x - 1]); start = -1; }
    }
    return words;
  }
  function flightBlocked(x0, x1, y) {
    const [a, b] = x0 < x1 ? [x0, x1] : [x1, x0];
    for (let x = a + 1; x < b; x++) if (SOLID[at(x, y)]) return true;
    return false;
  }
  function landAt(x, y, dx, dy) {
    const p = st.player;
    if (!terrainOk(x, y, dx, dy) || bombAt(x, y) || enemyAt(x, y)) return false;
    if (flightBlocked(p.x, x, y)) return false;
    p.x = x; p.y = y;
    enterTile();
    fx.moved();
    if (st.status === 'play') tick();
    return true;
  }
  function wordMotion(kind, count) {
    const p = st.player;
    const words = rowWords();
    let cx = p.x;
    for (let n = 0; n < count; n++) {
      let t = null;
      if (kind === 'w') { for (const [s] of words) if (s > cx) { t = s; break; } }
      else if (kind === 'e') { for (const [, e] of words) if (e > cx) { t = e; break; } }
      else { for (let i = words.length - 1; i >= 0; i--) if (words[i][0] < cx) { t = words[i][0]; break; } }
      if (t === null) { bonk('no word to ' + (kind === 'b' ? 'hop back to' : 'hop to')); return; }
      cx = t;
    }
    const dx = Math.sign(cx - p.x) || 1;
    if (!landAt(cx, p.y, dx, 0)) bonk('landing blocked');
  }
  function findMotion(cmd, ch) {
    const p = st.player;
    const dir = (cmd === 'f' || cmd === 't') ? 1 : -1;
    let target = -1;
    for (let x = p.x + dir; x > 0 && x < st.W - 1; x += dir) {
      if (at(x, p.y) === ch) { target = x; break; }
    }
    if (target < 0) { bonk('no "' + ch + '" in this row'); return; }
    const land = (cmd === 't' || cmd === 'T') ? target - dir : target;
    if (land === p.x) { bonk(); return; }
    st.lastFind = { cmd, ch };
    if (!landAt(land, p.y, dir, 0)) bonk('landing blocked');
  }

  // ---------- terminal (code-tile) editor ----------
  function termAtPlayer() {
    return st.terminals[st.player.x + ',' + st.player.y];
  }
  function termValidate(t) {
    if (t.buffer.join('') === t.target) {
      t.solved = true;
      st.player.bombs = Math.min(3, st.player.bombs + t.grants);
      st.mode = 'normal'; st.term = null;
      st.echo = '"' + t.target + '" — armed! +' + t.grants + ' bomb' + (t.grants > 1 ? 's' : '');
      fx.solved(t);
      return true;
    }
    return false;
  }
  function wordSpan(t) {
    // word under cursor: letters/digits run
    const isW = (c) => /[a-zA-Z0-9]/.test(c);
    let s = t.cursor, e = t.cursor;
    if (!isW(t.buffer[s] || '')) return [s, s - 1];
    while (s > 0 && isW(t.buffer[s - 1])) s--;
    while (e < t.buffer.length - 1 && isW(t.buffer[e + 1])) e++;
    return [s, e];
  }
  function termKey(k) {
    const T = st.term;
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
      if (k.length === 1) { if (t.buffer.length) t.buffer[t.cursor] = k; st.lastCmd = 'r' + k; done(); }
      return;
    }
    if (P.op === 'c') {
      if (k === 'w') {
        const [, e] = wordSpan(t);
        const end = Math.max(t.cursor, e);
        t.buffer.splice(t.cursor, end - t.cursor + 1);
        T.insert = true; P.op = null; st.lastCmd = 'cw';
        tick(); return;
      }
      if (k === 'i') { P.op = 'ci'; return; }
      P.op = null; st.echo = 'E: c needs w or iw'; fx.error(); return;
    }
    if (P.op === 'ci') {
      P.op = null;
      if (k === 'w') {
        const [s, e] = wordSpan(t);
        if (e >= s) { t.buffer.splice(s, e - s + 1); t.cursor = Math.min(s, Math.max(0, t.buffer.length)); }
        T.insert = true; st.lastCmd = 'ciw';
        tick(); return;
      }
      st.echo = 'E: ci needs w'; fx.error(); return;
    }
    if (k >= '1' && k <= '9' || (k === '0' && P.count)) { P.count += k; return; }
    const n = Math.max(1, parseInt(P.count || '1', 10)); P.count = '';
    const clamp = () => { t.cursor = Math.max(0, Math.min(t.buffer.length - 1, t.cursor)); };
    switch (k) {
      case 'h': t.cursor -= n; clamp(); tick(); break;
      case 'l': t.cursor += n; clamp(); tick(); break;
      case '0': t.cursor = 0; tick(); break;
      case '$': t.cursor = Math.max(0, t.buffer.length - 1); tick(); break;
      case 'x': t.buffer.splice(t.cursor, n); clamp(); st.lastCmd = 'x'; done(); break;
      case 'r': P.op = 'r'; break;
      case '~': {
        for (let i = 0; i < n && t.cursor < t.buffer.length; i++) {
          const c = t.buffer[t.cursor];
          t.buffer[t.cursor] = c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase();
          if (t.cursor < t.buffer.length - 1) t.cursor++;
        }
        st.lastCmd = '~'; done(); break;
      }
      case 's': t.buffer.splice(t.cursor, 1); T.insert = true; st.lastCmd = 's'; tick(); break;
      case 'c': P.op = 'c'; break;
      case 'i': T.insert = true; tick(); break;
      case 'a': t.cursor = Math.min(t.buffer.length, t.cursor + 1); T.insert = true; tick(); break;
      case 'A': t.cursor = t.buffer.length; T.insert = true; tick(); break;
      case 'u': worldUndo(); break;
      case 'Escape': st.mode = 'normal'; st.term = null; fx.exitTerm(); break;
      default:
        st.echo = 'E: not an edit command'; fx.error();
    }
  }

  // ---------- top-level key handling ----------
  function key(k) {
    if (!st) return;
    if (st.status === 'dead') {
      if (k === 'u' && canRescue()) { st.keys++; rescue(); }
      return; // r / Escape handled by UI
    }
    if (st.status !== 'play') return;

    // Escape with nothing pending = pause request (free)
    if (k === 'Escape' && st.mode === 'normal' && !st.pending.count && !st.pending.op) {
      fx.wantPause(); return;
    }
    if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta') return;

    st.keys++;
    if (st.mode === 'terminal') {
      termKey(k);
    } else {
      normalKey(k);
    }
    if (st.status === 'play' && st.keys >= st.limit) {
      st.status = 'fail';
      fx.fail();
    }
  }

  function normalKey(k) {
    const P = st.pending;
    if (P.op === 'g') {
      P.op = null;
      if (k === 'g') { st.lastCmd = 'gg'; slide(0, -1, Infinity); }
      else { st.echo = 'E: g?'; fx.error(); }
      return;
    }
    if (P.op && 'fFtT'.includes(P.op)) {
      const op = P.op; P.op = null; P.count = '';
      if (k.length === 1) { st.lastCmd = op + k; findMotion(op, k); }
      return;
    }
    if (k === 'Escape') { P.count = ''; P.op = null; st.echo = ''; return; }
    if (k >= '1' && k <= '9' || (k === '0' && P.count)) { P.count += k; return; }

    const n = Math.max(1, parseInt(P.count || '1', 10));
    const counted = !!P.count;
    P.count = '';
    const step = (dx, dy, name) => {
      st.lastCmd = (counted ? n : '') + name;
      if (n === 1 && !counted) singleStep(dx, dy);
      else slide(dx, dy, n);
    };
    switch (k) {
      case 'h': step(-1, 0, 'h'); break;
      case 'j': step(0, 1, 'j'); break;
      case 'k': step(0, -1, 'k'); break;
      case 'l': step(1, 0, 'l'); break;
      case '0': st.lastCmd = '0'; slide(-1, 0, Infinity); break;
      case '$': st.lastCmd = '$'; slide(1, 0, Infinity); break;
      case 'G': st.lastCmd = 'G'; slide(0, 1, Infinity); break;
      case 'g': P.op = 'g'; break;
      case 'w': st.lastCmd = (counted ? n : '') + 'w'; wordMotion('w', n); break;
      case 'b': st.lastCmd = (counted ? n : '') + 'b'; wordMotion('b', n); break;
      case 'e': st.lastCmd = (counted ? n : '') + 'e'; wordMotion('e', n); break;
      case 'f': case 'F': case 't': case 'T': P.op = k; break;
      case ';':
        if (st.lastFind) findMotion(st.lastFind.cmd, st.lastFind.ch);
        else { st.echo = 'E: no find to repeat'; fx.error(); }
        break;
      case ',': {
        if (st.lastFind) {
          const inv = { f: 'F', F: 'f', t: 'T', T: 't' }[st.lastFind.cmd];
          const keep = st.lastFind;
          findMotion(inv, keep.ch);
          st.lastFind = keep;
        } else { st.echo = 'E: no find to repeat'; fx.error(); }
        break;
      }
      case 'x': dropBomb(); break;
      case 'u': worldUndo(); break;
      case 'i': {
        const t = termAtPlayer();
        if (t && !t.solved) {
          st.mode = 'terminal';
          st.term = { t, insert: false, pending: { count: '', op: null } };
          fx.enterTerm(t);
          tick();
        } else bonk(t ? 'already fixed' : 'nothing to edit here — find a T tile');
        break;
      }
      default:
        st.echo = 'E: "' + k + '" is not a motion';
        fx.error();
    }
  }

  const VB = {
    LEVELS: L,
    loadLevel, key, canRescue, rescue,
    get state() { return st; },
    fx,
    _internals: { blastTiles: (b) => blastTiles(b, false, null), pendingBlast },
  };
  root.VB = VB;
  if (typeof module !== 'undefined') module.exports = VB;
})(typeof window !== 'undefined' ? window : globalThis);
