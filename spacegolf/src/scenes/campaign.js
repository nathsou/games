import { WORLDS } from '../campaign.js';
import { T, LOOK_ID } from '../renderer.js';
import { COL, ICON, hex, withAlpha } from '../ui.js';
import { header, drawThumb } from './common.js';

export class CampaignScene {
  constructor(app, opts = {}) {
    this.app = app;
    this.world = opts.world ?? this.firstUnfinishedWorld();
    this.slide = 0;
    this.t = 0;
  }

  firstUnfinishedWorld() {
    const st = this.app.store;
    for (let i = 0; i < WORLDS.length; i++) {
      if (WORLDS[i].levels.some((l) => !st.levelRecord(l.id))) return i;
    }
    return 0;
  }

  worldStars(w) {
    let n = 0;
    for (const l of w.levels) n += this.app.store.levelRecord(l.id)?.stars || 0;
    return n;
  }

  frame(dt) {
    const app = this.app;
    const ui = app.ui;
    const r = app.r;
    const u = ui.u;
    const store = app.store;
    const w = WORLDS[this.world];
    this.slide += (0 - this.slide) * Math.min(1, dt * 10);
    this.t += dt;

    app.backdrop(1 + this.world, 0.3, true);
    if (header(app, 'Campaign', `${store.totalStars()} ★ collected`)) app.openTitle();

    // world switcher
    const topY = 84 * u;
    const cx = ui.w / 2;
    const narrow = ui.w < 760 * u;
    // planet preview
    const pr = (narrow ? 62 : 82) * u;
    const py = topY + pr + 14 * u;
    r.sprite(false, T.PLANET, cx - (narrow ? 0 : 230 * u) , narrow ? py : py + 10 * u, pr * 1.5, pr, this.world * 9 + 3, LOOK_ID[w.look] ?? 0, w.look === 'gas' ? 30 * u : 0, 1, 1, 1, 1);
    const tx = narrow ? cx : cx + 0;
    const ty = narrow ? py + pr + 34 * u : py - 22 * u;
    const aligned = narrow ? 'center' : 'left';
    const textX = narrow ? cx : cx - 130 * u;
    ui.text(`WORLD ${this.world + 1}`, textX, ty - 26 * u, 12 * u, COL.dim, { align: aligned, spacing: 0.3 });
    ui.text(w.name, textX, ty + 6 * u, 36 * u, COL.text, { align: aligned, shadow: true });
    ui.text(w.blurb, textX, ty + 40 * u, 15 * u, COL.dim, { align: aligned });
    const total = w.levels.length * 3;
    const have = this.worldStars(w);
    ui.stars(textX + (narrow ? 0 : 56 * u), ty + 72 * u, 18 * u, Math.min(3, Math.round((have / total) * 3)), 3);
    ui.text(`${have}/${total}`, textX + (narrow ? 66 * u : 130 * u), ty + 72 * u, 14 * u, COL.dim, { align: narrow ? 'left' : 'left' });

    const arrowY = narrow ? py : py + 10 * u;
    if (this.world > 0 && ui.button('w-prev', 20 * u, arrowY - 30 * u, 60 * u, 60 * u, { icon: ICON.left, iconScale: 0.45 })) {
      this.world--;
      app.sound.click();
    }
    if (this.world < WORLDS.length - 1 && ui.button('w-next', ui.w - 80 * u, arrowY - 30 * u, 60 * u, 60 * u, { icon: ICON.right, iconScale: 0.45 })) {
      this.world++;
      app.sound.click();
    }
    // world dots
    for (let i = 0; i < WORLDS.length; i++) {
      const dx = cx + (i - (WORLDS.length - 1) / 2) * 22 * u;
      const dy = narrow ? ty + 108 * u : ty + 112 * u;
      ui.disc(dx, dy, i === this.world ? 11 * u : 8 * u, i === this.world ? COL.accent : hex('#3a4670'));
    }

    // level tiles
    const portrait = ui.h > ui.w || ui.w < 900 * u;
    const gap = 14 * u;
    const gridW = Math.min(ui.w - 40 * u, 1060 * u);
    const startY = ty + 140 * u;
    // big 3x2 tiles when the screen is tall enough, otherwise a single row of six
    const tw3 = (gridW - gap * 2) / 3;
    const th3 = Math.min(tw3 * 0.64, 172 * u);
    const bigFits = 2 * (th3 + gap) <= ui.h - startY - 16 * u;
    const cols = portrait || bigFits ? 3 : 6;
    const rows = Math.ceil(w.levels.length / cols);
    const tw = (gridW - gap * (cols - 1)) / cols;
    const th = cols === 3 ? th3 : Math.min(tw * 1.12, 170 * u);
    const gx = (ui.w - gridW) / 2;
    const gy = portrait || cols === 3 ? startY : Math.max(startY - 10 * u, ui.h - rows * (th + gap) - 24 * u + gap);
    w.levels.forEach((lv, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gx + col * (tw + gap);
      const e = 1 - Math.pow(1 - Math.min(1, Math.max(0, this.t * 2.6 - 0.2 - i * 0.07)), 3);
      const y = gy + row * (th + gap) + (1 - e) * 26 * u;
      const rec = store.levelRecord(lv.id);
      // thumbnail + labels drawn over the invisible button
      const gold = rec && rec.stars === 3;
      ui.glass(x, y, tw, th, { radius: 20 * u, tint: rec ? [0.06, 0.11, 0.32, 0.55] : [0.04, 0.07, 0.2, 0.5], glow: gold ? hex('#ffd25e', 0.1) : undefined, edge: gold ? [1, 0.88, 0.5, 0.7] : undefined, topGlow: gold ? [1, 0.82, 0.35, 0.18] : undefined, shadowAlpha: 0.3, shadowBlur: 12 * u, shadowOffset: 5 * u, sheen: 0.07 });
      const clicked = ui.button('lv-' + lv.id, x, y, tw, th, { kind: 'ghost', radius: 20 * u });
      drawThumb(ui, lv, x + 8 * u, y + 28 * u, tw - 16 * u, th - 78 * u);
      ui.text(String(i + 1), x + 14 * u, y + 19 * u, 17 * u, COL.accent, { weight: 'heavy' });
      ui.text(lv.name, x + 36 * u, y + 17 * u, Math.min(13 * u, (tw - 40 * u) / (lv.name.length * 0.55)), COL.text);
      ui.stars(x + tw / 2, y + th - 36 * u, 16 * u, rec ? rec.stars : 0, 3);
      ui.text(rec ? `Best ${rec.best} · Par ${lv.par}` : `Par ${lv.par}`, x + tw / 2, y + th - 14 * u, 11.5 * u, COL.dim, { align: 'center' });
      if (clicked) app.playCampaign(this.world, i);
    });
    for (const k of ui.keys) {
      if (k.key === 'ArrowLeft' && this.world > 0) this.world--;
      if (k.key === 'ArrowRight' && this.world < WORLDS.length - 1) this.world++;
      if (k.key === 'Escape') app.openTitle();
    }
  }
}
