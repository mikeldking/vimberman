// Canvas renderer: draws the world from engine state using the pixel-art
// atlas, with tweened entity movement, particles, screen shake and glow.
// Also draws the "vim buffer" chrome: gridlines, a relative-number gutter
// (set number relativenumber), and a column ruler — see docs/new-mechanics.md.
import * as game from '../engine/engine';
import type { Enemy, Player } from '../engine/types';
import { buildSprites, cellHash, type Frame, type SpriteSet } from './sprites';
import { updateHud } from '../ui/hud';

const FONT = '"IBM Plex Mono", Menlo, Consolas, monospace';

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let sprites: SpriteSet;
let CELL = 44;
let GUT = 0; // left gutter width (line numbers)
let RUL = 0; // bottom ruler height (column numbers)
let DPR = 1;

// transient view state
let shake = 0;
let flashRed = 0;
interface Boom { x: number; y: number; t0: number }
let explosions: Boom[] = [];
interface Sweep { tiles: Array<[number, number]>; t0: number }
let sweeps: Sweep[] = [];
interface Particle {
  x: number; y: number; vx: number; vy: number;
  age: number; ttl: number; color: string; size: number; gravity: number;
}
let particles: Particle[] = [];
let lastFrame = 0;

interface Tween { x: number; y: number; face: number }
const tweens = new WeakMap<Player | Enemy, Tween>();

function gutterOn(): boolean {
  return game.loaded() && game.state().lv.gutter !== false;
}

export function initRenderer(el: HTMLCanvasElement): void {
  canvas = el;
  ctx = canvas.getContext('2d')!;
  sprites = buildSprites();
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);
}

export function sizeCanvas(): void {
  const st = game.loaded() ? game.state() : null;
  const W = st ? st.W : 15;
  const H = st ? st.H : 11; // menu screens get a full-size stage too
  const chrome = gutterOn();
  // Fill the viewport: leave room for HUD, statusline, and CRT chrome.
  const availW = window.innerWidth - 90;
  const availH = window.innerHeight - 150;
  const gutFrac = chrome ? 1.3 : 0; // gutter + ruler, in cells
  CELL = Math.max(36, Math.min(110, Math.floor(Math.min(availW / (W + gutFrac), availH / (H + gutFrac * 0.6)))));
  GUT = chrome ? Math.floor(CELL * 0.8) : 0;
  RUL = chrome ? Math.floor(CELL * 0.5) : 0;
  DPR = window.devicePixelRatio || 1;
  canvas.width = Math.round((W * CELL + GUT) * DPR);
  canvas.height = Math.round((H * CELL + RUL) * DPR);
  canvas.style.width = W * CELL + GUT + 'px';
  canvas.style.height = H * CELL + RUL + 'px';
}

// ---------- effects API (driven by fx hooks) ----------
export function kick(strength: number): void {
  shake = strength;
}
export function damageFlash(): void {
  flashRed = 1;
}
export function addExplosion(tiles: Array<[number, number]>): void {
  const now = performance.now();
  for (const [x, y] of tiles) {
    explosions.push({ x, y, t0: now });
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 4;
      particles.push({
        x: x + 0.5, y: y + 0.5,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
        age: 0, ttl: 0.35 + Math.random() * 0.4,
        color: ['#ffe12e', '#ff8c1a', '#ff3b3b', '#ffffff'][i % 4],
        size: 0.08 + Math.random() * 0.1, gravity: 7,
      });
    }
  }
}
export function addSweep(tiles: Array<[number, number]>): void {
  sweeps.push({ tiles, t0: performance.now() });
}
export function sparkle(x: number, y: number, color: string): void {
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    particles.push({
      x: x + 0.5, y: y + 0.5,
      vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6 - 0.8,
      age: 0, ttl: 0.45, color, size: 0.07, gravity: 2.5,
    });
  }
}
export function resetEffects(): void {
  explosions = [];
  sweeps = [];
  particles = [];
  shake = 0;
  flashRed = 0;
}

// ---------- helpers ----------
function tween(obj: Player | Enemy): Tween {
  let t = tweens.get(obj);
  if (!t) {
    t = { x: obj.x, y: obj.y, face: 1 };
    tweens.set(obj, t);
  }
  if (obj.x < t.x - 0.01) t.face = -1;
  else if (obj.x > t.x + 0.01) t.face = 1;
  t.x += (obj.x - t.x) * 0.45;
  t.y += (obj.y - t.y) * 0.45;
  if (Math.abs(t.x - obj.x) < 0.01) t.x = obj.x;
  if (Math.abs(t.y - obj.y) < 0.01) t.y = obj.y;
  return t;
}

interface DrawOpts {
  flip?: boolean;
  alpha?: number;
  glow?: number;
  glowColor?: string;
  scale?: number;
}
function sprite(f: Frame, x: number, y: number, o: DrawOpts = {}): void {
  ctx.save();
  ctx.translate((x + 0.5) * CELL, (y + 0.5) * CELL);
  if (o.flip) ctx.scale(-1, 1);
  if (o.scale) ctx.scale(o.scale, o.scale);
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  if (o.glow) {
    ctx.shadowBlur = o.glow;
    ctx.shadowColor = o.glowColor ?? '#ffffff';
  }
  ctx.drawImage(f, -CELL / 2, -CELL / 2, CELL, CELL);
  ctx.restore();
}
function glyph(ch: string, x: number, y: number, color: string, size = 0.62, glow = 0): void {
  ctx.font = `bold ${Math.floor(CELL * size)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = glow;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.fillText(ch, (x + 0.5) * CELL, (y + 0.54) * CELL);
  ctx.shadowBlur = 0;
}

// terrain + floor overlays for one grid (ground or sky silhouettes are
// handled by the caller via globalAlpha)
function drawTerrain(st: ReturnType<typeof game.state>, grid: string[][], now: number, sky: boolean): void {
  const blink = Math.floor(now / 500) % 2 === 0;
  const anim2slow = Math.floor(now / 550) % 2;
  for (let y = 0; y < st.H; y++) {
    for (let x = 0; x < st.W; x++) {
      const c = grid[y][x];
      const h = cellHash(x, y);
      if (sky) {
        if (c === '~') continue; // open air — the ghosted ground shows through
        if (c === '#') { sprite(sprites.thunderhead, x, y); continue; }
        sprite(sprites.cloud, x, y);
        if (c === '*') sprite(sprites.bush[(h + anim2slow) % 2], x, y);
        else if (c >= 'a' && c <= 'z') glyph(c, x, y - 0.04, '#4a7a8c', 0.42);
        else if (c === '|') drawMargin(x, y);
        continue;
      }
      if (c === '#') { sprite(sprites.wall, x, y); continue; }
      if (c === '!') { sprite(sprites.wall, x, y); drawLamp(st, x, y, now); continue; }
      if (c === '~') { sprite(sprites.gap[(h + anim2slow) % 2], x, y); continue; }
      sprite(sprites.floor[h % 3], x, y);
      if (c === '%') sprite(sprites.rock, x, y);
      else if (c === '&') sprite(sprites.hard, x, y);
      else if (c === '*') sprite(sprites.bush[(h + anim2slow) % 2], x, y);
      else if (c === '|') drawMargin(x, y);
      else if (c === '@') {
        sprite(sprites.updraft[anim2slow], x, y, { alpha: 0.9, glow: 6, glowColor: '#9fd8e8' });
      } else if (c === '?') {
        sprite(sprites.keycap, x, y, { glow: blink ? 9 : 4, glowColor: '#ffd23f' });
        glyph('?', x, y - 0.07, '#ffd23f', 0.42, 6);
      } else if (c === 'E') {
        const pulse = 8 + 5 * Math.sin(now / 260);
        sprite(sprites.exit[anim2slow], x, y, { glow: pulse, glowColor: '#33ff66' });
      } else if (c >= 'a' && c <= 'z') {
        sprite(sprites.keycap, x, y);
        glyph(c, x, y - 0.07, '#4dd0e1', 0.4);
      } else if ('()[]{}'.includes(c)) {
        // bracket-pair doors: paired glyphs pulse in sync so partners read
        sprite(sprites.keycap, x, y, { glow: blink ? 8 : 3, glowColor: '#ff8c1a' });
        glyph(c, x, y - 0.07, '#ff8c1a', 0.46, 4);
      } else if (c === 'T') {
        const t = st.terminals[x + ',' + y];
        if (t && t.solved) sprite(sprites.termOff, x, y);
        else sprite(sprites.termOn[anim2slow], x, y, { glow: blink ? 9 : 4, glowColor: '#c792ea' });
      } else if (c === '<' || c === '>' || c === '^' || c === 'V') {
        sprite(sprites.oneway[c], x, y, { alpha: 0.8 + 0.2 * Math.sin(now / 400) });
      } else if (c === 'K') sprite(sprites.itemK, x, y, { glow: 6, glowColor: '#ffd23f' });
      else if (c === 'R') sprite(sprites.itemR, x, y, { glow: 6, glowColor: '#ff8c1a' });
      else if (c === 'U') sprite(sprites.itemU, x, y, { glow: 6, glowColor: '#26c6da' });
      else if (c === 'B') sprite(sprites.itemB, x, y, { glow: 6, glowColor: '#ffe12e' });
    }
  }
}

function drawMargin(x: number, y: number): void {
  // a thin bracket hugging the near wall — vim's sign column
  ctx.save();
  ctx.strokeStyle = 'rgba(95, 251, 222, 0.55)';
  ctx.lineWidth = Math.max(2, CELL * 0.06);
  const pad = CELL * 0.16;
  ctx.beginPath();
  ctx.moveTo(x * CELL + pad, y * CELL + pad);
  ctx.lineTo(x * CELL + pad, (y + 1) * CELL - pad);
  ctx.moveTo((x + 1) * CELL - pad, y * CELL + pad);
  ctx.lineTo((x + 1) * CELL - pad, (y + 1) * CELL - pad);
  ctx.stroke();
  ctx.restore();
}

function drawLamp(st: ReturnType<typeof game.state>, x: number, y: number, now: number): void {
  const l = st.linters.find((li) => li.x === x && li.y === y);
  if (!l) return;
  const s = game.linterCycle(l);
  const blink = Math.floor(now / 180) % 2 === 0;
  const color = s === 'idle' ? '#3a4a3e' : s === 'warn' ? (blink ? '#ffbb33' : '#8a6a1f') : '#ff3b3b';
  ctx.save();
  ctx.fillStyle = color;
  if (s !== 'idle') { ctx.shadowBlur = 12; ctx.shadowColor = color; }
  ctx.beginPath();
  ctx.arc((x + 0.5) * CELL, (y + 0.5) * CELL, CELL * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// amber wash over tiles a warning linter is about to sweep
function drawLinterWarnings(st: ReturnType<typeof game.state>, now: number): void {
  if (st.layer !== 'ground') return;
  const pulse = 0.08 + 0.05 * Math.sin(now / 160);
  for (const l of st.linters) {
    if (game.linterCycle(l) !== 'warn') continue;
    ctx.fillStyle = `rgba(255, 187, 51, ${pulse})`;
    for (const [x, y] of game.linterTiles(l)) {
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
}

// ---------- the vim-buffer chrome: gridlines, gutter, ruler ----------
function drawGridlines(st: ReturnType<typeof game.state>): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(51, 255, 102, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 1; x < st.W; x++) {
    ctx.beginPath(); ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, st.H * CELL); ctx.stroke();
  }
  for (let y = 1; y < st.H; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(st.W * CELL, y * CELL + 0.5); ctx.stroke();
  }
  // cursorline / cursorcolumn wash
  ctx.fillStyle = 'rgba(51, 255, 102, 0.045)';
  ctx.fillRect(0, st.player.y * CELL, st.W * CELL, CELL);
  ctx.fillRect(st.player.x * CELL, 0, CELL, st.H * CELL);
  ctx.restore();
}

function drawGutterAndRuler(st: ReturnType<typeof game.state>, now: number): void {
  const p = st.player;
  const dim = st.mode === 'terminal' ? 0.3 : 1;
  const count = st.pending.count ? parseInt(st.pending.count, 10) : 0;
  const pulse = Math.floor(now / 250) % 2 === 0;
  ctx.save();
  ctx.globalAlpha = dim;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  // left gutter: relative numbers, absolute (1-based) on the cursor row
  for (let y = 0; y < st.H; y++) {
    const rel = Math.abs(y - p.y);
    const cur = y === p.y;
    const hot = count > 0 && rel === count && !cur;
    ctx.font = `${cur ? 'bold ' : ''}${Math.floor(CELL * (cur ? 0.4 : 0.34))}px ${FONT}`;
    ctx.fillStyle = cur ? '#ffbb33' : hot && pulse ? '#b6ffce' : '#2f5c33';
    if (hot) { ctx.shadowBlur = 8; ctx.shadowColor = '#33ff66'; } else ctx.shadowBlur = 0;
    ctx.fillText(String(cur ? y + 1 : rel), GUT - CELL * 0.16, y * CELL + CELL * 0.54);
  }
  ctx.shadowBlur = 0;
  // bottom ruler: relative column distances, 0 under the cursor, blank past 9
  ctx.textAlign = 'center';
  for (let x = 0; x < st.W; x++) {
    const rel = Math.abs(x - p.x);
    if (rel > 9) continue;
    const cur = x === p.x;
    const hot = count > 0 && rel === count && !cur;
    ctx.font = `${cur ? 'bold ' : ''}${Math.floor(CELL * 0.3)}px ${FONT}`;
    ctx.fillStyle = cur ? '#ffbb33' : hot && pulse ? '#b6ffce' : '#2f5c33';
    if (hot) { ctx.shadowBlur = 8; ctx.shadowColor = '#33ff66'; } else ctx.shadowBlur = 0;
    ctx.fillText(String(rel), GUT + x * CELL + CELL * 0.5, st.H * CELL + RUL * 0.55);
  }
  ctx.restore();

  // count-pending: outline the four candidate landing tiles
  if (count > 0) {
    ctx.save();
    ctx.translate(GUT, 0);
    ctx.strokeStyle = `rgba(182, 255, 206, ${pulse ? 0.5 : 0.25})`;
    ctx.lineWidth = 2;
    for (const [dx, dy] of [[count, 0], [-count, 0], [0, count], [0, -count]] as const) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (x < 0 || y < 0 || x >= st.W || y >= st.H) continue;
      ctx.strokeRect(x * CELL + 3, y * CELL + 3, CELL - 6, CELL - 6);
    }
    ctx.restore();
  }
}

// find-pending: spotlight the letter tiles in the cursor row
function drawFindTargets(st: ReturnType<typeof game.state>, now: number): void {
  const op = st.pending.op;
  if (!op || !'fFtT'.includes(op)) return;
  const grid = st.layer === 'sky' ? st.skyGrid! : st.grid;
  const y = st.player.y;
  const pulse = 0.25 + 0.15 * Math.sin(now / 180);
  ctx.save();
  for (let x = 1; x < st.W - 1; x++) {
    const c = grid[y][x];
    if (c >= 'a' && c <= 'z') {
      ctx.fillStyle = `rgba(255, 210, 63, ${pulse})`;
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
  ctx.restore();
}

function drawEnemy(e: Enemy, now: number, alpha = 1): void {
  const anim2 = Math.floor(now / 320) % 2;
  const t = tween(e);
  if (e.type === 'zombie') {
    sprite(sprites.zombie[anim2], t.x, t.y, { flip: t.face < 0, alpha });
  } else if (e.type === 'imp') {
    sprite(sprites.imp[anim2], t.x, t.y, { flip: t.face < 0, alpha });
  } else if (e.type === 'toad') {
    if ((e.flip ?? 0) > 0) {
      sprite(sprites.toadFlipped, t.x, t.y, { alpha });
      const urgent = (e.flip ?? 0) <= 2;
      glyph(String(e.flip), t.x + 0.3, t.y - 0.32, urgent ? '#ff9d9d' : '#ffe9a0', 0.28);
    } else {
      // the tell: it squats on the tick before it hops
      const f = e.hop === 1 ? sprites.toad[1] : sprites.toad[anim2];
      sprite(f, t.x, t.y, { flip: t.face < 0, alpha });
    }
  } else if (e.mstate === 'port') {
    sprite(sprites.magePort, t.x, t.y, { alpha: 0.55 * alpha, glow: 8, glowColor: '#54ffe0' });
  } else {
    sprite(sprites.mage[anim2], t.x, t.y, { flip: t.face < 0, glow: 4, glowColor: '#b18cff', alpha });
  }
}

// ---------- main loop ----------
export function startLoop(): void {
  requestAnimationFrame(draw);
}

function draw(now: number): void {
  requestAnimationFrame(draw);
  const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
  lastFrame = now;
  updateHud();
  if (!game.loaded()) return;
  const st = game.state();
  const aloft = st.layer === 'sky';

  ctx.save();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0a0f0a';
  ctx.fillRect(0, 0, canvas.width / DPR, canvas.height / DPR);
  if (shake > 0.3) {
    ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);
    shake *= 0.82;
  }
  const blink = Math.floor(now / 500) % 2 === 0;
  const anim2 = Math.floor(now / 320) % 2;

  if (GUT || RUL) drawGutterAndRuler(st, now);

  ctx.save();
  ctx.translate(GUT, 0);

  // ---- ground pass (ghosted when aloft) ----
  ctx.save();
  if (aloft) ctx.globalAlpha = 0.25;
  drawTerrain(st, st.grid, now, false);
  drawLinterWarnings(st, now);
  if (!aloft) drawGridlines(st);
  drawFindTargets(st, now);

  // mage telegraph
  for (const e of st.enemies) {
    if (e.type === 'mage' && e.target) {
      sprite(sprites.telegraph[Math.floor(now / 160) % 2], e.target[0], e.target[1], {
        glow: 8, glowColor: '#b18cff',
      });
    }
  }

  // bombs
  for (const b of st.bombs) {
    const urgent = b.fuse <= 2;
    const set = urgent ? sprites.bombUrgent : sprites.bomb;
    const f = set[Math.floor(now / (urgent ? 110 : 260)) % 2];
    const puff = urgent ? 1 + 0.06 * Math.sin(now / 60) : 1;
    sprite(f, b.x, b.y, { scale: puff, glow: urgent ? 10 : 0, glowColor: '#ff3b3b' });
    // variant bombs telegraph their nature on the shell
    if (b.kind === 'grep') glyph('≡', b.x, b.y + 0.16, '#ff5566', 0.34, urgent ? 8 : 4);
    else if (b.kind === 'sed') glyph('§', b.x, b.y + 0.16, '#7ce9a2', 0.34, urgent ? 8 : 4);
    glyph(String(Math.max(0, b.fuse)), b.x + 0.3, b.y - 0.32, urgent ? '#ff9d9d' : '#ffe9a0', 0.28);
  }

  // projectiles
  for (const p of st.projectiles) {
    sprite(p.dx !== 0 ? sprites.boltH : sprites.boltV, p.x, p.y, {
      flip: p.dx < 0, glow: 10, glowColor: '#b18cff',
    });
  }

  // linter beams (450ms flash)
  sweeps = sweeps.filter((sw) => now - sw.t0 < 450);
  for (const sw of sweeps) {
    const age = (now - sw.t0) / 450;
    ctx.fillStyle = `rgba(255, 80, 80, ${0.5 * (1 - age)})`;
    for (const [x, y] of sw.tiles) {
      ctx.fillRect(x * CELL, y * CELL + CELL * 0.28, CELL, CELL * 0.44);
    }
  }

  // explosions (420ms, 4 sprite frames)
  explosions = explosions.filter((ex) => now - ex.t0 < 420);
  for (const ex of explosions) {
    const age = (now - ex.t0) / 420;
    const f = sprites.explosion[Math.min(3, Math.floor(age * 4))];
    sprite(f, ex.x, ex.y, { glow: 16 * (1 - age), glowColor: '#ffd23f', scale: 1 + age * 0.25 });
  }

  // enemies (ground layer)
  for (const e of st.enemies) drawEnemy(e, now);
  ctx.restore(); // end ground pass

  // ---- sky pass ----
  if (st.skyGrid) {
    ctx.save();
    if (aloft) {
      drawTerrain(st, st.skyGrid, now, true);
      drawGridlines(st);
      drawFindTargets(st, now);
      // the welcoming committee, seen through the cloud floor — you must be
      // able to track your landing (docs/new-mechanics.md, sky rendering)
      for (const e of st.enemies) drawEnemy(e, now, 0.35);
      for (const b of st.bombs) {
        const f = (b.fuse <= 2 ? sprites.bombUrgent : sprites.bomb)[0];
        sprite(f, b.x, b.y, { alpha: 0.35 });
      }
    } else {
      // faint silhouettes so the cloud route can be pre-read from the ground
      ctx.globalAlpha = 0.13;
      for (let y = 0; y < st.H; y++) {
        for (let x = 0; x < st.W; x++) {
          const c = st.skyGrid[y][x];
          if (c === '~') continue;
          if (c === '#') sprite(sprites.thunderhead, x, y, { alpha: 0.22 });
          else sprite(sprites.cloud, x, y);
        }
      }
    }
    ctx.restore();
  }

  // ---- player ----
  const pt = tween(st.player);
  if (st.status === 'dead') {
    sprite(sprites.playerDead, pt.x, pt.y);
  } else if (!(st.player.iframes > 0 && blink)) {
    sprite(sprites.player[anim2], pt.x, pt.y, {
      flip: pt.face < 0,
      glow: aloft ? 14 : 5,
      glowColor: aloft ? '#d8f4fc' : '#33ff66',
    });
  }

  // ---- particles ----
  particles = particles.filter((p) => (p.age += dt) < p.ttl);
  for (const p of particles) {
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const fade = 1 - p.age / p.ttl;
    ctx.globalAlpha = fade;
    ctx.fillStyle = p.color;
    const s = Math.max(1, p.size * CELL * fade);
    ctx.fillRect(p.x * CELL - s / 2, p.y * CELL - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  ctx.restore(); // end GUT translate
  ctx.restore();

  // ---- damage flash ----
  if (flashRed > 0.02) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(255,59,59,${flashRed * 0.35})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    flashRed *= 0.86;
  }
}
