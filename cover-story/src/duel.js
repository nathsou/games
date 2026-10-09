import {BANK, fold} from './words.js';

// A two-human variant with printed clue cards from the authored word bank.
// No player or automated seat knows the answers on behalf of another player.
const matches = (state, clue, i) => (BANK[state.lang][state.words[i]] || []).some(word => fold(word) === fold(clue));
const live = (state, clue) => state.words.map((_, i) => i).filter(i => !state.revealed[i] && matches(state, clue, i));
export function startDuelRound(state, shuffle) {
  const candidates = [...new Set(state.words.flatMap((word, i) => state.revealed[i] ? [] : BANK[state.lang][word] || []))]
    .filter(word => !state.usedClues.includes(word) && !state.words.some(board => fold(board).includes(fold(word)) || fold(word).includes(fold(board))));
  const shared = candidates.filter(word => live(state, word).length >= 2);
  const clue = shuffle(state, shared.length ? shared : candidates)[0];
  if (!clue || state.round >= state.roundLimit) {
    state.phase = 'over'; state.result = 'points';
    state.winner = state.scores[0] === state.scores[1] ? null : state.scores[0] > state.scores[1] ? 0 : 1;
    return;
  }
  state.usedClues.push(clue); state.tried = []; state.passes = 0; state.guesses = 0;
  state.duelTurn = (state.first + state.round) % 2;
  state.clue = {word: clue, number: live(state, clue).length, by: null};
  state.log.push({...state.clue, guesses: []});
}
export function createDuel(state, turns, shuffle) {
  Object.assign(state, {phase:'guess', scores:[0,0], usedClues:[], roundLimit:turns, first:state.seed % 2});
  startDuelRound(state, shuffle);
  return state;
}
export function applyDuel(state, seat, action, shuffle) {
  if (action?.kind === 'pass') state.passes++;
  else {
    const i = action?.index;
    if (action?.kind !== 'guess' || !Number.isInteger(i) || i < 0 || i >= 25 || state.revealed[i] || state.tried.includes(i)) throw new Error('Choose an untried word.');
    const correct = matches(state, state.clue.word, i);
    state.tried.push(i); state.passes = 0; state.guesses++;
    state.scores[seat] += correct ? 1 : -1;
    if (correct) state.revealed[i] = seat === 0 ? 'red' : 'blue';
    state.log.at(-1).guesses.push({index:i, color:correct ? state.revealed[i] : 'neutral', seat, correct});
  }
  state.duelTurn = 1 - seat;
  if (state.passes >= 2 || !live(state, state.clue.word).length) { state.round++; startDuelRound(state, shuffle); }
}
export function duelView(state) {
  return {scores:state.scores.slice(), tried:state.tried.slice(), passes:state.passes, roundLimit:state.roundLimit,
    duelLeft:state.clue ? live(state, state.clue.word).length : 0};
}
