// The gameplay scene: aim with a slingshot drag, watch the ball fall around the
// planets, get it into the hole in as few strokes as possible.

import {
  createWorld, newState, cloneState, shoot, step, simulateShot, recall, strokes,
  DT, MAX_DRAG, MIN_DRAG, BALL_R, CAPTURE_R, PORTAL_R, accelerationAt, ensureBodies, waitUntil, hasMovingBodies,
} from '../physics.js';
import { T } from '../renderer.js';
import { COL, ICON, hex, withAlpha } from '../ui.js';
import { drawLevel, fieldBodies } from '../worldview.js';
import { paletteFor } from '../level.js';

// Seconds of flight shown by the aim hint: a base length (Settings: off / short / normal / long),
// nudged by the level's own difficulty setting.
export const PREVIEW_BASE = 0.7;
export function previewSeconds(level, assist) {
  const k = Math.min(1.5, Math.max(0.5, (level.previewSec ?? 4) / 4));
  return PREVIEW_BASE * (assist ?? 1) * k;
}

const REPLAY_AIM = 1.0; // seconds of animated aiming before each replayed shot

// the ball is drawn a little bigger than its collision radius so it reads at any zoom
const BALL_VIS = BALL_R * 1.6;

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
    this.camState = null;
    // Every shot (and manual recall) is logged with the exact world time it happened, so a run can be replayed.
    this.shotLog = [];
    this.moving = hasMovingBodies(this.level);
    this.rep = this.cfg.replay ? { shots: this.cfg.replay.shots, i: 0, timer: 0, endT: 0, over: false } : null;
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
    this.updateCamera(dt, region, sh);

    this.drawHUD(dt, topH);
    this.handleInput(dt);
    this.update(dt);
    this.render(dt);
    if (this.state === 'won') this.drawWin(dt);
  }

  // The view starts framing the whole level. If the ball escapes it, the camera zooms out and
  // follows (never closer than ~28% of the starting zoom, after which it just tracks the ball).
  updateCamera(dt, region, shake) {
    const r = this.app.r;
    const b = this.level.bounds || { w: 1600, h: 900 };
    const hw = b.w / 2;
    const hh = b.h / 2;
    const sFit = Math.min(region.w / b.w, region.h / b.h);
    const ball = this.S.ball;
    let minX = -hw;
    let maxX = hw;
    let minY = -hh;
    let maxY = hh;
    const out = Math.abs(ball.x) > hw + 40 || Math.abs(ball.y) > hh + 40;
    if (out) {
      const ahead = ball.mode === 'fly' ? 0.45 : 0;
      for (const [x, y] of [[ball.x, ball.y], [ball.x + ball.vx * ahead, ball.y + ball.vy * ahead]]) {
        minX = Math.min(minX, x - 90);
        maxX = Math.max(maxX, x + 90);
        minY = Math.min(minY, y - 90);
        maxY = Math.max(maxY, y + 90);
      }
    }
    let ts = Math.min(region.w / (maxX - minX), region.h / (maxY - minY));
    let tx = (minX + maxX) / 2;
    let ty = (minY + maxY) / 2;
    if (ts < sFit * 0.28) {
      ts = sFit * 0.28;
      tx = ball.x;
      ty = ball.y;
    }
    const c = this.camState;
    if (!c) this.camState = { x: tx, y: ty, s: ts };
    else {
      const k = 1 - Math.exp(-dt * 3.2);
      c.x += (tx - c.x) * k;
      c.y += (ty - c.y) * k;
      c.s *= Math.pow(ts / c.s, k);
    }
    const cs = this.camState;
    r.view(cs.x, cs.y, cs.s, region, shake);
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
    if (cfg.onSkip && !this.rep) buttons.push(['skip', ICON.dice, () => cfg.onSkip(), false]);
    buttons.push(['field', ICON.field, () => this.cycleField(), this.fieldMode > 0]);
    buttons.push(['ff', ICON.ffwd, () => { this.ff = !this.ff; }, this.ff]);
    if (!this.rep) buttons.push(['undo', ICON.undo, () => this.undo(), false, this.history.length === 0 || this.state === 'won']);
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
    ui.glass(chipX, y, cw, bh, { radius: bh / 2, shadowAlpha: 0.35 });
    const st = strokes(S);
    ui.text('STROKES', chipX + 24 * u, y + bh * 0.3, 9.5 * u, COL.dim, { spacing: 0.16, weight: 'medium' });
    ui.text(String(st), chipX + 24 * u, y + bh * 0.68, 23 * u, COL.text, { weight: 'heavy' });
    ui.text('PAR', chipX + 108 * u, y + bh * 0.3, 9.5 * u, COL.dim, { spacing: 0.16, weight: 'medium' });
    ui.text(String(this.level.par ?? '–'), chipX + 108 * u, y + bh * 0.68, 23 * u, COL.accent, { weight: 'heavy' });
    if (w.stars.length) {
      for (let i = 0; i < w.stars.length; i++) ui.icon(ICON.star, chipX + 168 * u + i * 24 * u + 12 * u, y + bh * 0.5, 19 * u, S.stars[i] ? COL.gold : hex('#4a5686', 0.85));
    }

    // title block (only when there is room)
    const tx = leftEdge + 2 * u;
    const room = chipX - tx - 10 * u;
    const title = cfg.title || '';
    if (room > 90 * u) {
      const tw = ui.measure(title, 18 * u);
      ui.text(title, tx, y + bh * 0.32, tw > room ? 14 * u : 18 * u, COL.text, { shadow: true, weight: 'heavy' });
      if (cfg.subtitle) ui.text(cfg.subtitle, tx, y + bh * 0.73, 12 * u, COL.dim, { weight: 'light' });
    }

    if (this.rep && this.state === 'play') {
      const total = this.rep.shots.filter((q) => !q.recall).length;
      const label = `REPLAY  ·  SHOT ${Math.min(S.shots + (S.ball.mode === 'rest' ? 1 : 0), total)} / ${total}`;
      const bw2 = ui.measure(label, 12 * u, 0.12) + 44 * u;
      ui.glass((ui.w - bw2) / 2, ui.h - 58 * u, bw2, 36 * u, { radius: 18 * u, shadowAlpha: 0.3, tint: [0.1, 0.18, 0.5, 0.5], edge: [0.6, 0.9, 1, 0.5] });
      ui.icon(ICON.eye, (ui.w - bw2) / 2 + 22 * u, ui.h - 40 * u, 16 * u, COL.accent);
      ui.text(label, (ui.w - bw2) / 2 + 36 * u, ui.h - 40 * u, 12 * u, COL.text, { spacing: 0.12, weight: 'heavy' });
    }

    // recall button for balls stuck in orbit
    if (S.ball.mode === 'fly' && S.flightT > 4 && !this.rep) {
      const rw = 170 * u;
      if (ui.button('recall', (ui.w - rw) / 2, ui.h - 62 * u, rw, 42 * u, { label: 'Recall ball', icon: ICON.undo, size: 15 })) {
        this.shotLog.push({ recall: true, t: S.t });
        recall(w, S);
        this.trail.length = 0;
        ui.toast('Ball returned to its last position');
      }
    }

    // hint banner
    if (this.level.hint && S.shots === 0 && this.state === 'play' && this.hintT < 14 && !this.rep) {
      const a = Math.min(1, this.hintT * 2, (14 - this.hintT));
      const size = 16 * u;
      const lines = wrapText(ui, this.level.hint, size, Math.min(ui.w - 40 * u, 620 * u));
      const bhh = lines.length * 22 * u + 22 * u;
      const bw = Math.max(...lines.map((l) => ui.measure(l, size))) + 40 * u;
      const bx = (ui.w - bw) / 2;
      const by = ui.h - bhh - 22 * u;
      ui.glass(bx, by, bw, bhh, { radius: 18 * u, tint: [0.05, 0.08, 0.22, 0.4 * a], shadowAlpha: 0.35 * a, edge: [0.84, 0.91, 1, 0.3 * a], edge2: [0.55, 0.7, 1, 0.07 * a], sheen: 0.06 * a });
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
    while (this.shotLog.length && this.shotLog.pop().recall); // drop the shot and any recalls after it
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
    if (this.rep) return this.replayAim();
    if (this.aim) {
      const a = this.aimFromPointer();
      return a && a.power > 0 ? a : null;
    }
    if (this.kb) return this.kb;
    return null;
  }

  // The aim arrow of a replay: swings round to the recorded angle, then "pulls back" to the recorded power.
  replayAim() {
    const rep = this.rep;
    const sh = rep.shots[rep.i];
    if (!sh || sh.recall || this.S.ball.mode !== 'rest') return null;
    const p = this.moving ? Math.max(0, Math.min(1, 1 - (sh.t - this.S.t) / REPLAY_AIM)) : Math.min(1, rep.timer / REPLAY_AIM);
    const ease = (k) => k * k * (3 - 2 * k);
    const from = this.lastShot ? this.lastShot.angle : this.defaultAngle();
    let d = sh.angle - from;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const angle = from + d * ease(Math.min(1, p / 0.55));
    const power = Math.max(0.04, sh.power * ease(Math.max(0, (p - 0.3) / 0.7)));
    return { angle, power };
  }

  // Apply the next recorded entry (a shot, or a manual recall) to the live state.
  replayStep() {
    const rep = this.rep;
    const S = this.S;
    const sh = rep.shots[rep.i];
    if (!sh) return;
    if (sh.recall) {
      if (S.ball.mode === 'fly' && S.t >= sh.t - 1e-9) {
        recall(this.world, S);
        this.trail.length = 0;
        rep.i++;
      }
      return;
    }
    if (S.ball.mode !== 'rest') return;
    if (this.moving && S.t < sh.t - 1e-9) return;
    if (!this.moving && rep.timer < REPLAY_AIM) return;
    if (sh.t > S.t) waitUntil(this.world, S, sh.t);
    shoot(this.world, S, sh.angle, sh.power);
    this.lastShot = { angle: sh.angle, power: sh.power };
    this.trail.length = 0;
    rep.i++;
    rep.timer = 0;
  }

  fire(angle, power) {
    const S = this.S;
    if (S.ball.mode !== 'rest' || this.state !== 'play') return;
    this.history.push(cloneState(S));
    this.shotLog.push({ t: S.t, angle, power });
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

    if (this.rep) {
      for (const k of ui.keys) {
        if (k.key === 'r' || k.key === 'R') this.restart();
        else if (k.key === 'g' || k.key === 'G') this.cycleField();
        else if (k.key === 'f' || k.key === 'F') this.ff = !this.ff;
        else if (k.key === 'Escape') this.exit();
      }
      this.ffHold = p.down && !ui.overUI();
      return;
    }

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
    let speed = this.ff || (this.ffHold && S.ball.mode === 'fly') ? 3 : 1;
    const rep = this.rep;
    if (rep && this.state === 'play') {
      const next = rep.shots[rep.i];
      if (S.ball.mode === 'rest') {
        if (!next) {
          rep.endT += dt;
          if (rep.endT > 1.5) this.finishReplay(false);
        } else if (this.moving) {
          // skip ahead quickly through the player's thinking time, then play the last moments of aiming normally
          if (next.t - S.t > REPLAY_AIM + 0.05) speed = 12;
        } else {
          rep.timer += dt * (this.ff ? 3 : 1);
        }
      }
    }
    this.acc += dt * speed;
    let n = 0;
    while (this.acc >= DT && n < 600) {
      if (this.rep && this.state === 'play') this.replayStep();
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
          this.shake = 0.8;
          this.flash = 0.6;
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

  finishReplay(captured, e) {
    if (this.state === 'won') return;
    const S = this.S;
    this.state = 'won';
    this.win = { t: 0, replay: true, captured, strokes: strokes(S), bx: S.ball.x, by: S.ball.y };
    if (captured) {
      this.app.sound.capture();
      this.burst(e.x, e.y, 60, [1, 0.9, 0.4], 300, 1.3, 3.4, 1.2);
      this.burst(e.x, e.y, 30, [0.5, 0.9, 1], 220, 1.1, 2.8, 1.2);
    }
  }

  onCapture(e) {
    const S = this.S;
    const w = this.world;
    const snd = this.app.sound;
    const st = strokes(S);
    const par = this.level.par ?? 3;
    if (this.rep) {
      this.finishReplay(true, e);
      return;
    }
    const stars = computeStars(this.level, st, S.starsGot);
    const result = { strokes: st, par, stars, pickups: S.starsGot, pickupsTotal: w.stars.length, shots: S.shots, penalties: S.penalties, name: scoreName(st, par), sequence: this.shotLog.map((q) => ({ ...q })) };
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

    r.background({ c1: this.pal.c1, c2: this.pal.c2, seed: this.pal.seed, parX: b.x * 0.15, parY: b.y * 0.15 });
    ensureBodies(w, S.t);
    const wantField = this.fieldMode > 0;
    this.fieldAlpha += ((wantField ? 1 : 0) - this.fieldAlpha) * Math.min(1, dt * 8);
    if (this.fieldAlpha > 0.02) r.field(this.fieldMode || 1, fieldBodies(w), this.fieldAlpha);

    drawLevel(r, w, S.t, { S });

    // trail
    // trail: a tapering ribbon that warms up with speed
    const tr = this.trail;
    const tn = tr.length / 2;
    const sp = Math.hypot(b.vx, b.vy);
    const hot = Math.min(1, sp / 520);
    for (let i = 1; i < tn; i++) {
      const f = i / tn;
      const wd = 0.5 + f * f * 3.1;
      const al = f * f * 0.95;
      r.line(tr[i * 2 - 2], tr[i * 2 - 1], tr[i * 2], tr[i * 2 + 1], wd, 0.35 + hot * 0.65, 0.75 - hot * 0.15, 1.0 - hot * 0.7, al);
    }

    // aim + preview
    const aim = this.state === 'play' && b.mode === 'rest' ? this.currentAim() : null;
    this.aimPulse += dt;
    if (this.state === 'play' && b.mode === 'rest') {
      if (aim) this.drawAim(r, aim);
      else {
        const pr = 0.5 + 0.5 * Math.sin(t * 3);
        r.ringFx(b.x, b.y, 16 + pr * 6, 1.0, 0.55, 0.88, 1, 0.28 + 0.3 * pr);
      }
    }

    // ball
    if (this.state === 'won' && this.win) {
      const k = Math.min(1, this.win.t / 0.35);
      const e = 1 - Math.pow(1 - k, 3);
      const x = this.win.bx + (w.hx - this.win.bx) * e;
      const y = this.win.by + (w.hy - this.win.by) * e;
      if (k < 1) r.sprite(false, T.BALL, x, y, BALL_VIS * 3.6, BALL_VIS * (1 - 0.7 * e), 0, 0, 0, 1, 1, 1, 1 - e * 0.5);
    } else {
      r.sprite(false, T.BALL, b.x, b.y, BALL_VIS * 4.2, BALL_VIS, 0, 0, 0, 1, 1, 1, 1);
    }

    // particles
    for (const q of this.particles) {
      const f = q.life / q.max;
      if (q.size > 2.9) r.sprite(true, T.SPARKLE, q.x, q.y, q.size * 3.2, q.size * (0.5 + f), 0, 0, 0, q.col[0], q.col[1], q.col[2], f);
      else r.dot(q.x, q.y, q.size * (0.4 + f * 0.8), q.col[0], q.col[1], q.col[2], f * 0.9);
    }
    // floating labels
    for (const f of this.floaters) {
      const p = r.worldToScreen(f.x, f.y);
      const a = Math.min(1, f.life * 2);
      ui.text(f.text, p.x, p.y - (1.2 - f.life) * 30 * ui.u - 16 * ui.u, 16 * ui.u, withAlpha(COL.gold, a), { align: 'center', shadow: true });
    }
    if (this.flash > 0) ui.rect(0, 0, ui.w, ui.h, { fill: [1, 0.15, 0.2, this.flash * 0.25], radius: 0 });
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

    // Short trajectory hint: just the start of the flight. It fades out quickly and never
    // marks where the ball ends up, so the player still has to work out the rest.
    const secs = previewSeconds(this.level, app.store.settings.assist);
    if (secs > 0.05) {
      const sim = simulateShot(w, S, aim.angle, power, { maxTime: secs, collect: true, stride: 7 });
      const pts = sim.pts;
      const n = pts.length / 2;
      for (let i = 1; i < n; i++) {
        const f = i / n;
        const a = Math.pow(1 - f, 1.4) * 0.9;
        r.dot(pts[i * 2], pts[i * 2 + 1], 2.2 - f * 0.8, 0.88, 0.95, 1, a, 1);
      }
    }

    // power read-out
    const sp = r.worldToScreen(b.x, b.y);
    ui.text(`${Math.round(power * 100)}%`, sp.x, sp.y + 38 * ui.u, 14 * ui.u, COL.text, { align: 'center', shadow: true });
  }

  // ---- result panel ----------------------------------------------------------------------
  drawReplayEnd() {
    const ui = this.app.ui;
    const u = ui.u;
    const win = this.win;
    if (win.t < 0.8) return;
    const a = Math.min(1, (win.t - 0.8) * 4);
    ui.block(0, 0, ui.w, ui.h);
    const pw = Math.min(400 * u, ui.w - 24);
    const ph = 210 * u;
    const px = (ui.w - pw) / 2;
    const py = (ui.h - ph) / 2 + (1 - a) * 22 * u;
    ui.rect(0, 0, ui.w, ui.h, { fill: [0.01, 0.015, 0.05, 0.4 * a], radius: 0 });
    ui.glass(px, py, pw, ph, { radius: 28 * u, tint: [0.05, 0.08, 0.24, 0.5 * a], shadowAlpha: 0.5 * a, shadowBlur: 28 * u, shadowOffset: 12 * u, topGlow: withAlpha(hex('#6ab8ff'), 0.2 * a), edge: [0.86, 0.93, 1, 0.38 * a], edge2: [0.55, 0.7, 1, 0.08 * a] });
    const cx = px + pw / 2;
    ui.text(win.captured ? 'REPLAY COMPLETE' : 'REPLAY ENDED', cx, py + 48 * u, 24 * u, withAlpha(COL.text, a), { align: 'center', weight: 'heavy', spacing: 0.08, shadow: true });
    ui.text(win.captured ? `${win.strokes} stroke${win.strokes === 1 ? '' : 's'}` : 'This recording no longer matches the level.', cx, py + 82 * u, 14 * u, withAlpha(COL.dim, a), { align: 'center', weight: 'light' });
    const bw = (pw - 40 * u - 10 * u) / 2;
    if (ui.button('rp-menu', px + 20 * u, py + ph - 70 * u, bw, 48 * u, { icon: ICON.home, label: 'Back', size: 16 })) this.exit();
    if (ui.button('rp-again', px + 30 * u + bw, py + ph - 70 * u, bw, 48 * u, { icon: ICON.retry, label: 'Watch again', size: 16, kind: 'primary' })) this.restart();
  }

  drawWin(dt) {
    if (this.win && this.win.replay) {
      this.drawReplayEnd();
      return;
    }
    const app = this.app;
    const ui = app.ui;
    const u = ui.u;
    const win = this.win;
    const res = win.result;
    const delay = 0.9;
    if (win.t < delay) return;
    const t = win.t - delay;
    const a = Math.min(1, t * 4);
    ui.rect(0, 0, ui.w, ui.h, { fill: [0.01, 0.015, 0.05, 0.5 * a], radius: 0 });
    ui.block(0, 0, ui.w, ui.h);
    const pw = Math.min(460 * u, ui.w - 24);
    const ph = 360 * u;
    const px = (ui.w - pw) / 2;
    const py = (ui.h - ph) / 2 + (1 - a) * 28 * u;
    const gold = res.stars === 3;
    ui.glass(px, py, pw, ph, { radius: 30 * u, tint: [0.05, 0.08, 0.24, 0.5 * a], shadowAlpha: 0.55 * a, shadowBlur: 30 * u, shadowOffset: 14 * u, glow: withAlpha(gold ? hex('#ffc94d') : hex('#4c8cff'), 0.14 * a), topGlow: withAlpha(gold ? hex('#ffd36b') : hex('#6ab8ff'), 0.2 * a), edge: [0.86, 0.93, 1, 0.38 * a], edge2: [0.55, 0.7, 1, 0.08 * a], sheen: 0.08 * a });
    const cx = px + pw / 2;
    ui.text(res.name.toUpperCase(), cx, py + 52 * u, 30 * u, withAlpha(COL.text, a), { align: 'center', shadow: true, weight: 'heavy', spacing: 0.08, color2: withAlpha(gold ? COL.gold : COL.accent, a) });
    ui.text(`${res.strokes} stroke${res.strokes === 1 ? '' : 's'}  ·  par ${res.par}`, cx, py + 88 * u, 15 * u, withAlpha(COL.dim, a), { align: 'center', weight: 'light' });
    // stars pop in one by one
    for (let i = 0; i < 3; i++) {
      const k = Math.max(0, Math.min(1, (t - 0.25 - i * 0.22) * 4));
      const pop = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.45 : 1;
      const on = i < res.stars;
      const col = on ? withAlpha(COL.gold, a * k) : withAlpha(hex('#4a5686'), a * Math.max(0.55, k));
      const yy = py + 154 * u - (i === 1 ? 10 * u : 0);
      if (on && k > 0) ui.glow(cx + (i - 1) * 66 * u, yy, 110 * u, 110 * u, withAlpha(hex('#ffc94d'), 0.35 * a * k), 2.2);
      ui.icon(ICON.star, cx + (i - 1) * 66 * u, yy, 56 * u * (on ? pop * Math.max(k, 0.01) : 1), col);
    }
    if (res.pickupsTotal) ui.text(`Pickups ${res.pickups}/${res.pickupsTotal}`, cx, py + 214 * u, 13 * u, withAlpha(COL.dim, a), { align: 'center' });
    const info = win.info;
    if (info.newBest) ui.text('NEW BEST', cx, py + 238 * u, 12 * u, withAlpha(COL.good, a), { align: 'center', spacing: 0.25, weight: 'heavy' });
    else if (info.best) ui.text(`Best: ${info.best} strokes`, cx, py + 238 * u, 13 * u, withAlpha(COL.dim, a), { align: 'center', weight: 'light' });
    if (info.extra) ui.text(info.extra, cx, py + 260 * u, 12.5 * u, withAlpha(COL.faint, a), { align: 'center', weight: 'light' });

    const by = py + ph - 74 * u;
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
