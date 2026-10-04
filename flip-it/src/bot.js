import {legalActions, previewMove, valueOf, reverseOf} from './rules.js';

function potential(hand, flipped = false) {
  const groups = new Map();
  for (const card of hand) { const rank = flipped ? reverseOf(card) : valueOf(card); groups.set(rank, (groups.get(rank) || 0) + 1); }
  return [...groups.values()].reduce((sum, count) => sum + count * count, 0);
}
// The dealer receives the same redacted view as a human, never the other hand.
export function botAction(view, seat = view.turn) {
  const actions = legalActions(view, seat);
  if (!actions.length) return null;
  let best = actions[0], bestScore = -Infinity;
  for (const action of actions) {
    const after = previewMove(view, seat, action), own = after.hands[seat];
    const shed = view.hands[seat].length - own.length;
    let score = shed * 15 + after.event.cashed * 2;
    if (!own.length) score += 500;
    if (view.pending !== null && view.pending !== seat && after.hands[view.pending].length) score += 2000;
    score += after.hands.reduce((n,h,p)=>n+(p===seat?0:h.length-view.hands[p].length),0)*6;
    score += potential(own) * .45;
    if (action.kind === 'flip') score += (potential(own) - potential(view.hands[seat])) * 1.7 - 7;
    if (action.kind === 'take') score -= 4;
    if (action.kind === 'play') {
      const set = after.table[seat][action.lane], rank = valueOf(set[0]);
      score += rank * .12;
      if (!own.length && view.options.lastChance) score += rank * 4 + set.length * 3;
    }
    // Stable public-information tie break, varied across turns without randomness.
    const signature = JSON.stringify(action);
    let hash = view.moves + view.round * 53;
    for (const char of signature) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
    score += (hash % 1000) / 10000;
    if (score > bestScore) { bestScore = score; best = action; }
  }
  return best;
}
