import type { Collection } from '../core/types.ts';
import { C, Vox } from './builder.ts';

const D = 'easy' as const;

function mug() {
  const v = new Vox(6, 5, 4, { r: C.red, c: C.brown, w: C.white });
  v.box(0, 0, 0, 3, 4, 3, 'r');
  v.box(1, 1, 1, 2, 4, 2, null);
  v.box(1, 3, 1, 2, 3, 2, 'c');
  v.box(0, 2, 0, 3, 2, 3, 'w');
  v.box(4, 1, 1, 5, 3, 2, 'r');
  v.box(4, 2, 1, 4, 2, 2, null);
  return v.puzzle('k-mug', 'Mug', D);
}

function teapot() {
  const v = new Vox(8, 6, 5, { b: C.teal, l: C.sky, g: C.gold });
  v.ellipsoid(3.5, 1.6, 2, 2.6, 1.9, 2.1, 'b');
  v.box(2, 4, 1, 5, 4, 3, 'l');
  v.box(3, 5, 2, 4, 5, 2, 'g');
  v.set(6, 2, 2, 'b').set(7, 3, 2, 'b');
  v.set(7, 4, 2, 'b');
  v.box(0, 1, 2, 0, 3, 2, 'b');
  return v.puzzle('k-teapot', 'Teapot', D);
}

function pan() {
  const v = new Vox(9, 2, 5, { k: C.black, g: C.darkgrey, w: C.wood });
  v.cylY(2, 2, 2.3, 0, 0, 'g');
  v.cylY(2, 2, 2.3, 1, 1, 'k');
  v.cylY(2, 2, 1.3, 1, 1, null);
  v.box(5, 1, 2, 8, 1, 2, 'w');
  return v.puzzle('k-pan', 'Frying Pan', D);
}

function cheese() {
  const v = new Vox(6, 3, 5, { y: C.yellow, o: C.gold });
  v.fill('y', (x, _y, z) => x <= 5 - z);
  v.set(1, 1, 4, null).set(3, 2, 1, null).set(5, 1, 0, null).set(0, 2, 1, null).set(2, 0, 2, null);
  v.paint('o', (x, _y, z) => x === 5 - z);
  return v.puzzle('k-cheese', 'Cheese Wedge', D);
}

function goblet() {
  const v = new Vox(5, 7, 5, { s: C.sky, w: C.darkred });
  v.lathe(2, 2, [2, 0.5, 0.5, 1.5, -2.3, -2.3, -2.3], 's');
  v.box(1, 4, 1, 3, 4, 3, 'w');
  v.set(2, 5, 2, 'w');
  return v.puzzle('k-goblet', 'Goblet', D);
}

function bottle() {
  const v = new Vox(3, 7, 3, { g: C.darkgreen, w: C.cream, r: C.red });
  v.box(0, 0, 0, 2, 3, 2, 'g');
  v.box(0, 2, 0, 2, 2, 2, 'w');
  v.box(1, 4, 1, 1, 5, 1, 'g');
  v.set(1, 6, 1, 'r');
  return v.puzzle('k-bottle', 'Bottle', D);
}

function bowl() {
  const v = new Vox(7, 4, 7, { b: C.blue, s: C.sky, o: C.orange, g: C.green, r: C.red });
  v.lathe(3, 3, [1.5, -2.5, -3.2, -3.3], ['s', 'b', 'b', 's']);
  v.set(2, 1, 3, 'o').set(4, 1, 3, 'g').set(3, 1, 2, 'r').set(3, 2, 3, 'o');
  return v.puzzle('k-bowl', 'Fruit Bowl', D);
}

function toaster() {
  const v = new Vox(6, 6, 5, { s: C.grey, k: C.black, b: C.tan });
  v.box(0, 0, 0, 5, 3, 4, 's');
  v.box(1, 3, 1, 4, 5, 1, 'b');
  v.box(1, 3, 3, 4, 5, 3, 'b');
  v.set(1, 5, 1, null).set(4, 5, 1, null).set(1, 5, 3, null).set(4, 5, 3, null);
  v.set(5, 2, 4, 'k');
  v.set(0, 0, 0, 'k').set(5, 0, 0, 'k').set(0, 0, 4, 'k').set(5, 0, 4, 'k');
  return v.puzzle('k-toaster', 'Toaster', D);
}

export const kitchen: Collection = {
  id: 'kitchen',
  name: 'Kitchen',
  blurb: 'Everyday things from the cupboard.',
  difficulty: 'easy',
  tint: ['#ffe3e0', '#ffb7b0'],
  icon: 'cup',
  puzzles: [bottle(), mug(), cheese(), pan(), goblet(), toaster(), bowl(), teapot()],
};
