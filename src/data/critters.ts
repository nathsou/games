import type { Collection } from '../core/types.ts';
import { C, Vox } from './builder.ts';

const D = 'medium' as const;

function duck() {
  const v = new Vox(8, 6, 5, { y: C.yellow, o: C.orange, k: C.black });
  v.ellipsoid(3, 1.4, 2, 3.1, 1.5, 2.1, 'y');
  v.ellipsoid(5, 4, 2, 1.3, 1.3, 1.3, 'y');
  v.set(6, 3, 2, 'y');
  v.set(7, 4, 2, 'o').set(7, 3, 2, 'o');
  v.set(5, 4, 0, 'k').set(5, 4, 4, 'k');
  v.set(0, 3, 2, 'y').set(0, 2, 2, 'y');
  return v.puzzle('c-duck', 'Duck', D);
}

function fish() {
  const v = new Vox(9, 5, 3, { b: C.sky, d: C.blue, w: C.white, k: C.black, f: C.orange });
  v.ellipsoid(3.5, 2, 1, 3.3, 1.9, 1.2, 'b');
  v.paint('d', (x) => x === 3 || x === 5);
  v.front(['f.', 'ff', '.f', 'ff', 'f.'], 1, 1, 7, 4);
  v.set(1, 3, 0, 'k').set(1, 3, 2, 'k');
  v.set(3, 4, 1, 'f').set(4, 4, 1, 'f');
  return v.puzzle('c-fish', 'Fish', D);
}

function snail() {
  const v = new Vox(8, 6, 4, { s: C.wood, d: C.brown, b: C.lime, k: C.black });
  v.box(0, 0, 1, 7, 0, 2, 'b');
  v.box(6, 1, 1, 7, 2, 2, 'b');
  v.set(7, 3, 1, 'k').set(7, 3, 2, 'k');
  v.cylZ(3, 3, 2.3, 0, 3, 's');
  v.paint('d', (x, y) => {
    const a = Math.atan2(y - 3, x - 3);
    const r = Math.hypot(x - 3, y - 3);
    return Math.abs(((r - a / Math.PI) % 2) - 1) < 0.35;
  });
  return v.puzzle('c-snail', 'Snail', D);
}

function cat() {
  const v = new Vox(5, 8, 5, { o: C.orange, w: C.white, p: C.pink, k: C.black });
  v.ellipsoid(2, 1.8, 2, 2.1, 2, 2.1, 'o');
  v.ellipsoid(2, 5, 2.5, 1.6, 1.4, 1.5, 'o');
  v.set(1, 7, 2, 'o').set(3, 7, 2, 'o').set(1, 6, 2, 'o').set(3, 6, 2, 'o');
  v.set(1, 5, 4, 'k').set(3, 5, 4, 'k').set(2, 4, 4, 'p');
  v.box(1, 1, 4, 3, 2, 4, 'w');
  v.set(4, 0, 4, 'o').set(4, 1, 4, 'o');
  return v.puzzle('c-cat', 'Cat', D);
}

function turtle() {
  const v = new Vox(7, 4, 9, { g: C.darkgreen, l: C.green, s: C.lime });
  v.fill('g', (x, y, z) => y >= 1 && ((x - 3) / 3.2) ** 2 + ((y - 0.6) / 2.6) ** 2 + ((z - 4) / 3.4) ** 2 <= 1);
  v.paint('l', (x, y, z) => (x + y + z) % 3 === 0);
  v.box(3, 1, 8, 3, 2, 8, 's');
  v.set(1, 0, 2, 's').set(5, 0, 2, 's').set(1, 0, 6, 's').set(5, 0, 6, 's');
  v.set(3, 1, 0, 's');
  return v.puzzle('c-turtle', 'Turtle', D);
}

function penguin() {
  const v = new Vox(5, 7, 5, { k: C.black, w: C.white, o: C.orange });
  v.ellipsoid(2, 3, 2, 2.2, 3.2, 2.1, 'k');
  v.paint('w', (x, y, z) => z >= 3 && Math.abs(x - 2) <= 1 && y >= 1 && y <= 4);
  v.set(2, 5, 4, 'o').set(1, 0, 3, 'o').set(3, 0, 3, 'o');
  v.set(1, 5, 4, null).set(3, 5, 4, null);
  return v.puzzle('c-penguin', 'Penguin', D);
}

function frog() {
  const v = new Vox(7, 4, 6, { g: C.green, l: C.lime, w: C.white, k: C.black, r: C.red });
  v.ellipsoid(3, 1, 2.5, 3.2, 1.8, 2.6, 'g');
  v.paint('l', (_x, y) => y === 0);
  v.set(1, 3, 3, 'w').set(5, 3, 3, 'w').set(1, 3, 4, 'k').set(5, 3, 4, 'k');
  v.box(2, 1, 5, 4, 1, 5, 'r');
  v.set(0, 0, 5, 'g').set(6, 0, 5, 'g').set(0, 0, 0, 'g').set(6, 0, 0, 'g');
  return v.puzzle('c-frog', 'Frog', D);
}

function pig() {
  const v = new Vox(8, 5, 5, { p: C.pink, d: C.red, k: C.black });
  v.ellipsoid(3, 2.4, 2, 3.2, 1.7, 2.1, 'p');
  v.set(1, 0, 1, 'p').set(5, 0, 1, 'p').set(1, 0, 3, 'p').set(5, 0, 3, 'p');
  v.box(7, 2, 1, 7, 3, 3, 'p');
  v.set(7, 2, 2, 'd').set(7, 3, 2, 'd');
  v.set(5, 4, 1, 'd').set(5, 4, 3, 'd');
  v.set(6, 3, 0, 'k').set(6, 3, 4, 'k');
  v.set(0, 3, 2, 'd');
  return v.puzzle('c-pig', 'Pig', D);
}

export const critters: Collection = {
  id: 'critters',
  name: 'Critters',
  blurb: 'Friendly creatures, great and small.',
  difficulty: 'medium',
  tint: ['#fff1c4', '#ffd66e'],
  icon: 'paw',
  puzzles: [fish(), duck(), penguin(), cat(), snail(), frog(), pig(), turtle()],
};
