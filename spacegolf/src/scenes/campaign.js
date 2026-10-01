import { WORLDS } from '../campaign.js';
import { T, LOOK_ID } from '../renderer.js';
import { COL, ICON, hex, withAlpha } from '../ui.js';
import { header, drawThumb } from './common.js';

export class CampaignScene {
  constructor(app, opts = {}) {
    this.app = app;
    this.world = opts.world ?? this.firstUnfinishedWorld();
    this.slide = 0;
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
    const cols = ui.w < 640 * u ? 3 : 6;
    const rows = Math.ceil(w.levels.length / cols);
    const gap = 14 * u;
    const gridW = Math.min(ui.w - 40 * u, 1060 * u);
    const tw = (gridW - gap * (cols - 1)) / cols;
    const th = Math.min(tw * 1.12, 170 * u);
    const gx = (ui.w - gridW) / 2;
    const gy = Math.max(narrow ? ty + 130 * u : ty + 130 * u, ui.h - rows * (th + gap) - 24 * u + gap);
    w.levels.forEach((lv, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gx + col * (tw + gap);
      const y = gy + row * (th + gap);
      const rec = store.levelRecord(lv.id);
      const clicked = ui.button('lv-' + lv.id, x, y, tw, th, { fill: null });
      // thumbnail + labels drawn over the invisible button
      ui.rect(x, y, tw, th, { fill: rec ? hex('#12204a', 0.82) : hex('#0d1636', 0.8), border: 1.5, borderColor: rec && rec.stars === 3 ? hex('#ffd25e', 0.7) : COL.panelEdge, radius: 16 * u, glow: rec && rec.stars === 3 ? hex('#ffd25e', 0.1) : undefined });
      drawThumb(ui, lv, x + 8 * u, y + 28 * u, tw - 16 * u, th - 78 * u);
      ui.text(String(i + 1), x + 12 * u, y + 17 * u, 17 * u, COL.accent);
      ui.text(lv.name, x + 32 * u, y + 17 * u, Math.min(13 * u, (tw - 40 * u) / (lv.name.length * 0.55)), COL.text);
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
