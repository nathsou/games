import {createGame, applyAction, playerView} from './rules.js';
import {botAction} from './bot.js';

// Thrice in a friend room: both people plus up to four rules bots, which play
// from the public reveal log like anyone at the table.
export default {
  controllers: setup => ['host', 'guest', ...Array(setup.bots).fill('dealer')],
  create: (setup, {seed, seats}) => createGame({seats: seats.length, mode: setup.mode}, seed),
  finished: state => state.phase === 'over',
  acting: state => state.phase === 'playing' ? [state.turn] : [],
  view: (state, seat, setup) => playerView(state, seat, {memoryAid: setup.memoryAid}),
  apply: (state, seat, action) => applyAction(state, seat, action),
  bot: (state, seat, setup) => botAction(state, seat, {difficulty: setup.difficulty}),
};
