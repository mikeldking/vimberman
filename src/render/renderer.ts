// Canvas renderer: draws the world from engine state using the pixel-art
// atlas, with tweened entity movement, particles, screen shake and glow.
import * as game from '../engine/engine';
import type { Enemy, Player } from '../engine/types';
import { buildSprites, cellHash, type Frame, type SpriteSet } from './sprites';
import { updateHud } from '../ui/hud';

const FONT = '"IBM Plex Mono", Menlo, Consolas, monospace';

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let sprites: SpriteSet;
let CELL = 44;
let DPR = 1;

// transient view state
let shake = 0;
let flashRed = 0;
interface Boom { x: number; y: number; t0: number }
let explosions: Boom[] = [];
interface Particle {
  x: number; y: number; vx: number; vy: number;
  age: number; ttl: number; color: string; size: number; gravity: number;
}
let particles: Particle[] = [];
let lastFrame = 0;

interface Tween { x: number; y: number; face: number }
const tweens = new WeakMap<Player | Enemy, Tween>();

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
  // Fill the viewport: leave room for HUD, statusline, and CRT chrome.
  const availW = window.innerWidth - 90;
  const availH = window.innerHeight - 150;
  CELL = Math.max(36, Math.min(110, Math.floor(Math.min(availW / W, availH / H))));
  DPR = window.devicePixelRatio || 1;
  canvas.width = Math.round(W * CELL * DPR);
  canvas.height = Math.round(H * CELL * DPR);
  canvas.style.width = W * CELL + 'px';
  canvas.style.height = H * CELL + 'px';
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
  const anim2 = Math.floor(now / 320) % 2; // walk cycles
  const anim2slow = Math.floor(now / 550) % 2; // ambient tiles

  // ---- terrain + floor overlays ----
  for (let y = 0; y < st.H; y++) {
    for (let x = 0; x < st.W; x++) {
      const c = st.grid[y][x];
      const h = cellHash(x, y);
      if (c === '#') { sprite(sprites.wall, x, y); continue; }
      if (c === '~') { sprite(sprites.gap[(h + anim2slow) % 2], x, y); continue; }
      sprite(sprites.floor[h % 3], x, y);
      if (c === '%') sprite(sprites.rock, x, y);
      else if (c === '&') sprite(sprites.hard, x, y);
      else if (c === '*') sprite(sprites.bush[(h + anim2slow) % 2], x, y);
      else if (c === 'E') {
        const pulse = 8 + 5 * Math.sin(now / 260);
        sprite(sprites.exit[anim2slow], x, y, { glow: pulse, glowColor: '#33ff66' });
      } else if (c >= 'a' && c <= 'z') {
        sprite(sprites.keycap, x, y);
        glyph(c, x, y - 0.07, '#4dd0e1', 0.4);
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

  // ---- mage telegraph ----
  for (const e of st.enemies) {
    if (e.type === 'mage' && e.target) {
      sprite(sprites.telegraph[Math.floor(now / 160) % 2], e.target[0], e.target[1], {
        glow: 8, glowColor: '#b18cff',
      });
    }
  }

  // ---- bombs ----
  for (const b of st.bombs) {
    const urgent = b.fuse <= 2;
    const set = urgent ? sprites.bombUrgent : sprites.bomb;
    const f = set[Math.floor(now / (urgent ? 110 : 260)) % 2];
    const puff = urgent ? 1 + 0.06 * Math.sin(now / 60) : 1;
    sprite(f, b.x, b.y, { scale: puff, glow: urgent ? 10 : 0, glowColor: '#ff3b3b' });
    glyph(String(Math.max(0, b.fuse)), b.x + 0.3, b.y - 0.32, urgent ? '#ff9d9d' : '#ffe9a0', 0.28);
  }

  // ---- projectiles ----
  for (const p of st.projectiles) {
    sprite(p.dx !== 0 ? sprites.boltH : sprites.boltV, p.x, p.y, {
      flip: p.dx < 0, glow: 10, glowColor: '#b18cff',
    });
  }

  // ---- explosions (420ms, 4 sprite frames) ----
  explosions = explosions.filter((ex) => now - ex.t0 < 420);
  for (const ex of explosions) {
    const age = (now - ex.t0) / 420;
    const f = sprites.explosion[Math.min(3, Math.floor(age * 4))];
    sprite(f, ex.x, ex.y, { glow: 16 * (1 - age), glowColor: '#ffd23f', scale: 1 + age * 0.25 });
  }

  // ---- enemies ----
  for (const e of st.enemies) {
    const t = tween(e);
    if (e.type === 'zombie') {
      sprite(sprites.zombie[anim2], t.x, t.y, { flip: t.face < 0 });
    } else if (e.type === 'imp') {
      sprite(sprites.imp[anim2], t.x, t.y, { flip: t.face < 0 });
    } else if (e.mstate === 'port') {
      sprite(sprites.magePort, t.x, t.y, { alpha: 0.55, glow: 8, glowColor: '#54ffe0' });
    } else {
      sprite(sprites.mage[anim2], t.x, t.y, { flip: t.face < 0, glow: 4, glowColor: '#b18cff' });
    }
  }

  // ---- player ----
  const pt = tween(st.player);
  if (st.status === 'dead') {
    sprite(sprites.playerDead, pt.x, pt.y);
  } else if (!(st.player.iframes > 0 && blink)) {
    sprite(sprites.player[anim2], pt.x, pt.y, {
      flip: pt.face < 0, glow: 5, glowColor: '#33ff66',
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
