// Original Flip it implementation. Card orientation, ownership and turn order
// live here, independently of the DOM and the peer connection.
export const DEFAULT_OPTIONS = Object.freeze({quickTurns: true, compactDeck: true, lastChance: true, target: 2});
export const OPTION_KEYS = Object.freeze(Object.keys(DEFAULT_OPTIONS).filter(key=>key!=='target'));
export function optionsFor(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
      Object.keys(options).some(key => ![...OPTION_KEYS, 'target'].includes(key)) ||
      Object.entries(options).some(([key,value]) => key==='target' ? !Number.isInteger(value)||value<1||value>5 : typeof value !== 'boolean')) throw new Error('Invalid match options.');
  return {...DEFAULT_OPTIONS, ...options};
}
export const valueOf = card => card.ends[card.face];
export const reverseOf = card => card.ends[1 - card.face];
export const setValue = set => set?.length ? valueOf(set[0]) : null;
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let n = Math.imul(seed ^ seed >>> 15, 1 | seed);
    n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n;
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}
export function makeDeck(compact = true) {
  const ranks = compact ? 6 : 10, deck = [];
  for (const step of [1, 2]) for (let rank = 1; rank <= ranks; rank++) {
    for (let copy = 0; copy < 2; copy++) deck.push({id: 'c' + deck.length, ends: [rank, (rank - 1 + step) % ranks + 1], face: 0, ...(deck.length===0?{star:true}:{})});
  }
  return deck;
}
function deal(state) {
  const random = rng((state.seed + Math.imul(state.round, 0x9e3779b9)) >>> 0);
  const deck = makeDeck(state.options.compactDeck);
  for (const card of deck) card.face = random() < .5 ? 0 : 1;
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  state.hands = Array.from({length: state.scores.length}, () => []);
  deck.forEach((card, i) => state.hands[(i + state.starter + state.round) % state.hands.length].push(card));
  state.table = state.hands.map(() => [[], []]);
  state.discard = [];
  state.phase = 'playing';
  // The star belongs to one physical card, on either face. Its recipient opens
  // each new round; the host, deal offset and controller type do not choose it.
  state.firstPlayer = state.hands.findIndex(hand=>hand.some(card=>card.star));
  state.turn = state.firstPlayer;
  // In double-action rhythm the opening player gets only the right action.
  state.beat = 1;
  state.opening = true;
  state.pending = null; state.repliesRemaining = 0;
  state.moves = 0;
  state.log = [];
  state.result = null;
  state.visits = {[positionKey(state)]: 1};
  return state;
}
export function createMatch(options = {}, seed = 1, starter = 0, players = 2) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isInteger(players) || players < 2 || players > 5 || !Number.isInteger(starter) || starter < 0 || starter >= players) throw new Error('Invalid deal.');
  return deal({options: optionsFor(options), seed, starter, round: 0, revision: 0, scores: Array(players).fill(0), history: []});
}
export function availableLanes(state) { return state.options.quickTurns ? [0] : [state.beat]; }
function clearLane(state, seat, lane) {
  state.discard.push(...state.table[seat][lane]);
  state.table[seat][lane] = [];
}
function conflicts(state, count, skipSeat = -1, skipLane = -1) {
  const out = [];
  for (let seat = 0; seat < state.hands.length; seat++) for (let lane = 0; lane < 2; lane++) {
    const set = state.table[seat][lane];
    if (set.length === count && !(seat === skipSeat && lane === skipLane)) out.push({seat, lane, set});
  }
  return out;
}
function bounce(state, seat, lane, event) {
  const set = state.table[seat][lane];
  event.returned.push({seat, count: set.length, from: setValue(set), to: set.map(reverseOf)});
  state.hands[seat].push(...set.map(card => ({...card, face: 1 - card.face})));
  state.table[seat][lane] = [];
}
function matchingCards(state, seat, ids, single = false) {
  if (!Array.isArray(ids) || !ids.length || single && ids.length !== 1 || ids.length > 40 || new Set(ids).size !== ids.length) throw new Error('Choose a matching set from your hand.');
  const cards = ids.map(id => state.hands[seat].find(card => card.id === id));
  if (cards.some(card => !card) || cards.some(card => valueOf(card) !== valueOf(cards[0]))) throw new Error('Selected cards must have the same active rank.');
  return cards;
}
// Performs a move on a private clone. Validation happens after cashing out the
// selected lane, since that lane no longer blocks a set. Illegal moves cannot
// discard cards or otherwise mutate the caller's state.
function execute(state, seat, action) {
  if (!action || !['play', 'add', 'take', 'flip'].includes(action.kind) || !availableLanes(state).includes(action.lane)) throw new Error('Choose an available play space.');
  const event = {seat, kind: action.kind, lane: action.lane, cashed: state.table[seat][action.lane].length, returned: []};
  clearLane(state, seat, action.lane);
  if (action.kind === 'flip') {
    state.hands[seat] = state.hands[seat].map(card => ({...card, face: 1 - card.face}));
    return event;
  }
  if (action.kind === 'take' || action.kind === 'add') {
    const targetSeat = action.targetSeat ?? (state.hands.length === 2 ? 1 - seat : -1);
    if (!Number.isInteger(targetSeat) || targetSeat < 0 || targetSeat >= state.hands.length || targetSeat === seat || !(state.options.quickTurns ? [0] : [0, 1]).includes(action.target) || !state.table[targetSeat][action.target].length) throw new Error('Choose one of your opponent’s sets.');
    event.target = action.target; event.targetSeat = targetSeat;
    const target = state.table[targetSeat][action.target];
    if (action.kind === 'take') { event.count = target.length; event.value = setValue(target);
      state.table[targetSeat][action.target] = [];
      state.hands[seat].push(...target.map(card => ({...card, face: 1 - card.face})));
      return event;
    }
  }
  const cards = matchingCards(state, seat, action.cards, action.kind === 'add');
  const rank = valueOf(cards[0]);
  const owner = action.kind === 'play' ? seat : event.targetSeat;
  const lane = action.kind === 'play' ? action.lane : action.target;
  const target = state.table[owner][lane];
  if (action.kind === 'add' && setValue(target) !== rank) throw new Error('Add a card matching the opponent’s set.');
  const count = target.length + cards.length;
  const clash = conflicts(state, count, owner, lane);
  if (clash.some(other => setValue(other.set) >= rank)) throw new Error('A set of that size needs a higher rank than every other set of the same size.');
  state.hands[seat] = state.hands[seat].filter(card => !action.cards.includes(card.id));
  state.table[owner][lane].push(...cards);
  for (const other of clash) bounce(state, other.seat, other.lane, event);
  event.count = count; event.value = rank;
  return event;
}
function positionKey(state) {
  const cards = hand => hand.map(card => card.id + ':' + card.face).sort().join(',');
  return JSON.stringify([state.turn, state.beat, state.options.quickTurns ? false : state.opening, state.pending, state.hands.map(cards), state.table.map(row => row.map(cards)), state.discard.map(c => c.id).sort()]);
}
function finishRound(state, winner, reason) {
  state.result = {winner, reason, moves: state.moves, round: state.round + 1};
  state.history.push(state.result);
  if (winner !== null) state.scores[winner]++;
  state.pending = null; state.repliesRemaining = 0;
  state.phase = state.scores.some(n => n >= (state.options.target||2)) ? 'matchOver' : 'roundOver';
}
export function applyAction(original, seat, action) {
  if (!Number.isInteger(seat) || seat < 0 || seat >= original.hands.length) throw new Error('Invalid player.');
  const state = structuredClone(original);
  if (action?.kind === 'next') {
    if (state.phase !== 'roundOver') throw new Error('The round is still in progress.');
    state.round++; state.revision++; return deal(state);
  }
  if (state.phase !== 'playing' || state.turn !== seat) throw new Error('Wait for your turn.');
  const previousPending = state.pending;
  const event = execute(state, seat, action);
  state.moves++; state.revision++;
  state.log.push(event); if (state.log.length > 12) state.log.shift();
  if (previousPending !== null && state.hands[previousPending].length === 0) {
    state.repliesRemaining--;
    if (state.repliesRemaining <= 0) { finishRound(state, previousPending, 'survived'); return state; }
    // Every other seat gets one reply. The earliest empty hand keeps priority.
    state.turn = (seat + 1) % state.hands.length; state.beat = 1; state.opening = false;
  } else {
    state.pending = null; state.repliesRemaining = 0;
    if (!state.hands[seat].length) {
      if (!state.options.lastChance) { finishRound(state, seat, 'empty'); return state; }
      state.pending = seat; state.repliesRemaining = state.hands.length - 1;
      state.turn = (seat + 1) % state.hands.length; state.beat = 1; state.opening = false;
    } else if (!state.options.quickTurns && state.beat === 1 && !state.opening) state.beat = 0;
    else { state.turn = (seat + 1) % state.hands.length; state.beat = 1; state.opening = false; }
  }
  const key = positionKey(state);
  state.visits[key] = (state.visits[key] || 0) + 1;
  if (state.pending === null && state.visits[key] >= 3) finishRound(state, null, 'repeat');
  else if (state.pending === null && state.moves >= (state.options.compactDeck ? 120 : 180)) finishRound(state, null, 'limit');
  return state;
}
export function playerView(state, seat) {
  if (!Number.isInteger(seat) || seat < 0 || seat >= state.hands.length) throw new Error('Invalid player.');
  const view = structuredClone(state);
  delete view.seed; delete view.starter; delete view.visits;
  view.discardCount = view.discard.length; delete view.discard;
  view.hands = view.hands.map((hand, owner) => owner === seat ? hand : hand.map(() => ({hidden:true})));
  return view;
}
function baseForLane(state, seat, lane) {
  const base = structuredClone(state);
  base.table[seat][lane] = [];
  return base;
}
export function legalActions(state, seat = state.turn) {
  if (state.phase !== 'playing' || state.turn !== seat) return [];
  const actions = [], groups = new Map();
  for (const card of state.hands[seat]) {
    if (card.hidden) throw new Error('Cannot choose for a hidden hand.');
    const rank = valueOf(card); if (!groups.has(rank)) groups.set(rank, []); groups.get(rank).push(card.id);
  }
  for (const lane of availableLanes(state)) {
    const base = baseForLane(state, seat, lane);
    actions.push({kind: 'flip', lane});
    for (const [rank, group] of groups) {
      // At most eight cards can show any rank in either Flip it deck.
      for (let mask = 1; mask < 2 ** group.length; mask++) {
        const cards = group.filter((_, i) => mask & 2 ** i);
        if (conflicts(base, cards.length).every(other => setValue(other.set) < rank)) actions.push({kind: 'play', lane, cards});
      }
    }
    for (let targetSeat = 0; targetSeat < state.hands.length; targetSeat++) {
      if (targetSeat === seat) continue;
      const owner = state.hands.length === 2 ? {} : {targetSeat};
      for (const target of (state.options.quickTurns ? [0] : [0,1])) {
        const set = base.table[targetSeat][target]; if (!set.length) continue;
        actions.push({kind:'take',lane,target,...owner});
        const rank = setValue(set);
        if (conflicts(base,set.length+1,targetSeat,target).every(other=>setValue(other.set)<rank)) {
          for (const card of groups.get(rank)||[]) actions.push({kind:'add',lane,target,...owner,cards:[card]});
        }
      }
    }
  }
  return actions;
}
export function previewMove(view, seat, action) {
  const copy = structuredClone(view); copy.discard = [];
  const event = execute(copy, seat, action);
  return {hands: copy.hands, table: copy.table, event};
}
export function assertState(state) {
  const deck = makeDeck(state.options.compactDeck), seen = new Set(), counts = new Set();
  const cards=[...state.hands.flat(), ...state.table.flat(2), ...state.discard];
  if(state.firstPlayer!==undefined&&cards.filter(c=>c.star).length!==1)throw new Error('The unique starred card disappeared.');
  for (const card of cards) {
    const source = deck.find(c => c.id === card.id);
    if (!source || seen.has(card.id) || ![0, 1].includes(card.face) || source.ends.some((n, i) => n !== card.ends[i]) || card.star !== undefined && card.star !== source.star) throw new Error('Card conservation failed.');
    seen.add(card.id);
  }
  if (seen.size !== deck.length) throw new Error('A card disappeared.');
  for (const set of state.table.flat()) if (set.length) {
    if (set.some(card => valueOf(card) !== setValue(set)) || counts.has(set.length)) throw new Error('Invalid table sets.');
    counts.add(set.length);
  }
  if (state.pending !== null && (state.hands[state.pending].length || state.turn === state.pending)) throw new Error('Invalid last-chance window.');
  return true;
}
