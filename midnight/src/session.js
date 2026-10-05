import {GAMES} from './rules.js';

// Validates a seat's view before the table renders it.
export function validateView(view) {
  if (!view || !Object.hasOwn(GAMES, view.type) || !Number.isInteger(view.revision) || view.revision < 0 || view.revision > 200 ||
    !Number.isInteger(view.round) || view.round < 0 || view.round >= GAMES[view.type].rounds ||
    !Array.isArray(view.scores) || view.scores.length !== 2 || view.scores.some(s => !Number.isInteger(s) || s < 0 || s > 200) ||
    !Array.isArray(view.log) || view.log.length > 27) throw new Error('Invalid game update.');
  const phases = view.type === 'backhand' ? ['choose', 'reveal', 'over'] : view.type === 'closing' ? ['bid', 'clock', 'over'] : ['guard', 'raid', 'reveal', 'over'];
  if (!phases.includes(view.phase)) throw new Error('Invalid game phase.');
  if (view.type === 'closing') {
    if (!Array.isArray(view.auctions) || view.auctions.length !== 3 || ![0, 1].includes(view.turn)) throw new Error('Invalid auction update.');
    for (const lot of view.auctions.filter(Boolean)) {
      if (!/^lot[0-8]$/.test(lot.id) || ![1, 2, 3].includes(lot.value) || ![0, 1, 2].includes(lot.clock) ||
        !Array.isArray(lot.cubes) || lot.cubes.length !== 2 || lot.cubes.some(n => !Number.isInteger(n) || n < 0 || n > 5) ||
        ![null, 0, 1].includes(lot.first)) throw new Error('Invalid auction update.');
    }
  } else {
    if (!Array.isArray(view.hands) || view.hands.length !== 2 || view.hands.some(h => !Array.isArray(h) || h.length > 6)) throw new Error('Invalid hand update.');
    for (const hand of view.hands) for (const card of hand) {
      if (card.hidden === true) continue;
      if (view.type === 'backhand' ? !/^b[01][1-5]$/.test(card.id) || ![1, 2, 3, 4, 5].includes(card.value) :
        !/^h[01][0-5]$/.test(card.id) || !['alarm', 'bluff'].includes(card.kind)) throw new Error('Invalid card update.');
    }
  }
  const integer = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
  const pair = (a, check) => Array.isArray(a) && a.length === 2 && a.every(check);
  const checkEvent = event => {
    if (!event || event.kind !== view.type) return false;
    if (event.kind === 'backhand') return pair(event.played, c => c && integer(c.value, 5) && c.value > 0) && [null, 0, 1].includes(event.winner) && integer(event.value, 18) && integer(event.discarded, 18);
    if (event.kind === 'closing') return pair(event.cubes, n => integer(n, 5)) && [null, 0, 1].includes(event.winner) && [1, 2, 3].includes(event.value);
    return pair(event.gain, n => integer(n, 20)) && pair(event.outcomes, n => ['safe', 'caught', 'clean'].includes(n)) && pair(event.defenses, n => ['alarm', 'bluff'].includes(n)) && pair(event.raids, n => ['safe', 'raid'].includes(n));
  };
  if (view.log.some(event => !checkEvent(event) || view.type !== 'closing' && (!Number.isInteger(event.round) || event.round < 1 || event.round > GAMES[view.type].rounds)) || view.result !== null && !checkEvent(view.result)) throw new Error('Invalid round result.');
  if (view.type === 'closing') {
    if (!integer(view.ticks, 27) || !integer(view.closed, 9) || !integer(view.deckCount, 6)) throw new Error('Invalid auction count.');
  } else if (view.type === 'backhand') {
    if (!integer(view.carry, 18) || ![1, 2, 3].includes(view.currentPrize) || ![null, 1, 2, 3].includes(view.nextPrize) ||
      !pair(view.pending, n => n === null || typeof n === 'boolean' || typeof n === 'string' && /^b[01][1-5]$/.test(n))) throw new Error('Invalid bid update.');
  } else {
    if (!pair(view.loot, a => pair(a, c => c && [2, 3, 5].includes(c.value))) ||
      !pair(view.used, a => Array.isArray(a) && a.length <= 5 && a.every(k => ['alarm', 'bluff'].includes(k))) ||
      !pair(view.guards, n => n === null || typeof n === 'boolean' || typeof n === 'string' && /^h[01][0-5]$/.test(n)) ||
      !pair(view.raids, n => n === null || typeof n === 'boolean' || ['safe', 'raid'].includes(n))) throw new Error('Invalid vault update.');
  }
  return view;
}
