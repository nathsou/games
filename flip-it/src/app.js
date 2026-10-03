import {trackArcadeGame} from '../../shared/ai/usage.js';
import {installThemeControls} from '../../shared/theme.js';
import {loadAI} from '../../shared/ai/config.js';
import {chooseTurn} from '../../shared/ai/turn.js';
import {openAISettings,aiStatusHtml} from '../../shared/ai/panel.js';
import {describeTurn} from './ai.js';
import {DEFAULT_OPTIONS, OPTION_KEYS, optionsFor, createMatch, applyAction, playerView, availableLanes, legalActions, valueOf, reverseOf, setValue, previewMove} from './rules.js';
import {botAction} from './bot.js';
import {FlipSession, REACTIONS} from './session.js';
import {saveTable, loadTable, forgetTable} from './resume.js';
import {captureTable, animateMove, motionEnabled} from './effects.js';
import {PeerLink, decodePairing, makeLink, iceConfig} from './peer.js';
import {drawQR} from './qr.js';
import {setSound, sound} from './sound.js';

const app = document.querySelector('#app'), modal = document.querySelector('#modal'), modalContent = document.querySelector('#modal-content');
let prefs;
try { prefs = JSON.parse(localStorage.getItem('flip-it.preferences') || '{}'); } catch { prefs = {}; }
if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) prefs = {};
try { prefs.options = optionsFor(prefs.options); } catch { prefs.options = {...DEFAULT_OPTIONS}; }
let aiController=null,aiBusy=false,aiError='',offlineControllers=[],aiHistory=new Map(),matchId='';
let scene = 'menu', mode = 'solo', game = null, seat = 0, lane = 1, chosen = [], handoff = false, preview = false;
let session = null, peer = null, linkStatus = 'idle', botTimer = null, generation = 0, lastViewKey = '';
let pairKind = 'host', pairBusy = false, pairOut = '', pairError = '', pairMessage = '', pairingOpen = false;
let chatDraft = '', animating = false, renderedPosition = null, animationGeneration = 0;
let scanStream = null, scanTimer = null, scanGeneration = 0, canScan = false, toastTimer;
const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('flip-it-pairing') : null;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const optionInfo = {
  quickTurns: ['Quick turns', 'ON: one action each; choose either space.', 'OFF: two actions, right then left.'],
  compactDeck: ['Compact deck', 'ON: 24 cards, ranks 1–6.', 'OFF: 40 cards, ranks 1–10.'],
  lastChance: ['Last chance', 'ON: one reply to counter an empty hand.', 'OFF: empty your hand and win immediately.']
};
function button(label, action, className = '', disabled = false, attributes = '') {
  return '<button type="button" class="button ' + className + '" data-action="' + action + '" ' + (disabled ? 'disabled ' : '') + attributes + '>' + label + '</button>';
}
function savePrefs() { try { localStorage.setItem('flip-it.preferences', JSON.stringify(prefs)); } catch {} }
function name() { return typeof prefs.name === 'string' ? prefs.name.trim().slice(0, 24) || 'You' : 'You'; }
function aiPlayers(max=3,minimum=0) {
  const count=Math.max(minimum,Math.min(max,Number(prefs.aiCount)||0));
  return Array.from({length:count},(_,i)=>prefs.aiKinds?.[i]==='dealer'?'dealer':(prefs.aiKinds?.[i]==='model'?'model':prefs.opponent==='model'?'model':'dealer'));
}
function controllers() {return mode==='online'?session?.controllers||[]:offlineControllers;}
function names() {return mode==='online'?session?.names||['You','Friend']:offlineControllers.map((kind,i)=>kind==='human'?(i===0?name():'Partner'):(kind==='model'?'AI ':'Dealer ')+(i-(mode==='solo'?1:2)+1));}
function aiLobby(disabled=false) {
  const count=Math.min(4,Math.max(0,Number(prefs.aiCount)||0));
  return '<label class="label" for="ai-count">AI SEATS · UP TO FIVE PLAYERS TOTAL</label><select id="ai-count" '+(disabled?'disabled':'')+'>'+[0,1,2,3,4].map(n=>'<option value="'+n+'" '+(n===count?'selected':'')+'>'+n+(n===0?' · humans only / solo dealer':' opponent'+(n===1?'':'s'))+'</option>').join('')+'</select>'+Array.from({length:count},(_,i)=>'<label class="label" for="ai-kind-'+i+'">OPPONENT '+(i+1)+'</label><select id="ai-kind-'+i+'" data-ai-seat="'+i+'" '+(disabled?'disabled':'')+'><option value="model" '+((prefs.aiKinds?.[i]||prefs.opponent)==='model'?'selected':'')+'>AI · shared provider & model</option><option value="dealer" '+((prefs.aiKinds?.[i]||prefs.opponent)!=='model'?'selected':'')+'>Dealer · offline, no API calls</option></select>').join('')+'<p class="small">Two separate human seats leave room for three opponents. Team play shares one human seat. Solo always includes at least one opponent.</p>'+button('AI SETTINGS ↗','ai-settings','outline compact');
}
function stopAI(message='') {aiController?.abort();aiController=null;aiBusy=false;aiError=message;}
function mySeat() { return mode === 'online' ? session?.team ? 0 : session?.seat || 0 : seat; }
function view() { return mode === 'online' ? session?.view : game ? playerView(game, seat) : null; }
function connected() { return Boolean(peer?.connected && session?.readyForPlay); }
function blocked() { return animating || handoff || scene !== 'game' || mode === 'online' && (!connected() || session.movePending); }
function myTurn() { return view()?.phase === 'playing' && view().turn === mySeat() && !blocked(); }
function notify(message) {
  const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 4500);
}
function tag() {
  const label = mode === 'solo' ? (controllers().some(t=>t==='model')?'VS THE AI TABLE':'VS THE DEALER') : mode === 'local' ? 'PASS & PLAY' : connected() ? session.team ? 'TEAM CONNECTED' : 'FRIEND CONNECTED' : 'FRIEND OFFLINE';
  return '<span class="tag ' + (mode === 'online' && !connected() ? 'offline' : '') + '"><span class="dot"></span>' + label + '</span>';
}
function cardHtml(card, interactive = false, isPreview = false, tilt = 0) {
  const rank = isPreview ? reverseOf(card) : valueOf(card), next = isPreview ? valueOf(card) : reverseOf(card);
  const palette=['#c84768','#6853ae','#007f81','#cf782c','#b79a0b','#376ca4','#923b80','#388451','#b34b35','#4252ac'];
  const selected = chosen.includes(card.id);
  const attrs = interactive ? ' data-action="select-card" data-card="' + card.id + '" aria-pressed="' + selected + '" aria-label="Rank ' + rank + ', flips to ' + next + (selected ? ', selected' : '') + '" ' + (!myTurn() || isPreview ? 'disabled' : '') : ' role="img" aria-label="Rank ' + rank + ', flips to ' + next + '"';
  return '<' + (interactive ? 'button type="button"' : 'span') + ' data-visual-card="'+card.id+'" data-face="'+(isPreview ? 1-card.face : card.face)+'" class="flip-card ' + (selected && interactive ? 'selected ' : '') + (isPreview ? 'preview' : '') + '" style="--active-color:' + palette[(rank-1)%10] + ';--reverse-color:' + palette[(next-1)%10] + ';--tilt:' + tilt + 'deg"' + attrs + '><span class="card-face"><span class="card-rank ' + (rank===10?'ten':'') + '">' + rank + '</span><span class="card-emblem" aria-hidden="true">'+['✦','◆','✳','✹','✿','❖','✺','✸','♢','★'][(rank-1)%10]+'</span><span class="card-divider" aria-hidden="true">↕</span><span class="card-corner">' + rank + '<small>↕' + next + '</small></span><span class="card-rank other ' + (next===10?'ten':'') + '">' + next + '</span></span></' + (interactive ? 'button' : 'span') + '>';
}
function optionBadges(options) {
  return '<div class="match-options">' + OPTION_KEYS.map(key => '<span><i class="option-dot ' + (options[key] ? '' : 'off') + '"></i>' + optionInfo[key][0] + ': ' + (options[key] ? 'ON' : 'OFF') + '</span>').join('') + '</div>';
}
function render() {
  const current=view(), before=captureTable(app), position=current ? {revision:current.revision, round:current.round, moves:current.moves, seat:mySeat(), handoff, mode} : null;
  const changed=scene==='game' && !handoff && !renderedPosition?.handoff && position && renderedPosition && position.mode===renderedPosition.mode && position.seat===renderedPosition.seat && position.round===renderedPosition.round && position.moves===renderedPosition.moves+1 && position.revision===renderedPosition.revision+1;
  const animate=changed && motionEnabled();
  if (animate) animating=true;
  const inputFocus=document.activeElement?.id==='chat-input' ? {start:document.activeElement.selectionStart,end:document.activeElement.selectionEnd} : null;
  const focus = document.activeElement?.dataset;
  const remembered = focus?.action ? {...focus} : null;
  app.innerHTML = scene === 'menu' || !view() ? renderMenu() : renderGame();
  document.body.classList.toggle('in-game', scene==='game' && Boolean(view()));
  if (document.querySelector('#chat-list')) document.querySelector('#chat-list').scrollTop = document.querySelector('#chat-list').scrollHeight;
  renderedPosition=scene==='game' ? position : null;
  if (animate) {
    const token=++animationGeneration;
    animateMove(app,before,current.log.at(-1),mySeat()).finally(()=>{if (token!==animationGeneration)return;animating=false;render();scheduleBot();});
  }
  if (inputFocus) { const input=document.querySelector('#chat-input'); if(input&&!input.disabled){input.focus({preventScroll:true});input.setSelectionRange(inputFocus.start,inputFocus.end);} }
  if (remembered) {
    const match = [...app.querySelectorAll('[data-action]')].find(el => Object.entries(remembered).every(([k, v]) => el.dataset[k] === v));
    if (match && !match.disabled) match.focus({preventScroll:true});
  }
}
function renderMenu() {
  const online = mode === 'online' && connected(), guest = online && session.seat === 1;
  const options = guest ? session.view.options : prefs.options;
  const heroes = [{id:'hero1', ends:[1,5], face:0}, {id:'hero2', ends:[6,2], face:0}, {id:'hero3', ends:[3,4], face:0}];
  let html = '<div class="menu-layout"><section class="intro"><p class="eyebrow">THE DOUBLE-SIDED CARD DUEL</p><h1>Same hand.<br><em>New tricks.</em></h1><p class="intro-copy">Build a set. Leave it exposed. Hope they don’t have a better idea.<br>Every card has another side. Every move can flip the game.</p><div class="hero-art" aria-label="Illustrated double-value cards">' + heroes.map((c,i) => cardHtml(c, false, false, [-13,2,15][i])).join('') + '<span class="hero-stamp">FLIP THE ODDS</span></div><div class="feature-line"><div><b>Play a set.</b><span>Matching ranks.<br>A little calculated risk.</span></div><div><b>Turn the tables.</b><span>Beat a set and send it<br>back with a twist.</span></div><div><b>Flip your hand.</b><span>Your next good idea<br>might be upside down.</span></div></div><div class="menu-bottom"><span>First to two round wins.</span><button class="text-button" data-action="rules">How to play ↗</button></div></section><aside class="panel"><p class="eyebrow">MAKE IT YOUR MATCH</p><h2 class="panel-title">Deal yourself in.</h2><p class="small">Mix these three options however you like. They stay fixed for the whole match.</p><div class="option-list">';
  for (const key of OPTION_KEYS) html += '<label class="option" for="option-' + key + '"><input type="checkbox" id="option-' + key + '" data-option="' + key + '" ' + (options[key] ? 'checked ' : '') + (guest ? 'disabled ' : '') + '><span><b>' + optionInfo[key][0] + '</b><small>' + optionInfo[key][1] + '<br>' + optionInfo[key][2] + '</small></span></label>';
  html += '</div><details class="lobby-ai"><summary>Table options · AI & teams</summary>'+aiLobby(guest)+(!online?'<label class="team-choice"><input id="lobby-team" type="checkbox" '+(prefs.team?'checked':'')+'><span>Team up against the dealer<small>Turn on before inviting a friend.</small></span></label>':'')+'</details><label class="label" for="player-name">YOUR NAME</label><input id="player-name" maxlength="24" value="' + esc(name()) + '" autocomplete="nickname">';
  if (online) html += button(guest ? 'HOST CHOOSES THE NEXT MATCH' : 'DEAL A NEW MATCH →', 'deal-online', 'gold', guest) + button('LEAVE ONLINE TABLE', 'leave-online', 'outline');
  else html += button(aiPlayers(4,1).some(t=>t==='model')?'PLAY THE AI TABLE →':'PLAY THE DEALER →', 'start-solo') + button('PASS & PLAY', 'start-local', 'dark');
  if (view()) html += button('RESUME CURRENT MATCH', 'resume', 'outline');
  if (prefs.lastPlayer?.name && !online) html += '<div class="last-player"><span>LAST AT YOUR TABLE</span><strong>'+esc(prefs.lastPlayer.name)+'</strong>'+button('RECONNECT ↗','reconnect-last','outline compact')+'</div>';
  html += '<hr class="divider"><p class="small">A friend. Two screens. One table.</p>' + button(online ? 'CONNECTION DETAILS' : 'INVITE A FRIEND ↗', 'host', 'gold') + (!online ? button('JOIN A FRIEND', 'join', 'outline') : '') + '</aside></div>';
  return html;
}
function renderGame() {
  const v = view(), p = mySeat(), ns = names();
  let html = '<section class="game-heading"><div><p class="eyebrow">PLAY YOUR SIDE. FLIP YOUR FORTUNE.</p><h1>Flip it.</h1></div><div class="heading-actions">' + tag() + (mode==='online'?button('INVITE ↗','host','outline compact'):'') + button('RULES ?', 'rules', 'outline compact') + button('MENU', 'menu', 'outline compact') + '</div></section>';
  if (mode === 'online' && !connected()) html += '<div class="disconnect" role="status"><span>Your friend is offline. Reconnect to continue this saved match.</span>' + button(session.seat ? 'JOIN AGAIN' : 'RECONNECT', session.seat ? 'join' : 'host', 'compact gold') + '</div>';
  html += aiStatusHtml({busy:aiBusy,error:aiError,controller:mode!=='online'||session?.seat===0});
  html += '<div class="table-layout"><aside class="sidebar"><div class="panel"><p class="eyebrow">FIRST TO TWO</p><div class="scoreboard">';
  for (let i=0;i<v.hands.length;i++) html += '<div data-score-seat="'+i+'" class="score-seat ' + (v.turn === i && v.phase === 'playing' ? 'active' : '') + '"><div class="score-name"><b>' + esc(ns[i]) + '</b><span>' + (i === p ? '✦' : '◆') + '</span></div><div class="wins" aria-label="' + v.scores[i] + ' rounds won">' + [0,1].map(j => '<span class="win-dot ' + (j < v.scores[i] ? 'won' : '') + '"></span>').join('') + '</div></div>';
  html += '</div></div><div class="panel"><p class="eyebrow">THIS MATCH</p>' + optionBadges(v.options) + '</div><p class="sidebar-note"><b>The upright number counts.</b><br>The upside-down number becomes active after a flip.<br><br>Sets compete by size. A higher pair beats a lower pair, even if it’s your own.</p><p class="sidebar-note">' + (mode === 'online' && session.team ? 'You share a hand against the dealer. Either teammate can make the move.' : mode === 'local' ? 'Pass the screen when prompted. Hands are hidden between players.' : 'Select matching cards, then play or add. F flips your hand; Enter plays a selected set.') + '</p>' + renderSocial() + '</aside><section class="felt-table" aria-label="Flip it game table"><div class="table-meta"><span>ROUND ' + String(v.round+1).padStart(2,'0') + '</span><span class="bank" data-bank><i aria-hidden="true">▤</i> BANK <b>' + v.discardCount + '</b><small> / ' + (v.options.compactDeck ? '24' : '40') + '</small></span></div>';
  if (handoff) html += '<div class="handoff"><div class="card-back" aria-hidden="true"></div><p class="eyebrow">KEEP YOUR CARDS CLOSE</p><h2>Over to ' + esc(ns[seat]) + '.</h2><p>Pass the screen, then reveal your hand when you’re ready.</p>' + button('I’M READY →', 'uncover', 'gold') + '</div>';
  else if (v.phase !== 'playing') html += renderEnd(v);
  else html += renderTable(v);
  if (!handoff && v.log.length) html += '<div class="move-banner" role="status" aria-live="polite"><span>LAST MOVE</span><p>'+eventText(v.log.at(-1))+'</p></div><details class="journal"><summary>LAST MOVES · ' + v.moves + ' ACTIONS</summary><ol>' + v.log.map(event => '<li>' + eventText(event) + '</li>').join('') + '</ol></details>';
  return html + '</section></div>';
}
function chatEntries() {
  return session?.messages.length ? session.messages.map(e => '<li class="'+(e.kind==='reaction'?'reaction-entry':'')+'"><b>'+esc(session.members[e.seat])+'</b><span>'+esc(e.text)+'</span></li>').join('') : '<li class="chat-empty">A little friendly rivalry.<br>Say hello to your opponent.</li>';
}
function renderSocial() {
  if (mode!=='online') return '<div class="table-tip"><span>THE TRICK</span><p>Higher sets send lower sets back <b>flipped.</b> Play your other side wisely.</p></div>';
  return '<section class="table-chat"><div class="chat-heading"><span>TABLE TALK</span><i class="dot"></i></div><ol id="chat-list" aria-label="Table chat" aria-live="polite" aria-relevant="additions">'+chatEntries()+'</ol><form id="chat-form"><input id="chat-input" maxlength="240" value="'+esc(chatDraft)+'" placeholder="Say something…" aria-label="Chat message" autocomplete="off" '+(!connected()?'disabled':'')+'><button type="submit" aria-label="Send message" '+(!connected()?'disabled':'')+'>↗</button></form><div class="reactions" aria-label="Send a reaction">'+REACTIONS.map(r=>button(r,'reaction','',!connected(),'data-reaction="'+r+'" aria-label="React '+r+'"')).join('')+'</div><p class="chat-note">Just you and your friend.</p></section>';
}
function updateSocial(entry) {
  const list=document.querySelector('#chat-list');
  if (list) { list.innerHTML=chatEntries(); list.scrollTop=list.scrollHeight; }
  if (entry.kind==='reaction') {
    const bubble=document.createElement('div'); bubble.className='reaction-bubble'; bubble.textContent=entry.text; bubble.setAttribute('aria-hidden','true');
    document.querySelector('.felt-table')?.append(bubble); setTimeout(()=>bubble.remove(),1800);
  }
}
document.addEventListener('input', event => { if (event.target.id==='chat-input') chatDraft=event.target.value; });
document.addEventListener('submit', event => {
  if (event.target.id!=='chat-form') return; event.preventDefault();
  try { session.sendSocial('chat',chatDraft.trim()); chatDraft=''; document.querySelector('#chat-input').value=''; }
  catch(error) { notify(error.message); }
});
function actionValid(actions, action) {
  return actions.some(a => a.kind === action.kind && a.lane === action.lane && a.target === action.target && (a.targetSeat ?? (view().hands.length===2?1-mySeat():-1)) === (action.targetSeat ?? (view().hands.length===2?1-mySeat():-1)) && (!a.cards || a.cards.length === action.cards?.length && a.cards.every(id => action.cards.includes(id))));
}
function renderTable(v) {
  const p = mySeat(), ns = names(), turn = myTurn();
  if (!availableLanes(v).includes(lane)) lane = availableLanes(v)[0];
  const actions = turn ? legalActions(v, p) : [];
  const play = {kind:'play', lane, cards:chosen}, canPlay = actionValid(actions, play);
  let html = '<div class="rivals rivals-'+(v.hands.length-1)+'">';
  for (let other=0;other<v.hands.length;other++) {
    if(other===p)continue;
    html += '<div class="rival-zone"><div class="zone-title"><span>'+esc(ns[other])+(v.turn===other?' · TO PLAY':'')+'</span><span class="rival-hand" data-hand-seat="'+other+'"><span class="mini-fan" aria-hidden="true">'+Array.from({length:Math.min(v.hands[other].length,7)},()=>'<i class="mini-back"></i>').join('')+'</span>'+v.hands[other].length+' CARDS</span></div><div class="table-row">';
    for(let target=0;target<2;target++) {
      const set=v.table[other][target],owner=v.hands.length===2?{}:{targetSeat:other},add={kind:'add',lane,target,cards:chosen,...owner},take={kind:'take',lane,target,...owner};
      html += '<article data-space-seat="'+other+'" data-space-lane="'+target+'" class="play-space"><div class="space-header"><span>'+(target?'RIGHT':'LEFT')+' SPACE</span><strong>'+(set.length?set.length+' × '+setValue(set):'EMPTY')+'</strong></div><div class="space-cards">'+(set.length?set.map(c=>cardHtml(c)).join(''):'<span class="space-empty">✦</span>')+'</div><div class="space-controls">'+button('ADD 1','add','mint',!actionValid(actions,add)||preview,'data-target="'+target+'" data-owner="'+other+'"')+button('TAKE & FLIP','take','dark',!actionValid(actions,take)||preview,'data-target="'+target+'" data-owner="'+other+'"')+'</div></article>';
    }
    html += '</div></div>';
  }
  html += '</div>';
  if (v.pending !== null) html += '<div class="last-chance" role="status"><strong>LAST CHANCE!</strong> ' + (v.pending === p ? 'Your hand is empty. '+v.repliesRemaining+' '+(v.repliesRemaining===1?'reply remains.':'replies remain.') : esc(ns[v.pending])+' has an empty hand. Return cards to that player to stop the win.') + '</div>';
  html += '<p class="table-instruction" role="status">' + (animating ? 'Watch the cards.' : turn ? preview ? 'A peek at your other side.' : 'Your move.' : esc(ns[v.turn]) + ' is thinking…') + '<small>' + (turn ? v.options.quickTurns ? 'Select matching ranks. Play a set, or flip your hand.' : 'Use your ' + (v.beat ? 'right' : 'left') + ' space for this action.' : 'Watch their move. Plan your next flip.') + '</small></p><div class="zone-title"><span>YOUR PLAY SPACES</span><span>' + (v.options.quickTurns ? 'CHOOSE EITHER' : (v.opening ? 'OPENING ACTION' : 'ACTION ' + (v.beat ? 1 : 2) + ' / 2')) + '</span></div><div class="table-row">';
  for (let own=0;own<2;own++) {
    const set = v.table[p][own], canChoose = turn && availableLanes(v).includes(own);
    html += '<article data-space-seat="'+p+'" data-space-lane="'+own+'" class="play-space ' + (own === lane && turn ? 'chosen' : '') + '"><button type="button" class="space-select" data-action="lane" data-lane="' + own + '" aria-pressed="' + (own===lane) + '" ' + (!canChoose ? 'disabled' : '') + '>' + (own === lane && turn ? '● ' : '○ ') + (own ? 'RIGHT' : 'LEFT') + ' SPACE' + (set.length ? ' · ' + set.length + ' × ' + setValue(set) : '') + '</button><div class="space-cards">' + (set.length ? set.map(c => cardHtml(c)).join('') : '<span class="space-empty">↕</span>') + '</div><p class="cash-note">' + (set.length ? own === lane && turn ? 'These ' + set.length + ' cards leave on your move.' : 'Leave exposed, or cash out next.' : own === lane && turn ? 'Your new set will go here.' : 'An empty place for a new idea.') + '</p></article>';
  }
  const hand = v.hands[p].slice().sort((a,b) => (preview ? reverseOf(a)-reverseOf(b) : valueOf(a)-valueOf(b)) || a.id.localeCompare(b.id));
  html += '</div><div class="hand-tools"><span class="zone-title" style="margin:0">' + (preview ? 'AFTER A FLIP' : 'YOUR HAND') + ' · ' + hand.length + '</span><button class="text-button" data-action="preview" aria-pressed="' + preview + '">' + (preview ? 'Back to active ranks ↕' : 'Preview a flip ↕') + '</button></div><div class="hand" data-hand-seat="'+p+'" style="--hand-count:'+hand.length+'" aria-label="' + (preview ? 'Preview of flipped hand' : 'Your hand') + '">' + hand.map(c => cardHtml(c,true,preview)).join('') + '</div><div class="table-controls">' + button(chosen.length ? 'PLAY ' + chosen.length + ' CARD' + (chosen.length===1?'':'S') + ' →' : 'SELECT A MATCHING SET', 'play', '', !canPlay || preview) + button('FLIP MY HAND ↕', 'flip', 'gold', !turn || preview) + (chosen.length ? button('CLEAR', 'clear', 'outline compact') : '') + '</div>';
  let hint = 'Select cards with the same top rank. Add uses exactly one card.';
  if (preview) hint = 'Preview only. Return to active ranks to make your move.';
  else if (chosen.length && turn) {
    try {
      const impact = previewMove(v,p,play);
      hint = impact.event.returned.length ? impact.event.returned.map(r => (r.seat===p ? 'Your' : 'Their') + ' ' + r.count + ' cards return as ' + r.to.join(', ')).join('. ') + '.' : 'This set is legal. It stays exposed until you cash it out.';
    } catch { hint = 'Blocked at this size. Try fewer cards, another space, or add one to their set.'; }
  }
  return html + '<p class="move-hint">' + esc(hint) + '</p>';
}
function renderEnd(v) {
  const match = v.phase === 'matchOver', r = v.result, ns = names(), winner = match ? v.scores.indexOf(2) : r.winner;
  const title = winner === null ? 'A little stalemate.' : esc(ns[winner]) + (match ? ' takes the match.' : ' takes the round.');
  const reason = r.reason === 'repeat' ? 'The same position came around three times. Drawn round: shuffle and try again.' : r.reason === 'limit' ? 'A long back-and-forth. Drawn round: a fresh deal keeps things moving.' : r.reason === 'survived' ? 'The last-chance reply couldn’t put cards back in their hand.' : 'An empty hand. A well-earned round.';
  const ready = mode === 'online' && session.ready[session.seat], guest = mode === 'online' && session.seat === 1;
  return '<div class="ending pop"><div class="trophy" aria-hidden="true">✦</div><p class="eyebrow">' + (match ? 'GOOD COMPANY. GOOD GAME.' : 'A MOMENT TO CATCH YOUR BREATH.') + '</p><h2>' + title + '</h2><p>' + reason + '</p><div class="ending-score"><span>' + v.scores.join(' : ') + '</span></div>' + (match ? button(guest ? 'HOST CAN DEAL A REMATCH' : 'ONE MORE MATCH →', 'rematch', 'gold', guest || mode==='online' && !connected()) : button(ready ? 'WAITING FOR YOUR FRIEND…' : 'NEXT ROUND →', 'next', 'gold', ready || mode==='online' && !connected())) + button('CHANGE MATCH OPTIONS', 'menu', 'outline') + '</div>';
}
function eventText(e) {
  const who = esc(names()[e.seat]);
  let text = who + (e.kind==='flip' ? ' flipped their hand.' : e.kind==='take' ? ' took ' + e.count + ' cards and flipped them.' : e.kind==='add' ? ' added a ' + e.value + ' to '+esc(names()[e.targetSeat])+'’s set.' : ' played ' + e.count + ' × ' + e.value + '.');
  if (e.cashed) text += ' Cashed out ' + e.cashed + '.';
  if (e.returned.length) text += ' ' + e.returned.map(r => esc(names()[r.seat]) + ' received ' + r.count + ' flipped cards').join('; ') + '.';
  return text;
}
function resetSelection() { chosen = []; preview = false; if (view()) lane = availableLanes(view())[0]; }
function startOffline(nextMode, options = prefs.options) {
  clearTimeout(botTimer); generation++; stopAI(); aiHistory.clear();matchId=crypto.randomUUID();
  animating=false; animationGeneration++; renderedPosition=null;
  forgetTable(); const old=peer; peer=null; old?.close(); session=null; linkStatus='idle';
  mode=nextMode; seat=0; scene='game'; offlineControllers=[...Array(mode==='solo'?1:2).fill('human'),...aiPlayers(mode==='solo'?4:3,mode==='solo'?1:0)];
  game=createMatch(options,crypto.getRandomValues(new Uint32Array(1))[0],0,offlineControllers.length);
  handoff=mode==='local'; resetSelection(); sound('deal'); render(); scheduleBot();
}
function afterOfflineMove(previousTurn) {
  trackArcadeGame(matchId,'flip-it',game,mode);
  resetSelection();
  if (mode==='local' && game.phase==='playing' && offlineControllers[game.turn]==='human') { const oldSeat=seat;seat=game.turn;handoff=oldSeat!==seat; }
  if (game.phase==='matchOver') sound('win'); else if (game.phase==='roundOver') sound('reveal');
  render(); scheduleBot();
}
function act(action) {
  if (blocked()) return;
  sound(action.kind==='flip' ? 'deal' : 'tap');
  if (mode==='online') { session.choose(action); return; }
  const previousTurn=game.turn; game=applyAction(game,action.kind==='next'?0:seat,action);
  afterOfflineMove(previousTurn);
}
function scheduleBot() {
  clearTimeout(botTimer);
  const state=mode==='online'?session?.state:game;
  if(animating||scene!=='game'||!state||state.phase!=='playing'||controllers()[state.turn]==='human'||aiBusy||aiError||mode==='online'&&(session.seat||!connected()))return;
  const revision=state.revision,epoch=generation,actor=state.turn;
  botTimer=setTimeout(async()=>{
    if(generation!==epoch||scene!=='game')return;
    const current=mode==='online'?session?.state:game;
    if(!current||current.revision!==revision||mode==='online'&&!connected())return;
    const memoryKey=(mode==='online'?session.epoch:matchId)+'/'+current.round+'/'+actor;
    try {
      let action;
      if(controllers()[actor]==='model') {
        const controller=new AbortController();aiController=controller;aiBusy=true;render();
        const move=await chooseTurn(describeTurn(current,actor,aiHistory.get(memoryKey)||[]),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)]),gameId:mode==='online'?session.epoch:matchId,role:'seat-'+actor,round:current.round});
        if(controller.signal.aborted||generation!==epoch||scene!=='game'||(mode==='online'&&!connected())||(mode==='online'?session.state:game).revision!==revision)return;
        action=move.action;aiHistory.set(memoryKey,[...(aiHistory.get(memoryKey)||[]),{action,rationale:move.rationale}].slice(-6));
      } else action=botAction(playerView(current,actor),actor);
      aiBusy=false;aiController=null;
      if(mode==='online')session.botMove(actor,action);
      else {game=applyAction(game,actor,action);afterOfflineMove(actor);}
      sound('tap');scheduleBot();
    } catch(error) {aiBusy=false;aiController=null;if(generation!==epoch)return;aiError=error.name==='AbortError'?'AI paused. Retry when ready.':error.name==='TimeoutError'?'The AI took too long. Retry when ready.':error.message;render();}
  },450);
}
function restoreTable() {
  const saved = loadTable(); if (!saved) return;
  session = new FlipSession({seat:saved.seat, name:saved.members[saved.seat], team:saved.team, options:saved.view.options, onUpdate:updateOnline, onError:networkError, onSocial:updateSocial});
  Object.assign(session, {members:saved.members, controllers:saved.controllers, state:saved.state, view:saved.view});
  mode='online'; scene='game'; linkStatus='closed'; resetSelection();
}
function updateOnline() {
  if (!session?.view) return render();
  saveTable(session);
  prefs.lastPlayer = {name: session.members[1-session.seat], seat: session.seat, team: session.team}; savePrefs();
  if(session.seat===0)trackArcadeGame(session.epoch,'flip-it',session.state,session.team?'Online team':'Online duel');
  const key=session.epoch+'/'+session.view.revision;
  if (lastViewKey!==key) { resetSelection(); lastViewKey=key; sound(session.view.phase==='matchOver'?'win':'tap'); }
  scene='game'; handoff=false;
  if (pairingOpen && connected()) modal.close();
  render(); scheduleBot();
}
function networkError(error) { notify(error.message); render(); }
function makePeer(role,config) {
  const preserved=role===0 && mode==='online' && session?.seat===0 && session.state;
  const old=peer; peer=null; old?.close(); clearTimeout(botTimer); generation++;stopAI();aiHistory.clear();
  mode='online'; chosen=[]; preview=false; handoff=false;
  if (!preserved) { session=new FlipSession({seat:role,name:name(),options:prefs.options,team:role===0 && Boolean(prefs.team),aiPlayers:aiPlayers(prefs.team?4:3,prefs.team?1:0),onUpdate:updateOnline,onError:networkError,onSocial:updateSocial}); scene='menu'; }
  const link=new PeerLink({config,onMessage:message=>peer===link?session.receive(message):undefined,onStatus:status=>{
    if (peer!==link) return; linkStatus=status;
    if(!link.connected&&aiBusy){generation++;stopAI();}
    if ((status==='open'||status==='connected') && link.connected && !link.helloSent) { link.helloSent=true; session.opened(); }
    if (status==='invalid-message') { notify('An invalid connection message arrived. Reconnect to continue.'); link.close(); }
    if (pairingOpen) renderPair(); render(); scheduleBot();
  }});
  peer=link; session.setPeer(link); linkStatus='connecting'; return link;
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
function modalHead(title, eyebrow = 'FLIP IT') {
  return '<div class="modal-head"><div><p class="eyebrow">' + eyebrow + '</p><h2 id="modal-title">' + title + '</h2></div><button class="close-button" data-action="close-modal" aria-label="Close dialog">×</button></div>';
}
function settingsHtml() {
  return '<details class="connection-settings"><summary>Connection settings</summary><p>For different networks, STUN helps the browsers find each other. Some networks need a TURN relay. Leave STUN blank for a local-network connection. Use a relay if your network blocks a direct connection.</p><label class="label" for="stun">STUN ADDRESS</label><input id="stun" spellcheck="false" value="' + esc(Object.hasOwn(prefs, 'stun') ? prefs.stun : 'stun:stun.l.google.com:19302') + '"><label class="label" for="turn">OPTIONAL TURN RELAY</label><input id="turn" placeholder="turn:your-relay.example:3478" spellcheck="false"><label class="label" for="turn-name">RELAY USERNAME</label><input id="turn-name" autocomplete="off"><label class="label" for="turn-password">RELAY PASSWORD (THIS SESSION ONLY)</label><input id="turn-password" type="password" autocomplete="off"></details>';
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
  if (scanStream) stopScan();
  let html = modalHead(pairKind === 'return' ? 'Back to your table.' : pairKind === 'connected' ? 'Two seats, connected.' : pairKind === 'host' ? 'Invite your favorite rival.' : 'Pull up a chair.', 'PRIVATE TABLE / PEER-TO-PEER');
  if (pairKind === 'connected') {
    html += '<p class="modal-copy">You are connected directly to ' + esc(session.members[1 - session.seat]) + '. Keep both game tabs open while you play.</p>' + button('BACK TO THE TABLE →', 'close-modal', 'gold');
  } else if (pairKind === 'return') {
    html += '<p class="modal-copy">' + esc(pairMessage || 'Looking for your original hosting tab…') + '</p><p class="modal-copy">Return to the hosting tab. Paste the reply there, or reconnect from the saved table after a reload.</p><label class="label" for="pair-output">REPLY LINK</label><textarea id="pair-output" class="link-output" readonly>' + esc(pairOut) + '</textarea>' + button('COPY REPLY LINK', 'copy', 'gold') + button('BACK TO GAMES', 'close-modal', 'outline');
  } else {
    html += '<div class="pair-steps"><div class="pair-step ' + (!pairOut ? 'active' : '') + '">01<br>HOST SHARES AN INVITE</div><div class="pair-step ' + (pairOut ? 'active' : '') + '">02<br>GUEST SHARES A REPLY</div><div class="pair-step">03<br>HOST ACCEPTS. PLAY.</div></div>';
    if (pairKind === 'host') {
      if (pairOut) {
        html += '<p class="modal-copy">Send this invitation to your friend, or let them scan the QR code. Keep this tab open.</p><label class="label" for="pair-output">YOUR INVITATION</label><textarea id="pair-output" class="link-output" readonly spellcheck="false">' + esc(pairOut) + '</textarea><div class="button-row">' + button('COPY INVITE ↗', 'copy', 'gold') + button('SHARE', 'share', 'dark') + '</div><div class="qr-wrap"><canvas id="pair-qr" aria-label="Scan this invitation QR code"></canvas></div><p class="qr-note">Scan with your phone’s camera to open the invite.</p><hr class="divider"><label class="label" for="pair-input">PASTE YOUR FRIEND’S REPLY LINK</label><textarea id="pair-input" placeholder="Their reply link goes here…" spellcheck="false"></textarea>' + button(pairBusy ? 'CONNECTING…' : 'ACCEPT REPLY →', 'accept-reply', '', pairBusy) + (canScan ? button('SCAN REPLY QR', 'scan-reply', 'outline', pairBusy) : '');
      } else {
        html += '<p class="modal-copy">Send the invite. Your friend opens it and sends a reply. Paste that reply here to start playing.</p><p class="modal-copy"><strong>On the table:</strong> ' + 'Flip it' + '</p><label class="team-choice"><input type="checkbox" id="team" ' + (prefs.team ? 'checked' : '') + '> <span>Play together against the dealer<small>Share a hand, discuss the move, win as a team.</small></span></label>' + settingsHtml() + button(pairBusy ? 'PREPARING INVITATION…' : 'CREATE INVITATION ↗', 'create-invite', 'gold', pairBusy);
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
  } catch (error) { if (peer !== link) return; pairError = error.message; }
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
  } catch (error) { if (peer !== link) return; pairError = error.message; }
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
      const code = codes.find(c => c.rawValue.includes('FI1'));
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
  stopScan(); pairingOpen=false;
  const options=scene==='game' && view() ? view().options : prefs.options;
  modalContent.innerHTML=modalHead('A little twist.','FLIP IT / HOW TO PLAY')+'<ol class="rules-list"><li>Empty your hand to win a round. <strong>First to two round wins</strong> takes the match. The deck is dealt evenly clockwise; with an uneven deal, the extra cards rotate each round.</li><li>Each card has two ranks. <strong>The top rank is active.</strong> The upside-down rank tells you what it becomes after a flip. Rearranging your hand is free; changing orientation is an action.</li><li>'+(options.quickTurns?'Take <strong>one action each</strong>, alternating. Choose either of your two play spaces.':'Take <strong>two actions</strong>: right space, then left. The opening player gets only the right action. Starting player alternates each round.')+' Before your action, <strong>cash out the set in that space</strong>: those cards leave play.</li><li><strong>Play:</strong> select one or more cards with the same active rank. Put them in your chosen space. Your rank must beat every other set of the same size. Lower sets return to their owners’ hands <strong>flipped</strong>—including your own other set.</li><li><strong>Add:</strong> put exactly one matching card into an opponent’s set. Its new size must beat every other set of that size; those lower sets return flipped.</li><li><strong>Take:</strong> pick up an opponent’s entire set into your hand, flipping each card. <strong>Flip:</strong> rotate every card in your hand. Each uses your whole action.</li><li>'+(options.lastChance?'With <strong>Last chance ON</strong>, an empty hand gives each other player exactly one response, overriding the normal turn order. If your hand stays empty, you win. If multiple hands are empty, the first finisher has priority. A successful counter can give the responder their own last-chance window.':'With <strong>Last chance OFF</strong>, emptying your hand wins immediately.')+'</li><li>Three appearances of the same position draw the round. A round also draws after '+(options.compactDeck?'120':'180')+' actions. Nobody scores; redeal with the other player starting.</li></ol><p class="rule-example"><strong>A little example:</strong> their pair of 3s is exposed. Play two 5s to send the 3s back flipped. Or add one 3 to their pair: it becomes a triple, and might bounce another lower triple—even yours.</p>'+optionBadges(options)+button('GOT IT. LET’S PLAY →','close-modal','gold');
  if (!modal.open) modal.showModal();
}
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]'); if (!target || target.disabled) return;
  const action=target.dataset.action;
  try {
    if(action==='ai-settings')openAISettings(()=>{generation++;stopAI();render();scheduleBot();});
    else if(action==='cancel-ai'){generation++;stopAI('AI paused. Retry when ready.');render();}
    else if(action==='retry-ai'){stopAI();render();scheduleBot();}
    else if (action==='start-solo') startOffline('solo');
    else if (action==='start-local') startOffline('local');
    else if (action==='select-card') {
      if (!myTurn() || preview) return;
      const card=view().hands[mySeat()].find(c=>c.id===target.dataset.card);
      if (chosen.includes(card.id)) chosen=chosen.filter(id=>id!==card.id);
      else {
        if (chosen.length && valueOf(view().hands[mySeat()].find(c=>c.id===chosen[0]))!==valueOf(card)) chosen=[];
        chosen.push(card.id);
      }
      sound('tap'); render();
    } else if (action==='lane') { if (!myTurn()) return; lane=Number(target.dataset.lane); render(); }
    else if (action==='play') act({kind:'play',lane,cards:chosen});
    else if (action==='add') act({kind:'add',lane,target:Number(target.dataset.target),...(view().hands.length>2?{targetSeat:Number(target.dataset.owner)}:{}),cards:chosen});
    else if (action==='take') act({kind:'take',lane,target:Number(target.dataset.target),...(view().hands.length>2?{targetSeat:Number(target.dataset.owner)}:{})});
    else if (action==='flip') act({kind:'flip',lane});
    else if (action==='clear') { chosen=[]; render(); }
    else if (action==='preview') { preview=!preview; chosen=[]; render(); }
    else if (action==='uncover') { handoff=false; render(); }
    else if (action==='rules') showRules();
    else if (action==='menu') { event.preventDefault(); scene='menu'; clearTimeout(botTimer);generation++;stopAI();render(); }
    else if (action==='resume') { scene='game'; render(); scheduleBot(); }
    else if (action==='next') act({kind:'next'});
    else if (action==='rematch') {
      if (mode==='online') session.start(view().options);
      else startOffline(mode,view().options);
    } else if (action==='deal-online') {session.aiPlayers=aiPlayers(session.team?4:3,session.team?1:0);session.controllers=[...Array(session.team?1:2).fill('human'),...session.aiPlayers];generation++;stopAI();session.start(prefs.options);}
    else if (action==='leave-online') {
      clearTimeout(botTimer); generation++; const old=peer; peer=null; old?.close();
      forgetTable(); session=null; game=null; mode='solo'; scene='menu'; render();
    } else if (action==='host' || action==='join') { openPair(action); if (action==='host' && !peer?.connected && !pairOut) await createInvitation(); }
    else if (action==='reconnect-last') { openPair(prefs.lastPlayer?.seat ? 'join' : 'host'); if (!prefs.lastPlayer?.seat && !pairOut) await createInvitation(); }
    else if (action==='reaction') session?.sendSocial('reaction', target.dataset.reaction);
    else if (action==='create-invite') await createInvitation();
    else if (action==='join-invite') await joinInvitation(modal.querySelector('#pair-input').value);
    else if (action==='accept-reply') await acceptReply(modal.querySelector('#pair-input').value);
    else if (action==='copy') await copyOutput();
    else if (action==='share') {
      if (navigator.share) { try { await navigator.share({title:'Flip it',text:pairKind==='host'?'Your seat is waiting.':'Here’s my reply. Meet you at the table.',url:pairOut}); } catch(error) { if (error.name!=='AbortError') await copyOutput(); } }
      else await copyOutput();
    } else if (action==='close-modal') modal.close();
    else if (action==='cancel-pair') {
      stopScan(); const old=peer; peer=null; old?.close(); pairOut=''; pairBusy=false; pairError=''; pairMessage=''; linkStatus='idle';
      if (!session?.view) { mode='solo'; session=null; }
      modal.close(); render();
    } else if (action==='scan-invite') await scanCode('offer');
    else if (action==='scan-reply') await scanCode('answer');
    else if (action==='stop-scan') stopScan();
  } catch(error) {
    if (pairingOpen) { pairError=error.message; pairBusy=false; renderPair(); }
    else notify(error.message);
  }
});
document.addEventListener('change',event=>{
  if(event.target.id==='lobby-team'){prefs.team=event.target.checked;savePrefs();}
  else if(event.target.id==='ai-count'){prefs.aiCount=Number(event.target.value);prefs.aiKinds=Array.from({length:prefs.aiCount},(_,i)=>prefs.aiKinds?.[i]||'model');savePrefs();render();}
  else if(event.target.dataset.aiSeat!==undefined){prefs.aiKinds||=[];prefs.aiKinds[Number(event.target.dataset.aiSeat)]=event.target.value;savePrefs();}
  else if (event.target.dataset.option && OPTION_KEYS.includes(event.target.dataset.option)) {
    prefs.options[event.target.dataset.option]=event.target.checked; savePrefs();
  } else if (event.target.id==='player-name') {
    prefs.name=event.target.value.trim().slice(0,24)||'You'; savePrefs();
    if (mode==='online' && session) {
      session.members[session.seat]=name();
      if (connected()) { peer.send({type:'hello',name:name()}); if (!session.seat) session.sync(); }
    }
  }
});
document.addEventListener('keydown',event=>{
  if (modal.open || scene!=='game' || handoff || ['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (event.key==='Escape') { chosen=[]; preview=false; render(); return; }
  if (!myTurn() || preview) return;
  if (/^[0-9]$/.test(event.key)) {
    const rank=event.key==='0'?10:Number(event.key), cards=view().hands[mySeat()].filter(c=>valueOf(c)===rank).map(c=>c.id);
    if (cards.length) { chosen=cards.every(id=>chosen.includes(id))?[]:cards; render(); event.preventDefault(); }
  } else if (event.key.toLowerCase()==='f') { act({kind:'flip',lane}); event.preventDefault(); }
  else if (['ArrowLeft','ArrowRight'].includes(event.key) && view().options.quickTurns) { lane=event.key==='ArrowLeft'?0:1; render(); event.preventDefault(); }
  else if (event.key==='Enter' && chosen.length && (document.activeElement?.tagName!=='BUTTON' || document.activeElement.dataset.action==='select-card')) {
    try { act({kind:'play',lane,cards:chosen}); } catch(error) { notify(error.message); } event.preventDefault();
  }
});
modal.addEventListener('close',()=>{stopScan();pairingOpen=false;});
modal.addEventListener('click',event=>{
  if (event.target===modal) { const r=modal.getBoundingClientRect(); if (event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) modal.close(); }
});
function applySettings() {
  setSound(Boolean(prefs.sound));
  const soundButton=document.querySelector('#sound'); soundButton.textContent='Sound '+(prefs.sound?'ON':'OFF'); soundButton.setAttribute('aria-label',prefs.sound?'Mute sound':'Enable sound');
  document.body.classList.toggle('no-fx',prefs.fx===false); document.querySelector('#effects').textContent='FX '+(prefs.fx===false?'OFF':'ON');
}
document.querySelector('#sound').addEventListener('click',()=>{prefs.sound=!prefs.sound;savePrefs();applySettings();sound('deal');});
document.querySelector('#effects').addEventListener('click',()=>{prefs.fx=prefs.fx===false;savePrefs();applySettings();});
document.querySelector('.brand').dataset.action='menu';
bus?.addEventListener('message',async event=>{
  const message=event.data; if (!message || typeof message!=='object') return;
  if (message.type==='reply' && session?.seat===0 && peer && message.room===peer.room && !peer.connected) {
    try { await peer.accept(message.token); bus.postMessage({type:'reply-accepted',room:message.room}); pairMessage='Reply accepted. Connecting…'; if(pairingOpen)renderPair(); }
    catch(error) { notify(error.message); }
  } else if (message.type==='reply-accepted' && pairKind==='return') { pairMessage='Reply delivered. Your match is connecting in the original hosting tab. You can close this tab.'; renderPair(); }
});
async function handleHash() {
  const params=new URLSearchParams(location.hash.slice(1)), invite=params.get('invite'), reply=params.get('reply');
  if (!invite && !reply) return;
  history.replaceState(null,'',location.pathname+location.search);
  if (invite) {
    openPair('join'); modal.querySelector('#pair-input').value=makeLink(invite,'offer');
    try { await joinInvitation(invite); } catch(error) { pairError=error.message;pairBusy=false;renderPair(); }
  } else {
    try {
      const decoded=await decodePairing(reply,'answer');
      if (session?.seat===0 && peer?.room===decoded.room) { openPair('host'); await acceptReply(reply); }
      else {
        pairKind='return';pairOut=makeLink(reply,'answer');pairMessage=bus?'Looking for your original hosting tab…':'Paste this reply into your original hosting tab.';
        pairingOpen=true;renderPair();if(!modal.open)modal.showModal();bus?.postMessage({type:'reply',room:decoded.room,token:reply});
        setTimeout(()=>{if(pairKind==='return' && pairMessage.startsWith('Looking')) {pairMessage='Your hosting tab was not found here. Copy the reply and paste it into the original hosting tab. If it was closed, create a fresh invitation.';renderPair();}},2500);
      }
    } catch(error) {notify(error.message);}
  }
}
window.addEventListener('hashchange',handleHash);
window.addEventListener('pagehide',()=>{stopAI();stopScan();clearTimeout(botTimer);peer?.close();bus?.close();});
if (typeof BarcodeDetector!=='undefined' && navigator.mediaDevices?.getUserMedia) BarcodeDetector.getSupportedFormats().then(formats=>{canScan=formats.includes('qr_code');if(pairingOpen)renderPair();}).catch(()=>{});
restoreTable();applySettings();render();handleHash();
// Read-only, redacted diagnostics for browser playtests. No action or private
// host state is exported; tests must interact through the actual controls.
Object.defineProperty(window,'__flipit',{value:{
  get state(){return view()?structuredClone(view()):null;},
  get mode(){return mode;},get seat(){return mySeat();},get connected(){return connected();},get handoff(){return handoff;}
}});

installThemeControls(document.querySelector('.topbar nav'));
