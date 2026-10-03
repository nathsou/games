import type { Grid } from './grid.ts';

/**
 * A clue is encoded as `count * 3 + kind`:
 *   kind 0 — plain: all cubes form a single group (or none)
 *   kind 1 — circled: exactly two groups
 *   kind 2 — squared: three or more groups
 */
export const MAX_COUNT = 20;
export const PLAIN = 0;
export const CIRCLE = 1;
export const SQUARE = 2;

export function clueCode(count: number, groups: number): number {
  return count * 3 + (groups <= 1 ? PLAIN : groups === 2 ? CIRCLE : SQUARE);
}
export const clueCount = (c: number): number => Math.floor(c / 3);
export const clueKind = (c: number): number => c % 3;

export function clueLabel(c: number): string {
  const n = clueCount(c);
  const k = clueKind(c);
  return k === PLAIN ? `${n}` : k === CIRCLE ? `(${n})` : `[${n}]`;
}

export function describeClue(c: number): string {
  const n = clueCount(c);
  const k = clueKind(c);
  const cubes = n === 1 ? 'cube' : 'cubes';
  if (n === 0) return 'No cubes stay';
  if (k === PLAIN) return n === 1 ? '1 cube stays' : `${n} ${cubes} in one group`;
  if (k === CIRCLE) return `${n} ${cubes} in 2 groups`;
  return `${n} ${cubes} in 3+ groups`;
}

/** Count set bits and runs of set bits in a line pattern bitmask. */
export function maskStats(mask: number): { count: number; groups: number } {
  let count = 0;
  let groups = 0;
  let prev = 0;
  for (let m = mask; m; m >>>= 1) {
    const b = m & 1;
    count += b;
    if (b && !prev) groups++;
    prev = b;
  }
  return { count, groups };
}

/** Compute the clue of every line from a solution (non-zero = filled). */
export function computeClues(grid: Grid, solution: ArrayLike<number>): Uint8Array {
  const clues = new Uint8Array(grid.lineCount);
  for (let l = 0; l < grid.lineCount; l++) {
    const cells = grid.lines[l];
    let count = 0;
    let groups = 0;
    let prev = false;
    for (let k = 0; k < cells.length; k++) {
      const f = solution[cells[k]] !== 0;
      if (f) {
        count++;
        if (!prev) groups++;
      }
      prev = f;
    }
    clues[l] = clueCode(count, groups);
  }
  return clues;
}

/** Does a filled/empty pattern (given as a predicate) satisfy a clue exactly? */
export function lineSatisfies(clue: number, len: number, filled: (k: number) => boolean): boolean {
  let count = 0;
  let groups = 0;
  let prev = false;
  for (let k = 0; k < len; k++) {
    const f = filled(k);
    if (f) {
      count++;
      if (!prev) groups++;
    }
    prev = f;
  }
  return clueCode(count, groups) === clue;
}
