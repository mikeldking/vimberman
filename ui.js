// Vimberman — UI layer: rendering, screens, input routing, audio, save state.
/* global VB */
(function () {
  const $ = (id) => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const CELL = 44;
  const FONT = '"IBM Plex Mono", Menlo, Consolas, monospace';

  // ---------- save state ----------
  const SAVE_KEY = 'vimberman.save.v1';
  let save = { v: 1, unlocked: 1, levels: {}, settings: { sound: true } };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.v === 1) save = { ...save, ...d, settings: { sound: true, ...d.settings } };
    }
  } catch (e) { /* fresh save */ }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

  // ---------- audio (all synthesized) ----------
  let AC = null;
  function ac() {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(type, f0, f1, dur, gain = 0.15) {
    if (!save.settings.sound) return;
    try {
      const c = ac(), o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, c.currentTime);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), c.currentTime + dur);
      g.gain.setValueAtTime(gain * 0.25 * 4, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + dur + 0.02);
    } catch (e) {}
  }
  function noiseBoom() {
    if (!save.settings.sound) return;
    try {
      const c = ac(), n = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
      const buf = c.createBuffer(1, c.sampleRate * 0.35, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      n.buffer = buf;
      f.type = 'lowpass'; f.frequency.setValueAtTime(1000, c.currentTime);
      f.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.3);
      g.gain.setValueAtTime(0.5, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.32);
      n.connect(f).connect(g).connect(c.destination);
      n.start();
      tone('sine', 55, 40, 0.15, 0.5);
    } catch (e) {}
  }
  const snd = {
    move: () => tone('square', 440, 465, 0.04, 0.05),
    slide: () => tone('triangle', 330, 660, 0.09, 0.12),
    bomb: () => tone('sine', 220, 180, 0.07, 0.2),
    boom: noiseBoom,
    error: () => tone('square', 110, 100, 0.11, 0.16),
    item: () => tone('sine', 660, 990, 0.12, 0.15),
    solved: () => { tone('triangle', 523, 523, 0.08, 0.2); setTimeout(() => tone('triangle', 784, 784, 0.1, 0.2), 90); },
    clear: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone('triangle', f, f, 0.1, 0.2), i * 95)),
    star: () => tone('sine', 1319, 1319, 0.22, 0.18),
    death: () => tone('sawtooth', 220, 55, 0.4, 0.22),
    rescue: () => tone('triangle', 200, 800, 0.18, 0.18),
    port: () => tone('sine', 900, 300, 0.12, 0.1),
  };

  // ---------- screen state machine ----------
  // TITLE | SELECT | HELP | SETTINGS | INTRO | GAME | PAUSE | DEAD | FAIL | CLEAR
  let screen = 'TITLE';
  let menuIdx = 0, menuLen = 0, pendingG = false;
  let currentLevel = 1;
  let shake = 0, flashRed = 0, explosions = [], toastTimer = null, toastCount = {};
  let repeatKey = '', repeatCount = 0, confirmReset = false, helpScroll = 0;
  const lerps = new WeakMap();

  const overlay = $('overlay'), panel = $('panel');
  function show(html) { panel.innerHTML = html; overlay.classList.remove('hidden'); }
  function hide() { overlay.classList.add('hidden'); }

  const LOGO =
`██╗   ██╗██╗███╗   ███╗██████╗ ███████╗██████╗ ███╗   ███╗ █████╗ ███╗   ██╗
██║   ██║██║████╗ ████║██╔══██╗██╔════╝██╔══██╗████╗ ████║██╔══██╗████╗  ██║
╚██╗ ██╔╝██║██╔████╔██║██████╔╝█████╗  ██████╔╝██╔████╔██║███████║██╔██╗ ██║
 ╚████╔╝ ██║██║╚██╔╝██║██╔══██╗██╔══╝  ██╔══██╗██║╚██╔╝██║██╔══██║██║╚██╗██║
  ╚═██╔╝ ██║██║ ╚═╝ ██║██████╔╝███████╗██║  ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║
    ╚═╝  ╚═╝╚═╝     ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝`;

  function menuHtml(items, idx, fmt) {
    return items.map((it, i) =>
      `<div class="menu-item${i === idx ? ' sel' : ''}${it.locked ? ' locked' : ''}">${i === idx ? '> ' : '  '}${fmt ? fmt(it) : it.label}</div>`
    ).join('');
  }

  function showTitle() {
    screen = 'TITLE'; menuIdx = 0; menuLen = 3;
    slMode('MENU');
    show(`<div class="logo">${LOGO}</div>
      <div class="dim" style="margin-bottom:12px">bombs · zombies · and the world's most portable skill</div>
      ${menuHtml([{ label: 'PLAY' }, { label: 'HOW TO PLAY' }, { label: 'SETTINGS' }], menuIdx)}
      <div class="foot">j/k move · Enter select — yes, the menus are vim too</div>`);
  }
  function titlePick() {
    if (menuIdx === 0) showSelect();
    else if (menuIdx === 1) showHelp();
    else showSettings();
  }

  function showSelect() {
    screen = 'SELECT'; menuLen = VB.LEVELS.length;
    menuIdx = Math.min(save.unlocked, VB.LEVELS.length) - 1;
    slMode('MENU');
    renderSelect();
  }
  function renderSelect() {
    const items = VB.LEVELS.map((lv, i) => {
      const n = i + 1, rec = save.levels[n], locked = n > save.unlocked;
      return { locked, n, lv, rec };
    });
    show(`<h2>SELECT LEVEL</h2>${menuHtml(items, menuIdx, (it) => {
      if (it.locked) return `${String(it.n).padStart(2, '0')}  ????????????????????  [LOCKED]`;
      const stars = it.rec ? '★'.repeat(it.rec.stars) + '☆'.repeat(3 - it.rec.stars) : '···';
      const best = it.rec ? `best ${String(it.rec.bestKeys).padStart(3)}` : '        ';
      return `${String(it.n).padStart(2, '0')}  ${it.lv.name.padEnd(22)} <span class="stars">${stars}</span>  ${best}  par ${it.lv.par}`;
    })}<div class="foot">j/k move · gg/G ends · Enter play · Esc back</div>`);
  }

  function showHelp() {
    screen = 'HELP'; slMode('MENU');
    const rows = [
      ['h j k l', 'move left / down / up / right'],
      ['5l 3j …', 'count: repeat a motion N times (one enemy turn!)'],
      ['w b e', 'hop to next / previous word, word end — flies over gaps'],
      ['f{c} F{c}', 'dash right / left to lettered tile {c}; t/T stop short'],
      ['; ,', 'repeat last f/t dash, reversed with ,'],
      ['0 $', 'slide to start / end of row'],
      ['gg G', 'slam to top / bottom of column'],
      ['i', 'open the code-tile under you (INSERT the fix, Esc to commit)'],
      ['x r{c} ~ s', 'in a code-tile: delete char, replace char, flip case, substitute'],
      ['cw ciw', 'in a code-tile: change word / change inner word'],
      ['x', 'in the world: drop an armed bomb (fuse 6 turns, plus-blast)'],
      ['u', 'undo one world-tick (charges are precious; u also cheats death)'],
      ['Esc', 'cancel pending keys / leave code-tile / pause'],
    ];
    show(`<h2>THE SACRED KEYS</h2>
      <div style="font-size:13.5px">${rows.map(([k, d]) =>
        `<div><span class="kbd">${k.padEnd(11)}</span> ${d}</div>`).join('')}</div>
      <div class="foot">every keypress spends budget — enemies move when you do · Esc back</div>`);
  }

  function showSettings() {
    screen = 'SETTINGS'; menuIdx = 0; menuLen = 2; confirmReset = false;
    slMode('MENU');
    renderSettings();
  }
  function renderSettings() {
    show(`<h2>SETTINGS</h2>${menuHtml([
      { label: `Sound        [${save.settings.sound ? 'ON ' : 'OFF'}]` },
      { label: confirmReset ? 'Reset progress — press y to confirm' : 'Reset progress' },
    ], menuIdx)}<div class="foot">Enter toggle/select · Esc back</div>`);
  }

  function showIntro(n) {
    screen = 'INTRO'; currentLevel = n;
    const lv = VB.LEVELS[n - 1];
    slMode('MENU');
    show(`<h1>LEVEL ${String(n).padStart(2, '0')}</h1><h2>${lv.name}</h2>
      <div style="margin-bottom:10px"><span class="kbd">NEW: ${lv.teaches}</span></div>
      ${lv.intro.map((l) => `<div>${l}</div>`).join('')}
      <div class="foot">budget ${lv.limit} keystrokes · par ${lv.par} · Enter to jack in</div>`);
  }

  function startLevel(n) {
    VB.loadLevel(n - 1);
    sizeCanvas();
    screen = 'GAME';
    explosions = []; shake = 0; flashRed = 0;
    hide(); updateTermbox();
  }

  function showClear() {
    screen = 'CLEAR';
    const st = VB.state, n = currentLevel, lv = st.lv;
    const stars = st.keys <= st.par ? 3 : st.keys <= Math.floor(st.par * 1.5) ? 2 : 1;
    const rec = save.levels[n];
    const isBest = !rec || st.keys < rec.bestKeys;
    save.levels[n] = {
      bestKeys: isBest ? st.keys : rec.bestKeys,
      stars: Math.max(stars, rec ? rec.stars : 0),
    };
    save.unlocked = Math.max(save.unlocked, Math.min(n + 1, VB.LEVELS.length));
    persist();
    snd.clear();
    for (let i = 0; i < stars; i++) setTimeout(snd.star, 500 + i * 300);
    const last = n >= VB.LEVELS.length;
    show(`<h1>LEVEL CLEAR</h1>
      <div style="font-size:22px" class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
      <div style="margin-top:8px">KEYS <span class="kbd">${st.keys}</span> / par ${st.par} ${isBest ? '<span class="stars">— new best!</span>' : ''}</div>
      <div class="dim">${lv.name} refactored. ${st.keys <= st.par ? 'The keyboard fears you.' : stars === 2 ? 'Tighten those motions.' : 'It compiles. Barely.'}</div>
      ${last ? '<div style="margin-top:10px" class="stars">You beat VIMBERMAN. :wq and go touch grass.</div>' : ''}
      <div class="foot">${last ? '' : 'Enter next level · '}r replay · Esc menu</div>`);
  }

  function showDead(msg) {
    screen = 'DEAD';
    const st = VB.state;
    const canU = VB.canRescue();
    snd.death(); flashRed = 1;
    show(`<h1 class="redx">YOU DIED</h1>
      <div>@ was ${msg}.</div>
      ${canU ? `<div style="margin-top:8px">Press <span class="kbd">u</span> to undo fate — ${st.player.undo} charge${st.player.undo > 1 ? 's' : ''} left.</div>` : '<div class="dim" style="margin-top:8px">No undo can save you now.</div>'}
      <div class="foot">${canU ? 'u rewind · ' : ''}r retry · Esc menu</div>`);
  }

  function showFail() {
    screen = 'FAIL';
    const lv = VB.state.lv;
    snd.error();
    show(`<h1 class="redx">OUT OF KEYSTROKES</h1>
      <div>The budget of ${VB.state.limit} is spent. The cursor grows still.</div>
      <div class="dim" style="margin-top:8px">Tip: ${lv.teaches} — big motions cost one keystroke-ish, not ten.</div>
      <div class="foot">r retry · Esc menu</div>`);
  }

  function showPause() {
    screen = 'PAUSE'; menuIdx = 0; menuLen = 3;
    show(`<h2>PAUSED</h2>${menuHtml([{ label: 'RESUME' }, { label: 'RESTART LEVEL' }, { label: 'QUIT TO MENU' }], menuIdx)}
      <div class="foot">j/k · Enter · Esc resume</div>`);
  }

  // ---------- toasts ----------
  function toast(msg, key) {
    if (key) {
      toastCount[key] = (toastCount[key] || 0) + 1;
      if (toastCount[key] > 2) return;
    }
    const t = $('toast');
    t.textContent = msg; t.style.opacity = 1;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.opacity = 0; }, 2400);
  }

  // ---------- engine fx hooks ----------
  VB.fx.error = () => snd.error();
  VB.fx.moved = () => snd.move();
  VB.fx.bomb = () => snd.bomb();
  VB.fx.explosion = (tiles) => {
    shake = 7; snd.boom();
    const now = performance.now();
    for (const [x, y] of tiles) explosions.push({ x, y, t0: now });
  };
  VB.fx.solved = () => { snd.solved(); updateTermbox(); };
  VB.fx.item = () => { snd.item(); toast(VB.state.echo); };
  VB.fx.win = () => setTimeout(showClear, 350);
  VB.fx.death = (msg) => setTimeout(() => showDead(msg), 450);
  VB.fx.fail = () => setTimeout(showFail, 250);
  VB.fx.rescue = () => { snd.rescue(); hide(); screen = 'GAME'; updateTermbox(); };
  VB.fx.wantPause = () => showPause();
  VB.fx.enterTerm = () => { snd.slide(); updateTermbox(); };
  VB.fx.exitTerm = () => updateTermbox();
  VB.fx.telegraph = () => snd.port();
  VB.fx.tick = () => updateTermbox();
  VB.fx.collectBush = () => snd.item();

  // ---------- input ----------
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey) return;
    const k = e.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) {
      e.preventDefault();
      if (screen === 'GAME' || screen === 'SELECT' || screen === 'TITLE') {
        toast('h j k l — arrows are for tourists', 'arrows');
        snd.error();
      }
      return;
    }
    if (k.length === 1 || k === 'Escape' || k === 'Backspace' || k === 'Enter') e.preventDefault();

    switch (screen) {
      case 'TITLE': menuNav(k, showTitle, titlePick, null); break;
      case 'SELECT':
        menuNav(k, renderSelect, () => {
          if (menuIdx + 1 > save.unlocked) { snd.error(); toast('locked — clear the previous level'); return; }
          showIntro(menuIdx + 1);
        }, showTitle);
        break;
      case 'HELP': if (k === 'Escape' || k === 'h' || k === 'q') showTitle(); break;
      case 'SETTINGS':
        if (confirmReset && k === 'y') {
          save = { v: 1, unlocked: 1, levels: {}, settings: save.settings };
          persist(); confirmReset = false; renderSettings(); toast('progress wiped. clean buffer.');
          break;
        }
        confirmReset = false;
        menuNav(k, renderSettings, () => {
          if (menuIdx === 0) { save.settings.sound = !save.settings.sound; persist(); snd.item(); }
          else confirmReset = true;
          renderSettings();
        }, showTitle);
        break;
      case 'INTRO':
        if (k === 'Enter') startLevel(currentLevel);
        else if (k === 'Escape') showSelect();
        break;
      case 'GAME': gameKey(k); break;
      case 'PAUSE':
        menuNav(k, showPauseRefresh, () => {
          if (menuIdx === 0) { hide(); screen = 'GAME'; }
          else if (menuIdx === 1) startLevel(currentLevel);
          else showSelect();
        }, () => { hide(); screen = 'GAME'; });
        break;
      case 'DEAD':
        if (k === 'u' && VB.canRescue()) { VB.state.keys++; VB.rescue(); }
        else if (k === 'r') startLevel(currentLevel);
        else if (k === 'Escape') showSelect();
        break;
      case 'FAIL':
        if (k === 'r') startLevel(currentLevel);
        else if (k === 'Escape') showSelect();
        break;
      case 'CLEAR':
        if (k === 'Enter' && currentLevel < VB.LEVELS.length) showIntro(currentLevel + 1);
        else if (k === 'r') startLevel(currentLevel);
        else if (k === 'Escape') showSelect();
        break;
    }
  });
  function showPauseRefresh() {
    show(`<h2>PAUSED</h2>${menuHtml([{ label: 'RESUME' }, { label: 'RESTART LEVEL' }, { label: 'QUIT TO MENU' }], menuIdx)}
      <div class="foot">j/k · Enter · Esc resume</div>`);
  }
  function menuNav(k, rerender, pick, back) {
    if (k === 'j') { menuIdx = (menuIdx + 1) % menuLen; pendingG = false; snd.move(); rerender(); }
    else if (k === 'k') { menuIdx = (menuIdx - 1 + menuLen) % menuLen; pendingG = false; snd.move(); rerender(); }
    else if (k === 'g') { if (pendingG) { menuIdx = 0; pendingG = false; rerender(); } else pendingG = true; }
    else if (k === 'G') { menuIdx = menuLen - 1; pendingG = false; rerender(); }
    else if (k === 'Enter' || k === 'l') { pendingG = false; pick(); }
    else if ((k === 'Escape' || k === 'h') && back) { pendingG = false; back(); }
  }

  function gameKey(k) {
    const st = VB.state;
    if (!st || st.status === 'won' || st.status === 'fail') return;
    // "try a count" coaching
    if (st.mode === 'normal' && 'hjkl'.includes(k)) {
      if (k === repeatKey) {
        repeatCount++;
        if (repeatCount === 4) toast(`try 4${k} instead of ${k.repeat(4)}`, 'count');
      } else { repeatKey = k; repeatCount = 1; }
    } else repeatKey = '';
    const beforeMode = st.mode;
    VB.key(k);
    if (st.mode !== beforeMode) updateTermbox();
    if (['w', 'b', 'e', 'f', 'F', '0', '$', 'G'].includes(st.lastCmd?.slice(-1)) && st.mode === 'normal') snd.slide();
  }

  // ---------- terminal box ----------
  function updateTermbox() {
    const box = $('termbox');
    const st = VB.state;
    if (!st || st.mode !== 'terminal' || !st.term) { box.classList.add('hidden'); return; }
    const t = st.term.t, ins = st.term.insert;
    const chars = t.buffer.map((c, i) =>
      `<span class="${i === t.cursor ? (ins ? 'cur ins' : 'cur') : ''}">${c}</span>`).join('');
    const tail = t.cursor >= t.buffer.length ? `<span class="${ins ? 'cur ins' : 'cur'}">&nbsp;</span>` : '';
    box.innerHTML = `<div class="buf">${chars}${tail}</div>
      <div class="tgt">make it say: <b>${t.target}</b>  (hint: ${t.hint || 'edit it'})</div>
      <div class="tmode">${ins ? '-- INSERT -- (Esc to commit)' : 'normal · h l x r ~ s cw ciw i a · Esc leave'}</div>`;
    box.classList.remove('hidden');
  }

  // ---------- rendering ----------
  function sizeCanvas() {
    const st = VB.state;
    canvas.width = st.W * CELL;
    canvas.height = st.H * CELL;
  }
  const COLORS = {
    wall: '#284434', wallEdge: '#3d5c45', rock: '#8a7a5c', hard: '#7e8fa3',
    floor: '#16211a', letter: '#4dd0e1', letterBg: '#0f2429', term: '#c792ea',
    termBg: '#231433', bush: '#43a047', exit: '#33ff66', oneway: '#5c8dff',
    player: '#33ff66', zombie: '#7dc95e', imp: '#ff6b9d', mage: '#b18cff',
    bombA: '#ffd23f', bombB: '#ff3b3b', item: '#ffd23f',
  };
  function lerpPos(obj) {
    let l = lerps.get(obj);
    if (!l) { l = { x: obj.x, y: obj.y }; lerps.set(obj, l); }
    l.x += (obj.x - l.x) * 0.45;
    l.y += (obj.y - l.y) * 0.45;
    if (Math.abs(l.x - obj.x) < 0.01) l.x = obj.x;
    if (Math.abs(l.y - obj.y) < 0.01) l.y = obj.y;
    return l;
  }
  function glyph(ch, x, y, color, size = 0.62, glow = 0, bold = true) {
    ctx.font = `${bold ? 'bold ' : ''}${Math.floor(CELL * size)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowBlur = glow; ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillText(ch, (x + 0.5) * CELL, (y + 0.54) * CELL);
    ctx.shadowBlur = 0;
  }
  function cellBg(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  }

  function draw(now) {
    requestAnimationFrame(draw);
    const st = VB.state;
    updateHud();
    if (!st) return;
    ctx.save();
    ctx.fillStyle = '#0a0f0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (shake > 0.3) {
      ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);
      shake *= 0.82;
    }
    const blink = Math.floor(now / 500) % 2 === 0;
    // tiles
    for (let y = 0; y < st.H; y++) {
      for (let x = 0; x < st.W; x++) {
        const c = st.grid[y][x];
        if (c === '#') {
          cellBg(x, y, COLORS.wall);
          ctx.strokeStyle = COLORS.wallEdge;
          ctx.strokeRect(x * CELL + 2.5, y * CELL + 2.5, CELL - 5, CELL - 5);
        } else if (c === '%') { cellBg(x, y, '#241f14'); glyph('▒', x, y, COLORS.rock, 0.72); }
        else if (c === '&') { cellBg(x, y, '#1a1f26'); glyph('▓', x, y, COLORS.hard, 0.72); }
        else if (c === '~') { cellBg(x, y, '#000'); }
        else if (c === '*') { glyph('♣', x, y, COLORS.bush, 0.6); }
        else if (c === 'E') { if (blink) cellBg(x, y, '#10301b'); glyph('E', x, y, COLORS.exit, 0.62, 12); }
        else if (c >= 'a' && c <= 'z') { cellBg(x, y, COLORS.letterBg); glyph(c, x, y, COLORS.letter, 0.55); }
        else if (c === 'T') {
          const t = st.terminals[x + ',' + y];
          cellBg(x, y, COLORS.termBg);
          glyph(':', x, y, t && t.solved ? '#4d3d63' : COLORS.term, 0.62, t && !t.solved && blink ? 10 : 0);
        }
        else if (c === '<' || c === '>' || c === '^' || c === 'V') {
          glyph({ '<': '‹', '>': '›', '^': '˄', V: '˅' }[c], x, y, COLORS.oneway, 0.7);
        }
        else if ('KRUB'.includes(c) && c !== '.') {
          glyph({ K: '+', R: 'R', U: 'u', B: 'B' }[c], x, y, COLORS.item, 0.55, 8);
        }
        else { glyph('·', x, y, '#1e2f24', 0.5, 0, false); }
      }
    }
    // mage telegraph
    for (const e of st.enemies) {
      if (e.type === 'mage' && e.target) {
        if (blink) glyph('◌', e.target[0], e.target[1], COLORS.mage, 0.8, 10);
      }
    }
    // bombs
    for (const b of st.bombs) {
      const urgent = b.fuse <= 2;
      const pulse = 0.56 + 0.08 * Math.sin(now / (urgent ? 70 : 180));
      glyph('●', b.x, b.y, urgent ? COLORS.bombB : COLORS.bombA, pulse, 12);
      glyph(String(Math.max(0, b.fuse)), b.x + 0.28, b.y - 0.3, '#fff', 0.26);
    }
    // projectiles
    for (const p of st.projectiles) glyph('✦', p.x, p.y, COLORS.mage, 0.5, 10);
    // explosions (350ms flash)
    explosions = explosions.filter((ex) => now - ex.t0 < 350);
    for (const ex of explosions) {
      const age = (now - ex.t0) / 350;
      const col = age < 0.3 ? '#ffffff' : age < 0.65 ? COLORS.bombA : COLORS.bombB;
      glyph(['✳', '✺', '✳', '·'][Math.floor(age * 4)] || '·', ex.x, ex.y, col, 0.8 - age * 0.3, 14);
    }
    // enemies
    for (const e of st.enemies) {
      const l = lerpPos(e);
      const ch = { zombie: 'Z', imp: '&', mage: 'M' }[e.type];
      const col = COLORS[e.type];
      if (e.type === 'mage' && e.mstate === 'port') ctx.globalAlpha = 0.45;
      glyph(ch, l.x, l.y, col, 0.6, 6);
      ctx.globalAlpha = 1;
    }
    // player
    const pl = lerpPos(st.player);
    if (!(st.player.iframes > 0 && blink)) glyph('@', pl.x, pl.y, COLORS.player, 0.62, 14);
    ctx.restore();
    // damage flash
    if (flashRed > 0.02) {
      ctx.fillStyle = `rgba(255,59,59,${flashRed * 0.35})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      flashRed *= 0.86;
    }
  }

  // ---------- HUD / statusline ----------
  function slMode(m) {
    const el = $('sl-mode');
    el.textContent = `-- ${m} --`;
    el.classList.toggle('insert', m === 'INSERT');
  }
  function updateHud() {
    const st = VB.state;
    if (!st || (screen !== 'GAME' && screen !== 'PAUSE' && screen !== 'DEAD' && screen !== 'FAIL' && screen !== 'CLEAR')) {
      $('hud-level').textContent = 'VIMBERMAN';
      $('hud-keys').textContent = '';
      $('hud-right').textContent = 'v1.0';
      $('sl-pos').textContent = ''; $('sl-pend').textContent = ''; $('sl-last').textContent = '';
      $('sl-echo').textContent = 'a game about typing your way out';
      return;
    }
    $('hud-level').textContent = `L${String(currentLevel).padStart(2, '0')} · ${st.lv.name}`;
    const rem = st.limit - st.keys, frac = rem / st.limit;
    const keysEl = $('hud-keys');
    keysEl.textContent = `KEYS ${st.keys}/${st.limit}`;
    keysEl.className = frac > 0.5 ? '' : frac > 0.2 ? 'warn' : 'danger';
    $('hud-right').textContent =
      `BOMBS ${'●'.repeat(st.player.bombs)}${'○'.repeat(Math.max(0, 3 - st.player.bombs))}  UNDO ${st.player.undo}  R${st.player.radius}`;
    if (screen === 'GAME') slMode(st.mode === 'terminal' ? (st.term && st.term.insert ? 'INSERT' : 'EDIT') : 'NORMAL');
    $('sl-pos').textContent = `${st.player.x},${st.player.y}`;
    $('sl-pend').textContent = st.pending.count + (st.pending.op || '') +
      (st.mode === 'terminal' && st.term ? st.term.pending.count + (st.term.pending.op || '') : '');
    $('sl-last').textContent = st.lastCmd || '';
    const echoEl = $('sl-echo');
    echoEl.textContent = st.echo || '';
    echoEl.className = (st.echo || '').startsWith('E:') ? 'echo' : '';
  }

  // ---------- boot ----------
  showTitle();
  requestAnimationFrame(draw);
})();
