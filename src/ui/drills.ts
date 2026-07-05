// Drill mode — freeform practice arenas, one per motion vocabulary group
// (docs/TODO.md 6.4, premise.md audience #1: "an arcade excuse to drill
// motions until they're reflexive").
//
// Rules of the dojo:
//  - static arenas, no enemies, no linters, no keycaps — nothing to lose
//  - coin-style targets (bare K tiles, +1 budget each) mark the reps
//  - entered from the title menu; NOTHING here touches the save file
//  - a drill is listed once its group's keycap is owned in the campaign
//
// Solutions are written in the drill's own vocabulary (core + the drilled
// group only) — they are the par proofs, verified in test/drill.test.ts.
import type { LevelDef, VocabGroup } from '../engine/types';

export interface Drill {
  group: VocabGroup;
  def: LevelDef;
}

export const DRILLS: Drill[] = [
  {
    group: 'core',
    def: {
      name: 'FOOTWORK',
      teaches: 'h j k l — the four sacred directions',
      intro: ['A serpentine. Coins at the corners.', 'No enemies. No clock. Just you and the home row.'],
      map: [
        '#############',
        '#P........KK#',
        '###########.#',
        '#KK.......KK#',
        '#.###########',
        '#KK.......KK#',
        '###########.#',
        '#E........KK#',
        '#############',
      ],
      terminals: {},
      hint: 'walk the snake. sweep every coin. feel the grid.',
      solution: 'llllllllll jj hhhhhhhhhh jj llllllllll jj hhhhhhhhhh',
      par: 46, limit: 110,
    },
  },
  {
    group: 'count',
    def: {
      name: 'BY THE NUMBERS',
      teaches: 'counts: 12l 8j — one command per corridor',
      intro: ['A spiral. Your bare h j k l are WORN OUT in here.', 'Count the run, type the number, own the corridor.'],
      map: [
        '###############',
        '#P...........K#',
        '#############.#',
        '#K..........#.#',
        '#.#########.#.#',
        '#.#K.....E#.#.#',
        '#.#.#######.#.#',
        '#.#K........#.#',
        '#.###########.#',
        '#K............#',
        '###############',
      ],
      terminals: {},
      banned: ['h', 'j', 'k', 'l'],
      hint: 'the gutter numbers ARE the answer. read, type, arrive.',
      solution: '12l 8j 12h 6k 10l 4j 8h 2k 6l',
      par: 21, limit: 48,
    },
  },
  {
    group: 'find',
    def: {
      name: 'DASH CLINIC',
      teaches: 'f F t ; — dash to the letter',
      intro: ['Three lanes: dash right, dash left, stop short.', 'The gaps only exist for people who walk.'],
      map: [
        '###############',
        '#P.~~a..~~a..K#',
        '#############.#',
        '#K..b~~..b~~..#',
        '#.#############',
        '#..c~~.c~~.cKE#',
        '###############',
      ],
      terminals: {},
      hint: 'fa then ; — the second dash is one key. so is the third.',
      solution: 'fa ; lll jj Fb ; hhh jj tc l ; l ; lll',
      par: 25, limit: 52,
    },
  },
  {
    group: 'edit',
    def: {
      name: 'TYPO TRIAGE',
      teaches: 'i x r — four patients, four typos',
      intro: ['Four code-tiles, four one-character diseases.', 'x deletes. r replaces. The cursor is the scalpel.'],
      map: [
        '###############',
        '#P..T....T...K#',
        '#############.#',
        '#E...T....T..K#',
        '###############',
      ],
      terminals: {
        '4,1': { broken: 'bpmb', target: 'bomb', grants: 1, hint: 'l ro' },
        '9,1': { broken: 'boamb', target: 'bomb', grants: 1, hint: 'll x' },
        '10,3': { broken: 'xbomb', target: 'bomb', grants: 1, hint: 'x' },
        '5,3': { broken: 'bommb', target: 'bomb', grants: 1, hint: 'll x' },
      },
      hint: 'diagnose before you cut. every fix is two or three keys.',
      solution: 'lll i l ro lllll i ll x llll jj hhh i x hhhhh i ll x hhhh',
      par: 40, limit: 85,
    },
  },
  {
    group: 'word',
    def: {
      name: 'GAP HOPPER',
      teaches: 'w b e — words are stepping stones',
      intro: ['Three rows of words over three rows of nothing.', 'w forward, b back, e to the ends. Feet never touch the gaps.'],
      map: [
        '###############',
        '#P.go~~far~~uK#',
        '#############.#',
        '#K.we~~go~~at.#',
        '#.#############',
        '#it~~on~~heKKE#',
        '###############',
      ],
      terminals: {},
      hint: 'one row all w, one row all b, one row all e. a triathlon.',
      solution: 'w w w l jj b b b hh jj e e e lll',
      par: 19, limit: 40,
    },
  },
  {
    group: 'line',
    def: {
      name: 'SLAM PRACTICE',
      teaches: '0 $ gg G — the four walls',
      intro: ['Coins line the edges of the room.', 'Slides sweep up everything they pass. Four keystrokes of larceny.'],
      map: [
        '###############',
        '#KK.KK.KK.KKKK#',
        '#.###########K#',
        '#.###########K#',
        '#.###########K#',
        '#KKKK....P...E#',
        '###############',
      ],
      terminals: {},
      hint: 'the perimeter is a racetrack: 0, gg, $, G. checkered flag at E.',
      solution: '0 gg $ G',
      par: 5, limit: 30,
    },
  },
  {
    group: 'cw',
    def: {
      name: 'WORD SURGERY',
      teaches: 'cw — total word replacement',
      intro: ['Four words beyond saving. cw wipes to the word end', 'and you type the transplant. Esc closes the incision.'],
      map: [
        '###############',
        '#P..T....T...K#',
        '#############.#',
        '#E..T....T...K#',
        '###############',
      ],
      terminals: {
        '4,1': { broken: 'dud', target: 'bomb', grants: 1, hint: 'cw bomb Esc' },
        '9,1': { broken: 'rusty', target: 'bomb', grants: 1, hint: 'cw bomb Esc' },
        '9,3': { broken: 'junk', target: 'bomb', grants: 1, hint: 'cw bomb Esc' },
        '4,3': { broken: 'fizz', target: 'sed', grants: 2, hint: 'cw sed Esc' },
      },
      hint: 'the word length never matters. cw eats dud and rusty alike.',
      solution: 'lll i cw bomb <e> lllll i cw bomb <e> llll jj hhhh i cw bomb <e> hhhhh i cw sed <e> hhh',
      par: 57, limit: 115,
    },
  },
  {
    group: 'inner',
    def: {
      name: 'CASE CLINIC',
      teaches: '~ and ciw — flips and transplants',
      intro: ['SHOUTING code, sTuDlY code, garbage code.', '~ flips a case and steps right. ciw erases from anywhere inside.'],
      map: [
        '###############',
        '#P..T....T...K#',
        '#############.#',
        '#E..T....T...K#',
        '###############',
      ],
      terminals: {
        '4,1': { broken: 'BOMB', target: 'bomb', grants: 1, hint: '~~~~' },
        '9,1': { broken: 'bOmB', target: 'bomb', grants: 1, hint: 'l~l~' },
        '9,3': { broken: 'zzzz', target: 'bomb', grants: 1, hint: 'ciw bomb Esc' },
        '4,3': { kind: 'golf', broken: 'Bomb', target: 'bomb', strokes: 1, grants: 1, hint: 'one stroke. you know the one.' },
      },
      hint: 'the golf tile at the end is a single keystroke. earn it.',
      solution: 'lll i ~~~~ lllll i l ~ l ~ llll jj hhhh i ciw bomb <e> hhhhh i ~ hhh',
      par: 47, limit: 95,
    },
  },
  {
    group: 'sky',
    def: {
      name: 'CLOUD LAPS',
      teaches: 'Ctrl-u Ctrl-d — commute by weather',
      intro: ['The ground has a hole in it. The sky does not.', 'Rise at one updraft, coast the coin lane, drop at the other.'],
      map: [
        '###############',
        '#P...@.~~~.@.E#',
        '###############',
      ],
      sky: [
        '###############',
        '#....@KKKKK@..#',
        '###############',
      ],
      terminals: {},
      bushes: {},
      hint: 'the moat is a ground-floor problem. you have a mezzanine.',
      solution: 'llll <C-u> llllll <C-d> ll',
      par: 14, limit: 30,
    },
  },
  {
    group: 'mark',
    def: {
      name: 'BREADCRUMBS',
      teaches: 'm{a} `{a} — leave a trail',
      intro: ['Three deep vaults, one long hallway.', 'Mark the door, dive for the coin, jump back. Free thinking, cheap travel.'],
      map: [
        '###############',
        '###K###K###K###',
        '###.###.###.###',
        '###.###.###.###',
        '###.###.###.###',
        '#P...........E#',
        '###############',
      ],
      terminals: {},
      hint: 'four k up is four keys. backtick-a home is two. do the math thrice.',
      solution: 'll ma kkkk `a llll ma kkkk `a llll ma kkkk `a ll',
      par: 36, limit: 75,
    },
  },
  {
    group: 'match',
    def: {
      name: 'BRACKET COMMUTE',
      teaches: '% — doors disguised as punctuation',
      intro: ['The floors of this building do not connect.', 'The brackets do. Stand on one, press %, be elsewhere.'],
      map: [
        '###############',
        '#P.(.KKK.....##',
        '###############',
        '#..[.KKK...).##',
        '###############',
        '#E....KKK..].##',
        '###############',
      ],
      terminals: {},
      hint: 'every ( has a ). every [ has a ]. the commute is one keystroke.',
      solution: 'll % hhhhhhhh % hhhhhhhhhh',
      par: 22, limit: 48,
    },
  },
  {
    group: 'dot',
    def: {
      name: 'ECHO CHAMBER',
      teaches: '. — type the fix once, ever',
      intro: ['Four tiles, one identical disease: mb.', 'Write the cure by hand once. The dot remembers the rest.'],
      map: [
        '###############',
        '#P..T....T...K#',
        '#############.#',
        '#E...T....T..K#',
        '###############',
      ],
      terminals: {
        '4,1': { broken: 'mb', target: 'bomb', grants: 1, hint: 'i bo Esc — then never type it again' },
        '9,1': { broken: 'mb', target: 'bomb', grants: 1, hint: '.' },
        '10,3': { kind: 'golf', broken: 'mb', target: 'bomb', strokes: 2, grants: 1, hint: 'two strokes allowed. you need one.' },
        '5,3': { broken: 'mb', target: 'bomb', grants: 1, hint: '.' },
      },
      hint: 'the first fix is five keys. the next three are one each.',
      solution: 'lll i i bo <e> lllll i . llll jj hhh i . hhhhh i . hhhh',
      par: 40, limit: 85,
    },
  },
  {
    group: 'search',
    def: {
      name: 'NEEDLE RUN',
      teaches: '/{word} n — teleport by grep',
      intro: ['Three bugs. Two uncrossable moats. One query.', 'Type it once; n remembers it forever.'],
      map: [
        '###############',
        '#P..bugK......#',
        '#~~~~~~~~~~~~~#',
        '#......bugK...#',
        '#~~~~~~~~~~~~~#',
        '#..bugK.....E.#',
        '###############',
      ],
      terminals: {},
      hint: 'the moats have no bridges. the query does not need one.',
      solution: '/bug<cr> lll n lll n lll llllll',
      par: 19, limit: 42,
    },
  },
  {
    group: 'macro',
    def: {
      name: 'ASSEMBLY LINE',
      teaches: 'q @ — do it once, ship it twice',
      intro: ['Three identical wings, one coin each.', 'Record the first wing by hand. Replay the other two for two keys apiece.'],
      map: [
        '#####################',
        '#P..#.....#.....#..E#',
        '###.#.###.#.###.#.###',
        '###.K.###.K.###.K.###',
        '#####################',
      ],
      terminals: {},
      hint: 'qa, walk one wing, q. then @a @a and clock out early.',
      solution: 'l qa l jj ll kk lll q @a @a',
      par: 15, limit: 32,
    },
  },
];
