import type { Collection } from '../core/types.ts';
import { C, Vox } from './builder.ts';

const D = 'medium' as const;

function mushroom() {
  const v = new Vox(7, 6, 7, { w: C.cream, r: C.red, d: C.white });
  v.cylY(3, 3, 1, 0, 2, 'w');
  v.fill('r', (x, y, z) => y >= 3 && ((x - 3) / 3.4) ** 2 + ((y - 2.6) / 3) ** 2 + ((z - 3) / 3.4) ** 2 <= 1);
  v.paint('d', (x, y, z) => y >= 3 && v.surface(x, y, z) && (x * 3 + y * 5 + z * 7) % 6 === 0);
  return v.puzzle('g-mushroom', 'Mushroom', D);
}

function tulip() {
  const v = new Vox(5, 8, 5, { g: C.green, l: C.darkgreen, r: C.red, p: C.pink });
  v.box(2, 0, 2, 2, 4, 2, 'g');
  v.set(1, 1, 2, 'l').set(0, 2, 2, 'l').set(3, 2, 2, 'l').set(4, 3, 2, 'l');
  v.lathe(2, 2, [1, 1.5, -2.1], ['r', 'r', 'r'], 4);
  v.set(2, 7, 0, 'p').set(2, 7, 4, 'p').set(0, 7, 2, 'p').set(4, 7, 2, 'p');
  return v.puzzle('g-tulip', 'Tulip', D);
}

function tree() {
  const v = new Vox(7, 8, 7, { b: C.brown, g: C.green, a: C.red });
  v.box(3, 0, 3, 3, 3, 3, 'b');
  v.set(2, 0, 3, 'b').set(4, 0, 3, 'b').set(3, 0, 2, 'b').set(3, 0, 4, 'b');
  v.sphere(3, 5, 3, 2.6, 'g');
  v.paint('a', (x, y, z) => y >= 4 && v.surface(x, y, z) && (x * 5 + y * 3 + z * 2) % 9 === 0);
  return v.puzzle('g-tree', 'Apple Tree', D);
}

function cactus() {
  const v = new Vox(7, 8, 3, { g: C.green, p: C.terracotta, f: C.pink, s: C.brown });
  v.front(['...f...', '...g...', '.g.g...', '.g.g.g.', '.ggg.g.', '...ggg.', '...g...'], 1, 1, 0, 7);
  v.box(3, 2, 0, 3, 6, 2, 'g');
  v.box(2, 0, 0, 4, 1, 2, 'p');
  v.set(3, 1, 1, 's');
  return v.puzzle('g-cactus', 'Cactus', D);
}

function sprout() {
  const v = new Vox(5, 7, 5, { p: C.terracotta, s: C.brown, g: C.green, y: C.yellow });
  v.lathe(2, 2, [1.5, 1.5, -2.2, -2.2], 'p');
  v.lathe(2, 2, [1.5], 's', 3);
  v.box(2, 4, 2, 2, 5, 2, 'g');
  v.set(1, 5, 2, 'g').set(0, 6, 2, 'g').set(3, 5, 2, 'g').set(4, 6, 2, 'g');
  v.set(2, 6, 2, 'y');
  return v.puzzle('g-sprout', 'Potted Sprout', D);
}

function carrot() {
  const v = new Vox(5, 9, 5, { o: C.orange, g: C.green });
  v.lathe(2, 2, [0.5, 0.5, 1, 1, 1.5, 1.5, 2.1], 'o');
  v.set(2, 7, 2, 'g').set(2, 8, 2, 'g').set(1, 8, 2, 'g').set(3, 8, 2, 'g').set(2, 8, 1, 'g').set(2, 8, 3, 'g');
  return v.puzzle('g-carrot', 'Carrot', D);
}

function apple() {
  const v = new Vox(7, 7, 7, { r: C.red, d: C.darkred, b: C.brown, g: C.green });
  v.sphere(3, 2.8, 3, 2.9, 'r');
  v.set(3, 5, 3, null);
  v.box(3, 5, 3, 3, 6, 3, 'b');
  v.set(4, 6, 3, 'g').set(5, 6, 3, 'g');
  v.paint('d', (x, y, z) => y <= 1 && (x + z) % 2 === 0);
  return v.puzzle('g-apple', 'Apple', D);
}

function pumpkin() {
  const v = new Vox(7, 6, 7, { o: C.orange, d: C.terracotta, g: C.darkgreen });
  v.ellipsoid(3, 2, 3, 3.4, 2.3, 3.4, 'o');
  v.paint('d', (x, _y, z) => x === 3 || z === 3);
  v.box(3, 5, 3, 3, 5, 3, 'g');
  v.set(4, 5, 3, 'g');
  return v.puzzle('g-pumpkin', 'Pumpkin', D);
}

function wateringCan() {
  const v = new Vox(8, 6, 5, { b: C.blue, g: C.grey, n: C.navy });
  v.box(1, 0, 1, 4, 3, 3, 'b');
  v.box(1, 4, 2, 1, 5, 2, 'n').box(2, 5, 2, 3, 5, 2, 'n').set(4, 4, 2, 'n');
  v.set(5, 1, 2, 'b').set(6, 2, 2, 'b').set(7, 3, 2, 'g');
  v.set(7, 4, 2, 'g').set(7, 3, 1, 'g').set(7, 3, 3, 'g');
  return v.puzzle('g-can', 'Watering Can', D);
}

export const garden: Collection = {
  id: 'garden',
  name: 'Garden',
  blurb: 'Things that grow, and things that help.',
  difficulty: 'medium',
  tint: ['#dff5d0', '#a6dd8f'],
  icon: 'leaf',
  puzzles: [carrot(), tulip(), sprout(), apple(), cactus(), mushroom(), pumpkin(), wateringCan(), tree()],
};
