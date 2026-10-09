import {createGame, applyAction, playerView} from './rules.js';
import {botAction} from './bot.js';

// Yesteryear in a friend room: a race between both people and any bots, or a
// co-op streak where both play from one shared hand.
export default {
  controllers: setup => setup.mode === 'streak' ? ['team'] : ['host', 'guest', ...Array(setup.bots).fill('dealer')],
  create: (setup, {seed, seats}) => createGame({seats: seats.length, mode: setup.mode, decks: setup.decks}, seed),
  finished: state => state.phase === 'over',
  acting: state => state.phase === 'playing' ? [state.turn] : [],
  view: (state, seat) => playerView(state, seat),
  apply: (state, seat, action) => applyAction(state, seat, action),
  bot: (state, seat, setup) => botAction(state, seat, {difficulty: setup.difficulty}),
};
