import { chooseMove } from './chess.js';
self.onmessage = ({ data }) => {
  try { self.postMessage({ id: data.id, move: chooseMove(data.state, data.level) }); }
  catch { self.postMessage({ id: data.id, move: null }); }
};
