import {FriendSession, ROOM_GAMES, isRoomGame} from '../../shared/friend-session.js';
import {friendPanel} from '../../shared/friend-panel.js';
import {installFriendChat} from '../../shared/friend-chat-view.js';
import {installSharedPlay} from '../../shared/shared-play-view.js';
import {installPanelVisibility} from '../../shared/friend-panel-visibility.js';
import {installNotifier} from '../../shared/together-notify.js';
import {FRIEND_PAGES, isFriendPage} from '../../shared/friend-pages.js';
import {renderGameSetup, setupSummary, defaultGameSetup, validateGameSetup} from '../../shared/friend-setup.js';
import {createHostedRoom, hostedLink, hostedInvitation, roomDetails, claimRoomResume, createRoomCode, resolveRoomCode} from '../../shared/signaling.js';
import {readFriendRoom, saveFriendRoom, forgetFriendRoom} from '../../shared/friend-resume.js';
import {normalizeRoomCode} from '../../shared/room-code.js';
import {readCheckpoint} from '../../shared/game-checkpoint.js';
import {loadPlayerName, savePlayerName} from '../../shared/player-name.js';
import {drawQR} from '../../shared/qr.js';

const ABOUT = {'flip-it': 'Card duel · bots and teams optional', cluance: 'Co-op clues · one gives, one guesses', midnight: 'Three quick card games'};
const SHAREABLE = ['spacegolf', 'nonocube', 'pawn-quest'];
const SEEN_KEY = 'games.together-seen.v1';
const $ = id => document.getElementById(id);

document.body.innerHTML = friendPanel;
const frame = $('game-frame');
const saved = readFriendRoom();
const url = new URL(location.href);
const invitation = url.hash.includes('room=') ? url.hash : '';
const requestedGame = isFriendPage(url.searchParams.get('game')) ? url.searchParams.get('game') : null;
const initialGame = requestedGame || (!url.searchParams.has('game') && location.pathname !== '/' && saved && isFriendPage(saved.page) ? saved.page : 'collection');
let pendingAction = url.searchParams.get('action');
url.hash = ''; url.searchParams.delete('action'); history.replaceState(null, '', url);

let tab = 'play', leaving = false, nextGame, readNextSetup, outgoingCursors, errorTimer, welcomed = false, roomBusy = false;
let seen = new Set();
try { seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY)) || []); } catch { /* Optional storage. */ }
function markSeen(id) {
  seen.add(id);
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-80))); } catch { /* Optional storage. */ }
}

const session = new FriendSession({game: initialGame, onChange: render, onSwitch: loadGame, onError: showError, onEvent: handleEvent, onPicker: () => navigate('collection')});
window.__friendSession = session;
Object.assign(session, {openInvitation, openJoin, openGameSetup, requestGame: game => openGameSetup(game), stopCursors, selectTab, leaveRoomGame: () => { session.useGame(null); render(); }});
const renderChat = installFriendChat(session), renderScreen = installSharedPlay(session, render);
installPanelVisibility(session);
const notifier = installNotifier({alerts: $('together-alerts'), toasts: $('together-toasts'), onOpen: () => session.showPanel()});
session.notifier = notifier;
session.screen.onStop = viewing => { session.closePeer(); if (viewing) navigate('collection'); render(); };
session.onPeerStatus = status => {
  if (status === 'open' && session.screen.sharer) session.screen.geometry();
  if (['closed', 'failed', 'disconnected', 'signaling-error'].includes(status) && session.screen.busy) {
    session.screen.stop(false);
    notifier.toast({key: 'cursors', title: 'Shared cursors ended', body: status === 'signaling-error' ? session.peer?.signalingError || 'The browsers could not connect.' : 'The connection closed.', notify: false});
  }
  render();
};
session.onPanelVisibility = open => { if (open && tab === 'chat') session.onChatVisibility?.(true); };
Object.defineProperty(window, '__together', {value: {
  get game() { return session.game; }, get status() { return session.status; }, get friend() { return {...session.friend}; },
  get screen() { return session.screen.phase; }, get games() { return session.games.slice(); }, get roomGame() { return session.asyncGame?.record.id || null; },
}});

function showError(message) {
  clearTimeout(errorTimer);
  $('friend-error').textContent = message; $('friend-error').hidden = false;
  errorTimer = setTimeout(() => { $('friend-error').hidden = true; }, 9000);
}
$('friend-error').onclick = () => { $('friend-error').hidden = true; };
const gameTitle = game => FRIEND_PAGES[game] || 'this game';
const friendName = () => session.friend.name || 'Your friend';

// Pages ---------------------------------------------------------------------
function loadGame(game) {
  frame.contentWindow?.__gameCheckpoint?.save();
  session.adapter = null;
  const target = new URL('../../' + game + '/', import.meta.url);
  frame.title = FRIEND_PAGES[game]; frame.src = target.href;
  const page = new URL(game === 'collection' ? '/' : '/together/', location.origin);
  if (game !== 'collection') page.searchParams.set('game', game);
  history.replaceState(null, '', page);
  notifier.setTitle(game === 'collection' ? 'Games · nathsou' : FRIEND_PAGES[game] + ' · Games');
  session.setPage(game);
  persist();
}
function navigate(game) {
  if (!isFriendPage(game)) return;
  if (session.screen.active) { session.screen.navigate(game); return; }
  session.useGame(null);
  session.resumeGame = session.resumeSharedPage = false;
  session.game = game; loadGame(game); render();
}
frame.addEventListener('load', () => {
  frame.contentDocument?.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const target = new URL(link.href); if (target.origin !== location.origin) return;
    const game = target.pathname === '/' ? 'collection' : target.pathname.split('/')[1];
    if (isFriendPage(game)) { event.preventDefault(); navigate(game); }
  });
});
$('collection-link').onclick = event => { event.preventDefault(); navigate('collection'); };
async function openRoomGame(id, record) {
  try {
    record ||= await session.fetchGame(id);
    if (session.screen.busy) stopCursors();
    frame.contentWindow?.__gameCheckpoint?.save();
    markSeen(record.id); notifier.dismiss('game-' + record.id);
    session.useGame(record);
    session.resumeGame = session.resumeSharedPage = false;
    session.game = record.game; loadGame(record.game);
    session.panel?.setOpen(false, false);
    render();
  } catch (error) { showError(error.message); }
}
function resumeSavedGame({game}) {
  if (session.screen.busy) stopCursors();
  session.useGame(null);
  session.resumeGame = true; session.resumeSharedPage = false;
  session.game = game; loadGame(game); render();
}

// Room membership -------------------------------------------------------------
function persist() {
  if (!session.credential || leaving) return;
  saveFriendRoom({...session.credential, page: session.game, asyncId: session.asyncGame?.record.id || null, chat: session.chat.snapshot(), draft: $('chat-input').value});
}
$('chat-input').addEventListener('input', persist);
function adopt(credential) {
  session.attach(credential);
  persist();
  welcomed = false;
  render();
}
function chosenName(input) {
  const name = savePlayerName(input.value);
  if (!name) { input.focus(); throw Error('Enter your name so your friend knows it’s you.'); }
  input.value = name;
  return name;
}
async function createRoom() {
  if (roomBusy) return;
  const status = $('start-status');
  try {
    chosenName($('my-name'));
    roomBusy = true; render(); status.textContent = 'Creating your room…';
    const room = await createHostedRoom('friends', 1);
    const credential = await claimRoomResume(room, loadPlayerName());
    credential.inviteLink = hostedLink({...room, key: room.guestKey});
    adopt(credential);
    status.textContent = '';
    await offerRoomCode();
  } catch (error) { status.textContent = error.message; }
  finally { roomBusy = false; render(); }
}
$('invite-friend').onclick = createRoom;
async function offerRoomCode(force = false) {
  const credential = session.credential;
  if (!credential || credential.role !== 'host' || session.friend.joined) return;
  if (!force && credential.inviteCode?.expiresAt > Date.now() + 60000) { renderInvite(); return; }
  $('room-code-status').textContent = 'Generating your room code…'; $('room-code-refresh').hidden = true;
  try {
    const code = await createRoomCode(credential);
    if (session.credential !== credential) return;
    credential.inviteCode = code; persist();
    $('room-code-status').textContent = '';
  } catch (error) {
    $('room-code-status').textContent = error.message; $('room-code-refresh').hidden = error.status === 410;
  }
  renderInvite();
}
$('room-code-refresh').onclick = () => offerRoomCode(true);
async function copy(text, button, done = 'Copied') {
  try { await navigator.clipboard.writeText(text); button.textContent = done; setTimeout(() => render(), 1500); }
  catch { $('room-code-status').textContent = 'Select and copy: ' + text; }
}
$('room-code-copy').onclick = () => copy(session.credential?.inviteCode?.code || '', $('room-code-copy'));
$('room-copy').onclick = () => copy(session.credential?.inviteLink || '', $('room-copy'));
$('invite-share').onclick = async () => {
  const link = session.credential?.inviteLink, code = session.credential?.inviteCode?.code;
  if (!link) return;
  const text = (session.me.name || 'A friend') + ' invited you to play.' + (code ? ' Room code: ' + code : '');
  if (navigator.share) { try { await navigator.share({title: 'Play together', text, url: link}); return; } catch (error) { if (error.name === 'AbortError') return; } }
  copy(link, $('invite-share'), 'Link copied');
};
$('invite-qr-details').addEventListener('toggle', () => { if ($('invite-qr-details').open && session.credential?.inviteLink) drawQR($('invite-qr'), session.credential.inviteLink); });

async function joinRoom(input) {
  let room, turn = null;
  if (normalizeRoomCode(input)) { room = await resolveRoomCode(input); turn = room.turn; }
  else {
    room = hostedInvitation(input, 'friends');
    if (!room) throw Error('Enter the eight-character room code or paste a complete invitation link.');
    turn = new URLSearchParams(new URL(input, location.href).hash.slice(1)).get('turn');
  }
  if (session.credential?.room === room.room) { session.showPanel(); return; }
  if (session.inRoom && !await confirmAction('Leave your current room?', 'You’re in a room with ' + friendName() + '. Joining another room removes it from this browser, with its chat and saved games.', 'Join new room')) return;
  const details = await roomDetails(room, 1);
  const credential = await claimRoomResume(details, loadPlayerName());
  if (session.inRoom) leaveRoom(false);
  adopt(credential);
  if (turn) openRoomGame(turn);
  selectTab('play');
}
$('join-form').onsubmit = async event => {
  event.preventDefault();
  const status = $('start-status');
  try {
    chosenName($('my-name'));
    $('join-friend').disabled = true; status.textContent = 'Joining your friend’s room…';
    await joinRoom($('join-input').value.trim());
    status.textContent = ''; $('join-input').value = '';
  } catch (error) { status.textContent = error.message; }
  finally { $('join-friend').disabled = false; }
};
function leaveRoom(confirmFirst = true) {
  const run = () => {
    stopCursors();
    forgetFriendRoom();
    session.leave();
    notifier.dismiss('cursors'); for (const element of $('together-alerts').children) element.remove();
    if (isRoomGame(session.game)) navigate('collection');
    $('settings-dialog').close();
    render();
  };
  if (!confirmFirst) { run(); return; }
  const joined = session.friend.joined;
  confirmAction(joined ? 'Leave this room?' : 'Cancel this invitation?', joined
    ? 'This browser loses the room with ' + friendName() + ', its chat and your saved games together. ' + friendName() + ' keeps their copy.'
    : 'The code and link stop working for this browser.', joined ? 'Leave room' : 'Cancel invitation').then(ok => { if (ok) run(); });
}
$('leave-room').onclick = () => leaveRoom();
$('cancel-room').onclick = () => leaveRoom();

function confirmAction(title, copyText, label) {
  const dialog = $('confirm-dialog');
  $('confirm-title').textContent = title; $('confirm-copy').textContent = copyText; $('confirm-accept').textContent = label;
  dialog.showModal();
  return new Promise(resolve => {
    const finish = value => { dialog.close(); $('confirm-accept').onclick = $('confirm-cancel').onclick = null; resolve(value); };
    $('confirm-accept').onclick = () => finish(true);
    $('confirm-cancel').onclick = () => finish(false);
    dialog.oncancel = event => { event.preventDefault(); finish(false); };
  });
}

// Entry points used by game pages ------------------------------------------------
function openInvitation(game = session.game, metadata) {
  if (session.inRoom && isRoomGame(game)) { openGameSetup(game, metadata); return; }
  session.showPanel(session.inRoom ? 'play' : undefined);
  if (!session.inRoom) ($('my-name').value ? $('invite-friend') : $('my-name')).focus();
}
function openJoin() {
  session.showPanel();
  if (!session.inRoom) $('join-input').focus();
}
function openGameSetup(game, metadata) {
  if (!isRoomGame(game)) { session.showPanel('play'); return; }
  if (!session.inRoom) { openInvitation(game); return; }
  nextGame = game;
  $('game-setup-title').textContent = 'Play ' + ROOM_GAMES[game] + ' with ' + (session.friend.name || 'your friend');
  $('game-setup-copy').textContent = session.friend.joined
    ? (session.friend.name || 'Your friend') + ' gets a request to join. The game is saved, so either of you can play later.'
    : 'Your friend sees this game as soon as they join your room.';
  $('game-setup-error').hidden = true;
  let initial = metadata;
  try { initial = validateGameSetup(game, metadata || (game === session.game && session.adapter?.setup ? session.adapter.setup() : defaultGameSetup(game))); }
  catch { initial = defaultGameSetup(game); }
  readNextSetup = renderGameSetup($('game-setup-fields'), game, initial);
  $('game-setup-start').disabled = false;
  $('game-setup-dialog').showModal();
}
$('game-setup-start').onclick = async () => {
  $('game-setup-start').disabled = true;
  try {
    const record = await session.createGame(nextGame, readNextSetup());
    $('game-setup-dialog').close();
    await openRoomGame(record.id, record);
    if (session.friend.joined) notifier.toast({key: 'sent-' + record.id, name: session.friend.name, title: 'Request sent to ' + friendName(), body: session.friend.online ? 'They’ll see it right away.' : 'They’ll see it when they’re back.', notify: false});
  } catch (error) { $('game-setup-error').textContent = error.message; $('game-setup-error').hidden = false; }
  finally { $('game-setup-start').disabled = false; }
};
$('game-setup-cancel').onclick = () => $('game-setup-dialog').close();

// Shared cursors ----------------------------------------------------------------
function inviteCursors(page) {
  if (!session.friend.online || session.screen.busy || outgoingCursors) return;
  const id = crypto.randomUUID();
  if (!session.relay({kind: 'cursors-invite', id, page})) { showError('Reconnecting to your room. Try again in a moment.'); return; }
  outgoingCursors = {id, page, timer: setTimeout(() => cancelCursors(true), 60000)};
  notifier.request({key: 'cursors-out', name: session.friend.name, eyebrow: 'Waiting', title: 'Asking ' + friendName() + ' to share ' + gameTitle(page), body: 'You’ll both control the game with your own cursor.', sound: null,
    actions: [{label: 'Cancel', run: () => cancelCursors(false)}]});
  render();
}
function cancelCursors(expired) {
  if (!outgoingCursors) return;
  clearTimeout(outgoingCursors.timer);
  session.relay({kind: 'cursors-cancel', id: outgoingCursors.id});
  outgoingCursors = null; notifier.dismiss('cursors-out');
  if (expired) notifier.toast({key: 'cursors', title: friendName() + ' didn’t answer', body: 'Try again when they’re back.', notify: false});
  render();
}
async function startCursors({sharer, id, page}) {
  session.useGame(null);
  session.panel?.setOpen(false, false);
  session.screen.start({sharer, id, page});
  render();
  try { await session.connectPeer(); }
  catch (error) {
    if (session.screen.id === id) { session.screen.stop(false); session.relay({kind: 'cursors-end', id}); }
    showError(error.message);
  }
}
function stopCursors() {
  if (outgoingCursors) cancelCursors(false);
  if (session.screen.busy) { session.relay({kind: 'cursors-end', id: session.screen.id}); session.screen.stop(); }
  session.closePeer();
}
function handleRelay(data) {
  const id = typeof data.id === 'string' && /^[a-f0-9-]{36}$/.test(data.id) ? data.id : null;
  if (!id) return;
  if (data.kind === 'cursors-invite' && isFriendPage(data.page)) {
    if (session.screen.busy || outgoingCursors) { session.relay({kind: 'cursors-decline', id}); return; }
    notifier.request({key: 'cursors', name: session.friend.name, eyebrow: 'Shared cursors', title: friendName() + ' wants to play ' + gameTitle(data.page) + ' with you',
      body: 'You’ll see their screen and both control the game with your own cursor.',
      actions: [
        {label: 'Join', primary: true, run: () => { session.relay({kind: 'cursors-accept', id}); startCursors({sharer: false, id}); }},
        {label: 'Not now', run: () => session.relay({kind: 'cursors-decline', id})},
      ]});
  } else if (data.kind === 'cursors-accept' && outgoingCursors?.id === id) {
    clearTimeout(outgoingCursors.timer);
    const {page} = outgoingCursors; outgoingCursors = null; notifier.dismiss('cursors-out');
    startCursors({sharer: true, id, page});
  } else if (data.kind === 'cursors-decline' && outgoingCursors?.id === id) {
    clearTimeout(outgoingCursors.timer); outgoingCursors = null; notifier.dismiss('cursors-out');
    notifier.toast({key: 'cursors', name: session.friend.name, title: friendName() + ' can’t share right now', notify: false});
  } else if (data.kind === 'cursors-cancel') notifier.dismiss('cursors');
  else if (data.kind === 'cursors-end' && session.screen.id === id) {
    session.screen.stop(false);
    notifier.toast({key: 'cursors', name: session.friend.name, title: friendName() + ' stopped sharing', notify: false});
  }
  render();
}

// Notifications -------------------------------------------------------------------
function gameRequest(record) {
  if (record.finished || seen.has(record.id) || record.creator === session.role || notifier.has('game-' + record.id)) return;
  let summary = '';
  try { summary = setupSummary(record.game, record.setup, session.isHost); } catch { /* Older setup. */ }
  notifier.request({key: 'game-' + record.id, name: session.friend.name, eyebrow: 'Game request', title: friendName() + ' wants to play ' + gameTitle(record.game), body: summary,
    actions: [
      {label: 'Play now', primary: true, run: () => openRoomGame(record.id)},
      {label: 'Later', run: () => { markSeen(record.id); notifier.toast({key: 'later', title: 'Saved in Games', body: 'Open it from Play together whenever you’re ready.', notify: false}); render(); }},
    ]});
}
function handleGame({record, cause, mine}) {
  if (mine) return;
  const viewing = session.asyncGame?.record.id === record.id, title = gameTitle(record.game), name = friendName();
  if (cause.kind === 'created') { gameRequest(record); return; }
  if (cause.kind === 'abandoned') {
    notifier.dismiss('game-' + record.id);
    notifier.toast({key: 'game-' + record.id, name: session.friend.name, title: name + ' ended ' + title, body: 'It stays in your finished games.', sound: 'message'});
    return;
  }
  if (cause.by === 'bot' && viewing) return;
  if (record.finished) {
    notifier.toast({key: 'turn-' + record.id, name: session.friend.name, title: title + ' is over', body: viewing ? 'See the final table.' : name + ' made the last move.', sound: 'turn',
      action: viewing ? null : {label: 'View', run: () => openRoomGame(record.id)}});
  } else if (record.myTurn) {
    // At the table already: the game shows the move; a chime is enough.
    if (viewing && !document.hidden) { notifier.chime('turn'); return; }
    const text = cause.kind === 'ready' ? name + ' is ready for the next round.' : name + ' played.';
    notifier.toast({key: 'turn-' + record.id, name: session.friend.name, title: viewing ? 'Your turn' : 'Your turn in ' + title, body: text, sound: 'turn',
      action: viewing ? null : {label: 'Open', run: () => openRoomGame(record.id)}});
  }
}
function handleEvent(event) {
  const name = friendName();
  if (event.kind === 'welcome') {
    if (!welcomed) {
      welcomed = true;
      const mine = loadPlayerName();
      if (!session.me.name && mine) session.saveName(mine).catch(() => {});
      for (const record of session.games) gameRequest(record);
    }
    if (session.isHost && !session.friend.joined) offerRoomCode();
  } else if (event.kind === 'friend-joined') {
    selectTab('play');
    notifier.toast({key: 'joined', name: session.friend.name, title: name + ' joined your room', body: 'Pick a game to play together.', sound: 'join', action: {label: 'Choose a game', run: () => session.showPanel('play')}});
  } else if (event.kind === 'friend-online') {
    if (notifier.recent?.('joined')) return;
    notifier.toast({key: 'presence', name: session.friend.name, title: name + ' is online', notify: false, timeout: 3500});
  } else if (event.kind === 'friend-moved') {
    const mine = session.asyncGame?.record.id;
    if (mine && session.friend.game === mine && event.previous.game !== mine) notifier.toast({key: 'presence', name: session.friend.name, title: name + ' joined the game', notify: false, timeout: 3500});
  } else if (event.kind === 'chat') {
    if (!$('friend-chat').hidden && !$('friend-header').hidden && !document.hidden) return;
    const entry = event.entry;
    notifier.toast({key: 'chat', name: session.friend.name, title: name, body: entry.value, sound: 'message', action: {label: 'Reply', run: () => session.openChat()}});
  } else if (event.kind === 'game') handleGame(event);
  else if (event.kind === 'relay') handleRelay(event.data);
  else if (event.kind === 'rejected') showError('This room has expired. Open Play together → Settings → Leave room, then invite your friend again.');
}

// Panel ------------------------------------------------------------------------------
function selectTab(next) {
  tab = next;
  for (const [name, panel] of [['play', 'panel-play'], ['games', 'panel-games'], ['chat', 'friend-chat']]) {
    const button = $('tab-' + name), active = name === tab;
    button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    $(panel).hidden = !active;
  }
  if (tab === 'chat') session.onChatVisibility?.(true);
  render();
}
for (const name of ['play', 'games', 'chat']) $('tab-' + name).onclick = () => selectTab(name);
$('view-room').querySelector('[role=tablist]').addEventListener('keydown', event => {
  const order = ['play', 'games', 'chat'], index = order.indexOf(tab);
  const next = {ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: order.length - 1}[event.key];
  if (next === undefined) return;
  event.preventDefault(); selectTab(order[(next + order.length) % order.length]); $('tab-' + tab).focus();
});

function statusText() {
  const friend = session.friend;
  if (session.status === 'rejected') return 'Room unavailable';
  if (session.status !== 'open') return 'Connecting…';
  if (!friend.online) return 'Offline · they’ll see your moves later';
  const where = friend.game && friend.game === session.asyncGame?.record.id ? 'In this game with you'
    : friend.page && friend.page !== 'collection' ? 'In ' + gameTitle(friend.page) : 'Browsing games';
  return (friend.visible ? 'Online · ' : 'Away · ') + where;
}
function renderPlay() {
  const list = $('play-list'), joined = session.friend.joined, signature = JSON.stringify([joined, session.friend.name]);
  if (list.dataset.signature !== signature) {
    list.dataset.signature = signature; list.replaceChildren();
    for (const [game, title] of Object.entries(ROOM_GAMES)) {
      const button = document.createElement('button'), text = document.createElement('span'), heading = document.createElement('strong'), about = document.createElement('small');
      button.type = 'button'; button.className = 'play-item'; button.dataset.game = game;
      heading.textContent = title; about.textContent = ABOUT[game]; text.append(heading, about);
      const arrow = document.createElement('span'); arrow.className = 'play-arrow'; arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '→';
      button.append(text, arrow); button.onclick = () => openGameSetup(game);
      list.append(button);
    }
  }
  const pages = [...new Set([...(SHAREABLE.includes(session.game) || isRoomGame(session.game) || session.game === 'collection' ? [] : [session.game]), ...SHAREABLE])];
  const online = session.friend.online && session.status === 'open', shareList = $('share-list'), shareSignature = JSON.stringify([pages, online, session.screen.busy, Boolean(outgoingCursors)]);
  if (shareList.dataset.signature !== shareSignature) {
    shareList.dataset.signature = shareSignature; shareList.replaceChildren();
    for (const page of pages) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = gameTitle(page); button.dataset.page = page;
      button.disabled = !online || session.screen.busy || Boolean(outgoingCursors);
      button.onclick = () => inviteCursors(page);
      shareList.append(button);
    }
  }
  $('share-note').textContent = online ? 'Play a solo game on one screen. You both control it with your own cursor.' : 'Available when ' + (session.friend.name || 'your friend') + ' is online.';
}
function gameRow(record) {
  const row = document.createElement('div'), open = document.createElement('button'), title = document.createElement('strong'), detail = document.createElement('small');
  row.className = 'game-row' + (record.myTurn ? ' your-turn' : '') + (record.finished ? ' finished' : '') + (session.asyncGame?.record.id === record.id ? ' current' : '');
  open.type = 'button'; open.className = 'game-open';
  title.textContent = gameTitle(record.game);
  const state = record.abandoned ? 'Ended by ' + (record.abandoned === session.role ? 'you' : session.friend.name || 'your friend')
    : record.finished ? 'Finished' : record.myTurn ? 'Your turn' : (session.friend.name || 'Friend') + '’s turn';
  detail.textContent = state + (record.game === 'flip-it' && !record.finished ? ' · Round ' + (record.round + 1) : '');
  open.append(title, detail);
  open.onclick = () => openRoomGame(record.id);
  row.append(open);
  if (!record.finished) {
    const end = document.createElement('button');
    end.type = 'button'; end.className = 'game-end'; end.textContent = 'End'; end.setAttribute('aria-label', 'End ' + gameTitle(record.game));
    end.onclick = async () => {
      if (!await confirmAction('End this game?', 'It moves to finished games for both of you.', 'End game')) return;
      try {
        if (session.asyncGame?.record.id === record.id) await session.asyncGame.end();
        else await import('../../shared/turn-client.js').then(({roomRequest}) => roomRequest(session.credential, 'turns/' + record.id, {method: 'DELETE'}));
      } catch (error) { showError(error.message); }
    };
    row.append(end);
  }
  return row;
}
function renderGames() {
  const list = $('turn-games-list'), games = session.games;
  const signature = JSON.stringify([games, session.friend.name, session.asyncGame?.record.id]);
  if (list.dataset.signature !== signature) {
    list.dataset.signature = signature; list.replaceChildren();
    const groups = [['Your turn', games.filter(g => g.myTurn)], ['Waiting for ' + (session.friend.name || 'your friend'), games.filter(g => !g.myTurn && !g.finished)], ['Finished', games.filter(g => g.finished).slice(0, 12)]];
    for (const [label, items] of groups) {
      if (!items.length) continue;
      const heading = document.createElement('h3'); heading.textContent = label; list.append(heading);
      for (const record of items.sort((a, b) => b.updatedAt - a.updatedAt)) list.append(gameRow(record));
    }
    if (!games.length) { const empty = document.createElement('p'); empty.className = 'setup-note'; empty.textContent = 'No games yet. Start one from Play.'; list.append(empty); }
  }
  const checkpoints = Object.keys(FRIEND_PAGES).map(game => readCheckpoint(game)).filter(Boolean);
  const saves = $('saved-games-list'), saveSignature = JSON.stringify(checkpoints.map(c => [c.game, Math.floor(c.updatedAt / 60000)]));
  if (saves.dataset.signature !== saveSignature) {
    saves.dataset.signature = saveSignature; saves.replaceChildren();
    for (const checkpoint of checkpoints) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Resume ' + FRIEND_PAGES[checkpoint.game];
      button.onclick = () => resumeSavedGame(checkpoint); saves.append(button);
    }
    $('saved-games').hidden = !checkpoints.length;
  }
}
function renderInvite() {
  const credential = session.credential, code = credential?.inviteCode;
  const current = code && code.expiresAt > Date.now();
  $('room-code').textContent = current ? code.code : '····-····';
  $('room-code-copy').disabled = !current; $('room-code-copy').textContent = 'Copy code';
  $('room-copy').disabled = $('invite-share').disabled = !credential?.inviteLink;
  $('room-copy').textContent = 'Copy link'; $('invite-share').textContent = navigator.share ? 'Share link' : 'Copy invitation';
  if (current && !$('room-code-status').textContent) $('room-code-status').textContent = 'Expires ' + new Date(code.expiresAt).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
}
function setLauncher(pending) {
  const launcher = $('show-friend-panel'), joined = session.inRoom && session.friend.joined;
  const avatar = launcher.querySelector('.avatar'), dot = launcher.querySelector('.presence-dot');
  avatar.hidden = !joined; launcher.querySelector('svg').style.display = joined ? 'none' : '';
  avatar.textContent = (session.friend.name || '?').charAt(0).toUpperCase() || '?';
  dot.hidden = !joined; dot.classList.toggle('online', session.friend.online && session.status === 'open'); dot.classList.toggle('away', session.friend.online && !session.friend.visible);
  launcher.querySelector('.launcher-label').textContent = joined ? (session.friend.name || 'Friend') : session.inRoom ? 'Invite' : 'Friends';
  session.panel?.badge(pending, pending === 1 ? 'thing needs you' : 'things need you');
  launcher.classList.toggle('attention', pending > 0);
}
function render() {
  const inRoom = session.inRoom, waiting = inRoom && session.isHost && !session.friend.joined;
  $('view-start').hidden = inRoom; $('view-invite').hidden = !waiting; $('view-room').hidden = !inRoom || waiting;
  $('open-settings').hidden = !inRoom;
  $('invite-friend').disabled = roomBusy;
  if (!inRoom && !$('my-name').value && document.activeElement !== $('my-name')) $('my-name').value = loadPlayerName();
  if (waiting) renderInvite();
  const name = session.friend.name || 'Your friend';
  $('friend-name').textContent = name;
  $('friend-avatar').textContent = name.charAt(0).toUpperCase();
  $('friend-avatar').classList.toggle('online', session.friend.online && session.status === 'open');
  $('friend-status').textContent = statusText();
  renderChat(); renderScreen();
  if (inRoom && !waiting) { renderPlay(); renderGames(); }
  const turns = session.games.filter(g => g.myTurn).length, unread = session.unread || 0;
  for (const [id, count] of [['tab-games', turns], ['tab-chat', unread]]) {
    const badge = $(id).querySelector('.tab-badge'); badge.textContent = count; badge.hidden = !count;
  }
  setLauncher(inRoom ? turns + unread : 0);
  for (const listener of session.listeners) { try { listener(); } catch { /* A closing page. */ } }
  persist();
  if (pendingAction) { const action = pendingAction; pendingAction = null; queueMicrotask(() => action === 'join' ? openJoin() : openInvitation(session.game)); }
}

// Settings ------------------------------------------------------------------------------
$('open-settings').onclick = () => {
  $('settings-name').value = session.me.name || loadPlayerName();
  const prefs = notifier.prefs;
  $('setting-sound').checked = prefs.sound;
  $('setting-system').checked = prefs.system && notifier.systemAvailable && Notification.permission === 'granted';
  $('setting-system').disabled = !notifier.systemAvailable;
  $('settings-status').textContent = '';
  $('show-invitation').hidden = !(session.isHost && !session.friend.joined);
  $('settings-dialog').showModal();
};
$('name-form').onsubmit = async event => {
  event.preventDefault();
  try { const name = chosenName($('settings-name')); await session.saveName(name); $('settings-status').textContent = 'Saved. ' + (session.friend.name || 'Your friend') + ' now sees you as ' + name + '.'; }
  catch (error) { $('settings-status').textContent = error.message; }
};
$('setting-sound').onchange = () => { notifier.setPref('sound', $('setting-sound').checked); if ($('setting-sound').checked) notifier.chime('turn'); };
$('setting-system').onchange = async () => {
  try { await notifier.setPref('system', $('setting-system').checked); $('settings-status').textContent = $('setting-system').checked ? 'You’ll be notified while this tab is in the background.' : ''; }
  catch (error) { $('setting-system').checked = false; $('settings-status').textContent = error.message; }
};
$('show-invitation').onclick = () => { $('settings-dialog').close(); session.showPanel(); };
$('settings-close').onclick = () => $('settings-dialog').close();

// Start ----------------------------------------------------------------------------------
window.addEventListener('pagehide', () => { frame.contentWindow?.__gameCheckpoint?.save(); persist(); leaving = true; stopCursors(); session.link?.close(); });
setInterval(() => { if (!document.hidden) renderGames(); }, 30000);
loadGame(initialGame);
if (saved && !invitation) {
  session.chat.restore(saved.chat);
  adopt({game: 'friends', room: saved.room, key: saved.key, role: saved.role, expiresAt: saved.expiresAt, inviteLink: saved.inviteLink, inviteCode: saved.inviteCode});
  $('chat-input').value = saved.draft || '';
  if (saved.asyncId && isRoomGame(initialGame)) openRoomGame(saved.asyncId);
}
selectTab('play');
render();
if (invitation) {
  session.showPanel();
  const name = loadPlayerName();
  if (name) joinRoom(location.origin + '/' + invitation).catch(error => { $('start-status').textContent = error.message; });
  else { $('join-input').value = location.origin + '/' + invitation; $('start-status').textContent = 'Enter your name, then join your friend.'; $('my-name').focus(); }
}
