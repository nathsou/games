// Application shell: owns the renderer, UI, sound and storage, runs the main
// loop and switches scenes with a short fade.

import { Renderer, T, LOOK_ID } from './renderer.js';
import { TextAtlas } from './text.js';
import { UI } from './ui.js';
import { Sound } from './audio.js';
import { Store } from './storage.js';

export class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.r = new Renderer(canvas);
    this.atlas = new TextAtlas();
    this.r.setAtlas(this.atlas.canvas);
    this.ui = new UI(this.r, this.atlas, canvas);
    this.sound = new Sound();
    this.store = new Store();
    this.sound.enabled = this.store.settings.sound;
    this.ui.onClick = (kind) => this.sound.click();
    this.scene = null;
    this.nextScene = null;
    this.fade = 1;
    this.fadeDir = -1; // -1 fading in, +1 fading out
    this.time = 0;
    this.last = performance.now();
    this.errors = [];
    this.ema = 1 / 60;
    this.slowFrames = 0;
    this.applyQuality();

    // audio can only start after a gesture
    const unlock = () => this.sound.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('resize', () => this.r.resize());
    const syncFocus = () => {
      this.sound.setFocused(document.visibilityState === 'visible' && document.hasFocus());
      this.last = performance.now();
    };
    document.addEventListener('visibilitychange', syncFocus);
    window.addEventListener('blur', syncFocus);
    window.addEventListener('focus', syncFocus);
    window.addEventListener('pagehide', () => this.sound.setFocused(false));
    this.sound.focused = document.visibilityState === 'visible' && document.hasFocus();
  }

  // 'auto' lowers the render resolution if the device can't hold ~30 fps; 'high' never does; 'low' starts reduced.
  applyQuality() {
    const q = this.store.settings.quality || 'auto';
    this.r.quality = q === 'low' ? 0.7 : 1;
    this.slowFrames = 0;
    this.r.resize();
  }

  watchPerformance(real) {
    if (real > 0.3) return; // tab was in the background
    this.ema += (real - this.ema) * 0.05;
    if ((this.store.settings.quality || 'auto') !== 'auto') return;
    this.slowFrames = this.ema > 0.036 ? this.slowFrames + 1 : 0;
    if (this.slowFrames > 90 && this.r.quality > 0.55) {
      this.r.quality = Math.max(0.5, this.r.quality * 0.8);
      this.slowFrames = 0;
      this.ema = 1 / 60;
      this.r.resize();
    }
  }

  go(scene, instant = false) {
    if (instant || !this.scene) {
      this.scene = scene;
      this.fade = instant ? 0 : 1;
      this.fadeDir = -1;
      return;
    }
    this.nextScene = scene;
    this.fadeDir = 1;
  }

  start() {
    const loop = (now) => {
      const real = Math.max(0.0001, (now - this.last) / 1000);
      this.last = now;
      this.watchPerformance(real);
      this.frame(Math.min(0.05, real), Math.min(0.25, real));
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  frame(dt, real = dt) {
    const r = this.r;
    this.time += dt;
    r.resize();
    this.fade += this.fadeDir * real * 5;
    if (this.fadeDir > 0 && this.fade >= 1) {
      this.fade = 1;
      if (this.nextScene) {
        if (this.scene && this.scene.leave) this.scene.leave();
        this.scene = this.nextScene;
        this.nextScene = null;
      }
      this.fadeDir = -1;
    }
    if (this.fadeDir < 0 && this.fade < 0) this.fade = 0;
    r.beginFrame(this.time);
    this.ui.begin(dt, this.time);
    this.settleCamera();
    if (this.scene) this.scene.frame(dt);
    const f = Math.min(1, Math.max(0, this.fade));
    if (f > 0.001) this.ui.rect(0, 0, this.ui.w, this.ui.h, { fill: [0.02, 0.03, 0.08, f], radius: 0 });
    this.ui.end();
    r.flushWorld();
    r.endWorld(1, this.shakeOffset || null, this.store.settings.bloom ? 0.62 : 0);
    r.flushUI();
  }

  settleCamera() {
    this.shakeOffset = null;
    this.screenCamera();
  }

  // Camera where one world unit == one CSS pixel (menus draw planets in screen space).
  screenCamera() {
    const r = this.r;
    r.cam.x = r.cssW / 2;
    r.cam.y = r.cssH / 2;
    r.cam.scale = r.dpr;
    r.camCss = 1;
  }

  // Animated decorative solar system behind menus.
  backdrop(variant = 0, dim = 0, simple = false) {
    const r = this.r;
    const t = this.time;
    this.screenCamera();
    const W = r.cssW;
    const H = r.cssH;
    // gentle parallax that follows the pointer
    const p = this.ui.ptr;
    const tx = p.x > -50 ? p.x / W - 0.5 : 0;
    const ty = p.y > -50 ? p.y / H - 0.5 : 0;
    this.par = this.par || { x: 0, y: 0 };
    this.par.x += (tx - this.par.x) * Math.min(1, this.ui.dt * 2.5);
    this.par.y += (ty - this.par.y) * Math.min(1, this.ui.dt * 2.5);
    const px = this.par.x;
    const py = this.par.y;
    r.sun = { x: -W * 0.3, y: -H * 0.5 };
    r.background({ c1: [0.22, 0.12, 0.5], c2: [0.05, 0.3, 0.55], seed: 3 + variant * 2.1, parX: Math.sin(t * 0.05) * 40 + px * 120, parY: Math.cos(t * 0.04) * 30 + py * 120 });
    const s = Math.min(W, H) / 720;
    // big gas giant bottom-right with an orbiting moon
    const gx = W * 0.88 - px * 26 * s;
    const gy = H * 0.84 - py * 20 * s;
    const gr = 210 * s;
    r.sprite(false, T.PLANET, gx, gy, gr * 1.4, gr, 5, LOOK_ID.gas, 44 * s, 1, 1, 1, 1);
    const ma = t * 0.14 + variant;
    const mx = gx + Math.cos(ma) * gr * 1.8 - px * 10 * s;
    const my = gy + Math.sin(ma) * gr * 0.7 - 70 * s;
    r.sprite(false, T.PLANET, mx, my, 44 * s, 24 * s, 9, LOOK_ID.ice, 0, 1, 1, 1, 1);
    if (!simple) {
      // earth top-left
      const ex = W * 0.1 - px * 40 * s;
      const ey = H * 0.2 + Math.sin(t * 0.2) * 5 - py * 30 * s;
      r.sprite(false, T.PLANET, ex, ey, 112 * s, 66 * s, 14, LOOK_ID.earth, 26 * s, 1, 1, 1, 1);
      // distant moon and lava rock
      r.sprite(false, T.PLANET, W * 0.27 - px * 18 * s, H * 0.72 - py * 14 * s, 30 * s, 15 * s, 3, LOOK_ID.moon, 0, 1, 1, 1, 1);
      r.sprite(false, T.PLANET, W * 0.64 + Math.cos(t * 0.3) * 24 - px * 12 * s, H * 0.1 - py * 8 * s, 34 * s, 18 * s, 21, LOOK_ID.lava, 0, 1, 1, 1, 1);
      // golf ball on a lazy orbit around the earth, with a ribbon trail
      const ba = -t * 0.7;
      const rx = 135 * s;
      const ry = 112 * s;
      for (let i = 1; i < 26; i++) {
        const a1 = ba + (i - 1) * 0.045;
        const a2 = ba + i * 0.045;
        const f = 1 - i / 26;
        r.line(ex + Math.cos(a1) * rx, ey + Math.sin(a1) * ry, ex + Math.cos(a2) * rx, ey + Math.sin(a2) * ry, (0.6 + f * 2.2) * s, 0.5, 0.82, 1, f * f * 0.9);
      }
      r.sprite(false, T.BALL, ex + Math.cos(ba) * rx, ey + Math.sin(ba) * ry, 30 * s, 7.5 * s, 0, 0, 0, 1, 1, 1, 1);
      // an occasional shooting star
      const cyc = (t % 9) / 1.1;
      if (cyc < 1) {
        const sx = W * (0.15 + 0.5 * ((Math.floor(t / 9) * 0.37) % 1));
        const sy = H * 0.08;
        const k = cyc;
        const hx = sx + k * W * 0.35;
        const hy = sy + k * H * 0.3;
        const fade = Math.sin(k * Math.PI);
        r.line(hx - W * 0.09, hy - H * 0.075, hx, hy, 1.2 * s, 0.7, 0.88, 1, fade * 0.9);
        r.dot(hx, hy, 4 * s, 1, 1, 1, fade);
      }
    }
    if (dim > 0) {
      this.ui.rect(0, 0, W, H, { fill: [0.01, 0.015, 0.05, dim], radius: 0 });
    }
  }
}
