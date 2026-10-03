// Pure, deterministic rules. The UI, bot and peer session all use this reducer.
export const GAMES = {
  backhand: {name: 'Backhand', subtitle: 'Win the prize. Give away the power.', rounds: 9, accent: 'coral', sprite: 'back', time: '3–5 MIN'},
  closing: {name: 'Closing Time', subtitle: 'A good bid needs better timing.', rounds: 9, accent: 'gold', sprite: 'clock', time: '5–8 MIN'},
  heist: {name: 'Pocket Heist', subtitle: 'Easy money. Or a beautiful bluff.', rounds: 5, accent: 'mint', sprite: 'vault', time: '3–5 MIN'}
};

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
function record(state, event) {
  state.log.push({...event, at: state.revision + 1});
}
function newAuction(prize) {
  return {id: prize.id, value: prize.value, clock: 0, cubes: [0, 0], first: null};
}
function dealLoot(state) {
  state.loot = [state.deck.splice(0, 2), state.deck.splice(0, 2)].map(pair => pair.sort((a, b) => a.value - b.value));
}
export function createGame(type, seed = 1) {
  assert(Object.hasOwn(GAMES, type), 'Choose one of the three games.');
  assert(Number.isInteger(seed), 'Invalid game seed.');
  const state = {type, seed: seed >>> 0, rng: seed >>> 0, revision: 0, scores: [0, 0], log: [], result: null, round: 0};
  if (type === 'backhand') {
    state.hands = [0, 1].map(p => [1, 2, 3, 4, 5].map(value => ({id: 'b' + p + value, value})));
    state.prizes = shuffle(state, [1, 1, 1, 2, 2, 2, 3, 3, 3]);
    state.carry = 0;
    state.pending = [null, null];
    state.phase = 'choose';
  } else if (type === 'closing') {
    const prizes = shuffle(state, [1, 1, 1, 2, 2, 2, 3, 3, 3]).map((value, i) => ({id: 'lot' + i, value}));
    state.auctions = prizes.splice(0, 3).map(newAuction);
    state.deck = prizes;
    state.turn = 0;
    state.phase = 'bid';
    state.invested = null;
    state.ticks = 0;
    state.closed = 0;
  } else {
    state.hands = [0, 1].map(p => ['alarm', 'alarm', 'alarm', 'bluff', 'bluff', 'bluff'].map((kind, i) => ({id: 'h' + p + i, kind})));
    state.deck = shuffle(state, Array.from({length: 24}, (_, i) => ({id: 'coin' + i, value: [2, 3, 5][i % 3]})));
    state.used = [[], []];
    state.guards = [null, null];
    state.raids = [null, null];
    state.phase = 'guard';
    dealLoot(state);
  }
  return state;
}
export function reserve(state, player) {
  return 5 - state.auctions.filter(Boolean).reduce((sum, lot) => sum + lot.cubes[player], 0);
}
function auction(state, id) {
  const lot = state.auctions.find(a => a?.id === id);
  assert(lot, 'That auction has already closed.');
  return lot;
}
function next(state, player) {
  assert(player === 0 && state.phase === 'reveal', 'Wait for both players before dealing again.');
  state.round++;
  state.result = null;
  if (state.type === 'backhand') {
    state.pending = [null, null];
    state.phase = 'choose';
  } else {
    state.guards = [null, null];
    state.raids = [null, null];
    state.phase = 'guard';
    dealLoot(state);
  }
}
function backhand(state, player, action) {
  assert(state.phase === 'choose' && action.kind === 'bid', 'Choose a card for this round.');
  assert(state.pending[player] === null, 'Your card is already locked.');
  const card = state.hands[player].find(c => c.id === action.card);
  assert(card, 'That card is not in your hand.');
  state.pending[player] = card.id;
  if (state.pending.some(c => c === null)) return;
  const played = state.pending.map((id, p) => state.hands[p].find(c => c.id === id));
  const value = state.prizes[state.round] + state.carry;
  const winner = played[0].value === played[1].value ? null : Number(played[1].value > played[0].value);
  if (winner === null) state.carry = value;
  else { state.scores[winner] += value; state.carry = 0; }
  for (let p = 0; p < 2; p++) {
    state.hands[p] = state.hands[p].filter(c => c.id !== played[p].id);
    state.hands[p].push(played[1 - p]);
    state.hands[p].sort((a, b) => a.value - b.value || a.id.localeCompare(b.id));
  }
  state.result = {kind: 'backhand', played, value, winner, discarded: state.round === 8 ? state.carry : 0};
  record(state, {...state.result, round: state.round + 1});
  state.pending = [null, null];
  state.phase = state.round === 8 ? 'over' : 'reveal';
}
function closing(state, player, action) {
  assert(player === state.turn, 'It is your opponent’s turn.');
  if (state.phase === 'bid') {
    assert(action.kind === 'cube' || action.kind === 'skip', 'Place a cube or hold your cubes.');
    state.invested = null;
    if (action.kind === 'cube') {
      const to = auction(state, action.to);
      if (action.from != null) {
        const from = auction(state, action.from);
        assert(from !== to && from.cubes[player] > 0, 'Move one of your cubes from a different auction.');
        from.cubes[player]--;
      } else assert(reserve(state, player) > 0, 'Move an existing cube; your reserve is empty.');
      to.cubes[player]++;
      if (to.first === null) to.first = player;
      state.invested = to.id;
    }
    state.phase = 'clock';
  } else {
    assert(state.phase === 'clock' && action.kind === 'tick', 'Advance an auction clock.');
    const lot = auction(state, action.lot);
    const remaining = state.auctions.filter(Boolean).length;
    assert(lot.id !== state.invested || remaining === 1, 'Advance a different auction.');
    lot.clock++;
    state.ticks++;
    state.result = null;
    if (lot.clock === 3) {
      const total = lot.cubes[0] + lot.cubes[1];
      const winner = !total ? null : lot.cubes[0] === lot.cubes[1] ? lot.first : Number(lot.cubes[1] > lot.cubes[0]);
      if (winner !== null) state.scores[winner] += lot.value;
      state.result = {kind: 'closing', winner, value: lot.value, cubes: lot.cubes.slice(), first: lot.first};
      record(state, state.result);
      const i = state.auctions.indexOf(lot);
      state.auctions[i] = state.deck.length ? newAuction(state.deck.shift()) : null;
      state.closed++;
    }
    state.invested = null;
    state.turn = 1 - player;
    state.phase = state.auctions.some(Boolean) ? 'bid' : 'over';
  }
}
function heist(state, player, action) {
  if (state.phase === 'guard') {
    assert(action.kind === 'guard' && state.guards[player] === null, 'Your defense is already locked.');
    const card = state.hands[player].find(c => c.id === action.card);
    assert(card, 'Choose an available defense.');
    state.guards[player] = card.id;
    if (state.guards.every(Boolean)) state.phase = 'raid';
  } else {
    assert(state.phase === 'raid' && action.kind === 'raid' && state.raids[player] === null, 'Choose how to approach the other vault.');
    assert(action.choice === 'safe' || action.choice === 'raid', 'Choose easy money or raid.');
    state.raids[player] = action.choice;
    if (state.raids.some(c => c === null)) return;
    const defenses = state.guards.map((id, p) => state.hands[p].find(c => c.id === id));
    const gain = [0, 0];
    const outcomes = [];
    for (let attacker = 0; attacker < 2; attacker++) {
      const defender = 1 - attacker;
      const [outside, vault] = state.loot[defender];
      const trapped = defenses[defender].kind === 'alarm';
      if (state.raids[attacker] === 'safe') {
        gain[attacker] += outside.value; gain[defender] += vault.value;
        outcomes.push('safe');
      } else if (trapped) {
        gain[defender] += outside.value + vault.value; outcomes.push('caught');
      } else {
        gain[attacker] += outside.value + vault.value; outcomes.push('clean');
      }
    }
    state.scores = state.scores.map((score, p) => score + gain[p]);
    state.result = {kind: 'heist', gain, outcomes, defenses: defenses.map(c => c.kind), raids: state.raids.slice()};
    record(state, {...state.result, round: state.round + 1});
    for (let p = 0; p < 2; p++) {
      state.used[p].push(defenses[p].kind);
      state.hands[p] = state.hands[p].filter(c => c.id !== defenses[p].id);
    }
    state.guards = [null, null];
    state.raids = [null, null];
    state.phase = state.round === 4 ? 'over' : 'reveal';
  }
}
export function applyAction(original, player, action) {
  assert(player === 0 || player === 1, 'Invalid player.');
  assert(action && typeof action.kind === 'string', 'Invalid move.');
  assert(original.phase !== 'over', 'The game is finished.');
  const state = structuredClone(original);
  if (action.kind === 'next') next(state, player);
  else if (state.type === 'backhand') backhand(state, player, action);
  else if (state.type === 'closing') closing(state, player, action);
  else heist(state, player, action);
  state.revision++;
  return state;
}
// Return only the information this seat is entitled to see. Decks, RNG and
// unrevealed choices never travel to the other browser.
export function playerView(state, player) {
  const view = structuredClone(state);
  delete view.rng;
  delete view.seed;
  if (state.type === 'closing') {
    view.deckCount = view.deck?.length ?? view.deckCount;
    delete view.deck;
  } else {
    view.hands[1 - player] = view.hands[1 - player].map(() => ({hidden: true}));
    if (state.type === 'backhand') {
      view.currentPrize = state.prizes?.[state.round] ?? state.currentPrize;
      view.nextPrize = state.prizes?.[state.round + 1] ?? state.nextPrize ?? null;
      delete view.prizes;
      view.pending = view.pending.map((id, p) => p === player ? id : Boolean(id));
    } else {
      delete view.deck;
      view.guards = view.guards.map((id, p) => p === player ? id : Boolean(id));
      view.raids = view.raids.map((choice, p) => p === player ? choice : Boolean(choice));
    }
  }
  return view;
}
export function legalActions(state, player) {
  if (state.phase === 'over') return [];
  if (state.phase === 'reveal') return player === 0 ? [{kind: 'next'}] : [];
  if (state.type === 'backhand') return state.pending[player] !== null ? [] : state.hands[player].map(c => ({kind: 'bid', card: c.id}));
  if (state.type === 'heist') {
    if (state.phase === 'guard') return state.guards[player] !== null ? [] : state.hands[player].map(c => ({kind: 'guard', card: c.id}));
    return state.raids[player] !== null ? [] : ['safe', 'raid'].map(choice => ({kind: 'raid', choice}));
  }
  if (state.turn !== player) return [];
  const lots = state.auctions.filter(Boolean);
  if (state.phase === 'clock') return lots.filter(lot => lot.id !== state.invested || lots.length === 1).map(lot => ({kind: 'tick', lot: lot.id}));
  const choices = [{kind: 'skip'}];
  for (const to of lots) {
    if (reserve(state, player)) choices.push({kind: 'cube', to: to.id, from: null});
    for (const from of lots) if (from.id !== to.id && from.cubes[player]) choices.push({kind: 'cube', to: to.id, from: from.id});
  }
  return choices;
}
export function winner(state) {
  return state.scores[0] === state.scores[1] ? null : Number(state.scores[1] > state.scores[0]);
}
