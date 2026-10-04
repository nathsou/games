// Pixel art. Pieces are authored as silhouettes and shaded automatically
// (light from the top left), so every set and palette stays consistent.
//   '#' body   'x' engraved line   '*' accent (gold)   '.' empty
import { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from './chess.js';

export const PIECE_MASKS = {
  [PAWN]: [
    '................',
    '................',
    '................',
    '................',
    '.......##.......',
    '......####......',
    '......####......',
    '.......##.......',
    '......####......',
    '.......##.......',
    '......####......',
    '.....######.....',
    '....########....',
    '....xxxxxxxx....',
    '...##########...',
    '................',
  ],
  [ROOK]: [
    '................',
    '................',
    '...##.####.##...',
    '...##########...',
    '...xxxxxxxxxx...',
    '....########....',
    '.....####x#.....',
    '.....######.....',
    '.....#x####.....',
    '.....######.....',
    '....xxxxxxxx....',
    '....########....',
    '...##########...',
    '...xxxxxxxxxx...',
    '..############..',
    '................',
  ],
  [KNIGHT]: [
    '................',
    '................',
    '.......#.#......',
    '......######....',
    '.....########...',
    '....##x#######..',
    '...###########..',
    '..####x#######..',
    '..###...######..',
    '.......#######..',
    '......#######...',
    '.....########...',
    '....xxxxxxxxx...',
    '...##########...',
    '..############..',
    '................',
  ],
  [BISHOP]: [
    '................',
    '.......**.......',
    '.......##.......',
    '......####......',
    '.....###x##.....',
    '.....##x###.....',
    '.....#x####.....',
    '......####......',
    '.....xxxxxx.....',
    '......####......',
    '......####......',
    '.....######.....',
    '....########....',
    '...xxxxxxxxxx...',
    '..############..',
    '................',
  ],
  [QUEEN]: [
    '................',
    '.*.....**.....*.',
    '.#..*..##..*..#.',
    '.##.#.####.#.##.',
    '.##############.',
    '..############..',
    '..###*####*###..',
    '...##########...',
    '....xxxxxxxx....',
    '.....######.....',
    '......####......',
    '.....######.....',
    '....########....',
    '...xxxxxxxxxx...',
    '..############..',
    '................',
  ],
  [KING]: [
    '.......**.......',
    '......****......',
    '.......**.......',
    '.....######.....',
    '....###xx###....',
    '...####xx####...',
    '...##########...',
    '....########....',
    '....xxxxxxxx....',
    '.....######.....',
    '......####......',
    '.....######.....',
    '....########....',
    '...xxxxxxxxxx...',
    '..############..',
    '................',
  ],
};

export const PIECE_PALETTES = {
  classic: [
    { outline: '#2b1d3a', light: '#ffffff', main: '#f3e7cf', shade: '#cdb894', deep: '#9a8166', line: '#7a6150', accent: '#ffcc4d', accentShade: '#d08a2a' },
    { outline: '#0b0814', light: '#8b7dc0', main: '#4d4174', shade: '#332a52', deep: '#211a38', line: '#160f26', accent: '#ff8a5c', accentShade: '#b8483a' },
  ],
  gameboy: [
    { outline: '#0f380f', light: '#e0f8d0', main: '#c4f0a0', shade: '#8bac0f', deep: '#6a8a10', line: '#306230', accent: '#e0f8d0', accentShade: '#8bac0f' },
    { outline: '#0f380f', light: '#5a8a3a', main: '#306230', shade: '#1e4a1e', deep: '#0f380f', line: '#0f380f', accent: '#8bac0f', accentShade: '#306230' },
  ],
  neon: [
    { outline: '#071029', light: '#ffffff', main: '#9ff3ff', shade: '#43c6e8', deep: '#2a7fc4', line: '#164a8a', accent: '#fff07a', accentShade: '#e0a02a' },
    { outline: '#14031c', light: '#ffb3f5', main: '#ff4fc8', shade: '#c42a9a', deep: '#7c1a6e', line: '#4a0d40', accent: '#fff07a', accentShade: '#e0a02a' },
  ],
  candy: [
    { outline: '#3a1830', light: '#ffffff', main: '#fff3f8', shade: '#f7c6d9', deep: '#d993b0', line: '#b06a8a', accent: '#5ee0c8', accentShade: '#2fa898' },
    { outline: '#1a0f2e', light: '#a99bff', main: '#6b55d9', shade: '#4a38a8', deep: '#2f2275', line: '#1c1450', accent: '#ffd35e', accentShade: '#d0942a' },
  ],
};

// Render a mask to a canvas with automatic shading.
export function shadeMask(mask, pal) {
  const h = mask.length, w = mask[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const filled = (x, y) => y >= 0 && y < h && x >= 0 && x < w && mask[y][x] !== '.';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = mask[y][x];
      let color = null;
      if (ch === '.') {
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) color = pal.outline;
      } else if (ch === 'x') color = pal.line;
      else if (ch === '*') color = filled(x, y - 1) && filled(x - 1, y) ? pal.accentShade : pal.accent;
      else {
        let L = x, R = x;
        while (L > 0 && mask[y][L - 1] !== '.') L--;
        while (R < w - 1 && mask[y][R + 1] !== '.') R++;
        const t = R === L ? 0.4 : (x - L) / (R - L);
        const top = !filled(x, y - 1) || mask[y - 1][x] === 'x';
        if (t > 0.86) color = pal.deep;
        else if (t > 0.6) color = pal.shade;
        else if ((top && t < 0.7) || t < 0.18) color = pal.light;
        else color = pal.main;
        if (y >= h - 3 && color === pal.light && !top) color = pal.main;
      }
      if (color) { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); }
    }
  }
  return c;
}

// Explicit-palette sprites (characters, icons).
export function paintSprite(rows, palette) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const col = palette[rows[y][x]];
    if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
  }
  return c;
}

const cache = new Map();
export function pieceSprite(type, color, set = 'classic') {
  const key = `${set}:${type}:${color}`;
  if (!cache.has(key)) {
    const pal = (PIECE_PALETTES[set] || PIECE_PALETTES.classic)[color];
    cache.set(key, shadeMask(PIECE_MASKS[type], pal));
  }
  cache.get(key).__friendSprite = {type: 'pieceSprite', args: [type, color, set]};
  return cache.get(key);
}

// A white silhouette of a piece (for flashes and glows).
export function pieceSilhouette(type, colorHex = '#ffffff') {
  const key = `sil:${type}:${colorHex}`;
  if (!cache.has(key)) {
    const pal = { outline: colorHex, light: colorHex, main: colorHex, shade: colorHex, deep: colorHex, line: colorHex, accent: colorHex, accentShade: colorHex };
    cache.set(key, shadeMask(PIECE_MASKS[type], pal));
  }
  return cache.get(key);
}

// ------------------------------------------------------------- icons

export const STAR = [
  '.....oo.....',
  '....oyyo....',
  '....oyyo....',
  '...oyyyyo...',
  'ooooyywyoooo',
  'oyyyyywyyyyo',
  '.oyyyyyyyyo.',
  '..oyyyyyyo..',
  '..oyyyyyyo..',
  '.oyyyoosyyo.',
  '.oyyo..osso.',
  '.ooo....ooo.',
];
export const STAR_PAL = { o: '#5a2d0c', y: '#ffd23f', w: '#fff7c2', s: '#e09a1a' };
export const STAR_EMPTY_PAL = { o: '#3b3361', y: '#544a86', w: '#6b62a0', s: '#463d75' };

// Professor Pip, the owl mentor (20x20).
export const OWL = [
  '....................',
  '.....kkkkkkkkkk.....',
  '...kkkkkkkkkkkkkk...',
  '.....kkkkkkkkkkt....',
  '....obbbbbbbbbbot...',
  '...obbbbbbbbbbbbog..',
  '..obffffbbbbffffbo..',
  '..offwwwfbbfwwwffo..',
  '..ofwwkkwffwkkwwfo..',
  '..ofwwkWwffwkWwwfo..',
  '..offwwwfnnfwwwffo..',
  '..obfffffnnfffffbo..',
  '..obbbcbbbbbbcbbbo..',
  '..obbccccbbccccbbo..',
  '..obbcbccccccbcbbo..',
  '...obbccbccbccbbo...',
  '...obbbccccccbbbo...',
  '....obbbbbbbbbbo....',
  '.....oyyo..oyyo.....',
  '....................',
];
export const OWL_PAL = {
  o: '#2a1a12', b: '#9a6440', f: '#e8cfa0', w: '#ffffff', k: '#1b1730', W: '#ffffff',
  n: '#f0a030', c: '#c99a6a', y: '#f0a030', t: '#ffcc4d', g: '#ffcc4d',
};
// Blink frame: eyes closed.
export const OWL_BLINK = OWL.map((row, y) => (y === 8 || y === 9) ? row.replace(/wwkkww/, 'ffkkff').replace(/wwkWww/, 'ffffff').replace(/kW/g, 'ff') : y === 7 ? row.replace(/fwwwf/g, 'fkkkf') : row);

export function owlSprite(blink = false) {
  const key = 'owl' + blink;
  if (!cache.has(key)) cache.set(key, paintSprite(blink ? OWL_BLINK : OWL, OWL_PAL));
  cache.get(key).__friendSprite = {type: 'owlSprite', args: [blink]};
  return cache.get(key);
}

export function starSprite(filled = true) {
  const key = 'star' + filled;
  if (!cache.has(key)) cache.set(key, paintSprite(STAR, filled ? STAR_PAL : STAR_EMPTY_PAL));
  cache.get(key).__friendSprite = {type: 'starSprite', args: [filled]};
  return cache.get(key);
}

// ------------------------------------------------------------- characters

// Boss portraits: a piece silhouette with a face and a hat, in a custom palette.
export const CHARACTERS = {
  gus: { name: 'Grabby Gus', piece: ROOK, pal: { outline: '#2a1208', light: '#ffd9a0', main: '#e09a4f', shade: '#b0662e', deep: '#7a3e1a', line: '#5a2a10', accent: '#ffe066', accentShade: '#c09020' }, face: 'grin', hat: null, bg: '#ff8a5c' },
  prance: { name: 'Sir Prance', piece: KNIGHT, pal: { outline: '#101828', light: '#ffffff', main: '#c8d4e8', shade: '#8a9cc0', deep: '#56668e', line: '#34405e', accent: '#ff5e7a', accentShade: '#b02a48' }, face: 'proud', hat: 'plume', bg: '#7fb4ff' },
  stomp: { name: 'Sergeant Stomp', piece: PAWN, pal: { outline: '#14200c', light: '#d8f0a0', main: '#8cb050', shade: '#5f8a30', deep: '#3c5c1c', line: '#2a4012', accent: '#ffcc4d', accentShade: '#c09020' }, face: 'stern', hat: 'helmet', bg: '#9adf6a' },
  rollo: { name: 'King Rollo', piece: KING, pal: { outline: '#2a0c1c', light: '#ffe0f0', main: '#f0a0c8', shade: '#c86a9a', deep: '#8e3e6a', line: '#5c1c40', accent: '#ffe066', accentShade: '#c09020' }, face: 'worried', hat: null, bg: '#ffb3d9' },
  hangs: { name: 'Sir Hangs-a-Lot', piece: BISHOP, pal: { outline: '#1c1408', light: '#fff4c0', main: '#e8d080', shade: '#b8a050', deep: '#807030', line: '#504518', accent: '#7fe9ff', accentShade: '#3aa0c0' }, face: 'dopey', hat: null, bg: '#ffe680' },
  tess: { name: 'Turtle Tess', piece: ROOK, pal: { outline: '#08201c', light: '#c0fff0', main: '#4fd0b0', shade: '#2a9c84', deep: '#16685a', line: '#0c4038', accent: '#ffcc4d', accentShade: '#c09020' }, face: 'sleepy', hat: 'shell', bg: '#5ef2c4' },
  fiona: { name: 'Fiona Forks', piece: KNIGHT, pal: { outline: '#200828', light: '#f8d0ff', main: '#c070e0', shade: '#8c40b0', deep: '#5a2078', line: '#3a1050', accent: '#ffe066', accentShade: '#c09020' }, face: 'sly', hat: 'bow', bg: '#d08cff' },
  iron: { name: 'The Iron Queen', piece: QUEEN, pal: { outline: '#0c0e14', light: '#f0f4ff', main: '#a8b4c8', shade: '#707c94', deep: '#465066', line: '#2a3040', accent: '#ff4f6a', accentShade: '#a82038' }, face: 'cold', hat: null, bg: '#8f9bb8' },
  pip: { name: 'Professor Pip', owl: true, bg: '#ffcc4d' },
  rookie: { name: 'Rookie Ray', piece: PAWN, pal: { outline: '#101828', light: '#ffffff', main: '#a8e0ff', shade: '#60a8e0', deep: '#3070b0', line: '#204a80', accent: '#ffcc4d', accentShade: '#c09020' }, face: 'happy', hat: 'cap', bg: '#a8e0ff' },
};

// Where a face sits on each piece: left eye x, right eye x (null = profile), eye y, eye size, mouth y, mouth x.
const FACE_ANCHOR = {
  [ROOK]: { l: 5, r: 9, y: 6, size: 2, my: 9, mx: 7 },
  [KNIGHT]: { l: 5, r: null, y: 4, size: 2, my: 8, mx: 2 },
  [PAWN]: { l: 6, r: 9, y: 5, size: 1, my: 7, mx: 7 },
  [KING]: { l: 5, r: 9, y: 5, size: 2, my: 7, mx: 7 },
  [BISHOP]: { l: 6, r: 9, y: 4, size: 1, my: 6, mx: 7 },
  [QUEEN]: { l: 5, r: 9, y: 5, size: 2, my: 7, mx: 7 },
};
// Moods: brow offsets (left, right: -1 = raised inner, 1 = angry), mouth pattern.
const MOODS = {
  grin: { brow: null, mouth: ['kkkk', '.ww.'] },
  proud: { brow: [0, 0], mouth: ['kk'] },
  stern: { brow: [1, 1], mouth: ['kk'] },
  worried: { brow: [-1, -1], mouth: ['.k', 'k.'] },
  dopey: { brow: null, mouth: ['k..k', '.kk.'], lazy: true },
  sleepy: { brow: null, mouth: ['kk'], closed: true },
  sly: { brow: [1, 0], mouth: ['..k', 'kk.'] },
  cold: { brow: [1, 1], mouth: ['kkk'] },
  happy: { brow: null, mouth: ['k..k', '.kk.'] },
};

export function characterSprite(id) {
  const key = 'char:' + id;
  if (cache.has(key)) return cache.get(key);
  const ch = CHARACTERS[id];
  if (ch.owl) { const c = owlSprite(false); cache.set(key, c); return c; }
  const base = shadeMask(PIECE_MASKS[ch.piece], ch.pal);
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const ctx = c.getContext('2d');
  ctx.drawImage(base, 0, 0);
  const A = FACE_ANCHOR[ch.piece], mood = MOODS[ch.face] || MOODS.happy;
  const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
  const K = '#120a18', W = '#ffffff';
  const eye = (x, flip) => {
    if (mood.closed) { px(x, A.y + A.size - 1, K); if (A.size > 1) px(x + 1, A.y + A.size - 1, K); return; }
    if (A.size === 1) { px(x, A.y, K); px(x, A.y + 1, K); return; }
    px(x, A.y, W); px(x + 1, A.y, W); px(x, A.y + 1, W); px(x + 1, A.y + 1, W);
    const pupX = mood.lazy ? x + (flip ? 0 : 1) : x + (flip ? 1 : 0);
    px(pupX, A.y + 1, K); px(pupX, A.y, K);
  };
  eye(A.l, false);
  if (A.r != null) eye(A.r, true);
  if (mood.brow) {
    const bw = A.size;
    const brow = (x, tilt, right) => {
      for (let i = 0; i < bw; i++) { const inner = right ? i === 0 : i === bw - 1; px(x + i, A.y - 1 - (tilt < 0 && inner ? 1 : 0) + (tilt > 0 && inner ? 0 : 0) - (tilt > 0 && !inner ? 1 : 0), ch.pal.line); }
    };
    brow(A.l, mood.brow[0], false);
    if (A.r != null) brow(A.r, mood.brow[1], true);
  }
  const mw = mood.mouth[0].length;
  const mx = A.r == null ? A.mx : Math.round((A.l + A.r + A.size) / 2 - mw / 2);
  mood.mouth.forEach((row, i) => [...row].forEach((p, j) => { if (p !== '.') px(mx + j, A.my + i, p === 'k' ? K : W); }));
  const hat = ch.hat;
  if (hat === 'helmet') { ctx.fillStyle = '#4a5a2a'; ctx.fillRect(5, 3, 6, 2); ctx.fillRect(4, 4, 8, 1); ctx.fillStyle = '#7a8a4a'; ctx.fillRect(6, 3, 2, 1); ctx.fillStyle = '#2a3412'; ctx.fillRect(4, 5, 8, 0); }
  if (hat === 'plume') { ctx.fillStyle = '#ff5e7a'; ctx.fillRect(9, 0, 2, 3); ctx.fillRect(10, 1, 2, 1); ctx.fillStyle = '#ffb3c2'; ctx.fillRect(9, 0, 1, 1); }
  if (hat === 'shell') { ctx.fillStyle = '#2a6a3a'; ctx.fillRect(4, 11, 8, 2); ctx.fillStyle = '#ffcc4d'; ctx.fillRect(6, 11, 1, 1); ctx.fillRect(9, 12, 1, 1); }
  if (hat === 'bow') { ctx.fillStyle = '#ffe066'; ctx.fillRect(10, 2, 3, 2); ctx.fillRect(9, 3, 1, 1); ctx.fillStyle = '#c09020'; ctx.fillRect(11, 3, 1, 1); }
  if (hat === 'cap') { ctx.fillStyle = '#ff5e5e'; ctx.fillRect(5, 3, 6, 2); ctx.fillRect(9, 4, 4, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(7, 3, 1, 1); }
  c.__friendSprite = {type: 'characterSprite', args: [id]};
  cache.set(key, c);
  return c;
}

// Draw a sprite canvas into a DOM canvas element at an integer scale.
export function spriteCanvas(sprite, scale = 4, className = '') {
  const c = document.createElement('canvas');
  c.width = sprite.width * scale; c.height = sprite.height * scale;
  c.className = 'sprite ' + className;
  c.__friendDraw = {type: 'sprite', sprite: sprite.__friendSprite, scale, className};
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, 0, 0, c.width, c.height);
  return c;
}
