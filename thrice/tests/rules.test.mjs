import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, applyAction, playerView, legalActions, hasWon, DEAL} from '../src/rules.js';
import {botAction, memory} from '../src/bot.js';
import room from '../src/room.js';

const total = state => state.hands.flat().length + state.middle.filter(c => !c.taken).length + state.trios.flat().length * 3;
function play(seats, seed, mode = 'simple', difficulty = 'normal') {
  let state = createGame({seats, mode}, seed), steps = 0;
  while (state.phase === 'playing') {
    state = applyAction(state, state.turn, botAction(state, state.turn, {difficulty}));
    assert.equal(total(state), 36, 'Cards are never created or lost');
    for (const hand of state.hands) assert.deepEqual(hand, hand.slice().sort((a, b) => a - b), 'Hands stay sorted');
    assert(++steps < 4000, 'Games finish');
  }
  return state;
}

test('deals the right number of cards for every table size', () => {
  for (const [seats, [hand, middle]] of Object.entries(DEAL)) {
    const state = createGame({seats: Number(seats)}, 3);
    assert(state.hands.every(h => h.length === hand));
    assert.equal(state.middle.length, middle);
    assert.equal(total(state), 36);
  }
});

test('bots finish hundreds of seeded games with a legal winner', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const seats = 2 + seed % 5, mode = seed % 2 ? 'spicy' : 'simple';
    const state = play(seats, seed, mode, ['easy', 'normal', 'hard'][seed % 3]);
    assert(hasWon(state.trios[state.winner], mode));
    assert(state.trios.every((t, seat) => seat === state.winner || !hasWon(t, mode)));
  }
});

test('a mismatch returns every revealed card and ends the turn', () => {
  let state = createGame({seats: 3, starter: 0}, 11);
  const before = structuredClone(state.hands);
  const first = {kind: 'reveal', from: 'hand', seat: 0, end: 'low'};
  state = applyAction(state, 0, first);
  const other = legalActions(state).find(a => a.from === 'hand' && a.seat === 1 && state.hands[1][0] !== state.hands[0][0])
    || legalActions(state).find(a => a.from === 'middle' && state.middle[a.index].value !== state.hands[0][0]);
  state = applyAction(state, 0, other);
  assert.equal(state.turn, 1);
  assert.deepEqual(state.hands, before);
  assert.equal(state.last.result, 'miss');
  assert.equal(state.reveal.length, 0);
});

test('asking the same end twice shows the next card of that hand', () => {
  let state = createGame({seats: 3, starter: 0}, 5);
  state.hands[1] = [4, 4, 9, 10, 11, 12, 12, 12, 12].slice(0, 9);
  state = applyAction(state, 0, {kind: 'reveal', from: 'hand', seat: 1, end: 'low'});
  state = applyAction(state, 0, {kind: 'reveal', from: 'hand', seat: 1, end: 'low'});
  assert.deepEqual(state.reveal.map(c => c.value), [4, 4]);
  assert.equal(playerView(state, 1).hand.length, 7);
});

test('trios win by the simple and spicy rules', () => {
  assert(hasWon([7], 'simple') && hasWon([7], 'spicy'));
  assert(hasWon([1, 2, 3], 'simple') && !hasWon([1, 2, 3], 'spicy'));
  assert(hasWon([3, 4], 'spicy') && hasWon([2, 9], 'spicy') && !hasWon([2, 3], 'spicy'));
});

test('views hide other hands and face-down middle cards', () => {
  let state = createGame({seats: 4}, 9);
  const view = playerView(state, 1);
  assert.deepEqual(view.hand, state.hands[1]);
  assert(!('hands' in view));
  assert(view.middle.every(m => !('value' in m)));
  assert(!('history' in view));
  assert(!('seed' in view) && !('rng' in view) && !('log' in view));
  assert(Array.isArray(playerView(state, 1, {memoryAid: true}).history));
  state = play(4, 9);
  assert.equal(playerView(state, 2).hands.length, 4, 'Hands are shown at the end');
});

test('bot memory only uses public information', () => {
  const state = createGame({seats: 3, starter: 1}, 21);
  const mind = memory(state, 1, 'hard');
  assert.equal(mind.middle.size, 0);
  assert(mind.ends.every(side => !side.low.length && !side.high.length));
  // Changing hidden cards never changes a bot's first choice from a fresh table.
  const other = structuredClone(state); other.hands[2] = other.hands[2].slice().reverse().sort((a, b) => a - b);
  [other.middle[0], other.middle[1]] = [other.middle[1], other.middle[0]];
  assert.deepEqual(botAction(other, 1), botAction(state, 1));
});

test('the room engine seats two people and the requested bots', () => {
  const setup = {mode: 'spicy', bots: 2, difficulty: 'hard', memoryAid: true, theme: 'sea'};
  const seats = room.controllers(setup);
  assert.deepEqual(seats, ['host', 'guest', 'dealer', 'dealer']);
  const state = room.create(setup, {seed: 4, seats});
  assert.equal(state.seats, 4);
  assert(Array.isArray(room.view(state, 0, setup).history));
});
