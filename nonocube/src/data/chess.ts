import type { Collection } from '../core/types.ts';
import { C, Vox } from './builder.ts';

const D = 'hard' as const;
const pal = { w: C.cream, k: C.navy, g: C.gold, f: C.darkgreen };

function pawn() {
  const v = new Vox(5, 7, 5, pal);
  v.lathe(2, 2, [2.2, 1.5, 1, 1, 1.5, 1.5, 1], ['f', 'w', 'w', 'w', 'w', 'w', 'w']);
  return v.puzzle('ch-pawn', 'Pawn', D);
}

function rook() {
  const v = new Vox(5, 8, 5, pal);
  v.lathe(2, 2, [2.2, 1.5, 1.5, 1.5, 1.5, 2.3, -2.3], ['f', 'k', 'k', 'k', 'k', 'k', 'k']);
  v.fill('k', (x, y, z) => y === 7 && (x === 0 || x === 4 || z === 0 || z === 4) && (x + z) % 2 === 1);
  return v.puzzle('ch-rook', 'Rook', D);
}

function bishop() {
  const v = new Vox(5, 9, 5, pal);
  v.lathe(2, 2, [2.2, 1.5, 1, 1, 1.5, 1.5, 1.5, 1, 0.5], ['f', 'w', 'w', 'w', 'g', 'w', 'w', 'w', 'w']);
  v.set(3, 6, 1, null).set(3, 5, 1, null);
  return v.puzzle('ch-bishop', 'Bishop', D);
}

function knight() {
  const v = new Vox(5, 9, 5, pal);
  v.lathe(2, 2, [2.2, 1.5], ['f', 'k']);
  v.side(['.k...', '.kk..', '.kkkk', '.kkkk', 'kkk..', 'kkkk.', '.kkk.'], 1, 3, 0, 8);
  v.set(1, 8, 1, null).set(3, 8, 1, null);
  v.set(1, 6, 2, 'g').set(3, 6, 2, 'g');
  return v.puzzle('ch-knight', 'Knight', D);
}

function queen() {
  const v = new Vox(5, 10, 5, pal);
  v.lathe(2, 2, [2.2, 1.5, 1, 1, 1, 1.5, 1.5, 2.2], ['f', 'w', 'w', 'w', 'w', 'w', 'w', 'g']);
  v.fill('g', (x, y, z) => y === 8 && (x === 0 || x === 4 || z === 0 || z === 4) && (x + z) % 2 === 0 && Math.hypot(x - 2, z - 2) < 2.3);
  v.set(2, 8, 2, 'w').set(2, 9, 2, 'g');
  return v.puzzle('ch-queen', 'Queen', D);
}

function king() {
  const v = new Vox(5, 10, 5, pal);
  v.lathe(2, 2, [2.2, 1.5, 1, 1, 1, 1.5, 2.2, 1.5, 0.5], ['f', 'k', 'k', 'k', 'k', 'k', 'g', 'k', 'g']);
  v.set(1, 8, 2, 'g').set(3, 8, 2, 'g').set(2, 9, 2, 'g');
  return v.puzzle('ch-king', 'King', D);
}

export const chess: Collection = {
  id: 'chess',
  name: 'Chess Set',
  blurb: 'Turned pieces — watch the silhouettes.',
  difficulty: 'hard',
  tint: ['#e8e2d6', '#b9ad96'],
  icon: 'crown',
  puzzles: [pawn(), rook(), bishop(), knight(), queen(), king()],
};
