// Shared drawing of a level's contents (used by the game, the editor and thumbnails).

import { T, LOOK_ID } from './renderer.js';
import { CAPTURE_R, PORTAL_R, STAR_R, ensureBodies } from './physics.js';

export const PORTAL_COLORS = [
  [[0.35, 0.8, 1.0], [1.0, 0.45, 0.95]],
  [[0.5, 1.0, 0.55], [1.0, 0.75, 0.3]],
  [[0.7, 0.55, 1.0], [0.4, 1.0, 0.9]],
];

export function drawBody(r, w, i) {
  const b = w.bodies[i];
  const x = w.px[i];
  const y = w.py[i];
  const R = w.R[i];
  const seed = b.seed || i * 7 + 3;
  switch (b.type) {
    case 'sun':
      r.sprite(false, T.SUN, x, y, R * 3.8, R, seed, 0, 0, 1, 1, 1, 1);
      break;
    case 'blackhole':
      r.sprite(false, T.BLACKHOLE, x, y, R * 4.2, R, seed, 0, 0, 1, 1, 1, 1);
      r.lens(x, y, R * 1.7);
      break;
    case 'repulsor':
      r.sprite(false, T.REPULSOR, x, y, R * 3.6, R, seed, 0, 0, 1, 1, 1, 1);
      break;
    default: {
      const atmo = b.atmo || 0;
      const ext = R + Math.max(atmo, R * 0.14) + 6;
      r.sprite(false, T.PLANET, x, y, ext, R, seed, LOOK_ID[b.look] ?? 0, atmo, 1, 1, 1, 1);
    }
  }
}

// Draws everything static-ish about the level at physics time t.
// opts: { S, showHole, time }
export function drawLevel(r, w, t, opts = {}) {
  ensureBodies(w, t);
  for (const z of w.winds) {
    r.sprite(false, T.WIND, z.x, z.y, z.r * 1.04, z.r, z.x * 0.01, z.ax, z.ay, 1, 1, 1, 1);
  }
  w.portals.forEach((p, k) => {
    const pal = PORTAL_COLORS[k % PORTAL_COLORS.length];
    r.sprite(false, T.WORMHOLE, p.a.x, p.a.y, PORTAL_R * 2.6, PORTAL_R * 1.15, k, 0, 0, pal[0][0], pal[0][1], pal[0][2], 1);
    r.sprite(false, T.WORMHOLE, p.b.x, p.b.y, PORTAL_R * 2.6, PORTAL_R * 1.15, k, 0, 0, pal[1][0], pal[1][1], pal[1][2], 1);
  });
  for (let i = 0; i < w.n; i++) drawBody(r, w, i);
  const S = opts.S;
  w.stars.forEach((s, i) => {
    const got = S ? S.stars[i] : 0;
    if (!got) r.sprite(false, T.STAR, s.x, s.y, STAR_R * 2.6, STAR_R, i * 3.7, 0, 0, 1, 1, 1, 1);
  });
  if (w.hole && opts.showHole !== false) {
    r.sprite(false, T.HOLE, w.hx, w.hy, CAPTURE_R * 4, CAPTURE_R * 0.8, 0, 0.0, 0, 1, 1, 1, 1);
    r.sprite(false, T.FLAG, w.hx, w.hy, 62, 38, 0, w.hnx, w.hny, 1, 1, 1, 1);
  }
}

export function fieldBodies(w) {
  const out = [];
  for (let i = 0; i < w.n; i++) out.push({ x: w.px[i], y: w.py[i], mu: w.mu[i], eps2: w.eps2[i] });
  return out;
}
