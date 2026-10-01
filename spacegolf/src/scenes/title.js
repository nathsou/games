import { COL, ICON, hex, withAlpha } from '../ui.js';

export class TitleScene {
  constructor(app) {
    this.app = app;
    this.t = 0;
  }

  frame(dt) {
    const app = this.app;
    const ui = app.ui;
    const u = ui.u;
    this.t += dt;
    app.backdrop(0, 0.04);

    const cx = ui.w / 2;
    const base = Math.min(100 * u, ui.w * 0.115);
    const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
    const intro = ease(this.t * 1.6);
    const ty = Math.max(base * 0.95, ui.h * 0.2) + (1 - intro) * -16 * u;

    // wordmark: heavy "SPACE" + light, glowing "GOLF"
    const sp = 0.09;
    const wSpace = ui.measure('SPACE', base, sp, 'heavy');
    const wGolf = ui.measure('GOLF', base, sp, 'light');
    const gap = base * 0.28;
    const x0 = cx - (wSpace + gap + wGolf) / 2;
    ui.glow(cx, ty, (wSpace + wGolf) * 1.5, base * 3.2, withAlpha(hex('#3d7bff'), 0.3 * intro), 2.2);
    ui.text('SPACE', x0, ty, base, withAlpha(COL.text, intro), { weight: 'heavy', spacing: sp, color2: withAlpha(hex('#b9dcff'), intro), shadow: true });
    ui.text('GOLF', x0 + wSpace + gap, ty, base, withAlpha(hex('#7fe9ff'), intro), { weight: 'light', spacing: sp, color2: withAlpha(hex('#9b8cff'), intro), shadow: true });
    const tag = 'A GOLF GAME IN SPACE';
    const tsz = Math.max(11 * u, base * 0.15);
    const tw = ui.measure(tag, tsz, 0.5, 'medium');
    ui.text(tag, cx, ty + base * 0.74, tsz, withAlpha(COL.dim, intro), { align: 'center', spacing: 0.5, weight: 'medium' });
    const lw = Math.min(90 * u, (ui.w - tw) / 4 - 10 * u);
    if (lw > 10) {
      ui.rect(cx - tw / 2 - 22 * u - lw, ty + base * 0.74 - 0.5, lw, 1, { fill: [0.6, 0.8, 1, 0.35 * intro], radius: 0 });
      ui.rect(cx + tw / 2 + 22 * u, ty + base * 0.74 - 0.5, lw, 1, { fill: [0.6, 0.8, 1, 0.35 * intro], radius: 0 });
    }

    const bw = Math.min(344 * u, ui.w - 40);
    const bh = 60 * u;
    const gapB = 14 * u;
    const total = bh * 4 + gapB * 3;
    let y = Math.max(ty + base * 1.45, (ui.h - total) / 2 + base * 0.5);
    y = Math.min(y, ui.h - total - 56 * u);
    const x = cx - bw / 2;
    const items = [
      ['t-camp', 'Campaign', ICON.play, 'primary', () => app.openCampaign()],
      ['t-end', 'Endless', ICON.dice, 'normal', () => app.openEndless()],
      ['t-create', 'Create', ICON.pencil, 'normal', () => app.openCreate()],
      ['t-set', 'Settings', ICON.menu, 'normal', () => app.openSettings()],
    ];
    items.forEach(([id, label, icon, kind, fn], i) => {
      const e = ease(this.t * 1.7 - 0.25 - i * 0.12);
      const yy = y + i * (bh + gapB) + (1 - e) * 26 * u;
      if (e > 0.02 && ui.button(id, x, yy, bw, bh, { label, icon, size: 19, kind })) fn();
    });

    const stars = app.store.totalStars();
    const chipW = 130 * u;
    ui.glass(cx - chipW / 2, ui.h - 52 * u, chipW, 34 * u, { radius: 17 * u, shadowAlpha: 0.25, shadowBlur: 8 * u, shadowOffset: 3 * u });
    ui.icon(ICON.star, cx - chipW / 2 + 26 * u, ui.h - 35 * u, 17 * u, COL.gold);
    ui.text(`${stars} collected`, cx - chipW / 2 + 42 * u, ui.h - 35 * u, 13 * u, COL.dim, { weight: 'medium' });
  }
}
