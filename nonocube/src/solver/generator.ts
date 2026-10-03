import { clueCount, computeClues } from '../core/clues.ts';
import type { Grid } from '../core/grid.ts';
import { rng, shuffle } from '../core/rng.ts';
import type { Difficulty } from '../core/types.ts';
import { LEVEL_LINE, LEVEL_PROBE, LEVEL_SEARCH, Solver } from './solver.ts';

export type AnalysisStatus = 'unique' | 'multiple' | 'unknown' | 'empty';

export interface Analysis {
  status: AnalysisStatus;
  /** 1 = line logic, 2 = needs probing, 3 = needs search. */
  level: number;
  /** Cells that differ between two found solutions (when multiple). */
  ambiguous: number[];
  visible: number;
  total: number;
}

function solutionState(solution: ArrayLike<number>): Uint8Array {
  const s = new Uint8Array(solution.length);
  for (let i = 0; i < s.length; i++) s[i] = solution[i] ? 1 : 2;
  return s;
}

export function analyze(grid: Grid, solution: ArrayLike<number>, mask: Uint8Array, budgetMs = 2000): Analysis {
  const visible = mask.reduce((a, b) => a + b, 0);
  const base = { ambiguous: [] as number[], visible, total: grid.lineCount };
  let filled = 0;
  for (let i = 0; i < solution.length; i++) if (solution[i]) filled++;
  if (filled === 0) return { ...base, status: 'empty', level: 0 };

  const clues = computeClues(grid, solution);
  const solver = new Solver(grid, clues, mask);
  const deadline = performance.now() + budgetMs;
  if (solver.solve(LEVEL_LINE).solved) return { ...base, status: 'unique', level: LEVEL_LINE };
  if (solver.solve(LEVEL_PROBE, undefined, deadline).solved) return { ...base, status: 'unique', level: LEVEL_PROBE };
  const res = solver.countSolutions(2, 40000);
  if (res.count >= 2) {
    const [a, b] = res.solutions;
    const ambiguous: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) ambiguous.push(i);
    return { ...base, status: 'multiple', level: LEVEL_SEARCH, ambiguous };
  }
  if (res.aborted) return { ...base, status: 'unknown', level: LEVEL_SEARCH };
  return { ...base, status: res.count === 1 ? 'unique' : 'empty', level: LEVEL_SEARCH };
}

export interface GenResult {
  mask: Uint8Array;
  analysis: Analysis;
}

const TARGET_HIDDEN: Record<Difficulty, number> = { easy: 0.4, medium: 0.62, hard: 1 };
/** Max share of empty cubes that visible zero-clues may clear on their own. */
const MAX_ZERO_SHARE: Record<Difficulty, number> = { easy: 0.4, medium: 0.3, hard: 0.2 };

/** Fraction of the empty cubes lying on a visible zero-clue row. */
export function zeroShare(grid: Grid, clues: Uint8Array, mask: Uint8Array, solution: ArrayLike<number>): number {
  const swept = new Uint8Array(grid.size);
  for (let l = 0; l < grid.lineCount; l++) if (mask[l] && clueCount(clues[l]) === 0) for (const i of grid.lines[l]) swept[i] = 1;
  let empty = 0;
  let sw = 0;
  for (let i = 0; i < grid.size; i++)
    if (!solution[i]) {
      empty++;
      sw += swept[i];
    }
  return empty ? sw / empty : 0;
}

/**
 * Hide as many clues as the difficulty allows while keeping the puzzle uniquely
 * solvable at that difficulty's logic level. Deterministic for a given seed.
 */
export function generateMask(
  grid: Grid,
  solution: ArrayLike<number>,
  difficulty: Difficulty,
  seed: number | string,
  budgetMs = 2500,
): GenResult {
  const deadline = performance.now() + budgetMs;
  const clues = computeClues(grid, solution);
  const mask = new Uint8Array(grid.lineCount).fill(1);
  const full = analyze(grid, solution, mask, Math.min(1500, budgetMs));
  if (full.status !== 'unique' || full.level >= LEVEL_SEARCH) return { mask, analysis: full };

  const maxLevel = Math.max(full.level, difficulty === 'hard' ? LEVEL_PROBE : LEVEL_LINE);
  const baseLevel = full.level === LEVEL_LINE ? LEVEL_LINE : LEVEL_PROBE;
  const solver = new Solver(grid, clues, mask); // shares `mask` by reference
  const rand = rng(seed);
  const order = shuffle(Array.from({ length: grid.lineCount }, (_, i) => i), rand);
  const maxHidden = Math.floor(TARGET_HIDDEN[difficulty] * grid.lineCount);
  let hidden = 0;

  const tryHide = (l: number, level: number): boolean => {
    mask[l] = 0;
    if (solver.solve(LEVEL_LINE).solved) return true;
    if (level >= LEVEL_PROBE && performance.now() < deadline && solver.solve(LEVEL_PROBE, undefined, deadline).solved) return true;
    mask[l] = 1;
    return false;
  };

  // Phase 1: zero-clues are giveaways (and the game offers a one-click "clear zeros"),
  // so thin them out until they only clear a limited share of the empty cubes.
  for (const l of order) {
    if (zeroShare(grid, clues, mask, solution) <= MAX_ZERO_SHARE[difficulty] || performance.now() > deadline) break;
    if (clueCount(clues[l]) === 0 && tryHide(l, baseLevel)) hidden++;
  }
  // Phase 2: hide other clues up to the difficulty's target.
  for (const l of order) {
    if (hidden >= maxHidden || performance.now() > deadline) break;
    if (mask[l] && tryHide(l, baseLevel)) hidden++;
  }
  // Phase 3 (hard): allow probing logic on what's left.
  if (maxLevel >= LEVEL_PROBE && full.level === LEVEL_LINE) {
    for (const l of order) {
      if (hidden >= maxHidden || performance.now() > deadline) break;
      if (mask[l] && tryHide(l, LEVEL_PROBE)) hidden++;
    }
  }
  const level = solver.solve(LEVEL_LINE).solved ? LEVEL_LINE : LEVEL_PROBE;
  const visible = grid.lineCount - hidden;
  return {
    mask,
    analysis: { status: 'unique', level, ambiguous: [], visible, total: grid.lineCount },
  };
}

export { solutionState };
