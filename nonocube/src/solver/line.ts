import { clueCode, maskStats, MAX_COUNT } from '../core/clues.ts';

/**
 * Line solver: for a line of length n (≤ 20) with a clue, enumerate every pattern
 * matching the clue, keep those consistent with known cells, and intersect.
 * Patterns are bucketed per (n, clue) once and cached.
 */
const buckets = new Map<number, Uint32Array[]>();

export function patternsFor(n: number, clue: number): Uint32Array {
  let byClue = buckets.get(n);
  if (!byClue) {
    const lists: number[][] = [];
    for (let c = 0; c < (MAX_COUNT + 1) * 3; c++) lists.push([]);
    const total = 1 << n;
    for (let m = 0; m < total; m++) {
      const { count, groups } = maskStats(m);
      lists[clueCode(count, groups)].push(m);
    }
    byClue = lists.map((l) => Uint32Array.from(l));
    buckets.set(n, byClue);
  }
  return byClue[clue] ?? new Uint32Array(0);
}

export interface LineResult {
  /** Bits that must be filled. */
  fill: number;
  /** Bits that must be empty. */
  empty: number;
}

/**
 * Returns forced cells, or null if no pattern fits (contradiction).
 * `known*` are bitmasks of cells already known filled / empty.
 */
export function solveLine(n: number, clue: number, knownFill: number, knownEmpty: number): LineResult | null {
  const pats = patternsFor(n, clue);
  const full = n >= 32 ? 0xffffffff : (1 << n) - 1;
  let and = full;
  let or = 0;
  let any = false;
  for (let k = 0; k < pats.length; k++) {
    const p = pats[k];
    if ((p & knownEmpty) !== 0 || (p & knownFill) !== knownFill) continue;
    and &= p;
    or |= p;
    any = true;
  }
  if (!any) return null;
  return { fill: and, empty: ~or & full };
}
