// Promise API around the engine worker (falls back to the main thread).
let worker = null, broken = false, nextId = 1;
const pending = new Map();

function start() {
  if (worker || broken) return;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = e => {
      const { id, result, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      error ? p.reject(new Error(error)) : p.resolve(result);
    };
    worker.onerror = e => {
      console.warn('Engine worker failed, using main thread', e.message);
      broken = true; worker = null;
      for (const [id, p] of pending) { pending.delete(id); local(p.msg).then(p.resolve, p.reject); }
    };
  } catch { broken = true; worker = null; }
}

async function local(msg) {
  const { handle } = await import('./brain.js');
  await new Promise(r => setTimeout(r, 0));
  return handle(msg);
}

export function ask(cmd, payload) {
  start();
  const msg = { cmd, ...payload };
  if (!worker) return local(msg);
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject, msg });
    worker.postMessage({ id, ...msg });
  });
}
