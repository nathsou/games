import {optionsFor, makeDeck, valueOf} from './rules.js';

const integer = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;
// Validates a seat's view before the table renders it.
export function validateView(view, visibleSeat, {legacySpaces=false} = {}) {
  const seats = view?.hands?.length, players = Array.from({length:Number.isInteger(seats)?seats:0},(_,i)=>i);
  if (!view || !Number.isInteger(seats) || seats < 2 || seats > 5 || !players.includes(visibleSeat)) throw new Error('Invalid game update.');
  const options = optionsFor(view.options), deck = makeDeck(options.compactDeck);
  if (!integer(view.revision, 2000000) || !integer(view.round, 10000) || !integer(view.moves, 10000) ||
      !['playing', 'roundOver', 'matchOver'].includes(view.phase) || !players.includes(view.turn) || ![0, 1].includes(view.beat) || typeof view.opening !== 'boolean' ||
      ![null,...players].includes(view.pending) || !integer(view.discardCount, deck.length) ||
      !Array.isArray(view.scores) || view.scores.length !== seats || view.scores.some(n => !integer(n, options.target)) ||
      !Array.isArray(view.hands) || view.hands.length !== seats || view.hands.some(h => !Array.isArray(h) || h.length > deck.length) ||
      !Array.isArray(view.table) || view.table.length !== seats || view.table.some(row => !Array.isArray(row) || row.length !== 2 || row.some(s => !Array.isArray(s) || s.length > 8))) throw new Error('Invalid game update.');
  if (view.id !== undefined && (typeof view.id !== 'string' || !/^[a-f0-9]{32}$/.test(view.id)) ||
      view.firstPlayer !== undefined && !players.includes(view.firstPlayer) ||
      !legacySpaces && options.quickTurns && view.table.some(row=>row[1].length)) throw new Error('Invalid play spaces.');
  if (!integer(view.repliesRemaining, seats-1) || (view.pending === null) !== (view.repliesRemaining === 0)) throw new Error('Invalid reply window.');
  const seen = new Set(), sizes = new Set();
  function checkCard(card) {
    const source = deck.find(c => c.id === card?.id);
    if (!source || !Array.isArray(card.ends) || card.ends.length !== 2 || card.ends.some((n, i) => n !== source.ends[i]) || ![0, 1].includes(card.face) || seen.has(card.id) || card.star !== undefined && card.star !== source.star) throw new Error('Invalid card update.');
    seen.add(card.id);
  }
  for (const card of view.hands[visibleSeat]) checkCard(card);
  for (const card of view.hands.filter((_,i)=>i!==visibleSeat).flat()) if (!card || card.hidden !== true || Object.keys(card).length !== 1) throw new Error('An opponent’s private hand was exposed.');
  for (const set of view.table.flat()) if (set.length) {
    set.forEach(checkCard);
    if (set.some(c => valueOf(c) !== valueOf(set[0])) || sizes.has(set.length)) throw new Error('Invalid table update.');
    sizes.add(set.length);
  }
  if (view.hands.flat().length + view.table.flat(2).length + view.discardCount !== deck.length ||
      view.pending !== null && (view.hands[view.pending].length !== 0 || view.turn === view.pending)) throw new Error('Invalid card count.');
  const resultOK = result => result && [null,...players].includes(result.winner) && ['empty', 'survived', 'repeat', 'limit'].includes(result.reason) && integer(result.moves, 10000) && Number.isInteger(result.round) && result.round > 0 && result.round <= 10001;
  if (!Array.isArray(view.history) || view.history.length > 10001 || view.history.some(r => !resultOK(r)) ||
      view.result !== null && !resultOK(view.result) || !Array.isArray(view.log) || view.log.length > 12) throw new Error('Invalid round update.');
  const ended = view.phase !== 'playing';
  if (ended !== (view.result !== null) || ended && (view.pending !== null || view.result.round !== view.round + 1) ||
      (view.phase === 'matchOver') !== view.scores.includes(options.target) ||
      view.history.length !== view.round + Number(ended) ||
      view.scores.some((score, seat) => score !== view.history.filter(r => r.winner === seat).length)) throw new Error('Inconsistent round update.');
  for (const event of view.log) {
    if (!event || !players.includes(event.seat) || !['play', 'add', 'take', 'flip'].includes(event.kind) || ![0, 1].includes(event.lane) || !integer(event.cashed, 8) ||
        !Array.isArray(event.returned) || event.returned.length > seats*2-1 || event.returned.some(r => !r || !players.includes(r.seat) || !integer(r.count, 8) || !integer(r.from, 10) || !Array.isArray(r.to) || r.to.length !== r.count || r.to.some(n => !integer(n, 10) || !n))) throw new Error('Invalid move update.');
    if (event.kind !== 'flip' && (!integer(event.count, 8) || !event.count || !integer(event.value, 10) || !event.value)) throw new Error('Invalid move update.');
    if (['add', 'take'].includes(event.kind) && (![0, 1].includes(event.target) || !players.includes(event.targetSeat) || event.kind === 'take' && event.targetSeat === event.seat)) throw new Error('Invalid target update.');
  }
  return view;
}
