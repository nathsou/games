const LIMIT = 65536;
export const PROTOCOL = 1;

export async function encodePairing(description, room) {
  const data = JSON.stringify({v: PROTOCOL, type: description.type, sdp: description.sdp, room});
  let bytes = new TextEncoder().encode(data);
  const compressed = typeof CompressionStream !== 'undefined';
  if (compressed) bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return 'MT1' + (compressed ? 'z.' : 'j.') + btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
export async function decodePairing(input, expected) {
  let token = String(input).trim();
  try {
    if (token.includes('#')) {
      const fragment = new URL(token).hash.slice(1);
      token = new URLSearchParams(fragment).get(expected === 'offer' ? 'invite' : 'reply') || '';
    }
    if (token.length > LIMIT || !/^MT1[zj]\.[A-Za-z0-9_-]+$/.test(token)) throw new Error();
    let bytes = Uint8Array.from(atob(token.slice(5).replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
    if (token[3] === 'z') {
      if (typeof DecompressionStream === 'undefined') throw new Error('Update your browser to open compressed invitation links.');
      const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
      const chunks = []; let length = 0;
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        length += value.length;
        if (length > LIMIT) { await reader.cancel(); throw new Error(); }
        chunks.push(value);
      }
      bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    }
    const result = JSON.parse(new TextDecoder().decode(bytes));
    if (result.v !== PROTOCOL || result.type !== expected || typeof result.sdp !== 'string' ||
      result.sdp.length > LIMIT || !result.sdp.startsWith('v=0') || !/^[a-f0-9]{16}$/.test(result.room)) throw new Error();
    return result;
  } catch (error) {
    if (error.message.includes('Update your browser')) throw error;
    throw new Error('Paste a complete ' + (expected === 'offer' ? 'invitation' : 'reply') + ' link from Midnight Table.');
  }
}
export function makeLink(token, type, base = location.href) {
  const url = new URL(base);
  url.search = '';
  url.hash = new URLSearchParams({[type === 'offer' ? 'invite' : 'reply']: token}).toString();
  return url.href;
}
export function randomHex(bytes = 16) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function gather(pc) {
  if (pc.iceGatheringState === 'complete') return;
  await new Promise(resolve => {
    const timer = setTimeout(finish, 12000);
    function finish() { clearTimeout(timer); pc.removeEventListener('icegatheringstatechange', changed); resolve(); }
    function changed() { if (pc.iceGatheringState === 'complete' || pc.signalingState === 'closed') finish(); }
    pc.addEventListener('icegatheringstatechange', changed);
    changed();
  });
}
export function iceConfig(stun = 'stun:stun.l.google.com:19302', turn = '', username = '', credential = '') {
  const servers = [];
  if (stun.trim()) {
    const urls = stun.split(',').map(s => s.trim()).filter(Boolean);
    if (urls.some(s => !/^stuns?:[^\s]+$/.test(s))) throw new Error('STUN addresses must start with stun: or stuns:.');
    servers.push({urls});
  }
  if (turn.trim()) {
    if (!/^turns?:[^\s]+$/.test(turn.trim())) throw new Error('The relay address must start with turn: or turns:.');
    servers.push({urls: turn.trim(), username, credential});
  }
  return {iceServers: servers};
}
export class PeerLink {
  constructor({onMessage, onStatus, config = iceConfig(), room = randomHex(8)}) {
    if (typeof RTCPeerConnection === 'undefined') throw new Error('This browser cannot connect peer-to-peer. Try current Chrome, Firefox or Safari.');
    this.pc = new RTCPeerConnection(config);
    this.room = room;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.pc.addEventListener('datachannel', e => this.attach(e.channel));
    this.pc.addEventListener('connectionstatechange', () => { if (!this.closed) onStatus(this.pc.connectionState); });
  }
  attach(channel) {
    if (this.channel) { channel.close(); return; }
    this.channel = channel;
    channel.addEventListener('open', () => { if (!this.closed) this.onStatus('open'); });
    channel.addEventListener('close', () => { if (!this.closed) this.onStatus('closed'); });
    channel.addEventListener('error', () => { if (!this.closed) this.onStatus('failed'); });
    channel.addEventListener('message', e => {
      if (this.closed) return;
      if (typeof e.data !== 'string' || e.data.length > LIMIT) return this.onStatus('invalid-message');
      try {
        const message = JSON.parse(e.data);
        if (!message || message.v !== PROTOCOL || typeof message.type !== 'string') throw new Error();
        // Application failures are reported by the session, not swallowed as JSON errors.
        Promise.resolve(this.onMessage(message)).catch(() => this.onStatus('invalid-message'));
      } catch { this.onStatus('invalid-message'); }
    });
  }
  async invite() {
    this.attach(this.pc.createDataChannel('midnight-table', {ordered: true}));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await gather(this.pc);
    if (this.pc.signalingState === 'closed') throw new Error('The invitation was cancelled.');
    return encodePairing(this.pc.localDescription, this.room);
  }
  async join(input) {
    const offer = await decodePairing(input, 'offer');
    this.room = offer.room;
    await this.pc.setRemoteDescription({type: offer.type, sdp: offer.sdp});
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await gather(this.pc);
    if (this.pc.signalingState === 'closed') throw new Error('Joining was cancelled.');
    return encodePairing(this.pc.localDescription, this.room);
  }
  async accept(input) {
    const reply = await decodePairing(input, 'answer');
    if (reply.room !== this.room) throw new Error('That reply belongs to another table.');
    if (this.pc.signalingState !== 'have-local-offer') throw new Error('This invitation has already been answered. Create a fresh invitation to reconnect.');
    await this.pc.setRemoteDescription({type: reply.type, sdp: reply.sdp});
  }
  send(message) {
    if (!this.connected) throw new Error('Your partner is disconnected. Reconnect to continue.');
    const data = JSON.stringify({...message, v: PROTOCOL});
    if (data.length > LIMIT || this.channel.bufferedAmount > LIMIT * 4) throw new Error('The connection is busy. Try again in a moment.');
    this.channel.send(data);
  }
  get connected() { return this.channel?.readyState === 'open' && this.pc.connectionState === 'connected'; }
  close() { if (this.closed) return; this.closed = true; this.channel?.close(); this.pc.close(); this.onStatus('closed'); }
}
