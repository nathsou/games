// Dev tool: print models as ASCII (front/side/top silhouettes) and check solvability.
// Usage: node --experimental-strip-types scripts/preview.ts [filter]
import { allCollections } from '../src/data/collections.ts';
import { gridFor } from '../src/core/grid.ts';
import { analyze, generateMask } from '../src/solver/generator.ts';

const filter = process.argv.slice(2).find((a) => !a.startsWith('-')) ?? '';
const CH = '.123456789ABCDEF';
for (const col of allCollections) {
  for (const p of col.puzzles) {
    if (filter && !p.id.includes(filter)) continue;
    const [W, H, D] = p.dims;
    const g = gridFor(p.dims);
    const at = (x: number, y: number, z: number) => p.cells[g.idx(x, y, z)];
    const out: string[] = [];
    // front view (first visible from front z=D-1), side view from right (x=W-1), top view
    for (let y = H - 1; y >= 0; y--) {
      let f = '', s = '';
      for (let x = 0; x < W; x++) { let c = 0; for (let z = D - 1; z >= 0 && !c; z--) c = at(x, y, z); f += CH[c]; }
      for (let z = D - 1; z >= 0; z--) { let c = 0; for (let x = W - 1; x >= 0 && !c; x--) c = at(x, y, z); s += CH[c]; }
      out.push(f + '   ' + s);
    }
    out.push('');
    for (let z = 0; z < D; z++) { let t = ''; for (let x = 0; x < W; x++) { let c = 0; for (let y = H - 1; y >= 0 && !c; y--) c = at(x, y, z); t += CH[c]; } out.push(t); }
    const t0 = performance.now();
    const full = analyze(g, p.cells, new Uint8Array(g.lineCount).fill(1));
    const gen = full.status === 'unique' ? generateMask(g, p.cells, p.difficulty, p.id) : null;
    const ms = (performance.now() - t0).toFixed(0);
    console.log(`== ${p.id} "${p.name}" ${W}x${H}x${D} full=${full.status}/L${full.level}` + (gen ? ` gen=L${gen.analysis.level} visible ${gen.analysis.visible}/${gen.analysis.total}` : '') + ` ${ms}ms`);
    if (process.argv.includes('-v') || filter) console.log(out.join('\n'));
  }
}
