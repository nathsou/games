import type { Collection } from '../core/types.ts';
import { C, Vox } from './builder.ts';

const D = 'hard' as const;

function rocket() {
  const v = new Vox(5, 10, 5, { w: C.white, r: C.red, b: C.sky, o: C.orange, y: C.yellow });
  v.lathe(2, 2, [1, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1, 1, 0.5], ['o', 'w', 'w', 'w', 'w', 'w', 'w', 'r', 'r', 'r']);
  v.set(2, 0, 2, 'y');
  v.set(2, 5, 4, 'b').set(2, 5, 3, 'b');
  v.box(0, 1, 2, 0, 3, 2, 'r').box(4, 1, 2, 4, 3, 2, 'r');
  v.box(2, 1, 0, 2, 3, 0, 'r').box(2, 1, 4, 2, 3, 4, 'r');
  v.set(0, 3, 2, null).set(4, 3, 2, null).set(2, 3, 0, null).set(2, 3, 4, null);
  return v.puzzle('s-rocket', 'Rocket', D);
}

function ufo() {
  const v = new Vox(9, 5, 9, { g: C.grey, d: C.darkgrey, b: C.sky, y: C.yellow });
  v.lathe(4, 4, [1.5, 3.3, 4.3, 2.3, 1.5], ['d', 'g', 'g', 'b', 'b']);
  v.paint('y', (x, y, z) => y === 2 && v.surface(x, y, z) && (x + z) % 2 === 0 && (Math.abs(x - 4) >= 3 || Math.abs(z - 4) >= 3));
  return v.puzzle('s-ufo', 'Flying Saucer', D);
}

function planet() {
  const v = new Vox(9, 7, 9, { p: C.purple, l: C.pink, r: C.tan });
  v.sphere(4, 3, 4, 2.5, 'p');
  v.paint('l', (_x, y) => y === 1 || y === 5);
  v.fill('r', (x, y, z) => {
    if (y !== 3) return false;
    const d = Math.hypot(x - 4, z - 4);
    return d >= 3.2 && d <= 4.4;
  });
  return v.puzzle('s-planet', 'Ringed Planet', D);
}

function satellite() {
  const v = new Vox(10, 6, 3, { g: C.gold, b: C.blue, s: C.grey, w: C.white });
  v.box(4, 1, 0, 5, 3, 2, 'g');
  v.box(0, 2, 1, 3, 2, 1, 's').box(6, 2, 1, 9, 2, 1, 's');
  v.box(0, 1, 0, 2, 3, 2, 'b').box(7, 1, 0, 9, 3, 2, 'b');
  v.box(0, 2, 1, 2, 2, 1, 's').box(7, 2, 1, 9, 2, 1, 's');
  v.box(4, 4, 1, 5, 4, 1, 's');
  v.box(3, 5, 0, 6, 5, 2, 'w');
  v.box(4, 5, 1, 5, 5, 1, null);
  v.box(4, 0, 1, 5, 0, 1, 's');
  return v.puzzle('s-satellite', 'Satellite', D);
}

function alien() {
  const v = new Vox(7, 9, 5, { g: C.lime, d: C.green, k: C.black, p: C.purple });
  v.ellipsoid(3, 5, 2, 3.2, 2.3, 2.1, 'g');
  v.box(2, 5, 4, 2, 5, 4, 'k').set(4, 5, 4, 'k');
  v.set(1, 5, 4, 'k').set(5, 5, 4, 'k');
  v.box(2, 0, 1, 4, 2, 3, 'p');
  v.set(1, 2, 2, 'd').set(5, 2, 2, 'd').set(0, 1, 2, 'd').set(6, 1, 2, 'd');
  v.set(1, 8, 2, 'd').set(5, 8, 2, 'd');
  return v.puzzle('s-alien', 'Alien', D);
}

function star() {
  const v = new Vox(9, 9, 2, { y: C.yellow, o: C.gold });
  v.front(
    ['....y....', '....y....', '...yyy...', 'yyyyyyyyy', '.yyyyyyy.', '..yyyyy..', '..yyyyy..', '.yyy.yyy.', '.y.....y.'],
    0,
    1,
  );
  v.paint('o', (x, y, z) => z === 1 && Math.abs(x - 4) + Math.abs(y - 4) <= 1);
  return v.puzzle('s-star', 'Shooting Star', D);
}

function rover() {
  const v = new Vox(8, 5, 6, { w: C.white, k: C.black, g: C.grey, y: C.gold, b: C.blue });
  v.box(1, 1, 1, 6, 2, 4, 'w');
  v.box(0, 0, 0, 0, 1, 0, 'k').box(0, 0, 5, 0, 1, 5, 'k');
  v.box(3, 0, 0, 4, 1, 0, 'k').box(3, 0, 5, 4, 1, 5, 'k');
  v.box(7, 0, 0, 7, 1, 0, 'k').box(7, 0, 5, 7, 1, 5, 'k');
  v.box(1, 3, 1, 3, 3, 4, 'b');
  v.box(5, 3, 2, 5, 4, 2, 'g');
  v.set(6, 4, 2, 'y').set(5, 4, 3, 'y');
  return v.puzzle('s-rover', 'Moon Rover', D);
}

function helmet() {
  const v = new Vox(7, 7, 7, { w: C.white, y: C.gold, g: C.grey });
  v.sphere(3, 3.5, 3, 3.1, 'w');
  v.fill(null, (x, y, z) => y >= 1 && y <= 5 && z <= 5 && Math.hypot(x - 3, y - 3.5, z - 3) < 2.2);
  v.paint('y', (x, y, z) => z >= 5 && y >= 2 && y <= 5 && Math.abs(x - 3) <= 2);
  v.paint('g', (_x, y) => y === 0);
  return v.puzzle('s-helmet', 'Space Helmet', D);
}

export const space: Collection = {
  id: 'space',
  name: 'Outer Space',
  blurb: 'Rockets, saucers and distant worlds.',
  difficulty: 'hard',
  tint: ['#cfd6ff', '#8a7cf0'],
  icon: 'rocket',
  puzzles: [star(), rocket(), alien(), ufo(), satellite(), helmet(), rover(), planet()],
};
