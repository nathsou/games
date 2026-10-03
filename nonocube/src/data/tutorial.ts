import { gridFor } from '../core/grid.ts';
import type { PuzzleDef } from '../core/types.ts';
import { C, Vox } from './builder.ts';

/** Show clues only for the given axes (flat tutorial puzzles hide the trivial depth clues). */
function axesMask(p: PuzzleDef, axes: number[]): PuzzleDef {
  const g = gridFor(p.dims);
  const mask = new Uint8Array(g.lineCount);
  for (let l = 0; l < g.lineCount; l++) mask[l] = axes.includes(g.lineAxis[l]) ? 1 : 0;
  return { ...p, mask };
}

export function tutorialLesson1(): PuzzleDef {
  const v = new Vox(4, 3, 1, { t: C.orange });
  v.front(['ttt.', '.t..', '.t..'], 0, 0);
  return axesMask(v.puzzle('tut-1', 'Letter T', 'easy'), [0, 1]);
}

export function tutorialLesson2(): PuzzleDef {
  const v = new Vox(5, 3, 1, { b: C.blue });
  v.front(['b.b.b', '.....', 'bb.bb'], 0, 0);
  return axesMask(v.puzzle('tut-2', 'Comb', 'easy'), [0, 1]);
}

export function tutorialLesson3(): PuzzleDef {
  const v = new Vox(3, 3, 3, { g: C.green, y: C.yellow });
  v.box(1, 1, 0, 1, 1, 2, 'g').box(0, 1, 1, 2, 1, 1, 'g').box(1, 0, 1, 1, 2, 1, 'g');
  v.set(1, 1, 1, 'y');
  const p = v.puzzle('tut-3', 'Jack', 'easy');
  return { ...p, mask: new Uint8Array(gridFor(p.dims).lineCount).fill(1) };
}
