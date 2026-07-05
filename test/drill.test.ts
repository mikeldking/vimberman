// Drill-mode arenas (src/ui/drills.ts): every drill must be a safe, static,
// save-neutral practice room, and its authored solution is the par proof —
// written in the drill's own vocabulary (core + the drilled group only).
import { describe, it, expect, beforeAll } from 'vitest';
import * as game from '../src/engine/engine';
import { expand } from '../src/engine/script';
import { DRILLS } from '../src/ui/drills';

beforeAll(() => {
  game.setVocab(null); // engine default: everything unlocked
  game.setLevels(DRILLS.map((d) => d.def));
});

describe('drill arena invariants', () => {
  it('covers each vocab group exactly once, in tray order', () => {
    expect(DRILLS.map((d) => d.group)).toEqual(game.VOCAB_GROUPS.map((g) => g.id));
  });

  for (const { group, def } of DRILLS) {
    it(`${group} — ${def.name} is static, enemy-free and save-neutral`, () => {
      const rows = [...def.map, ...(def.sky ?? [])];
      for (const row of rows) {
        expect(row.length).toBe(def.map[0].length); // rectangular
        expect(row).not.toMatch(/[ZIMQY!]/); // no enemies, no linters
        expect(row).not.toContain('?'); // no keycaps — drills grant nothing
      }
      expect(def.keycaps).toBeUndefined();
      expect(def.map.join('')).toContain('E');
    });
  }
});

describe('drill par proofs', () => {
  DRILLS.forEach(({ group, def }, i) => {
    it(`${group} — ${def.name}: solution wins within par ${def.par}`, () => {
      const st = game.loadLevel(i);
      for (const k of expand(def.solution!)) {
        if (st.status !== 'play') break;
        game.key(k);
      }
      expect(st.status, `${def.name} ended ${st.status} at ${st.player.x},${st.player.y} after ${st.keys} keys (echo: ${st.echo})`).toBe('won');
      expect(st.keys, `${def.name} used ${st.keys} keys vs par ${def.par}`).toBeLessThanOrEqual(def.par);
    });
  });
});
