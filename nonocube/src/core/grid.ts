/**
 * Geometry of a W×H×D block of cubes and the lines ("rows") running through it.
 *
 * Cell index: i = x + W * (y + H * z).
 * Line ids are global: all X-lines first (one per (y,z)), then Y-lines (per (x,z)),
 * then Z-lines (per (x,y)). Cells inside a line are ordered by increasing coordinate.
 */
export type Dims = readonly [number, number, number];
export type Axis = 0 | 1 | 2;

export class Grid {
  readonly W: number;
  readonly H: number;
  readonly D: number;
  readonly dims: Dims;
  readonly size: number;
  readonly lineCount: number;
  /** First line id for each axis. */
  readonly axisOffset: readonly [number, number, number];
  /** Cell indices of each line. */
  readonly lines: Int32Array[];
  /** Axis of each line. */
  readonly lineAxis: Uint8Array;
  /** For each cell, the id of the line through it along each axis (size*3). */
  readonly cellLines: Int32Array;

  constructor(dims: Dims) {
    const [W, H, D] = dims;
    this.W = W;
    this.H = H;
    this.D = D;
    this.dims = [W, H, D];
    this.size = W * H * D;
    const nx = H * D;
    const ny = W * D;
    const nz = W * H;
    this.axisOffset = [0, nx, nx + ny];
    this.lineCount = nx + ny + nz;
    this.lines = new Array(this.lineCount);
    this.lineAxis = new Uint8Array(this.lineCount);
    this.cellLines = new Int32Array(this.size * 3);

    for (let z = 0; z < D; z++)
      for (let y = 0; y < H; y++) {
        const id = y + H * z;
        const cells = new Int32Array(W);
        for (let x = 0; x < W; x++) {
          cells[x] = this.idx(x, y, z);
          this.cellLines[cells[x] * 3] = id;
        }
        this.lines[id] = cells;
        this.lineAxis[id] = 0;
      }
    for (let z = 0; z < D; z++)
      for (let x = 0; x < W; x++) {
        const id = nx + x + W * z;
        const cells = new Int32Array(H);
        for (let y = 0; y < H; y++) {
          cells[y] = this.idx(x, y, z);
          this.cellLines[cells[y] * 3 + 1] = id;
        }
        this.lines[id] = cells;
        this.lineAxis[id] = 1;
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const id = nx + ny + x + W * y;
        const cells = new Int32Array(D);
        for (let z = 0; z < D; z++) {
          cells[z] = this.idx(x, y, z);
          this.cellLines[cells[z] * 3 + 2] = id;
        }
        this.lines[id] = cells;
        this.lineAxis[id] = 2;
      }
  }

  idx(x: number, y: number, z: number): number {
    return x + this.W * (y + this.H * z);
  }

  coords(i: number): [number, number, number] {
    const x = i % this.W;
    const t = (i - x) / this.W;
    const y = t % this.H;
    return [x, y, (t - y) / this.H];
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.W && y < this.H && z < this.D;
  }

  /** Line through cell i along axis. */
  lineOf(i: number, axis: Axis): number {
    return this.cellLines[i * 3 + axis];
  }
}

const gridCache = new Map<string, Grid>();
export function gridFor(dims: Dims): Grid {
  const key = dims.join('x');
  let g = gridCache.get(key);
  if (!g) {
    g = new Grid(dims);
    gridCache.set(key, g);
  }
  return g;
}
