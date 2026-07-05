// Persistent progress in localStorage.
import type { VocabGroup } from '../engine/types';

export interface LevelRecord {
  bestKeys: number;
  stars: number;
}

export interface SaveData {
  v: 2;
  unlocked: number;
  /** collected keycap vocab groups (progressive disclosure) */
  keycaps: VocabGroup[];
  levels: Record<string, LevelRecord>;
  /** chapter-card levels already shown (docs/story.md — once per save) */
  chapters: number[];
  settings: { sound: boolean; crt: boolean };
}

const SAVE_KEY = 'vimberman.save.v1';

/** which level (1-based) teaches each vocab group — used for save migration:
 * reaching past a teaching level implies owning its keycap. */
export const GROUP_LEVEL: Record<VocabGroup, number> = {
  core: 0, count: 2, find: 3, edit: 4, word: 5, line: 6, cw: 8, inner: 11, sky: 12,
  mark: 14, match: 15, search: 16, macro: 19,
  // dot's teaching level doesn't exist yet (TODO 6.3 slots it) — until then no
  // save can auto-own it and no keycap grants it; engine/tests use setVocab(null)
  dot: 20,
};

function fresh(): SaveData {
  return { v: 2, unlocked: 1, keycaps: ['core'], levels: {}, chapters: [], settings: { sound: true, crt: true } };
}

export const save: SaveData = fresh();
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const d = JSON.parse(raw);
    if (d && (d.v === 1 || d.v === 2)) {
      Object.assign(save, d);
      save.v = 2;
      save.settings = { sound: true, crt: true, ...d.settings };
      // v1 saves (and any level-skips) imply the keycaps of every level reached
      const owned = new Set<VocabGroup>(Array.isArray(d.keycaps) ? d.keycaps : []);
      owned.add('core');
      for (const g in GROUP_LEVEL) {
        if (GROUP_LEVEL[g as VocabGroup] !== 0 && save.unlocked > GROUP_LEVEL[g as VocabGroup]) {
          owned.add(g as VocabGroup);
        }
      }
      save.keycaps = [...owned];
    }
  }
} catch {
  // fresh save
}

export function persist(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // storage unavailable — play on without persistence
  }
}

export function resetProgress(): void {
  save.unlocked = 1;
  save.levels = {};
  save.keycaps = ['core'];
  save.chapters = [];
  persist();
}
