import test from 'node:test';
import assert from 'node:assert/strict';
import {WORDS, BANK, PACKS, fold} from '../src/words.js';
import {createGame, applyAction, playerView, actingSeat, clueProblem, remaining, duoFound} from '../src/rules.js';
import {botAction, relation} from '../src/bot.js';
import {nextFromPlan} from '../src/ai.js';
import room, {lineup} from '../src/room.js';
import setup from '../src/room-setup.js';

const play = state => { let steps = 0; while (state.phase !== 'over') { state = applyAction(state, actingSeat(state), botAction(state, actingSeat(state))); assert(++steps < 600); } return state; };

test('both languages have every pack with enough words and associations', () => {
  for (const lang of ['en', 'fr']) {
    for (const pack of Object.keys(PACKS)) assert(WORDS[lang][pack].length >= 40, lang + ' ' + pack);
    assert(WORDS[lang].all.length >= 240);
    for (const [word, list] of Object.entries(BANK[lang])) assert(list.length >= 3 && !list.map(fold).includes(fold(word)), word);
    assert.equal(new Set(WORDS[lang].all.map(fold)).size, WORDS[lang].all.length, 'No duplicate words in ' + lang);
  }
});

test('teams deal 9, 8, 7 and one assassin, and bots finish hundreds of games', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const state = createGame({mode: 'teams', lang: seed % 2 ? 'fr' : 'en', pack: Object.keys(PACKS)[seed % 6]}, seed);
    const counts = c => state.key.filter(k => k === c).length;
    assert.deepEqual([counts(state.team), counts(state.team === 'red' ? 'blue' : 'red'), counts('neutral'), counts('assassin')], [9, 8, 7, 1]);
    const end = play(state);
    assert(['red', 'blue'].includes(end.winner));
    if (end.result === 'agents') assert.equal(remaining(end, end.winner), 0);
  }
});

test('duo keys have 15 agents and three assassins per side', () => {
  const state = createGame({mode: 'duo'}, 3);
  const agents = state.words.map((_, i) => state.keys[0][i] === 'agent' || state.keys[1][i] === 'agent').filter(Boolean).length;
  assert.equal(agents, 15);
  for (const side of [0, 1]) {
    assert.equal(state.keys[side].filter(k => k === 'agent').length, 9);
    assert.equal(state.keys[side].filter(k => k === 'assassin').length, 3);
  }
  for (let seed = 1; seed <= 100; seed++) {
    const end = play(createGame({mode: 'duo', lang: seed % 2 ? 'fr' : 'en', turns: 11}, seed));
    assert(end.winner === 'team' ? duoFound(end) === 15 : ['assassin', 'time'].includes(end.result));
  }
});

test('clues must be one word that is not on the board or too close to one', () => {
  const state = createGame({mode: 'teams', lang: 'fr'}, 9), word = state.words[0];
  assert(clueProblem(state, word));
  assert(clueProblem(state, word.toUpperCase()));
  assert(clueProblem(state, 'deux mots'));
  assert(clueProblem(state, word + 'tion'));
  assert.equal(clueProblem(state, 'zzzzq'), null);
  assert.throws(() => applyAction(state, actingSeat(state), {kind: 'clue', word: 'zzzzq', number: 0}), /1 to 9/);
});

test('operatives may guess the number plus one, and passing needs a guess', () => {
  let state = createGame({mode: 'teams'}, 12);
  const spy = actingSeat(state), team = state.team;
  state = applyAction(state, spy, {kind: 'clue', word: 'zzzzq', number: 1});
  assert.throws(() => applyAction(state, spy + 1, {kind: 'pass'}), /at least one/);
  const mine = state.key.map((c, i) => c === team ? i : -1).filter(i => i >= 0);
  state = applyAction(state, spy + 1, {kind: 'guess', index: mine[0]});
  assert.equal(state.phase, 'guess');
  state = applyAction(state, spy + 1, {kind: 'guess', index: mine[1]});
  assert.equal(state.phase, 'clue', 'The bonus guess ends the turn');
  assert.notEqual(state.team, team);
});

test('the assassin ends the game for the guessing team', () => {
  let state = createGame({mode: 'teams'}, 14);
  const spy = actingSeat(state), team = state.team;
  state = applyAction(state, spy, {kind: 'clue', word: 'zzzzq', number: 2});
  state = applyAction(state, spy + 1, {kind: 'guess', index: state.key.indexOf('assassin')});
  assert.equal(state.phase, 'over'); assert.notEqual(state.winner, team); assert.equal(state.result, 'assassin');
});

test('views show the key only to spymasters and each duo partner their own side', () => {
  const teams = createGame({mode: 'teams'}, 2);
  assert(playerView(teams, 0).key && playerView(teams, 2).key);
  assert(!('key' in playerView(teams, 1)) && !('key' in playerView(teams, 3)));
  const duo = createGame({mode: 'duo'}, 2);
  assert.deepEqual(playerView(duo, 0).myKey, duo.keys[0]);
  assert(!JSON.stringify(playerView(duo, 1)).includes(JSON.stringify(duo.keys[0])));
  assert(!('keys' in playerView(duo, 1)) && !('seed' in playerView(duo, 1)));
});

test('the bot never clues toward the assassin and finds its own words', () => {
  let assassins = 0;
  for (let seed = 1; seed <= 200; seed++) assassins += play(createGame({mode: 'teams'}, seed)).result === 'assassin';
  assert(assassins <= 4, 'Bots rarely hit the assassin: ' + assassins);
  assert.equal(relation('en', 'honey', 'bee'), 3);
  assert.equal(relation('fr', 'miel', 'abeille'), 3);
  assert.equal(relation('en', 'zzzzq', 'bee'), 0);
});

test('an AI guess plan is played one word at a time and ends with a pass', () => {
  let state = createGame({mode: 'teams'}, 21);
  const spy = actingSeat(state), team = state.team, mine = state.key.map((c, i) => c === team ? i : -1).filter(i => i >= 0);
  state = applyAction(state, spy, {kind: 'clue', word: 'zzzzq', number: 1});
  const plan = {guesses: [mine[0]]};
  const first = nextFromPlan(playerView(state, spy + 1), plan);
  assert.deepEqual(first, {kind: 'guess', index: mine[0]});
  state = applyAction(state, spy + 1, first);
  assert.deepEqual(nextFromPlan(playerView(state, spy + 1), plan), {kind: 'pass'});
});

test('room lineups seat both people as asked', () => {
  const base = {mode: 'teams', lang: 'en', pack: 'all', others: 'dealer'};
  assert.deepEqual(lineup({mode: 'duo'}), ['host', 'guest']);
  assert.deepEqual(lineup({...base, lineup: 'together', role: 'spy'}), ['host', 'guest', 'dealer', 'dealer']);
  assert.deepEqual(lineup({...base, lineup: 'together', role: 'op'}), ['guest', 'host', 'dealer', 'dealer']);
  assert.deepEqual(lineup({...base, lineup: 'spymasters', others: 'model'}), ['host', 'model', 'guest', 'model']);
  assert.deepEqual(lineup({...base, lineup: 'operatives'}), ['dealer', 'host', 'dealer', 'guest']);
  assert.equal(room.prepare({...base, lineup: 'together', role: 'spy'}, 'guest').role, 'op', 'A guest creator keeps the role they chose');
  assert.throws(() => setup.validate({mode: 'teams', lineup: 'chaos'}));
  assert.deepEqual(setup.validate({mode: 'duo', lineup: 'spymasters'}), {mode: 'duo', lang: 'en', pack: 'all', turns: 9});
});
