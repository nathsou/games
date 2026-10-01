// Immediate-mode UI drawn entirely with the WebGL UI pass (no HTML elements).
// Every frame, scenes call ui.button()/ui.text()/... which both draw and
// hit-test, so layout code and interaction code live in one place.

export function hex(h, a = 1) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
}
export const withAlpha = (c, a) => [c[0], c[1], c[2], c[3] * a];
const lerp = (a, b, t) => a + (b - a) * t;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];

export const COL = {
  text: hex('#eaf1ff'),
  dim: hex('#9db0d8'),
  faint: hex('#6b7da8'),
  accent: hex('#5ee1ff'),
  accent2: hex('#8b7bff'),
  gold: hex('#ffd25e'),
  good: hex('#6dff9c'),
  bad: hex('#ff6b7d'),
  panel: hex('#0a1030', 0.78),
  panelEdge: hex('#7ea4ff', 0.38),
  btn: hex('#16204a', 0.82),
  btnHover: hex('#23336f', 0.92),
  white: [1, 1, 1, 1],
  clear: [0, 0, 0, 0],
  dark: hex('#050816'),
};

export const ICON = {
  retry: 1, undo: 2, menu: 3, home: 4, play: 5, ffwd: 6, field: 7, soundOn: 8, soundOff: 9,
  plus: 10, minus: 11, check: 12, star: 13, left: 14, right: 15, cross: 16, trash: 17, copy: 18,
  dice: 19, lock: 20, pencil: 21, flag: 22, pause: 23, bulb: 24, eye: 25, back: 26,
};

export class UI {
  constructor(renderer, atlas, canvas) {
    this.r = renderer;
    this.atlas = atlas;
    this.canvas = canvas;
    this.ptr = { x: -100, y: -100, down: false, pressed: false, released: false, rightPressed: false, id: null, touch: false, dx: 0, dy: 0 };
    this.keys = [];
    this.wheel = 0;
    this.blockers = [];
    this.anim = new Map();
    this.activeId = null;
    this.hoverId = null;
    this.hoverAny = false;
    this.cursor = 'default';
    this.dt = 0.016;
    this.u = 1;
    this.w = 1;
    this.h = 1;
    this.toasts = [];
    this.onClick = null;
    this.time = 0;
    this._attach();
  }

  _attach() {
    const c = this.canvas;
    const p = this.ptr;
    const setPos = (e) => {
      const rect = c.getBoundingClientRect();
      p.x = e.clientX - rect.left;
      p.y = e.clientY - rect.top;
    };
    c.addEventListener('pointerdown', (e) => {
      if (p.id !== null && e.pointerId !== p.id && p.down) return;
      setPos(e);
      p.touch = e.pointerType !== 'mouse';
      if (e.button === 2) {
        p.rightPressed = true;
        return;
      }
      p.id = e.pointerId;
      p.down = true;
      p.pressed = true;
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    });
    c.addEventListener('pointermove', (e) => {
      if (p.id !== null && e.pointerId !== p.id && p.down) return;
      setPos(e);
    });
    const up = (e) => {
      if (p.id !== null && e.pointerId !== p.id) return;
      setPos(e);
      if (p.down) p.released = true;
      p.down = false;
      p.id = null;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !p.down) {
        p.x = -100;
        p.y = -100;
      }
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      this.keys.push({ key: e.key, code: e.code });
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(e.key)) e.preventDefault();
    });
  }

  begin(dt, time) {
    this.dt = dt;
    this.time = time;
    this.w = this.r.cssW;
    this.h = this.r.cssH;
    this.u = Math.max(0.72, Math.min(Math.min(this.w, this.h) / 720, 1.8));
    this.blockers.length = 0;
    this.hoverId = null;
  }

  end() {
    // toasts
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.age += this.dt;
      if (t.age > t.life) this.toasts.splice(i, 1);
    }
    const u = this.u;
    this.toasts.forEach((t, i) => {
      const a = Math.min(1, t.age * 6, (t.life - t.age) * 4);
      const size = 17 * u;
      const w = this.atlas.measure(t.msg, size) + 40 * u;
      const x = (this.w - w) / 2;
      const y = this.h - 90 * u - i * 50 * u - (1 - a) * 12 * u;
      this.rect(x, y, w, 38 * u, { fill: withAlpha(COL.panel, a), border: 1.2, borderColor: withAlpha(COL.panelEdge, a), radius: 19 * u });
      this.text(t.msg, this.w / 2, y + 19 * u, size, withAlpha(COL.text, a), { align: 'center' });
    });
    const p = this.ptr;
    p.pressed = false;
    p.released = false;
    p.rightPressed = false;
    this.wheel = 0;
    this.keys.length = 0;
    this.canvas.style.cursor = this.hoverId !== null ? 'pointer' : this.cursor;
    this.cursor = 'default';
  }

  toast(msg) {
    this.toasts.push({ msg, age: 0, life: 2.4 });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  // ---- hit testing -------------------------------------------------------------
  hit(x, y, w, h) {
    const p = this.ptr;
    return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  }

  block(x, y, w, h) {
    this.blockers.push(x, y, w, h);
  }

  // is the pointer over any widget registered so far this frame?
  overUI() {
    const b = this.blockers;
    for (let i = 0; i < b.length; i += 4) if (this.hit(b[i], b[i + 1], b[i + 2], b[i + 3])) return true;
    return false;
  }

  _anim(id, target, speed = 14) {
    let v = this.anim.get(id) ?? 0;
    v += (target - v) * Math.min(1, speed * this.dt);
    this.anim.set(id, v);
    return v;
  }

  // ---- drawing -----------------------------------------------------------------
  rect(x, y, w, h, o = {}) {
    const r = o.radius ?? 12 * this.u;
    if (o.glow) this.glow(x + w / 2, y + h / 2, w * 1.5 + 40, h * 1.9 + 40, o.glow, 2.4);
    if (o.grad) this.r.uiPush(x, y, w, h, o.grad[0], o.grad[1], 0, r, 0, 1);
    else if (o.fill !== null) this.r.uiPush(x, y, w, h, o.fill || COL.panel, COL.clear, 0, r, 0, 0);
    if (o.border) this.r.uiPush(x, y, w, h, o.borderColor || COL.panelEdge, COL.clear, 6, r, o.border, 0);
  }

  panel(x, y, w, h, o = {}) {
    this.block(x, y, w, h);
    this.rect(x, y, w, h, { fill: COL.panel, border: 1.5, borderColor: COL.panelEdge, radius: 18 * this.u, ...o });
  }

  disc(cx, cy, d, fill, border = 0, borderColor = COL.clear) {
    this.r.uiPush(cx - d / 2, cy - d / 2, d, d, fill, borderColor, 5, 0, border, 0);
  }

  glow(cx, cy, w, h, color, power = 2) {
    this.r.uiPush(cx - w / 2, cy - h / 2, w, h, color, COL.clear, 3, power, 0, 0);
  }

  icon(id, cx, cy, size, color = COL.text) {
    this.r.uiPush(cx - size / 2, cy - size / 2, size, size, color, COL.clear, 2, id, 0, 0);
  }

  // y = vertical centre of the text line
  text(str, x, y, size, color = COL.text, o = {}) {
    const atlas = this.atlas;
    const sp = o.spacing || 0;
    const width = atlas.measure(str, size, sp);
    let px = x;
    if (o.align === 'center') px = x - width / 2;
    else if (o.align === 'right') px = x - width;
    const k = size / 80;
    const cw = atlas.cellW * k;
    const ch = atlas.cellH * k;
    const top = y - (atlas.baseline - 0.36 * 80) * k;
    const c2 = o.color2 || color;
    const drawPass = (ox, oy, c, cc2) => {
      let pen = px;
      for (let i = 0; i < str.length; i++) {
        const g = atlas.glyph(str[i]);
        if (g.icon) {
          if (ox === 0 && oy === 0) this.icon(g.icon, pen + g.adv * size * 0.5, y, size * 0.95, c);
        } else if (str[i] !== ' ') {
          this.r.uiPush(pen + g.adv * size * 0.5 - cw / 2 + ox, top + oy, cw, ch, c, cc2, 1, 0, 0, 0, g.u0, g.v0, g.u1, g.v1);
        }
        pen += g.adv * size + sp * size;
      }
    };
    if (o.shadow) drawPass(0, size * 0.06, [0, 0, 0, 0.55 * color[3]], [0, 0, 0, 0.55 * color[3]]);
    drawPass(0, 0, color, c2);
    return width;
  }

  measure(str, size, spacing = 0) {
    return this.atlas.measure(str, size, spacing);
  }

  stars(cx, cy, size, filled, total = 3, gap = 1.15) {
    const w = size * gap;
    const x0 = cx - (w * (total - 1)) / 2;
    for (let i = 0; i < total; i++) {
      this.icon(ICON.star, x0 + i * w, cy, size, i < filled ? COL.gold : hex('#3a4670', 0.9));
    }
  }

  // Button: draws and returns true on click. o: label, icon, size, kind, disabled, selected, fill
  button(id, x, y, w, h, o = {}) {
    const u = this.u;
    const disabled = !!o.disabled;
    const over = !disabled && this.hit(x, y, w, h) && (this.activeId === null || this.activeId === id);
    const p = this.ptr;
    this.block(x, y, w, h);
    if (over) this.hoverId = id;
    if (over && p.pressed) this.activeId = id;
    let clicked = false;
    if (p.released && this.activeId === id) {
      if (over) clicked = true;
      this.activeId = null;
    }
    if (!p.down && !p.released && this.activeId === id) this.activeId = null;
    const hov = this._anim(id + ':h', over ? 1 : 0, 16);
    const prs = this._anim(id + ':p', over && this.activeId === id && p.down ? 1 : 0, 30);
    const kind = o.kind || 'normal';
    const sc = 1 - 0.045 * prs;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const bw = w * sc;
    const bh = h * sc;
    const bx = cx - bw / 2;
    const by = cy - bh / 2;
    const radius = o.radius ?? Math.min(14 * u, h / 2);
    const alpha = disabled ? 0.4 : 1;
    let textCol = COL.text;
    if (kind === 'primary') {
      const a = mixc(hex('#49d9ff'), hex('#7ff0ff'), hov);
      const b = mixc(hex('#3b7bff'), hex('#5a9bff'), hov);
      this.rect(bx, by, bw, bh, { grad: [withAlpha(a, alpha), withAlpha(b, alpha)], radius, glow: withAlpha(hex('#4cc4ff'), 0.18 + 0.2 * hov) });
      textCol = hex('#04122e');
    } else if (kind === 'danger') {
      this.rect(bx, by, bw, bh, { fill: withAlpha(mixc(hex('#4a1626', 0.85), hex('#7a2038', 0.95), hov), alpha), border: 1.5, borderColor: hex('#ff6b7d', 0.6), radius });
    } else if (kind === 'ghost') {
      this.rect(bx, by, bw, bh, { fill: withAlpha(mixc(hex('#16204a', 0.0), hex('#23336f', 0.6), hov), alpha), radius });
    } else {
      const base = o.selected ? hex('#2c4aa8', 0.92) : COL.btn;
      this.rect(bx, by, bw, bh, {
        fill: withAlpha(mixc(base, COL.btnHover, hov), alpha),
        border: 1.5, borderColor: o.selected ? hex('#8fd8ff', 0.9) : withAlpha(mixc(COL.panelEdge, hex('#aad0ff', 0.8), hov), alpha), radius,
        glow: o.selected ? hex('#4c8cff', 0.18) : undefined,
      });
    }
    const size = (o.size ?? 18) * u;
    const col = withAlpha(o.color || textCol, alpha);
    if (o.icon !== undefined && o.label) {
      const iw = size * 1.15;
      const tw = this.measure(o.label, size, o.spacing || 0);
      const total = iw + 8 * u + tw;
      this.icon(o.icon, cx - total / 2 + iw / 2, cy, iw, col);
      this.text(o.label, cx - total / 2 + iw + 8 * u, cy, size, col, { spacing: o.spacing });
    } else if (o.icon !== undefined) {
      this.icon(o.icon, cx, cy, Math.min(bw, bh) * (o.iconScale ?? 0.5), col);
    } else if (o.label) {
      this.text(o.label, cx, cy, size, col, { align: 'center', spacing: o.spacing });
    }
    if (clicked && this.onClick) this.onClick(kind);
    return clicked;
  }
}
