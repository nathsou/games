import type { Collection } from '../core/types.ts';
import { C, Vox } from './builder.ts';

const D = 'easy' as const;

function stairs() {
  return new Vox(3, 3, 3, { w: C.wood, t: C.tan })
    .box(0, 0, 0, 2, 2, 0, 'w')
    .box(0, 0, 1, 2, 1, 1, 'w')
    .box(0, 0, 2, 2, 0, 2, 'w')
    .paint('t', (_x, y, z) => y === 2 - z)
    .puzzle('fs-stairs', 'Stairs', D);
}

function table() {
  return new Vox(4, 3, 3, { w: C.wood, b: C.brown })
    .box(0, 2, 0, 3, 2, 2, 'w')
    .box(0, 0, 0, 0, 1, 0, 'b')
    .box(3, 0, 0, 3, 1, 0, 'b')
    .box(0, 0, 2, 0, 1, 2, 'b')
    .box(3, 0, 2, 3, 1, 2, 'b')
    .puzzle('fs-table', 'Table', D);
}

function chair() {
  return new Vox(3, 5, 3, { r: C.red, b: C.brown })
    .box(0, 2, 0, 2, 2, 2, 'r')
    .box(0, 3, 0, 2, 4, 0, 'r')
    .set(0, 0, 0, 'b').set(0, 1, 0, 'b')
    .set(2, 0, 0, 'b').set(2, 1, 0, 'b')
    .set(0, 0, 2, 'b').set(0, 1, 2, 'b')
    .set(2, 0, 2, 'b').set(2, 1, 2, 'b')
    .puzzle('fs-chair', 'Chair', D);
}

function arch() {
  return new Vox(5, 4, 2, { s: C.grey, k: C.yellow })
    .box(0, 0, 0, 0, 3, 1, 's')
    .box(4, 0, 0, 4, 3, 1, 's')
    .box(0, 3, 0, 4, 3, 1, 's')
    .set(1, 2, 0, 's').set(1, 2, 1, 's')
    .set(3, 2, 0, 's').set(3, 2, 1, 's')
    .set(2, 3, 0, 'k').set(2, 3, 1, 'k')
    .puzzle('fs-arch', 'Archway', D);
}

function pyramid() {
  return new Vox(5, 3, 5, { s: C.tan, g: C.gold })
    .box(0, 0, 0, 4, 0, 4, 's')
    .box(1, 1, 1, 3, 1, 3, 's')
    .set(2, 2, 2, 'g')
    .puzzle('fs-pyramid', 'Pyramid', D);
}

function dumbbell() {
  return new Vox(5, 3, 3, { k: C.black, g: C.grey })
    .box(0, 0, 0, 0, 2, 2, 'k')
    .box(4, 0, 0, 4, 2, 2, 'k')
    .box(1, 1, 1, 3, 1, 1, 'g')
    .puzzle('fs-dumbbell', 'Dumbbell', D);
}

function mailbox() {
  return new Vox(4, 5, 3, { b: C.blue, p: C.wood, r: C.red })
    .box(1, 0, 1, 1, 2, 1, 'p')
    .box(0, 3, 0, 2, 4, 2, 'b')
    .set(3, 4, 0, 'r')
    .set(3, 3, 0, 'r')
    .puzzle('fs-mailbox', 'Mailbox', D);
}

function heart() {
  return new Vox(5, 5, 2, { r: C.red, p: C.pink })
    .front(['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'], 0, 1)
    .set(1, 3, 1, 'p')
    .puzzle('fs-heart', 'Heart', D);
}

function bench() {
  return new Vox(5, 3, 2, { g: C.green, k: C.darkgrey })
    .box(0, 1, 0, 4, 1, 1, 'g')
    .box(0, 2, 1, 4, 2, 1, 'g')
    .box(0, 0, 0, 0, 0, 1, 'k')
    .box(4, 0, 0, 4, 0, 1, 'k')
    .puzzle('fs-bench', 'Park Bench', D);
}

export const firstSteps: Collection = {
  id: 'first-steps',
  name: 'First Steps',
  blurb: 'Small blocks to get the hang of it.',
  difficulty: 'easy',
  tint: ['#ffd7a8', '#ffb38a'],
  icon: 'sprout',
  puzzles: [stairs(), table(), chair(), heart(), arch(), pyramid(), bench(), dumbbell(), mailbox()],
};
