import {isFriendPage} from './friend-pages.js';
import {ScreenInput} from './screen-input.js';

const id = () => crypto.randomUUID();
const validID = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const point = value => Number.isFinite(value) && value >= 0 && value <= 1;
const validGeometry = g => g && [g.width, g.height, g.frame?.width, g.frame?.height].every(n => Number.isFinite(n) && n > 0 && n <= 10000)
  && [g.frame.left, g.frame.top].every(n => Number.isFinite(n) && n >= 0)
  && g.frame.left + g.frame.width <= g.width + 1 && g.frame.top + g.frame.height <= g.height + 1;

// A dedicated media connection shares one authoritative tab. Its SDP/ICE uses
// the room's already-authenticated data channel, never another invitation.
export class SharedScreen {
  constructor(session, {frame, onChange, onStream, onGeometry, onCursor}) {
    this.session = session;
    this.frame = frame;
    this.onChange = onChange;
    this.onStream = onStream;
    this.onGeometry = onGeometry;
    this.onCursor = onCursor;
    this.input = new ScreenInput(frame);
    this.phase = 'off';
    this.queue = Promise.resolve();
  }
  get active() { return ['connecting', 'sharing', 'viewing'].includes(this.phase); }
  get busy() { return this.phase !== 'off'; }
  send(type, data = {}) { this.session.send({type: 'friend-screen-' + type, id: this.id, ...data}); }
  changed() { this.onChange(); }
  async request() {
    if (!this.session.connected || this.busy || this.session.loading || this.session.proposal) return;
    this.id = id();
    if (!this.session.isHost) {
      this.phase = 'waiting'; this.send('ask'); this.deadline(); this.changed();
    } else { this.phase = 'confirm'; this.changed(); }
  }
  async capture() {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Your browser cannot share a tab. Ask your friend to create the room in a desktop browser with tab sharing.');
    const captureID = this.id;
    this.phase = 'capturing'; this.changed();
    navigator.mediaDevices.setCaptureHandleConfig?.({handle: captureID, exposeOrigin: true, permittedOrigins: [location.origin]});
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {displaySurface: 'browser', frameRate: 30}, audio: false,
        preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', monitorTypeSurfaces: 'exclude',
      });
      const track = stream.getVideoTracks()[0], handle = track.getCaptureHandle?.();
      if (!track || track.getSettings().displaySurface && track.getSettings().displaySurface !== 'browser' ||
          track.getCaptureHandle && (!handle || handle.handle !== captureID || handle.origin !== location.origin)) {
        throw new Error('Choose this Games tab to share. Other tabs, windows and entire screens cannot receive game controls.');
      }
      if (captureID !== this.id || !this.session.connected || this.phase !== 'capturing') { stream.getTracks().forEach(t => t.stop()); return; }
      this.stream = stream;
      track.addEventListener('ended', () => { if (this.stream === stream) this.stop(); });
      this.phase = 'offering'; this.send('request'); this.deadline(); this.changed();
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (captureID === this.id) this.stop();
      throw new Error(error.name === 'NotAllowedError' ? 'Tab sharing was cancelled. Your friend connection stays open.' : error.message);
    }
  }
  async accept() {
    if (['asked', 'confirm'].includes(this.phase) && this.session.isHost) { clearTimeout(this.timer); await this.capture(); }
    else if (this.phase === 'requested' && !this.session.isHost) {
      this.activate(); this.makePeer(); this.send('accept'); this.changed();
    }
  }
  deadline() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.stop(), 30000);
  }
  activate() {
    clearTimeout(this.timer);
    this.phase = 'connecting';
    this.session.clearProposal();
    const multiplayer = Boolean(this.session.link);
    this.session.pause(false);
    this.session.link?.close(true);
    this.session.link = null;
    if (this.session.isHost && multiplayer) this.session.onSwitch(this.session.game);
    else if (!this.session.isHost) this.frame.src = 'about:blank';
    this.deadline();
  }
  makePeer() {
    const pc = this.pc = new RTCPeerConnection(this.session.peer.pc.getConfiguration());
    this.candidates = [];
    const current = this.id;
    pc.addEventListener('icecandidate', event => {
      if (this.pc === pc && this.session.connected) this.send('candidate', {candidate: event.candidate?.toJSON() || null});
    });
    pc.addEventListener('track', event => {
      if (this.pc !== pc || this.session.isHost || !event.streams[0]) return;
      this.onStream(event.streams[0]);
    });
    pc.addEventListener('connectionstatechange', () => {
      if (this.pc !== pc || current !== this.id) return;
      if (pc.connectionState === 'connected') {
        clearTimeout(this.timer);
        this.phase = this.session.isHost ? 'sharing' : 'viewing';
        if (this.session.isHost) this.geometry();
        this.changed();
      } else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        this.stop();
        this.session.onError('Shared-screen connection ended. Your friend room stays open; try virtual cursors again.');
      }
    });
    return pc;
  }
  async receive(message) {
    const type = message.type.slice('friend-screen-'.length);
    if (type === 'ask' || type === 'request') {
      if (!validID(message.id) || (type === 'ask') !== this.session.isHost) return;
      const expectedOffer = type === 'request' && this.phase === 'waiting' && message.id === this.id;
      if (this.busy && !expectedOffer || this.session.loading || this.session.proposal) {
        this.session.send({type: 'friend-screen-end', id: message.id}); return;
      }
      this.id = message.id;
      this.phase = type === 'ask' ? 'asked' : 'requested';
      this.deadline(); this.changed(); return;
    }
    if (!this.busy || message.id !== this.id) return;
    if (type === 'end') { this.stop(false); return; }
    if (type === 'accept' && this.session.isHost && this.phase === 'offering') {
      this.activate();
      const pc = this.makePeer();
      for (const track of this.stream.getTracks()) pc.addTrack(track, this.stream);
      await pc.setLocalDescription(await pc.createOffer());
      if (this.pc !== pc) return;
      this.send('offer', {sdp: pc.localDescription.sdp});
      this.geometry(); this.changed();
    } else if (type === 'offer' || type === 'answer') {
      const pc = this.pc;
      if (!pc || (type === 'offer') === this.session.isHost || typeof message.sdp !== 'string' || !message.sdp.startsWith('v=0') || message.sdp.length > 60000 ||
          pc.remoteDescription) return;
      await pc.setRemoteDescription({type, sdp: message.sdp});
      if (this.pc !== pc) return;
      for (const candidate of this.candidates) await pc.addIceCandidate(candidate);
      this.candidates = [];
      if (type === 'offer') {
        await pc.setLocalDescription(await pc.createAnswer());
        if (this.pc === pc) this.send('answer', {sdp: pc.localDescription.sdp});
      }
    } else if (type === 'candidate') {
      const c = message.candidate, pc = this.pc;
      if (!pc || c !== null && (!c || typeof c.candidate !== 'string' || c.candidate.length > 4096 ||
          c.sdpMid != null && (typeof c.sdpMid !== 'string' || c.sdpMid.length > 128) ||
          c.sdpMLineIndex != null && (!Number.isInteger(c.sdpMLineIndex) || c.sdpMLineIndex < 0 || c.sdpMLineIndex > 255))) return;
      if (pc.remoteDescription) await pc.addIceCandidate(c);
      else if (this.candidates.length < 64) this.candidates.push(c);
    } else if (type === 'geometry' && !this.session.isHost && this.active && validGeometry(message.geometry) && isFriendPage(message.page)) {
      this.remoteGeometry = message.geometry;
      this.session.game = message.page;
      this.onGeometry(message.geometry); this.changed();
    } else if (type === 'cursor' && this.active && point(message.x) && point(message.y)) {
      this.onCursor(message.x, message.y);
    } else if (type === 'input' && this.session.isHost && this.active) {
      this.input.receive(message.input);
    } else if (type === 'navigate' && this.session.isHost && this.active) this.navigate(message.page);
  }
  handle(message) {
    this.queue = this.queue.then(() => this.receive(message)).catch(error => {
      this.stop(); this.session.onError(error.message);
    });
  }
  navigate(page) {
    if (!this.active || !isFriendPage(page)) return;
    if (!this.session.isHost) { this.send('navigate', {page}); return; }
    this.input.reset();
    this.session.game = page;
    this.session.adapter = null;
    this.session.onSwitch(page);
    this.geometry(); this.changed();
  }
  geometry() {
    if (!this.active || !this.session.isHost) return;
    const rect = this.frame.getBoundingClientRect();
    const geometry = {width: innerWidth, height: innerHeight, frame: {left: rect.left, top: rect.top, width: rect.width, height: rect.height}};
    this.send('geometry', {geometry, page: this.session.game});
  }
  stop(notify = true) {
    const wasActive = this.active;
    if (this.busy && notify && this.session.connected) {
      try { this.send('end'); } catch { /* A congested or closed channel also stops media locally. */ }
    }
    this.phase = 'off';
    this.id = null;
    clearTimeout(this.timer);
    const pc = this.pc, stream = this.stream;
    this.pc = this.stream = null;
    this.remoteGeometry = null;
    this.input.reset();
    pc?.close();
    stream?.getTracks().forEach(track => track.stop());
    this.onStream(null); this.onCursor(null, null);
    if (wasActive) {
      this.session.game = 'collection';
      this.session.paused = false;
      this.session.adapter = null;
      this.session.onSwitch('collection');
    }
    this.changed();
  }
}
