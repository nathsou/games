// Small DOM toolkit: elements, rich text, the mentor's speech box, modals, effects.
import { owlSprite, characterSprite, starSprite, spriteCanvas, pieceSprite, CHARACTERS } from './sprites.js';
import { pixelText } from './font.js';
import { sfx } from './audio.js';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// "**bold**", "[e4]" square chips, "_italic_", "\n" line breaks.
export function rich(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\b_(.+?)_\b/g, '<i>$1</i>')
    .replace(/\[([a-h][1-8])\]/g, '<span class="sq" data-sq="$1">$1</span>')
    .replace(/\n/g, '<br>');
}

export function richEl(tag, text, cls = '') { const el = h(tag, { class: cls }); el.innerHTML = rich(text); return el; }

// Hovering a square chip highlights the square on a board.
export function linkSquares(root, board) {
  root.addEventListener('pointerover', e => {
    const s = e.target.closest?.('.sq');
    if (s && board) board.hoverChip = s.dataset.sq;
  });
  root.addEventListener('pointerout', e => { if (e.target.closest?.('.sq') && board) board.hoverChip = null; });
}

export function button(label, onClick, cls = '') {
  return h('button', { class: 'btn ' + cls, onclick: e => { sfx.click(); onClick?.(e); } }, label);
}

export function starsRow(n, of = 3, scale = 2) {
  const row = h('span', { class: 'stars-row', 'aria-label': `${n} of ${of} stars` });
  for (let i = 0; i < of; i++) row.append(spriteCanvas(starSprite(i < n), scale));
  return row;
}

export function portrait(id, scale = 4) {
  const box = h('div', { class: 'portrait' });
  box.style.setProperty('--portrait-bg', CHARACTERS[id]?.bg || '#ffcc4d');
  const c = spriteCanvas(id === 'pip' ? owlSprite() : characterSprite(id), scale);
  box.append(c);
  if (id === 'pip') {
    // Blink now and then.
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let t = null;
    const blink = () => {
      if (!c.isConnected) { clearTimeout(t); return; }
      ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(owlSprite(true), 0, 0, c.width, c.height);
      setTimeout(() => { ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(owlSprite(false), 0, 0, c.width, c.height); }, 140);
      t = setTimeout(blink, 2500 + Math.random() * 3000);
    };
    t = setTimeout(blink, 1500);
  }
  return box;
}

export function pieceIcon(type, color = 0, scale = 2) { return spriteCanvas(pieceSprite(type, color), scale, 'piece-icon'); }

// ---------------------------------------------------------------- speech box

// The mentor (or a boss) talks. Each line: string or { text, who, onShow }.
export class Speech {
  constructor(parent) {
    this.el = h('div', { class: 'speech' });
    this.face = h('div', { class: 'speech-face' });
    this.name = h('div', { class: 'speech-name' });
    this.text = h('div', { class: 'speech-text', 'aria-live': 'polite' });
    this.next = h('button', { class: 'speech-next', 'aria-label': 'Next' }, '▼');
    this.el.append(this.face, h('div', { class: 'speech-body' }, this.name, this.text), this.next);
    parent.append(this.el);
    this.who = null;
    this.el.addEventListener('click', () => this.advance());
    this.next.addEventListener('click', e => { e.stopPropagation(); this.advance(); });
    this.onKey = e => { if ((e.key === ' ' || e.key === 'Enter') && this.waiting && !e.target.closest?.('button,input,select')) { e.preventDefault(); this.advance(); } };
    document.addEventListener('keydown', this.onKey);
  }

  setWho(who) {
    if (this.who === who) return;
    this.who = who;
    this.face.replaceChildren(portrait(who, 3));
    this.name.textContent = who === 'pip' ? 'Professor Pip' : (CHAR_NAMES[who] || who);
    this.el.dataset.who = who;
  }

  // Show text immediately (no wait).
  show(text, who = 'pip', tone = '') {
    this.setWho(who);
    this.stopTyping();
    this.text.innerHTML = rich(text);
    this.el.classList.toggle('waiting', false);
    this.el.dataset.tone = tone;
    this.next.hidden = true;
  }

  // Type lines one by one; resolves when the player has read them all.
  async say(lines, who = 'pip') {
    if (!Array.isArray(lines)) lines = [lines];
    this.skipping = false;
    for (const line of lines) {
      if (this.skipping) break;
      const l = typeof line === 'string' ? { text: line } : line;
      this.setWho(l.who || who);
      this.el.dataset.tone = '';
      l.onShow?.();
      await this.type(l.text);
      if (!this.skipping) await this.waitClick();
      l.onDone?.();
    }
    this.next.hidden = true;
  }

  // Finish whatever is being said right now and stop the current say().
  skipAll() {
    this.skipping = true;
    if (this.typing) this.finishTyping();
    if (this.waiting) { this.waiting = false; this.el.classList.remove('waiting'); const r = this.resolveWait; this.resolveWait = null; r?.(); }
  }

  type(text) {
    this.stopTyping();
    const html = rich(text);
    const tmp = h('div'); tmp.innerHTML = html;
    const full = tmp.textContent;
    this.text.innerHTML = html;
    // Reveal characters by wrapping text nodes progressively.
    const nodes = [];
    const walk = n => { for (const c of [...n.childNodes]) { if (c.nodeType === 3) nodes.push(c); else walk(c); } };
    walk(this.text);
    const orig = nodes.map(n => n.textContent);
    nodes.forEach(n => n.textContent = '');
    let i = 0, total = full.length;
    this.typing = true;
    this.next.hidden = true;
    return new Promise(resolve => {
      this.finishTyping = () => { nodes.forEach((n, k) => n.textContent = orig[k]); this.typing = false; clearInterval(this.timer); resolve(); };
      this.timer = setInterval(() => {
        i += 2;
        let left = i;
        for (let k = 0; k < nodes.length; k++) { const s = orig[k]; nodes[k].textContent = s.slice(0, Math.max(0, left)); left -= s.length; }
        if (i % 6 === 0) sfx.blip();
        if (i >= total) this.finishTyping();
      }, 22);
    });
  }

  stopTyping() { if (this.typing) this.finishTyping?.(); clearInterval(this.timer); }

  waitClick() {
    this.waiting = true;
    this.next.hidden = false;
    this.el.classList.add('waiting');
    return new Promise(resolve => { this.resolveWait = resolve; });
  }

  advance() {
    if (this.typing) { this.finishTyping(); return; }
    if (this.waiting) { this.waiting = false; this.el.classList.remove('waiting'); const r = this.resolveWait; this.resolveWait = null; sfx.click(); r?.(); }
  }

  destroy() { document.removeEventListener('keydown', this.onKey); this.stopTyping(); }
}

export const CHAR_NAMES = { pip: 'Professor Pip', gus: 'Grabby Gus', prance: 'Sir Prance', stomp: 'Sergeant Stomp', rollo: 'King Rollo', hangs: 'Sir Hangs-a-Lot', tess: 'Turtle Tess', fiona: 'Fiona Forks', iron: 'The Iron Queen', rookie: 'Rookie Ray' };

// ---------------------------------------------------------------- modal

export function modal({ title, body, buttons = [{ label: 'OK', value: true }], className = '', dismissable = true }) {
  return new Promise(resolve => {
    const close = v => { overlay.classList.add('closing'); setTimeout(() => overlay.remove(), 160); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape' && dismissable) close(null); };
    const box = h('div', { class: 'modal ' + className, role: 'dialog', 'aria-modal': 'true' });
    if (title) box.append(typeof title === 'string' ? h('h2', {}, title) : title);
    if (body) box.append(typeof body === 'string' ? richEl('div', body, 'modal-body') : body);
    const row = h('div', { class: 'modal-buttons' });
    for (const b of buttons) row.append(button(b.label, () => close(b.value), b.cls || ''));
    box.append(row);
    const overlay = h('div', { class: 'overlay', onclick: e => { if (e.target === overlay && dismissable) close(null); } }, box);
    document.body.append(overlay);
    document.addEventListener('keydown', onKey);
    setTimeout(() => row.querySelector('button')?.focus(), 30);
  });
}

export function toast(text, tone = '') {
  const root = document.getElementById('toasts') || document.body.appendChild(h('div', { id: 'toasts' }));
  const t = h('div', { class: 'toast ' + tone }); t.innerHTML = rich(text);
  root.append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}

// Big pixel banner across the screen ("CHECKMATE!").
export function banner(text, { color = '#ffd23f', shadow = '#8a3a12', sub = '', ms = 1500 } = {}) {
  const el = h('div', { class: 'banner' }, pixelText(text, { scale: Math.min(8, Math.max(4, Math.floor(window.innerWidth / (text.length * 9)))), color, shadow }));
  if (sub) el.append(h('div', { class: 'banner-sub' }, sub));
  document.body.append(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

export function confetti(n = 120) {
  const c = h('canvas', { class: 'confetti' });
  document.body.append(c);
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const g = c.getContext('2d');
  const cols = ['#ffd23f', '#ff5e7a', '#5ef2c4', '#7fb4ff', '#c9a8ff', '#ffffff'];
  const ps = Array.from({ length: n }, () => ({ x: Math.random() * c.width, y: -Math.random() * c.height * 0.5, vx: (Math.random() - 0.5) * 3 * dpr, vy: (2 + Math.random() * 3) * dpr, s: (4 + Math.random() * 5) * dpr, c: cols[Math.floor(Math.random() * cols.length)], w: Math.random() * 6 }));
  const t0 = performance.now();
  const step = t => {
    g.clearRect(0, 0, c.width, c.height);
    for (const p of ps) { p.x += p.vx + Math.sin((t / 300) + p.w) * dpr; p.y += p.vy; g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s * (0.5 + 0.5 * Math.abs(Math.sin(t / 200 + p.w)))); }
    if (t - t0 < 3200) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}

export function clear(el) { el.replaceChildren(); return el; }

// Pieces each side has captured since `start`, with the point difference.
export function materialStrip(start, pos, me) {
  const count = p => { const c = [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]]; for (const sq of p.pieces()) { const x = p.b[sq]; c[x >> 3][x & 7]++; } return c; };
  const a = count(start), b = count(pos);
  const vals = [0, 1, 3, 3, 5, 9, 0];
  const row = (victimColor, label) => {
    const el = h('div', { class: 'mat-row' }, h('span', { class: 'mat-label' }, label));
    let pts = 0;
    for (const t of [5, 4, 3, 2, 1]) {
      const lost = Math.max(0, a[victimColor][t] - b[victimColor][t]);
      for (let i = 0; i < lost; i++) el.append(pieceIcon(t, victimColor, 1));
      pts += lost * vals[t];
    }
    return { el, pts };
  };
  const mine = row(me ^ 1, 'You took'), theirs = row(me, 'They took');
  const diff = mine.pts - theirs.pts;
  // Promotions add material without captures; fall back to plain counting for the score.
  const score = c => { let s = 0; for (const sq of pos.pieces(c)) s += vals[pos.b[sq] & 7]; return s; };
  const lead = score(me) - score(me ^ 1);
  const wrap = h('div', { class: 'mat-strip' }, mine.el, theirs.el,
    h('div', { class: 'mat-score ' + (lead > 0 ? 'up' : lead < 0 ? 'down' : '') }, lead === 0 ? 'Material: even' : lead > 0 ? `You're ahead by ${lead}` : `You're behind by ${-lead}`));
  void diff;
  return wrap;
}
