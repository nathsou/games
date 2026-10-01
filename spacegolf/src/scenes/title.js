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
    app.backdrop(0, 0.12);

    const cx = ui.w / 2;
    const titleSize = Math.min(96 * u, ui.w * 0.13);
    const ty = Math.max(titleSize * 0.9, ui.h * 0.2);
    ui.glow(cx, ty, titleSize * 8, titleSize * 2.6, withAlpha(hex('#4c8cff'), 0.28), 2);
    ui.text('SPACEGOLF', cx, ty, titleSize, COL.text, { align: 'center', spacing: 0.1, shadow: true, color2: hex('#7fd9ff') });
    ui.text('A GOLF GAME IN SPACE', cx, ty + titleSize * 0.72, Math.max(11, titleSize * 0.17), COL.dim, { align: 'center', spacing: 0.4 });

    const bw = Math.min(330 * u, ui.w - 40);
    const bh = 58 * u;
    const gap = 14 * u;
    const total = bh * 4 + gap * 3;
    let y = Math.max(ty + titleSize * 1.3, (ui.h - total) / 2 + titleSize * 0.5);
    y = Math.min(y, ui.h - total - 40 * u);
    const x = cx - bw / 2;
    if (ui.button('t-camp', x, y, bw, bh, { label: 'Campaign', icon: ICON.play, size: 21, kind: 'primary' })) app.openCampaign();
    y += bh + gap;
    if (ui.button('t-end', x, y, bw, bh, { label: 'Endless', icon: ICON.dice, size: 20 })) app.openEndless();
    y += bh + gap;
    if (ui.button('t-create', x, y, bw, bh, { label: 'Create', icon: ICON.pencil, size: 20 })) app.openCreate();
    y += bh + gap;
    if (ui.button('t-set', x, y, bw, bh, { label: 'Settings', icon: ICON.menu, size: 20 })) app.openSettings();

    const stars = app.store.totalStars();
    ui.text(`★ ${stars}  collected`, cx, ui.h - 26 * u, 14 * u, COL.dim, { align: 'center' });
  }
}
