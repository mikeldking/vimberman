// Procedural pixel-art sprite atlas. Every sprite is a 16×16 character grid
// rendered once into an offscreen canvas; '.' is transparent. Rows are
// validated at build time so a miscounted row fails loudly, not silently.

export type Frame = HTMLCanvasElement;

type Palette = Record<string, string>;

const SIZE = 16;

function frame(rows: string[], pal: Palette): Frame {
  if (rows.length !== SIZE) throw new Error(`sprite has ${rows.length} rows, want ${SIZE}`);
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const g = c.getContext('2d')!;
  rows.forEach((row, y) => {
    if (row.length !== SIZE) throw new Error(`sprite row ${y} has ${row.length} cols, want ${SIZE}: "${row}"`);
    for (let x = 0; x < SIZE; x++) {
      const col = pal[row[x]];
      if (row[x] !== '.' && col === undefined) throw new Error(`sprite row ${y} col ${x}: unknown palette key "${row[x]}"`);
      if (col) {
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
  });
  return c;
}

export interface SpriteSet {
  // entities (transparent background)
  player: [Frame, Frame];
  playerDead: Frame;
  zombie: [Frame, Frame];
  imp: [Frame, Frame];
  mage: [Frame, Frame];
  magePort: Frame;
  bomb: [Frame, Frame];
  bombUrgent: [Frame, Frame];
  boltH: Frame;
  boltV: Frame;
  telegraph: [Frame, Frame];
  explosion: [Frame, Frame, Frame, Frame];
  // overlays on floor (transparent background)
  bush: [Frame, Frame];
  exit: [Frame, Frame];
  oneway: { '<': Frame; '>': Frame; '^': Frame; V: Frame };
  itemK: Frame;
  itemR: Frame;
  itemU: Frame;
  itemB: Frame;
  keycap: Frame;
  termOn: [Frame, Frame];
  termOff: Frame;
  // full-bleed terrain
  wall: Frame;
  floor: [Frame, Frame, Frame];
  rock: Frame;
  hard: Frame;
  gap: [Frame, Frame];
}

export function buildSprites(): SpriteSet {
  // ---------------- player: console cowboy in a teal hoodie ----------------
  const P: Palette = {
    o: '#0e1418', h: '#1f8a9e', H: '#36c3d9', t: '#12525e',
    s: '#f0c8a0', S: '#c79067', e: '#123338', E: '#5ffbde',
    b: '#155e6b', p: '#233042', d: '#0f1722', g: '#33ff66',
  };
  const player0 = frame([
    '................',
    '.....oooooo.....',
    '....oHHHHHHo....',
    '...oHHHHHHHHo...',
    '...oHthhhhtHo...',
    '...ohssssssho...',
    '...ohsEssEsho...',
    '...ohssssssho...',
    '....ossSSsso....',
    '....oohhhhoo....',
    '...oHhbggbhHo...',
    '...oHhbbbbhHo...',
    '....oohbbhoo....',
    '.....opoopo.....',
    '.....odoodo.....',
    '................',
  ], P);
  const player1 = frame([
    '................',
    '................',
    '.....oooooo.....',
    '....oHHHHHHo....',
    '...oHHHHHHHHo...',
    '...oHthhhhtHo...',
    '...ohssssssho...',
    '...ohsEssEsho...',
    '...ohssssssho...',
    '....ossSSsso....',
    '...oHhbggbhHo...',
    '...oHhbbbbhHo...',
    '....oohbbhoo....',
    '.....opoopo.....',
    '.....odoodo.....',
    '................',
  ], P);
  const playerDead = frame([
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....oooooo.....',
    '....oHHHHHHo....',
    '...oHhssssHHo...',
    '...ohsxssxsho...',
    '...ohssssssho...',
    '..oohhbbbbhhoo..',
    '.oHHhbbbbbbhHHo.',
    '.oooooooooooooo.',
    '................',
    '................',
  ], { ...P, x: '#123338' });

  // ---------------- zombie: shambling green corpse ----------------
  const Z: Palette = {
    o: '#101a0c', l: '#a4e552', g: '#63b32e', d: '#3c7a1e',
    e: '#ff3b3b', m: '#1d3810', s: '#5c4a6e', S: '#7a648c', p: '#2c2340',
  };
  const zombie0 = frame([
    '................',
    '...oooooooo.....',
    '..ollllllgdo....',
    '..olllllllgo....',
    '..oleellgeglo...',
    '..olllllllgo....',
    '..olgmmmlggo....',
    '...ogggggdo.....',
    'oooosSSSSsoooo..',
    'olggsSSSSsgglo..',
    'oddosSsSSsoddo..',
    '....sSsoSs......',
    '....oppopp......',
    '....opoopo......',
    '....ogo.ogo.....',
    '................',
  ], Z);
  const zombie1 = frame([
    '................',
    '................',
    '...oooooooo.....',
    '..ollllllgdo....',
    '..olllllllgo....',
    '..oleellgeglo...',
    '..olllllllgo....',
    '..olgmmmlggo....',
    '...ogggggdo.....',
    '.ooosSSSSsooo...',
    'olggsSSSSsgglo..',
    'odooSsSSsSoodo..',
    '....oppopp......',
    '....poopoo......',
    '...ogo..ogo.....',
    '................',
  ], Z);

  // ---------------- imp: bomb-happy pink devil ----------------
  const I: Palette = {
    o: '#1c0b12', p: '#f2688c', P: '#ff9db4', d: '#a12c50',
    h: '#ffe9c5', e: '#ffe12e', m: '#4d0f22', w: '#c44569',
  };
  const imp0 = frame([
    '................',
    '...oh.....ho....',
    '...oho...oho....',
    '....opooopo.....',
    '...opPPPPPpo....',
    '...oPePPePpo....',
    '...oPPPPPPpo....',
    '...opmmmmppo....',
    '..oowppppwoo....',
    '.owwoPPPPowwo...',
    '.owo.opppo.owo..',
    '....oppppo......',
    '.....oppo.......',
    '....opo.opo.....',
    '...oo.....oo....',
    '................',
  ], I);
  const imp1 = frame([
    '................',
    '................',
    '...oh.....ho....',
    '...oho...oho....',
    '....opooopo.....',
    '...opPPPPPpo....',
    '...oPePPePpo....',
    '...oPPPPPPpo....',
    '...opmmmmppo....',
    '.oowwppppwwoo...',
    '.owooPPPPoowo...',
    '....oppppo......',
    '.....oppo.......',
    '...opo...opo....',
    '..oo.......oo...',
    '................',
  ], I);

  // ---------------- mage: teleporting warlock ----------------
  const M: Palette = {
    o: '#150e26', r: '#7c5cd6', R: '#a48aec', d: '#4a3690',
    f: '#241a45', e: '#e8dcff', s: '#8a6a4a', b: '#54ffe0',
  };
  const mage0 = frame([
    '................',
    '.......oo.......',
    '......oRRo......',
    '.....oRRRRo.....',
    '....oRRRRRRo....',
    '..ooooooooooo...',
    '...offffffdo....',
    '...ofeffefdo....',
    '...offffffdo.ob.',
    '....orrrrdo.obbo',
    '...orrrrrrdo.ob.',
    '...orrRrrrdos...',
    '..orrrRrrrrdso..',
    '..orrrRrrrrdso..',
    '.oooooooooooso..',
    '................',
  ], M);
  const mage1 = frame([
    '................',
    '................',
    '.......oo.......',
    '......oRRo......',
    '.....oRRRRo.....',
    '....oRRRRRRo....',
    '..ooooooooooo...',
    '...offffffdo.ob.',
    '...ofeffefdo.obo',
    '...offffffdo.ob.',
    '....orrrrdo..s..',
    '...orrRrrrdos...',
    '..orrrRrrrrdso..',
    '..orrrRrrrrdso..',
    '.oooooooooooso..',
    '................',
  ], M);
  const magePort = frame([
    '................',
    '.......bb.......',
    '......b..b......',
    '.....b.RR.b.....',
    '....o.RRRR.o....',
    '..o.o.o..o.o.o..',
    '...o.fff.f.o....',
    '...b.effe..b....',
    '...o.f..ff.o....',
    '....o.rr.r.o....',
    '...b.rr.rr.b....',
    '...o.r.rr..o....',
    '..o.rr.r.rr.o...',
    '..b..r.rr..b....',
    '.o.o.o..o.o.o...',
    '................',
  ], M);

  // ---------------- bombs ----------------
  const B: Palette = {
    o: '#05070a', k: '#1d2733', K: '#33445c', h: '#5c7896',
    f: '#c9995c', s: '#ffe12e', S: '#ff8c1a', r: '#ff3b3b', R: '#ffd0d0',
  };
  const bombRows = (spark: boolean, body: 'k' | 'r') => [
    '..........s.....',
    spark ? '.........sSs....' : '..........S.....',
    '..........f.....',
    '.........f......',
    '....oooof.......',
    '...oKKKKoo......',
    '..oKhhKKKKo.....',
    '.oKhhKKKKKKo....',
    '.oKhKKKKKKKo....',
    `.o${body}KKKKKKK${body}o....`,
    `.o${body}${body}KKKKK${body}${body}o....`,
    `.o${body}${body}${body}KKK${body}${body}${body}o....`,
    `..o${body}${body}${body}${body}${body}${body}${body}o.....`,
    '...ooooooo......',
    '................',
    '................',
  ];
  const bomb0 = frame(bombRows(true, 'k'), B);
  const bomb1 = frame(bombRows(false, 'k'), B);
  const bombU0 = frame(bombRows(true, 'r'), { ...B, K: '#5c2333', h: '#96455c', k: '#33111d' });
  const bombU1 = frame(bombRows(false, 'r'), { ...B, K: '#5c2333', h: '#96455c', k: '#33111d' });

  // ---------------- mage bolt / telegraph ----------------
  const boltPal: Palette = { p: '#b18cff', P: '#e8dcff', o: '#4a3690' };
  const boltH = frame([
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....o......o....',
    '..oppPPPPPPppo..',
    '.opPPPPPPPPPPpo.',
    '..oppPPPPPPppo..',
    '....o......o....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ], boltPal);
  const boltV = frame([
    '................',
    '.......oo.......',
    '......oppo......',
    '......pPPp......',
    '.....oPPPPo.....',
    '.....pPPPPp.....',
    '.....pPPPPp.....',
    '.....PPPPPP.....',
    '.....PPPPPP.....',
    '.....pPPPPp.....',
    '.....pPPPPp.....',
    '.....oPPPPo.....',
    '......pPPp......',
    '......oppo......',
    '.......oo.......',
    '................',
  ], boltPal);
  const teleRows = [
    '................',
    '.....mMmMmM.....',
    '....M......m....',
    '...m........M...',
    '..M..........m..',
    '..m...mMmM...M..',
    '..M..m....m..m..',
    '..m..M....M..M..',
    '..M...mMmM...m..',
    '..m..........M..',
    '...M........m...',
    '....m......M....',
    '.....MmMmMm.....',
    '................',
    '................',
    '................',
  ];
  const tele0 = frame(teleRows, { m: '#b18cff', M: '#6d4fc2' });
  const tele1 = frame(teleRows, { m: '#6d4fc2', M: '#b18cff' });

  // ---------------- explosion (4 frames) ----------------
  const X: Palette = {
    w: '#ffffff', y: '#ffe12e', Y: '#ffd23f', s: '#ff8c1a', r: '#ff3b3b', k: '#5c5c66', K: '#2e2e38',
  };
  const boom0 = frame([
    '................',
    '................',
    '................',
    '................',
    '......yy........',
    '.....ywwy.......',
    '....ywwwwyy.....',
    '....ywwwwwy.....',
    '.....ywwwy......',
    '......yyy.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ], X);
  const boom1 = frame([
    '................',
    '................',
    '......ss........',
    '....ssyyss......',
    '...syywwyys.....',
    '..syywwwwyys....',
    '..sywwwwwwys....',
    '..sywwwwwwys....',
    '..syywwwwyys....',
    '...syywwyys.....',
    '....ssyyss......',
    '......ss........',
    '................',
    '................',
    '................',
    '................',
  ], X);
  const boom2 = frame([
    '....r......r....',
    '..r..s....s..r..',
    '....ssyyyyss....',
    '...syyYYYYyys...',
    '..syYYwwwwYYys..',
    '.rsyYwwwwwwYysr.',
    '.syYwwwwwwwwYys.',
    '.syYwwwwwwwwYys.',
    '.syYwwwwwwwwYys.',
    '.rsyYwwwwwwYysr.',
    '..syYYwwwwYYys..',
    '...syyYYYYyys...',
    '....ssyyyyss....',
    '..r..s....s..r..',
    '....r......r....',
    '................',
  ], X);
  const boom3 = frame([
    '................',
    '..K..........K..',
    '....KK....KK....',
    '...KkkK..KkkK...',
    '..Kk.......kK...',
    '..K...rr....K...',
    '.....rssr.......',
    '....KssssssK....',
    '....Kssssr.K....',
    '.....rssr.......',
    '..K...rr....K...',
    '..Kk.......kK...',
    '...KkkK..KkkK...',
    '....KK....KK....',
    '..K..........K..',
    '................',
  ], X);

  // ---------------- terrain: wall / floor / rock / hard / gap ----------------
  // Solid beveled block — bright top bevel, shaded bottom-right, moss flecks.
  // Must read as unmistakably raised next to the near-flat floor.
  const W: Palette = {
    o: '#0c1510', P: '#63946d', f: '#3a5f46', s: '#2e4d38', d: '#1b3023', g: '#79b060',
  };
  const wall = frame([
    'oooooooooooooooo',
    'oPPPPPPPPPPPPPdo',
    'oPffffffffffffdo',
    'oPfgffffffffsfdo',
    'oPffffffsfffffdo',
    'oPfffffffffgffdo',
    'oPfsffffffffffdo',
    'oPffffgfffsfffdo',
    'oPffffffffffffdo',
    'oPfffsffffffgfdo',
    'oPfgffffffffffdo',
    'oPffffffsfffffdo',
    'oPffffffffffffdo',
    'oPssssssssssssdo',
    'oddddddddddddddo',
    'oooooooooooooooo',
  ], W);

  // Near-flat dark ground; three speckle variants keep it alive without
  // competing with the raised wall blocks.
  const F: Palette = { f: '#111a12', p: '#1a2619', d: '#0c130d', l: '#20301e' };
  const floor0 = frame([
    'ffffffffffffffff',
    'ffffffffffffffff',
    'ffffffffffffffff',
    'fffffffffffpffff',
    'ffffffffffffffff',
    'ffpfffffffffffff',
    'ffffffffffffffff',
    'ffffffffdfffffff',
    'ffffffffffffffff',
    'ffffffffffffffff',
    'fffffffffffffpff',
    'ffffffffffffffff',
    'ffffdfffffffffff',
    'ffffffffffffffff',
    'ffffffffffpfffff',
    'ffffffffffffffff',
  ], F);
  const floor1 = frame([
    'ffffffffffffffff',
    'ffffffffffffffff',
    'fffplfffffffffff',
    'ffffffffffffffff',
    'ffffffffffffdfff',
    'ffffffffffffffff',
    'ffffffffffffffff',
    'ffffffpfffffffff',
    'ffffffffffffffff',
    'fdffffffffffffff',
    'ffffffffffffffff',
    'fffffffffflpffff',
    'ffffffffffffffff',
    'ffffffffffffffff',
    'ffpfffffffffffff',
    'ffffffffffffffff',
  ], F);
  const floor2 = frame([
    'ffffffffffffffff',
    'ffffffffffffffff',
    'ffffffffffffffff',
    'ffffffffffpfffff',
    'ffffffffffffffff',
    'ffffffffffffffff',
    'fffdffffffffffff',
    'ffffffffffffffff',
    'fffffffffffffffl',
    'ffffffffffffffff',
    'ffffpfffffffffff',
    'ffffffffffffffff',
    'ffffffffffffffff',
    'ffffffffffffdfff',
    'ffffffffffffffff',
    'ffffffffffffffff',
  ], F);

  const R: Palette = {
    o: '#241c10', l: '#b8a87f', m: '#8a7a5c', d: '#5c5140', c: '#3a3226',
  };
  const rock = frame([
    '................',
    '.....oooooo.....',
    '...oommmmlloo...',
    '..ommmllllllmo..',
    '..omlllllllmmo..',
    '.omllllcllllmmo.',
    '.omlllcclllmmdo.',
    '.omllcllllmmddo.',
    '.ommlclllmmmddo.',
    '.ommmclmmmmdddo.',
    '.ommmmcmmmdddo..',
    '..ommmmmmddddo..',
    '..oommmdddddoo..',
    '....ooddddoo....',
    '......oooo......',
    '................',
  ], R);

  const HD: Palette = {
    o: '#20242c', p: '#8fa0b5', P: '#aab8cc', d: '#4f5b6b', r: '#c8d3e0', k: '#39424f',
  };
  const hard = frame([
    'oooooooooooooooo',
    'oPPPPPPPPPPPPPPo',
    'oPrpppppppppprdo',
    'oPpppppppppppddo',
    'oPppkkkkkkkppddo',
    'oPppkdddddkppddo',
    'oPppkdpppdkppddo',
    'oPppkdpppdkppddo',
    'oPppkdpppdkppddo',
    'oPppkdddddkppddo',
    'oPppkkkkkkkppddo',
    'oPpppppppppppddo',
    'oPrppppppppprddo',
    'oPdddddddddddddo',
    'odddddddddddddoo',
    'oooooooooooooooo',
  ], HD);

  const G: Palette = { v: '#04060a', s: '#1d2a44', S: '#2c3a55', e: '#0a1120' };
  const gap0 = frame([
    'vvvvvvvvvvvvvvvv',
    'vvvvvvvvvvvvvvvv',
    'vvvvSvvvvvvvvvvv',
    'vvvvvvvvvvvvsvvv',
    'vvvvvvvvvvvvvvvv',
    'vvevvvvvvvvvvvvv',
    'vvvvvvvvsvvvvvvv',
    'vvvvvvvvvvvvvvvv',
    'vvvvvvvvvvvvvvev',
    'vsvvvvvvvvvvvvvv',
    'vvvvvvvvvvvSvvvv',
    'vvvvvvvvvvvvvvvv',
    'vvvvvvevvvvvvvvv',
    'vvvvvvvvvvvvvvvv',
    'vvSvvvvvvvvvsvvv',
    'vvvvvvvvvvvvvvvv',
  ], G);
  const gap1 = frame([
    'vvvvvvvvvvvvvvvv',
    'vvvvvvvvvvvvvvvv',
    'vvvvsvvvvvvvvvvv',
    'vvvvvvvvvvvvSvvv',
    'vvvvvvvvvvvvvvvv',
    'vvevvvvvvvvvvvvv',
    'vvvvvvvvSvvvvvvv',
    'vvvvvvvvvvvvvvvv',
    'vvvvvvvvvvvvvvev',
    'vSvvvvvvvvvvvvvv',
    'vvvvvvvvvvvsvvvv',
    'vvvvvvvvvvvvvvvv',
    'vvvvvvevvvvvvvvv',
    'vvvvvvvvvvvvvvvv',
    'vvsvvvvvvvvvSvvv',
    'vvvvvvvvvvvvvvvv',
  ], G);

  // ---------------- bush / exit / one-way / items / keycap / terminal ----------------
  const BU: Palette = {
    o: '#122408', g: '#3f7d2f', G: '#57a63f', l: '#77c94f', b: '#ffd23f', t: '#5c4a2e',
  };
  const bush0 = frame([
    '................',
    '.....oo..oo.....',
    '...ooGGooGGoo...',
    '..oGGlGGGGlGGo..',
    '..oGlllGGlllGo..',
    '.oGGllGGGGllGGo.',
    '.oGlbGGllGGGbGo.',
    '.oGGGGlllGGGGGo.',
    '.oGGllGGGGllGGo.',
    '..oGGGGbGGGGGo..',
    '..ogGGGGGGGggo..',
    '...oggggggggo...',
    '....oogtggoo....',
    '......otto......',
    '................',
    '................',
  ], BU);
  const bush1 = frame([
    '................',
    '................',
    '.....oo..oo.....',
    '...ooGGooGGoo...',
    '..oGGlGGGGlGGo..',
    '..oGlllGGlllGo..',
    '.oGGllGGGGllGGo.',
    '.oGlbGGllGGGbGo.',
    '.oGGGGlllGGGGGo.',
    '.oGGllGGGGllGGo.',
    '..oGGGGbGGGGGo..',
    '...oggggggggo...',
    '....oogtggoo....',
    '......otto......',
    '................',
    '................',
  ], BU);

  const EX: Palette = {
    o: '#0a2a14', g: '#1f8a44', G: '#33ff66', w: '#b6ffce', d: '#05140a',
  };
  const exit0 = frame([
    '....oooooooo....',
    '...oggGGGGggo...',
    '..ogGwddddwGgo..',
    '.ogGddddddddGgo.',
    '.ogwddddddddGgo.',
    '.oGdddGGddddGgo.',
    '.oGdddGwGdddGgo.',
    '.oGddddGGdddGgo.',
    '.oGdddGGGGddGgo.',
    '.oGddddddddwGgo.',
    '.ogGddddddddGgo.',
    '..ogGwddddwGgo..',
    '...oggGGGGggo...',
    '....oooooooo....',
    '................',
    '................',
  ], EX);
  const exit1 = frame([
    '....oooooooo....',
    '...oggGGGGggo...',
    '..ogGddddddGgo..',
    '.ogGddddddwdGgo.',
    '.ogGddGGGdddGgo.',
    '.oGdddGwGGddGgo.',
    '.oGddwGGGGddGgo.',
    '.oGddddGGGddGgo.',
    '.oGdddddGdddGgo.',
    '.oGwddddddddGgo.',
    '.ogGddddddddGgo.',
    '..ogGddddddGgo..',
    '...oggGGGGggo...',
    '....oooooooo....',
    '................',
    '................',
  ], EX);

  const OW: Palette = { a: '#5c8dff', A: '#8fb0ff', o: '#1c2a4d' };
  const chevron = (rows: string[]) => frame(rows, OW);
  const owLeft = chevron([
    '................',
    '................',
    '................',
    '........oo......',
    '.......oAao.....',
    '......oAaoo.....',
    '.....oAao.......',
    '....oAao..oo....',
    '....oAao.oAao...',
    '.....oAaoAao....',
    '......oAAao.....',
    '.......oAo......',
    '........o.......',
    '................',
    '................',
    '................',
  ]);
  const owRight = chevron([
    '................',
    '................',
    '................',
    '......oo........',
    '.....oaAo.......',
    '.....ooaAo......',
    '.......oaAo.....',
    '....oo..oaAo....',
    '...oaAo.oaAo....',
    '....oaAoaAo.....',
    '.....oaAAo......',
    '......oAo.......',
    '.......o........',
    '................',
    '................',
    '................',
  ]);
  const owUp = chevron([
    '................',
    '................',
    '................',
    '.......oo.......',
    '......oAAo......',
    '.....oAaaAo.....',
    '....oAao.oAo....',
    '...oAao...oAo...',
    '....oo.....o....',
    '.......oo.......',
    '......oAAo......',
    '.....oAaaAo.....',
    '....oAo..oAo....',
    '................',
    '................',
    '................',
  ]);
  const owDown = chevron([
    '................',
    '................',
    '................',
    '....oAo..oAo....',
    '.....oAaaAo.....',
    '......oAAo......',
    '.......oo.......',
    '....o.....o.....',
    '...oAo...oAao...',
    '....oAo.oAao....',
    '.....oAaaAo.....',
    '......oAAo......',
    '.......oo.......',
    '................',
    '................',
    '................',
  ]);

  // items
  const IK: Palette = { o: '#453306', k: '#ffd23f', K: '#fff0a0', d: '#b8931f', f: '#1c1608' };
  const itemK = frame([
    '................',
    '................',
    '....oooooooo....',
    '...oKKKKKKKKo...',
    '...oKkkkkkkdo...',
    '...oKkkfkkkdo...',
    '...oKkfffkkdo...',
    '...oKkkfkkkdo...',
    '...oKkkfkkkdo...',
    '...oKkkkkkkdo...',
    '...odddddddo....',
    '....oooooooo....',
    '................',
    '................',
    '................',
    '................',
  ], IK);
  const IR: Palette = { o: '#4d1200', r: '#ff5722', R: '#ff9800', y: '#ffe12e', w: '#fff6c8' };
  const itemR = frame([
    '................',
    '.......o........',
    '......oro.......',
    '......oro..o....',
    '.....orRro.oo...',
    '.....orRro.oro..',
    '....orRyRrooro..',
    '....orRyRrooro..',
    '...orRyyyRrRro..',
    '...orRywwyRRro..',
    '...orRywwyRro...',
    '....orRyyRro....',
    '.....orrrro.....',
    '......oooo......',
    '................',
    '................',
  ], IR);
  const IU: Palette = { o: '#062d33', c: '#26c6da', C: '#7ce8f4', d: '#0e7583' };
  const itemU = frame([
    '................',
    '................',
    '......ooooo.....',
    '....ooCCCCCoo...',
    '...oCCoooooCCo..',
    '..oCCo.....oCo..',
    '..oCo.......oo..',
    '..oCo...........',
    '..oCo.....o.....',
    '..oCCo...oCo....',
    '...oCCo.oCCCo...',
    '....ooCCCCCCCo..',
    '......ooooooo...',
    '................',
    '................',
    '................',
  ], IU);
  const IB: Palette = { o: '#05070a', k: '#33445c', K: '#5c7896', s: '#ffe12e', g: '#33ff66' };
  const itemB = frame([
    '................',
    '.........s......',
    '........s.......',
    '......ooso......',
    '.....oKKkko.....',
    '....oKKkkkko....',
    '....oKkkkkko....',
    '....okkkkkko....',
    '.....okkkko.....',
    '......oooo......',
    '...g............',
    '..ggg...........',
    '...g............',
    '................',
    '................',
    '................',
  ], IB);

  // keycap base for lettered tiles (glyph drawn on top by the renderer)
  const KC: Palette = { o: '#0b1a1e', t: '#39515e', T: '#2a3d47', f: '#16262c', s: '#07141a' };
  const keycap = frame([
    '................',
    '..oooooooooooo..',
    '.otttttttttttto.',
    '.otTTTTTTTTTTto.',
    '.otTffffffffTto.',
    '.otTffffffffTto.',
    '.otTffffffffTto.',
    '.otTffffffffTto.',
    '.otTffffffffTto.',
    '.otTffffffffTto.',
    '.otTTTTTTTTTTto.',
    '.otssssssssssto.',
    '.osssssssssssso.',
    '..oooooooooooo..',
    '................',
    '................',
  ], KC);

  // terminal: little CRT
  const TM: Palette = {
    o: '#1a1030', c: '#4b3a63', C: '#6a5487', s: '#150c20', g: '#c792ea',
    G: '#e6ccff', k: '#241740', d: '#37285c',
  };
  const termRows = (line1: string, line2: string) => [
    '................',
    '..oooooooooooo..',
    '.occcccccccccco.',
    '.ocssssssssssco.',
    `.ocs${line1}sco.`,
    '.ocssssssssssco.',
    `.ocs${line2}sco.`,
    '.ocssssssssssco.',
    '.ocssssssssssco.',
    '.occcccccccccco.',
    '..oooooooooooo..',
    '.....oCCco......',
    '....oCCCcco.....',
    '...occcccccco...',
    '................',
    '................',
  ];
  const termOn0 = frame(termRows('gGgg.ggg', 'gg.gggg.'), TM);
  const termOn1 = frame(termRows('gGgg.ggg', '.ggg.ggg'), TM);
  const termOff = frame(termRows('dd.ddd..', 'd.dd....'), { ...TM, g: '#3d2f57', G: '#4d3d63' });

  return {
    player: [player0, player1],
    playerDead,
    zombie: [zombie0, zombie1],
    imp: [imp0, imp1],
    mage: [mage0, mage1],
    magePort,
    bomb: [bomb0, bomb1],
    bombUrgent: [bombU0, bombU1],
    boltH, boltV,
    telegraph: [tele0, tele1],
    explosion: [boom0, boom1, boom2, boom3],
    bush: [bush0, bush1],
    exit: [exit0, exit1],
    oneway: { '<': owLeft, '>': owRight, '^': owUp, V: owDown },
    itemK, itemR, itemU, itemB,
    keycap,
    termOn: [termOn0, termOn1],
    termOff,
    wall,
    floor: [floor0, floor1, floor2],
    rock,
    hard,
    gap: [gap0, gap1],
  };
}

/** Deterministic per-cell hash for tile variants. */
export function cellHash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0);
}
