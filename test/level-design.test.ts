// Static authoring checks for the level campaign. The solve harness proves
// routes; this file catches design/data drift before a route even runs.
import { describe, it, expect, beforeEach } from 'vitest';
import * as game from '../src/engine/engine';
import { expand } from '../src/engine/script';
import { LEVELS } from '../src/levels';
import designDoc from '../docs/level-design.md?raw';
import type { LevelDef } from '../src/engine/types';
import { ROUTES } from './level-routes';

function tile(lv: LevelDef, key: string): string | undefined {
  const sky = key.startsWith('sky:');
  const raw = sky ? key.slice(4) : key;
  const [x, y] = raw.split(',').map(Number);
  const rows = sky ? lv.sky : lv.map;
  return rows?.[y]?.[x];
}

function allRows(lv: LevelDef) {
  return [...lv.map, ...(lv.sky ?? [])];
}

function runKeys(script: string) {
  for (const k of expand(script)) game.key(k);
}

function terminalId(levelIdx: number, coord: string) {
  return `${levelIdx + 1}:${coord}`;
}

function routeCount(levelNumber: number) {
  return 1 + Object.keys(ROUTES[levelNumber] ?? {}).length;
}

const TERMINAL_PROOFS: Record<string, { solve: string; primedDot?: boolean }> = {
  '4:3,3': { solve: 'l ro' },
  '4:8,7': { solve: '2l x' },
  '6:5,5': { solve: '2l x' },
  '6:7,5': { solve: 'f# x x' },
  '8:2,3': { solve: 'cw bomb <e>' },
  '8:7,3': { solve: 'cw sed <e>' },
  '8:1,5': { solve: 'l 3l 3l' },
  '9:9,9': { solve: 'cw bomb <e>' },
  '11:6,3': { solve: '~ ~ ~ ~' },
  '11:5,7': { solve: 'ciw bomb <e>' },
  '11:12,9': { solve: '~' },
  '15:4,3': { solve: 'l ro' },
  '17:5,1': { solve: 'cw bomb <e>' },
  '17:11,1': { solve: '.', primedDot: true },
  '17:14,1': { solve: '.', primedDot: true },
  '18:2,1': { solve: 'l re' },
  '18:7,1': { solve: 'll re' },
  '18:12,1': { solve: 'l ro' },
  '19:12,1': { solve: 'l ro 2l ~' },
  '19:5,9': { solve: 'ciw bomb <e>' },
  '19:5,7': { solve: 'h $' },
};

function makeTermLevel(levelIdx: number, coord: string): LevelDef {
  const source = LEVELS[levelIdx];
  const def = source.terminals[coord];
  return {
    name: `${source.name} ${coord}`,
    teaches: source.teaches,
    intro: [],
    map: ['#####', '#PT.#', '#####'],
    terminals: { '2,1': def },
    par: 20,
    limit: 100,
  };
}

describe('level design infrastructure', () => {
  beforeEach(() => {
    game.setVocab(null);
  });

  it('campaign metadata stays in sync with the authored level array', () => {
    expect(LEVELS).toHaveLength(21);
    expect(designDoc).toContain(`Vimberman has ${LEVELS.length} levels`);
    for (const [i, lv] of LEVELS.entries()) {
      const row = designDoc.split('\n').find((line) => line.startsWith(`| ${i + 1} | ${lv.name} |`));
      expect(row, `docs table needs L${i + 1} ${lv.name}`).toBeTruthy();
      expect(row, `docs route count for L${i + 1} must match verified routes`).toMatch(new RegExp(`\\| ${routeCount(i + 1)} \\|$`));
    }
  });

  it('maps, overlays, and authored coordinate tables are internally consistent', () => {
    for (const [i, lv] of LEVELS.entries()) {
      const label = `L${i + 1} ${lv.name}`;
      const width = lv.map[0].length;
      expect(lv.map.every((row) => row.length === width), `${label}: ground map is rectangular`).toBe(true);
      if (lv.sky) {
        expect(lv.sky, `${label}: sky height matches ground`).toHaveLength(lv.map.length);
        expect(lv.sky.every((row) => row.length === width), `${label}: sky width matches ground`).toBe(true);
      }

      expect(lv.map.join('').match(/P/g) ?? [], `${label}: one ground spawn`).toHaveLength(1);
      expect(allRows(lv).join('')).toContain('E');
      expect(lv.solution, `${label}: needs a par-proof solution`).toBeTruthy();
      expect(lv.hint, `${label}: needs a tactical hint`).toBeTruthy();
      expect(lv.limit, `${label}: limit must be at least par`).toBeGreaterThanOrEqual(lv.par);

      for (const coord of Object.keys(lv.terminals)) {
        expect(tile(lv, coord), `${label}: terminal ${coord} must sit on T`).toBe('T');
      }
      const terminalDefs = new Set(Object.keys(lv.terminals));
      lv.map.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === 'T') expect(terminalDefs.has(`${x},${y}`), `${label}: T at ${x},${y} needs a def`).toBe(true);
      }));

      for (const coord of Object.keys(lv.bushes ?? {})) {
        expect(tile(lv, coord), `${label}: bush ${coord} must sit on *`).toBe('*');
      }
      for (const coord of Object.keys(lv.keycaps ?? {})) {
        expect(tile(lv, coord), `${label}: keycap ${coord} must sit on ?`).toBe('?');
      }
      for (const coord of Object.keys(lv.linters ?? {})) {
        expect(tile(lv, coord), `${label}: linter ${coord} must sit on !`).toBe('!');
      }
    }
  });

  it('item placement follows the level-design rules that can be checked mechanically', () => {
    for (const [i, lv] of LEVELS.entries()) {
      const label = `L${i + 1} ${lv.name}`;
      const glyphs = allRows(lv).join('');
      const drops = Object.values(lv.bushes ?? {});
      if (!glyphs.includes('&') && !glyphs.includes('%')) {
        expect(drops.filter((drop) => drop.type === 'R'), `${label}: R only belongs where blast radius changes rock play`).toHaveLength(0);
      }
      for (const drop of drops) {
        expect(drop.amt, `${label}: bush drops must be positive`).toBeGreaterThan(0);
      }
    }
  });

  it('terminal minigame prompts are explicit and have independently verified solves', () => {
    const terminalIds = LEVELS.flatMap((lv, i) => Object.keys(lv.terminals).map((coord) => terminalId(i, coord)));
    expect(Object.keys(TERMINAL_PROOFS).sort()).toEqual(terminalIds.sort());

    for (const [levelIdx, lv] of LEVELS.entries()) {
      for (const [coord, def] of Object.entries(lv.terminals)) {
        const id = terminalId(levelIdx, coord);
        const label = `L${levelIdx + 1} ${lv.name} ${coord}`;
        expect(def.hint, `${label}: terminal needs a visible prompt`).toBeTruthy();
        expect(def.grants, `${label}: terminal reward must fit the arsenal cap`).toBeGreaterThan(0);
        expect(def.grants, `${label}: terminal reward must fit the arsenal cap`).toBeLessThanOrEqual(3);
        if ((def.kind ?? 'fix') === 'golf') {
          expect(def.strokes, `${label}: golf needs an exact stroke budget`).toBeGreaterThan(0);
        }
        if (def.kind === 'coins' || def.kind === 'spark') {
          expect(def.deadline, `${label}: timed collection needs a deadline`).toBeGreaterThan(0);
          expect(def.broken).toContain(def.coin ?? 'o');
        }

        game.setLevels([makeTermLevel(levelIdx, coord)]);
        const st = game.loadLevel(0);
        if (TERMINAL_PROOFS[id].primedDot) st.lastEdit = { keys: expand('cw bomb <e>') };
        runKeys(`l i ${TERMINAL_PROOFS[id].solve}`);
        expect(st.mode, `${label}: proof should close the terminal`).toBe('normal');
        expect(st.terminals['2,1'].solved, `${label}: proof should solve the prompt`).toBe(true);
        expect(st.player.bombs, `${label}: proof should pay out`).toBeGreaterThan(0);
      }
    }
  });
});
