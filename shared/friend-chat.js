export const REACTIONS = Object.freeze({'👏': 'Applause', '🔥': 'Fire', '😮': 'Surprise', '😂': 'Laugh', '💚': 'Heart'});
export const MESSAGE_LIMIT = 280;
const valid = (kind, value) => typeof value === 'string' &&
  (kind === 'text' ? value.trim().length > 0 && value.length <= MESSAGE_LIMIT
    : kind === 'reaction' && Object.hasOwn(REACTIONS, value));

// The original inviter orders messages, including simultaneous sends. Chat
// belongs to the connection, rather than a game's changing generation.
export class FriendChat {
  constructor(session) {
    this.session = session;
    this.entries = [];
    this.sequence = 0;
    this.sentAt = 0;
    this.receivedAt = [0, 0];
  }
  send(kind, value) {
    if (!this.session.connected) throw new Error('Connect a friend before sending a message.');
    value = typeof value === 'string' ? value.trim() : value;
    if (!valid(kind, value)) throw new Error('Write a message of up to ' + MESSAGE_LIMIT + ' characters.');
    if (Date.now() - this.sentAt < 500) throw new Error('Wait a moment before sending again.');
    if (this.session.isHost) this.publish(0, kind, value);
    else this.session.send({type: 'friend-chat-send', kind, value});
    this.sentAt = Date.now();
  }
  receive(message) {
    if (message.type === 'friend-chat-send') {
      if (this.session.isHost) this.publish(1, message.kind, message.value);
    } else if (message.type === 'friend-chat-entry') {
      if (!this.session.isHost && message.sequence === this.sequence + 1 &&
          [0, 1].includes(message.seat) && valid(message.kind, message.value)) this.append(message);
    } else return false;
    return true;
  }
  publish(seat, kind, value) {
    if (!valid(kind, value) || Date.now() - this.receivedAt[seat] < 100) return;
    const entry = {type: 'friend-chat-entry', sequence: this.sequence + 1, seat, kind, value};
    this.session.send(entry);
    this.receivedAt[seat] = Date.now();
    this.append(entry);
  }
  append({sequence, seat, kind, value}) {
    this.sequence = sequence;
    this.entries.push({sequence, seat, kind, value});
    if (this.entries.length > 60) this.entries.shift();
    this.session.onChange();
  }
}
