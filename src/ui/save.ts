// Persistent progress in localStorage.

export interface LevelRecord {
  bestKeys: number;
  stars: number;
}

export interface SaveData {
  v: 1;
  unlocked: number;
  levels: Record<string, LevelRecord>;
  settings: { sound: boolean };
}

const SAVE_KEY = 'vimberman.save.v1';

function fresh(): SaveData {
  return { v: 1, unlocked: 1, levels: {}, settings: { sound: true } };
}

export const save: SaveData = fresh();
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const d = JSON.parse(raw);
    if (d && d.v === 1) {
      Object.assign(save, d);
      save.settings = { sound: true, ...d.settings };
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
  persist();
}
