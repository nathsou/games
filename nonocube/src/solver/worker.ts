import { gridFor, type Dims } from '../core/grid.ts';
import type { Difficulty } from '../core/types.ts';
import { analyze, generateMask } from './generator.ts';

export type WorkerRequest =
  | { id: number; type: 'generate'; dims: Dims; cells: Uint8Array; difficulty: Difficulty; seed: string; budgetMs?: number }
  | { id: number; type: 'analyze'; dims: Dims; cells: Uint8Array; mask: Uint8Array };

interface WorkerScope {
  postMessage(msg: unknown): void;
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
}
const ctx = self as unknown as WorkerScope;

ctx.onmessage = (e) => {
  const req = e.data;
  try {
    const grid = gridFor(req.dims);
    if (req.type === 'generate') {
      const res = generateMask(grid, req.cells, req.difficulty, req.seed, req.budgetMs);
      ctx.postMessage({ id: req.id, ok: true, result: res });
    } else {
      const res = analyze(grid, req.cells, req.mask);
      ctx.postMessage({ id: req.id, ok: true, result: res });
    }
  } catch (err) {
    ctx.postMessage({ id: req.id, ok: false, error: String(err) });
  }
};
