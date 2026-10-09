import {createGame, applyAction, playerView, acting, fresh} from './rules.js';

// Ripples in a friend room: both people on one shared board, or a race on two
// boards of the same grid. There are no bots: it is a puzzle.
export default {
  controllers: setup => setup.mode === 'race' ? ['host', 'guest'] : ['team'],
  create: (setup, {seed}) => createGame({puzzle: setup.puzzle, mode: setup.mode, assist: setup.assist}, seed),
  finished: state => state.phase === 'over',
  acting: state => acting(state),
  view: (state, seat) => playerView(state, seat),
  apply: (state, seat, action) => applyAction(state, seat, action),
  fresh,
};
