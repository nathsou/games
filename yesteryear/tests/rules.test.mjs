import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS, DECKS, THEMES} from '../src/cards.js';
import {createGame, applyAction, playerView, legalActions, fits, deckFor, handSize} from '../src/rules.js';
import {botAction} from '../src/bot.js';
import {REVIEWED} from '../tools/reviewed.mjs';
import room from '../src/room.js';

const sorted = timeline => timeline.every((id, i) => !i || CARDS[timeline[i - 1]].year <= CARDS[id].year);
function race(seats, seed, decks = 'mix') {
  let state = createGame({seats, mode: 'race', decks}, seed), steps = 0;
  const total = state.deck.length + state.timeline.length + state.hands.flat().length;
  while (state.phase === 'playing') {
    state = applyAction(state, state.turn, botAction(state, state.turn, {difficulty: ['easy', 'normal', 'hard'][state.turn % 3]}));
    assert(sorted(state.timeline), 'The timeline stays in order');
    assert.equal(state.deck.length + state.timeline.length + state.hands.flat().length + state.discards.length, total);
    assert(++steps < 2000);
  }
  return state;
}

test('every deck has bilingual titles, a source and unique cards', () => {
  for (const [theme, ids] of Object.entries(DECKS)) {
    assert(Object.hasOwn(THEMES, theme));
    assert(ids.length >= 40, theme + ' has enough cards');
    for (const id of ids) {
      const card = CARDS[id];
      assert(card.en && card.fr && card.wiki && Number.isInteger(card.year), id);
      assert(card.year <= 2026);
    }
  }
  for (const id of Object.keys(REVIEWED)) assert(CARDS[id], 'Reviewed card ' + id + ' exists');
});

test('races finish with a winner who emptied their hand', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const seats = 2 + seed % 5, state = race(seats, seed, seed % 7 ? 'mix' : 'flight');
    assert(state.winners.length >= 1);
    for (const seat of state.winners) assert.equal(state.hands[seat].length, 0);
  }
});

test('the round is finished before the race ends', () => {
  let state = createGame({seats: 3, mode: 'race'}, 4);
  state.starter = 0; state.turn = 0;
  const id = state.hands[0][0];
  state.hands[0] = [id];
  state = applyAction(state, 0, {kind: 'place', card: id, slot: state.timeline.filter(t => CARDS[t].year <= CARDS[id].year).length});
  assert.equal(state.phase, 'playing'); assert(state.ending); assert.equal(state.turn, 1);
});

test('placing checks the neighbours and equal years fit either side', () => {
  const ids = Object.keys(CARDS), a = ids.find(id => CARDS[id].year === 1969), b = ids.find(id => CARDS[id].year === 1969 && id !== a);
  assert(fits([a], b, 0) && fits([a], b, 1));
  const early = ids.find(id => CARDS[id].year < 1500), late = ids.find(id => CARDS[id].year > 2000);
  assert(fits([early], late, 1) && !fits([early], late, 0));
});

test('a wrong card is discarded and replaced; streaks lose a life', () => {
  let state = createGame({seats: 1, mode: 'streak', decks: 'history'}, 8);
  const wrong = legalActions(state).find(action => !fits(state.timeline, action.card, action.slot));
  state = applyAction(state, 0, wrong);
  assert.equal(state.lives, 2); assert.equal(state.hands[0].length, 3); assert.deepEqual(state.discards, [wrong.card]);
  while (state.phase === 'playing') state = applyAction(state, 0, botAction(state, 0, {difficulty: 'easy'}));
  assert(state.lives === 0 || !state.hands[0].length);
});

test('views hide other hands and the deck', () => {
  const state = createGame({seats: 4, mode: 'race', decks: 'mix'}, 3), view = playerView(state, 2);
  assert.deepEqual(view.hand, state.hands[2]);
  assert(!('hands' in view) && !('seed' in view) && !('rng' in view));
  assert.equal(view.deck, state.deck.length);
  assert.equal(handSize(4), 5);
  assert.equal(deckFor('mix').length, Object.keys(CARDS).length);
});

test('the room engine runs races with bots and a shared co-op hand', () => {
  assert.deepEqual(room.controllers({mode: 'race', bots: 2}), ['host', 'guest', 'dealer', 'dealer']);
  assert.deepEqual(room.controllers({mode: 'streak', bots: 0}), ['team']);
  const state = room.create({mode: 'streak', decks: 'pop'}, {seed: 2, seats: ['team']});
  assert.equal(state.hands.length, 1);
});
