import {registerCheckpoint} from '../../shared/game-checkpoint.js';
import {friendSession, registerFriendGame, inviteFriendGame, joinFriendRoom} from '../../shared/friend-context.js';
import {esc, loadPrefs, savePrefs, toast, openDialog, playSound, installTopbar, seatNames, playerName} from '../../shared/parlor.js';
import {CARDS, THEMES, formatYear} from './cards.js';
import {createGame, applyAction, playerView, validateView, score, LIVES} from './rules.js';
import {botAction, DIFFICULTIES} from './bot.js';
import {validateSetup} from './room-setup.js';

const KEY = 'yesteryear.preferences', app = document.querySelector('#app');
let prefs = loadPrefs(KEY);
function soloSetup(value = prefs.solo || {}) {
  const bots = Number.isInteger(value.bots) && value.bots >= 1 && value.bots <= 5 ? value.bots : 1;
  try { return {...validateSetup({...value, bots: Math.min(4, bots)}), bots}; }
  catch { return {...validateSetup({}), bots}; }
}
let solo = soloSetup(), scene = 'menu', mode = 'solo', game = null, client = null, botTimer = null, selected = null, lastSeen = null;

const setup = () => mode === 'async' ? client.record.setup : solo;
const lang = () => setup().lang;
const view = () => mode === 'async' ? client.record.view : game ? playerView(game, 0) : null;
const mySeat = () => mode === 'async' ? client.record.seat : 0;
const names = () => mode === 'async' ? seatNames(client.record, client) : solo.mode === 'streak' ? [playerName()] : [playerName(), ...Array.from({length: solo.bots}, (_, i) => 'Bot ' + (i + 1))];
const myTurn = () => { const v = view(); return Boolean(v && v.phase === 'playing' && v.turn === mySeat() && !(mode === 'async' && client.busy)); };
const roomSetup = () => { try { return validateSetup({...solo, bots: Math.max(0, Math.min(4, solo.bots - 1))}); } catch { return validateSetup({}); } };
const title = id => CARDS[id][lang()];
const years = id => formatYear(CARDS[id].year, lang());

function card(id, {open = false, extra = '', attrs = '', tag = 'div'} = {}) {
  const c = CARDS[id];
  return '<' + tag + ' class="tl-card ' + c.theme + ' ' + extra + '" lang="' + lang() + '" ' + attrs + '><span class="icon" aria-hidden="true">' + THEMES[c.theme].icon + '</span><span class="title">' + esc(title(id)) + '</span>'
    + (open ? '<span class="year">' + years(id) + '</span>' : '<span class="year hidden" aria-hidden="true">?</span>') + '</' + tag + '>';
}

// Menu ---------------------------------------------------------------------------
function renderMenu() {
  const room = friendSession(), friend = room?.friend?.joined ? room.friend.name || 'your friend' : '';
  const option = (map, current) => Object.entries(map).map(([id, label]) => '<option value="' + id + '"' + (String(current) === String(id) ? ' selected' : '') + '>' + esc(label) + '</option>').join('');
  const decks = {mix: 'Everything', ...Object.fromEntries(Object.entries(THEMES).map(([id, t]) => [id, t.icon + ' ' + t.en]))};
  const best = prefs.best?.[solo.decks];
  app.innerHTML = '<section class="menu"><div><p class="eyebrow">Timeline trivia · 1–6 players</p><h1>Before or <em>after?</em></h1>'
    + '<p class="lede">Every card is an invention, a discovery or a moment in history, with its year on the back. Slide yours into the timeline: right, and it stays; wrong, and you draw another. Empty your hand first.</p>'
    + '<div class="theme-grid">' + Object.entries(THEMES).map(([id, t]) => '<button type="button" class="theme-tile' + (solo.decks === id ? ' on' : '') + '" data-action="deck" data-deck="' + id + '"><span aria-hidden="true">' + t.icon + '</span><strong>' + esc(t.en) + '</strong><small>' + esc(t.fr) + '</small></button>').join('') + '</div></div>'
    + '<aside class="box stack" aria-label="Play options"><p class="eyebrow">Take a seat</p>'
    + '<label class="field">Game<select id="mode">' + option({race: 'Race the bots', streak: 'Solo streak · three lives'}, solo.mode) + '</select></label>'
    + (solo.mode === 'race' ? '<label class="field">Bots<select id="bots">' + option({1: '1 bot', 2: '2 bots', 3: '3 bots', 4: '4 bots', 5: '5 bots'}, solo.bots) + '</select></label><label class="field">Bot knowledge<select id="difficulty">' + option(DIFFICULTIES, solo.difficulty) + '</select></label>' : '')
    + '<label class="field">Deck<select id="decks">' + option(decks, solo.decks) + '</select></label>'
    + '<label class="field">Card language<select id="lang">' + option({en: 'English', fr: 'Français'}, solo.lang) + '</select></label>'
    + (solo.mode === 'streak' && best ? '<p class="muted small">Best streak with this deck: <strong>' + best + '</strong></p>' : '')
    + '<div class="row"><button class="btn" data-action="start">Play</button>' + (game && game.phase === 'playing' ? '<button class="btn ghost" data-action="resume">Resume</button>' : '') + '<button class="btn ghost" data-action="rules">Rules</button></div>'
    + '<hr><p class="muted small">' + (friend ? 'Race ' + esc(friend) + ', or build one timeline together.' : 'Different screens? Invite a friend with a room code.') + '</p>'
    + '<div class="row"><button class="btn alt" data-action="host">' + (friend ? 'Play with ' + esc(friend) : 'Play a friend') + '</button>' + (friend ? '' : '<button class="btn ghost" data-action="join">Join a friend</button>') + '</div></aside></section>';
  app.querySelectorAll('aside select').forEach(input => input.onchange = () => {
    const read = id => app.querySelector('#' + id)?.value;
    solo = soloSetup({...solo, mode: read('mode'), bots: read('bots') ? Number(read('bots')) : solo.bots, difficulty: read('difficulty') || solo.difficulty, decks: read('decks'), lang: read('lang')});
    prefs.solo = solo; savePrefs(KEY, prefs); render();
  });
}

// Table -------------------------------------------------------------------------------
function statusLine(v, list) {
  if (v.phase === 'over') {
    if (v.mode === 'streak') return 'Streak over: ' + score({timeline: v.timeline}) + ' cards placed.';
    return v.winners.includes(mySeat()) ? (v.winners.length > 1 ? 'A shared win!' : 'You win!') : v.winners.map(i => esc(list[i])).join(' & ') + ' wins.';
  }
  if (mode === 'async' && client.busy) return 'Placing…';
  const tail = v.ending ? ' Last round!' : v.out.length ? ' Tie-break!' : '';
  if (v.turn === mySeat()) return (selected ? 'Now choose a gap in the timeline.' : 'Your turn. Pick a card from your hand.') + tail;
  return esc(list[v.turn]) + ' is thinking…' + tail;
}
function lastLine(v, list) {
  if (!v.last) return '';
  const who = v.mode === 'streak' ? (mode === 'async' ? 'Your team' : 'You') : v.last.seat === mySeat() ? 'You' : list[v.last.seat];
  return '<div class="last ' + (v.last.correct ? 'good' : 'bad') + '" role="status"><strong>' + esc(who) + '</strong> placed “' + esc(title(v.last.card)) + '”: ' + (v.last.correct ? 'right, ' : 'wrong, it was ') + '<strong>' + years(v.last.card) + '</strong>.</div>';
}
function renderGame() {
  const v = view(), list = names(), turn = myTurn();
  if (selected && !v.hand.includes(selected)) selected = null;
  const slot = i => '<button type="button" class="slot" data-action="slot" data-slot="' + i + '"' + (turn && selected ? '' : ' disabled') + ' aria-label="Place ' + (selected ? esc(title(selected)) + ' ' : '') + (i === 0 ? 'before ' + esc(title(v.timeline[0])) : 'after ' + esc(title(v.timeline[i - 1]))) + '"><span>+</span></button>';
  const flash = v.last?.correct ? v.last.card : null;
  const timeline = slot(0) + v.timeline.map((id, i) => card(id, {open: true, extra: id === flash ? 'fresh' : ''}) + slot(i + 1)).join('');
  const players = v.mode === 'streak'
    ? '<span class="tag">Lives ' + '♥'.repeat(v.lives) + '♡'.repeat(LIVES - v.lives) + '</span><span class="tag">Score ' + score({timeline: v.timeline}) + '</span>'
    : list.map((name, i) => '<span class="tag' + (i === v.turn && v.phase === 'playing' ? ' on' : '') + (v.out.includes(i) ? ' out' : '') + '">' + esc(name) + ' · ' + v.counts[i] + '</span>').join('');
  const hand = v.hand.map(id => card(id, {tag: 'button', extra: selected === id ? 'picked' : '', attrs: 'type="button" data-action="pick" data-card="' + id + '" aria-pressed="' + (selected === id) + '"' + (turn ? '' : ' disabled')})).join('');
  app.innerHTML = '<div class="table-head row"><p class="status" role="status">' + statusLine(v, list) + '</p><span class="spacer"></span><span class="tag">' + v.deck + ' in the deck</span><button class="btn ghost small" data-action="rules">Rules</button><button class="btn ghost small" data-action="menu">Menu</button></div>'
    + '<div class="row players">' + players + (mode === 'async' ? '<span class="tag">' + (client.friendHere ? 'With ' + esc(client.names.friend) : esc(client.names.friend) + ' is away') + '</span>' : '') + '</div>'
    + lastLine(v, list)
    + '<section class="timeline box" aria-label="Timeline, earliest first"><p class="eyebrow">Timeline · earliest first</p><div class="tl">' + timeline + '</div></section>'
    + '<section class="hand box" aria-label="Your hand"><p class="eyebrow">' + (v.mode === 'streak' && mode === 'async' ? 'Your shared hand' : 'Your hand') + '</p><div class="cards">' + (hand || '<span class="muted">No cards left.</span>') + '</div></section>'
    + (v.discards.length ? '<details class="box discards"><summary>Discarded · ' + v.discards.length + '</summary><div class="cards">' + v.discards.map(id => card(id, {open: true, extra: 'small'})).join('') + '</div></details>' : '');
  if (v.phase === 'over') showResult(v, list);
}
function showResult(v, list) {
  if (document.querySelector('#parlor-dialog')?.open) return;
  let body;
  if (v.mode === 'streak') {
    const points = score({timeline: v.timeline});
    if (mode === 'solo') { prefs.best = {...prefs.best, [solo.decks]: Math.max(points, prefs.best?.[solo.decks] || 0)}; savePrefs(KEY, prefs); }
    body = '<p>You placed <strong>' + points + '</strong> card' + (points === 1 ? '' : 's') + ' in a row' + (v.lives ? ' and emptied the deck!' : '.') + '</p>';
  } else body = '<p>' + (v.winners.length > 1 ? 'Tied after a tie-break: ' : '') + v.winners.map(i => esc(list[i])).join(' & ') + (v.winners.length > 1 ? ' share the win.' : ' emptied their hand first.') + '</p>';
  openDialog(v.mode === 'streak' ? 'Streak over' : v.winners.includes(mySeat()) ? 'You win!' : 'Game over', body
    + '<div class="row" style="margin-top:14px"><button class="btn" data-action="again" data-close>' + (mode === 'async' ? 'Rematch' : 'Play again') + '</button><button class="btn ghost" data-action="menu" data-close>Menu</button></div>', 'Yesteryear');
}
function render() {
  const focus = document.activeElement?.dataset?.action ? {...document.activeElement.dataset} : null;
  if (scene === 'menu' || !view()) renderMenu(); else renderGame();
  if (focus) {
    const match = [...app.querySelectorAll('[data-action="' + focus.action + '"]')].find(el => el.dataset.card === focus.card && el.dataset.slot === focus.slot && el.dataset.deck === focus.deck);
    if (match && !match.disabled) match.focus({preventScroll: true});
  }
}

// Play -------------------------------------------------------------------------------
function announce(v) {
  const key = v.revision;
  if (lastSeen === null || lastSeen === key) { lastSeen = key; return; }
  lastSeen = key;
  playSound(v.phase === 'over' ? 'win' : v.last?.correct ? 'good' : 'bad');
}
function startSolo() {
  clearTimeout(botTimer); mode = 'solo'; client = null; selected = null; lastSeen = null;
  game = createGame({seats: solo.mode === 'streak' ? 1 : solo.bots + 1, mode: solo.mode, decks: solo.decks}, crypto.getRandomValues(new Uint32Array(1))[0]);
  scene = 'game'; render(); scheduleBots();
}
function scheduleBots() {
  clearTimeout(botTimer);
  if (mode !== 'solo' || !game || game.phase !== 'playing' || game.turn === 0) return;
  botTimer = setTimeout(() => {
    if (mode !== 'solo' || !game || game.turn === 0 || game.phase !== 'playing') return;
    game = applyAction(game, game.turn, botAction(game, game.turn, {difficulty: solo.difficulty}));
    announce(view()); render(); scheduleBots();
  }, 1500);
}
async function place(slot) {
  if (!myTurn() || !selected) return;
  const action = {kind: 'place', card: selected, slot};
  selected = null;
  if (mode === 'async') { try { await client.move(action); } catch (error) { toast(error.message); render(); } return; }
  game = applyAction(game, 0, action);
  announce(view()); render(); scheduleBots();
}
function showRules() {
  openDialog('How to play Yesteryear', '<ol><li>The timeline starts with one card, year showing. Your hand’s years are hidden.</li>'
    + '<li>On your turn, pick a card and a gap: before, between or after the cards already placed. Equal years can go on either side.</li>'
    + '<li>Right: it stays and shows its year. Wrong: it is discarded, its year is revealed, and you draw a new card.</li>'
    + '<li><strong>Race:</strong> once someone empties their hand, the round is finished so everyone has had the same number of turns. If several players are out of cards, they play a tie-break round with one new card each.</li>'
    + '<li><strong>Streak:</strong> one hand of three cards, refilled after each placement. Three mistakes end the run; every card placed scores.</li></ol>'
    + '<p class="muted small">Each card’s year was checked against Wikidata or by hand against its source; see the game’s SOURCES notes.</p>', 'Rules');
}
document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action = target.dataset.action;
  if (action === 'pick') { selected = selected === target.dataset.card ? null : target.dataset.card; playSound('tap'); render(); }
  else if (action === 'slot') place(Number(target.dataset.slot));
  else if (action === 'deck') { solo = soloSetup({...solo, decks: target.dataset.deck}); prefs.solo = solo; savePrefs(KEY, prefs); render(); }
  else if (action === 'start') startSolo();
  else if (action === 'resume') { scene = 'game'; render(); scheduleBots(); }
  else if (action === 'menu') { clearTimeout(botTimer); if (mode === 'async') { mode = 'solo'; client = null; game = null; friendSession()?.leaveRoomGame?.(); } scene = 'menu'; render(); }
  else if (action === 'again') { if (mode === 'async') friendSession()?.openGameSetup('yesteryear', client.record.setup); else startSolo(); }
  else if (action === 'rules') showRules();
  else if (action === 'host') inviteFriendGame('yesteryear', roomSetup());
  else if (action === 'join') joinFriendRoom('yesteryear');
});

installTopbar(KEY);
registerCheckpoint('yesteryear', {
  capture: () => mode === 'solo' && game ? {setup: solo, state: game} : null,
  restore(data) {
    if (!data?.state) throw new Error('Invalid saved table.');
    const setup = soloSetup(data.setup);
    validateView(playerView(data.state, 0));
    solo = setup; game = data.state; mode = 'solo'; scene = 'game'; render(); scheduleBots();
  },
});
registerFriendGame('yesteryear', {
  setup: roomSetup,
  startAsync(next) {
    clearTimeout(botTimer); client = next; mode = 'async'; scene = 'game'; selected = null; lastSeen = null;
    const unsubscribe = next.subscribe(record => { if (mode !== 'async' || client !== next) return; announce(record.view); render(); });
    window.addEventListener('pagehide', unsubscribe, {once: true});
  },
});
// Read-only hooks for the browser audits.
Object.defineProperty(window, '__yesteryear', {value: {get mode() { return mode; }, get view() { return view(); }}});
render();
