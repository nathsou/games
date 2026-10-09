import {registerCheckpoint} from '../../shared/game-checkpoint.js';
import {friendSession, registerFriendGame, inviteFriendGame, joinFriendRoom} from '../../shared/friend-context.js';
import {esc, loadPrefs, savePrefs, toast, openDialog, playSound, installTopbar, seatNames, playerName} from '../../shared/parlor.js';
import {createGame, applyAction, playerView, validateView, MODES, DEAL, linked} from './rules.js';
import {botAction, DIFFICULTIES} from './bot.js';
import {THEMES, artwork} from './themes.js';
import {validateSetup} from './room-setup.js';

const KEY = 'thrice.preferences', app = document.querySelector('#app');
let prefs = loadPrefs(KEY);
function soloSetup(value = prefs.solo || {}) {
  const bots = Number.isInteger(value.bots) && value.bots >= 1 && value.bots <= 5 ? value.bots : 2;
  try { return {...validateSetup({...value, bots: Math.min(4, bots)}), bots}; }
  catch { return {...validateSetup({}), bots}; }
}
let presentation = null, presentationTimer = null, pendingViews = [], seenRevision = null;
let activeSetup = null;
let solo = soloSetup(), scene = 'menu', mode = 'solo', game = null, client = null, botTimer = null, lastSeen = null;

const setup = () => mode === 'async' ? client.record.setup : solo;
const view = () => mode === 'async' ? client.record.view : game ? playerView(game, 0, {memoryAid: solo.memoryAid}) : null;
const mySeat = () => mode === 'async' ? client.record.seat : 0;
const names = () => mode === 'async' ? seatNames(client.record, client) : [playerName(), ...Array.from({length: solo.bots}, (_, i) => 'Bot ' + (i + 1))];
const tableView = () => presentation || view();
const myTurn = () => { const v = view(); return Boolean(!presentationTimer && !pendingViews.length && v && v.phase === 'playing' && v.turn === mySeat() && !(mode === 'async' && client.busy)); };
const roomSetup = () => { try { return validateSetup({...solo, bots: Math.max(0, Math.min(4, solo.bots - 1))}); } catch { return validateSetup({}); } };

// Cards -------------------------------------------------------------------------
function partners(value) { return [7 - value, value + 7, value - 7].filter(n => n >= 1 && n <= 12 && n !== value && linked(n, value)); }
function card(value, {small = false, extra = ''} = {}) {
  const theme = setup().theme, spicy = setup().mode === 'spicy';
  return '<span class="card face' + (small ? ' small' : '') + (value === 7 ? ' seven' : '') + ' ' + theme + ' ' + extra + '" style="--theme:' + THEMES[theme].accent + '" aria-label="' + value + '">'
    + (theme === 'classic' ? '<span class="classic-mark" aria-hidden="true">' + value + '</span>' : '<span class="art" style="' + artwork(theme, value) + '" aria-hidden="true"></span>') + '<b class="corner">' + value + '</b><b class="rank" aria-hidden="true">' + value + '</b>'
    + (spicy && !small && value !== 7 ? '<span class="links" aria-hidden="true">' + partners(value).map(n => '<i>' + n + '</i>').join('') + '</span>' : '') + '</span>';
}
const back = (label = '', action = '', attrs = '') => action
  ? '<button type="button" class="card back" style="--back:' + THEMES[setup().theme].back + '" data-action="' + action + '" ' + attrs + ' aria-label="' + esc(label) + '"' + (myTurn() ? '' : ' disabled') + '></button>'
  : '<span class="card back" style="--back:' + THEMES[setup().theme].back + '" aria-hidden="true"></span>';
const trios = list => '<span class="muted small">Trios</span>' + (list.length ? list.map(value => '<span class="trio" title="Trio of ' + value + 's">' + card(value, {small: true}) + '<i>×3</i></span>').join('') : '<span class="muted small">none yet</span>');

// Menu -----------------------------------------------------------------------------
function renderMenu() {
  const room = friendSession(), friend = room?.friend?.joined ? room.friend.name || 'your friend' : '';
  const option = (map, current) => Object.entries(map).map(([id, label]) => '<option value="' + id + '"' + (String(current) === String(id) ? ' selected' : '') + '>' + esc(label) + '</option>').join('');
  const preview = Array.from({length: 12}, (_, i) => card(i + 1, {small: true})).join('');
  app.innerHTML = '<section class="menu"><div><p class="eyebrow">Memory · push your luck · 2–6 players</p><h1>Find it <em>thrice.</em></h1>'
    + '<p class="lede">Ask for the lowest or highest card of any hand, yours included, or flip a card in the middle. Keep revealing while the cards match. Three of a kind wins a trio; one wrong card and everything goes back. Remember where things are.</p>'
    + '<div class="preview box">' + preview + '</div>'
    + '<p class="muted small">Win with three trios or the trio of 7s. In Spicy, you need two linked trios instead: their numbers add up to 7 or differ by 7, shown on each card.</p></div>'
    + '<aside class="box stack" aria-label="Play options"><p class="eyebrow">Take a seat</p>'
    + '<label class="field">Bots<select id="bots">' + option({1: '1 bot', 2: '2 bots', 3: '3 bots', 4: '4 bots', 5: '5 bots'}, solo.bots) + '</select></label>'
    + '<label class="field">Win with<select id="mode">' + option({simple: 'Simple · three trios or the 7s', spicy: 'Spicy · two linked trios or the 7s'}, solo.mode) + '</select></label>'
    + '<label class="field">Bot memory<select id="difficulty">' + option(DIFFICULTIES, solo.difficulty) + '</select></label>'
    + '<label class="field">Cards<select id="theme">' + option(Object.fromEntries(Object.entries(THEMES).map(([id, t]) => [id, t.name])), solo.theme) + '</select></label>'
    + '<label class="check"><input type="checkbox" id="memoryAid"' + (solo.memoryAid ? ' checked' : '') + '> Memory aid · list every card revealed</label>'
    + '<div class="row"><button class="btn" data-action="start">Play the bots</button>' + (game && game.phase === 'playing' ? '<button class="btn ghost" data-action="resume">Resume</button>' : '') + '<button class="btn ghost" data-action="rules">Rules</button></div>'
    + '<hr><p class="muted small">' + (friend ? 'Play with ' + esc(friend) + ', plus any bots you like. The game is saved for both of you.' : 'Different screens? Invite a friend with a room code.') + '</p>'
    + '<div class="row"><button class="btn alt" data-action="host">' + (friend ? 'Play with ' + esc(friend) : 'Play a friend') + '</button>' + (friend ? '' : '<button class="btn ghost" data-action="join">Join a friend</button>') + '</div></aside></section>';
  app.querySelectorAll('aside select, aside input').forEach(input => input.onchange = () => {
    solo = soloSetup({bots: Number(app.querySelector('#bots').value), mode: app.querySelector('#mode').value, difficulty: app.querySelector('#difficulty').value, theme: app.querySelector('#theme').value, memoryAid: app.querySelector('#memoryAid').checked});
    prefs.solo = solo; savePrefs(KEY, prefs); render();
  });
}

// Table ------------------------------------------------------------------------------
function describeSource(entry, list) {
  if (entry.from === 'middle') return 'middle';
  return (entry.end === 'low' ? 'lowest of ' : 'highest of ') + (entry.seat === mySeat() ? 'yours' : list[entry.seat]);
}
function seatPanel(v, seat, list) {
  const turn = v.phase === 'playing' && v.turn === seat, mine = seat === mySeat(), count = v.counts[seat];
  const front = v.reveal.filter(r => r.from === 'hand' && r.seat === seat).map(r => card(r.value, {small: true, extra: 'revealed'})).join('');
  let hand;
  if (mine) {
    hand = v.hand.map((value, i) => {
      const end = i === 0 ? 'low' : i === v.hand.length - 1 ? 'high' : null;
      if (!end || (end === 'high' && v.hand.length < 2)) return card(value);
      return '<button type="button" class="card-button" data-action="hand" data-seat="' + seat + '" data-end="' + end + '"' + (myTurn() ? '' : ' disabled') + ' aria-label="Reveal your ' + (end === 'low' ? 'lowest' : 'highest') + ' card, ' + value + '">' + card(value) + '<span class="end-label">' + (end === 'low' ? 'Lowest' : 'Highest') + '</span></button>';
    }).join('');
  } else {
    hand = count ? '<div class="hand-ends">' + back('Ask ' + list[seat] + ' for their lowest card', 'hand', 'data-seat="' + seat + '" data-end="low"')
      + '<span class="hand-count">' + count + '<small>cards</small></span>'
      + back('Ask ' + list[seat] + ' for their highest card', 'hand', 'data-seat="' + seat + '" data-end="high"') + '</div>' : '<span class="muted small">No cards left</span>';
  }
  return '<section class="seat' + (turn ? ' active' : '') + (mine ? ' mine' : '') + '" aria-label="' + esc(list[seat]) + '"><header><strong>' + esc(list[seat]) + (mine ? ' <span class="tag">you</span>' : '') + '</strong>'
    + (turn ? '<span class="turn-dot">turn</span>' : '') + '<span class="muted small">' + count + ' card' + (count === 1 ? '' : 's') + '</span></header>'
    + '<div class="hand' + (mine ? ' open' : '') + '">' + hand + '</div>'
    + (front ? '<div class="front" aria-label="Revealed from this hand"><span class="muted small">Revealed</span>' + front + '</div>' : '')
    + '<div class="trios" aria-label="Trios">' + trios(v.trios[seat]) + '</div></section>';
}
function statusLine(v, list) {
  if (v.settling) return v.last.result === 'trio' ? 'Three ' + v.last.cards[0].value + 's — trio collected!' : 'No match. Take a moment to remember these cards.';
  if (v.phase === 'over') return v.winner === mySeat() ? 'You win!' : esc(list[v.winner]) + ' wins.';
  if (mode === 'async' && client.busy) return 'Sending…';
  if (v.turn === mySeat()) return v.reveal.length ? 'Keep going: find another ' + v.reveal[0].value + (v.reveal.length === 2 ? ' for the trio.' : '.') : 'Your turn. Reveal a card.';
  return esc(list[v.turn]) + (v.reveal.length ? ' is chasing ' + v.reveal[0].value + 's…' : ' is choosing…');
}
function renderGame() {
  const v = tableView(), list = names(), seats = Array.from({length: v.seats}, (_, i) => i).filter(i => i !== mySeat());
  const middle = v.middle.map((m, index) => m === null ? '<span class="card gone" aria-hidden="true"></span>' : m.up ? card(m.value, {extra: 'revealed'}) : back('Flip middle card ' + (index + 1), 'middle', 'data-index="' + index + '"')).join('');
  const reveal = Array.from({length: 3}, (_, i) => v.reveal[i] ? '<figure>' + card(v.reveal[i].value, {extra: i === v.reveal.length - 1 ? 'revealed' : ''}) + '<figcaption>' + esc(describeSource(v.reveal[i], list)) + '</figcaption></figure>' : '<figure><span class="card reveal-slot">' + (i + 1) + '</span><figcaption>' + ['Reveal', 'Match', 'Collect'][i] + '</figcaption></figure>').join('');
  const last = v.last ? '<div class="last box"><p class="eyebrow">Last turn · ' + esc(list[v.last.seat]) + ' · ' + (v.last.result === 'trio' ? 'trio!' : 'no match') + '</p><div class="row">' + v.last.cards.map(r => '<figure>' + card(r.value, {small: true}) + '<figcaption>' + esc(describeSource(r, list)) + '</figcaption></figure>').join('') + '</div></div>' : '';
  const history = v.history ? '<details class="box history"><summary>Memory aid · ' + v.history.length + ' reveals</summary><ol>' + v.history.slice().reverse().map(h => '<li>' + h.value + ' · ' + esc(describeSource(h, list)) + (h.from === 'middle' ? ' #' + (h.index + 1) : '') + ' <span class="muted">by ' + esc(list[h.by]) + '</span></li>').join('') + '</ol></details>' : '';
  const note = mode === 'async' ? '<span class="tag">' + (client.friendHere ? 'With ' + esc(client.names.friend) : esc(client.names.friend) + ' is away') + '</span>' : '<span class="tag">' + MODES[v.mode] + ' · ' + DIFFICULTIES[solo.difficulty] + ' bots</span>';
  app.innerHTML = '<div class="table-head row"><p class="status" role="status">' + statusLine(v, list) + '</p>' + note + '<span class="spacer"></span><button class="btn ghost small" data-action="rules">Rules</button><button class="btn ghost small" data-action="menu">Menu</button></div>'
    + '<div class="opponents">' + seats.map(seat => seatPanel(v, seat, list)).join('') + '</div>'
    + '<div class="center"><section class="box middle-area" aria-label="Middle cards"><p class="eyebrow">The middle</p><p class="muted small table-tip">Flip any face-down card</p><div class="middle">' + middle + '</div></section>'
    + '<section class="box reveal-area" aria-label="This turn"><p class="eyebrow">Find three of a kind</p><div class="reveal row">' + reveal + '</div></section>' + last + '</div>'
    + seatPanel(v, mySeat(), list) + history;
  if (v.phase === 'over' && !presentationTimer) showResult(v, list);
}
function showResult(v, list) {
  if (document.querySelector('#parlor-dialog')?.open) return;
  const hands = v.hands ? '<div class="stack">' + v.hands.map((hand, seat) => '<div><strong>' + esc(list[seat]) + '</strong><div class="row">' + (hand.length ? hand.map(value => card(value, {small: true})).join('') : '<span class="muted small">empty</span>') + '</div></div>').join('') + '</div>' : '';
  openDialog(v.winner === mySeat() ? 'You win!' : list[v.winner] + ' wins', '<p>Trios: ' + v.trios[v.winner].join(', ') + (v.trios[v.winner].includes(7) ? ' · the 7s end it at once.' : '') + '</p><p class="eyebrow">Hands at the end</p>' + hands
    + '<div class="row" style="margin-top:14px"><button class="btn" data-action="again" data-close>' + (mode === 'async' ? 'Rematch' : 'Play again') + '</button><button class="btn ghost" data-action="menu" data-close>Menu</button></div>', 'Game over');
}
function render() {
  const focus = document.activeElement?.dataset?.action ? Object.assign({}, document.activeElement.dataset) : null;
  if (scene === 'menu' || !view()) renderMenu(); else renderGame();
  if (focus) {
    const match = [...app.querySelectorAll('[data-action="' + focus.action + '"]')].find(el => ['seat', 'end', 'index'].every(k => el.dataset[k] === focus[k]));
    if (match && !match.disabled) match.focus({preventScroll: true});
  }
}

// Play --------------------------------------------------------------------------------
function announce(v) {
  const key = v.round + '/' + v.revision;
  if (lastSeen === null) { lastSeen = key; return; }
  if (lastSeen === key) return;
  lastSeen = key;
  if (v.phase === 'over') playSound('win');
  else if (v.reveal.length) playSound('flip');
  else if (v.last?.result === 'trio') playSound('good');
  else if (v.last) playSound(v.turn === mySeat() ? 'turn' : 'bad');
}
function resetPresentation() {
  clearTimeout(presentationTimer); presentationTimer = null; presentation = null; pendingViews = []; seenRevision = null;
}
function present(next) {
  if (seenRevision === next.revision) { if (!presentationTimer) render(); return; }
  const initial = seenRevision === null;
  seenRevision = next.revision;
  if (initial) { presentation = next; render(); return; }
  pendingViews.push(next);
  if (!presentationTimer) advancePresentation();
}
function advancePresentation() {
  const next = pendingViews.shift();
  if (!next) { presentationTimer = null; render(); scheduleBots(); return; }
  const previous = presentation;
  const finishedTurn = next.last && previous && next.round > previous.round;
  presentation = finishedTurn ? {
    ...previous, phase: 'playing', settling: true, last: next.last, reveal: next.last.cards,
    middle: previous.middle.map((m, index) => {
      const shown = next.last.cards.find(c => c.from === 'middle' && c.index === index);
      return shown ? {up: true, value: shown.value} : m;
    }),
  } : next;
  presentationTimer = setTimeout(() => {
    presentation = next; presentationTimer = null;
    if (pendingViews.length) advancePresentation(); else { render(); scheduleBots(); }
  }, finishedTurn ? 1900 : 450);
  announce(next); render();
}
function startSolo() {
  activeSetup = {...solo};
  resetPresentation(); clearTimeout(botTimer); mode = 'solo'; client = null; lastSeen = null;
  game = createGame({seats: solo.bots + 1, mode: solo.mode}, crypto.getRandomValues(new Uint32Array(1))[0]);
  scene = 'game'; present(view()); scheduleBots();
}
function scheduleBots() {
  clearTimeout(botTimer);
  if (scene !== 'game' || document.hidden || document.querySelector('#parlor-dialog')?.open || presentationTimer || mode !== 'solo' || !game || game.phase !== 'playing' || game.turn === 0) return;
  botTimer = setTimeout(() => {
    if (mode !== 'solo' || !game || game.turn === 0) return;
    game = applyAction(game, game.turn, botAction(game, game.turn, {difficulty: solo.difficulty}));
    present(view());
  }, game.reveal.length ? 1100 : 1600);
}
async function act(action) {
  if (!myTurn()) return;
  if (mode === 'async') { try { await client.move(action); } catch (error) { toast(error.message); } return; }
  game = applyAction(game, 0, action);
  present(view());
}
function showRules() {
  clearTimeout(botTimer);
  openDialog('How to play Thrice', '<ol><li>The 36 cards are numbered 1–12, three of each. Every hand is sorted from lowest to highest; the rest lie face down in the middle.</li>'
    + '<li>On your turn, reveal cards one at a time. Ask any player, yourself included, for their <strong>lowest</strong> or <strong>highest</strong> card, or flip a <strong>middle</strong> card.</li>'
    + '<li>As long as the cards match, keep going. Revealed hand cards wait in front of their owner, so asking the same end again shows the next card.</li>'
    + '<li>Three of a kind: you win that trio and your turn ends. A different card: your turn ends and every revealed card goes back, face down in the middle or back into its hand.</li>'
    + '<li><strong>Simple:</strong> win with three trios, or the trio of 7s. <strong>Spicy:</strong> win with two linked trios, whose numbers add up to 7 or differ by 7 (each card shows its partners), or the trio of 7s.</li>'
    + '<li>Nobody writes anything down. Turn on the memory aid for a relaxed game.</li></ol><p class="muted small">Bots remember what they saw; Goldfish forget quickly, Elephants never do.</p>', 'Rules');
}
document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action = target.dataset.action;
  if (action === 'hand') act({kind: 'reveal', from: 'hand', seat: Number(target.dataset.seat), end: target.dataset.end});
  else if (action === 'middle') act({kind: 'reveal', from: 'middle', index: Number(target.dataset.index)});
  else if (action === 'start') startSolo();
  else if (action === 'resume') { solo = activeSetup || solo; scene = 'game'; present(view()); scheduleBots(); }
  else if (action === 'menu') { resetPresentation(); clearTimeout(botTimer); if (mode === 'async') { mode = 'solo'; client = null; game = null; friendSession()?.leaveRoomGame?.(); } scene = 'menu'; render(); }
  else if (action === 'again') { if (mode === 'async') friendSession()?.openGameSetup('thrice', client.record.setup); else startSolo(); }
  else if (action === 'rules') showRules();
  else if (action === 'host') inviteFriendGame('thrice', roomSetup());
  else if (action === 'join') joinFriendRoom('thrice');
});

document.addEventListener('visibilitychange', scheduleBots);
document.addEventListener('close', scheduleBots, true);
installTopbar(KEY);
registerCheckpoint('thrice', {
  capture: () => mode === 'solo' && game ? {setup: activeSetup || solo, state: game} : null,
  restore(data) {
    if (!data?.state) throw new Error('Invalid saved table.');
    const setup = soloSetup(data.setup);
    if (data.state.seats !== setup.bots + 1 || !Object.hasOwn(DEAL, data.state.seats)) throw new Error('Invalid saved table.');
    validateView(playerView(data.state, 0));
    resetPresentation(); activeSetup = {...setup}; solo = setup; game = data.state; mode = 'solo'; scene = 'game'; present(view()); scheduleBots();
  },
});
registerFriendGame('thrice', {
  setup: roomSetup,
  startAsync(next) {
    resetPresentation(); clearTimeout(botTimer); client = next; mode = 'async'; scene = 'game'; lastSeen = null;
    const unsubscribe = next.subscribe(record => { if (mode !== 'async' || client !== next) return; present(record.view); });
    window.addEventListener('pagehide', unsubscribe, {once: true});
  },
});
// Read-only hooks for the browser audits.
Object.defineProperty(window, '__thrice', {value: {get mode() { return mode; }, get view() { return view(); }}});
render();
