import {registerCheckpoint} from '../../shared/game-checkpoint.js';
import {friendSession, registerFriendGame, inviteFriendGame, joinFriendRoom, openFriendChat} from '../../shared/friend-context.js';
import {loadPlayerName, savePlayerName} from '../../shared/player-name.js';
import {trackArcadeGame} from '../../shared/ai/usage.js';
import {installThemeControls} from '../../shared/theme.js';
import {loadAI} from '../../shared/ai/config.js';
import {chooseTurn} from '../../shared/ai/turn.js';
import {openAISettings,aiStatusHtml} from '../../shared/ai/panel.js';
import {describeTurn} from './ai.js';
import {GAMES, createGame, applyAction, playerView, reserve, winner} from './rules.js';
import {botAction} from './bot.js';
import {validateView} from './session.js';
import {setSound, sound} from './sound.js';

const app = document.querySelector('#app'), modal = document.querySelector('#modal'), modalContent = document.querySelector('#modal-content');
let prefs;
try { prefs = JSON.parse(localStorage.getItem('midnight.preferences') || '{}'); } catch { prefs = {}; }
if (!prefs || typeof prefs !== 'object') prefs = {};
let selectedGame = new URLSearchParams(location.search).get('game') || 'backhand';
if (!Object.hasOwn(GAMES, selectedGame)) selectedGame = 'backhand';
let aiController=null,aiBusy=false,aiError='',aiMemory=[],matchId='',selectedOpponent='dealer';
let scene = 'menu', mode = 'solo', game = null, seat = 0, chosen = null, source = null, handoff = false;
let botTimer = null, botPrepared = null, botContext = '', generation = 0;
let offlineSeries = [0, 0], countedGame = null, asyncClient = null, lastViewKey = '';
let toastTimer;
const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const sprite = kind => '<span class="sprite ' + kind + '" aria-hidden="true"></span>';
function button(label, action, className = '', disabled = false, attributes = '') {
  return '<button type="button" class="button ' + className + '" data-action="' + action + '" ' + (disabled ? 'disabled ' : '') + attributes + '>' + label + '</button>';
}
function savePrefs() { try { localStorage.setItem('midnight.preferences', JSON.stringify(prefs)); } catch {} }
function notify(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message; toast.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 4200);
}
function name() { return loadPlayerName() || (typeof prefs.name === 'string' ? prefs.name.slice(0, 24) || 'You' : 'You'); }
function opponentHtml(){return '<label class="label" for="ai-opponent">OPPONENT</label><select id="ai-opponent"><option value="dealer" '+(prefs.opponent!=='model'?'selected':'')+'>Dealer · offline, no API calls</option><option value="model" '+(prefs.opponent==='model'?'selected':'')+'>AI · shared provider & model</option></select>'+button('AI SETTINGS ↗','ai-settings','outline compact');}
function stopAI(message=''){aiController?.abort();aiController=null;aiBusy=false;aiError=message;}
// Room seats: 'host' and 'guest', or 'team' (both people) against the dealer or AI.
function team() { return mode === 'async' && asyncClient.record.controllers[0] === 'team'; }
function names() {
  if (mode === 'async') {
    const {me, friend} = asyncClient.names, seats = asyncClient.record.controllers;
    if (team()) return [(me + ' & ' + friend).slice(0, 24), seats[1] === 'model' ? 'AI opponent' : 'The Dealer'];
    return [0, 1].map(i => i === mySeat() ? me : friend);
  }
  return mode === 'solo' ? [name(), selectedOpponent==='model'?'AI opponent':'The Dealer'] : [name(), 'Partner'];
}
function mySeat() { return mode === 'async' ? asyncClient.record.seat : seat; }
function view() { return mode === 'async' ? asyncClient.record.view : game ? playerView(game, seat) : null; }
function blocked() { return mode === 'async' && asyncClient.busy; }
function roomIndex() { return asyncClient?.session.role === 'host' ? 0 : 1; }
function locked() {
  const v = view(), p = mySeat();
  return v.type === 'backhand' ? Boolean(v.pending[p]) : v.phase === 'guard' ? Boolean(v.guards[p]) : Boolean(v.raids[p]);
}
function otherLocked() {
  const v = view(), p = 1 - mySeat();
  return v.type === 'backhand' ? Boolean(v.pending[p]) : v.phase === 'guard' ? Boolean(v.guards[p]) : Boolean(v.raids[p]);
}
function tag() {
  const label = mode === 'solo' ? (selectedOpponent==='model'?'VS AI':'VS THE DEALER') : mode === 'local' ? 'PASS & PLAY' : asyncClient.friendHere ? 'WITH ' + esc(asyncClient.names.friend).toUpperCase() : esc(asyncClient.names.friend).toUpperCase() + ' IS AWAY';
  return '<span class="tag"><span class="dot"></span>' + label + '</span>';
}
function render() {
  const active = document.activeElement;
  const focus = active?.dataset?.action ? {action: active.dataset.action, card: active.dataset.card, lot: active.dataset.lot, game: active.dataset.game} : null;
  app.innerHTML = scene === 'menu' || !view() ? renderMenu() : renderGame();
  if (focus) {
    const candidates = [...app.querySelectorAll('[data-action="' + focus.action + '"]')];
    const match = candidates.find(el => (!focus.card || el.dataset.card === focus.card) && (!focus.lot || el.dataset.lot === focus.lot) && (!focus.game || el.dataset.game === focus.game));
    if (match && !match.disabled) match.focus({preventScroll: true});
  }
}
function renderMenu() {
  const room = friendSession(), friend = room?.friend?.joined ? room.friend.name || 'your friend' : '';
  let html = '<section class="menu-intro"><div><p class="eyebrow">THREE GAMES. TWO SEATS. ONE MORE ROUND.</p><h1>A little<br>friendly <em>rivalry.</em></h1></div><p class="intro-note">Small rules. Big “I knew you’d do that” energy.<br>Pick your game, pull up a chair, and keep the good times rolling.</p></section><div class="menu-layout"><div><section class="collection" aria-label="Choose a game">';
  Object.entries(GAMES).forEach(([id, g], i) => {
    html += '<button class="game-tile ' + (selectedGame === id ? 'selected' : '') + '" data-action="select-game" data-game="' + id + '" aria-pressed="' + (selectedGame === id) + '" aria-label="Select ' + g.name + '"><div class="tile-art ' + g.accent + '"><span class="tile-number">NO. 0' + (i + 1) + '</span>' + sprite(g.sprite) + '</div><div class="tile-body"><h2>' + g.name + '</h2><p>' + g.subtitle + '</p><div class="tile-meta"><span>' + g.time + '</span><b aria-hidden="true">' + (selectedGame === id ? '✦' : '↗') + '</b></div></div></button>';
  });
  html += '</section><p class="collection-note"><b>One table. Three ways to outsmart each other.</b><br>No accounts, no downloads. Just cards, coins, and suspiciously good timing.</p></div><aside class="panel join-panel" aria-label="Play options"><div><p class="eyebrow">TAKE A SEAT</p><h2 class="panel-title">' + GAMES[selectedGame].name + '</h2><p class="small">Learn the ropes with our dealer, or share a screen with someone.</p>';
  html += opponentHtml() + button((prefs.opponent==='model'?'PLAY THE AI →':'PLAY THE DEALER →'), 'start-solo') + button('PASS & PLAY', 'start-local', 'dark');
  if (view() && view().phase !== 'over') html += button('RESUME CURRENT GAME', 'resume', 'outline');
  html += '</div><hr class="divider"><div><label class="label" for="player-name">YOUR NAME</label><input id="player-name" maxlength="24" value="' + esc(name()) + '" autocomplete="nickname" aria-label="Your name"><p class="small">' + (friend ? 'Play ' + GAMES[selectedGame].name + ' with ' + esc(friend) + '. Your game is saved, so either of you can take a break.' : 'Different screens? Invite a friend with a room code. Games are saved for both of you.') + '</p>' + button(friend ? 'PLAY WITH ' + esc(friend).toUpperCase() + ' ↗' : 'PLAY A FRIEND ↗', 'host', 'gold') + (friend ? '' : button('JOIN A FRIEND', 'join', 'outline')) + '</div><div class="menu-session"><span class="dot"></span> No sign-in. Just a room code.</div></aside></div>';
  return html;
}
function roundDots(v) {
  const done = v.type === 'closing' ? v.closed : v.round;
  return '<div class="round-dots" aria-label="' + done + ' rounds completed">' + Array.from({length: GAMES[v.type].rounds}, (_, i) => '<span class="round-dot ' + (i < done ? 'done' : i === done ? 'current' : '') + '"></span>').join('') + '</div>';
}
function renderGame() {
  const v = view(), p = mySeat(), ns = names(), g = GAMES[v.type];
  const series = mode === 'async' ? null : offlineSeries;
  const tips = {
    backhand: '<strong>Win now. Arm them for later.</strong><br>Every bid goes into your opponent’s hand. Losing a small prize can buy you a big opportunity.',
    closing: '<strong>Watch the other clocks.</strong><br>Invest in one auction, then advance a different one. First bidder wins tied bids—even after moving their cube.',
    heist: '<strong>Every defense gets spent.</strong><br>A safe choice still burns their defense. Watch the discarded alarms; they only started with three.'
  };
  let html = (mode === 'async' ? aiStatusHtml({busy:asyncClient.aiBusy,error:asyncClient.aiError,controller:asyncClient.record.creator===asyncClient.session.role}) : aiStatusHtml({busy:aiBusy,error:aiError,controller:true}))+'<section class="table-heading"><div><p class="eyebrow">MIDNIGHT TABLE / NO. 0' + (Object.keys(GAMES).indexOf(v.type) + 1) + '</p><h1>' + g.name + '</h1></div><div class="heading-actions">' + tag() + button('RULES ?', 'rules', 'outline compact') + button('TABLE MENU', 'table-menu', 'outline compact') + '</div></section>';
  html += '<div class="table-layout"><aside class="sidebar"><div class="panel"><p class="eyebrow">THE SCORE</p><div class="scoreboard">';
  for (let i = 0; i < 2; i++) {
    html += '<div class="score-seat ' + (i === p ? 'you ' : '') + (v.type === 'closing' && v.turn === i && v.phase !== 'over' ? 'active' : '') + '"><div class="score-name"><b>' + esc(ns[i]) + '</b><span aria-hidden="true">' + (i ? '◆' : '✦') + '</span></div><div class="score-value">' + v.scores[i] + '<small> ' + (v.type === 'heist' ? 'COINS' : 'PTS') + '</small></div></div>';
  }
  html += '</div>' + (series ? '<p class="series">GAMES WON &nbsp; ' + series[0] + ' : ' + series[1] + '</p>' : button('CHAT WITH ' + esc(asyncClient.names.friend).toUpperCase(), 'table-chat', 'outline compact')) + '</div><div class="panel tips-panel"><p class="eyebrow">A LITTLE ADVICE</p><p class="sidebar-tip">' + tips[v.type] + '</p><hr class="divider"><p class="sidebar-tip">' + (v.type === 'closing' ? 'Gold cubes: ' + esc(ns[0]) + '<br>Coral cubes: ' + esc(ns[1]) : 'Choose first. Lock it in.<br>Then see what they were thinking.') + '</p></div><p class="sidebar-note">' + (mode === 'async' ? (team() ? 'You share a hand and a score against ' + esc(names()[1]) + '. Either of you can make the next move.' : 'Hands stay hidden. Simultaneous choices are locked before either is revealed. The game is saved, so either of you can take a break.') : mode === 'local' ? 'Pass the screen when prompted. All choices are hidden until both players have locked in.' : 'The dealer chooses without peeking at your move. Keyboard: 1–5 selects a card; Enter locks it.') + '</p></aside><section class="felt-table" aria-label="' + g.name + ' game table"><div class="table-meta"><span>' + (v.type === 'closing' ? 'AUCTIONS ' + v.closed + ' / 9' : 'ROUND ' + String(v.round + 1).padStart(2, '0') + ' / ' + g.rounds) + '</span>' + roundDots(v) + '</div>';
  if (handoff && mode === 'local') { /* No private cards are rendered behind the handoff. */ }
  else if (v.phase === 'over') html += renderEnd(v);
  else if (v.type === 'backhand') html += renderBackhand(v);
  else if (v.type === 'closing') html += renderClosing(v);
  else html += renderHeist(v);
  if (v.log.length && !handoff) html += '<details class="journal"><summary>TABLE JOURNAL · ' + v.log.length + ' ' + (v.type === 'closing' ? 'AUCTIONS' : 'ROUNDS') + '</summary><ol>' + v.log.map(event => '<li>' + eventText(event) + '</li>').join('') + '</ol></details>';
  if (handoff && mode === 'local') html += '<div class="handoff">' + sprite('back') + '<p class="eyebrow">KEEP A STRAIGHT FACE</p><h2>Over to ' + esc(ns[seat]) + '.</h2><p>Pass the screen before revealing your hand. Your partner’s choice is safely locked away.</p>' + button('I’M READY →', 'uncover', 'gold') + '</div>';
  return html + '</section></div>';
}
function playingCard(card, selected = false, disabled = false, tilt = 0, reveal = false) {
  const label = ['','ACE','DEUCE','TREY','FOUR','FIVE'][card.value];
  return '<' + (reveal ? 'div' : 'button') + ' class="playing-card ' + (selected ? 'selected' : '') + '" ' + (reveal ? '' : 'data-action="select-card" data-card="' + esc(card.id) + '" aria-pressed="' + selected + '" aria-label="Bid ' + card.value + '" ' + (disabled ? 'disabled ' : '')) + 'style="--tilt:' + tilt + 'deg"><span class="rank">' + card.value + '</span><span class="suit" aria-hidden="true">' + ['','♠','♥','♣','♦','✦'][card.value] + '</span><span class="card-caption">' + label + '</span><span class="rank-bottom">' + card.value + '</span></' + (reveal ? 'div' : 'button') + '>';
}
function prizeCard(value, next = false, carry = 0) {
  return '<div class="prize-card ' + (next ? 'next-prize' : '') + '"><p class="zone-label">' + (next ? 'UP NEXT' : 'ON THE TABLE') + '</p>' + sprite('prize') + '<div class="prize-value">' + value + ' <small>PTS</small></div>' + (carry ? '<span class="carry-label">+' + carry + ' CARRY</span>' : '') + '</div>';
}
function statusInstruction(verb) {
  if (locked()) return 'Your choice is locked.<small>' + (otherLocked() ? 'Revealing both choices…' : 'Waiting for ' + esc(names()[1 - mySeat()]) + ' to choose.') + '</small>';
  return verb;
}
function renderBackhand(v) {
  const p = mySeat(), ns = names();
  if (v.phase === 'reveal') {
    const r = v.result;
    return '<div class="revealed-cards pop">' + r.played.map((card, i) => '<div class="reveal-seat">' + playingCard(card, false, false, 0, true) + '<p>' + esc(ns[i]) + ' played ' + card.value + '</p></div>').join('') + '</div><div class="result-banner"><h2>' + (r.winner === null ? 'A little suspense.' : esc(ns[r.winner]) + ' takes ' + r.value + '.') + '</h2><p>' + (r.winner === null ? 'The prize carries over. The next round just got interesting.' : 'The points are banked. The cards have changed hands.') + '</p></div><p class="table-instruction">Your bid is now in their hand.<small>Use the card they gave you on the next round.</small></p>' + nextControl();
  }
  const isLocked = locked();
  let html = '<div class="opponent-zone"><p class="zone-label">' + esc(ns[1 - p]) + ' · ' + (otherLocked() ? 'CHOICE LOCKED' : 'THINKING IT OVER') + '</p><div class="backs">' + v.hands[1 - p].map(() => '<span class="mini-back">' + sprite('back') + '</span>').join('') + '</div></div><div class="prize-zone">' + prizeCard(v.currentPrize + v.carry, false, v.carry) + (v.nextPrize !== null ? prizeCard(v.nextPrize, true) : '<p class="zone-label">LAST<br>PRIZE</p>') + '</div><p class="table-instruction" role="status">' + statusInstruction('How much power will you give away?<small>Higher card wins. Both cards change hands.</small>') + '</p><div class="hand" aria-label="Your hand">';
  html += v.hands[p].map((card, i) => playingCard(card, chosen === card.id, isLocked || blocked(), (i - 2) * 2)).join('');
  return html + '</div><div class="table-controls">' + button(isLocked ? 'CHOICE LOCKED ✓' : 'LOCK IN YOUR BID →', 'lock-card', '', !chosen || isLocked || blocked()) + '</div>';
}
function cubes(count, player, empty = 0) {
  return '<span class="cubes" aria-label="' + count + ' cubes">' + Array.from({length: count}, () => '<span class="cube p' + player + '"></span>').join('') + Array.from({length: empty}, () => '<span class="cube empty"></span>').join('') + '</span>';
}
function renderClosing(v) {
  const p = mySeat(), turn = v.turn === p && !blocked();
  const ns = names(), count = reserve(v, p), lots = v.auctions.filter(Boolean);
  if (source && !lots.some(lot => lot.id === source && lot.cubes[p])) source = null;
  const instruction = !turn ? esc(ns[v.turn]) + ' is making a move.<small>' + (v.phase === 'clock' ? 'They’ll advance a clock next.' : 'Watch where they put their cube.') + '</small>' : v.phase === 'bid' ? source ? 'Move your cube to another auction.<small>Then advance a different clock.</small>' : 'Put a cube where it matters.<small>Bid from your reserve, move an existing cube, or hold.</small>' : 'Time to move a different clock.<small>' + (v.invested && lots.length > 1 ? 'The auction you just invested in has to wait.' : 'Choose which auction comes closer to closing.') + '</small>';
  let html = '<div class="reserve-strip"><div><p class="reserve-title">YOUR RESERVE · ' + count + ' / 5</p>' + cubes(count, p, 5 - count) + '</div>' + (v.phase === 'bid' ? button(source ? 'USE RESERVE' : 'HOLD CUBES →', source ? 'reserve' : 'hold', 'outline compact', !turn) : '<span class="tag gold">ADVANCE A CLOCK</span>') + '</div><p class="table-instruction" role="status">' + instruction + '</p><div class="auctions">';
  for (const lot of v.auctions) {
    if (!lot) { html += '<div class="auction empty"><p class="zone-label">ALL SOLD<br><br>✦</p></div>'; continue; }
    const canTick = turn && v.phase === 'clock' && (lot.id !== v.invested || lots.length === 1);
    const canBid = turn && v.phase === 'bid' && (source ? source !== lot.id : count > 0);
    html += '<article class="auction ' + (source === lot.id ? 'source' : '') + '"><p class="lot-title">LOT ' + (Number(lot.id.slice(3)) + 1) + '</p>' + sprite('clock') + '<p class="lot-value">' + lot.value + ' PTS</p><div class="clock-track" aria-label="' + lot.clock + ' of 3 clock ticks">' + [0,1,2].map(i => '<span class="clock-tick ' + (i < lot.clock ? 'filled' : '') + '"></span>').join('') + '</div><div class="lot-bids">' + [0,1].map(i => '<span class="bid-count"><span class="cube p' + i + '"></span>' + lot.cubes[i] + '<br><small>' + (i === p ? 'YOU' : 'THEM') + '</small></span>').join('') + '</div><div class="lot-controls">' + (v.phase === 'bid' ? button(source === lot.id ? 'SOURCE CUBE' : source ? 'MOVE HERE' : 'BID +1', 'bid-cube', 'mint', !canBid, 'data-lot="' + lot.id + '"') + '<button class="text-button" data-action="move-source" data-lot="' + lot.id + '" ' + (!turn || !lot.cubes[p] ? 'disabled' : '') + '>Move my cube</button>' : button(lot.id === v.invested && lots.length > 1 ? 'MUST WAIT' : lot.clock === 2 ? 'CLOSE AUCTION' : 'TICK +1 →', 'tick', canTick && lot.clock === 2 ? 'gold' : 'dark', !canTick, 'data-lot="' + lot.id + '"')) + '</div><p class="auction-priority">' + (lot.first === null ? 'No tie priority yet' : (lot.first === p ? 'You win' : 'They win') + ' tied bids') + '</p></article>';
  }
  html += '</div>';
  if (v.result) html += '<div class="result-banner pop"><p>' + eventText(v.result) + ' All cubes returned to their reserves.</p></div>';
  return html;
}
function renderHeist(v) {
  const p = mySeat(), ns = names();
  if (v.phase === 'reveal') {
    const r = v.result;
    return '<div class="heist-vaults pop">' + r.defenses.map((kind, i) => '<div class="vault-box"><h3>' + esc(ns[i]) + ' PLAYED</h3>' + sprite(kind === 'alarm' ? 'clock' : 'back') + '<div class="loot-stack">' + kind.toUpperCase() + '</div><p class="guard-marker">' + r.gain[i] + ' coins banked this round</p></div>').join('') + '</div><div class="result-banner"><h2>' + (r.outcomes[p] === 'caught' ? 'Caught in the act.' : r.outcomes[p] === 'clean' ? 'A beautiful bluff call.' : 'Easy money, safely banked.') + '</h2><p>' + eventText(r) + '</p></div>' + nextControl();
  }
  let html = '<div class="heist-vaults">';
  for (const i of [p, 1 - p]) {
    const [outside, vault] = v.loot[i], alarmsUsed = v.used[i].filter(k => k === 'alarm').length;
    html += '<div class="vault-box"><h3>' + (i === p ? 'YOUR' : esc(ns[i]).toUpperCase() + '’S') + ' VAULT</h3>' + sprite('vault') + '<div class="loot-values"><span class="loot-stack"><small>OUTSIDE</small>' + outside.value + '</span><span class="loot-stack"><small>IN VAULT</small>' + vault.value + '</span></div><p class="guard-marker">' + (v.guards[i] ? 'DEFENSE LOCKED ✓' : 'CHOOSING A DEFENSE') + '<br>' + (3 - alarmsUsed) + ' alarms unspent</p></div>';
  }
  html += '</div><p class="table-instruction" role="status">' + statusInstruction(v.phase === 'guard' ? 'Set a defense. Sell the story.<small>Your higher-value loot stays in the vault.</small>' : 'Their vault looks awfully tempting.<small>Take the outside coins, or raid both piles.</small>') + '</p>';
  if (v.phase === 'guard') {
    html += '<div class="hand defenses" aria-label="Your defenses">' + v.hands[p].map((card, i) => '<button class="playing-card defense-card ' + card.kind + ' ' + (chosen === card.id ? 'selected' : '') + '" style="--tilt:' + (i - (v.hands[p].length - 1) / 2) * 1.5 + 'deg" data-action="select-card" data-card="' + card.id + '" aria-pressed="' + (chosen === card.id) + '" aria-label="Choose ' + card.kind + '" ' + (locked() || blocked() ? 'disabled' : '') + '><span class="rank">' + card.kind.toUpperCase() + '</span><span class="suit" aria-hidden="true">' + (card.kind === 'alarm' ? '⚑' : '✦') + '</span><span class="card-caption">' + (card.kind === 'alarm' ? 'REAL TRAP' : 'NO ALARM') + '</span></button>').join('') + '</div><div class="table-controls">' + button(locked() ? 'DEFENSE LOCKED ✓' : 'LOCK IN DEFENSE →', 'lock-card', 'gold', !chosen || locked() || blocked()) + '</div>';
  } else {
    const loot = v.loot[1 - p], total = loot[0].value + loot[1].value;
    html += '<div class="raid-options">' + ['safe', 'raid'].map(choice => '<button class="raid-option ' + (chosen === choice ? 'selected' : '') + '" data-action="select-raid" data-choice="' + choice + '" aria-pressed="' + (chosen === choice) + '" ' + (locked() || blocked() ? 'disabled' : '') + '><b>' + (choice === 'safe' ? 'EASY MONEY' : 'RAID THE VAULT') + '</b><small>' + (choice === 'safe' ? loot[0].value + ' coins, guaranteed.<br>They keep the vault.' : total + ' coins if it’s a bluff.<br>Zero if it’s an alarm.') + '</small></button>').join('') + '</div><div class="table-controls">' + button(locked() ? 'APPROACH LOCKED ✓' : 'LOCK IN APPROACH →', 'lock-raid', '', !chosen || locked() || blocked()) + '</div>';
  }
  return html;
}
function nextControl() {
  const ready = mode === 'async' && asyncClient.record.ready.includes(roomIndex());
  return '<div class="table-controls">' + button(ready ? 'WAITING FOR ' + esc(asyncClient.names.friend).toUpperCase() + ' ✓' : 'NEXT ROUND →', 'next', 'gold', ready || blocked()) + '</div>';
}
function renderEnd(v) {
  const win = winner(v), p = mySeat(), ns = names();
  const title = win === null ? 'An even match.' : mode === 'local' ? ns[win] + ' takes the table.' : win === p ? 'The table is yours.' : ns[win] + ' takes the table.';
  return '<div class="end-display pop">' + sprite('prize') + '<p class="eyebrow">A GOOD NIGHT FOR A REMATCH</p><h2>' + esc(title) + '</h2><div class="end-score">' + v.scores[0] + ' : ' + v.scores[1] + '</div><p>' + (v.type === 'backhand' && v.result?.discarded ? 'The final tied pot of ' + v.result.discarded + ' points was discarded.<br>' : '') + 'Same rivalry. Fresh shuffle?</p><div class="button-row">' + button('ONE MORE ROUND ↻', 'rematch', 'gold', blocked()) + button('CHOOSE A GAME', 'table-menu', 'dark') + '</div></div>';
}
function eventText(r) {
  const ns = names();
  if (r.kind === 'backhand') return 'Round ' + esc(r.round) + ': ' + r.played[0].value + ' vs ' + r.played[1].value + '. ' + (r.winner === null ? r.value + ' points carried over.' : esc(ns[r.winner]) + ' won ' + r.value + ' points.');
  if (r.kind === 'closing') return r.winner === null ? 'An empty auction closed; ' + r.value + ' points discarded.' : esc(ns[r.winner]) + ' won ' + r.value + ' points' + (r.cubes[0] === r.cubes[1] ? ' on first-bid priority.' : '.');
  const descriptions = {safe: 'took easy money', caught: 'hit an alarm', clean: 'called a bluff'};
  return esc(ns[0]) + ' ' + descriptions[r.outcomes[0]] + '; ' + esc(ns[1]) + ' ' + descriptions[r.outcomes[1]] + '. +' + r.gain[0] + ' / +' + r.gain[1] + ' coins.';
}

async function decideBot(state,player) {
  if(selectedOpponent!=='model')return botAction(playerView(state,player),player);
  if(aiError)throw new Error(aiError);
  const controller=new AbortController();aiController=controller;aiBusy=true;render();
  try {
    const result=await chooseTurn(describeTurn(state,player,aiMemory),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)]),gameId:matchId,role:'seat-'+player,round:state.round});
    if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
    aiMemory.push({round:state.round,phase:state.phase,action:result.action,rationale:result.rationale});aiMemory=aiMemory.slice(-6);
    return result.action;
  } catch(error){if(aiController===controller)aiError=error.name==='AbortError'?'AI paused. Retry when ready.':error.name==='TimeoutError'?'The AI took too long. Retry when ready.':error.message;throw error;}
  finally {if(aiController===controller){aiBusy=false;aiController=null;render();}}
}
function prepareBot() {
  if(mode!=='solo'||!game||['over','reveal'].includes(game.phase)||aiError)return;
  if(game.type==='closing'&&game.turn!==1)return;
  const key=game.type+'/'+game.round+'/'+game.phase+(game.type==='closing'?'/'+game.revision:'');
  if(key!==botContext){
    botContext=key;const state=playerView(game,1),epoch=generation;
    // Capture the redacted observation BEFORE the human locks a simultaneous choice.
    botPrepared=Promise.resolve().then(()=>decideBot(state,1));
    botPrepared.catch(()=>{if(epoch===generation)render();});
  }
}
function scheduleBot() {
  clearTimeout(botTimer);
  if(mode!=='solo'||!game||scene!=='game'||['over','reveal'].includes(game.phase)||aiError)return;
  prepareBot();
  const needsMove=game.type==='closing'?game.turn===1:game.type==='backhand'?game.pending[0]&&!game.pending[1]:game.phase==='guard'?game.guards[0]&&!game.guards[1]:game.raids[0]&&!game.raids[1];
  if(!needsMove)return;
  const epoch=generation,context=botContext;
  botTimer=setTimeout(async()=>{
    try {
      const action=await botPrepared;
      if(epoch!==generation||mode!=='solo'||scene!=='game'||context!==botContext||aiError)return;
      const previousPhase=game.phase;game=applyAction(game,1,action);afterOfflineMove(previousPhase);scheduleBot();
    } catch {if(epoch===generation)render();}
  },450);
}
function afterOfflineMove(previousPhase) {
  trackArcadeGame(matchId,'midnight-'+game.type,game,mode);
  if (game.phase !== previousPhase) { chosen = null; source = null; }
  if (game.phase === 'over' && countedGame !== game) {
    const win = winner(game);
    if (win !== null) offlineSeries[win]++;
    countedGame = game;
    sound(win === 0 ? 'win' : 'reveal');
  } else if (game.phase === 'reveal') sound('reveal');
  if (mode === 'local') {
    if (game.type === 'closing') seat = game.turn;
    else if (game.phase === 'reveal' || game.phase === 'over') { seat = 0; handoff = false; }
    else {
      const phaseChanged = previousPhase !== game.phase;
      if (phaseChanged) { seat = 0; handoff = true; }
      else { seat = 1 - seat; handoff = true; }
    }
  }
  prepareBot();
  render();
}
function startOffline(type, selectedMode) {
  clearTimeout(botTimer); generation++;stopAI();aiMemory=[];matchId=crypto.randomUUID();selectedOpponent=prefs.opponent==='model'?'model':'dealer';
  if (mode === 'async') friendSession()?.leaveRoomGame?.();
  asyncClient = null;
  mode = selectedMode; seat = 0; scene = 'game';
  game = createGame(type, crypto.getRandomValues(new Uint32Array(1))[0]);
  botContext = ''; botPrepared = null; countedGame = null; chosen = null; source = null;
  handoff = mode === 'local';
  prepareBot(); sound('deal'); render(); scheduleBot();
}
async function act(action) {
  if (handoff || blocked()) return;
  sound('tap');
  if (mode === 'async') { await asyncClient.move(action); return; }
  const previousPhase = game.phase;
  game = applyAction(game, action.kind === 'next' ? 0 : seat, action);
  afterOfflineMove(previousPhase);
  scheduleBot();
}
// Room games: the AI seat's view arrives only on the creator's page.
async function chooseRoomAI({seat: actor, view: observation, record}, {signal}) {
  const result = await chooseTurn(describeTurn(observation, actor, aiMemory), {signal, gameId: record.id, role: 'seat-' + actor, round: observation.round});
  aiMemory.push({round: observation.round, phase: observation.phase, action: result.action, rationale: result.rationale}); aiMemory = aiMemory.slice(-6);
  return result.action;
}
function modalHead(title, eyebrow = 'MIDNIGHT TABLE') {
  return '<div class="modal-head"><div><p class="eyebrow">' + eyebrow + '</p><h2 id="modal-title">' + title + '</h2></div><button class="close-button" data-action="close-modal" aria-label="Close dialog">×</button></div>';
}
function showRules() {
  const type = view()?.type || selectedGame, g = GAMES[type];
  const rules = {
    backhand: [
      'You each start with cards <strong>1–5</strong>. The current prize and the next prize are visible.',
      'Secretly choose one card. <strong>Higher number wins</strong> the prize.',
      '<strong>Exchange both played cards.</strong> Your strongest bid becomes their future weapon.',
      'A tie carries the prize into the next round. After <strong>nine rounds</strong>, the final tied pot is discarded. Most points wins.'
    ],
    closing: [
      'Three auctions are open. You have <strong>five reusable cubes</strong>.',
      'Add a reserve cube, move one of your cubes to another auction, or <strong>hold</strong>.',
      'Advance a <strong>different auction’s clock</strong>. At three ticks it closes. When only one auction remains, advance that one.',
      'Most cubes wins the prize. Ties go to the <strong>first bidder</strong>; their priority stays even if they move their cube. An empty auction awards nothing.',
      'All cubes return after an auction closes. Nine prizes, then the highest score wins.'
    ],
    heist: [
      'You have <strong>three alarms and three bluffs</strong> for five rounds. One defense stays unused.',
      'Each round, your higher-value loot goes in your vault. Set an alarm or bluff there, <strong>face down</strong>.',
      'Both defenses lock before either player chooses an approach. <strong>Easy money</strong> takes their outside coins; they keep their vault.',
      '<strong>Raid</strong> takes both piles if they bluffed. Hit an alarm and they keep both piles.',
      'Every defense is revealed and discarded, even after an easy-money choice. Most coins after five rounds wins.'
    ]
  };
  const examples = {
    backhand: 'A 1-point prize is up now; 3 points are next. Lose with a 2 against their 5, and you’ve just bought a powerful card for the next round.',
    closing: 'Lead one auction 2–1 with its clock at two. On your next turn, invest elsewhere and close your winning auction. Can they stop both of your plans?',
    heist: 'Their outside pile has 2 coins and their vault has 5. Take 2 safely, or raid for 7. How many of their alarms have you already seen?'
  };
  modalContent.innerHTML = modalHead(g.name, 'THE RULES / TWO MINUTES TOPS') + '<ol class="rules-list">' + rules[type].map(r => '<li>' + r + '</li>').join('') + '</ol><p class="rule-example">' + examples[type] + '</p>' + button('GOT IT. LET’S PLAY →', 'close-modal', 'gold');
  if (!modal.open) modal.showModal();
}

document.addEventListener('click', async event => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action = target.dataset.action;
  try {
    if(action==='ai-settings')openAISettings(()=>{if(mode==='async'){asyncClient.retryAI();return;}generation++;stopAI();botContext='';prepareBot();render();scheduleBot();});
    else if(action==='cancel-ai'){if(mode==='async'){asyncClient.aiController?.abort();return;}generation++;stopAI('AI paused. Retry when ready.');render();}
    else if(action==='retry-ai'){if(mode==='async'){asyncClient.retryAI();return;}stopAI();botContext='';prepareBot();render();scheduleBot();}
    else if(action==='table-chat')openFriendChat();
    else if (action === 'select-game') { selectedGame = target.dataset.game; sound('tap'); render(); }
    else if (action === 'start-solo') startOffline(selectedGame, 'solo');
    else if (action === 'start-local') startOffline(selectedGame, 'local');
    else if (action === 'select-card') { if (handoff || locked() || blocked()) return; chosen = target.dataset.card; sound('tap'); render(); }
    else if (action === 'select-raid') { if (handoff || locked() || blocked()) return; chosen = target.dataset.choice; sound('tap'); render(); }
    else if (action === 'lock-card') {
      if (!chosen) return;
      await act({kind: view().type === 'backhand' ? 'bid' : 'guard', card: chosen});
    } else if (action === 'lock-raid') { if (chosen) await act({kind: 'raid', choice: chosen}); }
    else if (action === 'next') { chosen = null; await act({kind: 'next'}); }
    else if (action === 'move-source') { source = source === target.dataset.lot ? null : target.dataset.lot; sound('tap'); render(); }
    else if (action === 'reserve') { source = null; render(); }
    else if (action === 'hold') await act({kind: 'skip'});
    else if (action === 'bid-cube') await act({kind: 'cube', to: target.dataset.lot, from: source});
    else if (action === 'tick') { source = null; await act({kind: 'tick', lot: target.dataset.lot}); }
    else if (action === 'uncover') { handoff = false; chosen = null; render(); }
    else if (action === 'rules') showRules();
    else if (action === 'table-menu') { scene = 'menu'; selectedGame = view().type;generation++;stopAI();botContext='';render(); }
    else if (action === 'resume') { scene = 'game';prepareBot();render();scheduleBot(); }
    else if (action === 'rematch') {
      if (mode === 'async') friendSession()?.openGameSetup('midnight', asyncClient.record.setup);
      else startOffline(view().type, mode);
    } else if (action === 'host') inviteFriendGame('midnight', friendSetup());
    else if (action === 'join') joinFriendRoom('midnight');
    else if (action === 'close-modal') modal.close();
  } catch (error) { notify(error.message); }
});
document.addEventListener('change', event => {
  if(event.target.id==='ai-opponent'){prefs.opponent=event.target.value;savePrefs();return;}
  if (event.target.id === 'player-name') {
    prefs.name = savePlayerName(event.target.value) || 'You'; savePrefs();
  }
});
document.addEventListener('keydown', event => {
  if (modal.open || handoff || scene !== 'game' || ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
  const v = view();
  if (!v || ['over','reveal'].includes(v.phase) || blocked()) return;
  if (/^[1-6]$/.test(event.key) && v.type !== 'closing' && v.phase !== 'raid' && !locked()) {
    const card = v.hands[mySeat()][Number(event.key) - 1];
    if (card) { chosen = card.id; render(); app.querySelector('.playing-card.selected')?.focus({preventScroll: true}); event.preventDefault(); }
  }
  if (event.key === 'Enter' && chosen && !locked() && (document.activeElement.tagName !== 'BUTTON' || ['select-card', 'select-raid'].includes(document.activeElement.dataset.action))) {
    const kind = v.type === 'backhand' ? 'bid' : v.phase === 'guard' ? 'guard' : 'raid';
    act(kind === 'raid' ? {kind, choice: chosen} : {kind, card: chosen}).catch(e => notify(e.message));
    event.preventDefault();
  }
});
modal.addEventListener('click', event => {
  if (event.target === modal) {
    const rect = modal.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close();
  }
});
function applySettings() {
  setSound(Boolean(prefs.sound));
  const soundButton = document.querySelector('#sound');
  soundButton.textContent = 'Sound ' + (prefs.sound ? 'ON' : 'OFF');
  soundButton.setAttribute('aria-label', prefs.sound ? 'Mute sound' : 'Enable sound');
  document.body.classList.toggle('no-fx', prefs.fx === false);
  document.querySelector('#effects').textContent = 'FX ' + (prefs.fx === false ? 'OFF' : 'ON');
}
document.querySelector('#sound').addEventListener('click', () => { prefs.sound = !prefs.sound; savePrefs(); applySettings(); sound('deal'); });
document.querySelector('#effects').addEventListener('click', () => { prefs.fx = prefs.fx === false; savePrefs(); applySettings(); });
document.querySelector('#fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else notify('Use your browser’s fullscreen control.');
  } catch { notify('Fullscreen is unavailable in this browser.'); }
});
window.addEventListener('pagehide', () => { stopAI(); clearTimeout(botTimer); });
applySettings(); render();

// Read-only diagnostics for browser playtests; no method can alter a game.
Object.defineProperty(window, '__midnight', {value: {
  get state() { return view() ? structuredClone(view()) : null; },
  get mode() { return mode; },
  get seat() { return mySeat(); }
}});

installThemeControls(document.querySelector('.top-actions'));

function friendSetup(){return mode==='async'?asyncClient.record.setup:{type:selectedGame,team:Boolean(prefs.team),opponent:prefs.opponent==='model'?'model':'dealer'};}
registerCheckpoint('midnight',{
  capture:()=>mode!=='async'&&game?{mode,seat:mySeat(),state:game,view:view(),team:false,members:[],series:offlineSeries,setup:friendSetup()}:null,
  restore(data){
    if(!data||!['solo','local','online'].includes(data.mode)||![0,1].includes(data.seat))throw new Error('Invalid saved table.');
    validateView(data.view);
    // Games with a friend now live in the room rather than in this browser.
    if(data.mode==='online'||!data.state)return;
    validateView(playerView(data.state,0));validateView(playerView(data.state,1));
    mode=data.mode;seat=data.seat;selectedGame=data.setup.type;
    game=data.state;offlineSeries=data.series;
    scene='game';chosen=null;source=null;handoff=mode==='local';render();
  },
});
registerFriendGame('midnight',{
  setup:friendSetup,
  startAsync(client){
    clearTimeout(botTimer);generation++;stopAI();game=null;asyncClient=client;mode='async';scene='game';handoff=false;lastViewKey='';chosen=null;source=null;
    const unsubscribe=client.subscribe(record=>{
      if(mode!=='async'||asyncClient!==client)return;
      const v=record.view,key=record.id+'/'+v.round+'/'+v.phase+'/'+v.revision;
      selectedGame=v.type;
      if(lastViewKey&&lastViewKey!==key){
        const phase=lastViewKey.split('/')[2];
        if(phase!==v.phase){chosen=null;source=null;}
        sound(v.phase==='over'?'win':v.phase==='reveal'?'reveal':phase!==v.phase?'deal':'tap');
      }
      lastViewKey=key;render();
    });
    window.addEventListener('pagehide',unsubscribe,{once:true});
  },
  chooseAI:chooseRoomAI,
});
