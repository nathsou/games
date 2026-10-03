import {installThemeControls} from '../../shared/theme.js';
import {loadAI} from '../../shared/ai/config.js';
import {chooseTurn} from '../../shared/ai/turn.js';
import {openAISettings,aiStatusHtml} from '../../shared/ai/panel.js';
import {describeTurn} from './ai.js';
import {GAMES, createGame, applyAction, playerView, reserve, winner} from './rules.js';
import {botAction} from './bot.js';
import {PeerLink, decodePairing, makeLink, iceConfig} from './peer.js';
import {TableSession} from './session.js';
import {drawQR} from './qr.js';
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
let offlineSeries = [0, 0], countedGame = null, session = null, peer = null, linkStatus = 'idle', lastViewKey = '';
let pairKind = 'host', pairBusy = false, pairOut = '', pairError = '', pairMessage = '', pairingOpen = false;
let scanStream = null, scanTimer = null, scanGeneration = 0;
let toastTimer, canScan = false;
const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('midnight-table-pairing') : null;
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
function name() { return typeof prefs.name === 'string' ? prefs.name.slice(0, 24) || 'You' : 'You'; }
function opponentHtml(){return '<label class="label" for="ai-opponent">OPPONENT</label><select id="ai-opponent"><option value="dealer" '+(prefs.opponent!=='model'?'selected':'')+'>Dealer · offline, no API calls</option><option value="model" '+(prefs.opponent==='model'?'selected':'')+'>AI · shared provider & model</option></select>'+button('AI SETTINGS ↗','ai-settings','outline compact');}
function stopAI(message=''){aiController?.abort();aiController=null;aiBusy=false;aiError=message;}
function names() { return mode === 'online' ? session?.names || ['You', 'Partner'] : mode === 'solo' ? [name(), 'The Dealer'] : [name(), 'Partner']; }
function mySeat() { return mode === 'online' ? session.team ? 0 : session.seat : seat; }
function view() { return mode === 'online' ? session?.view : game ? playerView(game, seat) : null; }
function connected() { return Boolean(peer?.connected && session?.readyForPlay); }
function blocked() { return mode === 'online' && (!connected() || session.movePending); }
function locked() {
  const v = view(), p = mySeat();
  if (mode === 'online' && !session.team) return session.locked();
  return v.type === 'backhand' ? Boolean(v.pending[p]) : v.phase === 'guard' ? Boolean(v.guards[p]) : Boolean(v.raids[p]);
}
function otherLocked() {
  const v = view(), p = 1 - mySeat();
  if (mode === 'online' && !session.team) return session.locked(p);
  return v.type === 'backhand' ? Boolean(v.pending[p]) : v.phase === 'guard' ? Boolean(v.guards[p]) : Boolean(v.raids[p]);
}
function tag() {
  const label = mode === 'solo' ? 'VS THE DEALER' : mode === 'local' ? 'PASS & PLAY' : connected() ? session.team ? 'TEAM CONNECTED' : 'PEER CONNECTED' : linkStatus === 'idle' ? 'PRIVATE TABLE' : 'PARTNER OFFLINE';
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
  const online = mode === 'online' && connected();
  const host = online && session.seat === 0;
  let html = '<section class="menu-intro"><div><p class="eyebrow">THREE GAMES. TWO SEATS. ONE MORE ROUND.</p><h1>A little<br>friendly <em>rivalry.</em></h1></div><p class="intro-note">Small rules. Big “I knew you’d do that” energy.<br>Pick your game, pull up a chair, and keep the good times rolling.</p></section><div class="menu-layout"><div><section class="collection" aria-label="Choose a game">';
  Object.entries(GAMES).forEach(([id, g], i) => {
    html += '<button class="game-tile ' + (selectedGame === id ? 'selected' : '') + '" data-action="select-game" data-game="' + id + '" aria-pressed="' + (selectedGame === id) + '" aria-label="Select ' + g.name + '"><div class="tile-art ' + g.accent + '"><span class="tile-number">NO. 0' + (i + 1) + '</span>' + sprite(g.sprite) + '</div><div class="tile-body"><h2>' + g.name + '</h2><p>' + g.subtitle + '</p><div class="tile-meta"><span>' + g.time + '</span><b aria-hidden="true">' + (selectedGame === id ? '✦' : '↗') + '</b></div></div></button>';
  });
  html += '</section><p class="collection-note"><b>One table. Three ways to outsmart each other.</b><br>No accounts, no downloads. Just cards, coins, and suspiciously good timing.</p></div><aside class="panel join-panel" aria-label="Play options"><div><p class="eyebrow">TAKE A SEAT</p><h2 class="panel-title">' + GAMES[selectedGame].name + '</h2><p class="small">' + (online ? 'Your partner is at the table. ' + (host ? 'Choose a game and deal.' : 'The host will deal the next game.') : 'Learn the ropes with our dealer, or share a screen with someone.') + '</p>';
  if (online) html += button(host ? 'DEAL THE CARDS →' : 'WAITING FOR HOST', 'deal-online', 'gold', !host) + button('LEAVE TABLE', 'leave-online', 'outline');
  else html += opponentHtml() + button((prefs.opponent==='model'?'PLAY THE AI →':'PLAY THE DEALER →'), 'start-solo') + button('PASS & PLAY', 'start-local', 'dark');
  if (view() && view().phase !== 'over') html += button('RESUME CURRENT GAME', 'resume', 'outline');
  html += '</div><hr class="divider"><div><label class="label" for="player-name">YOUR NAME</label><input id="player-name" maxlength="24" value="' + esc(name()) + '" autocomplete="nickname" aria-label="Your name"><p class="small">Different screens? Meet at a private table. Your moves travel straight between you.</p>' + button(online ? 'CONNECTION DETAILS' : 'INVITE A FRIEND ↗', 'host', 'gold') + (online ? '' : button('JOIN A TABLE', 'join', 'outline')) + '</div><div class="menu-session">' + (online ? tag() : '<span class="dot"></span> No sign-in. No lobby server.') + '</div></aside></div>';
  return html;
}
function roundDots(v) {
  const done = v.type === 'closing' ? v.closed : v.round;
  return '<div class="round-dots" aria-label="' + done + ' rounds completed">' + Array.from({length: GAMES[v.type].rounds}, (_, i) => '<span class="round-dot ' + (i < done ? 'done' : i === done ? 'current' : '') + '"></span>').join('') + '</div>';
}
function renderGame() {
  const v = view(), p = mySeat(), ns = names(), g = GAMES[v.type];
  const series = mode === 'online' ? session.series : offlineSeries;
  const tips = {
    backhand: '<strong>Win now. Arm them for later.</strong><br>Every bid goes into your opponent’s hand. Losing a small prize can buy you a big opportunity.',
    closing: '<strong>Watch the other clocks.</strong><br>Invest in one auction, then advance a different one. First bidder wins tied bids—even after moving their cube.',
    heist: '<strong>Every defense gets spent.</strong><br>A safe choice still burns their defense. Watch the discarded alarms; they only started with three.'
  };
  let html = aiStatusHtml({busy:aiBusy,error:aiError,controller:mode!=='online'||session?.seat===0})+'<section class="table-heading"><div><p class="eyebrow">MIDNIGHT TABLE / NO. 0' + (Object.keys(GAMES).indexOf(v.type) + 1) + '</p><h1>' + g.name + '</h1></div><div class="heading-actions">' + tag() + button('RULES ?', 'rules', 'outline compact') + button('TABLE MENU', 'table-menu', 'outline compact') + '</div></section>';
  if (mode === 'online' && !connected()) html += '<div class="disconnected" role="status">Your partner’s connection is paused. Your table is saved in this tab.' + button(session.seat === 0 ? 'RECONNECT' : 'JOIN AGAIN', session.seat === 0 ? 'host' : 'join', 'compact gold') + '</div>';
  html += '<div class="table-layout"><aside class="sidebar"><div class="panel"><p class="eyebrow">THE SCORE</p><div class="scoreboard">';
  for (let i = 0; i < 2; i++) {
    html += '<div class="score-seat ' + (i === p ? 'you ' : '') + (v.type === 'closing' && v.turn === i && v.phase !== 'over' ? 'active' : '') + '"><div class="score-name"><b>' + esc(ns[i]) + '</b><span aria-hidden="true">' + (i ? '◆' : '✦') + '</span></div><div class="score-value">' + v.scores[i] + '<small> ' + (v.type === 'heist' ? 'COINS' : 'PTS') + '</small></div></div>';
  }
  html += '</div><p class="series">GAMES WON &nbsp; ' + series[0] + ' : ' + series[1] + '</p></div><div class="panel tips-panel"><p class="eyebrow">A LITTLE ADVICE</p><p class="sidebar-tip">' + tips[v.type] + '</p><hr class="divider"><p class="sidebar-tip">' + (v.type === 'closing' ? 'Gold cubes: ' + esc(ns[0]) + '<br>Coral cubes: ' + esc(ns[1]) : 'Choose first. Lock it in.<br>Then see what they were thinking.') + '</p></div><p class="sidebar-note">' + (mode === 'online' ? (session.team ? 'You share a hand and a score against the dealer. Either teammate can make the next move.' : 'Hands stay hidden during play. Simultaneous choices are locked before either is revealed.') : mode === 'local' ? 'Pass the screen when prompted. All choices are hidden until both players have locked in.' : 'The dealer chooses without peeking at your move. Keyboard: 1–5 selects a card; Enter locks it.') + '</p></aside><section class="felt-table" aria-label="' + g.name + ' game table"><div class="table-meta"><span>' + (v.type === 'closing' ? 'AUCTIONS ' + v.closed + ' / 9' : 'ROUND ' + String(v.round + 1).padStart(2, '0') + ' / ' + g.rounds) + '</span>' + roundDots(v) + '</div>';
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
  const ready = mode === 'online' && !session.team && session.ready[mySeat()];
  return '<div class="table-controls">' + button(ready ? 'WAITING FOR PARTNER ✓' : 'NEXT ROUND →', 'next', 'gold', ready || blocked()) + '</div>';
}
function renderEnd(v) {
  const win = winner(v), p = mySeat(), ns = names(), isHost = mode !== 'online' || session.seat === 0;
  const title = win === null ? 'An even match.' : mode === 'local' ? ns[win] + ' takes the table.' : win === p ? 'The table is yours.' : ns[win] + ' takes the table.';
  return '<div class="end-display pop">' + sprite('prize') + '<p class="eyebrow">A GOOD NIGHT FOR A REMATCH</p><h2>' + esc(title) + '</h2><div class="end-score">' + v.scores[0] + ' : ' + v.scores[1] + '</div><p>' + (v.type === 'backhand' && v.result?.discarded ? 'The final tied pot of ' + v.result.discarded + ' points was discarded.<br>' : '') + 'Same rivalry. Fresh shuffle?</p><div class="button-row">' + button(isHost ? 'ONE MORE ROUND ↻' : 'HOST DEALS THE REMATCH', 'rematch', 'gold', !isHost || blocked()) + button('CHOOSE A GAME', 'table-menu', 'dark') + '</div></div>';
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
    const result=await chooseTurn(describeTurn(state,player,aiMemory),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)]),gameId:mode==='online'?session?.epoch||matchId:matchId,role:'seat-'+player,round:state.round});
    if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
    aiMemory.push({round:state.round,phase:state.phase,action:result.action,rationale:result.rationale});aiMemory=aiMemory.slice(-6);
    return result.action;
  } catch(error){aiError=error.name==='AbortError'?'AI paused. Retry when ready.':error.name==='TimeoutError'?'The AI took too long. Retry when ready.':error.message;throw error;}
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
  if (peer) { const old = peer; peer = null; old.close(); }
  session = null; linkStatus = 'idle';
  mode = selectedMode; seat = 0; scene = 'game';
  game = createGame(type, crypto.getRandomValues(new Uint32Array(1))[0]);
  botContext = ''; botPrepared = null; countedGame = null; chosen = null; source = null;
  handoff = mode === 'local';
  prepareBot(); sound('deal'); render(); scheduleBot();
}
async function act(action) {
  if (handoff || blocked()) return;
  sound('tap');
  if (mode === 'online') { await session.choose(action); return; }
  const previousPhase = game.phase;
  game = applyAction(game, action.kind === 'next' ? 0 : seat, action);
  afterOfflineMove(previousPhase);
  scheduleBot();
}
function updateOnline() {
  if (!session?.view) return render();
  const v = session.view;
  const key = session.epoch + '/' + v.type + '/' + v.round + '/' + v.phase;
  if (lastViewKey !== key) {
    chosen = null; source = null;
    if (v.phase === 'over') sound('win'); else if (v.phase === 'reveal') sound('reveal'); else sound('deal');
    lastViewKey = key;
  }
  scene = 'game'; selectedGame = v.type; handoff = false;
  if (pairingOpen && connected()) { modal.close(); pairingOpen = false; }
  render();
}
function networkError(error) {
  notify('Table paused: ' + error.message);
  if (peer) peer.close();
  render();
}
function makePeer(role, config) {
  const preserved = role === 0 && mode === 'online' && session?.seat === 0 && session.state;
  if (peer) { const old = peer; peer = null; old.close(); }
  clearTimeout(botTimer); generation++;stopAI();aiMemory=[];matchId=crypto.randomUUID();selectedOpponent=prefs.opponent==='model'?'model':'dealer';
  mode = 'online'; chosen = null; source = null; handoff = false;
  if (!preserved) {
    session = new TableSession({seat: role, name: name(), team: role === 0 && Boolean(prefs.team), chooseBot:decideBot,onUpdate: updateOnline, onError: networkError});
    scene = 'menu';
  }
  session.initialGame = selectedGame;
  const link = new PeerLink({
    config,
    onMessage: message => peer === link ? session.receive(message) : undefined,
    onStatus: status => {
      if (peer !== link) return;
      linkStatus = status;
      if ((status === 'open' || status === 'connected') && link.connected && !link.helloSent) { link.helloSent = true; pairMessage = 'Connected. Pulling up your chair…'; session.opened(); }
      if (status === 'invalid-message') { notify('An invalid update was received. The table is paused.'); link.close(); }
      if (pairingOpen) renderPair();
      render();
    }
  });
  peer = link; session.setPeer(link); linkStatus = 'connecting';
  return link;
}
function readConfig() {
  if (!window.isSecureContext || !crypto.subtle) throw new Error('Online play needs HTTPS or localhost. Open the hosted game page, then create an invitation.');
  const stun = modal.querySelector('#stun')?.value ?? (Object.hasOwn(prefs, 'stun') ? prefs.stun : 'stun:stun.l.google.com:19302');
  const turn = modal.querySelector('#turn')?.value || '';
  const username = modal.querySelector('#turn-name')?.value || '';
  const credential = modal.querySelector('#turn-password')?.value || '';
  const config = iceConfig(stun, turn, username, credential);
  prefs.stun = stun; savePrefs();
  return config;
}
function modalHead(title, eyebrow = 'MIDNIGHT TABLE') {
  return '<div class="modal-head"><div><p class="eyebrow">' + eyebrow + '</p><h2 id="modal-title">' + title + '</h2></div><button class="close-button" data-action="close-modal" aria-label="Close dialog">×</button></div>';
}
function settingsHtml() {
  return '<details class="connection-settings"><summary>Connection settings</summary><p>For different networks, STUN helps the browsers find each other. Some networks need a TURN relay. Leave STUN blank for a local-network connection. These settings add no scripts or libraries.</p><label class="label" for="stun">STUN ADDRESS</label><input id="stun" spellcheck="false" value="' + esc(Object.hasOwn(prefs, 'stun') ? prefs.stun : 'stun:stun.l.google.com:19302') + '"><label class="label" for="turn">OPTIONAL TURN RELAY</label><input id="turn" placeholder="turn:your-relay.example:3478" spellcheck="false"><label class="label" for="turn-name">RELAY USERNAME</label><input id="turn-name" autocomplete="off"><label class="label" for="turn-password">RELAY PASSWORD (THIS SESSION ONLY)</label><input id="turn-password" type="password" autocomplete="off"></details>';
}
function openPair(kind) {
  pairKind = kind; pairError = ''; pairingOpen = true;
  if (!peer || (!peer.connected && peer.pc.signalingState !== 'have-local-offer' && session?.seat === 0) || linkStatus === 'closed' || linkStatus === 'failed' || !pairOut) { pairOut = ''; pairMessage = ''; pairBusy = false; }
  if (peer?.connected) pairKind = 'connected';
  else if (kind === 'join' && session?.seat === 0 && pairOut) pairOut = '';
  renderPair();
  if (!modal.open) modal.showModal();
}
function renderPair() {
  if (!pairingOpen) return;
  let html = modalHead(pairKind === 'return' ? 'Back to your table.' : pairKind === 'connected' ? 'Two seats, connected.' : pairKind === 'host' ? 'Invite your favorite rival.' : 'Pull up a chair.', 'PRIVATE TABLE / PEER-TO-PEER');
  if (pairKind === 'connected') {
    html += '<p class="modal-copy">You are connected directly to ' + esc(session.members[1 - session.seat]) + '. Keep both game tabs open while you play.</p>' + button('BACK TO THE TABLE →', 'close-modal', 'gold');
  } else if (pairKind === 'return') {
    html += '<p class="modal-copy">' + esc(pairMessage || 'Looking for your original hosting tab…') + '</p><p class="modal-copy">Keep the hosting tab open. If it cannot be found, paste the reply there or create a fresh invitation.</p><label class="label" for="pair-output">REPLY LINK</label><textarea id="pair-output" class="link-output" readonly>' + esc(pairOut) + '</textarea>' + button('COPY REPLY LINK', 'copy', 'gold') + button('BACK TO GAMES', 'close-modal', 'outline');
  } else {
    html += '<div class="pair-steps"><div class="pair-step ' + (!pairOut ? 'active' : '') + '">01<br>HOST SHARES AN INVITE</div><div class="pair-step ' + (pairOut ? 'active' : '') + '">02<br>GUEST SHARES A REPLY</div><div class="pair-step">03<br>HOST ACCEPTS. PLAY.</div></div>';
    if (pairKind === 'host') {
      if (pairOut) {
        html += '<p class="modal-copy">Send this invitation to your friend, or let them scan the QR code. Keep this tab open.</p><label class="label" for="pair-output">YOUR INVITATION</label><textarea id="pair-output" class="link-output" readonly spellcheck="false">' + esc(pairOut) + '</textarea><div class="button-row">' + button('COPY INVITE ↗', 'copy', 'gold') + button('SHARE', 'share', 'dark') + '</div><div class="qr-wrap"><canvas id="pair-qr" aria-label="Scan this invitation QR code"></canvas></div><p class="qr-note">Scan with your phone’s camera to open the invite.</p><hr class="divider"><label class="label" for="pair-input">PASTE YOUR FRIEND’S REPLY LINK</label><textarea id="pair-input" placeholder="Their reply link goes here…" spellcheck="false"></textarea>' + button(pairBusy ? 'CONNECTING…' : 'ACCEPT REPLY →', 'accept-reply', '', pairBusy) + (canScan ? button('SCAN REPLY QR', 'scan-reply', 'outline', pairBusy) : '');
      } else {
        html += '<p class="modal-copy">Choose a game, create an invitation, and send it to your friend. They’ll send one reply link back. Then your browsers connect directly.</p><p class="modal-copy"><strong>On the table:</strong> ' + GAMES[selectedGame].name + '</p><label class="team-choice"><input type="checkbox" id="team" ' + (prefs.team ? 'checked' : '') + '> <span>Play together against the dealer<small>Share a hand, discuss the move, win as a team.</small></span></label>' + opponentHtml() + settingsHtml() + button(pairBusy ? 'PREPARING INVITATION…' : 'CREATE INVITATION ↗', 'create-invite', 'gold', pairBusy);
      }
    } else {
      if (pairOut) {
        html += '<p class="modal-copy">Your chair is ready. Send this reply to the host. They can open it beside their hosting tab, paste it, or scan it.</p><label class="label" for="pair-output">YOUR REPLY LINK</label><textarea id="pair-output" class="link-output" readonly spellcheck="false">' + esc(pairOut) + '</textarea><div class="button-row">' + button('COPY REPLY ↗', 'copy', 'gold') + button('SHARE', 'share', 'dark') + '</div><div class="qr-wrap"><canvas id="pair-qr" aria-label="Scan this reply QR code"></canvas></div><p class="qr-note">Waiting for the host to accept. Keep this tab open.</p>';
      } else {
        html += '<p class="modal-copy">Open your friend’s invitation link, paste it below, or scan their invitation. No account needed.</p><label class="label" for="pair-input">INVITATION LINK</label><textarea id="pair-input" placeholder="Paste the invitation link here…" spellcheck="false"></textarea>' + settingsHtml() + button(pairBusy ? 'PREPARING YOUR REPLY…' : 'JOIN THIS TABLE →', 'join-invite', 'gold', pairBusy) + (canScan ? button('SCAN INVITATION QR', 'scan-invite', 'outline', pairBusy) : '');
      }
    }
    if (pairMessage) html += '<p class="modal-copy" role="status">' + esc(pairMessage) + '</p>';
    html += button('CANCEL SETUP', 'cancel-pair', 'outline');
  }
  if (pairError) html += '<p class="pair-error" role="alert">' + esc(pairError) + '</p>';
  modalContent.innerHTML = html;
  if (pairOut && modal.querySelector('#pair-qr')) {
    try { drawQR(modal.querySelector('#pair-qr'), pairOut); }
    catch (error) { modal.querySelector('.qr-wrap').remove(); const p = document.createElement('p'); p.className = 'qr-note'; p.textContent = error.message; modalContent.append(p); }
  }
}
async function createInvitation() {
  prefs.team = Boolean(modal.querySelector('#team')?.checked); savePrefs();
  const config = readConfig();
  pairBusy = true; pairError = ''; pairMessage = 'Finding a direct route. This can take a few seconds.';
  const link = makePeer(0, config);
  renderPair();
  try {
    const token = await link.invite();
    if (peer !== link) return;
    pairOut = makeLink(token, 'offer');
    pairMessage = 'Invitation ready. Share it, then accept the reply here.';
  } catch (error) { pairError = error.message; }
  pairBusy = false; renderPair(); render();
}
async function joinInvitation(input) {
  const config = readConfig();
  await decodePairing(input, 'offer'); // Validate before replacing any live connection.
  pairBusy = true; pairError = ''; pairMessage = 'Preparing your reply. This can take a few seconds.';
  const link = makePeer(1, config); renderPair();
  try {
    const token = await link.join(input);
    if (peer !== link) return;
    pairOut = makeLink(token, 'answer'); pairMessage = 'Send your reply to the host to finish connecting.';
  } catch (error) { pairError = error.message; }
  pairBusy = false; renderPair(); render();
}
async function acceptReply(input) {
  if (!peer || session?.seat !== 0) throw new Error('Open your hosting tab first, then paste the reply there.');
  pairBusy = true; pairError = ''; pairMessage = 'Connecting to your partner…'; renderPair();
  try { await peer.accept(input); }
  catch (error) { pairError = error.message; }
  pairBusy = false; renderPair();
}
async function copyOutput() {
  if (!pairOut) return;
  try { await navigator.clipboard.writeText(pairOut); }
  catch {
    const field = modal.querySelector('#pair-output');
    if (field) { field.focus(); field.select(); if (!document.execCommand('copy')) throw new Error('Select and copy the link above.'); }
    else throw new Error('Clipboard access is unavailable. Copy the reply from your address bar.');
  }
  notify(pairKind === 'host' ? 'Invitation copied. Send it to your friend.' : 'Reply copied. Send it back to the host.');
}
function stopScan() {
  scanGeneration++; clearTimeout(scanTimer);
  scanStream?.getTracks().forEach(track => track.stop()); scanStream = null;
  modal.querySelector('.scan-video')?.remove();
  modal.querySelector('[data-action="stop-scan"]')?.remove();
}
async function scanCode(target) {
  stopScan();
  if (!canScan) throw new Error('Use your phone camera to scan, or paste the link here.');
  const current = scanGeneration;
  const stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}}, audio: false});
  if (current !== scanGeneration || !modal.open) { stream.getTracks().forEach(t => t.stop()); return; }
  scanStream = stream;
  const video = document.createElement('video'); video.className = 'scan-video'; video.muted = true; video.playsInline = true; video.srcObject = scanStream;
  modalContent.append(video); modalContent.insertAdjacentHTML('beforeend', button('STOP CAMERA', 'stop-scan', 'outline'));
  await video.play();
  const detector = new BarcodeDetector({formats: ['qr_code']});
  async function detect() {
    if (current !== scanGeneration || !modal.open) return;
    try {
      const codes = await detector.detect(video);
      const code = codes.find(c => c.rawValue.includes('MT1'));
      if (code) {
        stopScan();
        if (target === 'offer') await joinInvitation(code.rawValue);
        else await acceptReply(code.rawValue);
        return;
      }
    } catch (error) { if (current === scanGeneration) { stopScan(); pairError = error.message; renderPair(); } return; }
    scanTimer = setTimeout(detect, 300);
  }
  detect();
}
function showRules() {
  stopScan(); pairingOpen = false;
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
    if(action==='ai-settings')openAISettings(()=>{generation++;stopAI();botContext='';if(session)session.botKey='';prepareBot();session?.prepareBot();render();scheduleBot();session?.scheduleBot();});
    else if(action==='cancel-ai'){generation++;stopAI('AI paused. Retry when ready.');render();}
    else if(action==='retry-ai'){stopAI();botContext='';if(session)session.botKey='';prepareBot();session?.prepareBot();render();scheduleBot();session?.scheduleBot();}
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
    else if (action === 'table-menu') { scene = 'menu'; selectedGame = view().type; render(); }
    else if (action === 'resume') { scene = 'game'; render(); scheduleBot(); }
    else if (action === 'rematch') {
      if (mode === 'online') session.start(view().type);
      else startOffline(view().type, mode);
    } else if (action === 'deal-online') session.start(selectedGame);
    else if (action === 'leave-online') {
      const old = peer; peer = null; old?.close(); session = null; mode = 'solo'; scene = 'menu'; game = null; render();
    } else if (action === 'host' || action === 'join') openPair(action);
    else if (action === 'create-invite') await createInvitation();
    else if (action === 'join-invite') await joinInvitation(modal.querySelector('#pair-input').value);
    else if (action === 'accept-reply') await acceptReply(modal.querySelector('#pair-input').value);
    else if (action === 'copy') await copyOutput();
    else if (action === 'share') {
      if (navigator.share) { try { await navigator.share({title: 'Midnight Table', text: pairKind === 'host' ? 'Your seat is waiting.' : 'Here’s my reply. Meet you at the table.', url: pairOut}); } catch (e) { if (e.name !== 'AbortError') await copyOutput(); } }
      else await copyOutput();
    } else if (action === 'close-modal') modal.close();
    else if (action === 'cancel-pair') {
      stopScan();
      const old = peer; peer = null; old?.close();
      pairOut = ''; pairBusy = false; pairError = ''; pairMessage = ''; linkStatus = 'idle';
      if (!session?.view) { mode = 'solo'; session = null; }
      modal.close(); render();
    } else if (action === 'scan-invite') await scanCode('offer');
    else if (action === 'scan-reply') await scanCode('answer');
    else if (action === 'stop-scan') stopScan();
  } catch (error) {
    if (pairingOpen) { pairError = error.message; pairBusy = false; renderPair(); }
    else notify(error.message);
  }
});
document.addEventListener('change', event => {
  if(event.target.id==='ai-opponent'){prefs.opponent=event.target.value;savePrefs();return;}
  if (event.target.id === 'player-name') {
    prefs.name = event.target.value.trim().slice(0, 24) || 'You'; savePrefs();
    if (mode === 'online' && session) {
      session.members[session.seat] = name();
      if (connected()) { peer.send({type: 'hello', name: name()}); if (session.seat === 0) session.sync(); }
    }
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
modal.addEventListener('close', () => { stopScan(); pairingOpen = false; });
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
bus?.addEventListener('message', async event => {
  const message = event.data;
  if (!message || typeof message !== 'object') return;
  if (message.type === 'reply' && session?.seat === 0 && peer && message.room === peer.room && !peer.connected) {
    try {
      await peer.accept(message.token);
      bus.postMessage({type: 'reply-accepted', room: message.room});
      pairMessage = 'Reply accepted. Connecting…'; if (pairingOpen) renderPair();
    } catch (error) { notify(error.message); }
  } else if (message.type === 'reply-accepted' && pairKind === 'return') {
    pairMessage = 'Reply delivered. Your game is connecting in the original hosting tab. You can close this tab.'; renderPair();
  }
});
async function handleHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const invite = params.get('invite'), reply = params.get('reply');
  if (!invite && !reply) return;
  history.replaceState(null, '', location.pathname + location.search);
  if (invite) {
    openPair('join');
    modal.querySelector('#pair-input').value = makeLink(invite, 'offer');
    try { await joinInvitation(invite); } catch (error) { pairError = error.message; pairBusy = false; renderPair(); }
  } else {
    try {
      const decoded = await decodePairing(reply, 'answer');
      if (session?.seat === 0 && peer?.room === decoded.room) { openPair('host'); await acceptReply(reply); }
      else {
        pairKind = 'return'; pairOut = makeLink(reply, 'answer'); pairMessage = bus ? 'Looking for your original hosting tab…' : 'Paste this reply into your original hosting tab.';
        pairingOpen = true; renderPair(); if (!modal.open) modal.showModal();
        bus?.postMessage({type: 'reply', room: decoded.room, token: reply});
        setTimeout(() => {
          if (pairKind === 'return' && pairMessage.startsWith('Looking')) {
            pairMessage = 'Your hosting tab was not found here. Copy the reply and paste it into the original hosting tab. If that tab was closed, create a fresh invitation.';
            renderPair();
          }
        }, 2500);
      }
    } catch (error) { notify(error.message); }
  }
}
window.addEventListener('hashchange', () => handleHash());
window.addEventListener('pagehide', () => {stopAI(); stopScan(); clearTimeout(botTimer); peer?.close(); bus?.close(); });
if (typeof BarcodeDetector !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
  BarcodeDetector.getSupportedFormats().then(formats => { canScan = formats.includes('qr_code'); if (pairingOpen) renderPair(); }).catch(() => {});
}
applySettings(); render(); handleHash();

// Read-only diagnostics for browser playtests; no method can alter a game.
Object.defineProperty(window, '__midnight', {value: {
  get state() { return view() ? structuredClone(view()) : null; },
  get mode() { return mode; },
  get seat() { return mySeat(); },
  get connected() { return connected(); }
}});

installThemeControls(document.querySelector('.top-actions'));
