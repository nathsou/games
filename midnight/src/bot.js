import {applyAction, legalActions, reserve} from './rules.js';

// Bots never inspect an opponent's hidden choice. Simultaneous decisions are
// prepared before the human commits; heist guesses use only revealed defenses.
export function botAction(state, player, random = Math.random) {
  const choices = legalActions(state, player);
  if (!choices.length) return null;
  if (state.phase === 'reveal') return choices[0];
  const other = 1 - player;
  if (state.type === 'backhand') {
    const cards = state.hands[player];
    const now = (state.currentPrize ?? state.prizes?.[state.round]) + state.carry;
    const later = (state.nextPrize ?? state.prizes?.[state.round + 1]) || 0;
    const target = now > later || now >= 3 ? 5 : now < later ? 1 : 3;
    const ranked = choices.map(a => {
      const value = cards.find(c => c.id === a.card).value;
      return {action: a, score: -Math.abs(value - target) + random() * 2.2};
    });
    return ranked.sort((a, b) => b.score - a.score)[0].action;
  }
  if (state.type === 'heist') {
    if (state.phase === 'guard') {
      const total = state.loot[player].reduce((n, c) => n + c.value, 0);
      const alarms = state.hands[player].filter(c => c.kind === 'alarm').length;
      const odds = Math.min(.95, Math.max(.05, alarms / state.hands[player].length + (total - 7) * .09));
      const kind = random() < odds ? 'alarm' : 'bluff';
      return choices.find(a => state.hands[player].find(c => c.id === a.card).kind === kind) || choices[0];
    }
    const used = state.used[other];
    const alarmOdds = (3 - used.filter(k => k === 'alarm').length) / (6 - used.length);
    const [outside, vault] = state.loot[other];
    const raidValue = (outside.value + vault.value) * (1 - alarmOdds);
    return {kind: 'raid', choice: raidValue + (random() - .5) * 2 > outside.value ? 'raid' : 'safe'};
  }
  function value(s) {
    let result = (s.scores[player] - s.scores[other]) * 12;
    for (const lot of s.auctions.filter(Boolean)) {
      const diff = lot.cubes[player] - lot.cubes[other];
      const lead = diff === 0 ? lot.first === null ? 0 : lot.first === player ? .35 : -.35 : Math.sign(diff);
      result += lot.value * (lead * (1 + lot.clock * .65) + diff * .12);
    }
    result += (reserve(s, player) - reserve(s, other)) * .12;
    return result;
  }
  if (state.phase === 'clock') {
    return choices.map(action => ({action, score: value(applyAction(state, player, action)) + random() * .6})).sort((a, b) => b.score - a.score)[0].action;
  }
  return choices.map(action => {
    const afterBid = applyAction(state, player, action);
    const score = Math.max(...legalActions(afterBid, player).map(tick => value(applyAction(afterBid, player, tick))));
    return {action, score: score + random() * .65};
  }).sort((a, b) => b.score - a.score)[0].action;
}
