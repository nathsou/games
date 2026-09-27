import { computeClues, lineSatisfies } from '../core/clues.ts';
import { gridFor, type Grid } from '../core/grid.ts';
import type { PuzzleDef } from '../core/types.ts';
import { solveLine } from '../solver/line.ts';

export const UNKNOWN = 0;
export const PAINTED = 1;
export const BROKEN = 2;

export type MistakeMode = 'classic' | 'zen';
export type BreakResult = 'ok' | 'mistake' | 'warned' | 'protected' | 'noop';

interface Change {
  i: number;
  from: number;
  to: number;
}

export interface SavedProgress {
  state: string;
  strikes: number;
  hints: number;
  elapsed: number;
  noStrikeLimit?: boolean;
}

export const MAX_STRIKES = 5;

/** The state of one puzzle being played: cube states, undo history, strikes, completion. */
export class PlaySession {
  readonly def: PuzzleDef;
  readonly grid: Grid;
  readonly clues: Uint8Array;
  readonly mask: Uint8Array;
  readonly state: Uint8Array;
  readonly lineDone: Uint8Array;
  mode: MistakeMode;
  /** Zen mode: refuse (without penalty) to break cubes that belong to the shape. */
  warnWrongBreaks = false;
  strikes = 0;
  hints = 0;
  elapsed = 0;
  solved = false;
  /** After running out of strikes the player may continue without a limit. */
  noStrikeLimit = false;
  private remainingEmpty = 0;
  private wrongBroken = 0;
  private undoStack: Change[][] = [];
  private redoStack: Change[][] = [];
  private group: Change[] | null = null;

  constructor(def: PuzzleDef, mask: Uint8Array, mode: MistakeMode) {
    this.def = def;
    this.grid = gridFor(def.dims);
    this.clues = computeClues(this.grid, def.cells);
    this.mask = mask;
    this.mode = mode;
    this.state = new Uint8Array(this.grid.size);
    this.lineDone = new Uint8Array(this.grid.lineCount);
    this.recount();
  }

  isFilled(i: number): boolean {
    return this.def.cells[i] !== 0;
  }

  private recount(): void {
    this.remainingEmpty = 0;
    this.wrongBroken = 0;
    for (let i = 0; i < this.grid.size; i++) {
      if (!this.isFilled(i) && this.state[i] !== BROKEN) this.remainingEmpty++;
      if (this.isFilled(i) && this.state[i] === BROKEN) this.wrongBroken++;
    }
    for (let l = 0; l < this.grid.lineCount; l++) this.updateLine(l);
    this.solved = this.remainingEmpty === 0 && this.wrongBroken === 0;
  }

  /** A row is "done" once its remaining cubes match the clue and are all painted. */
  private updateLine(l: number): void {
    const cells = this.grid.lines[l];
    let allPainted = true;
    for (let k = 0; k < cells.length; k++) if (this.state[cells[k]] === UNKNOWN) allPainted = false;
    this.lineDone[l] = allPainted && lineSatisfies(this.clues[l], cells.length, (k) => this.state[cells[k]] !== BROKEN) ? 1 : 0;
  }

  private set(i: number, to: number): void {
    const from = this.state[i];
    if (from === to) return;
    if (!this.isFilled(i)) {
      if (from !== BROKEN && to === BROKEN) this.remainingEmpty--;
      if (from === BROKEN && to !== BROKEN) this.remainingEmpty++;
    } else {
      if (from !== BROKEN && to === BROKEN) this.wrongBroken++;
      if (from === BROKEN && to !== BROKEN) this.wrongBroken--;
    }
    this.state[i] = to;
    for (let a = 0; a < 3; a++) this.updateLine(this.grid.cellLines[i * 3 + a]);
    const change = { i, from, to };
    if (this.group) this.group.push(change);
    else this.undoStack.push([change]);
    this.redoStack.length = 0;
    this.solved = this.remainingEmpty === 0 && this.wrongBroken === 0;
  }

  beginGroup(): void {
    if (!this.group) this.group = [];
  }

  endGroup(): void {
    if (this.group && this.group.length) this.undoStack.push(this.group);
    this.group = null;
  }

  get strikesLeft(): number {
    return this.mode === 'classic' && !this.noStrikeLimit ? MAX_STRIKES - this.strikes : Infinity;
  }

  breakCell(i: number): BreakResult {
    if (this.solved) return 'noop';
    const s = this.state[i];
    if (s === BROKEN) return 'noop';
    if (s === PAINTED) return 'protected';
    if (this.mode === 'zen' && this.warnWrongBreaks && this.isFilled(i)) return 'warned';
    if (this.mode === 'classic' && this.isFilled(i)) {
      this.strikes++;
      this.set(i, PAINTED);
      return 'mistake';
    }
    this.set(i, BROKEN);
    return 'ok';
  }

  paintCell(i: number, on: boolean): boolean {
    if (this.solved) return false;
    const s = this.state[i];
    if (s === BROKEN) return false;
    const to = on ? PAINTED : UNKNOWN;
    if (s === to) return false;
    this.set(i, to);
    return true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0 && !this.solved;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0 && !this.solved;
  }

  /** Returns the cells that changed. */
  undo(): number[] {
    const g = this.undoStack.pop();
    if (!g) return [];
    this.applyRaw(g.map((c) => ({ i: c.i, to: c.from })).reverse());
    this.redoStack.push(g);
    return g.map((c) => c.i);
  }

  redo(): number[] {
    const g = this.redoStack.pop();
    if (!g) return [];
    this.applyRaw(g.map((c) => ({ i: c.i, to: c.to })));
    this.undoStack.push(g);
    return g.map((c) => c.i);
  }

  private applyRaw(changes: { i: number; to: number }[]): void {
    for (const c of changes) this.state[c.i] = c.to;
    this.recount();
  }

  restart(): void {
    this.state.fill(0);
    this.undoStack = [];
    this.redoStack = [];
    this.strikes = 0;
    this.hints = 0;
    this.elapsed = 0;
    this.noStrikeLimit = false;
    this.recount();
  }

  /** Unbroken, unpainted cubes lying on a visible row whose clue is 0 (always safe to break). */
  zeroCells(): number[] {
    const out = new Set<number>();
    for (let l = 0; l < this.grid.lineCount; l++) {
      if (!this.mask[l] || this.clues[l] !== 0) continue;
      for (const i of this.grid.lines[l]) if (this.state[i] === UNKNOWN) out.add(i);
    }
    return [...out];
  }

  /** Cells the player broke that belong to the shape, or painted that don't (zen mode errors). */
  errors(): { wrongBroken: number[]; wrongPainted: number[] } {
    const wrongBroken: number[] = [];
    const wrongPainted: number[] = [];
    for (let i = 0; i < this.grid.size; i++) {
      if (this.isFilled(i) && this.state[i] === BROKEN) wrongBroken.push(i);
      if (!this.isFilled(i) && this.state[i] === PAINTED) wrongPainted.push(i);
    }
    return { wrongBroken, wrongPainted };
  }

  stars(): number {
    const penalties = (this.mode === 'classic' ? this.strikes : 0) + this.hints;
    if (this.noStrikeLimit) return 1;
    return penalties === 0 ? 3 : penalties <= 2 ? 2 : 1;
  }

  serialize(): SavedProgress {
    return {
      state: Array.from(this.state).join(''),
      strikes: this.strikes,
      hints: this.hints,
      elapsed: Math.round(this.elapsed),
      noStrikeLimit: this.noStrikeLimit,
    };
  }

  restore(p: SavedProgress): void {
    if (p.state.length !== this.grid.size) return;
    for (let i = 0; i < this.grid.size; i++) this.state[i] = Number(p.state[i]) || 0;
    this.strikes = p.strikes;
    this.hints = p.hints;
    this.elapsed = p.elapsed;
    this.noStrikeLimit = !!p.noStrikeLimit;
    this.recount();
  }

  get progress(): number {
    let total = 0;
    for (let i = 0; i < this.grid.size; i++) if (!this.isFilled(i)) total++;
    return total ? 1 - this.remainingEmpty / total : 1;
  }
}

export interface Hint {
  kind: 'line' | 'mistake' | 'reveal';
  line?: number;
  breakCells: number[];
  paintCells: number[];
  message: string;
}

/**
 * Find the next logical step for the player: first flag mistakes (zen mode), then look for a
 * visible line whose clue forces cubes given what's known, else reveal one breakable cube.
 */
export function findHint(s: PlaySession, prefer?: number): Hint | null {
  if (s.solved) return null;
  const { wrongBroken, wrongPainted } = s.errors();
  if (wrongBroken.length)
    return { kind: 'mistake', breakCells: [], paintCells: wrongBroken, message: 'A cube you broke was part of the shape. Try undoing.' };
  if (wrongPainted.length)
    return { kind: 'mistake', breakCells: wrongPainted.slice(0, 1), paintCells: [], message: 'This painted cube isn’t part of the shape.' };

  const g = s.grid;
  const order: number[] = [];
  if (prefer !== undefined && prefer >= 0) for (let a = 0; a < 3; a++) order.push(g.cellLines[prefer * 3 + a]);
  for (let l = 0; l < g.lineCount; l++) order.push(l);

  let best: Hint | null = null;
  for (const l of order) {
    if (!s.mask[l]) continue;
    const cells = g.lines[l];
    let kf = 0;
    let ke = 0;
    for (let k = 0; k < cells.length; k++) {
      const st = s.state[cells[k]];
      if (st === BROKEN) ke |= 1 << k;
      else if (st === PAINTED) kf |= 1 << k;
    }
    const r = solveLine(cells.length, s.clues[l], kf, ke);
    if (!r) continue;
    const breakCells: number[] = [];
    const paintCells: number[] = [];
    for (let k = 0; k < cells.length; k++) {
      if (r.empty & ~ke & (1 << k)) breakCells.push(cells[k]);
      if (r.fill & ~kf & (1 << k)) paintCells.push(cells[k]);
    }
    if (breakCells.length) {
      return { kind: 'line', line: l, breakCells, paintCells, message: 'This row’s clue tells you which cubes can go.' };
    }
    if (paintCells.length && !best) best = { kind: 'line', line: l, breakCells, paintCells, message: 'This row’s clue proves these cubes stay — paint them.' };
  }
  if (best) return best;
  for (let i = 0; i < g.size; i++)
    if (!s.isFilled(i) && s.state[i] !== BROKEN)
      return { kind: 'reveal', breakCells: [i], paintCells: [], message: 'Tricky spot! This cube can be broken.' };
  return null;
}
