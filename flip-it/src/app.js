import {updateHTML} from './dom.js';
let asyncClient=null;
import {registerCheckpoint} from '../../shared/game-checkpoint.js';
import {validateCheckpoint} from './checkpoint.js';
import {friendSession, registerFriendGame, inviteFriendGame, joinFriendRoom, openFriendChat} from '../../shared/friend-context.js';
import {loadPlayerName, savePlayerName} from '../../shared/player-name.js';
import {trackArcadeGame} from '../../shared/ai/usage.js';
import {installThemeControls,saveTheme,THEME_KEY} from '../../shared/theme.js';
import {loadAI} from '../../shared/ai/config.js';
import {chooseTurn} from '../../shared/ai/turn.js';
import {openAISettings,aiStatusHtml} from '../../shared/ai/panel.js';
import {describeTurn} from './ai.js';
import {DEFAULT_OPTIONS, OPTION_KEYS, optionsFor, createMatch, applyAction, playerView, availableLanes, legalActions, valueOf, reverseOf, setValue, previewMove} from './rules.js';
import {botAction} from './bot.js';
import {ReplayStore,highlights} from './replays.js';
import {captureTable, animateMove, cancelMotion, motionEnabled} from './effects.js';
import {setSound, sound} from './sound.js';

const app = document.querySelector('#app'), modal = document.querySelector('#modal'), modalContent = document.querySelector('#modal-content');
let prefs;
try { prefs = JSON.parse(localStorage.getItem('flip-it.preferences') || '{}'); } catch { prefs = {}; }
if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) prefs = {};
try { prefs.options = optionsFor(prefs.options); } catch { prefs.options = {...DEFAULT_OPTIONS}; }
let aiController=null,aiBusy=false,aiError='',offlineControllers=[],aiHistory=new Map(),matchId='';
let scene = 'menu', mode = 'solo', game = null, seat = 0, lane = 1, chosen = [], handoff = false, preview = false;
let botTimer = null, generation = 0, lastViewKey = '';
const replayStore=new ReplayStore();
let replayOpen=false,replayRecord=null,replayIndex=0,replayTimer=null,replayOnlyHighlights=false,storageNotified=false,replayPosition=null;
let expandedSet=null;
let animating = false, renderedPosition = null, animationGeneration = 0;
let toastTimer;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const optionInfo = {
  quickTurns: ['Quick turns', 'ON: one action each, one play space.', 'OFF: two actions, right then left.'],
  compactDeck: ['Compact deck', 'ON: 24 cards, ranks 1–6.', 'OFF: 40 cards, ranks 1–10.'],
  lastChance: ['Last chance', 'ON: one reply to counter an empty hand.', 'OFF: empty your hand and win immediately.']
};
function button(label, action, className = '', disabled = false, attributes = '') {
  return '<button type="button" class="button ' + className + '" data-action="' + action + '" ' + (disabled ? 'disabled ' : '') + attributes + '>' + label + '</button>';
}
function savePrefs() { try { localStorage.setItem('flip-it.preferences', JSON.stringify(prefs)); } catch {} }
function name() { return loadPlayerName() || (typeof prefs.name === 'string' ? prefs.name.trim().slice(0, 24) || 'You' : 'You'); }
function aiPlayers(max=3,minimum=0,online=false) {
  const saved=online?prefs.onlineAiCount:prefs.aiCount, kinds=online?prefs.onlineAiKinds:prefs.aiKinds;
  const fallback=online?0:localHumans()===1?1:0;
  const count=Math.max(minimum,Math.min(max,Number.isInteger(saved)?saved:fallback));
  return Array.from({length:count},(_,i)=>kinds?.[i]==='model'?'model':kinds?.[i]==='dealer'?'dealer':!online&&prefs.opponent==='model'?'model':'dealer');
}
// Room seats belong to a person ('host', 'guest', or 'team' for both) or an AI.
function controllers() {if(mode==='async')return asyncClient.record.controllers.map(kind=>['host','guest','team'].includes(kind)?'human':kind);return offlineControllers;}
function names() {
  if(mode==='async'){
    const {me,friend}=asyncClient.names,seats=asyncClient.record.controllers,humans=seats.filter(kind=>['host','guest','team'].includes(kind)).length;
    return seats.map((kind,i)=>kind==='team'?(me+' & '+friend).slice(0,40):['host','guest'].includes(kind)?(i===mySeat()?me:friend):(kind==='model'?'AI ':'Bot ')+(i-humans+1));
  }
  return offlineControllers.map((kind,i)=>kind==='human'?(mode==='local'&&name()==='You'?'Player '+(i+1):(i===0?name():'Partner')):(kind==='model'?'AI ':'Bot ')+(i-(mode==='solo'?1:2)+1));
}
function roomIndex() { return asyncClient?.session.role==='host'?0:1; }
function localHumans(){return prefs.localHumans===2?2:1;}
function aiLobby() {
  const humans=localHumans(),kinds=aiPlayers(5-humans),count=kinds.length;
  return '<label class="label" for="table-humans">PLAYERS ON THIS DEVICE</label><select id="table-humans"><option value="1" '+(humans===1?'selected':'')+'>1 · just me</option><option value="2" '+(humans===2?'selected':'')+'>2 · share this device</option></select>'+
    '<label class="label" for="ai-count">BOT / AI OPPONENTS · UP TO FIVE PLAYERS TOTAL</label><select id="ai-count">'+Array.from({length:6-humans},(_,n)=>'<option value="'+n+'" '+(n===count?'selected':'')+'>'+n+(n===0?' · humans only':' opponent'+(n===1?'':'s'))+'</option>').join('')+'</select>'+Array.from({length:count},(_,i)=>'<label class="label" for="ai-kind-'+i+'">OPPONENT '+(i+1)+'</label><select id="ai-kind-'+i+'" data-ai-seat="'+i+'"><option value="model" '+(kinds[i]==='model'?'selected':'')+'>AI · shared provider & model</option><option value="dealer" '+(kinds[i]!=='model'?'selected':'')+'>Bot · offline, no API calls</option></select>').join('')+'<p class="small">With zero bots, play with a friend or choose two players on this device.</p>'+(count?button('AI SETTINGS ↗','ai-settings','outline compact'):'');
}
function stopAI(message='') {aiController?.abort();aiController=null;aiBusy=false;aiError=message;}
function mySeat() { return mode==='async' ? asyncClient.record.seat : seat; }
function view() { if(mode==='async')return asyncClient.record.view;return game ? playerView(game, seat) : null; }
function blocked() { return mode==='async'&&asyncClient.busy || animating || handoff || scene !== 'game'; }
function myTurn() { return view()?.phase === 'playing' && view().turn === mySeat() && !blocked(); }
function notify(message) {
  const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 4500);
}
function cardHtml(card, interactive = false, isPreview = false, tilt = 0) {
  const rank = isPreview ? reverseOf(card) : valueOf(card), next = isPreview ? valueOf(card) : reverseOf(card);
  const palette=['#ff5a5f','#ffb62e','#8bd44a','#2fc9e0','#4f8bff','#a56bff','#ff6fb5','#ff8a3d','#3ed6a3','#8a97b8'];
  const selected = chosen.includes(card.id);
  const attrs = interactive ? ' data-action="select-card" data-card="' + card.id + '" aria-pressed="' + selected + '" aria-label="Rank ' + rank + ', flips to ' + next + (card.star?', starred card':'') + (selected ? ', selected' : '') + '" ' + (!myTurn() || isPreview ? 'disabled' : '') : ' role="img" aria-label="Rank ' + rank + ', flips to ' + next + (card.star?', starred card':'') + '"';
  return '<' + (interactive ? 'button type="button"' : 'span') + ' data-visual-card="'+card.id+'" data-face="'+(isPreview ? 1-card.face : card.face)+'" class="flip-card ' + (selected && interactive ? 'selected ' : '') + (isPreview ? 'preview' : '') + '" style="--active-color:' + palette[(rank-1)%10] + ';--reverse-color:' + palette[(next-1)%10] + ';--tilt:' + tilt + 'deg"' + attrs + '><span class="card-face"><span class="card-rank ' + (rank===10?'ten':'') + '">' + rank + '</span><span class="card-emblem" aria-hidden="true">'+['●','◆','✳','✹','✿','❖','✺','✸','♢','♜'][(rank-1)%10]+'</span><span class="card-divider" aria-hidden="true">↕</span><span class="card-corner">' + rank + '<small>↕' + next + '</small></span><span class="card-rank other ' + (next===10?'ten':'') + '">' + next + '</span>'+(card.star?'<span class="starter-star" aria-hidden="true">★</span>':'')+'</span></' + (interactive ? 'button' : 'span') + '>';
}
function starterHtml(v,ns){
  return Number.isInteger(v.firstPlayer)?'<span class="round-starter" title="'+esc(ns[v.firstPlayer])+' was dealt the starred card and starts this round">★ '+esc(ns[v.firstPlayer])+' STARTS</span>':'';
}
function goalText(options){return (options.target||2)===1?'Single game':'First to '+(options.target||2)+' wins';}
function optionBadges(options) {
  return '<div class="match-options"><span>'+ (options.quickTurns?'Quick turns':'Double turns')+'</span><span>'+(options.compactDeck?'24 cards':'40 cards')+'</span><span>'+(options.lastChance?'Last chance':'Sudden win')+'</span><span>'+goalText(options)+'</span></div>';
}
function tableControls(){return '<div class="hud-nav">'+button('Rules','rules','coral')+button(prefs.table==='wood'?'Felt':'Wood','table-style','pink')+button(document.documentElement.dataset.colorTheme==='light'?'Night':'Day','theme-toggle','gold')+'</div>';}
function showTableSettings(){
  modal.dataset.kind='table-settings';
  modalContent.innerHTML=modalHead('Table settings','PLAYERS & BOTS')+aiLobby()+button('Done','close-modal');
  if(!modal.open)modal.showModal();
}
function showHouseRules(){
  modal.dataset.kind='house-rules';
  const disabled=false,options=prefs.options;
  const groups=[['quickTurns','Turns','Quick','Double','One action each, one play space.','Two actions: right, then left. The opener plays only right.'],['compactDeck','Deck','24 cards','40 cards','Ranks 1–6. A smaller, quicker deck.','Ranks 1–10. More cards, more possibilities.'],['lastChance','Ending','Last chance','Sudden win','Every rival gets one reply to an empty hand.','An empty hand wins the round immediately.']];
  modalContent.innerHTML=modalHead('House rules','FIXED ONCE DEALT')+groups.map(([key,title,on,off,yes,no])=>'<section class="rule-setting" role="group" aria-label="'+title+'"><label>'+title+'</label><div class="segmented">'+[true,false].map(value=>button(value?on:off,'house-option',options[key]===value?'selected':'dark',disabled,'data-key="'+key+'" data-value="'+value+'" aria-pressed="'+(options[key]===value)+'"')).join('')+'</div><p>'+ (options[key]?yes:no)+'</p></section>').join('')+'<section class="rule-setting" role="group" aria-label="Match length"><label>Match length</label><div class="segmented">'+[1,2,3,4,5].map(n=>button(String(n),'match-target',(options.target||2)===n?'mint':'dark',disabled,'data-target="'+n+'" aria-pressed="'+((options.target||2)===n)+'"')).join('')+'</div><p>'+((options.target||2)===1?'Single game: one round decides the match.':'First to '+(options.target||2)+' round wins takes the match.')+'</p></section><p class="small">Changes apply to the next match. '+goalText(options)+'.</p>'+button('Done','close-modal');
  if(!modal.open)modal.showModal();
}
function render() {
  recordView();
  const current=view(), position=current ? {revision:current.revision, round:current.round, moves:current.moves, seat:mySeat(), handoff, mode} : null;
  const changed=scene==='game' && !handoff && !renderedPosition?.handoff && position && renderedPosition && position.mode===renderedPosition.mode && position.seat===renderedPosition.seat && position.round===renderedPosition.round && position.moves===renderedPosition.moves+1 && position.revision===renderedPosition.revision+1;
  const animate=changed && motionEnabled();
  const before = animate ? captureTable(app) : null;
  if (animate) animating=true;
  const focus = document.activeElement?.dataset;
  const remembered = focus?.action ? {...focus} : null;
  updateHTML(app, scene === 'menu' || !view() ? renderMenu() : renderGame());
  document.body.classList.toggle('in-game', scene==='game' && Boolean(view()));
  if(modal.open&&modal.dataset.kind==='set-details')renderSetDetails();
  renderedPosition=scene==='game' ? position : null;
  if (animate) {
    const token=++animationGeneration;
    animateMove(app,before,current.log.at(-1),mySeat(),current).finally(()=>{if (token!==animationGeneration)return;animating=false;render();scheduleBot();});
  }
  if (remembered) {
    const match = [...app.querySelectorAll('[data-action]')].find(el => Object.entries(remembered).every(([k, v]) => el.dataset[k] === v));
    if (match && !match.disabled) match.focus({preventScroll:true});
  }
}
function renderMenu() {
  const room=friendSession(),friend=room?.friend?.joined?room.friend.name||'your friend':'',options=prefs.options;
  const heroes=[{id:'hero1',ends:[1,5],face:0},{id:'hero2',ends:[6,2],face:0},{id:'hero3',ends:[3,4],face:0}];
  let html='<div class="menu-layout"><aside class="panel lobby-panel"><h2 class="hud-title">New table</h2><div class="invite-buttons">'+(friend?button('<b>Play with '+esc(friend)+'</b><small>Live or take turns</small>','host','pink')+button('<b>Room games</b><small>Your turns & chat</small>','room-games','mint'):button('<b>Play a friend</b><small>Invite with a code</small>','host','pink')+button('<b>Join</b><small>Enter a room code</small>','join','mint'))+'</div>'+button('<b>Deal the cards</b><small>★ Starred card opens the round</small>','start-game','coral deal-button')+button('Table settings <span>Players & bots on this device →</span>','table-settings','gold settings-button')+'<section class="house-summary"><div><h3>House rules</h3>'+button('Change','house-rules','gold compact')+'</div>'+optionBadges(options)+'<label class="name-field" for="player-name">Name<input id="player-name" maxlength="24" value="'+esc(name())+'" autocomplete="nickname"></label></section>';
  if(view())html+=button('Resume current match','resume','outline compact');
  html+=tableControls()+button('Saved games · '+replayStore.records.length,'replay-library','outline compact')+'</aside><section class="intro"><div class="hero-art" aria-label="Illustrated double-number cards">'+heroes.map((c,i)=>cardHtml(c,false,false,[-14,3,15][i])).join('')+'</div><h1 class="hero-logo" aria-label="Flip it">FL<span class="logo-arrow" aria-hidden="true"></span>P<span class="logo-gap"></span>IT</h1><p>Two numbers on every card.<br>Play the top one. Flip the whole hand when the bottom one is better.</p><span class="hero-caption">2–5 players · Local or online</span></section></div>';
  return html;
}
function renderGame() {
  const v=view(),p=mySeat(),ns=names(),target=v.options.target||2;
  let html='<div class="table-layout"><aside class="sidebar panel sidebar-seats-'+v.hands.length+'"><h2 class="hud-title">Round '+(v.round+1)+' <small>'+ (ns.length===2?'vs '+esc(ns[1-p]):'· '+ns.length+' players')+'</small></h2><div class="scoreboard"><p>'+goalText(v.options)+'</p>';
  for(let i=0;i<v.hands.length;i++)html+='<div data-score-seat="'+i+'" class="score-seat '+(v.turn===i&&v.phase==='playing'?'active':'')+'"><b>'+esc(ns[i])+'</b><div class="wins" aria-label="'+v.scores[i]+' rounds won">'+Array.from({length:target},(_,j)=>'<span class="win-dot '+(j<v.scores[i]?'won':'')+'"></span>').join('')+'</div></div>';
  html+='</div><div class="stat-grid">'+[['Your hand',v.hands[p].length,'aqua'],[ns.length===2?ns[1-p]:'Other hands',v.hands.filter((_,i)=>i!==p).reduce((n,h)=>n+h.length,0),'coral'],['Banked',v.discardCount,'amber'],['Moves',v.moves,'lime']].map(([label,value,color])=>'<div class="stat" title="'+esc(label)+'"><span>'+esc(v.hands.length>3?(label==='Your hand'?'My hand':label==='Other hands'?'Rivals':label):label)+'</span><b style="color:var(--'+color+')">'+value+'</b></div>').join('')+'</div><section class="last-moves"><span>Last moves</span>'+ (v.log.length?v.log.slice(-3).reverse().map((e,i)=>'<p style="opacity:'+ (1-i*.2)+'">'+eventText(e)+'</p>').join(''):'<p>Fresh deal. '+esc(ns[v.firstPlayer??v.turn])+' opens.</p>')+button('All actions & replay →','game-log','outline compact')+'</section>'+(mode==='async'?'<p class="room-presence '+(asyncClient.friendHere?'here':'')+'" role="status">'+(asyncClient.friendHere?'● '+esc(asyncClient.names.friend)+' is at the table':'○ '+esc(asyncClient.names.friend)+' sees your moves when they’re back')+'</p>'+button('Chat with '+esc(asyncClient.names.friend),'table-chat','pink compact'):'')+'<div class="hud-nav">'+button('Rules','rules','coral')+button(prefs.table==='wood'?'Felt':'Wood','table-style','pink')+button('Leave','menu','gold')+'</div></aside><section class="felt-table table-size-'+v.hands.length+'" aria-label="Flip it game table">';
  html+=mode==='async'?aiStatusHtml({busy:asyncClient.aiBusy,error:asyncClient.aiError,controller:asyncClient.record.creator===asyncClient.session.role}):aiStatusHtml({busy:aiBusy,error:aiError,controller:true});
  html+='<div class="table-meta">'+starterHtml(v,ns)+'<span class="bank" data-bank><i class="card-back" aria-hidden="true"></i><span><b>'+v.discardCount+'</b> banked</span></span></div>';
  if(handoff)html+='<div class="handoff panel"><div class="card-back" aria-hidden="true"></div><p>Hands hidden</p><h2>'+esc(ns[seat])+'’s turn</h2><p>Pass the screen. Pick up your cards when you’re ready.</p>'+button('Show my hand','uncover')+'</div>';
  else if(v.phase!=='playing')html+=renderEnd(v);
  else html+=renderTable(v);
  if(!handoff&&v.log.length)html+='<div class="move-banner" role="status" aria-live="polite"><p>'+eventText(v.log.at(-1))+'</p></div>';
  return html+'</section></div>';
}
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
    const active=v.turn===other&&v.phase==='playing';
    html += '<section data-render-key="rival-'+other+'" class="rival-zone '+(active?'rival-active':'')+'" aria-label="'+esc(ns[other])+'’s table"><div class="zone-title rival-heading"><div class="rival-identity"><span class="rival-name">'+esc(ns[other])+'</span>'+(active?'<span class="rival-turn">TURN</span>':'')+'</div><span class="rival-hand" data-hand-seat="'+other+'"><span class="mini-fan" aria-hidden="true">'+Array.from({length:Math.min(v.hands[other].length,14)},(_,i)=>'<i class="mini-back" style="--fan:'+ (i-(Math.min(v.hands[other].length,14)-1)/2)+'"></i>').join('')+'</span><span class="rival-count">'+v.hands[other].length+' cards</span></span></div><div class="table-row ' + (v.options.quickTurns?'single-space':'') + '">';
    for(const target of (v.options.quickTurns?[0]:[0,1])) {
      const set=v.table[other][target],owner=v.hands.length===2?{}:{targetSeat:other},add={kind:'add',lane,target,cards:chosen,...owner},take={kind:'take',lane,target,...owner};
      html += '<article data-space-seat="'+other+'" data-space-lane="'+target+'" class="play-space rival-space" '+(set.length?'data-action="inspect-set" data-owner="'+other+'" data-target="'+target+'"':'')+'><div class="space-header"><span>'+(v.options.quickTurns?'PLAY':target?'RIGHT':'LEFT')+' SPACE</span><strong>'+(set.length?set.length+' × '+setValue(set):'EMPTY')+'</strong>'+(set.length?'<button class="set-inspect" data-action="inspect-set" data-owner="'+other+'" data-target="'+target+'" aria-label="Actions for '+esc(ns[other])+'’s '+(target?'right':'left')+' set" aria-expanded="'+(expandedSet===other+':'+target)+'">▾</button>':'')+'</div>'+(set.length?'<button type="button" class="space-cards exposed-cards" data-action="inspect-cards" data-owner="'+other+'" data-target="'+target+'" aria-label="Inspect all '+set.length+' exposed cards in '+esc(ns[other])+'’s '+(v.options.quickTurns?'play':target?'right':'left')+' space">'+set.map(c=>cardHtml(c)).join('')+'</button>':'<div class="space-cards"><span class="space-empty">✦</span></div>')+'<div class="space-controls '+(expandedSet===other+':'+target?'expanded':'')+'">'+button('ADD 1','add','mint',!actionValid(actions,add)||preview,'data-target="'+target+'" data-owner="'+other+'"')+button('Grab & flip','take','gold',!actionValid(actions,take)||preview,'data-target="'+target+'" data-owner="'+other+'"')+'</div></article>';
    }
    html += '</div></section>';
  }
  html += '</div>';
  html += '<p class="table-instruction '+(v.pending!==null?'chance-instruction':'')+'" role="status">' + (v.pending!==null ? 'LAST CHANCE' : animating ? 'CARDS IN MOTION' : turn ? preview ? 'PEEK AT THE OTHER SIDE' : 'YOUR TURN' : esc(ns[v.turn]).toUpperCase() + '’S TURN') + '<small>' + (v.pending!==null ? (v.pending===p ? 'Your hand is empty. '+v.repliesRemaining+' '+(v.repliesRemaining===1?'reply remains.':'replies remain.') : esc(ns[v.pending])+' has an empty hand. Send cards back to stop the win.') : turn ? v.options.quickTurns ? 'Select matching ranks. Play a set, or flip your hand.' : 'Use your ' + (v.beat ? 'right' : 'left') + ' space for this action.' : 'Waiting for their action.') + '</small></p><div class="zone-title own-spaces-heading"><span>YOUR PLAY SPACE' + (v.options.quickTurns?'':'S') + '</span><span>' + (v.options.quickTurns ? 'ONE ACTION / TURN' : (v.opening ? 'OPENING ACTION' : 'ACTION ' + (v.beat ? 1 : 2) + ' / 2')) + '</span></div><div class="table-row ' + (v.options.quickTurns?'single-space':'') + '">';
  for (const own of (v.options.quickTurns?[0]:[0,1])) {
    const set = v.table[p][own], canChoose = turn && availableLanes(v).includes(own);
    const add = {kind:'add', lane, target:own, targetSeat:p, cards:chosen};
    html += '<article data-space-seat="'+p+'" data-space-lane="'+own+'" class="play-space ' + (own === lane && turn ? 'chosen' : '') + '"><div class="space-header own-space-header"><button type="button" class="space-select" data-action="lane" data-lane="' + own + '" aria-pressed="' + (own===lane) + '" ' + (!canChoose ? 'disabled' : '') + '>' + (own === lane && turn ? '● ' : '○ ') + (v.options.quickTurns ? 'PLAY' : own ? 'RIGHT' : 'LEFT') + ' SPACE' + (set.length ? ' · ' + set.length + ' × ' + setValue(set) : '') + '</button>' + (set.length && own !== lane ? button('ADD 1','add','mint own-add',!actionValid(actions,add)||preview,'data-target="'+own+'" data-owner="'+p+'"') : '') + '</div><div class="space-cards" style="--set-count:' + set.length + '">' + (set.length ? set.map(c => cardHtml(c)).join('') : '<span class="space-empty">↕</span>') + '</div><p class="cash-note">' + (set.length ? own === lane && turn ? 'These ' + set.length + ' cards leave on your move.' : 'Leave exposed, or cash out next.' : own === lane && turn ? 'Your new set will go here.' : 'Available next turn.') + '</p></article>';
  }
  const hand = v.hands[p].slice().sort((a,b) => (preview ? reverseOf(a)-reverseOf(b) : valueOf(a)-valueOf(b)) || a.id.localeCompare(b.id));
  html += '</div><div class="hand-tools"><span class="zone-title" style="margin:0">' + (preview ? 'OTHER SIDES' : 'YOUR HAND') + ' · ' + hand.length + '</span><span class="hand-caption">' + (preview ? 'Preview only' : 'The top number plays') + '</span></div><div class="hand '+(hand.length>16?'crowded':'')+'" data-hand-seat="'+p+'" style="--hand-count:'+hand.length+'" aria-label="' + (preview ? 'Preview of flipped hand' : 'Your hand') + '">' + hand.map((c,i) => '<span data-render-key="hand-card-'+c.id+'" class="hand-card" style="--d:'+ (i-(hand.length-1)/2)+';--fan-rise:'+Math.min(18,Math.pow(i-(hand.length-1)/2,2)*.45)+'px;--fan-step:'+Math.min(3.2,30/Math.max(1,hand.length))+'deg">'+cardHtml(c,true,preview)+'</span>').join('') + '</div><div class="table-controls">' + button(chosen.length ? 'Play ' + chosen.length + ' × '+valueOf(hand.find(c=>c.id===chosen[0])) : 'Play a set', 'play', '', !canPlay || preview) + button('Flip hand ↕', 'flip', 'gold', !turn || preview) +button(preview?'Stop peek ↕':'Peek ↕','preview','lavender',false,'aria-pressed="'+preview+'"')+ (chosen.length ? button('Clear', 'clear', 'outline compact') : '') + '</div>';
  let hint = 'Play matching ranks. Add one matching card; at the new size, the lower set returns flipped.';
  if (preview) hint = 'Preview only. Return to active ranks to make your move.';
  else if (chosen.length && turn) {
    try {
      const impact = previewMove(v,p,play);
      hint = impact.event.returned.length ? impact.event.returned.map(r => (r.seat===p ? 'Your' : 'Their') + ' ' + r.count + ' cards return as ' + r.to.join(', ')).join('. ') + '.' : 'This set is legal. It stays exposed until you cash it out.';
    } catch { hint = 'Blocked at this size. Try fewer cards'+(v.options.quickTurns?'':', another space')+', or add one matching card to an exposed set.'; }
  }
  return html + '<p class="move-hint">' + esc(hint) + '</p>';
}
function renderEnd(v) {
  const match = v.phase === 'matchOver', r = v.result, ns = names(), winner = match ? v.scores.indexOf(v.options.target||2) : r.winner;
  const title = winner === null ? 'A draw' : winner===mySeat()&&(ns[winner]==='You'||mode==='async') ? (match?'You win the match':'You win the round') : esc(ns[winner]) + (match ? ' wins the match' : ' wins the round');
  const reason = r.reason === 'repeat' ? 'The same position came around three times. Drawn round: shuffle and try again.' : r.reason === 'limit' ? 'The action limit was reached. Drawn round: deal again.' : r.reason === 'survived' ? 'The last-chance reply couldn’t put cards back in their hand.' : 'Their hand is empty.';
  const ready = mode==='async'&&asyncClient.record.ready.includes(roomIndex());
  const waitingFor = mode==='async' ? 'WAITING FOR '+esc(asyncClient.names.friend).toUpperCase()+'…' : '';
  return '<div class="ending pop"><div class="trophy" aria-hidden="true">✦</div><p class="eyebrow">' + (match ? 'MATCH OVER' : 'ROUND '+(v.round+1)+' OVER') + '</p><h2>' + title + '</h2><p>' + reason + '</p><div class="ending-score"><span>' + v.scores.join(' : ') + '</span></div>' + (match ? button(mode==='async'?'Play again':'Rematch', 'rematch', 'gold') : button(ready ? waitingFor : mode==='async'&&asyncClient.record.ready.length ? esc(asyncClient.names.friend)+' is ready · next round' : 'Deal next round', 'next', 'gold', ready)) + button('GAME HIGHLIGHTS ↗','game-highlights','outline') + button('Change rules', 'menu', 'coral') + '</div>';
}
function eventText(e,ns=names()) {
  if (!e) return 'Recording starts at this position.';
  if (e.kind==='deal') return Number.isInteger(e.firstPlayer)?'A fresh deal. '+esc(ns[e.firstPlayer])+' drew the starred card and starts.':'A fresh deal.';
  const who = esc(ns[e.seat]);
  let text = who + (e.kind==='flip' ? ' flipped their hand.' : e.kind==='take' ? ' took ' + e.count + ' cards and flipped them.' : e.kind==='add' ? ' added a ' + e.value + ' to '+esc(ns[e.targetSeat])+'’s set.' : ' played ' + e.count + ' × ' + e.value + '.');
  if (e.cashed) text += ' Cashed out ' + e.cashed + '.';
  if (e.returned.length) text += ' ' + e.returned.map(r => esc(ns[r.seat]) + ' received ' + r.count + ' flipped cards ('+r.from+' → '+r.to.join(', ')+')').join('; ') + '.';
  return text;
}
function recordingId() {return mode==='async' ? 'room-'+asyncClient.record.id : matchId;}
function recordView() {
  const v=view();if(!v)return;
  replayStore.record({id:recordingId(),mode,names:names(),seat:mySeat(),view:v});
  if(!replayStore.persistent&&!storageNotified){storageNotified=true;notify('Browser storage is unavailable. This replay stays in memory until you close the tab.');}
}
function currentRecording(){recordView();return replayStore.records.find(r=>r.id===recordingId());}
function pauseReplay(){clearInterval(replayTimer);replayTimer=null;cancelMotion(modalContent);}
function beginReplayDialog(){
  replayOpen=true;clearTimeout(botTimer);generation++;stopAI();
  modal.classList.add('replay-dialog');if(!modal.open)modal.showModal();
}
function showReplayLibrary(){
  pauseReplay();beginReplayDialog();
  modalContent.innerHTML=modalHead('Saved games','SAVED ON THIS BROWSER')+'<p class="modal-copy">Your last eight games, with every recorded move and its highlights. Older games are removed as browser storage fills. Recordings include only the cards visible to this browser.</p><div class="replay-library">'+(replayStore.records.length?replayStore.records.map(r=>'<article><div><h3>'+r.names.map(esc).join(' / ')+'</h3><p>'+esc(new Date(r.updated).toLocaleString())+' · '+r.entries.filter(e=>e.event&&e.event.kind!=='deal').length+' actions · '+(r.entries.at(-1).view.phase==='matchOver'?'Finished':'In progress')+'</p></div><div>'+button('WATCH ↗','open-recording','gold compact',false,'data-recording="'+esc(r.id)+'"')+button('DELETE','delete-recording','outline compact',false,'data-recording="'+esc(r.id)+'"')+'</div></article>').join(''):'<p class="modal-copy">No saved games yet.</p>')+'</div>';
}
function openRecording(record){
  if(!record){notify('No moves have been recorded yet.');return;}
  pauseReplay();replayPosition=null;replayRecord=record;replayIndex=record.entries.length-1;replayOnlyHighlights=false;beginReplayDialog();renderReplay();
}
function eventVisual(e){
  if(!e)return '<span class="log-symbol">▣</span><span class="log-label">SNAPSHOT</span>';
  if(e.kind==='deal')return '<span class="log-symbol">▥</span><span class="log-label">DEAL</span>';
  let html=e.kind==='flip'?'<span class="log-symbol">↕</span><span class="log-label">HAND FLIPPED</span>':e.kind==='take'?'<span class="log-rank">'+e.value+'</span><span class="log-arrow">× '+e.count+' → ↕</span>':'<span class="log-rank">'+e.value+'</span><span class="log-arrow">× '+e.count+(e.kind==='add'?' · +1':'')+'</span>';
  if(e.cashed)html+='<span class="log-bank">▤ +'+e.cashed+'</span>';
  for(const r of e.returned)html+='<span class="log-return"><span class="log-rank">'+r.from+'</span> × '+r.count+' ↩ <span class="log-flips">'+r.to.join(' · ')+'</span></span>';
  return html;
}
function replayBoard(entry){
  const v=entry.view,ns=replayRecord.names;
  let html='<div class="replay-board"><div class="table-meta"><span>ROUND '+(v.round+1)+' · ACTION '+v.moves+'</span>'+starterHtml(v,ns)+'<span data-bank>▤ BANK '+v.discardCount+'</span></div><div class="replay-seats">';
  for(let i=0;i<v.hands.length;i++) {
    html+='<section class="replay-seat"><div class="zone-title"><span>'+esc(ns[i])+'</span><span data-hand-seat="'+i+'"><span class="mini-fan" aria-hidden="true">'+Array.from({length:Math.min(v.hands[i].length,5)},()=>'<i class="mini-back"></i>').join('')+'</span> '+v.hands[i].length+' IN HAND · '+v.scores[i]+' WINS</span></div><div class="table-row '+(v.options.quickTurns?'single-space':'')+'">';
    for(const lane of(v.options.quickTurns?[0]:[0,1]))html+='<div class="play-space" data-space-seat="'+i+'" data-space-lane="'+lane+'"><span class="eyebrow">'+(v.options.quickTurns?'PLAY SPACE':lane?'RIGHT':'LEFT')+'</span><div class="space-cards" style="--set-count:'+v.table[i][lane].length+'">'+(v.table[i][lane].map(c=>cardHtml(c)).join('')||'<span class="space-empty">✦</span>')+'</div></div>';
    html+='</div></section>';
  }
  // During pass-and-play the replay shows the public table. Private hands stay
  // behind the handoff curtain, including in recordings opened from the menu.
  if(replayRecord.mode!=='local')html+='</div><div class="replay-hand"><p class="eyebrow">'+esc(ns[entry.seat])+'’S RECORDED HAND</p><div class="hand" data-hand-seat="'+entry.seat+'">'+v.hands[entry.seat].map(c=>cardHtml(c)).join('')+'</div></div>';
  else html+='</div><p class="small">Pass & play recordings show the public table.</p>';
  if(v.result)html+='<p class="replay-result">'+(v.result.winner===null?'Drawn round':esc(ns[v.result.winner])+' won the '+(v.phase==='matchOver'?'match':'round'))+'.</p>';
  return html+'</div>';
}
function renderReplay(scrubbing=false){
  if(!replayRecord)return;
  cancelMotion(modalContent);
  const before=captureTable(modalContent);
  const r=replayRecord,entry=r.entries[replayIndex],marks=highlights(r),markMap=new Map(marks.map(m=>[m.index,m.label]));
  const items=r.entries.map((e,index)=>({entry:e,index})).filter(({index})=>!replayOnlyHighlights||markMap.has(index));
  const scroll=modal.querySelector('.action-timeline')?.scrollTop;
  const controls=scrubbing?modalContent.querySelector('.replay-controls'):null;
  const html=modalHead('Action log & replay','ACTION LOG / REPLAY')+'<div class="replay-controls">'+button('←','replay-step','outline compact',replayIndex===0,'data-step="-1" aria-label="Previous action"')+button(replayTimer?'PAUSE':'PLAY ▶','replay-play','gold compact')+button('→','replay-step','outline compact',replayIndex===r.entries.length-1,'data-step="1" aria-label="Next action"')+'<label class="replay-scrubber">'+(replayIndex+1)+' / '+r.entries.length+'<input id="replay-scrubber" type="range" min="0" max="'+(r.entries.length-1)+'" value="'+replayIndex+'" aria-label="Replay action"></label>'+button('SAVED GAMES','replay-library','outline compact')+'</div>'+(r.partial?'<p class="small">This recording started partway through the game or missed updates while this browser was away.</p>':'')+'<div class="replay-layout"><section><div class="replay-caption" aria-live="polite">'+eventVisual(entry.event)+'<p>'+eventText(entry.event,r.names)+'</p></div>'+replayBoard(entry)+'</section><aside class="replay-log"><div class="replay-log-head"><span>'+r.entries.filter(e=>e.event&&e.event.kind!=='deal').length+' ACTIONS</span>'+button(replayOnlyHighlights?'ALL ACTIONS':'HIGHLIGHTS · '+marks.length,'replay-filter','outline compact',false,'aria-pressed="'+replayOnlyHighlights+'"')+'</div><ol class="action-timeline" aria-label="Complete game action log">'+items.map(({entry:e,index})=>'<li><button type="button" data-action="replay-jump" data-index="'+index+'" class="log-entry '+(index===replayIndex?'current':'')+'" aria-current="'+(index===replayIndex?'step':'false')+'"><span class="log-meta">R'+(e.view.round+1)+' / '+(!e.event?'SNAPSHOT':e.event.kind==='deal'?'DEAL':'MOVE '+e.view.moves)+(markMap.has(index)?' · ★ '+esc(markMap.get(index)):'')+'</span><span class="log-visual">'+eventVisual(e.event)+'</span><span class="log-text">'+eventText(e.event,r.names)+'</span></button></li>').join('')+'</ol></aside></div>';
  // Keep the native range element alive throughout mouse, touch and keyboard
  // scrubbing. Replacing it during input loses pointer capture and focus.
  if(controls){
    const next=document.createElement('div');next.innerHTML=html;
    for(const child of [...modalContent.children])if(child!==controls)child.remove();
    for(const child of [...next.children]){
      if(child.classList.contains('replay-controls'))continue;
      if(child.classList.contains('modal-head'))modalContent.insertBefore(child,controls);
      else modalContent.append(child);
    }
    controls.querySelector('.replay-scrubber').firstChild.textContent=(replayIndex+1)+' / '+r.entries.length;
    controls.querySelector('[data-action=replay-play]').textContent='PLAY ▶';
    controls.querySelector('[data-step="-1"]').disabled=replayIndex===0;
    controls.querySelector('[data-step="1"]').disabled=replayIndex===r.entries.length-1;
  }
  else modalContent.innerHTML=html;
  const scrubber=modal.querySelector('#replay-scrubber');
  scrubber.oninput=event=>{pauseReplay();replayPosition=null;replayIndex=Number(event.target.value);renderReplay(true);};
  scrubber.onpointerdown=()=>{pauseReplay();modal.querySelector('[data-action=replay-play]').textContent='PLAY ▶';};
  if(scroll!==undefined)modal.querySelector('.action-timeline').scrollTop=scroll;
  if(replayPosition?.id===r.id&&replayPosition.index+1===replayIndex&&replayPosition.round===entry.view.round&&replayPosition.seat===entry.seat&&replayPosition.revision+1===entry.view.revision&&entry.event?.kind!=='deal'&&entry.event&&motionEnabled())animateMove(modalContent,before,entry.event,entry.seat,entry.view);
  replayPosition={id:r.id,index:replayIndex,round:entry.view.round,seat:entry.seat,revision:entry.view.revision};
}
function toggleReplay(){
  if(replayTimer){pauseReplay();renderReplay();return;}
  if(replayIndex===replayRecord.entries.length-1)replayIndex=0;
  replayTimer=setInterval(()=>{
    if(replayIndex>=replayRecord.entries.length-1){pauseReplay();renderReplay();return;}
    replayIndex++;renderReplay();
    modal.querySelector('.log-entry.current')?.scrollIntoView({block:'nearest'});
  },1100);renderReplay();
}

function resetSelection() { expandedSet=null; chosen = []; preview = false; if (view()) lane = availableLanes(view())[0]; }
function startOffline(nextMode, options = prefs.options) {
  if(nextMode==='solo'&&!aiPlayers(4).length){showTableSettings();notify('Choose two players on this device, invite a friend, or add an opponent.');return;}
  cancelMotion(app);clearTimeout(botTimer); generation++; stopAI(); aiHistory.clear();matchId=crypto.randomUUID();
  animating=false; animationGeneration++; renderedPosition=null;
  if(mode==='async')friendSession()?.leaveRoomGame?.();
  asyncClient=null;
  mode=nextMode; seat=0; scene='game'; offlineControllers=[...Array(mode==='solo'?1:2).fill('human'),...aiPlayers(mode==='solo'?4:3)];
  game=createMatch(options,crypto.getRandomValues(new Uint32Array(1))[0],0,offlineControllers.length);
  if(mode==='local'&&offlineControllers[game.turn]==='human')seat=game.turn;
  handoff=mode==='local'; resetSelection(); sound('deal'); render(); scheduleBot();
}
function afterOfflineMove(previousTurn) {
  recordView();
  trackArcadeGame(matchId,'flip-it',game,mode);
  resetSelection();
  if (mode==='local' && game.phase==='playing' && offlineControllers[game.turn]==='human') { const oldSeat=seat;seat=game.turn;handoff=oldSeat!==seat; }
  if (game.phase==='matchOver') sound('win'); else if (game.phase==='roundOver') sound('reveal');
  render(); scheduleBot();
}
function act(action) {
  if (blocked()) return;
  sound(action.kind==='flip' ? 'deal' : 'tap');
  if(mode==='async'){asyncClient.move(action).catch(networkError);return;}
  const previousTurn=game.turn; game=applyAction(game,action.kind==='next'?0:seat,action);
  afterOfflineMove(previousTurn);
}
function scheduleBot() {
  if(mode==='async')return;
  clearTimeout(botTimer);
  const state=game;
  if(replayOpen||animating||scene!=='game'||!state||state.phase!=='playing'||controllers()[state.turn]==='human'||aiBusy||aiError)return;
  const revision=state.revision,epoch=generation,actor=state.turn;
  botTimer=setTimeout(async()=>{
    if(generation!==epoch||scene!=='game')return;
    const current=game;
    if(!current||current.revision!==revision)return;
    const memoryKey=matchId+'/'+current.round+'/'+actor;
    try {
      let action;
      if(controllers()[actor]==='model') {
        const controller=new AbortController();aiController=controller;aiBusy=true;render();
        const move=await chooseTurn(describeTurn(current,actor,aiHistory.get(memoryKey)||[]),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)]),gameId:matchId,role:'seat-'+actor,round:current.round});
        if(controller.signal.aborted||generation!==epoch||scene!=='game'||game.revision!==revision)return;
        action=move.action;aiHistory.set(memoryKey,[...(aiHistory.get(memoryKey)||[]),{action,rationale:move.rationale}].slice(-6));
      } else action=botAction(playerView(current,actor),actor);
      aiBusy=false;aiController=null;
      game=applyAction(game,actor,action);afterOfflineMove(actor);
      sound('tap');scheduleBot();
    } catch(error) {aiBusy=false;aiController=null;if(generation!==epoch)return;aiError=error.name==='AbortError'?'AI paused. Retry when ready.':error.name==='TimeoutError'?'The AI took too long. Retry when ready.':error.message;render();}
  },1200);
}
// Room games: the AI seat's view arrives only on the creator's page.
async function chooseRoomAI({seat:actor,view:observation,record},{signal}) {
  const memoryKey='room-'+record.id+'/'+observation.round+'/'+actor;
  const move=await chooseTurn(describeTurn(observation,actor,aiHistory.get(memoryKey)||[]),{signal,gameId:record.id,role:'seat-'+actor,round:observation.round});
  aiHistory.set(memoryKey,[...(aiHistory.get(memoryKey)||[]),{action:move.action,rationale:move.rationale}].slice(-6));
  return move.action;
}
function modalHead(title, eyebrow = 'FLIP IT') {
  return '<div class="modal-head"><div><p class="eyebrow">' + eyebrow + '</p><h2 id="modal-title">' + title + '</h2></div><button class="close-button" data-action="close-modal" aria-label="Close dialog">×</button></div>';
}
function ruleDiagram(ranks,label,flipped=false){
  return '<div class="diagram-set"><div>'+ranks.map((ends,i)=>cardHtml({id:'diagram-'+label+i,ends,face:flipped?1:0})).join('')+'</div><small>'+label+'</small></div>';
}
function showSetDetails(owner,target){
  const v=view();
  if(!v||owner===mySeat()||!v.table[owner]?.[target]?.length)return;
  pauseReplay();
  modal.dataset.kind='set-details';modal.dataset.setOwner=owner;modal.dataset.setLane=target;
  renderSetDetails();if(!modal.open)modal.showModal();
}
function renderSetDetails(){
  const owner=Number(modal.dataset.setOwner),target=Number(modal.dataset.setLane),v=view();
  const set=v?.table[owner]?.[target]||[],ns=names();
  const label=v?.options.quickTurns?'play space':target?'right space':'left space';
  const closeFocused=document.activeElement?.dataset.action==='close-modal',scroll=modalContent.scrollTop;
  modalContent.innerHTML=modalHead(esc(ns[owner])+'’s '+label,'EXPOSED CARDS')+'<p class="set-details-summary" role="status">'+(set.length?set.length+' card'+(set.length===1?'':'s')+' · Top rank '+setValue(set):'This space is now empty.')+'</p><div class="set-details-cards" role="list" aria-label="Every exposed card">'+set.map(c=>'<div class="set-detail-card" role="listitem">'+cardHtml(c)+'<span>Top <b>'+valueOf(c)+'</b></span><span>Flips to <b>'+reverseOf(c)+'</b></span></div>').join('')+'</div>'+button('Back to table','close-modal');
  modalContent.scrollTop=scroll;
  if(closeFocused)modalContent.querySelector('[data-action=close-modal]').focus({preventScroll:true});
}

function showRules() {
  delete modal.dataset.kind;modal.classList.add('rules-dialog');
  const options=scene==='game'&&view()?view().options:prefs.options;
  const panels=[
    ['Play','var(--amber)',ruleDiagram([[5,1],[5,2]],'your 5s')+'<span class="diagram-arrow">→</span>'+ruleDiagram([[3,1],[3,1]],'their cards return',true),'Their lower pair bounces home flipped. Play matching top ranks into your space.'],
    ['Add','var(--lime)',ruleDiagram([[3,1]],'one 3')+'<span class="diagram-arrow">→</span>'+ruleDiagram([[3,1],[3,4],[3,5]],'their triple'),'Add one matching card to any exposed set, including your other space. At its new size, the lower-ranked set returns to its owner flipped, including the added card if that set loses. Equal ranks at the same size are blocked.'],
    ['Take','var(--aqua)',ruleDiagram([[3,1],[3,5]],'their set')+'<span class="diagram-arrow">→ ↕</span>'+ruleDiagram([[3,1],[3,5]],'your hand',true),'Every card you take flips to its other side. The whole set joins your hand.'],
    ['Flip','var(--pink)',ruleDiagram([[1,3],[2,4],[5,1]],'your hand')+'<span class="diagram-arrow">↕</span>'+ruleDiagram([[1,3],[2,4],[5,1]],'other sides',true),'Flip your entire hand. It costs your whole action, so use it when the bottoms are better.'],
    ['Cash out','var(--lavender)',ruleDiagram([[4,2],[4,3]],'your old set')+'<span class="diagram-arrow">→</span><span class="diagram-set"><span class="card-back"></span><small>banked</small></span>','The set in the space you use leaves the game before you act. Banked cards cannot return to a hand.']
  ];
  modalContent.innerHTML=modalHead('How to play','GAME RULES')+'<p class="rules-intro">Empty your hand to win a round. '+goalText(options)+'. The upright number is active; the upside-down number becomes active after a flip.</p><div class="illustrated-rules">'+panels.map(([title,color,diagram,text])=>'<section class="rule-panel" style="--accent:'+color+'"><h3>'+title+'</h3><div class="rule-diagram">'+diagram+'</div><p>'+text+'</p></section>').join('')+'</div><ol class="rules-list"><li><strong>★ Opening.</strong> Whoever receives the unique starred card starts each round. The star stays with the card and has no extra power.</li><li><strong>Turns.</strong> '+(options.quickTurns?'One action each, using your single play space.':'Right space, then left. The opening player gets only the right action.')+' Cash out the set in that space before every action.</li><li><strong>Same size competes.</strong> Play a higher rank than every other set of that size. After Add, compare the enlarged set at its new size: the lower-ranked set returns to its owner flipped, including your own.</li><li><strong>Ending.</strong> '+(options.lastChance?'An empty hand gives every other player one reply. Send cards back to stop the win. The first finisher has priority if several hands are empty.':'An empty hand wins immediately.')+'</li><li><strong>Draws.</strong> Three repeats of a position, or '+(options.compactDeck?'120':'180')+' actions, draw the round. Nobody scores; deal again.</li></ol>'+optionBadges(options)+'<p class="small">Keys: 1–9 / 0 select ranks · Enter plays · F flips · Esc clears. You can also drag cards onto a space, or drag their set into your hand.</p>'+button('Close rules','close-modal');
  if(!modal.open)modal.showModal();
}

// Drag interactions use only the current player's redacted view and the same
// action validator as buttons. Taps and keyboard selection remain available.
let drag=null,suppressDragClick=false;
function dragAction(current,at){
  const space=at?.closest('[data-space-seat]'),hand=at?.closest('.hand[data-hand-seat]');
  if(current.kind==='take'&&hand&&Number(hand.dataset.handSeat)===mySeat())return {kind:'take',lane,target:current.target,...(view().hands.length>2?{targetSeat:current.owner}:{})};
  if(current.kind==='cards'&&space){
    const owner=Number(space.dataset.spaceSeat),target=Number(space.dataset.spaceLane);
    return owner===mySeat()&&target===lane?{kind:'play',lane:target,cards:current.cards}:{kind:'add',lane,target,targetSeat:owner,cards:current.cards};
  }
  return null;
}
function dragPreview(current){
  const ghost=document.createElement('div');ghost.className='drag-ghost';ghost.setAttribute('aria-hidden','true');
  const cards=current.kind==='take'?view().table[current.owner][current.target]:current.cards.map(id=>view().hands[mySeat()].find(c=>c.id===id));
  const step=Math.min(18,120/Math.max(1,cards.length-1));
  ghost.style.width=(64+step*(cards.length-1))+'px';
  ghost.innerHTML=cards.map((c,i)=>'<span class="drag-card" style="left:'+i*step+'px;top:'+Math.min(i,5)*2+'px">'+cardHtml(c)+'</span>').join('')+'<span class="drag-count">'+cards.length+' card'+(cards.length===1?'':'s')+(current.kind==='take'?' · grab & flip':'')+'</span>';
  // Ghosts are decorative; cloned card IDs must not enter animation captures.
  ghost.querySelectorAll('[data-visual-card]').forEach(n=>n.removeAttribute('data-visual-card'));
  return ghost;
}
document.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.isPrimary===false||drag||modal.open||!myTurn()||preview)return;
  const card=event.target.closest('.hand [data-card]'),space=event.target.closest('[data-space-seat]');
  if(card){drag={pointer:event.pointerId,x:event.clientX,y:event.clientY,kind:'cards',cards:chosen.includes(card.dataset.card)?[...chosen]:[card.dataset.card],source:card};}
  else if(space&&Number(space.dataset.spaceSeat)!==mySeat()&&!event.target.closest('button:not(.exposed-cards)')){
    const owner=Number(space.dataset.spaceSeat),target=Number(space.dataset.spaceLane);
    if(view().table[owner][target].length)drag={pointer:event.pointerId,x:event.clientX,y:event.clientY,kind:'take',owner,target,source:space};
  }
});
function highlightDrop(current){
  document.querySelectorAll('.drop-valid').forEach(n=>n.classList.remove('drop-valid'));
  const at=document.elementFromPoint(current.pointerX,current.pointerY),action=dragAction(current,at);
  if(action&&actionValid(current.actions,action))at.closest(action.kind==='take'?'.hand[data-hand-seat]':'[data-space-seat]')?.classList.add('drop-valid');
}
function scrollDrag(){
  if(!drag?.ghost)return;
  const edge=44,y=drag.pointerY,step=y<edge?-12:y>innerHeight-edge?12:0;
  if(step){const previous=scrollY;window.scrollBy(0,step);if(scrollY!==previous)highlightDrop(drag);}
  drag.frame=requestAnimationFrame(scrollDrag);
}
document.addEventListener('pointermove',event=>{
  if(!drag||drag.pointer!==event.pointerId)return;
  if(!drag.ghost&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<8)return;
  drag.pointerX=event.clientX;drag.pointerY=event.clientY;
  if(!drag.ghost){
    drag.ghost=dragPreview(drag);document.body.append(drag.ghost);document.body.classList.add('dragging');
    window.getSelection()?.removeAllRanges();
    try { drag.source.setPointerCapture?.(event.pointerId); } catch { /* Shared controls route captured drags themselves. */ }
    drag.actions=legalActions(view(),mySeat());drag.frame=requestAnimationFrame(scrollDrag);
  }
  event.preventDefault();
  const ghostWidth=drag.ghost.offsetWidth,ghostHeight=drag.ghost.offsetHeight;
  drag.ghost.style.left=Math.max(ghostWidth/2+4,Math.min(innerWidth-ghostWidth/2-4,event.clientX))+'px';
  drag.ghost.style.top=Math.max(ghostHeight*.7+4,Math.min(innerHeight-ghostHeight*.3-4,event.clientY))+'px';
  highlightDrop(drag);
},{passive:false});
function endDrag(event,cancel=false){
  if(!drag||drag.pointer!==event.pointerId)return;
  const current=drag;drag=null;cancelAnimationFrame(current.frame);document.body.classList.remove('dragging');document.querySelectorAll('.drop-valid').forEach(n=>n.classList.remove('drop-valid'));
  if(current.source.hasPointerCapture?.(event.pointerId))current.source.releasePointerCapture(event.pointerId);
  if(!current.ghost)return;
  current.ghost.remove();suppressDragClick=true;setTimeout(()=>suppressDragClick=false,0);
  if(cancel||!myTurn())return;
  const action=dragAction(current,document.elementFromPoint(event.clientX,event.clientY));
  if(action)try{act(action);}catch(error){notify(error.message);}
}
document.addEventListener('pointerup',event=>endDrag(event));
document.addEventListener('pointercancel',event=>endDrag(event,true));
window.addEventListener('blur',()=>{if(drag)endDrag({pointerId:drag.pointer},true);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag)endDrag({pointerId:drag.pointer},true);});
document.addEventListener('click',event=>{if(suppressDragClick){event.preventDefault();event.stopImmediatePropagation();suppressDragClick=false;}},true);

document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]'); if (!target || target.disabled) return;
  const action=target.dataset.action;
  try {
    if(action==='ai-settings')openAISettings(()=>{generation++;stopAI();render();scheduleBot();});
    else if(action==='cancel-ai'){if(mode==='async'){asyncClient.aiController?.abort();return;}generation++;stopAI('AI paused. Retry when ready.');render();}
    else if(action==='retry-ai'){if(mode==='async'){asyncClient.retryAI();return;}stopAI();render();scheduleBot();}
    else if(action==='inspect-cards')showSetDetails(Number(target.dataset.owner),Number(target.dataset.target));
    else if(action==='inspect-set'){const key=target.dataset.owner+':'+target.dataset.target;expandedSet=expandedSet===key?null:key;render();}
    else if(action==='table-chat') openFriendChat();
    else if(action==='table-settings')showTableSettings();
    else if(action==='house-rules')showHouseRules();
    else if(action==='table-style'){prefs.table=prefs.table==='wood'?'felt':'wood';savePrefs();applySettings();render();}
    else if(action==='theme-toggle')saveTheme(document.documentElement.dataset.colorTheme==='light'?'dark':'light');
    else if(action==='match-target'){prefs.options.target=Number(target.dataset.target);savePrefs();render();showHouseRules();}
    else if(action==='house-option'){prefs.options[target.dataset.key]=target.dataset.value==='true';savePrefs();render();showHouseRules();}
    else if (action==='start-game') startOffline(localHumans()===2?'local':'solo');
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
    else if (action==='add') act({kind:'add',lane,target:Number(target.dataset.target),targetSeat:Number(target.dataset.owner),cards:chosen});
    else if (action==='take') act({kind:'take',lane,target:Number(target.dataset.target),...(view().hands.length>2?{targetSeat:Number(target.dataset.owner)}:{})});
    else if (action==='flip') act({kind:'flip',lane});
    else if (action==='clear') { chosen=[]; render(); }
    else if (action==='preview') {cancelMotion(app); preview=!preview; chosen=[]; render(); }
    else if (action==='uncover') { handoff=false; render(); }
    else if (action==='game-highlights') {openRecording(currentRecording());replayOnlyHighlights=true;renderReplay();}
    else if (action==='game-log') openRecording(currentRecording());
    else if (action==='replay-library') showReplayLibrary();
    else if (action==='open-recording') openRecording(replayStore.records.find(r=>r.id===target.dataset.recording));
    else if (action==='delete-recording') {replayStore.remove(target.dataset.recording);showReplayLibrary();}
    else if (action==='replay-step') {pauseReplay();replayIndex=Math.max(0,Math.min(replayRecord.entries.length-1,replayIndex+Number(target.dataset.step)));renderReplay();}
    else if (action==='replay-jump') {pauseReplay();replayIndex=Number(target.dataset.index);renderReplay();}
    else if (action==='replay-play') toggleReplay();
    else if (action==='replay-filter') {replayOnlyHighlights=!replayOnlyHighlights;renderReplay();}
    else if (action==='rules') showRules();
    else if (action==='menu') { event.preventDefault();cancelMotion(app); scene='menu'; clearTimeout(botTimer);generation++;stopAI();render(); }
    else if (action==='resume') { scene='game'; render(); scheduleBot(); }
    else if (action==='next') act({kind:'next'});
    else if (action==='rematch') {
      if(mode==='async'){friendSession().openGameSetup('flip-it',asyncClient.record.setup);}
      else startOffline(mode,view().options);
    } else if (action==='host') inviteFriendGame('flip-it', friendSetup());
    else if (action==='join') joinFriendRoom('flip-it');
    else if (action==='room-games') friendSession()?.showPanel('games');
    else if (action==='close-modal') {pauseReplay();modal.close();}
  } catch(error) { notify(error.message); }
});
document.addEventListener('change',event=>{
  if(event.target.id==='table-humans'){prefs.localHumans=Number(event.target.value);savePrefs();render();}
  else if(event.target.id==='ai-count'){
    prefs.aiCount=Number(event.target.value);prefs.aiKinds=Array.from({length:prefs.aiCount},(_,i)=>prefs.aiKinds?.[i]||'dealer');savePrefs();render();
  }
  else if(event.target.dataset.aiSeat!==undefined){prefs.aiKinds||=[];prefs.aiKinds[Number(event.target.dataset.aiSeat)]=event.target.value;savePrefs();}
  else if (event.target.dataset.option && OPTION_KEYS.includes(event.target.dataset.option)) {
    prefs.options[event.target.dataset.option]=event.target.checked; savePrefs();
  } else if (event.target.id==='player-name') {
    prefs.name=savePlayerName(event.target.value)||'You'; savePrefs();
  }
  if(modal.open&&modal.dataset.kind==='table-settings')showTableSettings();
});
document.addEventListener('keydown',event=>{
  if (modal.open || scene!=='game' || handoff || ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
  if (event.key==='Escape') { chosen=[]; preview=false; render(); return; }
  if (!myTurn() || preview) return;
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){const requested=event.key==='ArrowLeft'?0:1;if(availableLanes(view()).includes(requested)){lane=requested;render();}event.preventDefault();return;}
  if (/^[0-9]$/.test(event.key)) {
    const rank=event.key==='0'?10:Number(event.key), cards=view().hands[mySeat()].filter(c=>valueOf(c)===rank).map(c=>c.id);
    if (cards.length) { chosen=cards.every(id=>chosen.includes(id))?[]:cards; render(); event.preventDefault(); }
  } else if (event.key.toLowerCase()==='f') { act({kind:'flip',lane}); event.preventDefault(); }
  else if (event.key==='Enter' && chosen.length && (document.activeElement?.tagName!=='BUTTON' || document.activeElement.dataset.action==='select-card')) {
    try { act({kind:'play',lane,cards:chosen}); } catch(error) { notify(error.message); } event.preventDefault();
  }
});
modal.addEventListener('cancel',pauseReplay);
modal.addEventListener('close',()=>{modal.classList.remove('rules-dialog');pauseReplay();replayOpen=false;modal.classList.remove('replay-dialog');delete modal.dataset.kind;scheduleBot();});
modal.addEventListener('click',event=>{
  if (event.target===modal) { const r=modal.getBoundingClientRect(); if (event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) modal.close(); }
});
function applySettings() {
  document.body.dataset.table=prefs.table==='wood'?'wood':'felt';
  setSound(Boolean(prefs.sound));
  const soundButton=document.querySelector('#sound'); soundButton.textContent='Sound '+(prefs.sound?'ON':'OFF'); soundButton.setAttribute('aria-label',prefs.sound?'Mute sound':'Enable sound');
  document.body.classList.toggle('no-fx',prefs.fx===false); document.querySelector('#effects').textContent='FX '+(prefs.fx===false?'OFF':'ON');
}
document.querySelector('#sound').addEventListener('click',()=>{prefs.sound=!prefs.sound;savePrefs();applySettings();sound('deal');});
document.querySelector('#effects').addEventListener('click',()=>{prefs.fx=prefs.fx===false;savePrefs();applySettings();if(prefs.fx===false){cancelMotion(app);cancelMotion(modalContent);}});
window.addEventListener('pagehide',()=>{pauseReplay();stopAI();clearTimeout(botTimer);});
installThemeControls(document.querySelector('.topbar nav'));
function refreshThemeLabel(){for(const control of app.querySelectorAll('[data-action=theme-toggle]'))control.textContent=document.documentElement.dataset.colorTheme==='light'?'Night':'Day';}
window.addEventListener('games-theme-change',refreshThemeLabel);
window.addEventListener('storage',event=>{if(event.key===THEME_KEY)refreshThemeLabel();});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>queueMicrotask(refreshThemeLabel));
applySettings();render();
// Read-only, redacted diagnostics for browser playtests. No action or private
// host state is exported; tests must interact through the actual controls.
Object.defineProperty(window,'__flipit',{value:{
  get state(){return view()?structuredClone(view()):null;},
  get mode(){return mode;},get seat(){return mySeat();},get handoff(){return handoff;}
}});

function friendSetup() {
  if(mode==='async')return asyncClient.record.setup;
  return {options:prefs.options, team:Boolean(prefs.onlineTeam), aiPlayers:aiPlayers(prefs.onlineTeam?4:3,prefs.onlineTeam?1:0,true)};
}
registerCheckpoint('flip-it',{
  capture:()=>mode!=='async'&&game?{mode,seat:mySeat(),state:game,view:view(),controllers:controllers(),team:false,members:[],setup:friendSetup(),matchId}:null,
  restore(value){
    const data=validateCheckpoint(value);
    // Tables shared with a friend now live in the room, not in this browser.
    if(data.mode==='online'||!data.state)return;
    mode=data.mode;seat=data.seat;matchId=data.matchId||crypto.randomUUID();
    game=data.state;offlineControllers=data.controllers;
    scene='game';handoff=mode==='local';resetSelection();render();
  },
});
registerFriendGame('flip-it', {
  setup: friendSetup,
  startAsync(client){
    generation++;stopAI();clearTimeout(botTimer);game=null;asyncClient=client;mode='async';scene='game';handoff=false;lastViewKey='';
    const unsubscribe=client.subscribe(record=>{
      if(mode!=='async'||asyncClient!==client)return;
      const key=record.id+'/'+record.revision;
      if(lastViewKey&&lastViewKey!==key){resetSelection();sound(record.view.phase==='matchOver'?'win':record.view.phase==='roundOver'?'reveal':'tap');}
      else if(!lastViewKey)resetSelection();
      lastViewKey=key;render();
    });
    window.addEventListener('pagehide',unsubscribe,{once:true});
  },
  chooseAI:chooseRoomAI,
});
