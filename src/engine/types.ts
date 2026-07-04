// Shared domain types for the Vimberman engine.

export type ItemType = 'K' | 'R' | 'U' | 'B';

export interface BushDrop {
  type: ItemType;
  amt: number;
}

export interface TerminalDef {
  broken: string;
  target: string;
  grants: number;
  hint?: string;
}

export type Leash = 'row' | 'col';

export interface EnemyOpts {
  leash?: Leash;
  /** zombies: overrides the spawn-order tick-parity offset */
  phase?: number;
}

export interface LinterDef {
  period?: number;
  warn?: number;
  phase?: number;
}

/** Motion vocabulary groups unlockable via keycap (`?`) pickups. */
export type VocabGroup =
  | 'core' | 'count' | 'find' | 'edit' | 'word' | 'line' | 'cw' | 'inner' | 'sky';

export interface LevelDef {
  name: string;
  teaches: string;
  intro: string[];
  map: string[];
  /** optional cloud layer, same dimensions as map (see docs/new-mechanics.md) */
  sky?: string[];
  terminals: Record<string, TerminalDef>;
  bushes?: Record<string, BushDrop>;
  enemyOpts?: Record<string, EnemyOpts>;
  /** "x,y" of a `?` tile -> vocab group it grants */
  keycaps?: Record<string, VocabGroup>;
  /** "x,y" of a `!` wall emitter -> sweep cadence */
  linters?: Record<string, LinterDef>;
  /** one-line :hint text (technique, not route) */
  hint?: string;
  /** reference keystroke script — the par proof, shared with solve tests */
  solution?: string;
  /** line-number gutter (default true; level 1 turns it off) */
  gutter?: boolean;
  par: number;
  limit: number;
}

export type EnemyType = 'zombie' | 'imp' | 'mage' | 'toad';
export type MageState = 'cool' | 'tele' | 'port';

export interface Enemy {
  type: EnemyType;
  x: number;
  y: number;
  /** zombies: offsets their every-other-tick cadence */
  phase?: number;
  /** imps: ticks since the imp last laid a bomb */
  sinceBomb?: number;
  mstate?: MageState;
  timer?: number;
  target?: [number, number] | null;
  immune?: boolean;
  leash?: Leash;
  /** patrol sweep direction for leashed enemies */
  dir?: number;
  /** toads: ticks until the next hop (3-tick cycle) */
  hop?: number;
  /** toads: ticks left belly-up; 0/undefined = upright */
  flip?: number;
}

export interface Bomb {
  x: number;
  y: number;
  fuse: number;
  r: number;
  /** true while the player still stands on it (may be walked off, not through) */
  soft: boolean;
  imp?: boolean;
  done?: boolean;
}

export interface Projectile {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export interface Terminal {
  key: string;
  broken: string;
  target: string;
  grants: number;
  hint?: string;
  buffer: string[];
  cursor: number;
  solved: boolean;
}

export interface Player {
  x: number;
  y: number;
  bombs: number;
  radius: number;
  undo: number;
  iframes: number;
}

export interface Pending {
  count: string;
  op: string | null;
}

export interface TermSession {
  t: Terminal;
  insert: boolean;
  pending: Pending;
}

export type Status = 'play' | 'won' | 'dead' | 'fail';
export type Mode = 'normal' | 'terminal';

export interface FindMemo {
  cmd: 'f' | 'F' | 't' | 'T';
  ch: string;
}

export type Layer = 'ground' | 'sky';

export interface Linter {
  x: number;
  y: number;
  period: number;
  warn: number;
  phase: number;
}

export type LinterState = 'idle' | 'warn' | 'fire';

export interface GameState {
  idx: number;
  lv: LevelDef;
  grid: string[][];
  /** cloud layer grid, aligned to `grid`; null when the level has no sky */
  skyGrid: string[][] | null;
  /** which layer the player currently occupies */
  layer: Layer;
  W: number;
  H: number;
  player: Player;
  enemies: Enemy[];
  bombs: Bomb[];
  projectiles: Projectile[];
  terminals: Record<string, Terminal>;
  linters: Linter[];
  keys: number;
  tick: number;
  limit: number;
  par: number;
  mode: Mode;
  term: TermSession | null;
  pending: Pending;
  lastFind: FindMemo | null;
  lastCmd: string;
  echo: string;
  status: Status;
  deathMsg: string;
  rng: () => number;
  history: string[];
  explosionsThisTick: Array<[number, number]>;
  /** stats for the clear card */
  bonks: number;
  cmdCounts: Record<string, number>;
}

/** Presentation hooks the UI layer overrides; the engine runs headless with no-ops. */
export interface FxHooks {
  error(msg?: string): void;
  moved(): void;
  bomb(): void;
  explosion(tiles: Array<[number, number]>): void;
  solved(t: Terminal): void;
  item(type: ItemType, amt: number): void;
  rescue(): void;
  death(msg: string): void;
  win(): void;
  fail(): void;
  wantPause(): void;
  enterTerm(t: Terminal): void;
  exitTerm(): void;
  telegraph(target: [number, number]): void;
  tick(): void;
  collectBush(type: ItemType): void;
  /** a flight motion just flipped n toads */
  flip(n: number): void;
  /** the player squashed a flipped toad (+2 budget) */
  squash(): void;
  /** a linter beam fired over these tiles */
  sweep(tiles: Array<[number, number]>): void;
  /** rose to / dropped from the cloud layer */
  rise(): void;
  drop(): void;
  /** collected a keycap granting a vocab group */
  keycap(group: VocabGroup): void;
  /** a locked (not-yet-unlocked) key was pressed — free, no tick */
  locked(key: string): void;
}
