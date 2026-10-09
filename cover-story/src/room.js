import {createGame, applyAction, playerView, actingSeat} from './rules.js';
import {botAction} from './bot.js';

// Cover Story in a friend room. Duo seats both people as partners. Teams seat
// them by lineup; every other role is the rules bot or the creator's AI:
// together (one team, host's role chosen at setup), rival spymasters, or rival
// operatives. setup.role is the host's role in the 'together' lineup.
export function lineup(setup) {
  if (setup.mode === 'duo') return ['host', 'guest'];
  const ai = setup.others;
  if (setup.lineup === 'spymasters') return ['host', ai, 'guest', ai];
  if (setup.lineup === 'operatives') return [ai, 'host', ai, 'guest'];
  return setup.role === 'spy' ? ['host', 'guest', ai, ai] : ['guest', 'host', ai, ai];
}
export default {
  controllers: lineup,
  prepare: (setup, creator) => creator === 'guest' && setup.mode === 'teams' && setup.lineup === 'together' ? {...setup, role: setup.role === 'spy' ? 'op' : 'spy'} : setup,
  create: (setup, {seed}) => createGame({mode: setup.mode, lang: setup.lang, pack: setup.pack, turns: setup.turns}, seed),
  finished: state => state.phase === 'over',
  acting: state => state.phase === 'over' ? [] : [actingSeat(state)],
  view: (state, seat) => playerView(state, seat),
  apply: (state, seat, action) => applyAction(state, seat, action),
  bot: (state, seat) => botAction(state, seat),
};
