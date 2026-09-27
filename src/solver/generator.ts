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
  const solver = new Solver(grid, clues, mask); // shares `mask` by reference
  const rand = rng(seed);
  let order = shuffle(Array.from({ length: grid.lineCount }, (_, i) => i), rand);
  if (difficulty === 'easy') {
    // Keep zero-clues visible as long as possible: they're the friendliest.
    order = [...order.filter((l) => clueCount(clues[l]) > 0), ...order.filter((l) => clueCount(clues[l]) === 0)];
  } else if (difficulty === 'hard') {
    // Hide the giveaway zero-clues first.
    order = [...order.filter((l) => clueCount(clues[l]) === 0), ...order.filter((l) => clueCount(clues[l]) > 0)];
  }
  const maxHidden = Math.floor(TARGET_HIDDEN[difficulty] * grid.lineCount);
  let hidden = 0;

  const tryHide = (l: number, level: number): boolean => {
    mask[l] = 0;
    if (solver.solve(LEVEL_LINE).solved) return true;
    if (level >= LEVEL_PROBE && performance.now() < deadline && solver.solve(LEVEL_PROBE, undefined, deadline).solved) return true;
    mask[l] = 1;
    return false;
  };

  // Pass 1: cheap line-logic check.
  for (const l of order) {
    if (hidden >= maxHidden || performance.now() > deadline) break;
    if (full.level === LEVEL_LINE ? tryHide(l, LEVEL_LINE) : tryHide(l, LEVEL_PROBE)) hidden++;
  }
  // Pass 2 (hard): allow probing logic on what's left.
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
