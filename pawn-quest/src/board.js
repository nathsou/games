import {viewNodeID} from '../../shared/view-state.js';
import {boardSnapshot} from './friend-view.js';
// Canvas board: crisp pixel art at an integer scale, smooth animation,
// danger overlays, arrows, particles and pointer input (click or drag).
import { KNIGHT, typeOf, colorOf, mFrom, mTo, mFlags, F_CASTLE, F_EP, F_CAPTURE, F_PROMO, sqParse, WHITE } from './chess.js';
import { pieceSprite, pieceSilhouette, starSprite } from './sprites.js';
import { drawText } from './font.js';

export const S = 20, M = 10, ART = S * 8 + M * 2;

export const BOARD_THEMES = {
  meadow: { name: 'Meadow', light: '#ecdfb8', dark: '#7aa65d', frame: '#3a2a4f', frameHi: '#5d4680', frameLo: '#1f1630', coord: '#d8c9f2', set: 'classic', stars: 0 },
  oak: { name: 'Oak', light: '#f0d9b5', dark: '#b07f58', frame: '#4b2c1c', frameHi: '#734630', frameLo: '#26150d', coord: '#f6dfbd', set: 'classic', stars: 12 },
  dusk: { name: 'Dusk', light: '#d6cbef', dark: '#8270b8', frame: '#251b45', frameHi: '#3f3170', frameLo: '#120c26', coord: '#cfc2ff', set: 'classic', stars: 30 },
  ocean: { name: 'Lagoon', light: '#d8eef2', dark: '#4f89b0', frame: '#14304a', frameHi: '#25507a', frameLo: '#0a1828', coord: '#bfe6ff', set: 'classic', stars: 50 },
  candy: { name: 'Candy', light: '#fff0f4', dark: '#ea9ab8', frame: '#5a2448', frameHi: '#843a6a', frameLo: '#2e1024', coord: '#ffd3e6', set: 'candy', stars: 75 },
  gameboy: { name: 'Pocket', light: '#b8d070', dark: '#7a9c34', frame: '#0f380f', frameHi: '#306230', frameLo: '#071c07', coord: '#c4f0a0', set: 'gameboy', stars: 100 },
  neon: { name: 'Neon', light: '#2c3266', dark: '#1a1e44', frame: '#090b1e', frameHi: '#2a2f5a', frameLo: '#04050f', coord: '#7fe9ff', set: 'neon', grid: '#43c6e8', stars: 130 },
};

const ARROW_COLORS = { good: '#4fe08a', bad: '#ff4f6a', best: '#58b6ff', hint: '#ffd23f', info: '#c9a8ff' };
const HL_COLORS = { last: 'rgba(255,214,64,0.38)', select: 'rgba(255,255,255,0.35)', good: 'rgba(80,230,140,0.45)', bad: 'rgba(255,70,90,0.45)', hint: 'rgba(255,210,63,0.5)', info: 'rgba(150,120,255,0.45)', target: 'rgba(255,210,63,0.35)' };

// ---------------------------------------------------------------- ticker
const boards = new Set();
globalThis.__sharedCanvas = {snapshot: () => ({
  boards: [...boards].filter(b => b.canvas.isConnected && b.pos).map(boardSnapshot),
  decorations: [...document.querySelectorAll('canvas')].filter(c => c.__friendDraw).map(c => ({id: viewNodeID(c), draw: c.__friendDraw})),
})};
let frameRequest = null;
function schedule() {
  if (frameRequest === null && !document.hidden && boards.size) frameRequest = requestAnimationFrame(tick);
}
function tick(t) {
  frameRequest = null;
  if (document.hidden) return;
  let active = false;
  for (const b of boards) {
    if (!b.canvas.isConnected) { b.destroy(); continue; }
    if (b.dirty || b.isAnimating(t)) b.frame(t);
    active ||= b.dirty || b.isAnimating(t);
  }
  if (active) schedule();
}
function register(b) { boards.add(b); b.invalidate(); }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(frameRequest); frameRequest = null; }
  else for (const b of boards) b.invalidate();
});

class RenderMap extends Map {
  constructor(entries, change) { super(entries); this.change = change; }
  set(key, value) { const changed = !this.has(key) || this.get(key) !== value; super.set(key, value); if (changed) this.change?.(); return this; }
  delete(key) { const changed = super.delete(key); if (changed) this.change?.(); return changed; }
  clear() { const changed = this.size > 0; super.clear(); if (changed) this.change?.(); }
}

const tileCache = new Map();
function squareTile(theme, light) {
  const key = theme.name + light;
  if (tileCache.has(key)) return tileCache.get(key);
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d');
  const base = light ? theme.light : theme.dark;
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(0, 0, S, 1); g.fillRect(0, 0, 1, S);
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, S - 1, S, 1); g.fillRect(S - 1, 0, 1, S);
  // A few dithered specks for texture.
  let seed = light ? 7 : 13;
  for (let i = 0; i < 9; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const x = 2 + (seed % (S - 4)), y = 2 + ((seed >> 8) % (S - 4));
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';
    g.fillRect(x, y, 1, 1);
  }
  if (theme.grid) { g.fillStyle = theme.grid + '40'; g.fillRect(0, 0, S, 1); g.fillRect(0, 0, 1, S); }
  tileCache.set(key, c);
  return c;
}

let hatchTile = null;
function hatch() {
  if (hatchTile) return hatchTile;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,40,70,0.14)'; g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(255,30,60,0.6)';
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if ((x + y) % 5 === 0) g.fillRect(x, y, 1, 1);
  hatchTile = c;
  return c;
}

// Pixels of a sprite, for shatter effects.
const pixelCache = new Map();
function spritePixels(sprite) {
  if (pixelCache.has(sprite)) return pixelCache.get(sprite);
  const d = sprite.getContext('2d').getImageData(0, 0, sprite.width, sprite.height).data;
  const px = [];
  for (let y = 0; y < sprite.height; y++) for (let x = 0; x < sprite.width; x++) {
    const i = (y * sprite.width + x) * 4;
    if (d[i + 3] > 0) px.push({ x, y, c: `rgb(${d[i]},${d[i + 1]},${d[i + 2]})` });
  }
  pixelCache.set(sprite, px);
  return px;
}

const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);

export class BoardView {
  constructor(container, opts = {}) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'board-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Chess board');
    container.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.pos = null;
    this.flipped = false;
    this.themeId = opts.theme || 'meadow';
    this.setOverride = opts.set || null;
    this.coords = opts.coords !== false;
    this.interactive = false; // false | 'move' | 'tap'
    this.movable = WHITE;     // colour the user may move (or 'both')
    this.legalFor = null;     // sq -> [move]
    this.onMove = null;       // (move) => void
    this.onTap = null;        // (sq) => void
    this.onSelect = null;
    this.selected = -1;
    this.hover = -1;
    this.marks = new Map();   // sq -> kind ('star','target','x','flag','check','dot','q')
    this.arrows = [];
    this.highlights = new Map();
    this.lastMove = null;
    this.threat = null;       // Int8Array attack map shown as danger hatching
    this.hanging = [];        // squares of own pieces in danger
    this.opportunities = [];  // enemy pieces that can be won
    this.showLegal = true;
    this.hidden = new Set();
    this.anims = [];
    this.particles = [];
    this.texts = [];
    this.shakeUntil = 0; this.shakeAmp = 0;
    this.drag = null;
    this.P = 1; this.dpr = 1;
    this.time = 0;
    this.dim = 0;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.bindInput();
    this.resize();
    // Existing callers assign view properties directly. Observe those writes so
    // idle boards sleep without requiring a polling loop or fragile call-site rules.
    for (const key of ['pos', 'flipped', 'themeId', 'setOverride', 'coords', 'interactive', 'movable',
      'selected', 'hover', 'cursor', 'lastMove', 'threat', 'arrows', 'hanging', 'opportunities',
      'dim', 'showLegal', 'hoverChip', 'drag', 'legalFor', 'marks', 'highlights']) {
      const wrap = value => ['marks', 'highlights'].includes(key) ? new RenderMap(value, () => this.invalidate()) : value;
      let value = wrap(this[key]);
      Object.defineProperty(this, key, { enumerable: true, get: () => value, set: next => {
        if (next === value) return;
        value = wrap(next);
        this.invalidate();
      }});
    }
    register(this);
    globalThis.__board = this; // handy for debugging from the console
  }

  get theme() { return BOARD_THEMES[this.themeId] || BOARD_THEMES.meadow; }
  get set() { return this.setOverride || this.theme.set; }

  destroy() { this.ro.disconnect(); this.canvas.remove(); boards.delete(this); }

  resize() {
    const r = this.container.getBoundingClientRect();
    const size = Math.min(r.width, r.height || r.width);
    if (size <= 0) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const dev = Math.floor(size * this.dpr);
    this.P = Math.max(1, Math.floor(dev / ART));
    const px = this.P * ART;
    if (this.canvas.width !== px || this.canvas.height !== px) {
      this.canvas.width = px; this.canvas.height = px;
      this.invalidate();
    }
    this.canvas.style.width = px / this.dpr + 'px';
    this.canvas.style.height = px / this.dpr + 'px';
  }

  setPosition(pos) { this.pos = pos; this.selected = -1; this.invalidate(); }

  invalidate() { this.dirty = true; schedule(); }

  isAnimating(t) {
    return !!(this.anims.length || this.particles.length || this.texts.length || t < this.shakeUntil ||
      this.selected >= 0 || this.cursor >= 0 && this.interactive || this._inCheck ||
      this.hanging.length || this.opportunities.length ||
      [...this.marks.values()].some(kind => ['star', 'target', 'goal', 'q'].includes(kind)));
  }

  // Art-space top-left of a square.
  sqXY(sq) {
    const f = sq & 7, r = sq >> 4;
    return this.flipped ? { x: M + (7 - f) * S, y: M + r * S } : { x: M + f * S, y: M + (7 - r) * S };
  }

  pointToSq(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ax = (clientX - rect.left) / rect.width * ART, ay = (clientY - rect.top) / rect.height * ART;
    const f = Math.floor((ax - M) / S), rr = Math.floor((ay - M) / S);
    if (f < 0 || f > 7 || rr < 0 || rr > 7) return -1;
    return this.flipped ? rr * 16 + (7 - f) : (7 - rr) * 16 + f;
  }

  // ------------------------------------------------------------ input

  bindInput() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', e => this.pointerDown(e));
    c.addEventListener('pointermove', e => this.pointerMove(e));
    c.addEventListener('pointerup', e => this.pointerUp(e));
    c.addEventListener('pointercancel', () => { this.drag = null; });
    c.addEventListener('pointerleave', () => { this.hover = -1; });
    // Keyboard: arrows move a cursor, Enter/Space acts like a tap.
    c.tabIndex = 0;
    this.cursor = -1;
    c.addEventListener('keydown', e => {
      if (!this.interactive) return;
      const d = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
      if (d) {
        e.preventDefault();
        if (this.cursor < 0) this.cursor = this.selected >= 0 ? this.selected : 0x34;
        const sgn = this.flipped ? -1 : 1;
        const f = Math.min(7, Math.max(0, (this.cursor & 7) + d[0] * sgn)), r = Math.min(7, Math.max(0, (this.cursor >> 4) + d[1] * sgn));
        this.cursor = r * 16 + f;
      } else if ((e.key === 'Enter' || e.key === ' ') && this.cursor >= 0) {
        e.preventDefault();
        this.activate(this.cursor);
      } else if (e.key === 'Escape') this.select(-1);
    });
    c.addEventListener('blur', () => { this.cursor = -1; });
  }

  // Same as tapping a square.
  activate(sq) {
    if (!this.interactive || this.anims.length) return;
    if (this.interactive === 'tap') { this.onTap?.(sq); return; }
    if (this.selected >= 0 && sq !== this.selected) {
      const m = this.targets(this.selected).filter(m => mTo(m) === sq);
      if (m.length) { this.choose(m); return; }
    }
    if (this.canMove(sq)) this.select(sq);
    else { this.select(-1); this.onTap?.(sq); }
  }

  canMove(sq) {
    if (!this.pos || this.interactive !== 'move') return false;
    const p = this.pos.b[sq];
    if (!p) return false;
    if (this.movable !== 'both' && colorOf(p) !== this.movable) return false;
    if (this.movable === 'both' && colorOf(p) !== this.pos.turn) return false;
    return true;
  }

  targets(sq) { return this.legalFor ? this.legalFor(sq) : []; }

  pointerDown(e) {
    if (!this.interactive || this.anims.length) return;
    const sq = this.pointToSq(e.clientX, e.clientY);
    if (sq < 0) return;
    e.preventDefault();
    if (this.interactive === 'tap') { this.onTap?.(sq); return; }
    if (this.selected >= 0 && sq !== this.selected) {
      const m = this.targets(this.selected).filter(m => mTo(m) === sq);
      if (m.length) { this.choose(m); return; }
      if (!this.canMove(sq)) this.onIllegal?.(this.selected, sq);
    }
    if (this.canMove(sq)) {
      this.select(sq);
      this.drag = { sq, x: e.clientX, y: e.clientY, active: false, id: e.pointerId };
      try { this.canvas.setPointerCapture(e.pointerId); } catch {}
    } else {
      this.select(-1);
      this.onTap?.(sq);
    }
  }

  pointerMove(e) {
    const sq = this.pointToSq(e.clientX, e.clientY);
    this.hover = sq;
    if (this.drag) {
      if (!this.drag.active && Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 6) this.drag.active = true;
      this.drag.cx = e.clientX; this.drag.cy = e.clientY;
      this.invalidate();
    }
    this.canvas.style.cursor = (this.interactive === 'move' && (this.canMove(sq) || (this.selected >= 0 && this.targets(this.selected).some(m => mTo(m) === sq)))) || this.interactive === 'tap' ? 'pointer' : 'default';
  }

  pointerUp(e) {
    const d = this.drag;
    this.drag = null;
    if (!d || !d.active) return;
    const sq = this.pointToSq(e.clientX, e.clientY);
    if (sq >= 0 && sq !== d.sq) {
      const m = this.targets(d.sq).filter(m => mTo(m) === sq);
      if (m.length) { this.choose(m, true); return; }
      this.onIllegal?.(d.sq, sq);
    }
  }

  choose(moves, dropped = false) {
    this.select(-1);
    this.droppedAt = dropped;
    this.onMove?.(moves);
  }

  select(sq) {
    this.selected = sq;
    this.onSelect?.(sq);
  }

  // ------------------------------------------------------------ effects

  // Animate a move on the current position (call before pos.make).
  animateMove(m, { duration } = {}) {
    this.invalidate();
    const pos = this.pos;
    const from = mFrom(m), to = mTo(m), fl = mFlags(m);
    const p = pos.b[from];
    const movers = [{ from, to, piece: p }];
    if (fl & F_CASTLE) {
      const rFrom = to > from ? to + 1 : to - 2, rTo = to > from ? to - 1 : to + 1;
      movers.push({ from: rFrom, to: rTo, piece: pos.b[rFrom] });
    }
    const capSq = (fl & F_EP) ? to + (colorOf(p) === WHITE ? -16 : 16) : to;
    const captured = (fl & F_CAPTURE) ? pos.b[capSq] : 0;
    const dropped = this.droppedAt; this.droppedAt = false;
    const dur = duration ?? (dropped ? 70 : typeOf(p) === KNIGHT ? 300 : 230);
    return new Promise(resolve => {
      for (const mv of movers) this.hidden.add(mv.from);
      let left = movers.length;
      for (const mv of movers) {
        const a = this.sqXY(mv.from), b = this.sqXY(mv.to);
        this.anims.push({
          piece: mv.piece, ax: a.x, ay: a.y, bx: b.x, by: b.y, t0: performance.now(), dur, hop: typeOf(mv.piece) === KNIGHT ? 9 : 3,
          done: () => {
            this.hidden.delete(mv.from);
            if (--left === 0) {
              if (captured) this.shatter(capSq, captured);
              if (fl & F_PROMO) { this.burst(to, ['#ffd23f', '#ffffff', '#ffb0f0'], 26); }
              resolve();
            }
          },
        });
      }
    });
  }

  // Animate a piece sprite between two squares without a move (e.g. "capture" in lessons).
  animateSlide(from, to, piece, dur = 260) {
    this.invalidate();
    return new Promise(resolve => {
      this.hidden.add(from);
      const a = this.sqXY(from), b = this.sqXY(to);
      this.anims.push({ piece, ax: a.x, ay: a.y, bx: b.x, by: b.y, t0: performance.now(), dur, hop: typeOf(piece) === KNIGHT ? 9 : 3, done: () => { this.hidden.delete(from); resolve(); } });
    });
  }

  shatter(sq, piece) {
    const sprite = pieceSprite(typeOf(piece), colorOf(piece), this.set);
    const { x, y } = this.sqXY(sq);
    const px = spritePixels(sprite);
    for (let i = 0; i < px.length; i += 2) {
      const q = px[i];
      const dx = q.x - 8, dy = q.y - 10;
      this.particles.push({ x: x + 2 + q.x, y: y + 2 + q.y, vx: dx * 0.05 + (Math.random() - 0.5) * 0.9, vy: -1.2 - Math.random() * 1.4 + dy * 0.02, life: 0.7 + Math.random() * 0.5, age: 0, c: q.c, s: 1, g: 0.09 });
    }
    this.shake(1.4, 180);
  }

  burst(sq, colors = ['#ffd23f', '#ffffff'], n = 18) {
    this.invalidate();
    const { x, y } = this.sqXY(sq);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 0.6 + Math.random() * 1.6;
      this.particles.push({ x: x + S / 2, y: y + S / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, life: 0.5 + Math.random() * 0.5, age: 0, c: colors[i % colors.length], s: Math.random() < 0.3 ? 2 : 1, g: 0.04 });
    }
  }

  floatText(sq, text, color = '#ffd23f') {
    this.invalidate();
    const { x, y } = this.sqXY(sq);
    this.texts.push({ x: x + S / 2, y: y + 2, text, color, t0: performance.now(), dur: 1100 });
  }

  shake(amp = 2, ms = 250) { this.shakeAmp = amp; this.shakeUntil = performance.now() + ms; this.invalidate(); }

  flash(sq, color = 'good', ms = 600) {
    this.highlights.set(sq, color);
    setTimeout(() => { if (this.highlights.get(sq) === color) this.highlights.delete(sq); }, ms);
  }

  clearAnnotations() { this.arrows = []; this.highlights.clear(); this.marks.clear(); }

  // ------------------------------------------------------------ rendering

  frame(t) {
    this.dirty = false;
    this.frameDt = Math.min(0.05, Math.max(0, (t - this.time) / 1000));
    this.time = t;
    const ctx = this.ctx, P = this.P;
    if (!this.pos || !this.canvas.width) return;
    this._inCheck = (this.pos.usesChecks?.() || this.pos.rules.variant === 'standard') && this.pos.king[this.pos.turn] >= 0 && this.pos.inCheck(this.pos.turn);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
    if (t < this.shakeUntil) {
      const k = (this.shakeUntil - t) / 250;
      ctx.translate(Math.round((Math.random() - 0.5) * this.shakeAmp * P * k), Math.round((Math.random() - 0.5) * this.shakeAmp * P * k));
    }
    ctx.scale(P, P);
    const baseKey = `${this.themeId}:${this.flipped}:${this.coords}`;
    if (this.baseKey !== baseKey) {
      this.baseLayer ||= document.createElement('canvas');
      this.baseLayer.width = this.baseLayer.height = ART;
      const base = this.baseLayer.getContext('2d');
      this.drawFrame(base);
      this.drawSquares(base);
      this.baseKey = baseKey;
    }
    ctx.drawImage(this.baseLayer, 0, 0);
    this.drawOverlays(ctx, t);
    this.drawPieces(ctx, t);
    this.drawAnims(ctx, t);
    this.drawMarksTop(ctx, t);
    this.drawArrows(ctx);
    this.drawDrag(ctx);
    this.drawParticles(ctx);
    this.drawTexts(ctx, t);
    if (this.dim) { ctx.fillStyle = `rgba(10,6,24,${this.dim})`; ctx.fillRect(M, M, S * 8, S * 8); }
  }

  drawFrame(ctx) {
    const th = this.theme;
    ctx.fillStyle = th.frame; ctx.fillRect(0, 0, ART, ART);
    ctx.fillStyle = th.frameHi; ctx.fillRect(0, 0, ART, 2); ctx.fillRect(0, 0, 2, ART);
    ctx.fillStyle = th.frameLo; ctx.fillRect(0, ART - 2, ART, 2); ctx.fillRect(ART - 2, 0, 2, ART);
    ctx.fillStyle = th.frameLo; ctx.fillRect(M - 2, M - 2, S * 8 + 4, S * 8 + 4);
    ctx.fillStyle = th.frameHi; ctx.fillRect(M - 1, M + S * 8, S * 8 + 2, 1); ctx.fillRect(M + S * 8, M - 1, 1, S * 8 + 2);
    if (this.coords) {
      for (let i = 0; i < 8; i++) {
        const file = 'ABCDEFGH'[this.flipped ? 7 - i : i];
        const rank = String(this.flipped ? i + 1 : 8 - i);
        drawText(ctx, file, M + i * S + S / 2, ART - M + 2, { color: th.coord, align: 'center' });
        drawText(ctx, rank, M / 2, M + i * S + (S - 7) / 2, { color: th.coord, align: 'center' });
      }
    }
  }

  drawSquares(ctx) {
    const th = this.theme;
    const light = squareTile(th, true), dark = squareTile(th, false);
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const sq = r * 16 + f;
      const { x, y } = this.sqXY(sq);
      ctx.drawImage((r + f) & 1 ? light : dark, x, y);
    }
  }

  drawOverlays(ctx, t) {
    const pos = this.pos;
    if (this.lastMove) for (const sq of this.lastMove) { const { x, y } = this.sqXY(sq); ctx.fillStyle = HL_COLORS.last; ctx.fillRect(x, y, S, S); }
    for (const [sq, col] of this.highlights) { const { x, y } = this.sqXY(sq); ctx.fillStyle = HL_COLORS[col] || col; ctx.fillRect(x, y, S, S); }
    if (this.threat) {
      const h = hatch();
      for (let sq = 0; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        if (this.threat[sq]) { const { x, y } = this.sqXY(sq); ctx.drawImage(h, x, y); }
      }
    }
    // Check glow.
    if (pos.usesChecks?.() || pos.rules.variant === 'standard') {
      const k = pos.king[pos.turn];
      if (k >= 0 && pos.inCheck(pos.turn)) {
        const { x, y } = this.sqXY(k);
        const pulse = 0.55 + 0.25 * Math.sin(t / 120);
        const g = ctx.createRadialGradient(x + S / 2, y + S / 2, 1, x + S / 2, y + S / 2, S * 0.75);
        g.addColorStop(0, `rgba(255,40,60,${pulse})`); g.addColorStop(1, 'rgba(255,40,60,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 4, y - 4, S + 8, S + 8);
      }
    }
    if (this.selected >= 0) {
      const { x, y } = this.sqXY(this.selected);
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x, y, S, S);
      this.outline(ctx, x, y, '#ffffff');
    }
    if (this.hoverChip) {
      const { x, y } = this.sqXY(sqParse(this.hoverChip));
      ctx.fillStyle = 'rgba(94,242,196,0.35)'; ctx.fillRect(x, y, S, S);
      this.outline(ctx, x, y, '#5ef2c4');
    }
    if (this.cursor >= 0 && this.interactive) {
      const { x, y } = this.sqXY(this.cursor);
      this.corners(ctx, x, y, Math.sin(t / 150) > 0 ? '#5ef2c4' : '#ffffff', 0, 6);
    }
    if (this.hover >= 0 && this.interactive) {
      const { x, y } = this.sqXY(this.hover);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, y, S, S);
    }
    // Marks under pieces.
    for (const [sq, kind] of this.marks) {
      const { x, y } = this.sqXY(sq);
      if (kind === 'target' || kind === 'goal') {
        ctx.fillStyle = kind === 'goal' ? 'rgba(94,242,196,0.35)' : 'rgba(255,210,63,0.3)'; ctx.fillRect(x, y, S, S);
        this.corners(ctx, x, y, kind === 'goal' ? '#5ef2c4' : '#ffd23f', 1 + Math.round((Math.sin(t / 200) + 1)));
      } else if (kind === 'danger') {
        ctx.fillStyle = 'rgba(255,40,70,0.35)'; ctx.fillRect(x, y, S, S);
      } else if (kind === 'good') { ctx.fillStyle = HL_COLORS.good; ctx.fillRect(x, y, S, S); }
      else if (kind === 'bad') { ctx.fillStyle = HL_COLORS.bad; ctx.fillRect(x, y, S, S); }
      else if (kind === 'picked') { ctx.fillStyle = 'rgba(150,120,255,0.5)'; ctx.fillRect(x, y, S, S); this.outline(ctx, x, y, '#c9a8ff'); }
    }
    // Legal targets.
    if (this.selected >= 0 && this.showLegal) {
      for (const m of this.targets(this.selected)) {
        const to = mTo(m), { x, y } = this.sqXY(to);
        if (pos.b[to] || (mFlags(m) & F_EP)) this.corners(ctx, x, y, 'rgba(20,10,40,0.55)', 0, 4);
        else {
          ctx.fillStyle = 'rgba(20,10,40,0.30)';
          ctx.fillRect(x + 8, y + 7, 4, 6); ctx.fillRect(x + 7, y + 8, 6, 4);
        }
      }
    }
  }

  outline(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, S, 1); ctx.fillRect(x, y + S - 1, S, 1); ctx.fillRect(x, y, 1, S); ctx.fillRect(x + S - 1, y, 1, S);
  }

  corners(ctx, x, y, color, inset = 0, len = 5) {
    ctx.fillStyle = color;
    const a = inset, b = S - inset;
    ctx.fillRect(x + a, y + a, len, 2); ctx.fillRect(x + a, y + a, 2, len);
    ctx.fillRect(x + b - len, y + a, len, 2); ctx.fillRect(x + b - 2, y + a, 2, len);
    ctx.fillRect(x + a, y + b - 2, len, 2); ctx.fillRect(x + a, y + b - len, 2, len);
    ctx.fillRect(x + b - len, y + b - 2, len, 2); ctx.fillRect(x + b - 2, y + b - len, 2, len);
  }

  drawPiece(ctx, piece, x, y, lift = 0, glow = null) {
    const sp = pieceSprite(typeOf(piece), colorOf(piece), this.set);
    ctx.fillStyle = 'rgba(10,5,25,0.28)';
    const sw = lift > 3 ? 8 : 10;
    ctx.fillRect(x + (S - sw) / 2, y + S - 4, sw, 2);
    ctx.fillRect(x + (S - sw) / 2 + 1, y + S - 5, sw - 2, 1);
    ctx.fillRect(x + (S - sw) / 2 + 1, y + S - 2, sw - 2, 1);
    if (glow) {
      const sil = pieceSilhouette(typeOf(piece), glow);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(sil, Math.round(x + 2 + ox), Math.round(y + 1 - lift + oy));
    }
    ctx.drawImage(sp, Math.round(x + 2), Math.round(y + 1 - lift));
  }

  drawPieces(ctx, t) {
    const pos = this.pos;
    const hangSet = new Set(this.hanging), oppSet = new Set(this.opportunities);
    // Draw rank by rank from the back so overlaps look right.
    for (let row = 0; row < 8; row++) for (let f = 0; f < 8; f++) {
      const r = this.flipped ? row : 7 - row;
      const sq = r * 16 + (this.flipped ? 7 - f : f);
      const p = pos.b[sq];
      if (!p || this.hidden.has(sq)) continue;
      if (this.drag && this.drag.active && this.drag.sq === sq) continue;
      const { x, y } = this.sqXY(sq);
      let lift = 0;
      if (sq === this.selected) lift = 2 + Math.round(Math.sin(t / 160));
      let glow = null;
      if (hangSet.has(sq)) glow = Math.sin(t / 140) > -0.2 ? '#ff3355' : '#ff9aa8';
      else if (oppSet.has(sq)) glow = Math.sin(t / 160) > 0 ? '#ffd23f' : '#fff3b0';
      this.drawPiece(ctx, p, x, y, lift, glow);
      if (hangSet.has(sq)) this.badge(ctx, x + S - 6, y - 1 + Math.round(Math.sin(t / 150)), '!', '#ff3355');
    }
  }

  badge(ctx, x, y, ch, color) {
    ctx.fillStyle = '#1b1230'; ctx.fillRect(x - 1, y - 1, 7, 9);
    ctx.fillStyle = color; ctx.fillRect(x, y, 5, 7);
    drawText(ctx, ch, x + 2, y, { color: '#ffffff' });
  }

  drawAnims(ctx, t) {
    const done = [];
    for (const a of this.anims) {
      const k = Math.min(1, (t - a.t0) / a.dur);
      const e = ease(Math.max(0, k));
      const x = a.ax + (a.bx - a.ax) * e, y = a.ay + (a.by - a.ay) * e;
      const lift = Math.sin(Math.PI * e) * a.hop;
      this.drawPiece(ctx, a.piece, x, y, lift);
      if (k >= 1) done.push(a);
    }
    if (done.length) { this.anims = this.anims.filter(a => !done.includes(a)); for (const a of done) a.done(); }
  }

  drawMarksTop(ctx, t) {
    for (const [sq, kind] of this.marks) {
      const { x, y } = this.sqXY(sq);
      if (kind === 'star') {
        const bob = Math.round(Math.sin(t / 260 + sq) * 1.5);
        ctx.drawImage(starSprite(true), x + 4, y + 4 + bob);
      } else if (kind === 'x') {
        ctx.fillStyle = '#ff3355';
        for (let i = 0; i < 10; i++) { ctx.fillRect(x + 5 + i, y + 5 + i, 2, 2); ctx.fillRect(x + 14 - i, y + 5 + i, 2, 2); }
      } else if (kind === 'flag') {
        ctx.fillStyle = '#2b1d3a'; ctx.fillRect(x + 6, y + 3, 2, 14);
        ctx.fillStyle = '#5ef2c4'; ctx.fillRect(x + 8, y + 3, 7, 5); ctx.fillStyle = '#2fa898'; ctx.fillRect(x + 8, y + 7, 7, 1);
      } else if (kind === 'q') {
        this.badge(ctx, x + S / 2 - 2, y + S / 2 - 4 + Math.round(Math.sin(t / 200)), '?', '#8a6cff');
      } else if (kind === 'dot') {
        ctx.fillStyle = 'rgba(94,242,196,0.9)'; ctx.fillRect(x + 8, y + 8, 4, 4);
      } else if (kind === 'check') {
        ctx.fillStyle = '#4fe08a';
        for (let i = 0; i < 4; i++) ctx.fillRect(x + 4 + i, y + 10 + i, 2, 2);
        for (let i = 0; i < 8; i++) ctx.fillRect(x + 8 + i, y + 13 - i, 2, 2);
      }
    }
  }

  drawArrows(ctx) {
    for (const a of this.arrows) {
      const A = this.sqXY(a.from), B = this.sqXY(a.to);
      const ax = A.x + S / 2, ay = A.y + S / 2, bx = B.x + S / 2, by = B.y + S / 2;
      const col = ARROW_COLORS[a.color] || a.color || ARROW_COLORS.info;
      const ang = Math.atan2(by - ay, bx - ax), len = Math.hypot(bx - ax, by - ay);
      ctx.save();
      ctx.translate(ax, ay); ctx.rotate(ang);
      ctx.globalAlpha = 0.85;
      const shaft = len - 7;
      ctx.fillStyle = '#1b1230';
      ctx.fillRect(3, -2.5, shaft - 2, 5);
      ctx.beginPath(); ctx.moveTo(shaft - 1, -6.5); ctx.lineTo(len - 1, 0); ctx.lineTo(shaft - 1, 6.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col;
      ctx.fillRect(4, -1.5, shaft - 3, 3);
      ctx.beginPath(); ctx.moveTo(shaft, -5); ctx.lineTo(len - 2.5, 0); ctx.lineTo(shaft, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  drawDrag(ctx) {
    const d = this.drag;
    if (!d || !d.active || d.cx === undefined) return;
    const rect = this.canvas.getBoundingClientRect();
    const ax = (d.cx - rect.left) / rect.width * ART, ay = (d.cy - rect.top) / rect.height * ART;
    const p = this.pos.b[d.sq];
    if (p) this.drawPiece(ctx, p, ax - S / 2, ay - S / 2 - 4, 4);
  }

  drawParticles(ctx) {
    const dt = this.frameDt * 60;
    this.particles = this.particles.filter(p => {
      p.age += this.frameDt;
      if (p.age > p.life) return false;
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, p.s, p.s);
      return true;
    });
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx, t) {
    this.texts = this.texts.filter(tx => {
      const k = (t - tx.t0) / tx.dur;
      if (k > 1) return false;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      drawText(ctx, tx.text, tx.x, tx.y - easeOut(Math.min(1, k * 1.4)) * 12, { color: tx.color, outline: '#1b1230', align: 'center' });
      ctx.globalAlpha = 1;
      return true;
    });
  }
}

