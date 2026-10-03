import type { Collection } from '../core/types.ts';
import { C, Vox } from './builder.ts';

const D = 'medium' as const;

function robot() {
  const v = new Vox(7, 9, 3, { g: C.grey, d: C.darkgrey, b: C.sky, r: C.red, y: C.yellow });
  v.box(2, 0, 1, 2, 2, 1, 'd').box(4, 0, 1, 4, 2, 1, 'd');
  v.box(1, 3, 0, 5, 5, 2, 'g');
  v.set(3, 4, 2, 'r').set(2, 4, 2, 'y').set(4, 4, 2, 'y');
  v.box(0, 3, 1, 0, 5, 1, 'd').box(6, 3, 1, 6, 5, 1, 'd');
  v.box(2, 6, 0, 4, 7, 2, 'g');
  v.set(2, 7, 2, 'b').set(4, 7, 2, 'b');
  v.set(3, 8, 1, 'r');
  return v.puzzle('t-robot', 'Robot', D);
}

function car() {
  const v = new Vox(8, 4, 5, { r: C.red, b: C.sky, k: C.black, y: C.yellow, g: C.grey });
  v.box(0, 1, 0, 7, 1, 4, 'r');
  v.box(2, 2, 0, 5, 3, 4, 'r');
  v.box(2, 2, 0, 5, 2, 4, 'b');
  v.box(3, 2, 1, 4, 2, 3, 'r');
  v.box(2, 2, 1, 2, 2, 3, 'b');
  v.box(5, 2, 1, 5, 2, 3, 'b');
  v.set(1, 0, 0, 'k').set(6, 0, 0, 'k').set(1, 0, 4, 'k').set(6, 0, 4, 'k');
  v.set(7, 1, 0, 'y').set(7, 1, 4, 'y');
  v.set(0, 1, 2, 'g');
  return v.puzzle('t-car', 'Car', D);
}

function train() {
  const v = new Vox(9, 7, 4, { g: C.green, k: C.black, r: C.red, y: C.gold, b: C.sky });
  v.box(0, 1, 0, 8, 1, 3, 'k');
  v.cylX(3, 1.5, 1.6, 3, 8, 'g');
  v.box(0, 2, 0, 2, 5, 3, 'g');
  v.box(0, 6, 0, 2, 6, 3, 'r');
  v.box(1, 4, 0, 1, 4, 3, 'b');
  v.box(1, 4, 1, 1, 4, 2, 'g');
  v.box(7, 5, 1, 7, 6, 2, 'k');
  v.set(5, 5, 1, 'y');
  v.set(1, 0, 0, 'r').set(4, 0, 0, 'r').set(7, 0, 0, 'r').set(1, 0, 3, 'r').set(4, 0, 3, 'r').set(7, 0, 3, 'r');
  return v.puzzle('t-train', 'Steam Engine', D);
}

function sailboat() {
  const v = new Vox(8, 8, 3, { w: C.white, r: C.red, b: C.brown, n: C.navy });
  v.front(['.bbbbbb.', '..bbbb..'], 0, 2, 0, 1);
  v.box(1, 1, 1, 6, 1, 1, 'n');
  v.box(4, 2, 1, 4, 7, 1, 'b');
  v.front(['...w', '..ww', '.www', 'wwww', 'www.'], 1, 1, 0, 6);
  v.front(['r.', 'rr', 'rr', 'r.'], 1, 1, 5, 7);
  return v.puzzle('t-sailboat', 'Sailboat', D);
}

function airplane() {
  const v = new Vox(9, 4, 9, { w: C.white, r: C.red, b: C.sky, g: C.grey });
  v.box(4, 1, 0, 4, 2, 8, 'w');
  v.set(4, 2, 8, 'r').set(4, 1, 8, 'g');
  v.box(0, 1, 4, 8, 1, 5, 'r');
  v.box(2, 1, 0, 6, 1, 0, 'r');
  v.box(4, 3, 0, 4, 3, 1, 'r');
  v.set(4, 2, 6, 'b').set(4, 2, 7, 'b');
  v.set(4, 0, 5, 'g');
  return v.puzzle('t-airplane', 'Airplane', D);
}

function top() {
  const v = new Vox(7, 7, 7, { r: C.red, y: C.yellow, b: C.blue });
  v.lathe(3, 3, [0.5, 1, 1.5, 2.3, 3.2, 2.3, 1], ['b', 'r', 'y', 'r', 'y', 'r', 'b']);
  return v.puzzle('t-top', 'Spinning Top', D);
}

function die() {
  const v = new Vox(5, 5, 5, { w: C.white, r: C.red });
  v.box(0, 0, 0, 4, 4, 4, 'w');
  const pip = (a: number, b: number) => a * 5 + b;
  const faces: Record<number, number[]> = {
    1: [pip(2, 2)],
    2: [pip(1, 1), pip(3, 3)],
    3: [pip(1, 1), pip(2, 2), pip(3, 3)],
    4: [pip(1, 1), pip(1, 3), pip(3, 1), pip(3, 3)],
    5: [pip(1, 1), pip(1, 3), pip(3, 1), pip(3, 3), pip(2, 2)],
    6: [pip(1, 1), pip(1, 3), pip(3, 1), pip(3, 3), pip(2, 1), pip(2, 3)],
  };
  const dent = (n: number, at: (a: number, b: number) => void) => faces[n].forEach((p) => at(Math.floor(p / 5), p % 5));
  dent(1, (a, b) => v.set(a, b, 4, 'r'));
  dent(6, (a, b) => v.set(a, b, 0, null));
  dent(3, (a, b) => v.set(4, a, b, null));
  dent(4, (a, b) => v.set(0, a, b, null));
  dent(2, (a, b) => v.set(a, 4, b, null));
  dent(5, (a, b) => v.set(a, 0, b, null));
  return v.puzzle('t-die', 'Die', D);
}

function key() {
  const v = new Vox(9, 4, 2, { y: C.gold, o: C.orange });
  v.front(['yyy......', 'y.yyyyyyy', 'yyy...y.y', '......yy.'], 0, 1, 0, 3);
  v.set(0, 3, 0, 'o').set(1, 3, 0, 'o').set(2, 3, 0, 'o');
  return v.puzzle('t-key', 'Key', D);
}

function teddy() {
  const v = new Vox(7, 8, 5, { b: C.wood, t: C.tan, k: C.black, r: C.red });
  v.ellipsoid(3, 2.2, 2, 2.2, 2.2, 2, 'b');
  v.sphere(3, 5.5, 2, 1.6, 'b');
  v.box(1, 6, 2, 1, 7, 2, 'b').box(5, 6, 2, 5, 7, 2, 'b');
  v.set(3, 5, 4, 't').set(3, 5, 3, 't');
  v.set(2, 6, 3, 'k').set(4, 6, 3, 'k');
  v.set(0, 3, 2, 'b').set(6, 3, 2, 'b');
  v.set(2, 0, 3, 'b').set(4, 0, 3, 'b');
  v.box(2, 4, 3, 4, 4, 3, 'r');
  return v.puzzle('t-teddy', 'Teddy Bear', D);
}

export const toybox: Collection = {
  id: 'toybox',
  name: 'Toybox',
  blurb: 'Playthings, vehicles, and games.',
  difficulty: 'medium',
  tint: ['#e3e6ff', '#aab4ff'],
  icon: 'star',
  puzzles: [key(), die(), car(), robot(), top(), sailboat(), teddy(), airplane(), train()],
};
