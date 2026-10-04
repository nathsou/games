import {REACTIONS} from './friend-chat.js';

export function installFriendChat(session) {
  const $ = id => document.getElementById(id);
  let current, rendered = 0, unread = 0, sending = false;
  function seen() {
    return !$('friend-chat').hidden && !document.hidden;
  }
  session.onChatVisibility = open => {
    if (open) {
      unread = 0;
      $('chat-log').scrollTop = $('chat-log').scrollHeight;
      if (!$('chat-input').disabled) $('chat-input').focus({preventScroll:true});
    }
    render();
  };
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
  $('chat-form').onsubmit = async event => {
    event.preventDefault();
    const text=$('chat-input').value;
    if(sending || !text.trim())return;
    sending=true;render();
    try {
      if(await send('text',text) && $('chat-input').value===text) {
        $('chat-input').value='';
        $('chat-input').dispatchEvent(new Event('input'));
      }
    } finally {
      sending=false;render();
      if(!$('friend-chat').hidden && $('friend-chat').contains(document.activeElement))$('chat-input').focus({preventScroll:true});
    }
  };
  $('chat-input').addEventListener('input',render);
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
      if (!own && !seen()) unread++;
      rendered = entry.sequence;
    }
    if (nearBottom) log.scrollTop = log.scrollHeight;
    if (seen()) unread = 0;
    session.chatWindow?.badge(unread, 'unread messages');
    $('chat-empty').hidden = Boolean(current.entries.length);
    const available = Boolean(session.resumeCredentials || session.connected);
    $('chat-status').textContent = session.resumeCredentials ? 'Saved in your room · reply whenever.' : session.connected
      ? 'One conversation, across every game.' : 'Invite or join a friend to chat.';
    $('chat-empty').textContent = available ? 'Say hello! Your conversation stays with you as you switch games.' : 'Connect with a friend from the Friends window. Your messages will appear here.';
    for (const input of $('friend-chat').querySelectorAll('input, #chat-reactions button')) input.disabled = !available;
    $('chat-send').disabled = !available || sending || !$('chat-input').value.trim();
  }
  session.openChat = () => session.chatWindow?.setOpen(true);
  document.addEventListener('visibilitychange', render);
  return render;
}
