import test from 'node:test';
import assert from 'node:assert/strict';
import {PUZZLES, PUZZLE, CAMPAIGNS, fold} from '../src/puzzles.js';
import {createGame, applyAction, playerView, solution, aligned, leftover, checkAnswer, steps, layout} from '../src/rules.js';
import room from '../src/room.js';
import setup from '../src/room-setup.js';

test('every puzzle has 25 distinct words, equal chains and an odd rebus', () => {
  assert(PUZZLES.filter(p => p.lang === 'en').length >= 9 && PUZZLES.filter(p => p.lang === 'fr').length >= 9);
  for (const puzzle of PUZZLES) {
    const words = [...puzzle.chains[0], ...puzzle.chains[1], ...puzzle.rebus];
    assert.equal(new Set(words).size, 25, puzzle.id);
    assert.equal(puzzle.chains[0].length, puzzle.chains[1].length, puzzle.id);
    assert([3, 5].includes(puzzle.rebus.length), puzzle.id);
    assert(puzzle.start.every(word => !words.includes(word)), 'Start words are outside the grid in ' + puzzle.id);
    assert(checkAnswer(puzzle, puzzle.answer), 'The answer is accepted in ' + puzzle.id);
    assert(CAMPAIGNS[puzzle.campaign].lang === puzzle.lang && puzzle.dialogue.length >= 3 && puzzle.speaker);
  }
});

test('layouts align every pair and keep the leftover words in reading order', () => {
  for (const puzzle of PUZZLES) for (let seed = 1; seed <= 40; seed++) {
    const state = createGame({puzzle: puzzle.id}, seed), path = solution(puzzle, state.grid);
    assert(path.every(([a, b]) => aligned(a, b)), puzzle.id);
    const rest = state.grid.map((word, i) => i).filter(i => !path.flat().includes(i));
    assert.deepEqual(rest.map(i => state.grid[i]), puzzle.rebus, puzzle.id);
  }
});

test('guided play bounces wrong pairs and solves with the right line', () => {
  const puzzle = PUZZLE['gang-1'];
  let state = createGame({puzzle: puzzle.id, assist: 'guided'}, 7);
  const path = solution(puzzle, state.grid);
  const wrong = [0, 1, 2, 3, 4].flatMap(a => [0, 1, 2, 3, 4].map(b => [a, b])).find(([a, b]) => aligned(a, b) && [a, b].sort().join() !== [...path[0]].sort().join());
  state = applyAction(state, 0, {kind: 'cover', a: wrong[0], b: wrong[1]});
  assert.equal(state.boards[0].covered.length, 0); assert.equal(state.boards[0].misses, 1);
  assert.throws(() => applyAction(state, 0, {kind: 'cover', a: 0, b: 6}), /row or a column/);
  for (const [a, b] of path) state = applyAction(state, 0, {kind: 'cover', a: b, b: a});
  assert.deepEqual(leftover(state, state.boards[0]).map(i => state.grid[i]), puzzle.rebus);
  state = applyAction(state, 0, {kind: 'answer', text: 'il  est TEMPS'});
  assert(state.boards[0].solved); assert.equal(state.phase, 'over');
});

test('classic play allows a wrong path, undo and a final check', () => {
  const puzzle = PUZZLE['heist-1'];
  let state = createGame({puzzle: puzzle.id, assist: 'classic'}, 3);
  const path = solution(puzzle, state.grid);
  // Swap the first two steps: every pair is aligned but the path is wrong.
  for (const [a, b] of [path[1], path[0], ...path.slice(2)]) state = applyAction(state, 0, {kind: 'cover', a, b});
  state = applyAction(state, 0, {kind: 'answer', text: puzzle.answer});
  assert(!state.boards[0].solved, 'A wrong path is not a solution');
  state = applyAction(state, 0, {kind: 'hint'});
  assert(state.boards[0].hint.wrong);
  while (state.boards[0].covered.length) state = applyAction(state, 0, {kind: 'undo'});
  for (const [a, b] of path) state = applyAction(state, 0, {kind: 'cover', a, b});
  state = applyAction(state, 0, {kind: 'answer', text: puzzle.answer});
  assert(state.boards[0].solved);
});

test('hints reveal the line, then one word, then both', () => {
  let state = createGame({puzzle: 'manor-1'}, 5);
  const path = solution(PUZZLE['manor-1'], state.grid);
  for (let level = 1; level <= 3; level++) {
    state = applyAction(state, 0, {kind: 'hint'});
    const hint = playerView(state, 0).board.hint;
    assert.equal(hint.level, level);
    assert(hint.line);
    assert.equal(hint.words.length, level === 1 ? 0 : level === 2 ? 1 : 2);
    for (const i of hint.words) assert(path[0].includes(i));
  }
});

test('views hide the path until the board is finished; race rivals see only progress', () => {
  let state = createGame({puzzle: 'cuisine-2', mode: 'race'}, 2);
  const view = playerView(state, 0);
  assert(!('solution' in view) && !('answer' in view));
  assert(!JSON.stringify(view).includes('chains'));
  state = applyAction(state, 1, {kind: 'giveup'});
  assert(playerView(state, 1).solution && !playerView(state, 0).solution);
  assert.deepEqual(Object.keys(playerView(state, 0).rivals[0]).sort(), ['covered', 'gaveUp', 'hints', 'misses', 'solved']);
  state = applyAction(state, 0, {kind: 'giveup'});
  assert.equal(state.phase, 'over');
});

test('answers ignore case, accents and punctuation', () => {
  assert(checkAnswer(PUZZLE['cuisine-2'], 'Je suis désolé chef'));
  assert(checkAnswer(PUZZLE['cuisine-2'], 'je suis desole, chef !'));
  assert(checkAnswer(PUZZLE['kitchen-3'], 'Honey, I’m home'));
  assert(!checkAnswer(PUZZLE['kitchen-3'], 'honey'));
  assert.equal(fold('C’est si bon !'), 'c est si bon');
});

test('the room engine shares one board together or two in a race', () => {
  assert.deepEqual(room.controllers({mode: 'together'}), ['team']);
  assert.deepEqual(room.controllers({mode: 'race'}), ['host', 'guest']);
  assert.throws(() => setup.validate({puzzle: 'nope'}));
  const state = room.create(setup.validate({puzzle: 'chateau-3', mode: 'race'}), {seed: 1});
  assert.deepEqual(room.acting(state), [0, 1]);
  assert.equal(steps(PUZZLE['chateau-3']), 11);
  assert(layout(PUZZLE['kitchen-1'], Math.random).length === 25);
});
