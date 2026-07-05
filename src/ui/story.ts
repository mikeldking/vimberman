// All narrative copy, verbatim from docs/story.md. Two voices live in this
// game: the editor (sentence case, everywhere else) and The Legacy —
// lowercase `//` comments, FAIL/DEAD cards only, never on CLEAR. No story
// strings belong anywhere but here.

export interface Chapter {
  level: number;
  title: string;
  lines: string[];
}

export const CHAPTERS: Chapter[] = [
  {
    level: 1,
    title: 'CHAPTER ONE — ONBOARDING',
    lines: [
      'somewhere below, a build has been failing for nine years.',
      'nobody reads the logs. nobody runs the tests.',
      'tonight, in an abandoned buffer, a cursor blinks on.',
      'that\'s you. move like you mean it.',
    ],
  },
  {
    level: 5,
    title: 'CHAPTER TWO — THE ROT SPREADS',
    lines: [
      'you fixed four files, and something noticed.',
      'the deprecations are walking. the tests are hopping.',
      'deeper in, the rules themselves stop being on your side.',
      'all of this was written by someone. all of it was left here.',
      'keep your words together and your rows clean.',
    ],
  },
  {
    level: 11,
    title: 'CHAPTER THREE — MERGE CONFLICT',
    lines: [
      'the core modules. the ones nobody was allowed to touch.',
      'in here the rot doesn\'t shamble. it races you for the cycle.',
      'above the code, the comment layer. nothing executes there.',
      'one refactor left. write it clean, quit clean.',
      ':wq is earned, not typed.',
    ],
  },
];

export const LEGACY_FAIL: string[] = [
  '// the cursor grows still. like all the others did.',
  '// out of budget. I shipped worse than this, in my day.',
  '// don\'t take it hard. entropy is a team player.',
];

export const LEGACY_DEAD: string[] = [
  '// another process joins the legacy. plenty of room.',
  '// I was efficient once, too. then I accumulated.',
  '// stay. the maintenance never ends, and nobody minds it here.',
];

export const ENEMY_LORE: Record<'zombie' | 'imp' | 'toad' | 'mage' | 'linter', string> = {
  zombie: 'a deprecated call nobody removed. it still runs, every other tick, forever.',
  imp: 'a hotfix that went feral. still ships patches on schedule. still doesn\'t check the radius.',
  toad: 'a flaky test. green twice, then it lunges. flip it and it finally reports consistently.',
  mage: 'a race condition. never where you checked. always aligned the moment you stop looking.',
  linter: 'the old CI. rules intact, judgment gone. the margins survive because nothing was written there.',
};
