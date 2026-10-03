import type { Difficulty, ModelDef, PuzzleDef } from '../core/types.ts';

/**
 * Tiny voxel modeling DSL used to author the puzzle collections.
 * Coordinates: x → right, y → up, z → toward the viewer (front is z = D-1).
 * Palette keys are single characters; '.' or ' ' means empty.
 */
export class Vox {
  readonly W: number;
  readonly H: number;
  readonly D: number;
  readonly cells: Uint8Array;
  private keys: string[] = [];
  private colors: string[] = [];

  constructor(W: number, H: number, D: number, palette: Record<string, string>) {
    this.W = W;
    this.H = H;
    this.D = D;
    this.cells = new Uint8Array(W * H * D);
    for (const [k, v] of Object.entries(palette)) {
      this.keys.push(k);
      this.colors.push(v);
    }
  }

  private code(key: string | null): number {
    if (key === null || key === '.' || key === ' ') return 0;
    const i = this.keys.indexOf(key);
    if (i < 0) throw new Error(`Unknown palette key '${key}'`);
    return i + 1;
  }

  set(x: number, y: number, z: number, key: string | null): this {
    x = Math.round(x);
    y = Math.round(y);
    z = Math.round(z);
    if (x < 0 || y < 0 || z < 0 || x >= this.W || y >= this.H || z >= this.D) return this;
    this.cells[x + this.W * (y + this.H * z)] = this.code(key);
    return this;
  }

  get(x: number, y: number, z: number): number {
    if (x < 0 || y < 0 || z < 0 || x >= this.W || y >= this.H || z >= this.D) return 0;
    return this.cells[x + this.W * (y + this.H * z)];
  }

  /** Recolor filled cells matching a predicate. */
  paint(key: string, pred: (x: number, y: number, z: number) => boolean): this {
    const c = this.code(key);
    this.each((x, y, z, v) => {
      if (v && pred(x, y, z)) this.cells[x + this.W * (y + this.H * z)] = c;
    });
    return this;
  }

  /** Filled cell with at least one empty (or out-of-bounds) face neighbor. */
  surface(x: number, y: number, z: number): boolean {
    if (!this.get(x, y, z)) return false;
    return (
      !this.get(x - 1, y, z) || !this.get(x + 1, y, z) || !this.get(x, y - 1, z) ||
      !this.get(x, y + 1, z) || !this.get(x, y, z - 1) || !this.get(x, y, z + 1) ||
      x === 0 || y === 0 || z === 0 || x === this.W - 1 || y === this.H - 1 || z === this.D - 1
    );
  }

  each(fn:(x: number, y: number, z: number, v: number) => void): void {
    for (let z = 0; z < this.D; z++)
      for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) fn(x, y, z, this.get(x, y, z));
  }

  /** Fill every cell satisfying a predicate. */
  fill(key: string | null, pred: (x: number, y: number, z: number) => boolean): this {
    this.each((x, y, z) => {
      if (pred(x, y, z)) this.set(x, y, z, key);
    });
    return this;
  }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, key: string | null): this {
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, z, key);
    return this;
  }

  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, key: string | null): this {
    return this.fill(key, (x, y, z) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1.0001);
  }

  sphere(cx: number, cy: number, cz: number, r: number, key: string | null): this {
    return this.ellipsoid(cx, cy, cz, r, r, r, key);
  }

  /** Vertical cylinder (axis along Y). */
  cylY(cx: number, cz: number, r: number, y0: number, y1: number, key: string | null): this {
    return this.fill(key, (x, y, z) => y >= y0 && y <= y1 && (x - cx) ** 2 + (z - cz) ** 2 <= r * r + 0.0001);
  }

  cylX(cy: number, cz: number, r: number, x0: number, x1: number, key: string | null): this {
    return this.fill(key, (x, y, z) => x >= x0 && x <= x1 && (y - cy) ** 2 + (z - cz) ** 2 <= r * r + 0.0001);
  }

  cylZ(cx: number, cy: number, r: number, z0: number, z1: number, key: string | null): this {
    return this.fill(key, (x, y, z) => z >= z0 && z <= z1 && (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.0001);
  }

  /**
   * Solid of revolution around the vertical axis at (cx, cz).
   * radii[k] is the radius at y = y0 + k; keys may be one key or one per layer.
   * A negative radius makes a hollow ring layer with outer radius |r| (wall 1).
   */
  lathe(cx: number, cz: number, radii: number[], keys: string | string[], y0 = 0): this {
    radii.forEach((r, k) => {
      const key = typeof keys === 'string' ? keys : keys[Math.min(k, keys.length - 1)];
      const y = y0 + k;
      const outer = Math.abs(r);
      this.fill(key, (x, yy, z) => {
        if (yy !== y) return false;
        const d2 = (x - cx) ** 2 + (z - cz) ** 2;
        if (d2 > outer * outer + 0.0001) return false;
        if (r < 0) return d2 > (outer - 1) * (outer - 1) + 0.0001;
        return true;
      });
    });
    return this;
  }

  /**
   * Layers bottom-to-top; each layer is rows back-to-front (z = 0 first), chars left-to-right.
   */
  layers(layers: string[][], x0 = 0, y0 = 0, z0 = 0): this {
    layers.forEach((rows, y) =>
      rows.forEach((row, z) =>
        [...row].forEach((ch, x) => {
          if (ch !== '.' && ch !== ' ') this.set(x0 + x, y0 + y, z0 + z, ch);
        }),
      ),
    );
    return this;
  }

  /** Pixel art in the XY plane (rows top-to-bottom), extruded along z0..z1. */
  front(rows: string[], z0: number, z1: number, x0 = 0, yTop = rows.length - 1): this {
    rows.forEach((row, r) =>
      [...row].forEach((ch, x) => {
        if (ch === '.' || ch === ' ') return;
        for (let z = z0; z <= z1; z++) this.set(x0 + x, yTop - r, z, ch);
      }),
    );
    return this;
  }

  /** Pixel art in the ZY plane (rows top-to-bottom, chars back-to-front), extruded along x0..x1. */
  side(rows: string[], x0: number, x1: number, z0 = 0, yTop = rows.length - 1): this {
    rows.forEach((row, r) =>
      [...row].forEach((ch, z) => {
        if (ch === '.' || ch === ' ') return;
        for (let x = x0; x <= x1; x++) this.set(x, yTop - r, z0 + z, ch);
      }),
    );
    return this;
  }

  /** Pixel art in the XZ plane (rows back-to-front), extruded along y0..y1. */
  top(rows: string[], y0: number, y1: number, x0 = 0, z0 = 0): this {
    rows.forEach((row, z) =>
      [...row].forEach((ch, x) => {
        if (ch === '.' || ch === ' ') return;
        for (let y = y0; y <= y1; y++) this.set(x0 + x, y, z0 + z, ch);
      }),
    );
    return this;
  }

  /** Mirror the left half onto the right half (x → W-1-x). */
  mirrorX(): this {
    for (let z = 0; z < this.D; z++)
      for (let y = 0; y < this.H; y++)
        for (let x = 0; x < Math.floor(this.W / 2); x++) {
          const v = this.get(x, y, z);
          this.cells[this.W - 1 - x + this.W * (y + this.H * z)] = v;
        }
    return this;
  }

  model(id: string, name: string): ModelDef {
    // Compact palette to the colors actually used.
    const used = new Map<number, number>();
    const palette: string[] = [];
    const cells = new Uint8Array(this.cells.length);
    for (let i = 0; i < cells.length; i++) {
      const v = this.cells[i];
      if (!v) continue;
      let m = used.get(v);
      if (m === undefined) {
        palette.push(this.colors[v - 1]);
        m = palette.length;
        used.set(v, m);
      }
      cells[i] = m;
    }
    return { id, name, dims: [this.W, this.H, this.D], cells, palette };
  }

  puzzle(id: string, name: string, difficulty: Difficulty): PuzzleDef {
    return { ...this.model(id, name), difficulty };
  }
}

/** Shared palette of friendly colors. */
export const C = {
  red: '#e5534b',
  darkred: '#a8322d',
  orange: '#f28b30',
  yellow: '#f5c542',
  cream: '#f3e7c9',
  green: '#5cb85c',
  darkgreen: '#2f7d4a',
  lime: '#a4d65e',
  teal: '#3bb3a4',
  sky: '#7cc4f2',
  blue: '#3d7be0',
  navy: '#27417a',
  purple: '#8e6bd6',
  pink: '#f28bb3',
  brown: '#8b5a3c',
  wood: '#c08552',
  tan: '#dcb383',
  white: '#f7f7f2',
  grey: '#9aa0a8',
  darkgrey: '#555b66',
  black: '#2a2d34',
  gold: '#e0b43c',
  terracotta: '#c8643c',
};
