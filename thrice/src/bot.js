import {legalActions, linked} from './rules.js';

// The Thrice bot plays from what a person at the table could know: its own
// hand, the public log of revealed cards and which cards were claimed. Older
// memories fade according to its difficulty.
export const DIFFICULTIES = {easy: 'Goldfish', normal: 'Sharp', hard: 'Elephant'};
const SCALE = {easy: 1.5, normal: 6, hard: Infinity};
function hash(...parts) {
  let h = 2166136261;
  for (const char of parts.join('|')) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
// Rebuild public knowledge from the log: middle cards seen, and the known
// sequence of values at each end of every hand.
export function memory(state, seat, difficulty = 'normal') {
  const scale = SCALE[difficulty] ?? SCALE.normal, now = state.round;
  const keep = (key, turn) => scale === Infinity || hash(state.seed, seat, key, turn, now) >= 1 - Math.exp(-(now - turn) / scale);
  const middle = new Map(), ends = Array.from({length: state.seats}, () => ({low: [], high: []}));
  const turns = new Map();
  for (const entry of state.log) {
    if (!turns.has(entry.turn)) turns.set(entry.turn, {cards: [], claim: false});
    if (entry.claim) turns.get(entry.turn).claim = true; else turns.get(entry.turn).cards.push(entry);
  }
  for (const [turn, {cards, claim}] of [...turns].sort((a, b) => a[0] - b[0])) {
    if (turn >= state.round) break;
    for (const card of cards) if (card.from === 'middle') { if (claim) middle.delete(card.index); else middle.set(card.index, {value: card.value, turn}); }
    for (let k = 0; k < state.seats; k++) for (const end of ['low', 'high']) {
      const seen = cards.filter(card => card.from === 'hand' && card.seat === k && card.end === end).map(card => ({value: card.value, turn}));
      if (!seen.length) continue;
      const old = ends[k][end];
      ends[k][end] = claim ? old.slice(seen.length) : seen.concat(old.slice(seen.length));
    }
  }
  for (const [index, fact] of middle) if (state.middle[index].taken || !keep('m' + index, fact.turn)) middle.delete(index);
  ends.forEach((sides, k) => { for (const end of ['low', 'high']) {
    const facts = sides[end], kept = [];
    for (let i = 0; i < facts.length; i++) { if (!keep(k + end + i, facts[i].turn)) break; kept.push(facts[i].value); }
    sides[end] = kept;
  } });
  return {middle: new Map([...middle].map(([index, fact]) => [index, fact.value])), ends};
}
const same = (a, b) => a.from === b.from && (a.from === 'middle' ? a.index === b.index : a.seat === b.seat && a.end === b.end);

// Known ways to reveal value v now, in order, without reusing revealed cards.
function sources(state, seat, mind, value) {
  const found = [], hand = state.hands[seat];
  const out = state.reveal.filter(card => card.from === 'hand');
  for (let k = 0; k < state.seats; k++) for (const end of ['low', 'high']) {
    const used = out.filter(card => card.seat === k && card.end === end).length;
    const known = k === seat ? (end === 'low' ? hand : hand.slice().reverse()) : mind.ends[k][end];
    let depth = used;
    while (known[depth] === value) { found.push({kind: 'reveal', from: 'hand', seat: k, end}); depth++; if (k !== seat) break; }
  }
  for (const [index, known] of mind.middle) if (known === value && !state.reveal.some(card => card.from === 'middle' && card.index === index)) found.push({kind: 'reveal', from: 'middle', index});
  return found;
}
export function botAction(state, seat, {difficulty = 'normal'} = {}) {
  const legal = legalActions(state, seat);
  if (!legal.length) throw new Error('The bot has no move.');
  const pick = list => list[Math.floor(hash(state.seed, seat, state.revision, 'pick') * list.length)];
  if (difficulty === 'easy' && hash(state.seed, seat, state.revision, 'slip') < .2) return pick(legal);
  const mind = memory(state, seat, difficulty), isLegal = action => legal.some(a => same(a, action));
  if (state.reveal.length) {
    const value = state.reveal[0].value, known = sources(state, seat, mind, value).filter(isLegal);
    if (known.length) return known[0];
    // No known copy left: guess where an unseen copy is likeliest to sit.
    const unknownMiddle = legal.filter(a => a.from === 'middle' && !mind.middle.has(a.index));
    const end = value <= 6 ? 'low' : 'high';
    const unknownEnds = legal.filter(a => a.from === 'hand' && a.seat !== seat && a.end === end && mind.ends[a.seat][end].length <= state.reveal.filter(c => c.from === 'hand' && c.seat === a.seat && c.end === end).length);
    const extreme = value <= 2 || value >= 11;
    return pick(extreme && unknownEnds.length ? unknownEnds : unknownMiddle.length ? unknownMiddle : unknownEnds.length ? unknownEnds : legal);
  }
  // Start of a turn: chase the value with the most known reachable copies.
  const mine = state.trios[seat];
  let best = null;
  for (let value = 1; value <= 12; value++) {
    const found = sources(state, seat, mind, value).filter(isLegal);
    if (!found.length) continue;
    let score = Math.min(found.length, 3) * 10;
    if (value === 7) score += 4;
    if (state.mode === 'spicy' && mine.some(t => linked(t, value))) score += 6;
    if (found[0].from === 'hand' && found[0].seat === seat) score += 1;
    if (!best || score > best.score) best = {score, action: found[0]};
  }
  return best ? best.action : pick(legal);
}
