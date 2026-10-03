import type { Dims } from '../core/grid.ts';
import type { Vec3 } from './math.ts';

export interface Hit {
  x: number;
  y: number;
  z: number;
  /** Face normal of the entered face (points toward the ray origin). */
  normal: [number, number, number];
  t: number;
}

/**
 * Voxel ray march (Amanatides & Woo) through a W×H×D grid centered at the world origin.
 * `solid(x,y,z)` decides which cells stop the ray.
 */
export function pickVoxel(o: Vec3, d: Vec3, dims: Dims, solid: (x: number, y: number, z: number) => boolean): Hit | null {
  const [W, H, D] = dims;
  // grid space: cell (i,j,k) spans [i, i+1)
  const g: Vec3 = [o[0] + W / 2, o[1] + H / 2, o[2] + D / 2];
  const size = [W, H, D];
  // clip to bounds
  let tmin = 0;
  let tmax = Infinity;
  let enterAxis = -1;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (g[a] < 0 || g[a] > size[a]) return null;
      continue;
    }
    let t0 = (0 - g[a]) / d[a];
    let t1 = (size[a] - g[a]) / d[a];
    if (t0 > t1) [t0, t1] = [t1, t0];
    if (t0 > tmin) {
      tmin = t0;
      enterAxis = a;
    }
    tmax = Math.min(tmax, t1);
  }
  if (tmin > tmax) return null;
  const eps = 1e-6;
  const p = [g[0] + d[0] * (tmin + eps), g[1] + d[1] * (tmin + eps), g[2] + d[2] * (tmin + eps)];
  const cell = [0, 1, 2].map((a) => Math.min(size[a] - 1, Math.max(0, Math.floor(p[a]))));
  const step = [0, 1, 2].map((a) => (d[a] > 0 ? 1 : -1));
  const tDelta = [0, 1, 2].map((a) => (Math.abs(d[a]) < 1e-9 ? Infinity : Math.abs(1 / d[a])));
  const tNext = [0, 1, 2].map((a) => {
    if (Math.abs(d[a]) < 1e-9) return Infinity;
    const boundary = d[a] > 0 ? cell[a] + 1 : cell[a];
    return (boundary - g[a]) / d[a];
  });
  let axis = enterAxis;
  let t = tmin;
  for (let guard = 0; guard < W + H + D + 3; guard++) {
    if (solid(cell[0], cell[1], cell[2])) {
      const normal: [number, number, number] = [0, 0, 0];
      if (axis >= 0) normal[axis] = -step[axis];
      else {
        // started inside the box: face the camera along the dominant axis
        const a = Math.abs(d[0]) > Math.abs(d[1]) ? (Math.abs(d[0]) > Math.abs(d[2]) ? 0 : 2) : Math.abs(d[1]) > Math.abs(d[2]) ? 1 : 2;
        normal[a] = -step[a];
      }
      return { x: cell[0], y: cell[1], z: cell[2], normal, t };
    }
    // advance
    let a = 0;
    if (tNext[1] < tNext[a]) a = 1;
    if (tNext[2] < tNext[a]) a = 2;
    t = tNext[a];
    cell[a] += step[a];
    if (cell[a] < 0 || cell[a] >= size[a]) return null;
    tNext[a] += tDelta[a];
    axis = a;
  }
  return null;
}

/** Intersect with the floor plane under the grid; returns the cell column hit (for the editor). */
export function pickFloor(o: Vec3, d: Vec3, dims: Dims): { x: number; z: number } | null {
  const [W, H, D] = dims;
  const y = -H / 2;
  if (Math.abs(d[1]) < 1e-6) return null;
  const t = (y - o[1]) / d[1];
  if (t <= 0) return null;
  const x = Math.floor(o[0] + d[0] * t + W / 2);
  const z = Math.floor(o[2] + d[2] * t + D / 2);
  if (x < 0 || z < 0 || x >= W || z >= D) return null;
  return { x, z };
}
