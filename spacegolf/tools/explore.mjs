// Sweep the hole angle of a campaign level and print the par the solver finds for each.
//   node tools/explore.mjs w1-3 [--depth=3] [--step=20]
import { findLevel } from '../src/campaign.js';
import { solve, drain } from '../src/solver.js';
import { cloneLevel } from '../src/level.js';

const id = process.argv[2];
const arg = (n, d) => Number((process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split('=')[1]);
const depth = arg('depth', 3);
const step = arg('step', 20);
const level = findLevel(id);
if (!level) throw new Error('unknown level');
const base = cloneLevel(level);
if (typeof base.hole.body !== 'number') throw new Error('level has a free-floating hole');
const row = [];
for (let deg = 0; deg < 360; deg += step) {
  const l = cloneLevel(base);
  l.hole.angle = (deg * Math.PI) / 180;
  const r = drain(solve(l, { maxDepth: depth, angles: 90, powers: [0.25, 0.4, 0.55, 0.7, 0.85, 1], times: 3, beam: 10 }));
  row.push(`${deg}:${r ? r.par : '-'}`);
}
console.log(id, 'tee', JSON.stringify(base.tee), 'holeBody', base.hole.body);
console.log(row.join('  '));
