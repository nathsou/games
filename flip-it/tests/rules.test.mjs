import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch, makeDeck, optionsFor, applyAction, playerView, legalActions, valueOf, assertState} from '../src/rules.js';
import {botAction} from '../src/bot.js';
import {validateView} from '../src/session.js';

function fixture({hands = [[2], [3]], table = [[[], []], [[], []]], options = {}, turn = 0, beat = 0, pending = null} = {}) {
  const state = createMatch(options, 7), pool = makeDeck(state.options.compactDeck);
  function take(rank) {
    const index = pool.findIndex(c => c.ends.includes(rank));
    assert.ok(index >= 0, 'fixture has enough cards');
    const card = pool.splice(index, 1)[0]; card.face = card.ends.indexOf(rank); return card;
  }
  state.hands = hands.map(hand => hand.map(take)); state.table = table.map(row => row.map(set => set.map(take)));
  state.discard = pool; state.turn = turn; state.beat = beat; state.pending = pending; state.visits = {};
  return state;
}
test('Both decks have balanced ranks and four possible reverse values per rank', () => {
  for (const compact of [true, false]) {
    const deck = makeDeck(compact), ranks = compact ? 6 : 10;
    assert.equal(deck.length, ranks * 4);
    for (let rank = 1; rank <= ranks; rank++) {
      assert.equal(deck.filter(c => c.ends.includes(rank)).length, 8);
      assert.equal(new Set(deck.filter(c => c.ends.includes(rank)).map(c => c.ends.find(v => v !== rank))).size, 4);
    }
    const state = createMatch({compactDeck: compact}, 13);
    assert.equal(state.hands[0].length, deck.length / 2); assertState(state);
    assert.deepEqual(state, createMatch({compactDeck: compact}, 13));
  }
});
test('Options are independent, strict booleans, and default to the recommended preset', () => {
  assert.deepEqual(optionsFor(), {quickTurns: true, compactDeck: true, lastChance: true});
  assert.throws(() => optionsFor({compactDeck: 'false'})); assert.throws(() => optionsFor({unknown: true}));
});
test('A higher matching-size set returns the opponent cards flipped', () => {
  const state = fixture({hands: [[5, 5, 1], [2]], table: [[[], []], [[3, 3], []]]}), old = state.table[1][0];
  const next = applyAction(state, 0, {kind: 'play', lane: 0, cards: state.hands[0].filter(c => valueOf(c) === 5).map(c => c.id)});
  assert.equal(next.table[1][0].length, 0); assert.equal(next.hands[1].length, 3);
  for (const card of old) assert.equal(next.hands[1].find(c => c.id === card.id).face, 1 - card.face);
  assertState(next);
});
test('Illegal moves are atomic, including cashing out the selected space', () => {
  const state = fixture({hands: [[3, 1], [2]], table: [[[1], []], [[], [4, 4]]]}), before = structuredClone(state);
  assert.throws(() => applyAction(state, 0, {kind: 'play', lane: 0, cards: state.hands[0].map(c => c.id)}));
  assert.deepEqual(state, before); assert.throws(() => applyAction(state, 1, {kind: 'flip', lane: 0}));
});
test('Adding a card can bounce your own set and prevent an empty-hand win', () => {
  const state = fixture({hands: [[5], [1]], table: [[[], [3, 3]], [[5], []]]});
  const next = applyAction(state, 0, {kind: 'add', lane: 0, target: 0, cards: [state.hands[0][0].id]});
  assert.equal(next.table[1][0].length, 2); assert.equal(next.table[0][1].length, 0);
  assert.equal(next.hands[0].length, 2); assert.equal(next.pending, null); assertState(next);
});
test('A blocked add is forbidden, and taking transfers the entire set flipped', () => {
  const state = fixture({hands: [[3, 1], [2]], table: [[[], [5, 5]], [[3], []]]});
  assert.throws(() => applyAction(state, 0, {kind: 'add', lane: 0, target: 0, cards: [state.hands[0][0].id]}));
  const card = state.table[1][0][0], next = applyAction(state, 0, {kind: 'take', lane: 0, target: 0});
  assert.equal(next.hands[0].length, 3); assert.equal(next.hands[1].length, 1);
  assert.equal(next.hands[0].find(c => c.id === card.id).face, 1 - card.face); assertState(next);
});
test('Double turns use right then left, with only the right action for the opener', () => {
  let state = createMatch({quickTurns: false}, 123);
  assert.equal(state.turn, 0); assert.equal(state.beat, 1);
  assert.throws(() => applyAction(state, 0, {kind: 'flip', lane: 0}));
  state = applyAction(state, 0, {kind: 'flip', lane: 1}); assert.equal(state.turn, 1); assert.equal(state.beat, 1);
  state = applyAction(state, 1, {kind: 'flip', lane: 1}); assert.equal(state.turn, 1); assert.equal(state.beat, 0);
  state = applyAction(state, 1, {kind: 'flip', lane: 0}); assert.equal(state.turn, 0); assert.equal(state.beat, 1);
});
test('Last chance gives exactly one response, including an interrupted double turn', () => {
  let state = fixture({hands: [[4], [5, 1]], options: {quickTurns: false}, beat: 0});
  state = applyAction(state, 0, {kind: 'play', lane: 0, cards: [state.hands[0][0].id]});
  assert.equal(state.phase, 'playing'); assert.equal(state.pending, 0); assert.equal(state.turn, 1);
  state = applyAction(state, 1, {kind: 'play', lane: 1, cards: [state.hands[1][0].id]});
  assert.equal(state.pending, null); assert.equal(state.hands[0].length, 1); assert.equal(state.phase, 'playing'); assertState(state);
});
test('An uncountered empty hand wins; if both are empty the first finisher wins', () => {
  let state = fixture({hands: [[6], [6]]});
  state = applyAction(state, 0, {kind: 'play', lane: 0, cards: [state.hands[0][0].id]});
  state = applyAction(state, 1, {kind: 'add', lane: 0, target: 0, cards: [state.hands[1][0].id]});
  assert.equal(state.result.winner, 0); assert.equal(state.result.reason, 'survived'); assertState(state);
});
test('A countering final set transfers the last-chance window to the responder', () => {
  let state = fixture({hands: [[4], [5]]});
  state = applyAction(state, 0, {kind: 'play', lane: 0, cards: [state.hands[0][0].id]});
  state = applyAction(state, 1, {kind: 'play', lane: 0, cards: [state.hands[1][0].id]});
  assert.equal(state.pending, 1); assert.equal(state.turn, 0); assertState(state);
});
test('Immediate ending and first-to-two scoring are independent of other options', () => {
  let state = fixture({hands: [[6], [1]], options: {lastChance: false}}); state.scores = [1, 0];
  state = applyAction(state, 0, {kind: 'play', lane: 0, cards: [state.hands[0][0].id]});
  assert.equal(state.phase, 'matchOver'); assert.deepEqual(state.scores, [2, 0]);
  assert.throws(() => applyAction(state, 0, {kind: 'next'}));
});
test('Repeated positions draw and redeal instead of trapping players in a flip loop', () => {
  let state = createMatch({}, 33);
  while (state.phase === 'playing') state = applyAction(state, state.turn, {kind: 'flip', lane: 0});
  assert.equal(state.result.reason, 'repeat'); assert.equal(state.result.winner, null);
  const round = state.round; state = applyAction(state, 0, {kind: 'next'});
  assert.equal(state.round, round + 1); assert.equal(state.turn, 1); assertState(state);
});
test('Views hide opponent ranks and seed, and reject malformed updates', () => {
  const state = createMatch({}, 654);
  for (const seat of [0, 1]) {
    const view = playerView(state, seat); assert.equal(view.seed, undefined); assert.equal(view.visits, undefined);
    assert.ok(view.hands[1 - seat].every(c => Object.keys(c).length === 1 && c.hidden)); validateView(view, seat);
    const bad = structuredClone(view); bad.hands[1 - seat][0] = state.hands[1 - seat][0]; assert.throws(() => validateView(bad, seat));
    const count = structuredClone(view); count.discardCount++; assert.throws(() => validateView(count, seat));
  }
});
test('All eight option combinations survive 400 seeded rounds without losing cards', () => {
  for (let config = 0; config < 8; config++) for (let seed = 1; seed <= 50; seed++) {
    let state = createMatch({quickTurns: !!(config & 1), compactDeck: !!(config & 2), lastChance: !!(config & 4)}, seed), random = seed * 31;
    while (state.phase === 'playing') {
      const moves = legalActions(state); assert.ok(moves.length);
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const plays = moves.filter(a => a.kind === 'play' || a.kind === 'add');
      const candidates = plays.length && random % 5 ? plays : moves;
      state = applyAction(state, state.turn, candidates[random % candidates.length]);
      assertState(state); validateView(playerView(state, 0), 0); validateView(playerView(state, 1), 1);
    }
    assert.ok(state.result);
  }
});
test('The dealer uses a redacted view and makes legal moves for every option combination', () => {
  for (let config = 0; config < 8; config++) {
    let state = createMatch({quickTurns: !!(config & 1), compactDeck: !!(config & 2), lastChance: !!(config & 4)}, config + 70);
    while (state.phase === 'playing') {
      state = applyAction(state, state.turn, botAction(playerView(state, state.turn))); assertState(state);
    }
  }
});
test('Cashing out a chosen space removes its block before the new set is validated', () => {
  const state=fixture({hands:[[2,3],[5]],table:[[[6],[]],[[],[]]]});
  assert.throws(()=>applyAction(state,0,{kind:'play',lane:1,cards:[state.hands[0][0].id]}));
  const next=applyAction(state,0,{kind:'play',lane:0,cards:[state.hands[0][0].id]});
  assert.equal(valueOf(next.table[0][0][0]),2);assert.equal(next.discard.length,state.discard.length+1);assertState(next);
});
test('The action cap draws ordinary play but lets the pending last chance finish', () => {
  let capped=fixture();capped.moves=119;capped=applyAction(capped,0,{kind:'flip',lane:0});
  assert.equal(capped.result.reason,'limit');assert.equal(capped.phase,'roundOver');
  let state=fixture({hands:[[6],[1]],options:{compactDeck:false}});state.moves=179;
  state=applyAction(state,0,{kind:'play',lane:0,cards:[state.hands[0][0].id]});
  assert.equal(state.pending,0);assert.equal(state.phase,'playing');
  state=applyAction(state,1,{kind:'flip',lane:0});
  assert.equal(state.result.reason,'survived');assert.equal(state.moves,181);validateView(playerView(state,1),1);assertState(state);
});
