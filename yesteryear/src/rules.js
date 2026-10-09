import {CARDS, DECKS, THEMES} from './cards.js';

// Yesteryear: pure, seeded rules. Place a card from your hand into the shared
// timeline; a correct card stays, a wrong one is discarded and replaced.
// Race: first to empty their hand, after everyone has had the same number of
// turns. Streak (solo or co-op): one shared hand, three lives, score per card.
export const MODES = {race: 'Race', streak: 'Streak'};
export const handSize = seats => seats <= 3 ? 6 : seats <= 5 ? 5 : 4;
export const LIVES = 3;

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
export const year = id => CARDS[id].year;
export function deckFor(decks) {
  const themes = decks === 'mix' ? Object.keys(THEMES) : [decks];
  assert(themes.every(theme => Object.hasOwn(DECKS, theme)), 'Choose a deck.');
  return themes.flatMap(theme => DECKS[theme]);
}
// A card fits a slot when no neighbour contradicts it. Equal years fit either side.
export function fits(timeline, id, slot) {
  const left = timeline[slot - 1], right = timeline[slot];
  return (!left || year(left) <= year(id)) && (!right || year(id) <= year(right));
}
export function correctSlot(timeline, id) { return timeline.filter(other => year(other) <= year(id)).length; }

export function createGame({seats = 2, mode = 'race', decks = 'mix'} = {}, seed = 1) {
  assert(Object.hasOwn(MODES, mode), 'Choose Race or Streak.');
  assert(Number.isInteger(seats) && (mode === 'streak' ? seats === 1 : seats >= 2 && seats <= 6), 'Choose the number of players.');
  assert(Number.isInteger(seed), 'Invalid game seed.');
  const state = {seats, mode, decks, seed: seed >>> 0, rng: seed >>> 0, revision: 0, round: 0, phase: 'playing', turn: 0, starter: 0,
    deck: [], timeline: [], hands: [], discards: [], lives: mode === 'streak' ? LIVES : null, last: null, ending: false, out: [], winners: []};
  state.deck = shuffle(state, deckFor(decks));
  state.timeline = [state.deck.shift()];
  const size = mode === 'streak' ? 3 : handSize(seats);
  for (let seat = 0; seat < seats; seat++) state.hands.push(state.deck.splice(0, size));
  state.starter = state.turn = mode === 'streak' ? 0 : Math.floor(random(state) * seats);
  return state;
}
export function legalActions(state, seat = state.turn) {
  if (state.phase !== 'playing' || seat !== state.turn) return [];
  return state.hands[seat].flatMap(card => Array.from({length: state.timeline.length + 1}, (_, slot) => ({kind: 'place', card, slot})));
}

export function applyAction(state, seat, action) {
  assert(state.phase === 'playing', 'This game is over.');
  assert(seat === state.turn, 'Wait for your turn.');
  assert(action?.kind === 'place' && state.hands[seat].includes(action.card) && Number.isInteger(action.slot) && action.slot >= 0 && action.slot <= state.timeline.length, 'Choose a card and a place in the timeline.');
  const next = structuredClone(state), {card, slot} = action;
  const hand = next.hands[seat];
  hand.splice(hand.indexOf(card), 1);
  const correct = fits(next.timeline, card, slot);
  next.last = {seat, card, slot, correct, at: correctSlot(next.timeline, card)};
  if (correct) next.timeline.splice(slot, 0, card);
  else {
    next.discards.push(card);
    if (next.mode === 'streak') next.lives--;
    if (next.deck.length) hand.push(next.deck.shift());
  }
  if (correct && next.mode === 'streak' && next.deck.length) hand.push(next.deck.shift());
  next.revision++;
  if (next.mode === 'streak') {
    if (next.lives <= 0 || !hand.length) next.phase = 'over';
    return next;
  }
  if (correct && !hand.length) next.ending = true;
  advance(next);
  return next;
}
// Next player in the race; a round that someone finished ends the game, or
// starts a tie-break round among everyone who emptied their hand. Every turn
// shrinks a hand or the deck, so a race always ends.
function advance(state) {
  const active = seat => !state.out.includes(seat);
  let seat = state.turn;
  do {
    seat = (seat + 1) % state.seats;
    if (seat === state.starter) {
      state.round++;
      if (state.ending) {
        const empty = Array.from({length: state.seats}, (_, i) => i).filter(i => active(i) && !state.hands[i].length);
        if (empty.length === 1 || state.deck.length < empty.length) { finish(state, empty); return; }
        state.out = Array.from({length: state.seats}, (_, i) => i).filter(i => !empty.includes(i));
        for (const i of empty) state.hands[i].push(state.deck.shift());
        state.ending = false;
        state.starter = empty[0];
        state.turn = empty[0];
        return;
      }
    }
  } while (!active(seat));
  state.turn = seat;
}
function finish(state, winners) { state.phase = 'over'; state.winners = winners; state.ending = false; }
export const score = state => state.timeline.length - 1;

// Hidden: every hand's years, the deck order and other players' cards.
export function playerView(state, seat) {
  const view = {seats: state.seats, mode: state.mode, decks: state.decks, revision: state.revision, round: state.round, phase: state.phase, turn: state.turn,
    seat, timeline: state.timeline.slice(), hand: state.hands[seat]?.slice() || [], counts: state.hands.map(hand => hand.length),
    deck: state.deck.length, discards: state.discards.slice(), lives: state.lives, last: state.last ? {...state.last} : null,
    ending: state.ending, out: state.out.slice(), winners: state.winners.slice()};
  if (state.phase === 'over') view.hands = state.hands.map(hand => hand.slice());
  return view;
}
export function validateView(view) {
  if (!view || !Object.hasOwn(MODES, view.mode) || !Array.isArray(view.timeline) || !Array.isArray(view.hand) || [...view.timeline, ...view.hand].some(id => !Object.hasOwn(CARDS, id))) throw new Error('Invalid Yesteryear table.');
  return view;
}
