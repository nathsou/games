// One live page connection per open tab. The room pushes presence, chat and
// game updates; moves and messages still use plain HTTP requests.
const HEARTBEAT = 45000, BACKOFF = [1000, 2000, 5000, 10000, 20000, 30000];

export class RoomLink {
  constructor(credential, {onMessage, onStatus}) {
    this.credential = credential;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.status = 'idle';
    this.presence = {page: null, game: null, visible: !document.hidden};
    this.attempt = 0;
    this.closed = false;
    this.wake = () => { if (!this.closed && this.status !== 'open') this.connect(); };
    this.visibility = () => this.update({visible: !document.hidden});
    window.addEventListener('online', this.wake);
    document.addEventListener('visibilitychange', this.visibility);
  }
  setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.onStatus(status);
  }
  connect() {
    if (this.closed || this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    clearTimeout(this.retry);
    const url = new URL('/api/rooms/friends/' + this.credential.room + '/live', location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    let socket;
    try { socket = new WebSocket(url, ['games.v1', 'auth.' + this.credential.key]); }
    catch { this.schedule(); return; }
    this.socket = socket;
    this.setStatus(this.attempt ? 'reconnecting' : 'connecting');
    socket.addEventListener('message', event => {
      if (this.socket !== socket) return;
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (!message || typeof message.type !== 'string') return;
      if (message.type === 'welcome') {
        this.attempt = 0;
        this.setStatus('open');
        this.sendPresence();
        clearInterval(this.beat);
        this.beat = setInterval(() => this.sendPresence(), HEARTBEAT);
      }
      this.onMessage(message);
    });
    socket.addEventListener('close', event => {
      if (this.socket !== socket) return;
      clearInterval(this.beat);
      this.socket = null;
      if (this.closed) return;
      // 1008 means the room rejected this page: an expired room or a revoked seat.
      if (event.code === 1008) { this.setStatus('rejected'); return; }
      this.setStatus('offline');
      this.schedule();
    });
  }
  schedule() {
    if (this.closed) return;
    clearTimeout(this.retry);
    const delay = BACKOFF[Math.min(this.attempt++, BACKOFF.length - 1)];
    this.retry = setTimeout(() => this.connect(), navigator.onLine === false ? Math.max(delay, 5000) : delay);
  }
  send(message) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    try { this.socket.send(JSON.stringify(message)); return true; } catch { return false; }
  }
  sendPresence() { return this.send({type: 'presence', ...this.presence}); }
  update(presence) {
    const next = {...this.presence, ...presence};
    if (next.page === this.presence.page && next.game === this.presence.game && next.visible === this.presence.visible) return;
    this.presence = next;
    this.sendPresence();
  }
  relay(data) { return this.send({type: 'relay', data}); }
  close() {
    this.closed = true;
    clearTimeout(this.retry); clearInterval(this.beat);
    window.removeEventListener('online', this.wake);
    document.removeEventListener('visibilitychange', this.visibility);
    const socket = this.socket; this.socket = null;
    try { socket?.close(1000); } catch { /* Already closed. */ }
    this.setStatus('closed');
  }
}
