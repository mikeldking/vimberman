// Every sprite grid is validated at build time (16×16, known palette keys) —
// building the full set proves no row is miscounted.
import { describe, it, expect, beforeAll } from 'vitest';
import { installDom } from './stubs';

beforeAll(() => {
  installDom();
});

describe('sprite atlas', () => {
  it('builds every sprite without validation errors', async () => {
    const { buildSprites } = await import('../src/render/sprites');
    const s = buildSprites();
    expect(s.player.length).toBe(2);
    expect(s.explosion.length).toBe(4);
    expect(s.floor.length).toBe(3);
    expect(Object.keys(s.oneway)).toEqual(['<', '>', '^', 'V']);
  });

  it('cellHash is deterministic and varies by cell', async () => {
    const { cellHash } = await import('../src/render/sprites');
    expect(cellHash(3, 5)).toBe(cellHash(3, 5));
    const vals = new Set([cellHash(0, 0), cellHash(1, 0), cellHash(0, 1), cellHash(2, 7)]);
    expect(vals.size).toBeGreaterThan(1);
  });
});
