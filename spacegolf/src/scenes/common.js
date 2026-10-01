// Small layout helpers shared by menu scenes.

import { COL, ICON, hex, withAlpha } from '../ui.js';

// Standard top bar: back button + title. Returns true when back was clicked.
export function header(app, title, subtitle, opts = {}) {
  const ui = app.ui;
  const u = ui.u;
  const bh = 48 * u;
  let back = false;
  if (!opts.noBack && ui.button('hdr-back', 16 * u, 16 * u, bh, bh, { icon: ICON.left, iconScale: 0.46 })) {
    app.sound.back();
    back = true;
  }
  const x = opts.noBack ? 24 * u : 16 * u + bh + 16 * u;
  ui.text(title, x, 16 * u + bh * (subtitle ? 0.36 : 0.5), 26 * u, COL.text, { shadow: true, weight: 'heavy' });
  if (subtitle) ui.text(subtitle, x, 16 * u + bh * 0.84, 13 * u, COL.dim, { weight: 'light' });
  return back;
}

export function escPressed(ui) {
  return ui.keys.some((k) => k.key === 'Escape' || k.key === 'Backspace');
}

const LOOK_COLORS = {
  moon: [0.72, 0.72, 0.78], earth: [0.2, 0.52, 0.92], desert: [0.92, 0.6, 0.3], lava: [0.95, 0.32, 0.12],
  ice: [0.72, 0.92, 1.0], goo: [0.4, 0.9, 0.3], jelly: [1.0, 0.45, 0.72], gas: [0.86, 0.66, 0.46],
};
export const lookColor = (look) => LOOK_COLORS[look] || LOOK_COLORS.moon;

// A tiny schematic of a level (used on level tiles): shaded mini planets.
export function drawThumb(ui, level, x, y, w, h, alpha = 1) {
  const b = level.bounds || { w: 1600, h: 900 };
  const s = Math.min(w / b.w, h / b.h);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const P = (px, py) => [cx + px * s, cy + py * s];
  for (const z of level.winds || []) {
    const [px, py] = P(z.x, z.y);
    ui.disc(px, py, z.r * 2 * s, [0.5, 0.8, 1, 0.1 * alpha], 1, [0.6, 0.85, 1, 0.3 * alpha]);
  }
  for (const p of level.portals || []) {
    for (const e of [p.a, p.b]) {
      const [px, py] = P(e.x, e.y);
      ui.disc(px, py, Math.max(5, 40 * s), [0.05, 0.03, 0.15, alpha], 1.6, [0.7, 0.6, 1, alpha]);
    }
  }
  for (const body of level.bodies) {
    const [px, py] = P(body.x, body.y);
    const d = Math.max(4, body.r * 2 * s);
    if (body.type === 'blackhole') {
      ui.disc(px, py, d * 2.4, [0.95, 0.6, 0.9, 0.0], 1.4, [0.95, 0.65, 1, 0.8 * alpha]);
      ui.disc(px, py, d * 1.1, [0, 0, 0, alpha]);
      continue;
    }
    let c;
    let halo = 0;
    if (body.type === 'sun') { c = [1, 0.8, 0.3]; halo = 1; }
    else if (body.type === 'repulsor') { c = [0.2, 0.85, 1]; halo = 1; }
    else c = lookColor(body.look);
    ui.sphere(px, py, d, [c[0], c[1], c[2], alpha], halo);
  }
  for (const st of level.stars || []) {
    const [px, py] = P(st.x, st.y);
    ui.icon(13, px, py, Math.max(7, 52 * s), [1, 0.85, 0.35, alpha]);
  }
  const h0 = level.hole;
  if (h0) {
    let hx = h0.x;
    let hy = h0.y;
    if (typeof h0.body === 'number') {
      const bd = level.bodies[h0.body];
      hx = bd.x + Math.cos(h0.angle) * bd.r;
      hy = bd.y + Math.sin(h0.angle) * bd.r;
    }
    const [px, py] = P(hx, hy);
    ui.disc(px, py, Math.max(5, 46 * s), [0.02, 0.02, 0.05, alpha], 1.6, [1, 0.88, 0.45, alpha]);
  }
  const t0 = level.tee;
  if (t0 && level.bodies[t0.body]) {
    const bd = level.bodies[t0.body];
    const [px, py] = P(bd.x + Math.cos(t0.angle) * (bd.r + 6), bd.y + Math.sin(t0.angle) * (bd.r + 6));
    ui.disc(px, py, Math.max(4, 24 * s), [1, 1, 1, alpha]);
  }
}
