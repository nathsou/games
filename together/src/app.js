import {FriendSession, FRIEND_GAMES} from '../../shared/friend-session.js';

const $ = id => document.getElementById(id);
const frame = $('game-frame'), dialog = $('friend-dialog');
for (const [game, {title}] of Object.entries(FRIEND_GAMES)) {
  $('next-game').append(new Option(title, game));
}
const url = new URL(location.href);
const initialGame = Object.hasOwn(FRIEND_GAMES, url.searchParams.get('game'))
  ? url.searchParams.get('game') : 'flip-it';
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
  const page = new URL(location.href);
  page.searchParams.set('game', game);
  history.replaceState(null, '', page);
  document.title = FRIEND_GAMES[game].title + ' · Play together';
}
function render() {
  const title = FRIEND_GAMES[session.game].title;
  $('friend-status').textContent = session.loading ? 'Loading ' + title + ' together…'
    : session.connected ? session.paused ? 'Friend connected · Table paused' : 'Friend connected · ' + title
      : 'Invite a friend · ' + title;
  $('next-game').disabled = session.loading || Boolean(session.proposal);
  $('invite-friend').hidden = session.connected;
  $('invite-friend').disabled = !session.adapter;
  $('disconnect').hidden = !session.connected;
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
  onPicker: () => $('next-game').focus(),
});
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
$('invite-friend').onclick = () => session.adapter.invite().catch(error => showError(error.message));
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
  if (!session.connected) return;
  event.preventDefault();
  confirmDisconnect(true);
};
window.addEventListener('pagehide', () => session.disconnect());
loadGame(initialGame, invitation);
render();
