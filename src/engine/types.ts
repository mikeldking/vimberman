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
}

export interface LevelDef {
  name: string;
  teaches: string;
  intro: string[];
  map: string[];
  terminals: Record<string, TerminalDef>;
  bushes?: Record<string, BushDrop>;
  enemyOpts?: Record<string, EnemyOpts>;
  par: number;
  limit: number;
}

export type EnemyType = 'zombie' | 'imp' | 'mage';
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

export interface GameState {
  idx: number;
  lv: LevelDef;
  grid: string[][];
  W: number;
  H: number;
  player: Player;
  enemies: Enemy[];
  bombs: Bomb[];
  projectiles: Projectile[];
  terminals: Record<string, Terminal>;
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
}
