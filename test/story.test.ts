// Tone-contract tests for the narrative copy — the binding rules in
// docs/story.md, encoded so story edits can't drift: The Legacy speaks in
// lowercase `//` comments with no exclamation marks; chapter cards stay
// small and skimmable; every enemy has a lore line.
import { describe, it, expect } from 'vitest';
import { CHAPTERS, ENEMY_LORE, LEGACY_DEAD, LEGACY_FAIL } from '../src/ui/story';

// lowercase except the pronoun "I" and short acronyms (CI) — entropy is
// lazy, not illiterate (docs/story.md tone rule 2)
const isLegacyCase = (s: string): boolean => {
  const norm = s.replace(/\b[A-Z]{1,3}\b/g, '');
  return norm === norm.toLowerCase();
};

describe('the legacy voice', () => {
  const lines = [...LEGACY_FAIL, ...LEGACY_DEAD];
  it('speaks only in lowercase code comments', () => {
    for (const l of lines) {
      expect(l.startsWith('// '), l).toBe(true);
      expect(isLegacyCase(l), l).toBe(true);
    }
  });
  it('never uses an exclamation mark', () => {
    for (const l of lines) expect(l.includes('!'), l).toBe(false);
  });
  it('has enough lines to rotate on both cards', () => {
    expect(LEGACY_FAIL.length).toBeGreaterThanOrEqual(3);
    expect(LEGACY_DEAD.length).toBeGreaterThanOrEqual(3);
  });
});

describe('chapter cards', () => {
  it('sit before levels 1, 5 and 11', () => {
    expect(CHAPTERS.map((c) => c.level)).toEqual([1, 5, 11]);
  });
  it('stay within one card: max 6 lines of ~60 chars, lowercase, no bangs', () => {
    for (const ch of CHAPTERS) {
      expect(ch.lines.length).toBeLessThanOrEqual(6);
      for (const l of ch.lines) {
        expect(l.length, `${ch.title}: ${l}`).toBeLessThanOrEqual(62);
        expect(isLegacyCase(l), l).toBe(true);
        expect(l.includes('!'), l).toBe(false);
      }
    }
  });
});

describe('enemy lore', () => {
  it('covers every symptom of the rot, in the right register', () => {
    for (const k of ['zombie', 'imp', 'toad', 'mage', 'linter'] as const) {
      const l = ENEMY_LORE[k];
      expect(l, k).toBeTruthy();
      expect(isLegacyCase(l), l).toBe(true);
      expect(l.includes('!'), l).toBe(false);
    }
  });
});
