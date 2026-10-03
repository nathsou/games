import { rng } from '../core/rng.ts';
import type { PuzzleDef } from '../core/types.ts';
import { Vox } from './builder.ts';

const PALETTES: string[][] = [
  ['#5b8def', '#7cc4f2', '#bfe3ff'],
  ['#e5534b', '#f28b30', '#f5c542'],
  ['#2f7d4a', '#5cb85c', '#a4d65e'],
  ['#8e6bd6', '#b494f0', '#f28bb3'],
  ['#3bb3a4', '#7fd6c4', '#f3e7c9'],
  ['#c8643c', '#dcb383', '#f3e7c9'],
];

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * A seeded "sculpture": a union of random blobs, colored in horizontal bands.
 * Uniqueness is checked by the caller (who retries with the next variant).
 */
export function randomSculpture(seed: string, variant = 0): PuzzleDef {
  const r = rng(`${seed}#${variant}`);
  const W = 5 + Math.floor(r() * 3);
  const H = 5 + Math.floor(r() * 3);
  const D = 5 + Math.floor(r() * 3);
  const pal = PALETTES[Math.floor(r() * PALETTES.length)];
  const v = new Vox(W, H, D, { a: pal[0], b: pal[1], c: pal[2] });
  const blobs = 3 + Math.floor(r() * 3);
  let cx = W / 2 - 0.5;
  let cy = 1.5;
  let cz = D / 2 - 0.5;
  for (let k = 0; k < blobs; k++) {
    const rad = 1.2 + r() * 1.4;
    v.ellipsoid(cx, cy, cz, rad * (0.8 + r() * 0.5), rad, rad * (0.8 + r() * 0.5), 'a');
    // walk to the next blob so shapes stay connected
    cx = Math.min(W - 1.5, Math.max(0.5, cx + (r() - 0.5) * 3));
    cy = Math.min(H - 1.5, Math.max(0.5, cy + r() * 1.8));
    cz = Math.min(D - 1.5, Math.max(0.5, cz + (r() - 0.5) * 3));
  }
  v.paint('b', (_x, y) => y >= Math.floor(H / 3));
  v.paint('c', (_x, y) => y >= Math.floor((2 * H) / 3));
  const p = v.puzzle(`daily-${seed}-${variant}`, 'Daily Sculpture', 'medium');
  return p;
}
