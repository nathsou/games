import type { Dims } from './grid.ts';

export type Difficulty = 'easy' | 'medium' | 'hard';

/** A colored voxel model. cells[i] = 0 for empty, k > 0 for palette[k - 1]. */
export interface ModelDef {
  id: string;
  name: string;
  dims: Dims;
  cells: Uint8Array;
  palette: string[];
}

/** A playable puzzle: model + which line clues are visible. */
export interface PuzzleDef extends ModelDef {
  difficulty: Difficulty;
  /** 1 = clue visible, 0 = hidden, per line id. If absent it is generated. */
  mask?: Uint8Array;
}

export interface Collection {
  id: string;
  name: string;
  blurb: string;
  difficulty: Difficulty;
  /** CSS gradient colors for the card. */
  tint: [string, string];
  icon: string;
  puzzles: PuzzleDef[];
}
