import {FriendSession, FRIEND_GAMES} from '../../shared/friend-session.js';
import {friendPanel} from '../../shared/friend-panel.js';
import {installFriendChat} from '../../shared/friend-chat-view.js';
import {createHostedRoom, hostedLink, hostedInvitation, roomConfig, roomDetails} from '../../shared/signaling.js';

document.body.innerHTML = friendPanel;
const $ = id => document.getElementById(id);
const frame = $('game-frame'), dialog = $('friend-dialog');
for (const [game, {title}] of Object.entries(FRIEND_GAMES)) {
  $('next-game').append(new Option(title, game));
}
const url = new URL(location.href);
const initialGame = Object.hasOwn(FRIEND_GAMES, url.searchParams.get('game'))
  ? url.searchParams.get('game') : 'collection';
let autoInvite = url.searchParams.get('action') === 'invite';
const invitation = url.hash;
url.hash = '';
url.searchParams.delete('action');
history.replaceState(null, '', url);

function showError(message) {
  $('friend-error').textContent = message;
  $('friend-error').hidden = false;
}
function loadGame(game, hash = '') {
  $('friend-error').hidden = true;
  const target = new URL('../../' + game + '/', import.meta.url);
  target.hash = hash;
  frame.title = FRIEND_GAMES[game].title;
  frame.src = target.href;
  const page = new URL(game === 'collection' ? '/' : '/together/', location.origin);
  if (game !== 'collection') page.searchParams.set('game', game);
  history.replaceState(null, '', page);
  document.title = FRIEND_GAMES[game].title + ' · Play together';
}
frame.addEventListener('load', () => {
  if (session.game === 'collection') session.registerGame('collection', {setup: () => ({}), start() {}});
  const doc = frame.contentDocument;
  doc?.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const target = new URL(link.href);
    if (target.origin !== location.origin) return;
    const game = target.pathname === '/' ? 'collection' : target.pathname.split('/')[1];
    if (Object.hasOwn(FRIEND_GAMES, game)) {
      event.preventDefault();
      session.requestGame(game);
    }
  });
});
let renderChat;
function render() {
  const title = FRIEND_GAMES[session.game].title;
  let status = 'Invite a friend · ' + title;
  if (session.loading) status = 'Loading ' + title + ' together…';
  else if (session.connected) status = session.paused ? 'Friend connected · Table paused' : 'Friend connected · ' + title;
  else if (session.connecting) status = (session.isHost ? 'Waiting for your friend · ' : 'Joining your friend · ') + title;
  $('friend-status').textContent = status;
  $('next-game').disabled = session.loading || Boolean(session.proposal);
  $('invite-friend').hidden = session.connected || session.connecting;
  $('invite-friend').disabled = !session.adapter || session.roomBusy;
  $('disconnect').hidden = !session.connected;
  renderChat?.();
  if (session.connected && $('room-dialog').open) $('room-dialog').close();
  const proposal = session.proposal;
  if (proposal) {
    dialog.dataset.kind = 'switch';
    $('dialog-title').textContent = proposal.outgoing ? 'Waiting for your friend' : 'Play ' + FRIEND_GAMES[proposal.game].title + '?';
    $('dialog-copy').textContent = proposal.outgoing
      ? 'Your friend can accept or decline. You will stay connected.'
      : 'Your friend wants to start a new game. This ends the current table and keeps your connection open.';
    $('accept-switch').textContent = 'Play together';
    $('accept-switch').hidden = proposal.outgoing;
    $('accept-switch').disabled = Boolean(proposal.accepted);
    $('decline-switch').textContent = proposal.cancelled ? 'Cancelling…' : proposal.outgoing ? 'Cancel request' : 'Keep playing';
    $('decline-switch').disabled = Boolean(proposal.accepted || proposal.cancelled);
    if (!dialog.open) dialog.showModal();
  } else if (dialog.dataset.kind === 'switch' && dialog.open) dialog.close();
  if (autoInvite && session.adapter) {
    autoInvite = false;
    queueMicrotask(() => session.adapter.invite().catch(error => showError(error.message)));
  }
}
const session = new FriendSession({
  game: initialGame, onChange: render, onSwitch: loadGame, onError: showError,
  onPicker: () => session.requestGame('collection'),
});
renderChat = installFriendChat(session);
window.__friendSession = session;
Object.defineProperty(window, '__together', {value: {
  get game() { return session.game; },
  get connected() { return session.connected; },
  get epoch() { return session.epoch; },
  get loading() { return session.loading; },
  get paused() { return session.paused; },
}});
$('next-game').onchange = event => {
  const game = event.target.value;
  event.target.value = '';
  session.requestGame(game);
};
$('invite-friend').onclick = () => {
  if (session.game === 'collection') createRoom();
  else session.adapter.invite().catch(error => showError(error.message));
};
async function createRoom() {
  const dialog = $('room-dialog');
  $('room-link').value = '';
  $('room-copy').disabled = true;
  $('room-status').textContent = 'Creating an invitation…';
  session.roomBusy = true;
  dialog.showModal();
  render();
  try {
    const invitation = await createHostedRoom('friends', 1);
    const config = await roomConfig(invitation, {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]});
    if (!dialog.open) return;
    await session.connectFriendRoom(invitation, 'host', config);
    $('room-link').value = hostedLink({...invitation, key: invitation.guestKey});
    $('room-copy').disabled = false;
    $('room-status').textContent = 'Send this link to one friend. Keep this page open. The invitation expires in 15 minutes.';
  } catch (error) {
    $('room-status').textContent = error.message;
  } finally { session.roomBusy = false; render(); }
}
$('room-copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('room-link').value); $('room-copy').textContent = 'Copied'; }
  catch { $('room-link').select(); $('room-status').textContent = 'Select and copy the invitation link.'; }
};
$('room-close').onclick = () => $('room-dialog').close();
$('accept-switch').onclick = () => {
  if (dialog.dataset.kind === 'leave') {
    session.disconnect();
    dialog.close();
    if (dialog.dataset.return === 'collection') location.href = '../';
  } else session.accept();
};
$('decline-switch').onclick = () => {
  if (dialog.dataset.kind === 'leave') dialog.close();
  else if (session.proposal?.outgoing) session.cancel();
  else session.decline();
};
dialog.addEventListener('cancel', event => {
  if (dialog.dataset.kind !== 'switch') return;
  event.preventDefault();
  if (session.proposal?.accepted || session.proposal?.cancelled) return;
  if (session.proposal?.outgoing) session.cancel();
  else session.decline();
});
function confirmDisconnect(returnToCollection = false) {
  dialog.dataset.kind = 'leave';
  dialog.dataset.return = returnToCollection ? 'collection' : '';
  $('dialog-title').textContent = 'Disconnect from your friend?';
  $('dialog-copy').textContent = 'To play together again, you will need a fresh invitation.';
  $('accept-switch').textContent = 'Disconnect';
  $('accept-switch').hidden = false;
  $('accept-switch').disabled = false;
  $('decline-switch').textContent = 'Stay together';
  $('decline-switch').disabled = false;
  dialog.showModal();
}
$('disconnect').onclick = () => confirmDisconnect();
$('collection-link').onclick = event => {
  event.preventDefault();
  session.requestGame('collection');
};
window.addEventListener('pagehide', () => session.disconnect());
const lobbyInvite = initialGame === 'collection' && invitation;
loadGame(initialGame, lobbyInvite ? '' : invitation);
render();
if (lobbyInvite) {
  try {
    const invitation = hostedInvitation(location.origin + '/' + lobbyInvite, 'friends');
    if (invitation) {
      const details = await roomDetails(invitation, 1);
      const config = await roomConfig(details, {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]});
      await session.connectFriendRoom(details, 'guest', config);
    }
  } catch (error) { showError(error.message); }
}
