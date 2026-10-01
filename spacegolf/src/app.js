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

    // audio can only start after a gesture
    const unlock = () => this.sound.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('resize', () => this.r.resize());
    document.addEventListener('visibilitychange', () => {
      this.last = performance.now();
    });
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
    r.endWorld(1, this.shakeOffset || null, this.store.settings.bloom ? 0.8 : 0);
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
    r.background({ c1: [0.18, 0.1, 0.45], c2: [0.04, 0.28, 0.5], seed: 3 + variant * 2.1, parX: Math.sin(t * 0.05) * 40, parY: Math.cos(t * 0.04) * 30 });
    const s = Math.min(W, H) / 720;
    // big gas giant bottom-right with orbiting moon
    const gx = W * 0.86;
    const gy = H * 0.78;
    const gr = 170 * s;
    r.sprite(false, T.PLANET, gx, gy, gr * 1.4, gr, 5, LOOK_ID.gas, 40 * s, 1, 1, 1, 1);
    const ma = t * 0.18 + variant;
    const mx = gx + Math.cos(ma) * gr * 1.9;
    const my = gy + Math.sin(ma) * gr * 0.9 - 40 * s;
    r.sprite(false, T.PLANET, mx, my, 40 * s, 22 * s, 9, LOOK_ID.ice, 0, 1, 1, 1, 1);
    if (simple) {
      if (dim > 0) this.ui.rect(0, 0, W, H, { fill: [0.01, 0.02, 0.06, dim], radius: 0 });
      return;
    }
    // earth top-left
    const ex = W * 0.1;
    const ey = H * 0.2 + Math.sin(t * 0.2) * 6;
    r.sprite(false, T.PLANET, ex, ey, 90 * s, 58 * s, 14, LOOK_ID.earth, 22 * s, 1, 1, 1, 1);
    // little lava rock
    r.sprite(false, T.PLANET, W * 0.62 + Math.cos(t * 0.3) * 30, H * 0.12, 30 * s, 17 * s, 21, LOOK_ID.lava, 0, 1, 1, 1, 1);
    // golf ball on a lazy orbit around the earth
    const ba = -t * 0.7;
    const bx = ex + Math.cos(ba) * 120 * s;
    const by = ey + Math.sin(ba) * 100 * s;
    for (let i = 1; i < 14; i++) {
      const a2 = ba + i * 0.07;
      r.dot(ex + Math.cos(a2) * 120 * s, ey + Math.sin(a2) * 100 * s, 5 * s * (1 - i / 16), 0.5, 0.8, 1, 0.5 * (1 - i / 14));
    }
    r.sprite(false, T.BALL, bx, by, 22 * s, 6 * s, 0, 0, 0, 1, 1, 1, 1);
    if (dim > 0) {
      this.ui.rect(0, 0, W, H, { fill: [0.01, 0.02, 0.06, dim], radius: 0 });
    }
  }
}
