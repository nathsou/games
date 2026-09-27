import type { Collection } from '../core/types.ts';
import { C, Vox } from './builder.ts';

const D = 'hard' as const;

function lighthouse() {
  const v = new Vox(5, 10, 5, { w: C.white, r: C.red, k: C.black, y: C.yellow, s: C.grey });
  v.lathe(2, 2, [2.2, 1.5, 1.5, 1.5, 1.5, 1.5, 2.2, 1, 1, 0.5], ['s', 'r', 'w', 'r', 'w', 'r', 'k', 'y', 'y', 'r']);
  v.set(2, 1, 4, 'k');
  return v.puzzle('a-lighthouse', 'Lighthouse', D);
}

function house() {
  const v = new Vox(7, 8, 7, { w: C.cream, r: C.red, b: C.brown, s: C.sky, g: C.grey });
  v.box(1, 0, 1, 5, 3, 5, 'w');
  for (let k = 0; k <= 3; k++) v.box(0, 4 + k, k, 6, 4 + k, 6 - k, 'r');
  v.box(1, 4, 1, 5, 6, 5, 'w');
  v.box(3, 0, 5, 3, 1, 5, 'b');
  v.set(1, 2, 5, 's').set(5, 2, 5, 's').set(1, 2, 1, 's').set(5, 2, 1, 's');
  v.box(5, 6, 2, 5, 7, 2, 'g');
  return v.puzzle('a-house', 'Cottage', D);
}

function tower() {
  const v = new Vox(7, 9, 7, { s: C.grey, d: C.darkgrey, b: C.navy, f: C.red, w: C.brown });
  v.cylY(3, 3, 2.3, 0, 6, 's');
  v.cylY(3, 3, 1.3, 1, 6, null);
  v.lathe(3, 3, [-3.2], 'd', 7);
  v.fill('d', (x, y, z) => y === 8 && Math.hypot(x - 3, z - 3) > 2.2 && Math.hypot(x - 3, z - 3) <= 3.2 && (x + z) % 2 === 0);
  v.box(3, 0, 5, 3, 1, 5, 'w');
  v.set(3, 4, 5, 'b').set(1, 4, 3, 'b').set(5, 4, 3, 'b').set(3, 4, 1, 'b');
  return v.puzzle('a-tower', 'Castle Tower', D);
}

function temple() {
  const v = new Vox(9, 7, 7, { m: C.white, s: C.tan, g: C.gold });
  v.box(0, 0, 0, 8, 0, 6, 's');
  v.box(1, 1, 1, 7, 1, 5, 'm');
  for (const x of [1, 3, 5, 7]) for (const z of [1, 5]) v.box(x, 2, z, x, 4, z, 'm');
  v.box(1, 5, 1, 7, 5, 5, 's');
  v.box(2, 6, 1, 6, 6, 5, 'm');
  v.box(4, 6, 1, 4, 6, 5, 'g');
  return v.puzzle('a-temple', 'Temple', D);
}

function windmill() {
  const v = new Vox(7, 10, 5, { w: C.cream, r: C.darkred, b: C.wood, d: C.brown });
  v.lathe(3, 2, [1.5, 1.5, 1.5, 1.5, 1.5, 1, 1, 0.5], ['w', 'w', 'w', 'w', 'w', 'r', 'r', 'r']);
  v.set(3, 0, 3, 'd').set(3, 1, 3, 'd');
  v.set(3, 5, 4, 'd');
  for (let k = 1; k <= 3; k++) {
    v.set(3 - k, 5 + k, 4, 'b').set(3 + k, 5 + k, 4, 'b').set(3 - k, 5 - k, 4, 'b').set(3 + k, 5 - k, 4, 'b');
  }
  return v.puzzle('a-windmill', 'Windmill', D);
}

function igloo() {
  const v = new Vox(7, 4, 9, { w: C.white, s: C.sky });
  v.fill('w', (x, y, z) => {
    const d = Math.hypot(x - 3, y, (z - 3) * 1);
    return d <= 3.4 && d > 2.2;
  });
  v.box(2, 0, 6, 4, 2, 8, 'w');
  v.box(3, 0, 6, 3, 1, 8, null);
  v.paint('s', (_x, y) => y === 0);
  return v.puzzle('a-igloo', 'Igloo', D);
}

function bridge() {
  const v = new Vox(10, 5, 3, { s: C.grey, d: C.darkgrey, w: C.brown });
  v.front(['w........w', 'ssssssssss', 'sss....sss', 'ss......ss', 's........s'], 0, 2);
  v.front(['d.d.d.d.d.'], 0, 0, 0, 3);
  v.front(['.d.d.d.d.d'], 2, 2, 0, 3);
  return v.puzzle('a-bridge', 'Stone Bridge', D);
}

function pagoda() {
  const v = new Vox(7, 9, 7, { r: C.red, d: C.darkred, w: C.cream, g: C.gold });
  v.box(1, 0, 1, 5, 1, 5, 'w');
  v.box(0, 2, 0, 6, 2, 6, 'd');
  v.box(2, 3, 2, 4, 4, 4, 'r');
  v.box(1, 5, 1, 5, 5, 5, 'd');
  v.box(2, 6, 2, 4, 6, 4, 'r');
  v.box(3, 7, 3, 3, 8, 3, 'g');
  v.set(3, 0, 5, 'r').set(3, 1, 5, 'r');
  return v.puzzle('a-pagoda', 'Pagoda', D);
}

export const architecture: Collection = {
  id: 'architecture',
  name: 'Architecture',
  blurb: 'Towers, temples and tiny homes.',
  difficulty: 'hard',
  tint: ['#d9ecf2', '#8cc3d6'],
  icon: 'castle',
  puzzles: [bridge(), lighthouse(), igloo(), pagoda(), house(), windmill(), temple(), tower()],
};
