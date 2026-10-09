import {createGame, playClue, eliminate, viewFor} from './game.js';

// Cluance in a friend room. Seat 0 is the host and seat 1 the guest; setup.role
// is the host's role, so the guest always holds the other one.
const giverSeat = setup => setup.role === 'giver' ? 0 : 1;
const roleOf = (setup, seat) => seat === giverSeat(setup) ? 'giver' : 'guesser';
export default {
  controllers: () => ['host', 'guest'],
  // The creator chooses their own role; stored roles are the host's.
  prepare: (setup, creator) => creator === 'guest' ? {...setup, role: setup.role === 'giver' ? 'guesser' : 'giver'} : setup,
  create: setup => createGame(setup.options),
  finished: state => state.phase === 'over',
  acting: (state, setup) => state.phase === 'over' ? [] : [state.phase === 'clue' ? giverSeat(setup) : 1 - giverSeat(setup)],
  view: (state, seat, setup) => viewFor(state, roleOf(setup, seat)),
  apply: (state, seat, action, setup) => roleOf(setup, seat) === 'giver' ? playClue(state, action) : eliminate(state, action),
  decorate: (record, seat) => ({role: roleOf(record.setup, seat)}),
  waitMessage: 'Wait for your friend’s turn.',
};
