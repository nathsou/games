import { gridFor, type Dims, type Grid } from '../core/grid.ts';
import { GLYPH_NONE } from './atlas.ts';

/** Face definitions shared by the cube mesh and AO: normal axis/sign and tangents with cross(t1,t2)=n. */
export const FACES: { n: [number, number, number]; t1: [number, number, number]; t2: [number, number, number] }[] = [
  { n: [1, 0, 0], t1: [0, 1, 0], t2: [0, 0, 1] },
  { n: [-1, 0, 0], t1: [0, 0, 1], t2: [0, 1, 0] },
  { n: [0, 1, 0], t1: [0, 0, 1], t2: [1, 0, 0] },
  { n: [0, -1, 0], t1: [1, 0, 0], t2: [0, 0, 1] },
  { n: [0, 0, 1], t1: [1, 0, 0], t2: [0, 1, 0] },
  { n: [0, 0, -1], t1: [0, 1, 0], t2: [1, 0, 0] },
];

export const FLAG_STRIPES = 1 << 24;
export const FLAG_HOVER = 1 << 25;
export const FLAG_GLOW = 1 << 26;

/** Pack three per-axis glyphs (slot, faded) and flags into one uint. */
export function packGlyphs(gx: number, gy: number, gz: number, fx = false, fy = false, fz = false): number {
  return ((gx | (fx ? 128 : 0)) | ((gy | (fy ? 128 : 0)) << 8) | ((gz | (fz ? 128 : 0)) << 16)) >>> 0;
}
export const NO_GLYPHS = packGlyphs(GLYPH_NONE, GLYPH_NONE, GLYPH_NONE);

export const INST_FLOATS = 7;

/**
 * Per-frame list of cube instances. Callers fill `solid` (occupancy, for ambient occlusion)
 * then `add` each visible cube.
 */
export class BlockScene {
  dims: Dims = [1, 1, 1];
  grid: Grid = gridFor([1, 1, 1]);
  count = 0;
  inst = new Float32Array(0);
  glyph = new Uint32Array(0);
  ao = new Uint32Array(0);
  solid = new Uint8Array(0);
  /** Global glyph opacity (fades during the reveal). */
  glyphAlpha = 1;

  reset(dims: Dims): void {
    if (this.dims.join() !== dims.join()) {
      this.dims = dims;
      this.grid = gridFor(dims);
    }
    const n = this.grid.size;
    if (this.glyph.length < n + 64) {
      const cap = n + 64;
      this.inst = new Float32Array(cap * INST_FLOATS);
      this.glyph = new Uint32Array(cap);
      this.ao = new Uint32Array(cap * 2);
    }
    if (this.solid.length !== n) this.solid = new Uint8Array(n);
    this.count = 0;
  }

  add(x: number, y: number, z: number, scale: number, rgb: readonly number[], glyph: number): void {
    if (this.count >= this.glyph.length) return;
    const k = this.count++;
    const o = k * INST_FLOATS;
    const inst = this.inst;
    inst[o] = x;
    inst[o + 1] = y;
    inst[o + 2] = z;
    inst[o + 3] = scale;
    inst[o + 4] = rgb[0];
    inst[o + 5] = rgb[1];
    inst[o + 6] = rgb[2];
    this.glyph[k] = glyph >>> 0;
    this.ao[k * 2] = 0xffffffff;
    this.ao[k * 2 + 1] = 0xffffffff;
  }

  /** Compute per-corner ambient occlusion for every instance at integer cell positions. */
  computeAO(): void {
    const [W, H, D] = this.dims;
    const solid = this.solid;
    const s = (x: number, y: number, z: number) =>
      x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D && solid[x + W * (y + H * z)] ? 1 : 0;
    for (let k = 0; k < this.count; k++) {
      const o = k * INST_FLOATS;
      const x = Math.round(this.inst[o]);
      const y = Math.round(this.inst[o + 1]);
      const z = Math.round(this.inst[o + 2]);
      let lo = 0;
      let hi = 0;
      for (let f = 0; f < 6; f++) {
        const { n, t1, t2 } = FACES[f];
        const px = x + n[0];
        const py = y + n[1];
        const pz = z + n[2];
        for (let c = 0; c < 4; c++) {
          const s1 = c & 1 ? 1 : -1;
          const s2 = c & 2 ? 1 : -1;
          const a = s(px + t1[0] * s1, py + t1[1] * s1, pz + t1[2] * s1);
          const b = s(px + t2[0] * s2, py + t2[1] * s2, pz + t2[2] * s2);
          const cc = s(px + t1[0] * s1 + t2[0] * s2, py + t1[1] * s1 + t2[1] * s2, pz + t1[2] * s1 + t2[2] * s2);
          const ao = a && b ? 0 : 3 - (a + b + cc);
          const bit = f * 4 + c;
          if (bit < 16) lo |= ao << (bit * 2);
          else hi |= ao << ((bit - 16) * 2);
        }
      }
      this.ao[k * 2] = lo >>> 0;
      this.ao[k * 2 + 1] = hi >>> 0;
    }
  }
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ax: number;
  ay: number;
  az: number;
  angle: number;
  spin: number;
  size: number;
  life: number;
  maxLife: number;
  rgb: [number, number, number];
}

/** Simple CPU particle system for cube shards and confetti. */
export class Particles {
  list: Particle[] = [];

  burst(x: number, y: number, z: number, rgb: [number, number, number], count = 10, power = 1): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random();
      const sp = (1.5 + Math.random() * 2.5) * power;
      const ax = Math.random() - 0.5;
      const ay = Math.random() - 0.5;
      const az = Math.random() - 0.5;
      const l = Math.hypot(ax, ay, az) || 1;
      this.list.push({
        x: x + (Math.random() - 0.5) * 0.6,
        y: y + (Math.random() - 0.5) * 0.6,
        z: z + (Math.random() - 0.5) * 0.6,
        vx: Math.cos(a) * sp * 0.7,
        vy: (1.5 + up * 3) * power,
        vz: Math.sin(a) * sp * 0.7,
        ax: ax / l,
        ay: ay / l,
        az: az / l,
        angle: Math.random() * 6,
        spin: (Math.random() - 0.5) * 16,
        size: 0.14 + Math.random() * 0.16,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.35,
        rgb,
      });
    }
  }

  update(dt: number): void {
    const g = -14;
    for (const p of this.list) {
      p.life += dt;
      p.vy += g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.angle += p.spin * dt;
    }
    this.list = this.list.filter((p) => p.life < p.maxLife);
  }
}
