import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, applyAction, playerView, legalActions, reserve, winner} from '../src/rules.js';
import {botAction} from '../src/bot.js';

test('seeded games are reproducible and reducers do not mutate their inputs', () => {
  for (const type of ['backhand', 'closing', 'heist']) {
    const a = createGame(type, 901), b = createGame(type, 901);
    assert.deepEqual(a, b);
    const before = structuredClone(a);
    applyAction(a, 0, legalActions(a, 0)[0]);
    assert.deepEqual(a, before);
  }
});
test('Backhand scores a win, exchanges identities and carries ties', () => {
  let s = createGame('backhand', 1);
  const prize = s.prizes[0];
  s = applyAction(s, 0, {kind: 'bid', card: 'b05'});
  s = applyAction(s, 1, {kind: 'bid', card: 'b12'});
  assert.deepEqual(s.scores, [prize, 0]);
  assert(s.hands[0].some(c => c.id === 'b12'));
  assert(s.hands[1].some(c => c.id === 'b05'));
  s = applyAction(s, 0, {kind: 'next'});
  const second = s.prizes[1];
  s = applyAction(s, 0, {kind: 'bid', card: 'b03'});
  s = applyAction(s, 1, {kind: 'bid', card: 'b13'});
  assert.equal(s.carry, second);
});
test('Backhand discards a tied final pot and ends after nine rounds', () => {
  let s = createGame('backhand', 22);
  for (let i = 0; i < 9; i++) {
    const one = s.hands[0].find(c => c.value === 1);
    const two = s.hands[1].find(c => c.value === 1);
    s = applyAction(s, 0, {kind: 'bid', card: one.id});
    s = applyAction(s, 1, {kind: 'bid', card: two.id});
    if (i < 8) s = applyAction(s, 0, {kind: 'next'});
  }
  assert.equal(s.phase, 'over');
  assert.equal(s.result.discarded, 18);
  assert.equal(winner(s), null);
});
test('Closing Time forbids advancing the invested auction and honors tie priority', () => {
  let s = createGame('closing', 5);
  const [a, b] = s.auctions;
  s = applyAction(s, 0, {kind: 'cube', to: a.id});
  assert.throws(() => applyAction(s, 0, {kind: 'tick', lot: a.id}), /different/);
  s = applyAction(s, 0, {kind: 'tick', lot: b.id});
  s = applyAction(s, 1, {kind: 'cube', to: a.id});
  s = applyAction(s, 1, {kind: 'tick', lot: b.id});
  s = applyAction(s, 0, {kind: 'skip'});
  s = applyAction(s, 0, {kind: 'tick', lot: a.id});
  s = applyAction(s, 1, {kind: 'skip'});
  s = applyAction(s, 1, {kind: 'tick', lot: a.id});
  s = applyAction(s, 0, {kind: 'skip'});
  s = applyAction(s, 0, {kind: 'tick', lot: a.id});
  assert.equal(s.scores[0], a.value);
  assert.equal(reserve(s, 0), 5);
  assert.equal(reserve(s, 1), 5);
});
test('Heist has the correct safe, caught and clean-raid payouts and consumes defenses', () => {
  for (const choice of ['safe', 'raid']) {
    let s = createGame('heist', 91);
    const initial = structuredClone(s.loot);
    s = applyAction(s, 0, {kind: 'guard', card: 'h03'}); // bluff
    s = applyAction(s, 1, {kind: 'guard', card: 'h10'}); // alarm
    s = applyAction(s, 0, {kind: 'raid', choice});
    s = applyAction(s, 1, {kind: 'raid', choice});
    const total = initial.flat().reduce((n, c) => n + c.value, 0);
    assert.equal(s.scores.reduce((a, b) => a + b), total);
    assert.equal(s.hands[0].length, 5);
    assert.equal(s.hands[1].length, 5);
    if (choice === 'raid') assert.deepEqual(s.scores, [0, total]);
    else assert.equal(s.scores[0], initial[0][1].value + initial[1][0].value);
    assert.deepEqual(s.used, [['bluff'], ['alarm']]);
  }
});
test('private decks, hands and choices are removed from opponent snapshots', () => {
  let b = createGame('backhand', 7);
  b = applyAction(b, 0, {kind: 'bid', card: 'b05'});
  const bv = playerView(b, 1);
  assert.equal(bv.pending[0], true);
  assert.deepEqual(bv.hands[0], Array(5).fill({hidden: true}));
  for (const key of ['prizes', 'rng', 'seed']) assert(!Object.hasOwn(bv, key));
  let h = createGame('heist', 7);
  h = applyAction(h, 0, {kind: 'guard', card: 'h00'});
  const hv = playerView(h, 1);
  assert.equal(hv.guards[0], true);
  assert(!JSON.stringify(hv.hands[0]).includes('alarm'));
  assert(!Object.hasOwn(hv, 'deck'));
  assert(!Object.hasOwn(playerView(createGame('closing'), 1), 'deck'));
});
test('illegal, duplicate and out-of-turn choices are rejected', () => {
  let s = createGame('backhand');
  assert.throws(() => applyAction(s, 0, {kind: 'bid', card: 'b15'}));
  s = applyAction(s, 0, {kind: 'bid', card: 'b05'});
  assert.throws(() => applyAction(s, 0, {kind: 'bid', card: 'b04'}));
  assert.throws(() => applyAction(createGame('closing'), 1, {kind: 'skip'}));
  assert.throws(() => applyAction(createGame('heist'), 0, {kind: 'guard', card: 'h10'}));
});
test('1,500 automated playthroughs conserve cards/cubes/points and always finish', () => {
  let randomState = 71;
  const random = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296; };
  for (const type of ['backhand', 'closing', 'heist']) {
    for (let seed = 0; seed < 500; seed++) {
      let s = createGame(type, seed);
      let moves = 0;
      while (s.phase !== 'over') {
        assert(moves++ < 100);
        if (s.phase === 'reveal') { s = applyAction(s, 0, {kind: 'next'}); continue; }
        const player = type === 'closing' ? s.turn : legalActions(s, 0).length ? 0 : 1;
        const choices = legalActions(s, player);
        const action = seed % 5 === 0 ? botAction(s, player, random) : choices[Math.floor(random() * choices.length)];
        assert(action);
        s = applyAction(s, player, action);
        if (type === 'backhand') {
          assert.equal(new Set(s.hands.flat().map(c => c.id)).size, 10);
          assert.deepEqual(s.hands.map(h => h.length), [5, 5]);
        }
        if (type === 'closing') for (const p of [0, 1]) assert(reserve(s, p) >= 0 && reserve(s, p) <= 5);
      }
      if (type === 'closing') { assert.equal(s.ticks, 27); assert.equal(s.closed, 9); assert(s.scores[0] + s.scores[1] <= 18); }
      if (type === 'backhand') { assert.equal(s.log.length, 9); assert.equal(s.scores[0] + s.scores[1] + s.result.discarded, 18); }
      if (type === 'heist') { assert.equal(s.log.length, 5); assert.deepEqual(s.hands.map(h => h.length), [1, 1]); assert.equal(s.scores[0] + s.scores[1], s.log.reduce((n, r) => n + r.gain[0] + r.gain[1], 0)); }
    }
  }
});
