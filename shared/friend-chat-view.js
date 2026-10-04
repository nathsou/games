import {REACTIONS} from './friend-chat.js';

export function installFriendChat(session) {
  const $ = id => document.getElementById(id);
  let current, rendered = 0, unread = 0;
  function toggle(open) {
    if (open) session.showPanel?.();
    $('friend-chat').hidden = !open;
    if (open) {
      unread = 0;
      $('chat-log').scrollTop = $('chat-log').scrollHeight;
      $('chat-input').focus();
    } else $('chat-toggle').focus();
    render();
  }
  async function send(kind, value) {
    try {
      await session.chat.send(kind, value);
      $('chat-error').hidden = true;
      return true;
    } catch (error) {
      $('chat-error').textContent = error.message;
      $('chat-error').hidden = false;
      return false;
    }
  }
  for (const [emoji, label] of Object.entries(REACTIONS)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = emoji;
    button.setAttribute('aria-label', label);
    button.onclick = () => send('reaction', emoji);
    $('chat-reactions').append(button);
  }
  $('chat-toggle').onclick = () => toggle($('friend-chat').hidden);
  $('chat-close').onclick = () => toggle(false);
  $('friend-chat').addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); toggle(false); }
  });
  $('chat-form').onsubmit = async event => {
    event.preventDefault();
    if (await send('text', $('chat-input').value)) $('chat-input').value = '';
  };
  function render() {
    if (current !== session.chat) {
      current = session.chat;
      rendered = unread = 0;
      $('chat-log').replaceChildren();
      $('chat-input').value = '';
      $('chat-error').hidden = true;
    }
    const log = $('chat-log'), nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 50;
    for (const entry of current.entries) {
      if (entry.sequence <= rendered) continue;
      const own = entry.seat === (session.isHost ? 0 : 1);
      const row = document.createElement('li'), author = document.createElement('strong'), content = document.createElement('span');
      row.className = own ? 'own-message' : 'friend-message';
      author.textContent = own ? 'You' : 'Friend';
      content.textContent = entry.value;
      if (entry.kind === 'reaction') content.setAttribute('aria-label', REACTIONS[entry.value]);
      row.append(author, content);
      log.append(row);
      if (log.children.length > 60) log.firstElementChild.remove();
      if (!own && ($('friend-chat').hidden || $('friend-header').hidden)) unread++;
      rendered = entry.sequence;
    }
    if (nearBottom) log.scrollTop = log.scrollHeight;
    if (!$('friend-header').hidden && !$('friend-chat').hidden) unread = 0;
    $('chat-toggle').hidden = !session.resumeCredentials && !session.connected && !current.entries.length;
    $('chat-toggle').textContent = unread ? 'Chat (' + unread + ')' : 'Chat';
    $('chat-toggle').setAttribute('aria-expanded', String(!$('friend-chat').hidden));
    $('chat-status').textContent = session.resumeCredentials ? 'Saved in your room. Your friend can read and reply later.' : session.connected
      ? 'Messages stay in this room while you change games.' : 'Friend disconnected. Invite again to chat.';
    for (const input of $('friend-chat').querySelectorAll('input, #chat-send, #chat-reactions button')) input.disabled = !session.resumeCredentials && !session.connected;
  }
  session.openChat = () => toggle(true);
  return render;
}
