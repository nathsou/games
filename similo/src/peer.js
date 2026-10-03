import {PROTOCOL} from './game.js';

const MAX_TOKEN = 131072;
export async function encodePairing(description) {
  const bytes = new TextEncoder().encode(JSON.stringify({version: PROTOCOL, type: description.type, sdp: description.sdp}));
  const compressed = typeof CompressionStream !== 'undefined';
  const buffer = compressed ? await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer() : bytes;
  const data = new Uint8Array(buffer);
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return `SIM${compressed ? 'Z' : 'J'}1.` + btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
export async function decodePairing(input, expectedType) {
  let token = String(input).trim();
  if (token.includes('#pair=')) token = decodeURIComponent(token.split('#pair=')[1]);
  if (token.length > MAX_TOKEN || !/^SIM[ZJ]1\.[A-Za-z0-9_-]+$/.test(token)) throw new Error('Paste the complete invitation or reply code.');
  const [prefix, encoded] = token.split('.');
  let bytes;
  try {
    bytes = Uint8Array.from(atob(encoded.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
    if (prefix === 'SIMZ1') {
      if (typeof DecompressionStream === 'undefined') throw new Error('Use a current browser to open this compressed invitation.');
      const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
      const chunks = []; let length = 0;
      while (true) {
        const {value, done} = await reader.read();
        if (done) break;
        length += value.length;
        if (length > MAX_TOKEN) { await reader.cancel(); throw new Error('Invitation is too large.'); }
        chunks.push(value);
      }
      bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    }
    const description = JSON.parse(new TextDecoder().decode(bytes));
    if (description.version !== PROTOCOL || description.type !== expectedType ||
        typeof description.sdp !== 'string' || !description.sdp.startsWith('v=0') || description.sdp.length > MAX_TOKEN) throw new Error();
    return {type: description.type, sdp: description.sdp};
  } catch (error) {
    if (error.message.includes('current browser') || error.message.includes('too large')) throw error;
    throw new Error(`This is not a valid ${expectedType === 'offer' ? 'invitation' : 'reply'} code.`);
  }
}
function gather(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Connection setup timed out. Try again or change your STUN server in Settings.')); }, 25000);
    function cleanup() { clearTimeout(timeout); pc.removeEventListener('icegatheringstatechange', change); }
    function change() { if (pc.iceGatheringState === 'complete') { cleanup(); resolve(); } }
    pc.addEventListener('icegatheringstatechange', change);
    change();
  });
}
export class PeerLink {
  constructor({onMessage, onStatus, stun = 'stun:stun.l.google.com:19302'}) {
    if (typeof RTCPeerConnection === 'undefined') throw new Error('This browser does not support peer connections. Use a current Chrome, Firefox or Safari.');
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.pc = new RTCPeerConnection({iceServers: stun ? [{urls: stun.split(',').map(s => s.trim()).filter(Boolean)}] : []});
    this.pc.addEventListener('connectionstatechange', () => this.onStatus(this.pc.connectionState));
    this.pc.addEventListener('datachannel', event => this.attach(event.channel));
  }
  attach(channel) {
    if (this.channel) { channel.close(); return; }
    this.channel = channel;
    channel.addEventListener('open', () => this.onStatus('open'));
    channel.addEventListener('close', () => this.onStatus('closed'));
    channel.addEventListener('error', () => this.onStatus('failed'));
    channel.addEventListener('message', event => {
      try {
        if (typeof event.data !== 'string' || event.data.length > 32768) throw new Error();
        const message = JSON.parse(event.data);
        if (!message || message.version !== PROTOCOL || typeof message.type !== 'string') throw new Error();
        this.onMessage(message);
      } catch { this.onStatus('invalid-message'); }
    });
  }
  async invite() {
    this.attach(this.pc.createDataChannel('similo', {ordered: true}));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await gather(this.pc);
    return encodePairing(this.pc.localDescription);
  }
  async join(token) {
    await this.pc.setRemoteDescription(await decodePairing(token, 'offer'));
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await gather(this.pc);
    return encodePairing(this.pc.localDescription);
  }
  async accept(token) { await this.pc.setRemoteDescription(await decodePairing(token, 'answer')); }
  send(message) {
    if (!this.connected) throw new Error('Your partner is disconnected. Reconnect before continuing.');
    const data = JSON.stringify({...message, version: PROTOCOL});
    if (data.length > 32768) throw new Error('The game update is too large to send.');
    this.channel.send(data);
  }
  get connected() { return this.channel?.readyState === 'open'; }
  close() { this.channel?.close(); this.pc.close(); }
}
