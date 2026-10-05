import {legalActions,previewMove,playerView,valueOf,reverseOf} from './rules.js';
export function describeTurn(state,seat,previous=[]) {
  // Room games already deliver this seat's private view.
  const observation=state.discard?playerView(state,seat):structuredClone(state);
  // Identical faces are interchangeable for strategy; keep one representative
  // for each distinct combination of reverse ranks, reducing prompt size.
  const seen=new Set(), candidates=[];
  for(const action of legalActions(observation,seat)) {
    const cards=(action.cards||[]).map(id=>observation.hands[seat].find(c=>c.id===id));
    const signature=JSON.stringify([action.kind,action.lane,action.targetSeat,action.target,cards.map(c=>[valueOf(c),reverseOf(c)]).sort()]);
    if(seen.has(signature))continue;seen.add(signature);
    const after=previewMove(observation,seat,action);
    candidates.push({action,playedRanks:cards.map(valueOf),reverseRanks:cards.map(reverseOf),ownHandAfter:after.hands[seat].length,
      cashOut:after.event.cashed,returns:after.event.returned,opponentHandCounts:after.hands.map((h,p)=>p===seat?null:h.length)});
  }
  return {game:'flip-it',rules:`FLIP IT: ${observation.hands.length} players clockwise. The player dealt the unique starred card opens each round; the star has no special power during play. Empty your hand to win a round; first to ${observation.options.target||2} round wins takes the match. Active card value is ends[face], reverse is ends[1-face]. Before ANY action, the chosen own lane is cashed out permanently. Play matching active ranks to your lane; same-size sets anywhere require a strictly higher active rank, and all lower sets return to owners flipped. Add exactly one matching card to any exposed set, including your other lane, comparing its NEW size globally. If the enlarged set has a lower rank than the competing set of that size, the entire enlarged set (including the added card) returns to its owner flipped; otherwise the lower competing sets return flipped. An equal-rank same-size clash is illegal. This can return cards to you or another player. Take another player's whole set into your hand flipped. Flip rotates your entire hand. Quick turns ON gives one action using the single play space (lane 0); OFF gives right then left, opening player only right. Last chance ON gives EVERY other player exactly one reply when a hand empties; counter by returning cards to that specific pending player, otherwise the first empty hand wins after all replies. OFF wins immediately. A repeated position three times or 120/180 ordinary actions draws. Check pending before optimizing your own hand. Candidate outcomes are exact and already legal.`,
    observation:{...observation,you:seat,ownPreviousActions:previous.slice(-6)},candidates};
}
