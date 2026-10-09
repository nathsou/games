import {CARDS} from './cards.js';
import {legalActions} from './rules.js';

// The Yesteryear bot knows each year only roughly: its guess is the true year
// plus a fixed personal error, larger for easier bots and for older events.
// It plays the card it is most confident about.
export const DIFFICULTIES = {easy: 'Casual', normal: 'Buff', hard: 'Historian'};
const SIGMA = {easy: 28, normal: 11, hard: 4};
function gaussian(...parts) {
  let h = 2166136261;
  for (const char of parts.join('|')) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
  const u = ((h >>> 0) + 1) / 4294967297, v = ((Math.imul(h, 2654435761) >>> 0) + 1) / 4294967297;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function guess(state, seat, id, difficulty = 'normal') {
  const real = CARDS[id].year, spread = SIGMA[difficulty] * (1 + Math.max(0, 1900 - real) / 250);
  return {year: real + gaussian(state.seed, seat, id, difficulty) * spread, spread};
}
export function botAction(state, seat, {difficulty = 'normal'} = {}) {
  if (!legalActions(state, seat).length) throw new Error('The bot has no move.');
  const known = state.timeline.map(id => CARDS[id].year);
  let best = null;
  for (const card of state.hands[seat]) {
    const {year, spread} = guess(state, seat, card, difficulty);
    const slot = known.filter(y => y <= year).length;
    const left = known[slot - 1] ?? -Infinity, right = known[slot] ?? Infinity;
    const confidence = Math.min(year - left, right - year) / spread;
    if (!best || confidence > best.confidence) best = {confidence, action: {kind: 'place', card, slot}};
  }
  return best.action;
}
