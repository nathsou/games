import type { Grid } from '../core/grid.ts';
import { solveLine } from './line.ts';

export const UNKNOWN = 0;
export const FILLED = 1;
export const EMPTY = 2;

/** How hard a puzzle is to solve. */
export const LEVEL_LINE = 1; // row-by-row logic only
export const LEVEL_PROBE = 2; // needs "what if" contradiction reasoning
export const LEVEL_SEARCH = 3; // needs deeper guessing

export interface SolveResult {
  solved: boolean;
  contradiction: boolean;
  state: Uint8Array;
  /** Number of line deductions that made progress. */
  steps: number;
  /** Number of successful probes. */
  probes: number;
}

/**
 * Constraint propagation solver over the three families of lines.
 * `mask[l]` = 1 when the clue of line l is visible.
 */
export class Solver {
  readonly grid: Grid;
  readonly clues: Uint8Array;
  readonly mask: Uint8Array;
  steps = 0;
  private queue: Int32Array;
  private queued: Uint8Array;

  constructor(grid: Grid, clues: Uint8Array, mask: Uint8Array) {
    this.grid = grid;
    this.clues = clues;
    this.mask = mask;
    this.queue = new Int32Array(grid.lineCount);
    this.queued = new Uint8Array(grid.lineCount);
  }

  /**
   * Propagate line constraints to a fixpoint. `seeds` = lines to start from (all if omitted).
   * Returns false on contradiction. Mutates state.
   */
  propagate(state: Uint8Array, seeds?: Iterable<number>): boolean {
    const { grid, clues, mask, queue, queued } = this;
    queued.fill(0);
    // Ring buffer: each line is queued at most once at a time, so lineCount slots suffice.
    let head = 0;
    let tail = 0;
    let pending = 0;
    const push = (l: number) => {
      if (!queued[l] && mask[l]) {
        queued[l] = 1;
        queue[tail] = l;
        tail = (tail + 1) % queue.length;
        pending++;
      }
    };
    if (seeds) for (const l of seeds) push(l);
    else for (let l = 0; l < grid.lineCount; l++) push(l);

    while (pending > 0) {
      const l = queue[head];
      head = (head + 1) % queue.length;
      pending--;
      queued[l] = 0;
      const cells = grid.lines[l];
      const n = cells.length;
      let kf = 0;
      let ke = 0;
      for (let k = 0; k < n; k++) {
        const s = state[cells[k]];
        if (s === FILLED) kf |= 1 << k;
        else if (s === EMPTY) ke |= 1 << k;
      }
      const res = solveLine(n, clues[l], kf, ke);
      if (!res) return false;
      const nf = res.fill & ~kf;
      const ne = res.empty & ~ke;
      if (nf === 0 && ne === 0) continue;
      this.steps++;
      for (let k = 0; k < n; k++) {
        const bit = 1 << k;
        let v = 0;
        if (nf & bit) v = FILLED;
        else if (ne & bit) v = EMPTY;
        else continue;
        const c = cells[k];
        state[c] = v;
        for (let a = 0; a < 3; a++) {
          const other = grid.cellLines[c * 3 + a];
          if (other !== l) push(other);
        }
      }
    }
    return true;
  }

  linesOfCell(c: number): number[] {
    const cl = this.grid.cellLines;
    return [cl[c * 3], cl[c * 3 + 1], cl[c * 3 + 2]];
  }

  /**
   * Solve up to a logic level. LEVEL_LINE uses only propagation;
   * LEVEL_PROBE additionally tries each unknown cell both ways and keeps what's forced.
   */
  solve(level: number, initial?: Uint8Array, deadline = Infinity): SolveResult {
    const state = initial ? initial.slice() : new Uint8Array(this.grid.size);
    this.steps = 0;
    let probes = 0;
    if (!this.propagate(state)) return { solved: false, contradiction: true, state, steps: this.steps, probes };
    if (level >= LEVEL_PROBE) {
      let changed = true;
      while (changed && !isComplete(state)) {
        changed = false;
        for (let c = 0; c < state.length; c++) {
          if (state[c] !== UNKNOWN) continue;
          if (performance.now() > deadline) break;
          const r = this.probe(state, c);
          if (r === -1) return { solved: false, contradiction: true, state, steps: this.steps, probes };
          if (r > 0) {
            probes++;
            changed = true;
          }
        }
      }
    }
    return { solved: isComplete(state), contradiction: false, state, steps: this.steps, probes };
  }

  /**
   * Try cell c as filled and as empty. Applies anything forced into `state`.
   * Returns number of cells learned, or -1 if both branches fail.
   */
  probe(state: Uint8Array, c: number): number {
    const seeds = this.linesOfCell(c);
    const a = state.slice();
    a[c] = FILLED;
    const okA = this.propagate(a, seeds);
    const b = state.slice();
    b[c] = EMPTY;
    const okB = this.propagate(b, seeds);
    if (!okA && !okB) return -1;
    if (!okA || !okB) {
      const src = okA ? a : b;
      let learned = 0;
      for (let i = 0; i < state.length; i++)
        if (state[i] === UNKNOWN && src[i] !== UNKNOWN) {
          state[i] = src[i];
          learned++;
        }
      return learned;
    }
    // Both branches consistent: keep cells both agree on.
    const changedCells: number[] = [];
    for (let i = 0; i < state.length; i++)
      if (state[i] === UNKNOWN && a[i] !== UNKNOWN && a[i] === b[i]) {
        state[i] = a[i];
        changedCells.push(i);
      }
    if (changedCells.length) {
      const lines = new Set<number>();
      for (const i of changedCells) for (const l of this.linesOfCell(i)) lines.add(l);
      if (!this.propagate(state, lines)) return -1;
    }
    return changedCells.length;
  }

  /**
   * Count solutions (up to `limit`) with propagation + branching.
   * Returns found solutions and whether the node budget was exhausted.
   */
  countSolutions(limit = 2, nodeBudget = 20000, initial?: Uint8Array): { count: number; solutions: Uint8Array[]; aborted: boolean } {
    const solutions: Uint8Array[] = [];
    let nodes = 0;
    let aborted = false;
    const start = initial ? initial.slice() : new Uint8Array(this.grid.size);
    if (!this.propagate(start)) return { count: 0, solutions, aborted };

    const rec = (state: Uint8Array): void => {
      if (solutions.length >= limit || aborted) return;
      if (++nodes > nodeBudget) {
        aborted = true;
        return;
      }
      const c = this.pickBranchCell(state);
      if (c < 0) {
        if (this.verify(state)) solutions.push(state.slice());
        return;
      }
      for (const v of [FILLED, EMPTY]) {
        const s = state.slice();
        s[c] = v;
        if (this.propagate(s, this.linesOfCell(c))) rec(s);
        if (solutions.length >= limit || aborted) return;
      }
    };
    rec(start);
    return { count: solutions.length, solutions, aborted };
  }

  /** Heuristic: unknown cell on the visible line with fewest unknowns. */
  private pickBranchCell(state: Uint8Array): number {
    let best = -1;
    let bestScore = Infinity;
    for (let c = 0; c < state.length; c++) {
      if (state[c] !== UNKNOWN) continue;
      let score = 0;
      for (const l of this.linesOfCell(c)) {
        if (!this.mask[l]) {
          score += 50;
          continue;
        }
        let unk = 0;
        for (const cc of this.grid.lines[l]) if (state[cc] === UNKNOWN) unk++;
        score += unk;
      }
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  /** Check a complete state against all visible clues. */
  verify(state: Uint8Array): boolean {
    for (let l = 0; l < this.grid.lineCount; l++) {
      if (!this.mask[l]) continue;
      const cells = this.grid.lines[l];
      let kf = 0;
      let ke = 0;
      for (let k = 0; k < cells.length; k++) {
        if (state[cells[k]] === FILLED) kf |= 1 << k;
        else ke |= 1 << k;
      }
      if (!solveLine(cells.length, this.clues[l], kf, ke)) return false;
    }
    return true;
  }
}

export function isComplete(state: Uint8Array): boolean {
  for (let i = 0; i < state.length; i++) if (state[i] === UNKNOWN) return false;
  return true;
}
