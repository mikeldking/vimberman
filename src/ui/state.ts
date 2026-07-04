// Shared mutable UI state (screen machine position), split out so the
// renderer, HUD and screen modules can all read it without import cycles.

export type Screen =
  | 'TITLE' | 'SELECT' | 'HELP' | 'SETTINGS' | 'INTRO'
  | 'GAME' | 'PAUSE' | 'DEAD' | 'FAIL' | 'CLEAR';

export const ui = {
  screen: 'TITLE' as Screen,
  currentLevel: 1,
};
