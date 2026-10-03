import { handle } from './brain.js';

self.onmessage = e => {
  const { id, ...msg } = e.data;
  try { self.postMessage({ id, result: handle(msg) }); }
  catch (err) { self.postMessage({ id, error: String(err && err.stack || err) }); }
};
