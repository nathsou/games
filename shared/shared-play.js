import {isFriendPage} from './friend-pages.js';
import {ScreenInput} from './screen-input.js';
import {captureView, encodeState, decodeState, stateUpdate, applyStateUpdate} from './view-state.js';

const id = () => crypto.randomUUID();
const validID = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const point = value => Number.isFinite(value) && value >= 0 && value <= 1;
const MAX_STATE = 2 * 1024 * 1024, CHUNK = 8000;
const sizeOK = size => Array.isArray(size) && size.length === 2 && size.every(n => Number.isFinite(n) && n > 0 && n <= 10000);

// One authority executes game actions. The other browser renders its view
// locally. State, controls and cursors all use the room's existing data channel.
export class SharedPlay {
  constructor(session, {frame, onChange, onGeometry, onCursor}) {
    Object.assign(this, {session, frame, onChange, onGeometry, onCursor});
    this.input = new ScreenInput(frame);
    this.phase = 'off';
  }
  get active() { return ['connecting', 'sharing', 'viewing'].includes(this.phase); }
  get busy() { return this.phase !== 'off'; }
  send(type, data = {}) { this.session.send({type: 'friend-screen-' + type, id: this.id, ...data}); }
  changed() { this.onChange(); }
  async request(page = this.session.game, resume = false) {
    if (!this.session.connected || this.busy || this.session.loading || this.session.proposal) return;
    this.id = id();
    this.targetPage=isFriendPage(page)?page:this.session.game;
    this.resumePage=resume;
    this.phase = this.session.isHost ? 'confirm' : 'waiting';
    if (!this.session.isHost) this.send('ask', {version: 2,page:this.targetPage,resume});
    this.deadline(); this.changed();
  }
  async accept() {
    if (['asked', 'confirm'].includes(this.phase) && this.session.isHost) {
      this.phase = 'offering'; this.send('request', {version: 2,page:this.targetPage,resume:this.resumePage}); this.deadline(); this.changed();
    } else if (this.phase === 'requested' && !this.session.isHost) {
      this.activate(); this.send('accept', {version: 2}); this.changed();
    }
  }
  deadline() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.stop(); this.session.onError('Shared play timed out. Your friend room stays connected.');
    }, 30000);
  }
  activate() {
    this.phase = 'connecting';
    this.session.clearProposal();
    const multiplayer = Boolean(this.session.link);
    this.session.pause(false);
    this.session.link?.close(true);
    this.session.link = null;
    this.deadline();
    if (this.session.isHost) {
      this.pageEpoch = id();
      this.pageReady = !multiplayer && this.frame.contentDocument?.readyState === 'complete';
      this.session.resumeSharedPage=Boolean(this.resumePage);
      if (this.targetPage && this.targetPage !== this.session.game) {this.session.game=this.targetPage;this.pageReady=false;this.session.onSwitch(this.targetPage);}
      else if (multiplayer) this.session.onSwitch(this.session.game);
      this.geometry();
      this.ticker = setInterval(() => this.publish(), 50);
    }
  }
  receive(message) {
    const type = message.type.slice('friend-screen-'.length);
    if (type === 'ask' || type === 'request') {
      if (!validID(message.id) || (type === 'ask') !== this.session.isHost) return;
      const expected = type === 'request' && this.phase === 'waiting' && message.id === this.id;
      if (message.version !== 2 || this.busy && !expected || this.session.loading || this.session.proposal) {
        this.session.send({type: 'friend-screen-end', id: message.id});
        if (message.version !== 2) this.session.onError('Both friends need to reload the updated page to use virtual cursors.');
        return;
      }
      this.id = message.id; this.phase = type === 'ask' ? 'asked' : 'requested';
      this.targetPage=isFriendPage(message.page)?message.page:this.session.game;this.resumePage=Boolean(message.resume);
      this.deadline(); this.changed(); return;
    }
    if (!this.busy || message.id !== this.id) return;
    if (type === 'end') { this.stop(false); return; }
    if (type === 'accept' && this.session.isHost && this.phase === 'offering' && message.version === 2) {
      this.activate(); this.changed();
    } else if (type === 'page' && !this.session.isHost && this.active && validID(message.epoch) && isFriendPage(message.page) && sizeOK(message.size)) {
      const newPage = message.epoch !== this.remoteEpoch;
      this.remoteEpoch = message.epoch;
      this.remoteGeometry = {width: message.size[0], height: message.size[1]};
      this.onGeometry(this.remoteGeometry);
      if (newPage) {
        this.remoteReady = false; this.incoming = null; this.received = 0; this.renderState = null;
        this.session.game = message.page;
        this.session.onSwitch(message.page);
        this.deadline(); this.changed();
      }
    } else if (type === 'ready' && this.session.isHost && this.active && message.epoch === this.pageEpoch) {
      this.guestReady = true; this.lastState = null; this.publish();
    } else if (type === 'state' && !this.session.isHost && this.active && message.epoch === this.remoteEpoch) {
      this.receiveState(message);
    } else if (type === 'cursor' && this.active && message.epoch === (this.session.isHost ? this.pageEpoch : this.remoteEpoch) && point(message.x) && point(message.y)) {
      this.onCursor(message.x, message.y);
    } else if (type === 'input' && this.session.isHost && this.active && this.pageReady && this.guestReady && message.epoch === this.pageEpoch) {
      this.input.receive(message.input);
    } else if (type === 'navigate' && this.session.isHost && this.active && message.epoch === this.pageEpoch) this.navigate(message.page);
  }
  handle(message) {
    try { this.receive(message); }
    catch (error) { this.stop(); this.session.onError(error.message); }
  }
  loaded() {
    if (!this.active) return;
    if (this.session.isHost) { this.pageReady = true; this.geometry(); }
    else {
      const epoch = this.remoteEpoch, doc = this.frame.contentDocument;
      clearInterval(this.readyPoll);
      this.readyPoll = setInterval(() => {
        if (!this.active || epoch !== this.remoteEpoch || doc !== this.frame.contentDocument) { clearInterval(this.readyPoll); return; }
        if (!this.frame.contentWindow.__sharedView) return;
        clearInterval(this.readyPoll); this.send('ready', {epoch});
      }, 50);
    }
  }
  navigate(page) {
    if (!this.active || !isFriendPage(page)) return;
    if (!this.session.isHost) { this.send('navigate', {page, epoch: this.remoteEpoch}); return; }
    this.input.reset();
    this.pageEpoch = id(); this.pageReady = this.guestReady = false;
    this.outgoing = null; this.lastState = null;
    this.session.game = page; this.session.adapter = null;
    this.session.onSwitch(page);
    this.deadline(); this.geometry(); this.changed();
  }
  geometry() {
    if (!this.active || !this.session.isHost) return;
    this.send('page', {page: this.session.game, epoch: this.pageEpoch,
      size: [this.frame.clientWidth, this.frame.clientHeight]});
  }
  publish() {
    if (!this.active || !this.session.isHost || !this.pageReady || !this.guestReady) return;
    try {
      const channel = this.session.peer?.channel;
      if (channel?.bufferedAmount > 64000) return;
      if (!this.outgoing) {
        const win = this.frame.contentWindow;
        const state = encodeState({view: captureView(this.frame.contentDocument), canvas: win.__sharedCanvas?.snapshot() || null});
        if (state.length > MAX_STATE - 1024) throw new Error('This game view is too large to synchronize. Return to your room and try a smaller puzzle or level.');
        const current = JSON.parse(state), update = stateUpdate(this.lastState, current);
        if (!update) return;
        this.lastState = current;
        const data = JSON.stringify(update);
        this.outgoing = {state: data, seq: (this.sequence = (this.sequence || 0) + 1), part: 0, total: Math.ceil(data.length / CHUNK)};
      }
      // Keep chat and controls responsive, even with a large voxel board.
      const next = this.outgoing;
      for (let sent = 0; sent < 6 && next.part < next.total; sent++) {
        this.send('state', {epoch: this.pageEpoch, seq: next.seq, part: next.part, total: next.total,
          data: next.state.slice(next.part * CHUNK, (next.part + 1) * CHUNK)});
        next.part++;
      }
      if (next.part === next.total) {
        this.outgoing = null;
        if (this.phase === 'connecting') { this.phase = 'sharing'; clearTimeout(this.timer); this.changed(); }
      }
    } catch (error) {
      this.stop(); this.session.onError(error.message);
    }
  }
  receiveState(message) {
    const {seq, part, total, data} = message;
    if (!Number.isSafeInteger(seq) || seq <= (this.received || 0) || !Number.isInteger(total) || total < 1 || total > Math.ceil(MAX_STATE / CHUNK) ||
        !Number.isInteger(part) || part < 0 || part >= total || typeof data !== 'string' || data.length > CHUNK) return;
    if (part === 0) this.incoming = {seq, total, chunks: [], length: 0};
    const next = this.incoming;
    if (!next || next.seq !== seq || next.total !== total || next.chunks.length !== part || next.length + data.length > MAX_STATE) return;
    next.chunks.push(data); next.length += data.length;
    if (part !== total - 1) return;
    this.incoming = null;
    const renderer = this.frame.contentWindow.__sharedView;
    if (!renderer) return;
    this.renderState = applyStateUpdate(this.renderState, JSON.parse(next.chunks.join('')));
    renderer.apply(decodeState(JSON.stringify(this.renderState)));
    this.received = seq; this.remoteReady = true;
    if (this.phase === 'connecting') { this.phase = 'viewing'; clearTimeout(this.timer); }
    this.changed();
  }
  stop(notify = true) {
    const wasActive = this.active;
    if (this.busy && notify && this.session.connected) { try { this.send('end'); } catch { /* Closed channel. */ } }
    this.phase = 'off'; this.id = null;
    clearTimeout(this.timer); clearInterval(this.ticker); clearInterval(this.readyPoll);
    this.incoming = this.outgoing = this.lastState = this.renderState = null;
    this.remoteGeometry = null; this.remoteEpoch = this.pageEpoch = null;
    this.remoteReady = this.pageReady = this.guestReady = false;
    this.input.reset(); this.onCursor(null, null);
    if (wasActive) {
      this.session.game = 'collection'; this.session.paused = false; this.session.adapter = null;
      this.session.onSwitch('collection');
    }
    this.changed();
  }
  suspend() {
    // Keep the authoritative engine and its local checkpoint in place.
    this.phase='off';clearTimeout(this.timer);clearInterval(this.ticker);clearInterval(this.readyPoll);
    this.incoming=this.outgoing=this.lastState=this.renderState=null;
    this.remoteReady=this.pageReady=this.guestReady=false;
    this.input.reset();this.onCursor(null,null);this.changed();
  }
  restoreConnection(roomEpoch) {
    this.id=roomEpoch;this.targetPage=this.session.game;this.resumePage=true;
    this.session.loading=false;this.activate();this.changed();
  }
}
