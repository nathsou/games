import {createDuel, applyDuel, duelView} from './duel.js';
import {WORDS, PACKS, LANGS, fold} from './words.js';

// Cover Story: pure, seeded rules for both ways to play.
// Teams: Red and Blue each have a spymaster, who sees the key, and an
// operative, who guesses. Seats: 0 red spymaster, 1 red operative, 2 blue
// spymaster, 3 blue operative. Find all your agents; avoid the assassin.
// Duo: two partners, each holding one side of a shared key. Seats 0 and 1 take
// turns giving clues to each other to find all 15 agents before time runs out.
export const MODES = {duo: 'Duo', duel: 'Duel', teams: 'Teams'};
export const TEAMS = ['red', 'blue'];
export const SPY = [0, 2], OPERATIVE = [1, 3];
export const teamOf = seat => seat < 2 ? 'red' : 'blue';
export const TURNS = {7: 'Seven turns · hard', 9: 'Nine turns · standard', 11: 'Eleven turns · relaxed'};

function random(state) {
  state.rng = (state.rng + 0x6D2B79F5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function shuffle(state, values) {
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function assert(condition, message) { if (!condition) throw new Error(message); }

// The duo key: what each side sees for every card. A = agent, N = bystander, X = assassin.
const DUO = [['A', 'A', 3], ['A', 'N', 5], ['N', 'A', 5], ['A', 'X', 1], ['X', 'A', 1], ['X', 'X', 1], ['X', 'N', 1], ['N', 'X', 1], ['N', 'N', 7]];
const NAMES = {A: 'agent', N: 'neutral', X: 'assassin'};

export function createGame({mode = 'teams', lang = 'en', pack = 'all', turns = 9} = {}, seed = 1) {
  assert(Object.hasOwn(MODES, mode) && Object.hasOwn(LANGS, lang) && Object.hasOwn(PACKS, pack) && Object.hasOwn(TURNS, turns), 'Choose valid Cover Story settings.');
  assert(Number.isInteger(seed), 'Invalid game seed.');
  const state = {mode, lang, pack, seed: seed >>> 0, rng: seed >>> 0, revision: 0, round: 0, phase: 'clue', words: [], revealed: Array(25).fill(null), clue: null, guesses: 0, log: [], winner: null, result: null};
  state.words = shuffle(state, WORDS[lang][pack]).slice(0, 25);
  if (mode === 'duel') return createDuel(state, turns, shuffle);
  if (mode === 'teams') {
    const first = random(state) < .5 ? 'red' : 'blue', second = first === 'red' ? 'blue' : 'red';
    state.key = shuffle(state, [...Array(9).fill(first), ...Array(8).fill(second), ...Array(7).fill('neutral'), 'assassin']);
    state.team = first;
  } else {
    const cards = shuffle(state, DUO.flatMap(([a, b, n]) => Array(n).fill([NAMES[a], NAMES[b]])));
    state.keys = [cards.map(pair => pair[0]), cards.map(pair => pair[1])];
    state.giver = random(state) < .5 ? 0 : 1;
    state.turnsLeft = turns;
    state.bystanders = [Array(25).fill(false), Array(25).fill(false)];
  }
  return state;
}

// Who acts now: a spymaster or giver during 'clue', an operative or guesser during 'guess'.
export function actingSeat(state) {
  if (state.phase === 'over') return null;
  if (state.mode === 'duel') return state.duelTurn;
  if (state.mode === 'teams') return (state.team === 'red' ? 0 : 2) + (state.phase === 'guess' ? 1 : 0);
  return state.phase === 'clue' ? state.giver : 1 - state.giver;
}
const hidden = (state, i) => state.revealed[i] === null;
// A clue is one word that is not, and does not contain or sit inside, a word still in play.
export function clueProblem(state, word) {
  if (typeof word !== 'string') return 'Give a one-word clue.';
  const clue = fold(word);
  if (!/^[\p{L}][\p{L}'’-]{0,23}$/u.test(word.trim())) return 'Give one word, letters only (hyphens are fine).';
  for (let i = 0; i < 25; i++) {
    if (!hidden(state, i)) continue;
    const board = fold(state.words[i]);
    if (clue === board) return 'That word is on the board.';
    if (clue.length >= 3 && board.length >= 3 && (clue.includes(board) || board.includes(clue))) return `Too close to ${state.words[i].toUpperCase()}.`;
  }
  return null;
}
export function remaining(state, team) { return state.key.filter((color, i) => color === team && hidden(state, i)).length; }
// Duo: agents a giver still has to point out from their side of the key.
export function duoLeft(state, side) { return state.keys[side].filter((kind, i) => kind === 'agent' && state.revealed[i] !== 'agent').length; }
export const duoFound = state => state.revealed.filter(kind => kind === 'agent').length;

export function applyAction(state, seat, action) {
  assert(state.phase !== 'over', 'This game is over.');
  assert(seat === actingSeat(state), state.phase === 'clue' ? 'Wait for the clue.' : 'Wait for your turn.');
  const next = structuredClone(state);
  if (state.mode === 'duel') { applyDuel(next, seat, action, shuffle); next.revision++; return next; }
  if (state.phase === 'clue') {
    assert(action?.kind === 'clue', 'Give a clue.');
    const problem = clueProblem(state, action.word);
    assert(!problem, problem);
    assert(Number.isInteger(action.number) && action.number >= 1 && action.number <= 9, 'Choose a number from 1 to 9.');
    next.clue = {word: action.word.trim().toLowerCase(), number: action.number, by: seat};
    next.log.push({...next.clue, team: state.mode === 'teams' ? state.team : null, guesses: []});
    next.phase = 'guess'; next.guesses = 0;
  } else if (action?.kind === 'pass') {
    assert(state.guesses > 0, 'Make at least one guess first.');
    endTurn(next);
  } else {
    assert(action?.kind === 'guess' && Number.isInteger(action.index) && action.index >= 0 && action.index < 25 && hidden(state, action.index), 'Choose a word that is still in play.');
    if (state.mode === 'teams') guessTeams(next, action.index); else guessDuo(next, action.index);
  }
  next.revision++;
  return next;
}
function guessTeams(state, index) {
  const color = state.key[index], team = state.team, other = team === 'red' ? 'blue' : 'red';
  state.revealed[index] = color;
  state.log.at(-1).guesses.push({index, color});
  state.guesses++;
  if (color === 'assassin') return finish(state, other, 'assassin');
  if (!remaining(state, team)) return finish(state, team, 'agents');
  if (!remaining(state, other)) return finish(state, other, 'agents');
  if (color !== team || state.guesses >= state.clue.number + 1) endTurn(state);
}
function guessDuo(state, index) {
  const giver = state.giver, kind = state.keys[giver][index];
  assert(!state.bystanders[giver][index], 'That word is already a bystander on your partner’s side.');
  state.log.at(-1).guesses.push({index, kind});
  state.guesses++;
  if (kind === 'assassin') { state.revealed[index] = 'assassin'; return finish(state, null, 'assassin'); }
  if (kind === 'agent') {
    state.revealed[index] = 'agent';
    if (duoFound(state) === 15) return finish(state, 'team', 'agents');
    if (!duoLeft(state, giver)) endTurn(state);
    return;
  }
  state.bystanders[giver][index] = true;
  endTurn(state);
}
function endTurn(state) {
  state.round++; state.clue = null; state.guesses = 0; state.phase = 'clue';
  if (state.mode === 'teams') { state.team = state.team === 'red' ? 'blue' : 'red'; return; }
  state.turnsLeft--;
  if (state.turnsLeft <= 0) return finish(state, null, 'time');
  // Partners alternate, unless one side has no agents left to point out.
  const other = 1 - state.giver;
  if (duoLeft(state, other)) state.giver = other;
}
function finish(state, winner, result) { state.phase = 'over'; state.winner = winner; state.result = result; }

// Spymasters (or a duo partner's own side) see the key; operatives only what is revealed.
export function playerView(state, seat) {
  const view = {mode: state.mode, lang: state.lang, pack: state.pack, revision: state.revision, round: state.round, phase: state.phase, seat,
    words: state.words.slice(), revealed: state.revealed.slice(), clue: state.clue && {...state.clue}, guesses: state.guesses, log: structuredClone(state.log),
    acting: actingSeat(state), winner: state.winner, result: state.result};
  if (state.mode === 'duel') return {...view, ...duelView(state)};
  if (state.mode === 'teams') {
    view.team = state.team;
    view.left = {red: remaining(state, 'red'), blue: remaining(state, 'blue')};
    if (SPY.includes(seat) || state.phase === 'over') view.key = state.key.slice();
  } else {
    view.giver = state.giver; view.turnsLeft = state.turnsLeft; view.found = duoFound(state);
    view.bystanders = structuredClone(state.bystanders);
    if (seat === 0 || seat === 1) view.myKey = state.keys[seat].slice();
    if (state.phase === 'over') view.keys = structuredClone(state.keys);
  }
  return view;
}
export function validateView(view) {
  if (!view || !Object.hasOwn(MODES, view.mode) || !Array.isArray(view.words) || view.words.length !== 25 || !Array.isArray(view.revealed)) throw new Error('Invalid Cover Story board.');
  return view;
}
