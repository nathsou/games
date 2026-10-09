import {createMatch, applyAction, playerView} from './rules.js';
import {botAction} from './bot.js';

// Flip It in a friend room: two people (or one shared 'team' hand) plus up to
// four rules bots or AI seats.
export default {
  controllers: setup => [...(setup.team ? ['team'] : ['host', 'guest']), ...setup.aiPlayers],
  create: (setup, {seed, seats}) => createMatch(setup.options, seed, 0, seats.length),
  finished: state => state.phase === 'matchOver',
  between: state => state.phase === 'roundOver',
  acting: state => state.phase === 'playing' ? [state.turn] : [],
  view: (state, seat) => playerView(state, seat),
  apply: (state, seat, action) => applyAction(state, seat, action),
  bot: (state, seat) => botAction(playerView(state, seat), seat),
};
