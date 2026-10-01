// The gameplay scene: aim with a slingshot drag, watch the ball fall around the
// planets, get it into the hole in as few strokes as possible.

import {
  createWorld, newState, cloneState, shoot, step, simulateShot, recall, strokes,
  DT, MAX_DRAG, MIN_DRAG, BALL_R, CAPTURE_R, PORTAL_R, accelerationAt, ensureBodies,
} from '../physics.js';
import { T } from '../renderer.js';
import { COL, ICON, hex, withAlpha } from '../ui.js';
import { drawLevel, fieldBodies } from '../worldview.js';
import { paletteFor } from '../level.js';

export function scoreName(strokes, par) {
  if (strokes === 1) return 'Hole in one!';
  const d = strokes - par;
  if (d <= -3) return 'Incredible!';
  if (d === -2) return 'Eagle!';
  if (d === -1) return 'Birdie!';
  if (d === 0) return 'Par';
  if (d === 1) return 'Bogey';
  if (d === 2) return 'Double bogey';
  return `+${d} over par`;
}

export function computeStars(level, strokesUsed, pickups) {
  const par = level.par ?? 3;
  const total = (level.stars || []).length;
  let stars = 1;
  if (strokesUsed <= par) stars = 2;
  if (strokesUsed <= par && (total ? pickups >= total : strokesUsed < par || par === 1)) stars = 3;
  return stars;
}

const FIELD_NAMES = ['Gravity view: off', 'Gravity view: contours', 'Gravity view: spacetime grid'];
const LOST_TEXT = {
  swallowed: 'Swallowed by a black hole! +1 stroke',
  burned: 'Burned up in a sun! +1 stroke',
  space: 'Lost in space! +1 stroke',
  drift: 'Ball recalled to its last position',
};

export class GameScene {
  // cfg: { level, kind, title, subtitle, onWin(result)->{newBest,best}, onNext, nextLabel, onExit, onSkip, paletteSalt }
  constructor(app, cfg) {
    this.app = app;
    this.cfg = cfg;
    this.level = cfg.level;
    this.fieldMode = app.store.settings.field | 0;
    this.reset();
  }

  reset() {
    this.world = createWorld(this.level);
    this.S = newState(this.world);
    this.S.ev = [];
    this.history = [];
    this.acc = 0;
    this.ff = false;
    this.particles = [];
    this.floaters = [];
    this.trail = [];
    this.trailTick = 0;
    this.shake = 0;
    this.flash = 0;
    this.aim = null;
    this.kb = null;
    this.state = 'play';
    this.win = null;
    this.lastShot = null;
    this.hintT = 0;
    this.pal = paletteFor(this.level, this.cfg.paletteSalt || 0);
    this.fieldAlpha = 0;
    this.aimPulse = 0;
  }

  leave() {
    this.app.sound.setHum(0);
  }

  exit() {
    this.app.sound.back();
    if (this.cfg.onExit) this.cfg.onExit();
  }

  // ---- main loop --------------------------------------------------------------------
  frame(dt) {
    const app = this.app;
    const r = app.r;
    const ui = app.ui;
    const u = ui.u;
    this.hintT += dt;
    const topH = 64 * u;
    const region = { x: 14 * u, y: topH + 4 * u, w: ui.w - 28 * u, h: ui.h - topH - 20 * u };
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.flash = Math.max(0, this.flash - dt * 1.8);
    const sh = this.shake > 0 ? { x: (Math.random() - 0.5) * this.shake * 10 * u, y: (Math.random() - 0.5) * this.shake * 10 * u } : null;
    const b = this.level.bounds || { w: 1600, h: 900 };
    r.fitCamera(b.w, b.h, region, sh);

    this.drawHUD(dt, topH);
    this.handleInput(dt);
    this.update(dt);
    this.render(dt);
    if (this.state === 'won') this.drawWin(dt);
  }

  // ---- HUD ----------------------------------------------------------------------------
  drawHUD(dt, topH) {
    const app = this.app;
    const ui = app.ui;
    const u = ui.u;
    const S = this.S;
    const w = this.world;
    const bh = 44 * u;
    const y = 10 * u;
    const cfg = this.cfg;

    if (ui.button('menu', 12 * u, y, bh, bh, { icon: ICON.home, iconScale: 0.52 })) this.exit();

    // right-hand buttons
    const buttons = [];
    if (cfg.onSkip) buttons.push(['skip', ICON.dice, () => cfg.onSkip(), false]);
    buttons.push(['field', ICON.field, () => this.cycleField(), this.fieldMode > 0]);
    buttons.push(['ff', ICON.ffwd, () => { this.ff = !this.ff; }, this.ff]);
    buttons.push(['undo', ICON.undo, () => this.undo(), false, this.history.length === 0 || this.state === 'won']);
    buttons.push(['retry', ICON.retry, () => this.restart(), false]);
    let x = ui.w - 12 * u - bh;
    for (const [id, icon, fn, active, disabled] of buttons) {
      if (ui.button(id, x, y, bh, bh, { icon, iconScale: 0.52, selected: active, disabled })) fn();
      x -= bh + 8 * u;
    }
    const rightEdge = x + bh + 8 * u;

    // centre chip: strokes / par / pickups
    const cw = 250 * u;
    const cx = (ui.w - cw) / 2;
    const leftEdge = 12 * u + bh + 10 * u;
    const tight = cx < leftEdge + 120 * u || cx + cw > rightEdge - 8 * u;
    const chipX = tight ? Math.max(leftEdge, Math.min(cx, rightEdge - cw - 8 * u)) : cx;
    ui.rect(chipX, y, cw, bh, { fill: COL.panel, border: 1.5, borderColor: COL.panelEdge, radius: 16 * u });
    const st = strokes(S);
    ui.text('STROKES', chipX + 16 * u, y + bh * 0.3, 10.5 * u, COL.dim, { spacing: 0.1 });
    ui.text(String(st), chipX + 16 * u, y + bh * 0.68, 22 * u, COL.text);
    ui.text('PAR', chipX + 100 * u, y + bh * 0.3, 10.5 * u, COL.dim, { spacing: 0.1 });
    ui.text(String(this.level.par ?? '–'), chipX + 100 * u, y + bh * 0.68, 22 * u, COL.accent);
    if (w.stars.length) {
      for (let i = 0; i < w.stars.length; i++) ui.icon(ICON.star, chipX + 160 * u + i * 24 * u + 12 * u, y + bh * 0.5, 20 * u, S.stars[i] ? COL.gold : hex('#3a4670', 0.9));
    }

    // title block (only when there is room)
    const tx = leftEdge + 2 * u;
    const room = chipX - tx - 10 * u;
    const title = cfg.title || '';
    if (room > 90 * u) {
      const tw = ui.measure(title, 18 * u);
      ui.text(title, tx, y + bh * 0.32, tw > room ? 14 * u : 18 * u, COL.text, { shadow: true });
      if (cfg.subtitle) ui.text(cfg.subtitle, tx, y + bh * 0.73, 12 * u, COL.dim);
    }

    // recall button for balls stuck in orbit
    if (S.ball.mode === 'fly' && S.flightT > 5) {
      const rw = 170 * u;
      if (ui.button('recall', (ui.w - rw) / 2, ui.h - 62 * u, rw, 42 * u, { label: 'Recall ball', icon: ICON.undo, size: 15 })) {
        recall(w, S);
        this.trail.length = 0;
        ui.toast('Ball recalled');
      }
    }

    // hint banner
    if (this.level.hint && S.shots === 0 && this.state === 'play' && this.hintT < 14) {
      const a = Math.min(1, this.hintT * 2, (14 - this.hintT));
      const size = 16 * u;
      const lines = wrapText(ui, this.level.hint, size, Math.min(ui.w - 40 * u, 620 * u));
      const bhh = lines.length * 22 * u + 22 * u;
      const bw = Math.max(...lines.map((l) => ui.measure(l, size))) + 40 * u;
      const bx = (ui.w - bw) / 2;
      const by = ui.h - bhh - 22 * u;
      ui.rect(bx, by, bw, bhh, { fill: withAlpha(COL.panel, a), border: 1.2, borderColor: withAlpha(COL.panelEdge, a), radius: 16 * u });
      lines.forEach((l, i) => ui.text(l, ui.w / 2, by + 22 * u + i * 22 * u - 2 * u, size, withAlpha(COL.text, a), { align: 'center' }));
    }
  }

  cycleField() {
    this.fieldMode = (this.fieldMode + 1) % 3;
    this.app.store.settings.field = this.fieldMode;
    this.app.store.save();
    this.app.ui.toast(FIELD_NAMES[this.fieldMode]);
  }

  restart() {
    this.app.sound.back();
    this.reset();
  }

  undo() {
    if (!this.history.length) return;
    const prev = this.history.pop();
    prev.ev = this.S.ev;
    this.S = prev;
    this.S.ev.length = 0;
    this.trail.length = 0;
    this.acc = 0;
    this.aim = null;
    this.kb = null;
    this.state = 'play';
    this.win = null;
    this.app.sound.back();
  }

  // ---- input --------------------------------------------------------------------------
  aimFromPointer() {
    const ui = this.app.ui;
    const r = this.app.r;
    const a = this.aim;
    if (!a) return null;
    const dx = (ui.ptr.x - a.sx) / r.camCss;
    const dy = (ui.ptr.y - a.sy) / r.camCss;
    const pull = Math.hypot(dx, dy);
    if (pull < MIN_DRAG) return { angle: 0, power: 0, pull };
    return { angle: Math.atan2(-dy, -dx), power: Math.min(1, pull / MAX_DRAG), pull };
  }

  currentAim() {
    if (this.aim) {
      const a = this.aimFromPointer();
      return a && a.power > 0 ? a : null;
    }
    if (this.kb) return this.kb;
    return null;
  }

  fire(angle, power) {
    const S = this.S;
    if (S.ball.mode !== 'rest' || this.state !== 'play') return;
    this.history.push(cloneState(S));
    shoot(this.world, S, angle, power);
    this.lastShot = { angle, power };
    this.kb = null;
    this.aim = null;
    this.ff = false;
    this.trail.length = 0;
    this.acc = 0;
  }

  handleInput(dt) {
    const app = this.app;
    const ui = app.ui;
    const p = ui.ptr;
    const S = this.S;
    if (this.state === 'won') return;
    const flying = S.ball.mode === 'fly';

    for (const k of ui.keys) {
      const key = k.key;
      if (key === 'r' || key === 'R') this.restart();
      else if (key === 'u' || key === 'U' || key === 'z' || key === 'Z' || key === 'Backspace') this.undo();
      else if (key === 'g' || key === 'G') this.cycleField();
      else if (key === 'f' || key === 'F') this.ff = !this.ff;
      else if (key === 'Escape') this.exit();
      else if (!flying && (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown')) {
        if (!this.kb) {
          const base = this.lastShot || { angle: this.defaultAngle(), power: 0.5 };
          this.kb = { angle: base.angle, power: base.power };
        }
        const fine = 0.0175;
        if (key === 'ArrowLeft') this.kb.angle -= fine;
        if (key === 'ArrowRight') this.kb.angle += fine;
        if (key === 'ArrowUp') this.kb.power = Math.min(1, this.kb.power + 0.025);
        if (key === 'ArrowDown') this.kb.power = Math.max(0.03, this.kb.power - 0.025);
      } else if (!flying && (key === ' ' || key === 'Enter') && this.kb) {
        this.fire(this.kb.angle, this.kb.power);
      }
    }

    if (!flying) {
      if (p.pressed && !ui.overUI() && !this.aim) {
        this.aim = { sx: p.x, sy: p.y };
        this.kb = null;
      }
      if (this.aim) {
        if (p.rightPressed) {
          this.aim = null;
        } else if (!p.down) {
          const a = this.aimFromPointer();
          this.aim = null;
          if (a && a.power > 0) this.fire(a.angle, a.power);
        }
      }
    } else {
      this.aim = null;
      // hold anywhere to fast-forward the flight
      this.ffHold = p.down && !ui.overUI();
    }
  }

  defaultAngle() {
    const w = this.world;
    const b = this.S.ball;
    if (w.hole) return Math.atan2(w.hy - b.y, w.hx - b.x);
    return -Math.PI / 2;
  }

  // ---- simulation -----------------------------------------------------------------------
  update(dt) {
    const S = this.S;
    const w = this.world;
    const snd = this.app.sound;
    const speed = this.ff || (this.ffHold && S.ball.mode === 'fly') ? 3 : 1;
    this.acc += dt * speed;
    let n = 0;
    while (this.acc >= DT && n < 400) {
      step(w, S, DT);
      this.acc -= DT;
      n++;
      if (S.ev.length) this.handleEvents();
      if (S.ball.mode === 'fly' && ++this.trailTick % 2 === 0) {
        this.trail.push(S.ball.x, S.ball.y);
        if (this.trail.length > 70 * 2) this.trail.splice(0, 2);
      }
    }
    if (this.acc > DT * 8) this.acc = 0;
    if (S.ball.mode !== 'fly' && this.trail.length) this.trail.splice(0, 2);

    if (S.ball.mode === 'fly') {
      const a = accelerationAt(w, S.t, S.ball.x, S.ball.y);
      snd.setHum(Math.hypot(a.x, a.y) / 500);
    } else snd.setHum(0);

    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      if (q.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 1 - q.drag * dt;
      q.vy *= 1 - q.drag * dt;
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    if (this.win) this.win.t += dt;
  }

  burst(x, y, count, col, speed, life, size, drag = 1.5) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 700) break;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.25 + Math.random() * 0.75);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.5), max: life,
        size: size * (0.6 + Math.random() * 0.8), col, drag,
      });
    }
  }

  handleEvents() {
    const S = this.S;
    const snd = this.app.sound;
    const ev = S.ev;
    for (const e of ev) {
      switch (e.type) {
        case 'shoot':
          snd.shoot(e.power);
          this.burst(e.x, e.y, 14, [0.7, 0.9, 1], 120, 0.5, 2.6);
          this.shake = Math.max(this.shake, 0.25 * e.power);
          break;
        case 'bounce':
          if (e.soft) snd.splat();
          else snd.bounce(e.speed, e.surface);
          this.burst(e.x, e.y, Math.min(16, 4 + e.speed / 40), [1, 0.85, 0.6], 60 + e.speed * 0.3, 0.5, 2.2);
          this.shake = Math.max(this.shake, Math.min(0.5, e.speed / 900));
          break;
        case 'rest':
          snd.rest();
          this.trail.length = 0;
          break;
        case 'star': {
          const got = S.starsGot;
          snd.star(got - 1);
          this.burst(e.x, e.y, 26, [1, 0.85, 0.3], 190, 0.9, 3.2);
          this.floaters.push({ x: e.x, y: e.y, text: `★ ${got}/${this.world.stars.length}`, life: 1.2 });
          break;
        }
        case 'portal':
          snd.portal();
          this.burst(e.x, e.y, 18, [0.6, 0.8, 1], 150, 0.6, 2.8);
          this.burst(e.x2, e.y2, 18, [1, 0.6, 1], 150, 0.6, 2.8);
          break;
        case 'lost':
          snd.lost(e.reason);
          this.burst(e.x, e.y, 30, e.reason === 'burned' ? [1, 0.5, 0.15] : [1, 0.4, 0.5], 220, 0.8, 3);
          if (e.reason !== 'drift') {
            this.shake = 0.8;
            this.flash = 0.6;
          }
          this.app.ui.toast(LOST_TEXT[e.reason] || 'Lost!');
          this.trail.length = 0;
          break;
        case 'capture':
          this.onCapture(e);
          break;
        default:
      }
    }
    ev.length = 0;
  }

  onCapture(e) {
    const S = this.S;
    const w = this.world;
    const snd = this.app.sound;
    const st = strokes(S);
    const par = this.level.par ?? 3;
    const stars = computeStars(this.level, st, S.starsGot);
    const result = { strokes: st, par, stars, pickups: S.starsGot, pickupsTotal: w.stars.length, shots: S.shots, penalties: S.penalties, name: scoreName(st, par) };
    const info = this.cfg.onWin ? this.cfg.onWin(result) || {} : {};
    this.win = { t: 0, result, info, bx: S.ball.x, by: S.ball.y };
    this.state = 'won';
    this.aim = null;
    this.kb = null;
    snd.capture();
    snd.win(stars);
    snd.setHum(0);
    this.shake = 0.6;
    this.burst(e.x, e.y, 70, [1, 0.9, 0.4], 320, 1.4, 3.4, 1.2);
    this.burst(e.x, e.y, 40, [0.5, 0.9, 1], 240, 1.2, 2.8, 1.2);
  }

  // ---- rendering ---------------------------------------------------------------------
  render(dt) {
    const app = this.app;
    const r = app.r;
    const ui = app.ui;
    const S = this.S;
    const w = this.world;
    const t = app.time;
    const b = S.ball;
    const bs = this.level.bounds || { w: 1600, h: 900 };

    r.background({ c1: this.pal.c1, c2: this.pal.c2, seed: this.pal.seed, parX: b.x * 0.15, parY: b.y * 0.15 });
    ensureBodies(w, S.t);
    const wantField = this.fieldMode > 0;
    this.fieldAlpha += ((wantField ? 1 : 0) - this.fieldAlpha) * Math.min(1, dt * 8);
    if (this.fieldAlpha > 0.02) r.field(this.fieldMode || 1, fieldBodies(w), this.fieldAlpha);

    drawLevel(r, w, S.t, { S });
    this.drawBounds(r, bs, b);

    // trail
    const tr = this.trail;
    const tn = tr.length / 2;
    for (let i = 0; i < tn; i++) {
      const f = (i + 1) / tn;
      const sp = Math.hypot(b.vx, b.vy);
      const hot = Math.min(1, sp / 500);
      r.dot(tr[i * 2], tr[i * 2 + 1], 2 + f * 3.4, 0.45 + hot * 0.55, 0.75 - hot * 0.2, 1 - hot * 0.65, f * f * 0.55);
    }

    // aim + preview
    const aim = this.state === 'play' && b.mode === 'rest' ? this.currentAim() : null;
    this.aimPulse += dt;
    if (this.state === 'play' && b.mode === 'rest') {
      if (aim) this.drawAim(r, aim);
      else {
        const pr = 0.5 + 0.5 * Math.sin(t * 3);
        r.ringFx(b.x, b.y, 15 + pr * 5, 1.1, 0.5, 0.85, 1, 0.35 + 0.25 * pr);
      }
    }

    // ball
    if (this.state === 'won' && this.win) {
      const k = Math.min(1, this.win.t / 0.35);
      const e = 1 - Math.pow(1 - k, 3);
      const x = this.win.bx + (w.hx - this.win.bx) * e;
      const y = this.win.by + (w.hy - this.win.by) * e;
      if (k < 1) r.sprite(false, T.BALL, x, y, BALL_R * 3.6, BALL_R * (1 - 0.7 * e), 0, 0, 0, 1, 1, 1, 1 - e * 0.5);
    } else {
      r.sprite(false, T.BALL, b.x, b.y, BALL_R * 3.8, BALL_R, 0, 0, 0, 1, 1, 1, 1);
    }

    // particles
    for (const q of this.particles) {
      const f = q.life / q.max;
      r.dot(q.x, q.y, q.size * (0.4 + f * 0.8), q.col[0], q.col[1], q.col[2], f * 0.9);
    }
    // floating labels
    for (const f of this.floaters) {
      const p = r.worldToScreen(f.x, f.y);
      const a = Math.min(1, f.life * 2);
      ui.text(f.text, p.x, p.y - (1.2 - f.life) * 30 * ui.u - 16 * ui.u, 16 * ui.u, withAlpha(COL.gold, a), { align: 'center', shadow: true });
    }
    if (this.flash > 0) ui.rect(0, 0, ui.w, ui.h, { fill: [1, 0.15, 0.2, this.flash * 0.25], radius: 0 });
  }

  drawBounds(r, bs, b) {
    const hw = bs.w / 2;
    const hh = bs.h / 2;
    const near = b.mode === 'fly' ? Math.min(hw - Math.abs(b.x), hh - Math.abs(b.y)) : 1e9;
    const warn = Math.max(0, 1 - near / 120);
    const c = [0.35 + warn * 0.65, 0.6 - warn * 0.3, 1 - warn * 0.6];
    const a = 0.2 + warn * 0.5;
    const dash = 26;
    r.line(-hw, -hh, hw, -hh, 1.4, c[0], c[1], c[2], a, dash);
    r.line(hw, -hh, hw, hh, 1.4, c[0], c[1], c[2], a, dash);
    r.line(hw, hh, -hw, hh, 1.4, c[0], c[1], c[2], a, dash);
    r.line(-hw, hh, -hw, -hh, 1.4, c[0], c[1], c[2], a, dash);
  }

  drawAim(r, aim) {
    const app = this.app;
    const ui = app.ui;
    const S = this.S;
    const w = this.world;
    const b = S.ball;
    const power = aim.power;
    const ca = Math.cos(aim.angle);
    const sa = Math.sin(aim.angle);
    // power colour: cyan -> orange
    const pc = [0.4 + power * 0.6, 0.9 - power * 0.35, 1 - power * 0.75];
    r.ringFx(b.x, b.y, 14 + power * 10, 1.2, pc[0], pc[1], pc[2], 0.8);
    const len = 20 + power * 70;
    r.line(b.x + ca * 12, b.y + sa * 12, b.x + ca * len, b.y + sa * len, 1.8, pc[0], pc[1], pc[2], 0.85);
    // arrow head
    const hx = b.x + ca * (len + 6);
    const hy = b.y + sa * (len + 6);
    r.line(hx, hy, hx - ca * 9 - sa * 6, hy - sa * 9 + ca * 6, 1.8, pc[0], pc[1], pc[2], 0.85);
    r.line(hx, hy, hx - ca * 9 + sa * 6, hy - sa * 9 - ca * 6, 1.8, pc[0], pc[1], pc[2], 0.85);

    // elastic band toward the finger
    if (this.aim) {
      const camCss = r.camCss;
      const dx = (ui.ptr.x - this.aim.sx) / camCss;
      const dy = (ui.ptr.y - this.aim.sy) / camCss;
      const lim = Math.min(1, Math.hypot(dx, dy) / MAX_DRAG);
      const k = Math.hypot(dx, dy) > MAX_DRAG ? MAX_DRAG / Math.hypot(dx, dy) : 1;
      r.line(b.x, b.y, b.x + dx * k * 0.55, b.y + dy * k * 0.55, 1.2, 1, 1, 1, 0.22 + lim * 0.2, 7);
    }

    // trajectory preview
    const assist = app.store.settings.assist;
    const secs = Math.min(10, (this.level.previewSec ?? 4) * assist);
    if (secs > 0.05) {
      const sim = simulateShot(w, S, aim.angle, power, { maxTime: secs, collect: true, stride: 4 });
      const pts = sim.pts;
      const n = pts.length / 2;
      for (let i = 1; i < n; i++) {
        const f = i / n;
        const a = Math.pow(1 - f, 0.7) * 0.9;
        r.dot(pts[i * 2], pts[i * 2 + 1], 2.1, 1, 1, 1, a, 1);
      }
      const end = sim.S.ball;
      if (sim.steps * DT < secs - 0.05 || sim.S.ball.mode !== 'fly') {
        const m = sim.S.ball.mode;
        const lost = sim.S.penalties > S.penalties;
        const ex = pts[pts.length - 2];
        const ey = pts[pts.length - 1];
        if (m === 'captured') r.ringFx(w.hx, w.hy, 16, 1.4, 1, 0.9, 0.3, 0.9);
        else if (lost) {
          r.line(ex - 6, ey - 6, ex + 6, ey + 6, 1.4, 1, 0.35, 0.4, 0.9);
          r.line(ex - 6, ey + 6, ex + 6, ey - 6, 1.4, 1, 0.35, 0.4, 0.9);
        } else if (m === 'rest') r.ringFx(end.x, end.y, 8, 1, 0.6, 1, 0.8, 0.8);
      }
    }

    // power read-out
    const sp = r.worldToScreen(b.x, b.y);
    ui.text(`${Math.round(power * 100)}%`, sp.x, sp.y + 38 * ui.u, 14 * ui.u, COL.text, { align: 'center', shadow: true });
  }

  // ---- result panel ----------------------------------------------------------------------
  drawWin(dt) {
    const app = this.app;
    const ui = app.ui;
    const u = ui.u;
    const win = this.win;
    const res = win.result;
    const delay = 0.9;
    if (win.t < delay) return;
    const t = win.t - delay;
    const a = Math.min(1, t * 4);
    ui.rect(0, 0, ui.w, ui.h, { fill: [0.01, 0.02, 0.06, 0.55 * a], radius: 0 });
    ui.block(0, 0, ui.w, ui.h);
    const pw = Math.min(440 * u, ui.w - 24);
    const ph = 340 * u;
    const px = (ui.w - pw) / 2;
    const py = (ui.h - ph) / 2 + (1 - a) * 24 * u;
    ui.rect(px, py, pw, ph, { fill: withAlpha(COL.panel, 0.94 * a), border: 1.6, borderColor: withAlpha(COL.panelEdge, a), radius: 22 * u, glow: withAlpha(hex('#4c8cff'), 0.12 * a) });
    const cx = px + pw / 2;
    ui.text(res.name, cx, py + 52 * u, 34 * u, withAlpha(COL.text, a), { align: 'center', shadow: true, color2: withAlpha(res.stars === 3 ? COL.gold : COL.accent, a) });
    ui.text(`${res.strokes} stroke${res.strokes === 1 ? '' : 's'}  ·  par ${res.par}`, cx, py + 88 * u, 16 * u, withAlpha(COL.dim, a), { align: 'center' });
    // stars pop in one by one
    for (let i = 0; i < 3; i++) {
      const k = Math.max(0, Math.min(1, (t - 0.25 - i * 0.22) * 4));
      const pop = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.4 : 1;
      const col = i < res.stars ? withAlpha(COL.gold, a * k) : withAlpha(hex('#3a4670'), a * Math.max(0.5, k));
      ui.icon(ICON.star, cx + (i - 1) * 62 * u, py + 150 * u, 52 * u * (i < res.stars ? pop * k : 1), col);
    }
    if (res.pickupsTotal) ui.text(`Stars collected ${res.pickups}/${res.pickupsTotal}`, cx, py + 196 * u, 14 * u, withAlpha(COL.dim, a), { align: 'center' });
    const info = win.info;
    if (info.newBest) ui.text('New best!', cx, py + 218 * u, 15 * u, withAlpha(COL.good, a), { align: 'center' });
    else if (info.best) ui.text(`Best: ${info.best} strokes`, cx, py + 218 * u, 14 * u, withAlpha(COL.dim, a), { align: 'center' });
    if (info.extra) ui.text(info.extra, cx, py + 240 * u, 13 * u, withAlpha(COL.faint, a), { align: 'center' });

    const by = py + ph - 70 * u;
    const gap = 10 * u;
    const hasNext = !!this.cfg.onNext;
    const nb = hasNext ? 3 : 2;
    const bw = (pw - 40 * u - gap * (nb - 1)) / nb;
    if (ui.button('w-menu', px + 20 * u, by, bw, 48 * u, { icon: ICON.home, label: 'Menu', size: 16 })) this.exit();
    if (ui.button('w-retry', px + 20 * u + bw + gap, by, bw, 48 * u, { icon: ICON.retry, label: 'Retry', size: 16 })) this.restart();
    if (hasNext) {
      if (ui.button('w-next', px + 20 * u + (bw + gap) * 2, by, bw, 48 * u, { icon: ICON.play, label: this.cfg.nextLabel || 'Next', size: 16, kind: 'primary' })) {
        this.app.sound.click();
        this.cfg.onNext();
      }
    }
    for (const k of ui.keys) {
      if ((k.key === 'Enter' || k.key === ' ') && hasNext) this.cfg.onNext();
    }
    // share/replay extras
    if (this.cfg.extraButtons) this.cfg.extraButtons(ui, px, py + ph + 14 * u, pw, u);
  }
}

function wrapText(ui, text, size, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ui.measure(test, size) > maxW - 40 && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
