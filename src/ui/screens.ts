// Overlay screens (title/select/help/settings/intro/pause/dead/fail/clear)
// and all keyboard routing. Menus are navigated with vim keys, of course.
import * as game from '../engine/engine';
import { LEVELS } from '../levels';
import { resetEffects, sizeCanvas } from '../render/renderer';
import { armIdle, stopAttract } from './attract';
import { snd } from './audio';
import { DRILLS } from './drills';
import { slMode } from './hud';
import { persist, resetProgress, save } from './save';
import { ui } from './state';
import { CHAPTERS, LEGACY_DEAD, LEGACY_FAIL, type Chapter } from './story';
import { updateTermbox } from './termbox';

const $ = (id: string) => document.getElementById(id)!;

let menuIdx = 0;
let menuLen = 0;
let pendingG = false;
let confirmReset = false;
let repeatKey = '';
let repeatCount = 0;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
const toastCount: Record<string, number> = {};
// adaptive-nudge session state (see docs/progression-and-juice.md §2)
let helpBack: (() => void) | null = null;
let bonkRing: boolean[] = [];
let deathsBy: Record<string, number> = {};
let failsThisLevel = 0;

function show(html: string): void {
  $('panel').innerHTML = html;
  $('overlay').classList.remove('hidden');
}
function hide(): void {
  $('overlay').classList.add('hidden');
}

const LOGO =
`██╗   ██╗██╗███╗   ███╗██████╗ ███████╗██████╗ ███╗   ███╗ █████╗ ███╗   ██╗
██║   ██║██║████╗ ████║██╔══██╗██╔════╝██╔══██╗████╗ ████║██╔══██╗████╗  ██║
╚██╗ ██╔╝██║██╔████╔██║██████╔╝█████╗  ██████╔╝██╔████╔██║███████║██╔██╗ ██║
 ╚████╔╝ ██║██║╚██╔╝██║██╔══██╗██╔══╝  ██╔══██╗██║╚██╔╝██║██╔══██║██║╚██╗██║
  ╚═██╔╝ ██║██║ ╚═╝ ██║██████╔╝███████╗██║  ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║
    ╚═╝  ╚═╝╚═╝     ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝`;

interface MenuItem {
  label?: string;
  locked?: boolean;
}
function menuHtml<T extends MenuItem>(items: T[], idx: number, fmt?: (it: T) => string): string {
  return items.map((it, i) =>
    `<div class="menu-item${i === idx ? ' sel' : ''}${it.locked ? ' locked' : ''}">${i === idx ? '> ' : '  '}${fmt ? fmt(it) : it.label}</div>`,
  ).join('');
}

export function toast(msg: string, key?: string): void {
  if (key) {
    toastCount[key] = (toastCount[key] || 0) + 1;
    if (toastCount[key] > 2) return;
  }
  const t = $('toast');
  t.textContent = msg;
  t.style.opacity = '1';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 2400);
}

// ---------- screens ----------
function titleItems(): Array<{ label: string; act: () => void }> {
  const items: Array<{ label: string; act: () => void }> = [];
  if (save.unlocked > 1) {
    const next = Math.min(save.unlocked, game.getLevels().length);
    items.push({ label: 'CONTINUE', act: () => showIntro(next) });
  }
  items.push({ label: 'PLAY', act: showSelect });
  items.push({ label: 'DRILL', act: showDrill });
  items.push({ label: 'HOW TO PLAY', act: () => showHelp() });
  items.push({ label: 'SETTINGS', act: showSettings });
  return items;
}
export function showTitle(): void {
  menuIdx = 0;
  renderTitle();
  armIdle(); // idle long enough and the game starts playing itself
}
function renderTitle(): void {
  ui.screen = 'TITLE';
  const items = titleItems();
  menuLen = items.length;
  slMode('MENU');
  const total = game.getLevels().length;
  const cleared = Object.keys(save.levels).length;
  const stars = Object.values(save.levels).reduce((a, r) => a + r.stars, 0);
  const progress = cleared
    ? `<div class="dim" style="margin-bottom:10px"><span class="stars">★</span> ${stars}/${total * 3} · ${cleared}/${total} levels refactored</div>`
    : '';
  show(`<div class="logo">${LOGO}</div>
    <div class="dim" style="margin-bottom:12px">bombs · zombies · and the world's most portable skill</div>
    ${progress}${menuHtml(items, menuIdx)}
    <div class="foot">j/k move · Enter select — yes, the menus are vim too</div>`);
}
function titlePick(): void {
  titleItems()[menuIdx].act();
}

function showSelect(): void {
  ui.screen = 'SELECT';
  menuLen = game.getLevels().length;
  menuIdx = Math.min(save.unlocked, menuLen) - 1;
  slMode('MENU');
  renderSelect();
}
function renderSelect(): void {
  // the campaign's three chapters (docs/story.md) group the list; headers are
  // render-only — j/k walk the levels and never land on one
  const rows = game.getLevels().map((lv, i) => {
    const n = i + 1;
    const locked = n > save.unlocked;
    const rec = save.levels[n];
    const ch = CHAPTERS.find((c) => c.level === n);
    const head = ch ? `<div class="menu-head">${ch.title}</div>` : '';
    const line = locked
      ? `${String(n).padStart(2, '0')}  ????????????????????  [LOCKED]`
      : `${String(n).padStart(2, '0')}  ${lv.name.padEnd(22)} <span class="stars">${rec ? '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars) : '···'}</span>  ${rec ? `best ${String(rec.bestKeys).padStart(3)}` : '        '}  par ${lv.par}`;
    return `${head}<div class="menu-item${i === menuIdx ? ' sel' : ''}${locked ? ' locked' : ''}">${i === menuIdx ? '> ' : '  '}${line}</div>`;
  });
  show(`<h2>SELECT LEVEL</h2>${rows.join('')}<div class="foot">j/k move · gg/G ends · Enter play · Esc back</div>`);
}

// ---------- drill mode (docs/TODO.md 6.4) ----------
// Freeform practice: any owned motion group, a static coin arena, and a save
// file that never hears about any of it.
let drillIdx = 0; // which drill is loaded, for save-neutral retry/requeue
function drillOwned(i: number): boolean {
  return save.keycaps.includes(DRILLS[i].group);
}
function showDrill(): void {
  ui.screen = 'DRILL';
  ui.drill = false;
  game.setLevels(LEVELS); // drop any loaded drill arena from the level set
  menuLen = DRILLS.length;
  menuIdx = Math.min(menuIdx, menuLen - 1);
  if (!drillOwned(menuIdx)) menuIdx = 0; // core is always owned
  slMode('MENU');
  renderDrill();
}
function renderDrill(): void {
  const rows = DRILLS.map(({ group, def }, i) => {
    const label = game.VOCAB_GROUPS.find((g) => g.id === group)!.label;
    const line = drillOwned(i)
      ? `<span class="kbd">${label.padEnd(5)}</span>  ${def.name.padEnd(16)} par ${def.par}`
      : `<span class="kbd">  ?  </span>  ????????????????  [LOCKED — its keycap is in the campaign]`;
    return `<div class="menu-item${i === menuIdx ? ' sel' : ''}${drillOwned(i) ? '' : ' locked'}">${i === menuIdx ? '> ' : '  '}${line}</div>`;
  });
  show(`<h2>DRILL MODE</h2>
    <div class="dim" style="margin-bottom:10px">reps for your fingers. no enemies, no saves, no stakes — the coins keep score.</div>
    ${rows.join('')}<div class="foot">j/k move · Enter drill · Esc back</div>`);
}
function startDrill(i: number): void {
  drillIdx = i;
  ui.drill = true;
  // the arena rides along at the end of the level set while the drill runs;
  // every route back to a menu goes through showDrill, which resets the set
  game.setLevels([...LEVELS, DRILLS[i].def]);
  game.loadLevel(LEVELS.length);
  ui.currentLevel = LEVELS.length + 1;
  sizeCanvas();
  ui.screen = 'GAME';
  ui.exCmd = null;
  bonkRing = [];
  resetEffects();
  hide();
  updateTermbox();
}
function showDrillClear(): void {
  ui.screen = 'CLEAR';
  const st = game.state();
  snd.clear();
  const diff = st.keys - st.par;
  const grade = diff <= 0 ? 'reflexes: COMPILED. ship it.'
    : diff <= Math.floor(st.par * 0.5) ? 'clean reps. tighter next lap.'
    : 'the reps only count if you count them.';
  show(`<h1>DRILL COMPLETE</h1>
    <div style="margin-top:8px">KEYS <span class="kbd">${st.keys}</span> / par ${st.par} ${diff <= 0 ? '<span class="stars">— under par!</span>' : ''}</div>
    <div class="dim">bonks ${st.bonks}</div>
    <div class="dim">${st.lv.name} drilled. ${grade}</div>
    <div class="dim" style="margin-top:10px">nothing saved. nothing owed. muscle memory keeps its own files.</div>
    <div class="foot">r again · Enter/Esc back to drills</div>`);
}

function showHelp(back?: () => void): void {
  ui.screen = 'HELP';
  helpBack = back ?? null;
  slMode('MENU');
  const rows: Array<[string, string]> = [
    ['h j k l', 'move left / down / up / right'],
    ['5l 3j …', 'count: repeat a motion N times (one enemy turn!)'],
    ['w b e', 'hop to next / previous word, word end — flies over gaps'],
    ['f{c} F{c}', 'dash right / left to lettered tile {c}; t/T stop short'],
    ['; ,', 'repeat last f/t dash, reversed with ,'],
    ['0 $', 'slide to start / end of row — and snap to linter margins |'],
    ['gg G', 'slam to top / bottom of column'],
    ['^U ^D', 'ride an updraft @ into the clouds / drop back down'],
    ['m{a} `{a}', 'drop a bookmark (free) / jump back to it — blasts eat marks'],
    ['%', 'on a bracket ()[]{}: jump to its partner, both directions'],
    ['/word n', 'search: fly to the word, anywhere; n rides to the next match'],
    ['.', 'in a code-tile: repeat your last edit — one key, however long'],
    ['q{a}…q @{a}', 'record world commands / replay them all as ONE turn'],
    ['i', 'open the code-tile under you (INSERT the fix, Esc to commit)'],
    ['x r{c} ~ s', 'in a code-tile: delete char, replace char, flip case, substitute'],
    ['cw ciw', 'in a code-tile: change word / change inner word'],
    ['x', 'in the world: drop an armed bomb (fuse 6 turns, plus-blast)'],
    ['u', 'undo one world-tick (charges are precious; u also cheats death)'],
    [':', 'command line — :help :map :hint :q (thinking is free)'],
    ['Esc', 'cancel pending keys / leave code-tile / pause'],
  ];
  show(`<h2>THE SACRED KEYS</h2>
    <div style="font-size:13.5px">${rows.map(([k, d]) =>
      `<div><span class="kbd">${k.padEnd(11)}</span> ${d}</div>`).join('')}</div>
    <div class="foot">every keypress spends budget — enemies move when you do · flying over a toad flips it · Esc back</div>`);
}

/** apply the CRT-effects setting to the shell (also called once at boot) */
export function applyCrt(): void {
  $('crt').classList.toggle('no-crt', !save.settings.crt);
}

function showSettings(): void {
  ui.screen = 'SETTINGS'; menuIdx = 0; menuLen = 3; confirmReset = false;
  slMode('MENU');
  renderSettings();
}
function renderSettings(): void {
  show(`<h2>SETTINGS</h2>${menuHtml([
    { label: `Sound        [${save.settings.sound ? 'ON ' : 'OFF'}]` },
    { label: `CRT effects  [${save.settings.crt ? 'ON ' : 'OFF'}]` },
    { label: confirmReset ? 'Reset progress — press y to confirm' : 'Reset progress' },
  ], menuIdx)}<div class="foot">Enter toggle/select · Esc back</div>`);
}

// the story interleaves here: a chapter card runs once per save, ahead of
// the level intro, on every entry path (select, CONTINUE, clear-advance)
let chapterLevel = 0; // where to resume after the card is dismissed
function showChapter(ch: Chapter): void {
  ui.screen = 'CHAPTER';
  chapterLevel = ch.level;
  save.chapters.push(ch.level);
  persist();
  slMode('MENU');
  show(`<h2>${ch.title}</h2>
    ${ch.lines.map((l) => `<div class="dim">${l}</div>`).join('')}
    <div class="foot">Enter continue</div>`);
}

export function showIntro(n: number): void {
  const ch = CHAPTERS.find((c) => c.level === n);
  if (ch && !save.chapters.includes(n)) { showChapter(ch); return; }
  ui.screen = 'INTRO';
  if (n !== ui.currentLevel) { deathsBy = {}; failsThisLevel = 0; }
  ui.currentLevel = n;
  const lv = game.getLevels()[n - 1];
  slMode('MENU');
  show(`<h1>LEVEL ${String(n).padStart(2, '0')}</h1><h2>${lv.name}</h2>
    <div style="margin-bottom:10px"><span class="kbd">NEW: ${lv.teaches}</span></div>
    ${lv.intro.map((l) => `<div>${l}</div>`).join('')}
    <div class="foot">budget ${lv.limit} keystrokes · par ${lv.par} · Enter to jack in</div>`);
}

export function startLevel(n: number): void {
  ui.drill = false;
  game.setLevels(LEVELS); // in case a drill arena was still riding along
  game.loadLevel(n - 1);
  sizeCanvas();
  ui.screen = 'GAME';
  ui.exCmd = null;
  bonkRing = [];
  resetEffects();
  hide();
  updateTermbox();
}

// The Legacy gets one lowercase comment per FAIL/DEAD card — rotated by the
// session fail count (deterministic), below the mechanical lesson, and never
// on CLEAR (docs/story.md: winning shuts it up)
function legacySays(lines: string[]): string {
  return `<div class="dim" style="margin-top:10px">${lines[failsThisLevel % lines.length]}</div>`;
}

// after 3 fails/deaths on a level this session, the reference line leaks out
function ghostOfPar(): string {
  const lv = game.getLevels()[ui.currentLevel - 1];
  if (failsThisLevel < 3 || !lv.solution) return '';
  const opening = lv.solution.split(/\s+/).slice(0, 4).join(' ');
  return `<div class="dim" style="margin-top:8px">the ghost of par whispers: <span class="kbd">${opening} …</span></div>`;
}

export function showClear(): void {
  if (ui.drill) { showDrillClear(); return; } // practice never touches the save
  ui.screen = 'CLEAR';
  const st = game.state();
  const n = ui.currentLevel;
  const lv = st.lv;
  const stars = st.keys <= st.par ? 3 : st.keys <= Math.floor(st.par * 1.5) ? 2 : 1;
  const rec = save.levels[n];
  const isBest = !rec || st.keys < rec.bestKeys;
  save.levels[n] = {
    bestKeys: isBest ? st.keys : rec.bestKeys,
    stars: Math.max(stars, rec ? rec.stars : 0),
  };
  save.unlocked = Math.max(save.unlocked, Math.min(n + 1, game.getLevels().length));
  persist();
  snd.clear();
  for (let i = 0; i < stars; i++) setTimeout(snd.star, 500 + i * 300);
  const last = n >= game.getLevels().length;
  // golf + postmortem stats (docs/progression-and-juice.md §3)
  const diff = st.keys - st.par;
  const golf = diff < 0 ? `<span class="stars">(−${-diff}) GOLFED</span>` : diff === 0 ? '<span class="stars">machine-precise</span>' : '';
  const fav = Object.entries(st.cmdCounts).sort((a, b) => b[1] - a[1])[0];
  const quip = st.bonks === 0 ? 'zero bonks. the walls never felt you.'
    : st.bonks >= 6 ? `the level won ${st.bonks} arguments.`
    : st.keys <= st.par ? 'The keyboard fears you.'
    : stars === 2 ? 'Tighten those motions.' : 'It compiles. Barely.';
  show(`<h1>LEVEL CLEAR</h1>
    <div style="font-size:22px" class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
    <div style="margin-top:8px">KEYS <span class="kbd">${st.keys}</span> / par ${st.par} ${golf} ${isBest ? '<span class="stars">— new best!</span>' : ''}</div>
    <div class="dim">bonks ${st.bonks}${fav ? ` · favorite motion <span class="kbd">${fav[0]}</span> ×${fav[1]}` : ''}</div>
    <div class="dim">${lv.name} refactored. ${quip}</div>
    ${last ? '<div style="margin-top:10px" class="stars">You beat VIMBERMAN. :wq and go touch grass.</div>' : ''}
    <div class="foot">${last ? '' : 'Enter next level · '}r replay · Esc menu</div>`);
}

const POSTMORTEM: Record<string, string> = {
  zombie: 'zombies step every other turn. you have counts. do the math.',
  imp: 'imps flee lit fuses. herd it, don\'t chase it.',
  mage: 'the mage telegraphs ◌ a full turn early. stop sharing rows with it.',
  toad: 'toads hop every third turn — or fly over one and see what happens.',
  linter: 'the lamp blinks twice before it fires. margins are rent-free.',
  blast: 'your blast radius grows with every R you eat. respect your own work.',
};
function deathCause(msg: string): string | null {
  for (const k of ['zombie', 'imp', 'mage', 'toad', 'linter', 'blast']) if (msg.includes(k)) return k;
  return null;
}
/** called by main.ts the instant a death happens, before the DEAD card */
export function noteDeath(msg: string): void {
  failsThisLevel++;
  const cause = deathCause(msg);
  if (cause) deathsBy[cause] = (deathsBy[cause] || 0) + 1;
}

export function showDead(msg: string): void {
  ui.screen = 'DEAD';
  const st = game.state();
  const canU = game.canRescue();
  snd.death();
  const cause = deathCause(msg);
  const lesson = cause && deathsBy[cause] >= 2 ? `<div class="dim" style="margin-top:8px">${POSTMORTEM[cause]}</div>` : '';
  show(`<h1 class="redx">YOU DIED</h1>
    <div>@ was ${msg}.</div>
    ${lesson}${ghostOfPar()}
    ${canU ? `<div style="margin-top:8px">Press <span class="kbd">u</span> to undo fate — ${st.player.undo} charge${st.player.undo > 1 ? 's' : ''} left.</div>` : '<div class="dim" style="margin-top:8px">No undo can save you now.</div>'}
    ${legacySays(LEGACY_DEAD)}
    <div class="foot">${canU ? 'u rewind · ' : ''}r retry · Esc menu</div>`);
}

export function showFail(): void {
  ui.screen = 'FAIL';
  failsThisLevel++;
  const st = game.state();
  snd.error();
  show(`<h1 class="redx">OUT OF KEYSTROKES</h1>
    <div>The budget of ${st.limit} is spent. The cursor grows still.</div>
    <div class="dim" style="margin-top:8px">Tip: ${st.lv.teaches} — big motions cost one keystroke-ish, not ten.</div>
    ${ghostOfPar()}
    ${legacySays(LEGACY_FAIL)}
    <div class="foot">r retry · Esc menu</div>`);
}

export function showPause(): void {
  ui.screen = 'PAUSE';
  menuIdx = 0;
  menuLen = 3;
  renderPause();
}
function renderPause(): void {
  show(`<h2>PAUSED</h2>${menuHtml([{ label: 'RESUME' }, { label: 'RESTART LEVEL' }, { label: 'QUIT TO MENU' }], menuIdx)}
    <div class="foot">j/k · Enter · Esc resume</div>`);
}

export function resumeGame(): void {
  hide();
  ui.screen = 'GAME';
  updateTermbox();
}

// ---------- input routing ----------
function menuNav(k: string, rerender: () => void, pick: () => void, back: (() => void) | null): void {
  if (k === 'j') { menuIdx = (menuIdx + 1) % menuLen; pendingG = false; snd.move(); rerender(); }
  else if (k === 'k') { menuIdx = (menuIdx - 1 + menuLen) % menuLen; pendingG = false; snd.move(); rerender(); }
  else if (k === 'g') { if (pendingG) { menuIdx = 0; pendingG = false; rerender(); } else pendingG = true; }
  else if (k === 'G') { menuIdx = menuLen - 1; pendingG = false; rerender(); }
  else if (k === 'Enter' || k === 'l') { pendingG = false; pick(); }
  else if ((k === 'Escape' || k === 'h') && back) { pendingG = false; back(); }
}

// ---------- the ex (`:`) command line — free; thinking costs nothing ----------
function runExCommand(cmd: string): void {
  const st = game.state();
  const vocab = game.getVocab();
  switch (cmd.trim()) {
    case 'help':
      showHelp(() => resumeGame());
      break;
    case 'map': {
      const owned = game.VOCAB_GROUPS.filter((g) => !vocab || vocab.has(g.id));
      const missing = game.VOCAB_GROUPS.length - owned.length;
      st.echo = 'mapped: ' + owned.map((g) => `[${g.label}]`).join(' ') +
        (missing ? ` · ${missing} keycap${missing > 1 ? 's' : ''} still in the box` : ' · full keyboard');
      break;
    }
    case 'hint':
      st.echo = st.lv.hint ?? 'no hint. the map is the hint.';
      break;
    case 'q':
      if (ui.drill) showDrill();
      else showSelect();
      break;
    case 'q!':
      if (ui.drill) startDrill(drillIdx);
      else startLevel(ui.currentLevel);
      break;
    case 'wq':
      st.echo = 'you\'re not done refactoring.';
      break;
    case '':
      break;
    default:
      st.echo = 'E: not an editor command: ' + cmd;
      snd.error();
  }
}
function exKey(k: string): void {
  if (k === 'Escape') { ui.exCmd = null; return; }
  if (k === 'Enter') {
    const cmd = ui.exCmd!;
    ui.exCmd = null;
    runExCommand(cmd);
    return;
  }
  if (k === 'Backspace') {
    if (!ui.exCmd) { ui.exCmd = null; return; }
    ui.exCmd = ui.exCmd.slice(0, -1);
    return;
  }
  if (k.length === 1) ui.exCmd += k;
}

// scan the player's row for a lettered tile strictly beyond them (nudges)
function letterBeyond(dir: number): string | null {
  const st = game.state();
  const grid = st.layer === 'sky' ? st.skyGrid! : st.grid;
  for (let x = st.player.x + dir; x > 0 && x < st.W - 1; x += dir) {
    const c = grid[st.player.y][x];
    if (c >= 'a' && c <= 'z') return c;
  }
  return null;
}

function gameKey(k: string): void {
  if (!game.loaded()) return;
  const st = game.state();
  if (st.status === 'won' || st.status === 'fail') return;
  const vocab = game.getVocab();
  // the ex command line swallows keys while open, and ':' opens it for free
  if (ui.exCmd !== null) { exKey(k); return; }
  if (k === ':' && st.status === 'play' && st.mode === 'normal' && !st.pending.count && !st.pending.op) {
    ui.exCmd = '';
    return;
  }
  // "try a count" coaching, plus the find-nudge for long unbroken walks
  if (st.mode === 'normal' && 'hjkl'.includes(k) && !st.pending.count) {
    if (k === repeatKey) {
      repeatCount++;
      if (repeatCount === 4) toast(`try 4${k} instead of ${k.repeat(4)}`, 'count');
      if (repeatCount === 6 && (k === 'h' || k === 'l') && (!vocab || vocab.has('find'))) {
        const c = letterBeyond(k === 'l' ? 1 : -1);
        if (c) toast(`psst — ${k === 'l' ? 'f' : 'F'}${c} was one keystroke. your pinky is doing cardio.`, 'find');
      }
    } else { repeatKey = k; repeatCount = 1; }
  } else repeatKey = '';
  const beforeMode = st.mode;
  const beforeX = st.player.x;
  const beforeY = st.player.y;
  game.key(k);
  if (st.mode !== beforeMode) updateTermbox();
  // gap-nudge: bonked sideways into a pit while owning w
  const bonked = (st.echo || '').startsWith('E:');
  if (bonked && (k === 'h' || k === 'l') && st.player.x === beforeX && st.player.y === beforeY
      && (!vocab || vocab.has('word'))) {
    const grid = st.layer === 'sky' ? st.skyGrid! : st.grid;
    const adj = grid[beforeY]?.[beforeX + (k === 'l' ? 1 : -1)];
    if (adj === '~' && letterBeyond(k === 'l' ? 1 : -1)) {
      toast('gaps stop feet, not flights — w soars over ~', 'gap');
    }
  }
  // bonk-spam: three E: echoes inside the last six keypresses
  bonkRing.push(bonked);
  if (bonkRing.length > 6) bonkRing.shift();
  if (bonkRing.filter(Boolean).length === 3) {
    toast('three bonks. the wall remains undefeated. Esc, breathe, look.', 'bonkspam');
    bonkRing = [];
  }
  if (['w', 'b', 'e', 'f', 'F', '0', '$', 'G'].includes(st.lastCmd?.slice(-1)) && st.mode === 'normal') snd.slide();
}

export function handleKeydown(e: KeyboardEvent): void {
  stopAttract(); // any keypress reclaims the keyboard from the demo
  // Ctrl-u / Ctrl-d are real inputs (the sky layer); other chords pass through
  if (e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'u' || e.key === 'd')) {
    if (ui.screen === 'GAME') {
      e.preventDefault();
      gameKey(e.key === 'u' ? '<C-u>' : '<C-d>');
    }
    return;
  }
  if (e.metaKey || e.ctrlKey) return;
  const k = e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) {
    e.preventDefault();
    if (ui.screen === 'GAME' || ui.screen === 'SELECT' || ui.screen === 'TITLE') {
      toast('h j k l — arrows are for tourists', 'arrows');
      snd.error();
    }
    return;
  }
  if (k.length === 1 || k === 'Escape' || k === 'Backspace' || k === 'Enter') e.preventDefault();

  switch (ui.screen) {
    case 'TITLE': menuNav(k, renderTitle, titlePick, null); break;
    case 'SELECT':
      menuNav(k, renderSelect, () => {
        if (menuIdx + 1 > save.unlocked) { snd.error(); toast('locked — clear the previous level'); return; }
        showIntro(menuIdx + 1);
      }, showTitle);
      break;
    case 'DRILL':
      menuNav(k, renderDrill, () => {
        if (!drillOwned(menuIdx)) { snd.error(); toast('locked — collect its keycap in the campaign first'); return; }
        startDrill(menuIdx);
      }, showTitle);
      break;
    case 'HELP':
      if (k === 'Escape' || k === 'q' || (k === 'h' && !helpBack)) {
        const back = helpBack;
        helpBack = null;
        (back ?? showTitle)();
      }
      break;
    case 'SETTINGS':
      if (confirmReset && k === 'y') {
        resetProgress();
        game.setVocab(new Set(save.keycaps));
        confirmReset = false;
        renderSettings();
        toast('progress wiped. clean buffer.');
        break;
      }
      confirmReset = false;
      menuNav(k, renderSettings, () => {
        if (menuIdx === 0) { save.settings.sound = !save.settings.sound; persist(); snd.item(); }
        else if (menuIdx === 1) { save.settings.crt = !save.settings.crt; persist(); applyCrt(); snd.item(); }
        else confirmReset = true;
        renderSettings();
      }, showTitle);
      break;
    case 'CHAPTER':
      if (k === 'Enter' || k === 'Escape') showIntro(chapterLevel);
      break;
    case 'INTRO':
      if (k === 'Enter') startLevel(ui.currentLevel);
      else if (k === 'Escape') showSelect();
      break;
    case 'GAME': gameKey(k); break;
    case 'PAUSE':
      menuNav(k, renderPause, () => {
        if (menuIdx === 0) resumeGame();
        else if (menuIdx === 1) { if (ui.drill) startDrill(drillIdx); else startLevel(ui.currentLevel); }
        else if (ui.drill) showDrill();
        else showSelect();
      }, resumeGame);
      break;
    case 'DEAD':
      if (k === 'u' && game.canRescue()) { game.state().keys++; game.rescue(); }
      else if (k === 'r') { if (ui.drill) startDrill(drillIdx); else startLevel(ui.currentLevel); }
      else if (k === 'Escape') { if (ui.drill) showDrill(); else showSelect(); }
      break;
    case 'FAIL':
      if (k === 'r') { if (ui.drill) startDrill(drillIdx); else startLevel(ui.currentLevel); }
      else if (k === 'Escape') { if (ui.drill) showDrill(); else showSelect(); }
      break;
    case 'CLEAR':
      if (ui.drill) {
        if (k === 'r') startDrill(drillIdx);
        else if (k === 'Enter' || k === 'Escape') showDrill();
      } else if (k === 'Enter' && ui.currentLevel < game.getLevels().length) showIntro(ui.currentLevel + 1);
      else if (k === 'r') startLevel(ui.currentLevel);
      else if (k === 'Escape') showSelect();
      break;
  }
  if (ui.screen === 'TITLE') armIdle(); // every title keypress resets the demo clock
}
