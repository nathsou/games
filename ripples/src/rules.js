import {PUZZLE, fold} from './puzzles.js';

// Ripples: pure, seeded rules. A 5×5 grid; two starting clues lead into two
// chains of associations. Each step covers the next word of both chains, and
// the two words must share a row or a column. When every chain word is covered,
// the leftover words, read in grid order, sound out the dialogue's last line.
// Guided play checks each pair; classic play only checks the final answer.
export const ASSISTS = {guided: 'Guided · each pair is checked', classic: 'Classic · find your own path'};
export const MODES = {solo: 'Solo', together: 'Together', race: 'Race'};
const MAX_HINTS = 3;

function random(state) {
  state.rng = (state.rng + 0x6D2B79F5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function assert(condition, message) { if (!condition) throw new Error(message); }
export const aligned = (a, b) => a !== b && (Math.floor(a / 5) === Math.floor(b / 5) || a % 5 === b % 5);
export const steps = puzzle => puzzle.chains[0].length;

// Place each step's pair on a shared row or column, then drop the leftover
// words into the free cells in reading order. Backtracks on dead ends.
export function layout(puzzle, rng) {
  const cells = Array(25).fill(null), lines = [...Array(5).keys()].flatMap(i => [[0, 1, 2, 3, 4].map(c => i * 5 + c), [0, 1, 2, 3, 4].map(r => r * 5 + i)]);
  const pick = list => list.splice(Math.floor(rng() * list.length), 1)[0];
  function place(step) {
    if (step === steps(puzzle)) return true;
    const options = lines.map(line => line.filter(cell => cells[cell] === null)).filter(free => free.length >= 2);
    while (options.length) {
      const free = pick(options).slice(), a = pick(free), b = pick(free);
      const [first, second] = rng() < .5 ? [a, b] : [b, a];
      cells[first] = puzzle.chains[0][step]; cells[second] = puzzle.chains[1][step];
      if (place(step + 1)) return true;
      cells[first] = cells[second] = null;
    }
    return false;
  }
  assert(place(0), 'This puzzle cannot be laid out.');
  let next = 0;
  for (let cell = 0; cell < 25; cell++) if (cells[cell] === null) cells[cell] = puzzle.rebus[next++];
  return cells;
}
export function solution(puzzle, grid) {
  return puzzle.chains[0].map((word, step) => [grid.indexOf(word), grid.indexOf(puzzle.chains[1][step])]);
}
const newBoard = () => ({covered: [], misses: 0, hints: 0, hint: null, guess: null, solved: false, gaveUp: false, finishedAt: null, rev: 0});
// In a race, a move is current if the player has seen their own board's latest change.
export const fresh = (state, seat, revision) => state.mode === 'race' && Boolean(state.boards[seat]) && revision >= state.boards[seat].rev && revision <= state.revision;

export function createGame({puzzle: id, mode = 'solo', assist = 'guided'} = {}, seed = 1) {
  const puzzle = PUZZLE[id];
  assert(puzzle, 'Choose a puzzle.');
  assert(Object.hasOwn(MODES, mode) && Object.hasOwn(ASSISTS, assist), 'Choose valid Ripples settings.');
  const state = {puzzle: id, mode, assist, seed: seed >>> 0, rng: seed >>> 0, revision: 0, round: 0, phase: 'playing', grid: [], boards: [], order: []};
  state.grid = layout(puzzle, () => random(state));
  state.boards = mode === 'race' ? [newBoard(), newBoard()] : [newBoard()];
  return state;
}
const done = board => board.solved || board.gaveUp;
export const acting = state => state.phase === 'over' ? [] : state.boards.map((board, seat) => seat).filter(seat => !done(state.boards[seat]));
const coveredCells = board => board.covered.flat();
export const leftover = (state, board) => state.grid.map((word, i) => i).filter(i => !coveredCells(board).includes(i));
// How many leading steps of a board follow the intended path.
export function correctSteps(state, board) {
  const path = solution(PUZZLE[state.puzzle], state.grid);
  let n = 0;
  while (n < board.covered.length && path[n] && [...board.covered[n]].sort().join() === [...path[n]].sort().join()) n++;
  return n;
}
export function checkAnswer(puzzle, text) {
  const answer = fold(text);
  return Boolean(answer) && [puzzle.answer, ...puzzle.accept].some(option => fold(option) === answer);
}

export function applyAction(state, seat, action) {
  assert(state.phase === 'playing', 'This puzzle is finished.');
  assert(acting(state).includes(seat), 'Your board is finished.');
  const puzzle = PUZZLE[state.puzzle], next = structuredClone(state), board = next.boards[seat], path = solution(puzzle, state.grid);
  const total = steps(puzzle), taken = coveredCells(board);
  assert(action && typeof action === 'object', 'Choose a move.');
  if (action.kind === 'cover') {
    const {a, b} = action;
    assert([a, b].every(i => Number.isInteger(i) && i >= 0 && i < 25 && !taken.includes(i)), 'Choose two uncovered words.');
    assert(aligned(a, b), 'The two words must share a row or a column.');
    assert(board.covered.length < total, 'Every chain word is already covered.');
    if (state.assist === 'guided') {
      const want = path[board.covered.length];
      if ([a, b].sort().join() !== [...want].sort().join()) { board.misses++; next.revision++; board.rev = next.revision; board.guess = {a, b, wrong: true}; return next; }
    }
    board.covered.push([a, b]); board.hint = null; board.guess = null;
  } else if (action.kind === 'undo') {
    assert(board.covered.length && state.assist === 'classic', 'Nothing to undo.');
    board.covered.pop(); board.hint = null;
  } else if (action.kind === 'hint') {
    const right = correctSteps(state, board);
    assert(board.covered.length < total || right < total, 'All pairs are placed. Read the leftover words aloud.');
    if (right < board.covered.length) board.hint = {step: right, level: 0, wrong: true};
    else {
      const level = board.hint && board.hint.step === right ? Math.min(MAX_HINTS, board.hint.level + 1) : 1;
      board.hint = {step: right, level};
    }
    board.hints++;
  } else if (action.kind === 'answer') {
    assert(board.covered.length === total, 'Cover every chain word first.');
    assert(typeof action.text === 'string' && action.text.length <= 120, 'Type the missing line.');
    const right = correctSteps(state, board) === total && checkAnswer(puzzle, action.text);
    board.guess = {text: action.text.trim(), wrong: !right};
    if (right) { board.solved = true; board.finishedAt = next.round; }
    else board.misses++;
  } else if (action.kind === 'giveup') {
    board.gaveUp = true; board.finishedAt = next.round;
  } else throw new Error('Choose a move.');
  next.revision++; next.round++; board.rev = next.revision;
  if (done(board)) next.order.push(seat);
  if (next.boards.every(done)) next.phase = 'over';
  return next;
}

// Views keep the path secret until a board is finished. A race rival's board
// shows only progress.
export function playerView(state, seat) {
  const puzzle = PUZZLE[state.puzzle], path = solution(puzzle, state.grid), own = state.boards[seat] || state.boards[0];
  let hint = own.hint;
  if (hint && !hint.wrong) { const pair = path[hint.step]; hint = {step: hint.step, level: hint.level, line: lineOf(pair), words: hint.level >= 2 ? pair.slice(0, hint.level >= 3 ? 2 : 1) : []}; }
  const view = {puzzle: state.puzzle, mode: state.mode, assist: state.assist, revision: state.revision, round: state.round, phase: state.phase, seat,
    grid: state.grid.slice(), board: {...structuredClone(own), hint}, steps: steps(puzzle), order: state.order.slice(),
    rivals: state.boards.map(board => ({covered: board.covered.length, hints: board.hints, misses: board.misses, solved: board.solved, gaveUp: board.gaveUp})).filter((_, i) => i !== seat)};
  if (done(own) || state.phase === 'over') { view.solution = path; view.answer = puzzle.answer; view.sounds = puzzle.sounds; }
  return view;
}
// The row or column shared by a pair, for the first hint.
function lineOf([a, b]) { return Math.floor(a / 5) === Math.floor(b / 5) ? {row: Math.floor(a / 5)} : {col: a % 5}; }
export function validateView(view) {
  if (!view || !PUZZLE[view.puzzle] || !Array.isArray(view.grid) || view.grid.length !== 25 || !view.board) throw new Error('Invalid Ripples board.');
  return view;
}
