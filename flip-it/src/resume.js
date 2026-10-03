import {assertState, playerView, optionsFor} from './rules.js';
import {validateView} from './session.js';

const KEY = 'flip-it.last-table.v2';
// Saves stay on this browser. Pairing tokens and relay credentials are never saved.
export function saveTable(session, storage) {
  try {
    storage ||= globalThis.localStorage;
    if (!session?.view) return;
    storage.setItem(KEY, JSON.stringify({version: 2, savedAt: Date.now(), seat: session.seat,
      team: session.team, members: session.members, controllers: session.controllers,
      view: session.view, state: session.seat === 0 ? session.state : null}));
  } catch { /* Storage is optional, including in private browsing. */ }
}
export function forgetTable(storage) {
  try { (storage || globalThis.localStorage).removeItem(KEY); } catch {}
}
export function loadTable(storage) {
  try {
    storage ||= globalThis.localStorage;
    const raw = storage.getItem(KEY);
    if (!raw || raw.length > 250000) return null;
    const saved = JSON.parse(raw);
    if (saved.version !== 2 || ![0, 1].includes(saved.seat) || typeof saved.team !== 'boolean' ||
        !Array.isArray(saved.members) || saved.members.length !== 2 || saved.members.some(n => typeof n !== 'string' || n.length > 24) ||
        !Array.isArray(saved.controllers) || saved.controllers.length < 2 || saved.controllers.length > 5 ||
        saved.controllers.some((t, i) => i < (saved.team ? 1 : 2) ? t !== 'human' : !['model', 'dealer'].includes(t))) return null;
    const visibleSeat = saved.team ? 0 : saved.seat;
    validateView(saved.view, visibleSeat);
    if (saved.controllers.length !== saved.view.hands.length) return null;
    if (saved.seat === 0) {
      assertState(saved.state); optionsFor(saved.state.options);
      if (!Number.isInteger(saved.state.seed) || !Number.isInteger(saved.state.starter) ||
          typeof saved.state.opening !== 'boolean' || !saved.state.visits || typeof saved.state.visits !== 'object' || Array.isArray(saved.state.visits) ||
          Object.values(saved.state.visits).some(n => !Number.isInteger(n) || n < 1) ||
          JSON.stringify(playerView(saved.state, 0)) !== JSON.stringify(saved.view)) return null;
    } else if (saved.state !== null) return null;
    return saved;
  } catch { return null; }
}
