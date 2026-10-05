import {createPeerTransport} from './peer.js';
import {RoomLink} from './room-client.js';
import {RoomChat} from './room-chat.js';
import {TurnClient, roomRequest} from './turn-client.js';
import {roomConfig} from './signaling.js';
import {validateGameSetup} from './friend-setup.js';

// Games whose rules run in the room. Both players see the same saved game,
// whether they play at the same time or come back later.
export const ROOM_GAMES = Object.freeze({'flip-it': 'Flip It', cluance: 'Cluance', midnight: 'Midnight Table'});
export const isRoomGame = game => Object.hasOwn(ROOM_GAMES, game);
const ROOM_TRANSPORT = {protocol: 1, prefix: 'fr1', gameName: 'Friend room', channelName: 'friends'};
const STUN = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]};

// The outer page owns the room connection, chat, saved games and the optional
// peer connection used by shared cursors. Game documents come and go beneath it.
export class FriendSession {
  constructor({game, onChange, onSwitch, onError, onEvent, onPicker}) {
    Object.assign(this, {game, onChange, onSwitch, onError, onEvent: onEvent || (() => {}), openPicker: onPicker});
    this.credential = null;
    this.me = {name: ''};
    this.friend = {name: '', joined: false, online: false, visible: false, page: null, game: null};
    this.games = [];
    this.status = 'none';
    this.chat = new RoomChat(this);
    this.asyncGame = null;
    this.adapter = null;
    this.listeners = new Set();
  }
  get role() { return this.credential?.role || null; }
  get isHost() { return this.role === 'host'; }
  get inRoom() { return Boolean(this.credential); }
  get friendName() { return this.friend.name || 'your friend'; }
  // Legacy game pages ask whether a live table is connected; room games never are.
  get connected() { return false; }
  supports() { return false; }

  attach(credential) {
    this.link?.close();
    this.credential = credential;
    this.status = 'connecting';
    this.link = new RoomLink(credential, {
      onMessage: message => this.receive(message),
      onStatus: status => {
        this.status = status;
        if (status === 'rejected') this.onEvent({kind: 'rejected'});
        else if (status === 'offline' && this.link?.attempt >= 3) this.probe(credential);
        this.onChange();
      },
    });
    this.link.update({page: this.game, game: this.asyncGame?.record.id || null});
    this.link.connect();
  }
  // A page that keeps failing to connect checks whether the room still exists.
  async probe(credential) {
    if (this.probing) return;
    this.probing = true;
    try { await roomRequest(credential, 'chat'); }
    catch (error) {
      if (this.credential === credential && [401, 403, 404, 410].includes(error.status)) {
        this.link?.close(); this.status = 'rejected'; this.onEvent({kind: 'rejected'}); this.onChange();
      }
    } finally { this.probing = false; }
  }
  leave() {
    this.stopCursors?.();
    this.asyncGame?.close();
    this.link?.close(); this.link = null;
    this.credential = null; this.status = 'none'; this.games = []; this.asyncGame = null;
    this.me = {name: this.me.name};
    this.friend = {name: '', joined: false, online: false, visible: false, page: null, game: null};
    this.chat = new RoomChat(this);
    this.onChange();
  }
  setPage(game) {
    this.game = game;
    this.link?.update({page: game, game: this.asyncGame?.record.id || null});
  }

  receive(message) {
    if (message.type === 'welcome' || message.type === 'presence') {
      const before = this.friend;
      this.me = {name: message.you?.name || this.me.name};
      this.friend = {...this.friend, ...message.friend};
      if (message.type === 'welcome') {
        this.chat.apply(message.chat);
        this.games = Array.isArray(message.games) ? message.games : [];
        if (this.asyncGame) this.asyncGame.refresh().catch(() => {});
        this.onEvent({kind: 'welcome', previous: before});
      } else {
        if (!before.joined && this.friend.joined) this.onEvent({kind: 'friend-joined'});
        else if (!before.online && this.friend.online) this.onEvent({kind: 'friend-online'});
        else if (before.online && !this.friend.online) this.onEvent({kind: 'friend-offline'});
        if (this.friend.game !== before.game || this.friend.page !== before.page) this.onEvent({kind: 'friend-moved', previous: before});
      }
      this.asyncGame?.publish(this.asyncGame.record);
    } else if (message.type === 'chat') {
      const before = this.chat.sequence;
      this.chat.apply(message.history);
      if (message.by !== this.role) for (const entry of this.chat.entries) if (entry.sequence > before) this.onEvent({kind: 'chat', entry});
    } else if (message.type === 'game' && message.game?.id) {
      const record = message.game;
      const {view, ...summary} = record;
      this.games = [summary, ...this.games.filter(game => game.id !== record.id)];
      this.asyncGame?.apply(record);
      this.onEvent({kind: 'game', record, cause: message.cause || {}, mine: message.cause?.by === this.role});
    } else if (message.type === 'relay' && message.data) {
      this.onEvent({kind: 'relay', data: message.data});
    }
    this.onChange();
  }
  relay(data) { return Boolean(this.link?.relay(data)); }

  async saveName(name) {
    if (!this.credential) { this.me = {name}; return name; }
    const data = await roomRequest(this.credential, 'profile', {method: 'POST', body: {name}});
    this.me = {name: data.name};
    this.onChange();
    return data.name;
  }
  async createGame(game, setup) {
    if (!this.credential) throw Error('Invite a friend first.');
    const record = await roomRequest(this.credential, 'turns', {method: 'POST', body: {game, setup: validateGameSetup(game, setup)}});
    const {view, ...summary} = record;
    this.games = [summary, ...this.games.filter(item => item.id !== record.id)];
    return record;
  }
  fetchGame(id) { return roomRequest(this.credential, 'turns/' + id); }
  useGame(record) {
    this.asyncGame?.close();
    this.asyncGame = record ? new TurnClient(this, record) : null;
    this.link?.update({game: record?.id || null});
  }

  registerGame(game, adapter) {
    if (game !== this.game) return;
    this.adapter = adapter;
    if (this.asyncGame?.record.game === game) { adapter.startAsync?.(this.asyncGame); this.asyncGame.schedule(); }
    this.onChange();
  }

  // Shared cursors use one direct browser connection, opened only while sharing.
  async connectPeer() {
    this.closePeer();
    const credential = this.credential;
    const config = await roomConfig(credential, STUN).catch(() => STUN);
    if (this.credential !== credential) throw Error('You left the room.');
    const {PeerLink} = createPeerTransport(ROOM_TRANSPORT);
    const peer = new PeerLink({config, onMessage: message => { if (this.peer === peer) this.screen?.handle(message); },
      onStatus: status => { if (this.peer === peer) this.onPeerStatus?.(status); }});
    this.peer = peer;
    await peer.connectRoom(credential, credential.role);
    return peer;
  }
  closePeer() { const peer = this.peer; this.peer = null; peer?.close(); }
  get peerConnected() { return Boolean(this.peer?.connected); }
  send(message) { if (this.peerConnected) this.peer.send(message); }
}
