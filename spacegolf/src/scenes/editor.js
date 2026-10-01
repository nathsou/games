// Level editor: build a hole on the canvas, test it, save it and share a link.

import { createWorld, ensureBodies, CAPTURE_R, PORTAL_R, STAR_R, BALL_R } from '../physics.js';
import { T, LOOK_ID } from '../renderer.js';
import { COL, ICON, hex, withAlpha } from '../ui.js';
import { drawLevel } from '../worldview.js';
import { LOOKS, cloneLevel, emptyLevel, validateLevel, encodeLevel, paletteFor } from '../level.js';
import { addBody, removeBody, snapTee, snapHole, clampToBounds, setOrbit, randomName } from '../leveledit.js';
import { GameScene } from './game.js';

const TOOLS = [
  { id: 'move', label: 'Select' },
  { id: 'planet', label: 'Planet', color: [0.25, 0.55, 0.95] },
  { id: 'repulsor', label: 'Bumper', color: [0.2, 0.9, 1] },
  { id: 'blackhole', label: 'Black hole', color: [0.6, 0.3, 0.95] },
  { id: 'sun', label: 'Sun', color: [1, 0.8, 0.25] },
  { id: 'portal', label: 'Wormhole', color: [0.7, 0.55, 1] },
  { id: 'wind', label: 'Wind', color: [0.5, 0.8, 1] },
  { id: 'star', label: 'Pickup', icon: ICON.star },
  { id: 'tee', label: 'Tee', color: [1, 1, 1] },
  { id: 'hole', label: 'Hole', color: [0.05, 0.05, 0.1], ring: [1, 0.88, 0.4] },
  { id: 'erase', label: 'Erase', icon: ICON.trash },
];

export class EditorScene {
  constructor(app, entry = null) {
    this.app = app;
    this.id = entry ? entry.id : null;
    this.level = entry ? cloneLevel(entry.level) : emptyLevel(randomName());
    this.level.bounds = this.level.bounds || { w: 1600, h: 900 };
    this.level.portals = this.level.portals || [];
    this.level.winds = this.level.winds || [];
    this.level.stars = this.level.stars || [];
    this.parAuto = !entry;
    this.verified = !!(entry && entry.verified);
    this.tool = 'move';
    this.sel = null; // { kind, index, end }
    this.drag = null;
    this.pending = null; // first end of a wormhole being placed
    this.dirty = false;
    this.saved = !!entry;
    this.t = 0;
    this.pal = { c1: [0.12, 0.16, 0.5], c2: [0.3, 0.1, 0.45], seed: 4 };
  }

  touch() {
    this.dirty = true;
    this.verified = false;
  }

  frame(dt) {
    const app = this.app;
    const ui = app.ui;
    const r = app.r;
    const u = ui.u;
    this.t += dt;
    const topH = 66 * u;
    const toolH = 74 * u;
    const inspW = ui.w > 900 * u ? 232 * u : 0;
    const region = { x: 10 * u, y: topH + 2 * u, w: ui.w - 20 * u - inspW, h: ui.h - topH - toolH - 10 * u };
    r.fitCamera(this.level.bounds.w, this.level.bounds.h, region, null);

    this.drawTopBar(topH);
    this.drawTools(toolH);
    this.drawInspector(topH, inspW);
    this.handleInput();
    this.render(dt);
  }

  // ---- UI ---------------------------------------------------------------------------------
  drawTopBar(topH) {
    const app = this.app;
    const ui = app.ui;
    const u = ui.u;
    const bh = 46 * u;
    const y = 10 * u;
    if (ui.button('ed-back', 12 * u, y, bh, bh, { icon: ICON.left, iconScale: 0.5 })) this.exit();
    const name = this.level.name || 'Untitled';
    ui.text(name, 12 * u + bh + 14 * u, y + bh * 0.38, 19 * u, COL.text, { shadow: true });
    const status = this.verified ? 'Tested  ·  par ' + this.level.par : this.dirty ? 'Unsaved changes' : 'Level editor';
    ui.text(status, 12 * u + bh + 14 * u, y + bh * 0.8, 12 * u, this.verified ? COL.good : COL.dim);
    const nameW = Math.max(ui.measure(name, 19 * u), ui.measure(status, 12 * u));
    if (ui.button('ed-dice', 12 * u + bh + 22 * u + nameW, y + 4 * u, bh - 8 * u, bh - 8 * u, { icon: ICON.dice, iconScale: 0.55, kind: 'ghost' })) {
      this.level.name = randomName();
      this.touch();
      this.verified = false;
    }
    // right-hand actions
    let x = ui.w - 12 * u;
    const acts = [
      ['ed-clear', ICON.cross, 'Clear', () => this.clearAll(), 'danger'],
      ['ed-share', ICON.copy, 'Share', () => this.share(), 'normal'],
      ['ed-save', ICON.check, 'Save', () => this.save(), 'normal'],
      ['ed-test', ICON.play, 'Test', () => this.test(), 'primary'],
    ];
    const compact = ui.w < 760 * u;
    for (const [id, icon, label, fn, kind] of acts) {
      const w = compact ? bh : Math.max(86 * u, ui.measure(label, 15 * u) + 54 * u);
      x -= w;
      if (ui.button(id, x, y, w, bh, { icon, label: compact ? undefined : label, size: 15, kind, iconScale: 0.5 })) fn();
      x -= 8 * u;
    }
  }

  drawTools(toolH) {
    const app = this.app;
    const ui = app.ui;
    const u = ui.u;
    const n = TOOLS.length;
    const gap = 6 * u;
    const tw = Math.min(88 * u, (ui.w - 20 * u - gap * (n - 1)) / n);
    const total = tw * n + gap * (n - 1);
    let x = (ui.w - total) / 2;
    const y = ui.h - toolH + 4 * u;
    const h = toolH - 12 * u;
    ui.block(x - 6 * u, y - 4 * u, total + 12 * u, h + 8 * u);
    for (const t of TOOLS) {
      const sel = this.tool === t.id;
      if (ui.button('tool-' + t.id, x, y, tw, h, { selected: sel })) {
        this.tool = t.id;
        this.pending = null;
        if (t.id !== 'move') this.sel = null;
        if (t.id === 'star' && this.level.stars.length >= 3) ui.toast('At most 3 pickups per level');
      }
      const cy = y + h * 0.38;
      if (t.icon) ui.icon(t.icon, x + tw / 2, cy, 24 * u, t.id === 'star' ? COL.gold : COL.text);
      else if (t.ring) ui.disc(x + tw / 2, cy, 22 * u, [0.02, 0.02, 0.06, 1], 2.5, [...t.ring, 1]);
      else if (t.color) ui.sphere(x + tw / 2, cy, 24 * u, [...t.color, 1], t.id === 'sun' || t.id === 'repulsor' || t.id === 'blackhole' ? 1 : 0);
      else {
        // pointer glyph for "select"
        ui.icon(ICON.right, x + tw / 2 - 2 * u, cy, 26 * u, COL.text);
      }
      ui.text(t.label, x + tw / 2, y + h * 0.8, Math.min(11.5 * u, (tw - 4 * u) / (t.label.length * 0.62)), sel ? COL.text : COL.dim, { align: 'center' });
      x += tw + gap;
    }
  }

  stepper(id, label, valueText, x, y, w, onMinus, onPlus) {
    const ui = this.app.ui;
    const u = ui.u;
    ui.text(label, x, y + 8 * u, 12 * u, COL.dim);
    const bh = 32 * u;
    const by = y + 18 * u;
    if (ui.button(id + '-', x, by, bh, bh, { icon: ICON.minus, iconScale: 0.5 })) onMinus();
    if (ui.button(id + '+', x + w - bh, by, bh, bh, { icon: ICON.plus, iconScale: 0.5 })) onPlus();
    ui.text(valueText, x + w / 2, by + bh / 2, 15 * u, COL.text, { align: 'center' });
    return y + 58 * u;
  }

  drawInspector(topH, inspW) {
    const app = this.app;
    const ui = app.ui;
    const u = ui.u;
    const L = this.level;
    // narrow screens: only show the inspector when something is selected
    if (!inspW && !this.sel) return;
    const pw = 220 * u;
    const px = ui.w - pw - 10 * u;
    const py = topH + 6 * u;
    const sel = this.sel;
    let body = null;
    if (sel && sel.kind === 'body') body = L.bodies[sel.index];
    const ph = body ? (body.type === 'planet' ? 468 : 330) * u : sel ? 150 * u : 218 * u;
    ui.panel(px, py, pw, Math.min(ph, ui.h - py - 90 * u));
    const x = px + 16 * u;
    const w = pw - 32 * u;
    let y = py + 12 * u;

    if (body) {
      const i = sel.index;
      const names = { planet: 'Planet', repulsor: 'Bumper', blackhole: 'Black hole', sun: 'Sun' };
      ui.text(names[body.type], x, y + 10 * u, 17 * u, COL.text);
      y += 26 * u;
      y = this.stepper('sz', 'Size', String(body.r), x, y, w, () => { body.r = Math.max(8, body.r - 4); this.touch(); }, () => { body.r = Math.min(140, body.r + 4); this.touch(); });
      const gMin = body.type === 'blackhole' ? 1500 : 40;
      const gMax = body.type === 'blackhole' ? 9000 : 600;
      const gShow = body.type === 'blackhole' ? Math.round(body.g / 100) : Math.round(body.g);
      y = this.stepper('gr', body.type === 'repulsor' ? 'Push' : 'Gravity', String(gShow), x, y, w, () => { body.g = Math.max(gMin, Math.round(body.g * 0.9)); this.touch(); }, () => { body.g = Math.min(gMax, Math.round(body.g * 1.1)); this.touch(); });
      if (body.type === 'planet') {
        const li = Math.max(0, LOOKS.indexOf(body.look));
        y = this.stepper('lk', 'Look', body.look, x, y, w, () => { body.look = LOOKS[(li + LOOKS.length - 1) % LOOKS.length]; this.touch(); }, () => { body.look = LOOKS[(li + 1) % LOOKS.length]; this.touch(); });
        if (ui.button('atmo', x, y, w, 34 * u, { label: body.atmo ? 'Atmosphere: on' : 'Atmosphere: off', size: 13, selected: !!body.atmo })) {
          body.atmo = body.atmo ? 0 : Math.max(26, Math.round(body.r * 0.5));
          body.drag = 1.2;
          this.touch();
        }
        y += 44 * u;
      }
      if (ui.button('orbit', x, y, w, 34 * u, { label: body.orbit ? 'Orbit: on' : 'Orbit: off', size: 13, selected: !!body.orbit })) {
        setOrbit(L, i, !body.orbit);
        this.touch();
      }
      y += 44 * u;
      if (body.orbit) {
        const per = Math.abs(body.orbit.period);
        const dir = Math.sign(body.orbit.period) || 1;
        y = this.stepper('per', body.orbit.around !== undefined ? 'Period (s)' : 'Orbit time (s)', String(Math.round(per)), x, y, w,
          () => { body.orbit.period = dir * Math.max(6, per - 2); this.touch(); },
          () => { body.orbit.period = dir * Math.min(120, per + 2); this.touch(); });
        if (ui.button('rev', x, y - 6 * u, w, 30 * u, { label: 'Reverse direction', size: 12 })) {
          body.orbit.period *= -1;
          this.touch();
        }
        y += 34 * u;
      }
      if (ui.button('del', x, py + ph - 52 * u, w, 38 * u, { icon: ICON.trash, label: 'Delete', kind: 'danger', size: 14 })) {
        removeBody(L, i);
        this.sel = null;
        this.touch();
      }
    } else if (sel && sel.kind === 'wind') {
      const z = L.winds[sel.index];
      ui.text('Wind zone', x, y + 10 * u, 17 * u, COL.text);
      y += 26 * u;
      const mag = Math.hypot(z.ax, z.ay);
      const ang = Math.atan2(z.ay, z.ax);
      y = this.stepper('wr', 'Radius', String(z.r), x, y, w, () => { z.r = Math.max(50, z.r - 10); this.touch(); }, () => { z.r = Math.min(300, z.r + 10); this.touch(); });
      const setWind = (m, a) => { z.ax = Math.round(Math.cos(a) * m); z.ay = Math.round(Math.sin(a) * m); this.touch(); };
      y = this.stepper('wm', 'Strength', String(Math.round(mag)), x, y, w, () => setWind(Math.max(20, mag - 10), ang), () => setWind(Math.min(300, mag + 10), ang));
      this.stepper('wa', 'Direction', `${Math.round(((ang * 180) / Math.PI + 360) % 360)}°`, x, y, w, () => setWind(mag, ang - Math.PI / 12), () => setWind(mag, ang + Math.PI / 12));
    } else if (sel) {
      const names = { portal: 'Wormhole', star: 'Pickup', tee: 'Tee', hole: 'Hole' };
      ui.text(names[sel.kind] || '', x, y + 10 * u, 17 * u, COL.text);
      ui.text('Drag it to move it.', x, y + 38 * u, 12 * u, COL.dim);
      if (sel.kind === 'portal' || sel.kind === 'star') {
        if (ui.button('del', x, py + 150 * u - 52 * u, w, 38 * u, { icon: ICON.trash, label: 'Delete', kind: 'danger', size: 14 })) this.deleteSelected();
      }
    } else {
      ui.text('Level', x, y + 10 * u, 17 * u, COL.text);
      y += 26 * u;
      y = this.stepper('par', 'Par', String(L.par ?? 3), x, y, w, () => { L.par = Math.max(1, (L.par ?? 3) - 1); this.parAuto = false; this.dirty = true; }, () => { L.par = Math.min(12, (L.par ?? 3) + 1); this.parAuto = false; this.dirty = true; });
      y = this.stepper('pv', 'Aim preview (s)', String(L.previewSec ?? 4), x, y, w, () => { L.previewSec = Math.max(1, (L.previewSec ?? 4) - 1); this.dirty = true; }, () => { L.previewSec = Math.min(10, (L.previewSec ?? 4) + 1); this.dirty = true; });
      ui.text('Pick a tool below, then tap', x, y + 6 * u, 12 * u, COL.dim);
      ui.text('the canvas to place it.', x, y + 24 * u, 12 * u, COL.dim);
    }
  }

  // ---- actions ----------------------------------------------------------------------------
  deleteSelected() {
    const s = this.sel;
    if (!s) return;
    const L = this.level;
    if (s.kind === 'body') removeBody(L, s.index);
    else if (s.kind === 'portal') L.portals.splice(s.index, 1);
    else if (s.kind === 'wind') L.winds.splice(s.index, 1);
    else if (s.kind === 'star') L.stars.splice(s.index, 1);
    else if (s.kind === 'tee') L.tee = null;
    else if (s.kind === 'hole') L.hole = null;
    this.sel = null;
    this.touch();
  }

  clearAll() {
    if (!this.confirmClear) {
      this.confirmClear = true;
      this.app.ui.toast('Press Clear again to remove everything');
      setTimeout(() => { this.confirmClear = false; }, 2500);
      return;
    }
    this.confirmClear = false;
    const name = this.level.name;
    this.level = emptyLevel(name);
    this.sel = null;
    this.touch();
  }

  problems() {
    return validateLevel(this.level);
  }

  test() {
    const p = this.problems();
    if (p.length) {
      this.app.ui.toast(p[0]);
      return;
    }
    const level = cloneLevel(this.level);
    level.stars = level.stars.slice(0, 3);
    const editor = this;
    const cfg = {
      level,
      kind: 'test',
      title: `Testing: ${level.name}`,
      subtitle: 'Reach the hole to verify your level',
      paletteSalt: 2,
      onWin: (res) => {
        editor.verified = true;
        if (editor.parAuto) editor.level.par = res.strokes;
        return { extra: `Level verified${editor.parAuto ? ` · par set to ${res.strokes}` : ''}` };
      },
      onExit: () => this.app.go(editor),
    };
    this.app.go(new GameScene(this.app, cfg));
  }

  save() {
    const p = this.problems();
    const store = this.app.store;
    if (!this.id) this.id = 'c' + Date.now().toString(36);
    const entry = { id: this.id, name: this.level.name, level: cloneLevel(this.level), verified: this.verified, updated: Date.now() };
    const list = store.data.custom;
    const i = list.findIndex((e) => e.id === this.id);
    if (i >= 0) list[i] = entry;
    else list.unshift(entry);
    store.save();
    this.dirty = false;
    this.saved = true;
    this.app.ui.toast(p.length ? 'Saved (not playable yet: ' + p[0].replace(/\.$/, '') + ')' : 'Saved to My Levels');
  }

  async share() {
    const p = this.problems();
    if (p.length) {
      this.app.ui.toast(p[0]);
      return;
    }
    try {
      const code = await encodeLevel(this.level);
      const url = `${location.origin}${location.pathname}#level=${code}`;
      await navigator.clipboard.writeText(url);
      this.app.ui.toast('Share link copied to clipboard');
    } catch (e) {
      this.app.ui.toast('Could not copy the link');
    }
  }

  exit() {
    if (this.dirty && this.saved === false && this.level.bodies.length) this.save();
    else if (this.dirty && this.id) this.save();
    this.app.openCreate();
  }

  // ---- input -------------------------------------------------------------------------------
  worldPos() {
    const ui = this.app.ui;
    return this.app.r.screenToWorld(ui.ptr.x, ui.ptr.y);
  }

  hitTest(wp) {
    const L = this.level;
    const pad = 8 / this.app.r.camCss;
    // handles of the current selection first
    const s = this.sel;
    if (s && s.kind === 'body') {
      const b = L.bodies[s.index];
      if (b) {
        if (Math.hypot(wp.x - (b.x + b.r), wp.y - b.y) < 14 * 1 / this.app.r.camCss * 1.4 + 6) return { kind: 'resize', index: s.index };
        if (b.orbit && b.orbit.cx !== undefined && Math.hypot(wp.x - b.orbit.cx, wp.y - b.orbit.cy) < 18 / this.app.r.camCss + 8) return { kind: 'orbitcenter', index: s.index };
      }
    }
    const w = this.world;
    if (L.tee && L.bodies[L.tee.body]) {
      const b = L.bodies[L.tee.body];
      const tx = b.x + Math.cos(L.tee.angle) * (b.r + BALL_R);
      const ty = b.y + Math.sin(L.tee.angle) * (b.r + BALL_R);
      if (Math.hypot(wp.x - tx, wp.y - ty) < 16 + pad) return { kind: 'tee' };
    }
    if (L.hole) {
      let hx = L.hole.x;
      let hy = L.hole.y;
      if (typeof L.hole.body === 'number' && L.bodies[L.hole.body]) {
        const b = L.bodies[L.hole.body];
        hx = b.x + Math.cos(L.hole.angle) * b.r;
        hy = b.y + Math.sin(L.hole.angle) * b.r;
      }
      if (Math.hypot(wp.x - hx, wp.y - hy) < 20 + pad) return { kind: 'hole' };
    }
    for (let i = L.stars.length - 1; i >= 0; i--) if (Math.hypot(wp.x - L.stars[i].x, wp.y - L.stars[i].y) < STAR_R + pad) return { kind: 'star', index: i };
    for (let i = L.portals.length - 1; i >= 0; i--) {
      const p = L.portals[i];
      if (Math.hypot(wp.x - p.a.x, wp.y - p.a.y) < PORTAL_R + pad) return { kind: 'portal', index: i, end: 'a' };
      if (Math.hypot(wp.x - p.b.x, wp.y - p.b.y) < PORTAL_R + pad) return { kind: 'portal', index: i, end: 'b' };
    }
    for (let i = L.bodies.length - 1; i >= 0; i--) {
      const b = L.bodies[i];
      if (Math.hypot(wp.x - b.x, wp.y - b.y) < b.r + pad) return { kind: 'body', index: i };
    }
    for (let i = L.winds.length - 1; i >= 0; i--) {
      if (Math.hypot(wp.x - L.winds[i].x, wp.y - L.winds[i].y) < L.winds[i].r) return { kind: 'wind', index: i };
    }
    return null;
  }

  handleInput() {
    const app = this.app;
    const ui = app.ui;
    const p = ui.ptr;
    const L = this.level;
    for (const k of ui.keys) {
      if ((k.key === 'Delete' || k.key === 'Backspace') && this.sel) this.deleteSelected();
      else if (k.key === 'Escape') {
        if (this.sel || this.pending || this.tool !== 'move') {
          this.sel = null;
          this.pending = null;
          this.tool = 'move';
        } else this.exit();
      }
    }
    const wp = this.worldPos();
    if (p.pressed && !ui.overUI()) this.onPress(wp);
    if (this.drag) {
      if (p.down || p.released) this.onDrag(wp); // apply the final position even if the drag ended within a frame
      if (!p.down) this.drag = null;
    }
  }

  onPress(wp) {
    const L = this.level;
    const ui = this.app.ui;
    const t = this.tool;
    const inside = Math.abs(wp.x) <= L.bounds.w / 2 && Math.abs(wp.y) <= L.bounds.h / 2;
    if (t === 'move') {
      const hit = this.hitTest(wp);
      if (!hit) {
        this.sel = null;
        return;
      }
      if (hit.kind === 'resize' || hit.kind === 'orbitcenter') {
        this.drag = { ...hit };
        return;
      }
      this.sel = hit;
      let ox = 0;
      let oy = 0;
      if (hit.kind === 'body') { ox = wp.x - L.bodies[hit.index].x; oy = wp.y - L.bodies[hit.index].y; }
      else if (hit.kind === 'star') { ox = wp.x - L.stars[hit.index].x; oy = wp.y - L.stars[hit.index].y; }
      else if (hit.kind === 'wind') { ox = wp.x - L.winds[hit.index].x; oy = wp.y - L.winds[hit.index].y; }
      else if (hit.kind === 'portal') { const e = L.portals[hit.index][hit.end]; ox = wp.x - e.x; oy = wp.y - e.y; }
      this.drag = { ...hit, ox, oy };
      return;
    }
    if (!inside) {
      ui.toast('Place things inside the frame');
      return;
    }
    if (t === 'planet' || t === 'repulsor' || t === 'blackhole' || t === 'sun') {
      const i = addBody(L, t, wp.x, wp.y);
      clampToBounds(L, L.bodies[i], L.bodies[i].r);
      this.sel = { kind: 'body', index: i };
      this.tool = 'move';
      this.touch();
    } else if (t === 'portal') {
      if (!this.pending) {
        this.pending = { x: Math.round(wp.x), y: Math.round(wp.y) };
      } else {
        L.portals.push({ a: this.pending, b: { x: Math.round(wp.x), y: Math.round(wp.y) } });
        this.sel = { kind: 'portal', index: L.portals.length - 1, end: 'a' };
        this.pending = null;
        this.tool = 'move';
        this.touch();
      }
    } else if (t === 'wind') {
      L.winds.push({ x: Math.round(wp.x), y: Math.round(wp.y), r: 130, ax: 0, ay: -120 });
      this.sel = { kind: 'wind', index: L.winds.length - 1 };
      this.tool = 'move';
      this.touch();
    } else if (t === 'star') {
      if (L.stars.length >= 3) ui.toast('At most 3 pickups per level');
      else {
        L.stars.push({ x: Math.round(wp.x), y: Math.round(wp.y) });
        this.touch();
      }
    } else if (t === 'tee') {
      if (!snapTee(L, wp.x, wp.y)) ui.toast('Add a planet first');
      else {
        this.sel = { kind: 'tee' };
        this.tool = 'move';
        this.touch();
      }
    } else if (t === 'hole') {
      snapHole(L, wp.x, wp.y);
      this.sel = { kind: 'hole' };
      this.tool = 'move';
      this.touch();
    } else if (t === 'erase') {
      const hit = this.hitTest(wp);
      if (hit && hit.kind !== 'resize' && hit.kind !== 'orbitcenter') {
        this.sel = hit;
        this.deleteSelected();
      }
    }
  }

  onDrag(wp) {
    const L = this.level;
    const d = this.drag;
    if (d.kind === 'body') {
      const b = L.bodies[d.index];
      b.x = Math.round(wp.x - d.ox);
      b.y = Math.round(wp.y - d.oy);
      clampToBounds(L, b, b.r * 0.5);
    } else if (d.kind === 'resize') {
      const b = L.bodies[d.index];
      b.r = Math.round(Math.max(8, Math.min(140, Math.hypot(wp.x - b.x, wp.y - b.y))));
    } else if (d.kind === 'orbitcenter') {
      const b = L.bodies[d.index];
      b.orbit.cx = Math.round(wp.x);
      b.orbit.cy = Math.round(wp.y);
    } else if (d.kind === 'star') {
      const s = L.stars[d.index];
      s.x = Math.round(wp.x - d.ox);
      s.y = Math.round(wp.y - d.oy);
      clampToBounds(L, s, 10);
    } else if (d.kind === 'wind') {
      const z = L.winds[d.index];
      z.x = Math.round(wp.x - d.ox);
      z.y = Math.round(wp.y - d.oy);
    } else if (d.kind === 'portal') {
      const e = L.portals[d.index][d.end];
      e.x = Math.round(wp.x - d.ox);
      e.y = Math.round(wp.y - d.oy);
      clampToBounds(L, e, 20);
    } else if (d.kind === 'tee') {
      snapTee(L, wp.x, wp.y);
    } else if (d.kind === 'hole') {
      snapHole(L, wp.x, wp.y);
    }
    this.touch();
  }

  // ---- rendering ---------------------------------------------------------------------------
  render(dt) {
    const app = this.app;
    const r = app.r;
    const ui = app.ui;
    const L = this.level;
    r.bounds = { hw: L.bounds.w / 2, hh: L.bounds.h / 2 };
    r.background(this.pal);
    const w = createWorld(L);
    this.world = w;
    drawLevel(r, w, 0, { showHole: true });
    // frame
    const hw = L.bounds.w / 2;
    const hh = L.bounds.h / 2;
    for (const [x1, y1, x2, y2] of [[-hw, -hh, hw, -hh], [hw, -hh, hw, hh], [hw, hh, -hw, hh], [-hw, hh, -hw, -hh]]) r.line(x1, y1, x2, y2, 1.5, 0.4, 0.65, 1, 0.45, 24);

    // tee ball
    if (L.tee && L.bodies[L.tee.body]) {
      const b = L.bodies[L.tee.body];
      const tx = b.x + Math.cos(L.tee.angle) * (b.r + BALL_R);
      const ty = b.y + Math.sin(L.tee.angle) * (b.r + BALL_R);
      r.sprite(false, T.BALL, tx, ty, BALL_R * 3.8, BALL_R, 0, 0, 0, 1, 1, 1, 1);
      r.ringFx(tx, ty, 13, 1, 1, 1, 1, 0.5);
    }
    // orbit paths
    L.bodies.forEach((b, i) => {
      if (!b.orbit) return;
      let cx = b.orbit.cx;
      let cy = b.orbit.cy;
      if (b.orbit.around !== undefined) {
        cx = L.bodies[b.orbit.around].x;
        cy = L.bodies[b.orbit.around].y;
      }
      const rad = Math.hypot(b.x - cx, b.y - cy);
      r.ringFx(cx, cy, rad, 0.9, 0.5, 0.8, 1, 0.35);
      if (this.sel && this.sel.kind === 'body' && this.sel.index === i && b.orbit.cx !== undefined) {
        r.ringFx(cx, cy, 10, 1.4, 1, 0.85, 0.3, 0.9);
        r.line(cx - 10, cy, cx + 10, cy, 1.2, 1, 0.85, 0.3, 0.9);
        r.line(cx, cy - 10, cx, cy + 10, 1.2, 1, 0.85, 0.3, 0.9);
      }
    });
    // wind direction arrows
    for (const z of L.winds) {
      const m = Math.hypot(z.ax, z.ay) || 1;
      const ux = z.ax / m;
      const uy = z.ay / m;
      r.line(z.x - ux * 30, z.y - uy * 30, z.x + ux * 30, z.y + uy * 30, 1.6, 0.6, 0.85, 1, 0.8);
      r.line(z.x + ux * 30, z.y + uy * 30, z.x + ux * 18 - uy * 9, z.y + uy * 18 + ux * 9, 1.6, 0.6, 0.85, 1, 0.8);
      r.line(z.x + ux * 30, z.y + uy * 30, z.x + ux * 18 + uy * 9, z.y + uy * 18 - ux * 9, 1.6, 0.6, 0.85, 1, 0.8);
    }
    // pending wormhole end
    if (this.pending) r.ringFx(this.pending.x, this.pending.y, PORTAL_R, 1.5, 0.8, 0.6, 1, 0.9);
    // selection
    const s = this.sel;
    if (s) {
      const pulse = 0.6 + 0.4 * Math.sin(app.time * 5);
      let cx;
      let cy;
      let rad = 20;
      if (s.kind === 'body' && L.bodies[s.index]) {
        const b = L.bodies[s.index];
        cx = b.x; cy = b.y; rad = b.r + 10;
        // resize handle
        r.dot(b.x + b.r, b.y, 7, 1, 0.9, 0.4, 0.95, 1);
        r.dot(b.x + b.r, b.y, 3, 0.1, 0.1, 0.1, 1, 1);
      } else if (s.kind === 'wind' && L.winds[s.index]) {
        cx = L.winds[s.index].x; cy = L.winds[s.index].y; rad = L.winds[s.index].r + 6;
      } else if (s.kind === 'star' && L.stars[s.index]) {
        cx = L.stars[s.index].x; cy = L.stars[s.index].y; rad = 26;
      } else if (s.kind === 'portal' && L.portals[s.index]) {
        const e = L.portals[s.index][s.end || 'a'];
        cx = e.x; cy = e.y; rad = 30;
      } else if (s.kind === 'tee' && L.tee) {
        const b = L.bodies[L.tee.body];
        cx = b.x + Math.cos(L.tee.angle) * (b.r + 5); cy = b.y + Math.sin(L.tee.angle) * (b.r + 5); rad = 18;
      } else if (s.kind === 'hole' && w.hole) {
        cx = w.hx; cy = w.hy; rad = 24;
      }
      if (cx !== undefined) r.ringFx(cx, cy, rad, 1.6, 1, 0.9, 0.4, 0.5 + 0.4 * pulse);
    }
    // hints
    if (!L.bodies.length) ui.text('Choose “Planet” below and tap the canvas to start building', ui.w / 2, ui.h / 2, 18 * ui.u, COL.dim, { align: 'center', shadow: true });
    else if (this.tool === 'portal') ui.text(this.pending ? 'Tap where the wormhole should come out' : 'Tap where the wormhole should open', ui.w / 2, 82 * ui.u, 15 * ui.u, COL.text, { align: 'center', shadow: true });
    else if (this.tool === 'tee') ui.text('Tap near a planet to place the tee', ui.w / 2, 82 * ui.u, 15 * ui.u, COL.text, { align: 'center', shadow: true });
    else if (this.tool === 'hole') ui.text('Tap a planet surface (or open space) to place the hole', ui.w / 2, 82 * ui.u, 15 * ui.u, COL.text, { align: 'center', shadow: true });
  }
}
