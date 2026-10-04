import {createPeerTransport} from './peer.js';
import {FriendChat} from './friend-chat.js';
import {defaultGameSetup, validateGameSetup} from './friend-setup.js';
import {isFriendPage} from './friend-pages.js';

export const FRIEND_GAMES = Object.freeze({
  collection: {title: 'Games', protocol: 1, wireKey: 'v'},
  'flip-it': {title: 'Flip It', protocol: 6, wireKey: 'v'},
  cluance: {title: 'Cluance', protocol: 1, wireKey: 'version'},
  midnight: {title: 'Midnight Table', protocol: 1, wireKey: 'v'},
});
const ROOM_TRANSPORT = {protocol: 1, prefix: 'fr1', gameName: 'Friend room', channelName: 'friends'};
const supported = game => Object.hasOwn(FRIEND_GAMES, game);
const randomID = () => [...crypto.getRandomValues(new Uint8Array(16))]
  .map(byte => byte.toString(16).padStart(2, '0')).join('');

// One physical PeerLink survives every game document. Its initial wire protocol
// remains fixed; envelopes carry the active game's protocol and generation.
export class FriendSession {
  constructor({game, onChange, onSwitch, onError, onPicker}) {
    this.game = game;
    this.epoch = 'initial';
    this.onChange = onChange;
    this.onSwitch = onSwitch;
    this.onError = onError;
    this.openPicker = onPicker;
    this.paused = false;
    this.loading = false;
    this.chat = new FriendChat(this);
  }

  get connected() { return Boolean(this.peer?.connected); }
  get connecting() {
    return Boolean(this.peer && !this.peer.closed && !this.connected &&
      !['closed', 'failed', 'disconnected'].includes(this.peer.pc.connectionState));
  }
  supports(game) { return supported(game); }

  createPeer(game, transport, options) {
    if (game !== this.game || !supported(game)) throw new Error('This game is no longer active.');
    const expected = FRIEND_GAMES[game];
    if (transport.protocol !== expected.protocol || transport.wireKey !== expected.wireKey) {
      throw new Error('Update both game pages before playing together.');
    }
    this.link?.close(true);
    if (!this.connected) {
      this.replacePeer(transport, options);
    }
    const link = new GamePeer(this, game, options);
    this.link = link;
    if (this.connected) queueMicrotask(() => link.notify('open'));
    this.onChange();
    return link;
  }

  replacePeer(transport, options = {}) {
    this.screen?.stop(false);
    const old = this.peer;
    this.peer = null;
    old?.close();
    this.epoch = 'initial';
    this.paused = false;
    this.friendInvitation = null;
    if(!this.chat.persistent)this.chat = new FriendChat(this);
    const {PeerLink} = createPeerTransport(transport);
    const peer = new PeerLink({
      ...options,
      onMessage: message => { if (this.peer === peer) this.receive(message); },
      onStatus: status => {
        if (this.peer !== peer) return;
        if (['closed', 'failed', 'disconnected'].includes(status)) {
          this.clearProposal();
          clearTimeout(this.loadTimer);
          this.loading = false;
          if (this.screen?.active) { this.sharedResume=true;this.screen.suspend(); }
        }
        this.link?.notify(status);
        if (status === 'open' && !this.roomReadySent) {
          this.roomReadySent = true;
          if (!this.isHost) this.send({type:'friend-room-ready'});
        }
        this.onChange();
        if (['closed','failed','disconnected'].includes(status)) this.onReconnect?.();
      },
    });
    this.peer = peer;
  }

  async connectFriendRoom(invitation, role, config, initial = {game:'collection', metadata:{}}) {
    const previousChat=initial.restoring?this.chat:null;
    this.disconnect();
    this.link?.close(true);
    this.link = null;
    this.isHost = role === 'host';
    this.replacePeer(ROOM_TRANSPORT, {config});
    this.roomReadySent = false;
    if (previousChat) this.chat=previousChat;
    if (!isFriendPage(initial.game)) throw new Error('The saved game is unavailable. Choose a new game.');
    this.sharedResume=Boolean(initial.shared);
    this.invitationSetup = this.isHost ? {game:initial.game, metadata:initial.shared||initial.independent?{}:validateGameSetup(initial.game,initial.metadata), resume:Boolean(initial.resume),shared:Boolean(initial.shared),independent:Boolean(initial.independent)} : null;
    this.friendInvitation = role === 'host' ? invitation : null;
    this.onChange();
    await this.peer.connectRoom(invitation, role);
  }

  registerGame(game, adapter) {
    if (game !== this.game) throw new Error('This game is no longer active.');
    this.adapter = adapter;
    if(this.asyncGame&&this.asyncGame.record.game===game){adapter.startAsync?.(this.asyncGame);this.onChange();return;}
    if (this.loading) {
      this.localReady = true;
      this.send({type: 'friend-ready', epoch: this.epoch});
      this.maybeStart();
    }
    this.onChange();
  }

  send(message) { if(this.connected)this.peer.send(message); }

  receive(message) {
    if (this.chat.receive(message)) return;
    if(message.type==='friend-turns-updated'){this.refreshInbox?.();return;}
    if (message.type.startsWith('friend-screen-')) { this.screen?.handle(message); return; }
    if (message.type === 'friend-room-ready') {
      if (!this.isHost || !this.invitationSetup) return;
      const {game,metadata,resume,shared,independent} = this.invitationSetup, epoch = randomID();
      this.invitationSetup = null;
      this.send({type:'friend-room-start',game,metadata,resume,shared,independent,epoch,history:this.chat.snapshot()});
      if(independent){this.independent=true;return;}
      if (shared) {this.game=game;this.resumeSharedPage=true;this.screen.restoreConnection(epoch);}
      else this.loadGame(game,epoch,metadata,resume);
      return;
    }
    if (message.type === 'friend-room-start') {
      if (this.isHost || this.loading || !isFriendPage(message.game) || !/^[a-f0-9]{32}$/.test(message.epoch)) return;
      if(!this.chat.persistent)this.chat.restore(message.history);
      if(message.independent){this.independent=true;return;}
      if (message.shared && this.sharedResume) {
        this.game=message.game;this.resumeSharedPage=true;this.screen.restoreConnection(message.epoch);
        this.onSwitch(message.game);
      } else if (supported(message.game) && !message.shared) this.loadGame(message.game,message.epoch,validateGameSetup(message.game,message.metadata),Boolean(message.resume));
      else this.onError('Your friend’s shared game is ready. Use Cursors to agree to share it.');
      return;
    }
    if (message.type === 'friend-game') {
      if (message.game !== this.game || message.epoch !== this.epoch || this.paused) return;
      const payload = message.message, game = FRIEND_GAMES[this.game];
      if (!payload || payload[game.wireKey] !== game.protocol || typeof payload.type !== 'string') {
        this.onError('An incompatible game message arrived. Update both pages and invite again.');
        return;
      }
      this.link?.receive(payload);
      return;
    }
    if (message.type === 'friend-request') {
      if (!supported(message.game) || !/^[a-f0-9]{32}$/.test(message.id)) return;
      if (this.proposal || this.loading || this.screen?.busy) {
        this.send({type: 'friend-decline', id: message.id});
        return;
      }
      this.proposal = {id: message.id, game: message.game, metadata:validateGameSetup(message.game,message.metadata), resume:Boolean(message.resume), outgoing: false};
      this.proposalTimer = setTimeout(() => this.decline(), 30000);
    } else if (message.type === 'friend-accept') {
      if (this.isHost && this.proposal?.outgoing && message.id === this.proposal.id) this.commit();
    } else if (message.type === 'friend-decline' || message.type === 'friend-cancel') {
      if (message.id !== this.proposal?.id) return;
      if (message.type === 'friend-cancel') this.send({type: 'friend-decline', id: message.id});
      this.clearProposal();
    } else if (message.type === 'friend-switch') {
      if (this.isHost || !this.proposal || message.id !== this.proposal.id || message.game !== this.proposal.game ||
          !this.proposal.outgoing && !this.proposal.accepted ||
          !/^[a-f0-9]{32}$/.test(message.epoch)) return;
      this.loadGame(message.game, message.epoch, validateGameSetup(message.game,message.metadata),Boolean(message.resume));
    } else if (message.type === 'friend-ready') {
      if (!this.loading || message.epoch !== this.epoch) return;
      this.remoteReady = true;
      this.maybeStart();
    } else if (message.type === 'friend-start') {
      if (this.isHost || !this.loading || !this.localReady || message.epoch !== this.epoch) return;
      this.startGame(message.metadata);
    } else if (message.type === 'friend-pause') {
      if (message.epoch !== this.epoch) return;
      this.pause(false);
    } else {
      this.onError('Update both game pages and create a fresh invitation to play together.');
    }
    this.onChange();
  }

  requestGame(game, settings, resume = false) {
    if (this.screen?.active) { this.screen.navigate(game); return; }
    if (this.screen?.busy) return;
    if (!supported(game)) return;
    if (!this.connected) {
      this.disconnect();
      this.game = game;
      this.adapter = null;
      this.onSwitch(game);
    } else if (!this.proposal && !this.loading) {
      const metadata = validateGameSetup(game,settings ?? defaultGameSetup(game));
      // The setup role describes the original inviter on the wire.
      if (game === 'cluance' && !this.isHost) metadata.role = metadata.role === 'giver' ? 'guesser' : 'giver';
      this.proposal = {id: randomID(), game, metadata, resume, outgoing: true};
      this.send({type: 'friend-request', id: this.proposal.id, game, metadata, resume});
      this.proposalTimer = setTimeout(() => this.cancel(), 30000);
    }
    this.onChange();
  }

  accept() {
    if (!this.proposal || this.proposal.outgoing || this.proposal.accepted) return;
    clearTimeout(this.proposalTimer);
    this.proposal.accepted = true;
    if (this.isHost) this.commit();
    else this.send({type: 'friend-accept', id: this.proposal.id});
    this.onChange();
  }

  decline() {
    if (!this.proposal) return;
    if (this.connected) this.send({type: 'friend-decline', id: this.proposal.id});
    this.clearProposal();
    this.onChange();
  }

  cancel() {
    if (!this.proposal || this.proposal.cancelled) return;
    if (this.connected) this.send({type: 'friend-cancel', id: this.proposal.id});
    // The original inviter coordinates switches. Wait for its cancellation
    // reply so an acceptance already in flight cannot split the two games.
    if (!this.isHost && this.proposal.outgoing && this.connected) this.proposal.cancelled = true;
    else this.clearProposal();
    this.onChange();
  }

  commit() {
    const {id, game, metadata, resume} = this.proposal, epoch = randomID();
    this.send({type: 'friend-switch', id, game, epoch, metadata, resume});
    this.loadGame(game, epoch, metadata, resume);
  }

  loadGame(game, epoch, metadata, resume = false) {
    this.clearProposal();
    this.loading = true;
    this.paused = true;
    this.link?.close(true);
    this.link = null;
    this.adapter = null;
    this.localReady = this.remoteReady = false;
    this.game = game;
    this.epoch = epoch;
    this.asyncGame=null;this.independent=false;
    this.gameSetup = metadata;
    this.resumeGame = resume;
    this.sharedResume = this.resumeSharedPage = false;
    clearTimeout(this.loadTimer);
    this.loadTimer = setTimeout(() => {
      this.pause();
      this.onError('The game did not finish loading. Choose it again to retry.');
    }, 15000);
    this.onSwitch(game);
    this.onChange();
  }

  maybeStart() {
    if (!this.isHost || !this.loading || !this.localReady || !this.remoteReady) return;
    const metadata = this.gameSetup ?? this.adapter.setup();
    this.send({type: 'friend-start', epoch: this.epoch, metadata, resume:this.resumeGame});
    this.startGame(metadata);
  }

  startGame(metadata) {
    clearTimeout(this.loadTimer);
    this.loading = false;
    this.paused = false;
    try {
      this.adapter.start({host: this.isHost, metadata, resume:this.resumeGame});
    } catch (error) {
      this.pause();
      this.onError(error.message);
    }
    this.onChange();
  }

  pause(notify = true) {
    clearTimeout(this.loadTimer);
    this.loading = false;
    this.paused = true;
    if (notify && this.connected) this.send({type: 'friend-pause', epoch: this.epoch});
    this.link?.notify('closed');
    this.onChange();
  }

  clearProposal() {
    clearTimeout(this.proposalTimer);
    this.proposal = null;
  }

  disconnect() {
    this.screen?.stop();
    this.clearProposal();
    clearTimeout(this.loadTimer);
    this.loading = false;
    this.paused = false;
    this.peer?.close();
    this.onChange();
  }
}

// Game callbacks belong to an iframe lifetime; close detaches them after play
// begins instead of closing the session's data channel or RTCPeerConnection.
class GamePeer {
  constructor(session, game, {onMessage, onStatus}) {
    this.session = session;
    this.game = game;
    this.epoch = session.epoch;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
  }
  get pc() { return this.session.peer.pc; }
  get room() { return this.session.peer.room; }
  get hosted() { return this.session.peer.hosted; }
  get signalingError() { return this.session.peer.signalingError; }
  get connected() { return !this.closed && !this.session.paused && this.session.connected; }

  connectRoom(invitation, role) {
    if (this.session.connected) throw new Error('You are already connected. Use Next game, or disconnect to invite someone else.');
    this.session.isHost = role === 'host';
    this.session.onChange();
    return this.session.peer.connectRoom(invitation, role);
  }
  invite() {
    this.session.isHost = true;
    this.session.onChange();
    return this.session.peer.invite();
  }
  join(input) {
    this.session.isHost = false;
    this.session.onChange();
    return this.session.peer.join(input);
  }
  accept(input) { return this.session.peer.accept(input); }
  send(message) {
    if (!this.connected || this.epoch !== this.session.epoch) throw new Error('Wait for your friend before playing.');
    const {protocol, wireKey} = FRIEND_GAMES[this.game];
    this.session.send({type: 'friend-game', game: this.game, epoch: this.epoch,
      message: {...message, [wireKey]: protocol}});
  }
  receive(message) {
    if (!this.closed) Promise.resolve(this.onMessage(message)).catch(error => this.session.onError(error.message));
  }
  notify(status) { if (!this.closed) this.onStatus(status); }
  close(detach = false) {
    if (this.closed) return;
    this.closed = true;
    if (this.session.link !== this) return;
    this.session.link = null;
    if (!this.session.connected) this.session.peer.close();
    else if (!detach && !this.session.loading) this.session.pause();
  }
}
