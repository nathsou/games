// The quest map: eight biomes stacked like the ranks of a board. You climb from rank 1.
import { WORLDS, LEVELS } from './curriculum.js';
import { save, totalStars } from './save.js';
import { h, button, starsRow, modal, toast, richEl } from './ui.js';
import { pixelText } from './font.js';
import { pieceSprite, characterSprite, spriteCanvas, starSprite } from './sprites.js';
import { LETTERS, WHITE } from './chess.js';
import { playMusic, sfx } from './audio.js';

const PX = 4;
const ROW = 108, TOP = 150, BOTTOM = 70;

const BIOMES = {
  meadow: { base: ['#5fae4e', '#6cbd58', '#57a447'], path: '#ead9a4', edge: '#b0905a' },
  forest: { base: ['#2f7a45', '#3a8a50', '#28703e'], path: '#c9a46a', edge: '#7a5a30' },
  plains: { base: ['#dcb24c', '#e8c25c', '#d0a442'], path: '#a87c48', edge: '#6e4c28' },
  castle: { base: ['#7f86a8', '#8a91b4', '#747a9a'], path: '#e0d8c8', edge: '#8e8672' },
  garden: { base: ['#6cc06a', '#7acc74', '#5fb25f'], path: '#f4e6c8', edge: '#c0a880' },
  coast: { base: ['#f0dca0', '#f6e6b4', '#e6d090'], path: '#fff6dc', edge: '#c8b078' },
  tower: { base: ['#4a3a7a', '#56468c', '#3f316c'], path: '#a898d8', edge: '#5e4e90' },
  summit: { base: ['#e2eaf8', '#eef3ff', '#d2ddf0'], path: '#ffffff', edge: '#9aaacc' },
};

export function isUnlocked(level) {
  const i = LEVELS.indexOf(level);
  return i === 0 || !!save.levels[LEVELS[i - 1].uid];
}
export function currentLevel() { return LEVELS.find(l => !save.levels[l.uid] && isUnlocked(l)) || LEVELS[LEVELS.length - 1]; }
const worldUnlocked = w => isUnlocked(w.levels[0]);

function nodeLayout(n) {
  const height = TOP + (n - 1) * ROW + BOTTOM + 60;
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ x: 0.5 + 0.27 * Math.sin(i * 1.3 + 0.4), y: height - BOTTOM - i * ROW });
  return { height, pts };
}

function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

function drawBiome(canvas, cssW, height, world, pts) {
  const b = BIOMES[world.biome];
  const w = Math.ceil(cssW / PX), hh = Math.ceil(height / PX);
  canvas.width = w; canvas.height = hh;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, hh);
  const rgb = b.base.map(c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
  const seed = world.rank * 101;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const n = hash(x >> 2, y >> 2, seed) * 0.6 + hash(x, y, seed + 1) * 0.4;
    const c = rgb[n < 0.33 ? 0 : n < 0.8 ? 1 : 2];
    const i = (y * w + x) * 4;
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // Path through the nodes.
  const P = pts.map(p => ({ x: p.x * w, y: p.y / PX }));
  const samples = [];
  const ext = [{ x: P[0].x, y: hh + 4 }, ...P, { x: P[P.length - 1].x, y: -4 }];
  for (let i = 0; i < ext.length - 1; i++) {
    const p0 = ext[Math.max(0, i - 1)], p1 = ext[i], p2 = ext[i + 1], p3 = ext[Math.min(ext.length - 1, i + 2)];
    for (let t = 0; t < 1; t += 0.02) {
      const t2 = t * t, t3 = t2 * t;
      samples.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  const nearPath = (x, y, d) => samples.some(s => Math.abs(s.x - x) < d && Math.abs(s.y - y) < d);
  // Decorations.
  const rnd = (() => { let s = seed + 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const R = (x, y, ww, hh2, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), ww, hh2); };
  const deco = {
    meadow(x, y) {
      if (rnd() < 0.25) { R(x - 3, y - 6, 7, 5, '#3f8a3a'); R(x - 2, y - 7, 5, 1, '#3f8a3a'); R(x - 2, y - 6, 2, 2, '#7ad06a'); R(x, y - 1, 1, 3, '#6b4a2a'); }
      else { const c = ['#ffd23f', '#ff8ab8', '#ffffff', '#c9a8ff'][Math.floor(rnd() * 4)]; R(x, y, 1, 1, c); R(x - 1, y, 1, 1, c); R(x + 1, y, 1, 1, c); R(x, y - 1, 1, 1, c); R(x, y + 1, 1, 1, c); R(x, y, 1, 1, '#ffef9a'); }
    },
    forest(x, y) {
      R(x, y - 1, 1, 3, '#4a2e18');
      for (let k = 0; k < 4; k++) { const ww = 2 + k * 2; R(x - k, y - 10 + k * 2, ww - 1, 2, k % 2 ? '#1c5a30' : '#237038'); }
      R(x - 1, y - 9, 1, 1, '#5ab070');
    },
    plains(x, y) {
      if (rnd() < 0.15) { R(x - 4, y, 9, 1, '#8a5a30'); R(x - 4, y - 2, 1, 4, '#6e4424'); R(x + 4, y - 2, 1, 4, '#6e4424'); R(x - 4, y - 2, 9, 1, '#8a5a30'); }
      else for (let k = 0; k < 3; k++) { R(x + k * 2, y - 3, 1, 3, '#f8e08a'); R(x + k * 2, y - 4, 1, 1, '#fff2b0'); }
    },
    castle(x, y) {
      if (rnd() < 0.3) { R(x - 4, y - 10, 9, 10, '#5c627e'); R(x - 4, y - 12, 2, 2, '#5c627e'); R(x, y - 12, 2, 2, '#5c627e'); R(x + 3, y - 12, 2, 2, '#5c627e'); R(x - 1, y - 6, 3, 6, '#2a2e44'); R(x - 3, y - 10, 1, 9, '#7a80a0'); }
      else { R(x - 3, y, 6, 2, '#666c8c'); R(x - 3, y, 6, 1, '#9aa0c0'); }
    },
    garden(x, y) {
      if (rnd() < 0.3) { R(x - 4, y - 4, 9, 5, '#3f8a4a'); R(x - 4, y - 4, 9, 1, '#5aa864'); R(x - 2, y - 3, 1, 1, '#ff8ab8'); R(x + 2, y - 2, 1, 1, '#ff5e7a'); }
      else { R(x, y, 2, 2, '#ff8ab8'); R(x, y, 1, 1, '#ffd0e4'); R(x, y + 2, 1, 2, '#3f8a4a'); }
    },
    coast(x, y) {
      if (rnd() < 0.2) { R(x, y - 8, 1, 9, '#8a5a30'); R(x - 4, y - 9, 4, 1, '#3fa060'); R(x + 1, y - 9, 4, 1, '#3fa060'); R(x - 3, y - 10, 7, 1, '#4fc070'); }
      else { R(x - 1, y, 3, 1, '#e8c890'); R(x, y - 1, 1, 1, '#ffffff'); }
    },
    tower(x, y) {
      const c = rnd() < 0.5 ? ['#c9a8ff', '#8f6ae0', '#ffffff'] : ['#7fe9ff', '#3aa0c8', '#ffffff'];
      R(x, y - 6, 2, 6, c[1]); R(x - 1, y - 4, 1, 4, c[0]); R(x + 2, y - 3, 1, 3, c[0]); R(x, y - 7, 1, 1, c[2]); R(x, y - 5, 1, 2, c[0]);
    },
    summit(x, y) {
      if (rnd() < 0.35) { for (let k = 0; k < 7; k++) R(x - k, y - 7 + k, 1 + 2 * k, 1, k < 3 ? '#ffffff' : '#8a94b0'); R(x - 2, y - 4, 1, 1, '#ffffff'); }
      else { R(x, y, 1, 1, '#ffd23f'); }
    },
  }[world.biome];
  if (world.biome === 'coast') {
    // The sea along one side, with waves.
    for (let y = 0; y < hh; y++) { const edge = Math.round(w * 0.16 + Math.sin(y / 9) * 3); R(0, y, edge, 1, '#3aa0d8'); R(edge, y, 2, 1, '#bfeaff'); if (y % 7 === 0) R(4 + (y * 13) % Math.max(1, edge - 8), y, 4, 1, '#8fd8ff'); }
  }
  for (let i = 0; i < w * hh / 80; i++) {
    const x = Math.floor(rnd() * w), y = Math.floor(rnd() * hh);
    if (y < 34) continue; // banner area
    if (nearPath(x, y, 9)) continue;
    if (world.biome === 'coast' && x < w * 0.22) continue;
    deco(x, y);
  }
  for (const s of samples) { ctx.fillStyle = b.edge; ctx.fillRect(Math.round(s.x) - 4, Math.round(s.y) - 3, 8, 7); }
  for (const s of samples) { ctx.fillStyle = b.path; ctx.fillRect(Math.round(s.x) - 3, Math.round(s.y) - 2, 6, 5); }
  for (let i = 0; i < samples.length; i += 9) { ctx.fillStyle = b.edge; ctx.fillRect(Math.round(samples[i].x) + (i % 3) - 1, Math.round(samples[i].y), 1, 1); }
  // Banner plaque.
  ctx.fillStyle = 'rgba(10,6,24,0.0)';
}

const GLYPHS = { x: '✕', '!': '!', '+': '+', '#': '#', '=': '=', '$': '$', '?': '?', '♦': '♦', board: '▦' };

function nodeIcon(level) {
  if (level.icon === 'boss') return spriteCanvas(characterSprite(level.character), 4, 'node-sprite');
  const t = LETTERS.indexOf(level.icon);
  if (level.icon && level.icon.length === 1 && t > 0) return spriteCanvas(pieceSprite(t, WHITE), 3, 'node-sprite');
  return h('span', { class: 'node-glyph' }, GLYPHS[level.icon] || '★');
}

const KIND_LABEL = { collect: 'Movement challenge', quiz: 'Quiz', puzzle: 'Puzzles', battle: 'Battle' };

export function mapScreen(app, nav, focusWorld, celebrate) {
  playMusic('map');
  const stars = h('span', { class: 'star-count' }, spriteCanvas(starSprite(true), 2), String(totalStars()));
  const lbl = t => h('span', { class: 'lbl' }, t);
  const codexBtn = button(['📖', lbl(' Codex')], () => nav.codex(), 'small ghost' + (save.newCodex.length ? ' badge-dot' : ''));
  codexBtn.setAttribute('aria-label', 'Codex');
  const header = h('header', { class: 'hud' },
    button(['◀', lbl(' Title')], () => nav.title(), 'small ghost back'),
    h('div', { class: 'hud-title' }, h('span', { class: 'hud-sub' }, 'The quest'), h('span', { class: 'hud-main' }, 'Climb the 8 ranks')),
    h('div', { class: 'hud-right' }, stars, codexBtn, button(['♞', lbl(' Practice')], () => nav.practice(), 'small ghost'), button(['♟', lbl(' Arena')], () => nav.arena(), 'small ghost')),
  );
  const scroll = h('div', { class: 'map-scroll' });
  const root = h('div', { class: 'screen map-screen' }, header, scroll);
  app.replaceChildren(root);
  const cur = currentLevel();
  const sections = [];
  for (const world of [...WORLDS].reverse()) {
    const { height, pts } = nodeLayout(world.levels.length);
    const canvas = h('canvas', { class: 'map-canvas', 'aria-hidden': 'true' });
    const sec = h('section', { class: 'map-world', style: { height: height + 'px' }, 'aria-label': `Rank ${world.rank}: ${world.name}` }, canvas);
    const ws = world.levels.reduce((s, l) => s + (save.levels[l.uid]?.stars || 0), 0);
    sec.append(h('div', { class: 'world-banner' },
      pixelText(`RANK ${world.rank}: ${world.name}`, { scale: 3, color: '#ffffff', shadow: '#000000', outline: '#1b1230' }),
      h('span', { class: 'blurb' }, `${world.blurb}  ·  ★ ${ws}/${world.levels.length * 3}`)));
    world.levels.forEach((l, i) => {
      const unlocked = isUnlocked(l);
      const res = save.levels[l.uid];
      const node = h('button', {
        class: `node ${l.boss ? 'boss' : ''} ${unlocked ? '' : 'locked'} ${res ? 'done' : ''} ${l === cur ? 'current' : ''}`,
        style: { left: pts[i].x * 100 + '%', top: pts[i].y + 'px', '--node': world.color },
        'aria-label': `${l.title}${res ? `, ${res.stars} stars` : unlocked ? '' : ', locked'}`,
        onclick: () => openLevel(l, nav),
      }, h('span', { class: 'node-badge' }, unlocked ? nodeIcon(l) : h('span', { class: 'node-glyph' }, '🔒')), h('span', { class: 'node-label' }, l.title), res ? starsRow(res.stars, 3, 1) : null);
      sec.append(node);
      if (l === cur) {
        const at = (k, lv) => ({ left: pts[k].x * 100 + '%', top: (pts[k].y - (lv.boss ? 48 : 38)) + 'px' });
        const justCleared = save.justCleared && world.levels[i - 1]?.uid === save.justCleared;
        const av = h('div', { class: 'avatar', style: justCleared ? at(i - 1, world.levels[i - 1]) : at(i, l) }, spriteCanvas(pieceSprite(1, WHITE), 4));
        sec.append(av);
        if (justCleared) {
          node.classList.add('fresh');
          setTimeout(() => { Object.assign(av.style, at(i, l)); sfx.unlock(); }, 500);
        }
      }
    });
    if (!worldUnlocked(world)) sec.append(h('div', { class: 'world-lock' }, h('span', {}, `🔒 Beat the boss of Rank ${world.rank - 1} to climb here`)));
    scroll.append(sec);
    sections.push({ sec, canvas, world, height, pts });
  }
  if (save.justCleared) { save.justCleared = null; }
  const paint = () => { const cw = scroll.clientWidth; for (const s of sections) drawBiome(s.canvas, cw, s.height, s.world, s.pts); };
  const ro = new ResizeObserver(paint); ro.observe(scroll);
  paint();
  // Scroll to the current node (or the requested world).
  requestAnimationFrame(() => {
    scroll.style.scrollBehavior = 'auto';
    const target = focusWorld ? sections.find(s => s.world.id === focusWorld) : sections.find(s => s.world === cur.world);
    if (target) {
      const idx = focusWorld && focusWorld !== cur.world.id ? 0 : target.world.levels.indexOf(cur);
      const y = target.sec.offsetTop + target.pts[Math.max(0, idx)].y - scroll.clientHeight * 0.6;
      scroll.scrollTop = Math.max(0, y);
    }
    scroll.style.scrollBehavior = '';
    if (celebrate) { sfx.unlock(); toast(`New rank unlocked: **${cur.world.name}**!`); }
  });
  return () => ro.disconnect();
}

async function openLevel(l, nav) {
  if (!isUnlocked(l)) { sfx.illegal(); toast('Finish the previous level first!'); return; }
  sfx.click();
  const res = save.levels[l.uid];
  const body = h('div', { class: 'level-card' },
    h('div', { class: 'kind' }, (l.boss ? 'Boss battle' : KIND_LABEL[l.kind]) + ` · Rank ${l.world.rank}`),
    h('h2', {}, l.title),
    h('div', {}, nodeIcon(l)),
    l.goal ? richEl('p', l.goal) : null,
    h('div', {}, starsRow(res?.stars || 0, 3, 3)),
  );
  const v = await modal({ body, buttons: [{ label: 'Close', value: null, cls: 'ghost' }, { label: res ? 'Play again' : 'Play ▶', value: 'play', cls: 'gold' }] });
  if (v === 'play') nav.level(l.uid);
}
