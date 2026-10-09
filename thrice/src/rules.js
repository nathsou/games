// Thrice: pure, seeded rules shared by solo play, the room and the bots.
// 36 cards, 1–12 three times each. Reveal the lowest or highest card of any hand
// (your own included) or a face-down middle card. Matching cards keep the turn
// going; a third match wins that trio. A different card ends the turn and every
// revealed card goes back where it came from.
export const VALUES = Array.from({length: 12}, (_, i) => i + 1);
export const MODES = {simple: 'Simple', spicy: 'Spicy'};
// Hand and middle sizes by seat count. Two seats is a house duel variant.
export const DEAL = {2: [10, 16], 3: [9, 9], 4: [7, 8], 5: [6, 6], 6: [5, 6]};

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
const clone = value => structuredClone(value);
// Two trios are linked when their values add up to 7 or differ by 7.
export const linked = (a, b) => a + b === 7 || Math.abs(a - b) === 7;
export function hasWon(trios, mode) {
  if (trios.includes(7)) return true;
  if (mode === 'spicy') return trios.some((a, i) => trios.some((b, j) => i < j && linked(a, b)));
  return trios.length >= 3;
}

export function createGame({seats = 3, mode = 'simple', starter = null} = {}, seed = 1) {
  assert(Object.hasOwn(DEAL, seats), 'Thrice needs two to six players.');
  assert(Object.hasOwn(MODES, mode), 'Choose Simple or Spicy.');
  assert(Number.isInteger(seed), 'Invalid game seed.');
  const state = {seats, mode, seed: seed >>> 0, rng: seed >>> 0, revision: 0, round: 0, phase: 'playing', turn: 0,
    hands: [], middle: [], reveal: [], trios: Array.from({length: seats}, () => []), last: null, log: [], winner: null};
  const deck = shuffle(state, VALUES.flatMap(value => [value, value, value]));
  const [hand, middle] = DEAL[seats];
  for (let seat = 0; seat < seats; seat++) state.hands.push(deck.splice(0, hand).sort((a, b) => a - b));
  state.middle = deck.splice(0, middle).map(value => ({value, taken: false}));
  state.turn = Number.isInteger(starter) ? starter : Math.floor(random(state) * seats);
  return state;
}

// Cards still in a hand: revealed cards wait in front of their owner this turn.
function remaining(state, seat) {
  const out = state.reveal.filter(card => card.from === 'hand' && card.seat === seat);
  const low = out.filter(card => card.end === 'low').length, high = out.filter(card => card.end === 'high').length;
  return state.hands[seat].slice(low, state.hands[seat].length - high);
}
export function legalActions(state, seat = state.turn) {
  if (state.phase !== 'playing' || seat !== state.turn) return [];
  const actions = [];
  for (let target = 0; target < state.seats; target++) {
    if (!remaining(state, target).length) continue;
    actions.push({kind: 'reveal', from: 'hand', seat: target, end: 'low'});
    if (remaining(state, target).length > 1) actions.push({kind: 'reveal', from: 'hand', seat: target, end: 'high'});
  }
  state.middle.forEach((card, index) => {
    if (!card.taken && !state.reveal.some(r => r.from === 'middle' && r.index === index)) actions.push({kind: 'reveal', from: 'middle', index});
  });
  return actions;
}
function valid(state, action) {
  return legalActions(state).some(a => a.from === action.from && (a.from === 'middle' ? a.index === action.index : a.seat === action.seat && a.end === action.end));
}

export function applyAction(state, seat, action) {
  assert(state.phase === 'playing', 'This game is over.');
  assert(seat === state.turn, 'Wait for your turn.');
  assert(action && action.kind === 'reveal' && valid(state, action), 'Choose a card to reveal.');
  const next = clone(state);
  let card;
  if (action.from === 'middle') card = {from: 'middle', index: action.index, value: next.middle[action.index].value};
  else {
    const left = remaining(next, action.seat);
    card = {from: 'hand', seat: action.seat, end: action.end, value: action.end === 'low' ? left[0] : left.at(-1)};
  }
  next.reveal.push(card);
  next.log.push({...card, by: seat, turn: next.round});
  next.revision++;
  const first = next.reveal[0].value;
  if (card.value !== first) finishTurn(next, 'miss');
  else if (next.reveal.length === 3) {
    // Claim the trio: take the revealed cards out of their hands and the middle.
    for (const taken of next.reveal) {
      if (taken.from === 'middle') next.middle[taken.index].taken = true;
      else {
        const hand = next.hands[taken.seat];
        hand.splice(taken.end === 'low' ? 0 : hand.lastIndexOf(taken.value), 1);
      }
    }
    // A hand's low cards are removed from the front; recount after each removal.
    next.trios[seat].push(first);
    next.log.push({claim: first, by: seat, turn: next.round});
    finishTurn(next, 'trio');
    if (hasWon(next.trios[seat], next.mode)) { next.phase = 'over'; next.winner = seat; }
  }
  return next;
}
function finishTurn(state, result) {
  state.last = {seat: state.turn, cards: state.reveal, result};
  state.reveal = [];
  state.round++;
  state.turn = (state.turn + 1) % state.seats;
}

// What one seat may see: its own hand, counts of the others, the cards revealed
// this turn and the last finished turn. The full history only with the memory aid.
export function playerView(state, seat, {memoryAid = false} = {}) {
  const view = {seats: state.seats, mode: state.mode, revision: state.revision, round: state.round, phase: state.phase, turn: state.turn,
    seat, hand: seat >= 0 && seat < state.seats ? remaining(state, seat) : [],
    counts: state.hands.map((_, i) => remaining(state, i).length),
    middle: state.middle.map((card, index) => card.taken ? null : state.reveal.some(r => r.from === 'middle' && r.index === index) ? {up: true, value: card.value} : {up: false}),
    reveal: clone(state.reveal), trios: clone(state.trios), last: clone(state.last), winner: state.winner};
  if (memoryAid) view.history = state.log.filter(entry => !entry.claim).slice(-60);
  if (state.phase === 'over') view.hands = clone(state.hands);
  return view;
}
export function validateView(view) {
  if (!view || typeof view !== 'object' || !Object.hasOwn(DEAL, view.seats) || !Array.isArray(view.hand) || !Array.isArray(view.middle) || !Array.isArray(view.trios)) throw new Error('Invalid Thrice table.');
  return view;
}
