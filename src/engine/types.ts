// Shared domain types for the Vimberman engine.

export type ItemType = 'K' | 'R' | 'U' | 'B';

/** Bomb variants — the word you craft selects the weapon (docs/arsenal.md). */
export type BombKind = 'bomb' | 'grep' | 'sed';

export interface BushDrop {
  type: ItemType;
  amt: number;
}

/**
 * Terminal minigame kinds (see docs/terminal-minigames.md):
 *  - fix:   edit the buffer until it equals `target` (the classic).
 *  - clean: delete every `glitch` char from a lint-infested snippet.
 *  - coins: land the cursor on every `coin` char before `deadline` ticks
 *           elapse in the session, or the cache respawns.
 *  - golf:  a fix with a hard in-tile keystroke budget (`strokes`);
 *           going over resets the buffer.
 *  - spark: coins plus a scan head sweeping one cell per tick — ending a
 *           keystroke under it ejects you and resets the tile.
 */
export type TermKind = 'fix' | 'clean' | 'coins' | 'golf' | 'spark';

export interface TerminalDef {
  kind?: TermKind;
  broken: string;
  /** fix / golf: the string the buffer must become */
  target?: string;
  /** clean: the char to purge (default '#') */
  glitch?: string;
  /** coins / spark: the char to collect (default 'o') */
  coin?: string;
  /** coins / spark: session ticks before the cache respawns (default 8) */
  deadline?: number;
  /** golf: keystrokes allowed inside the tile before it resets (default 8) */
  strokes?: number;
  grants: number;
  /** which bomb kind solving grants; default: the target word if it names a
   *  kind, else 'bomb' (docs/arsenal.md §1) */
  arms?: BombKind;
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
  | 'core' | 'count' | 'find' | 'edit' | 'word' | 'line' | 'cw' | 'inner' | 'sky'
  | 'mark' | 'match' | 'dot' | 'search' | 'macro';

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
  /** RNG seed pin (default: the level's index). Pin this on any level with
   *  free-roaming imps/mages so inserting levels before it can't reshuffle
   *  its dice and rot its authored solutions. */
  seed?: number;
  /** worn keys: these normal-mode keys refuse BARE presses (free, like
   *  locked keys) but work with a count prefix — the tap tax. Never ban
   *  Escape, digits, or find-argument letters you need. */
  banned?: string[];
  par: number;
  limit: number;
}

export type EnemyType = 'zombie' | 'imp' | 'mage' | 'toad' | 'kite';
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
  /** kites: true — this enemy lives on the sky layer (docs/new-mechanics §5b) */
  aloft?: boolean;
}

export interface Bomb {
  x: number;
  y: number;
  fuse: number;
  r: number;
  kind: BombKind;
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
  kind: TermKind;
  broken: string;
  target: string;
  glitch: string;
  coin: string;
  deadline: number;
  strokes: number;
  grants: number;
  hint?: string;
  arms: BombKind;
  buffer: string[];
  cursor: number;
  solved: boolean;
}

export interface Player {
  x: number;
  y: number;
  /** held bombs as a typed FIFO queue — craft order is drop order */
  arsenal: BombKind[];
  /** mirror of arsenal.length, kept in sync (HUD/back-compat reads) */
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
  /** world ticks elapsed inside this session (coins/spark clocks) */
  ticks: number;
  /** keystrokes spent inside this session (golf budget) */
  used: number;
  /** in-buffer find memo for `;` (f/F only) */
  find: FindMemo | null;
  /** opener + typed keys of an in-progress insert-class edit (dot recording) */
  rec?: string[] | null;
}

export type Status = 'play' | 'won' | 'dead' | 'fail';
export type Mode = 'normal' | 'terminal';

export interface FindMemo {
  cmd: 'f' | 'F' | 't' | 'T';
  ch: string;
}

export type Layer = 'ground' | 'sky';

/** A bookmark set with `m{a}`, recalled with backtick (docs/motions-v2.md). */
export interface Mark {
  x: number;
  y: number;
  layer: Layer;
}

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
  marks: Record<string, Mark>;
  /** an explosion erased the marks — colors the next failed recall's echo */
  marksWiped: boolean;
  /** bracket-pair doors: "layer:x,y" -> "x,y" (both directions, same layer);
   *  static — built at load from the map glyphs, validated 0-or-2 per kind */
  pairs: Record<string, string>;
  /** the last completed terminal edit, replayable with `.` — muscle memory:
   *  persists across terminals and explosions, cleared only on level load */
  lastEdit: { keys: string[] } | null;
  /** the open `/` search prompt buffer; null = closed. typing is free */
  searchBuf: string | null;
  /** macro registers: raw replayable world-command keys (docs/motions-v2 §5) */
  registers: Record<string, string[]>;
  /** in-progress `q{a}` recording; transient — never snapshotted */
  recording: { reg: string; keys: string[] } | null;
  /** last register replayed with `@` — `@@` re-runs it */
  lastMacro: string | null;
  /** last executed search word — `n` re-flies it; survives explosions */
  lastSearch: string | null;
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
  /** a sed terraformer ran its substitution over these tiles */
  sed(tiles: Array<[number, number]>): void;
  /** a flight cut n kite strings */
  cut(n: number): void;
  /** rose to / dropped from the cloud layer */
  rise(): void;
  drop(): void;
  /** collected a coin inside a coins/spark terminal */
  coin(left: number): void;
  /** a timed/budgeted terminal minigame reset (respawn, over-budget, zap) */
  termReset(t: Terminal): void;
  /** collected a keycap granting a vocab group */
  keycap(group: VocabGroup): void;
  /** a locked (not-yet-unlocked) key was pressed — free, no tick */
  locked(key: string): void;
}
