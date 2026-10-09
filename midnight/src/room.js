import {createGame, applyAction, playerView, legalActions} from './rules.js';
import {botAction} from './bot.js';

// Midnight Table in a friend room: a duel, or both people as one 'team' seat
// against the dealer or an AI. Simultaneous choices stay sealed in the views.
export default {
  controllers: setup => setup.team ? ['team', setup.opponent] : ['host', 'guest'],
  create: (setup, {seed}) => createGame(setup.type, seed),
  finished: state => state.phase === 'over',
  between: state => state.phase === 'reveal',
  nextSeat: () => 0,
  acting: state => [0, 1].filter(seat => legalActions(state, seat).length),
  view: (state, seat) => playerView(state, seat),
  apply: (state, seat, action) => applyAction(state, seat, action),
  bot: (state, seat) => botAction(playerView(state, seat), seat),
};
