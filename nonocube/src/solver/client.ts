import type { Dims } from '../core/grid.ts';
import type { Difficulty } from '../core/types.ts';
import type { Analysis, GenResult } from './generator.ts';

type Pending = { resolve: (v: never) => void; reject: (e: unknown) => void };

/** Promise-based wrapper around the solver web worker. */
class SolverClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  private get w(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
        const p = this.pending.get(e.data.id);
        if (!p) return;
        this.pending.delete(e.data.id);
        if (e.data.ok) p.resolve(e.data.result as never);
        else p.reject(new Error(e.data.error));
      };
    }
    return this.worker;
  }

  private call<T>(msg: Record<string, unknown>): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: never) => void, reject });
      this.w.postMessage({ ...msg, id });
    });
  }

  generate(dims: Dims, cells: Uint8Array, difficulty: Difficulty, seed: string, budgetMs?: number): Promise<GenResult> {
    return this.call({ type: 'generate', dims, cells, difficulty, seed, budgetMs });
  }

  analyze(dims: Dims, cells: Uint8Array, mask: Uint8Array): Promise<Analysis> {
    return this.call({ type: 'analyze', dims, cells, mask });
  }

  /** Drop any in-flight work (e.g. editor changed again). */
  restart(): void {
    if (this.worker) this.worker.terminate();
    this.worker = null;
    for (const p of this.pending.values()) p.reject(new Error('cancelled'));
    this.pending.clear();
  }
}

export const solverClient = new SolverClient();
