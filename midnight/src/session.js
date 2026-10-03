import {createGame, applyAction, playerView, GAMES, winner} from './rules.js';
import {randomHex} from './peer.js';

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}
export async function commitment(context, seat, action, salt) {
  const text = canonical({context, seat, action, salt});
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function verifyCommitment(hash, context, seat, action, salt) {
  if (!/^[a-f0-9]{64}$/.test(hash || '') || !/^[a-f0-9]{32}$/.test(salt || '')) return false;
  return hash === await commitment(context, seat, action, salt);
}
export function contextFor(epoch, state) { return epoch + '/' + state.type + '/' + state.round + '/' + state.phase; }

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
  return view;
}
export class TableSession {
  constructor({seat = 0, name = 'You', onUpdate, onError}) {
    this.seat = seat;
    this.names = seat === 0 ? [name, 'Partner'] : ['Host', name];
    this.onUpdate = onUpdate;
    this.onError = onError;
    this.series = [0, 0];
    this.peer = null;
    this.epoch = null;
    this.state = null;
    this.view = null;
    this.resetChoices();
  }
  resetChoices() {
    this.commits = [null, null];
    this.reveals = [null, null];
    this.local = null;
    this.ready = [false, false];
    this.busy = false;
    this.movePending = false;
  }
  setPeer(peer) {
    this.peer = peer;
    this.resetChoices();
    if (this.seat === 0 && this.state) this.epoch = randomHex(8);
  }
  opened() {
    this.peer.send({type: 'hello', name: this.names[this.seat]});
  }
  start(type, seed = crypto.getRandomValues(new Uint32Array(1))[0]) {
    if (this.seat !== 0 || !this.peer?.connected) throw new Error('Only the connected host can deal a new game.');
    this.state = createGame(type, seed);
    this.epoch = randomHex(8);
    this.resetChoices();
    this.sync();
  }
  sync() {
    this.view = playerView(this.state, this.seat);
    this.peer.send({type: 'state', epoch: this.epoch, view: playerView(this.state, 1), names: this.names, series: this.series});
    this.onUpdate();
  }
  simultaneous() { return this.view && ['choose', 'guard', 'raid'].includes(this.view.phase); }
  context() { return contextFor(this.epoch, this.view); }
  locked(player = this.seat) { return Boolean(this.commits[player]) || this.busy && player === this.seat; }
  async choose(action) {
    if (!this.peer?.connected) throw new Error('Reconnect your partner before continuing.');
    if (!this.view) throw new Error('Wait for the host to deal.');
    if (this.view.phase === 'reveal') {
      if (this.ready[this.seat]) return;
      this.ready[this.seat] = true;
      this.peer.send({type: 'ready', epoch: this.epoch, revision: this.view.revision});
      this.advanceIfReady();
      this.onUpdate();
      return;
    }
    if (!this.simultaneous()) {
      if (this.movePending) return;
      if (this.seat === 0) {
        this.state = applyAction(this.state, 0, action);
        this.countWin();
        this.sync();
      } else {
        this.movePending = true;
        this.peer.send({type: 'action', epoch: this.epoch, revision: this.view.revision, action});
        this.onUpdate();
      }
      return;
    }
    if (this.locked()) return;
    this.busy = true;
    this.onUpdate();
    const context = this.context();
    const salt = randomHex();
    const hash = await commitment(context, this.seat, action, salt);
    if (!this.peer.connected || context !== this.context()) { this.busy = false; return; }
    this.local = {action, salt};
    this.commits[this.seat] = hash;
    this.busy = false;
    this.peer.send({type: 'commit', context, hash});
    this.revealIfReady();
    this.onUpdate();
  }
  revealIfReady() {
    if (!this.local || this.reveals[this.seat] || this.commits.some(c => !c)) return;
    this.reveals[this.seat] = this.local;
    this.peer.send({type: 'reveal', context: this.context(), ...this.local});
    this.resolveIfReady();
  }
  resolveIfReady() {
    if (this.seat !== 0 || this.reveals.some(r => !r)) return;
    let state = this.state;
    // Apply both validated choices atomically; no intermediate hidden state leaves the host.
    for (let p = 0; p < 2; p++) state = applyAction(state, p, this.reveals[p].action);
    this.state = state;
    this.resetChoices();
    this.countWin();
    this.sync();
  }
  advanceIfReady() {
    if (this.seat === 0 && this.ready.every(Boolean)) {
      this.state = applyAction(this.state, 0, {kind: 'next'});
      this.resetChoices();
      this.sync();
    }
  }
  countWin() {
    if (this.state.phase !== 'over' || this.counted === this.epoch) return;
    this.counted = this.epoch;
    const seat = winner(this.state);
    if (seat !== null) this.series[seat]++;
  }
  async receive(message) {
    try {
      if (message.type === 'hello') {
        if (typeof message.name !== 'string') throw new Error('Invalid player name.');
        this.names[1 - this.seat] = message.name.slice(0, 24) || 'Partner';
        if (this.seat === 0) {
          if (this.state) this.sync();
          else this.start(this.initialGame || 'backhand');
        }
        return;
      }
      if (message.type === 'state' && this.seat === 1) {
        const next = validateView(message.view);
        if (!/^[a-f0-9]{16}$/.test(message.epoch) || !Array.isArray(message.names) ||
          message.names.length !== 2 || message.names.some(n => typeof n !== 'string' || n.length > 24) ||
          !Array.isArray(message.series) || message.series.length !== 2 || message.series.some(n => !Number.isInteger(n) || n < 0)) throw new Error('Invalid table update.');
        const changed = !this.view || message.epoch !== this.epoch || contextFor(message.epoch, next) !== this.context() || next.revision !== this.view.revision;
        if (changed) this.resetChoices();
        this.epoch = message.epoch;
        this.view = next;
        this.names = message.names;
        this.series = message.series;
        this.movePending = false;
        this.onUpdate();
        return;
      }
      if (message.type === 'commit') {
        if (!this.simultaneous() || message.context !== this.context() || !/^[a-f0-9]{64}$/.test(message.hash)) throw new Error('Invalid commitment.');
        const other = 1 - this.seat;
        if (this.commits[other]) {
          if (this.commits[other] === message.hash) return;
          throw new Error('A locked choice was changed.');
        }
        this.commits[other] = message.hash;
        this.revealIfReady();
        this.onUpdate();
        return;
      }
      if (message.type === 'reveal') {
        const other = 1 - this.seat;
        if (!this.simultaneous() || message.context !== this.context() || this.commits.some(c => !c) || this.reveals[other]) throw new Error('Unexpected reveal.');
        const context = this.context();
        if (!await verifyCommitment(this.commits[other], context, other, message.action, message.salt)) throw new Error('A revealed choice did not match its commitment.');
        if (context !== this.context()) return;
        this.reveals[other] = {action: message.action, salt: message.salt};
        this.resolveIfReady();
        return;
      }
      if (message.epoch !== this.epoch) throw new Error('This move belongs to an earlier game.');
      if (message.type === 'ready') {
        if (this.view.phase !== 'reveal' || message.revision !== this.view.revision) throw new Error('Unexpected next-round request.');
        this.ready[1 - this.seat] = true;
        this.advanceIfReady();
        this.onUpdate();
      } else if (message.type === 'action' && this.seat === 0 && this.state.type === 'closing') {
        if (message.revision !== this.state.revision) { this.sync(); return; }
        this.state = applyAction(this.state, 1, message.action);
        this.countWin();
        this.sync();
      } else throw new Error('Unexpected table message.');
    } catch (error) {
      this.onError(error);
    }
  }
}
