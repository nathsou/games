import {createMatch, applyAction, playerView, optionsFor, makeDeck, valueOf} from './rules.js';
import {randomHex} from './peer.js';

const integer = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;
export function validateView(view, visibleSeat) {
  const seats = view?.hands?.length, players = Array.from({length:Number.isInteger(seats)?seats:0},(_,i)=>i);
  if (!view || !Number.isInteger(seats) || seats < 2 || seats > 5 || !players.includes(visibleSeat)) throw new Error('Invalid game update.');
  const options = optionsFor(view.options), deck = makeDeck(options.compactDeck);
  if (!integer(view.revision, 2000000) || !integer(view.round, 10000) || !integer(view.moves, 10000) ||
      !['playing', 'roundOver', 'matchOver'].includes(view.phase) || !players.includes(view.turn) || ![0, 1].includes(view.beat) ||
      ![null,...players].includes(view.pending) || !integer(view.discardCount, deck.length) ||
      !Array.isArray(view.scores) || view.scores.length !== seats || view.scores.some(n => !integer(n, 2)) ||
      !Array.isArray(view.hands) || view.hands.length !== seats || view.hands.some(h => !Array.isArray(h) || h.length > deck.length) ||
      !Array.isArray(view.table) || view.table.length !== seats || view.table.some(row => !Array.isArray(row) || row.length !== 2 || row.some(s => !Array.isArray(s) || s.length > 8))) throw new Error('Invalid game update.');
  if (!integer(view.repliesRemaining, seats-1) || (view.pending === null) !== (view.repliesRemaining === 0)) throw new Error('Invalid reply window.');
  const seen = new Set(), sizes = new Set();
  function checkCard(card) {
    const source = deck.find(c => c.id === card?.id);
    if (!source || !Array.isArray(card.ends) || card.ends.length !== 2 || card.ends.some((n, i) => n !== source.ends[i]) || ![0, 1].includes(card.face) || seen.has(card.id)) throw new Error('Invalid card update.');
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
      (view.phase === 'matchOver') !== view.scores.includes(2) ||
      view.history.length !== view.round + Number(ended) ||
      view.scores.some((score, seat) => score !== view.history.filter(r => r.winner === seat).length)) throw new Error('Inconsistent round update.');
  for (const event of view.log) {
    if (!event || !players.includes(event.seat) || !['play', 'add', 'take', 'flip'].includes(event.kind) || ![0, 1].includes(event.lane) || !integer(event.cashed, 8) ||
        !Array.isArray(event.returned) || event.returned.length > seats*2-1 || event.returned.some(r => !r || !players.includes(r.seat) || !integer(r.count, 8) || !integer(r.from, 10) || !Array.isArray(r.to) || r.to.length !== r.count || r.to.some(n => !integer(n, 10) || !n))) throw new Error('Invalid move update.');
    if (event.kind !== 'flip' && (!integer(event.count, 8) || !event.count || !integer(event.value, 10) || !event.value)) throw new Error('Invalid move update.');
    if (['add', 'take'].includes(event.kind) && (![0, 1].includes(event.target) || !players.includes(event.targetSeat) || event.targetSeat === event.seat)) throw new Error('Invalid target update.');
  }
  return view;
}
export class FlipSession {
  constructor({seat = 0, name = 'You', options, team = false, aiPlayers = [], onUpdate = () => {}, onError = () => {}} = {}) {
    this.seat = seat; this.team = team; this.options = optionsFor(options);
    this.aiPlayers = aiPlayers.filter(t=>['dealer','model'].includes(t)).slice(0, team?4:3);
    if (team && !this.aiPlayers.length) this.aiPlayers=['dealer'];
    this.controllers = [...Array(team?1:2).fill('human'),...this.aiPlayers];
    this.members = seat ? ['Host', name] : [name, 'Friend'];
    this.onUpdate = onUpdate; this.onError = onError;
    this.state = null; this.view = null; this.epoch = null;
    this.ready = [false, false]; this.movePending = false; this.readyForPlay = false;
  }
  get names() { return [...(this.team?[(this.members[0]+' + '+this.members[1]).slice(0,40)]:this.members),...this.controllers.filter(t=>t!=='human').map((t,i)=>(t==='model'?'AI ':'Dealer ')+(i+1))]; }
  setPeer(peer) { this.peer = peer; this.movePending = false; this.readyForPlay = false; this.ready = [false, false]; if (!this.seat && this.state) this.epoch = randomHex(8); }
  opened() { this.peer.send({type: 'hello', name: this.members[this.seat]}); }
  start(options = this.options, seed = crypto.getRandomValues(new Uint32Array(1))[0]) {
    if (this.seat || !this.peer?.connected) throw new Error('The connected host deals the match.');
    this.options = optionsFor(options); this.state = createMatch(this.options, seed, 0, this.controllers.length); this.epoch = randomHex(8);
    this.ready = [false, false]; this.readyForPlay = true; this.sync();
  }
  sync() {
    if (this.seat || !this.state) return;
    this.view = playerView(this.state, 0);
    if (this.peer?.connected) this.peer.send({type: 'state', epoch: this.epoch, team: this.team, members: this.members, controllers:this.controllers, ready: this.ready, view: playerView(this.state, this.team ? 0 : 1)});
    this.movePending = false; this.onUpdate();
  }
  choose(action) {
    if (!this.peer?.connected || !this.readyForPlay) throw new Error('Reconnect your friend before continuing.');
    if (this.movePending) return;
    if (action.kind === 'next') {
      if (this.view.phase !== 'roundOver') throw new Error('The round is still in progress.');
      this.ready[this.seat] = true;
      if (!this.seat) this.advance();
      else { this.peer.send({type: 'ready', epoch: this.epoch, revision: this.view.revision}); this.onUpdate(); }
      return;
    }
    if (!this.seat) { this.state = applyAction(this.state, 0, action); this.sync(); }
    else { this.movePending = true; this.peer.send({type: 'action', epoch: this.epoch, revision: this.view.revision, action}); this.onUpdate(); }
  }
  dealerMove(action) { return this.botMove(1, action); }
  botMove(seat, action) {
    if (this.seat || this.controllers[seat] === 'human' || !this.peer?.connected || !this.readyForPlay) return;
    this.state = applyAction(this.state, seat, action); this.sync();
  }
  advance() {
    if (this.ready.every(Boolean)) { this.state = applyAction(this.state, 0, {kind: 'next'}); this.ready = [false, false]; }
    this.sync();
  }
  receive(message) {
    try {
      if (message.type === 'hello') {
        if (typeof message.name !== 'string' || message.name.length > 24) throw new Error('Invalid player name.');
        this.members[1 - this.seat] = message.name || 'Friend';
        if (!this.seat) { this.readyForPlay = true; if (this.state) this.sync(); else this.start(); }
        return;
      }
      if (message.type === 'state' && this.seat) {
        if (!/^[a-f0-9]{16}$/.test(message.epoch) || typeof message.team !== 'boolean' ||
            !Array.isArray(message.members) || message.members.length !== 2 || message.members.some(n => typeof n !== 'string' || n.length > 24) ||
            !Array.isArray(message.ready) || message.ready.length !== 2 || message.ready.some(n => typeof n !== 'boolean')) throw new Error('Invalid table update.');
        if (!Array.isArray(message.controllers) || message.controllers.length < 2 || message.controllers.length > 5 || message.controllers.some((t,i)=>i<(message.team?1:2)?t!=='human':!['dealer','model'].includes(t))) throw new Error('Invalid player configuration.');
        const next = validateView(message.view, message.team ? 0 : 1);
        if (next.hands.length !== message.controllers.length) throw new Error('Invalid player count.');
        if (message.epoch === this.epoch && this.view && next.revision < this.view.revision) return;
        this.view = next; this.epoch = message.epoch; this.team = message.team; this.controllers = message.controllers; this.members = message.members; this.ready = message.ready;
        this.movePending = false; this.readyForPlay = true; this.onUpdate(); return;
      }
      if (message.epoch !== this.epoch || this.seat || !this.state) throw new Error('This move belongs to an earlier match.');
      if (message.revision !== this.state.revision) { this.sync(); return; }
      if (message.type === 'ready') {
        if (this.state.phase !== 'roundOver') throw new Error('Unexpected next-round request.');
        this.ready[1] = true; this.advance();
      } else if (message.type === 'action') {
        this.state = applyAction(this.state, this.team ? 0 : 1, message.action); this.sync();
      } else throw new Error('Unexpected table message.');
    } catch (error) {
      if (!this.seat && this.state) this.sync();
      this.onError(error);
    }
  }
}
