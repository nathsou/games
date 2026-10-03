import {DECKS, CARDS, THEME_IDEAS} from './decks.js';
import {createGame, playClue, eliminate, remaining, viewFor, validatePublicView, REMOVALS, PROTOCOL} from './game.js';
import {loadArt, cardElement, observationImage, startAmbience} from './art.js';
import {PeerLink} from './peer.js';
import {PROVIDERS, chooseMove, listModels} from './ai.js';
import {loadSettings, read, write, erase} from './storage.js';
import {chime, setMusic, unlockAudio} from './sound.js';
import {THEME_MUSIC} from './music.js';
import {animateOutcome} from './outcome.js';

const app = document.getElementById('app');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modal-content');
let settings = loadSettings();
let setup = {...{theme:'french',clueTheme:'same',variant:'classic',mode:'ai-giver'},...read('setup',{})};
if (!DECKS[setup.theme]) setup.theme='french';
if (setup.clueTheme !== 'same' && !DECKS[setup.clueTheme]) setup.clueTheme='same';
let game = null, mode = null, localRole='giver', screen='home', selected = new Set(), clueCard=null, relation='similar', draftNote='';
let peer=null, peerStatus='', pendingGuess=false, pairingKind=null, pairingCode='', pairingError='', pairingBusy=false;
let aiBusy=false, aiError='', aiController=null, aiGeneration=0, replayRound=0, toastTimer, lastOutcome;
const colorPreference = matchMedia('(prefers-color-scheme: dark)');
const CARD_SIZES = [['compact','Compact'],['comfortable','Comfortable'],['large','Large']];
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options = (items, current) => items.map(([value,label]) => `<option value="${esc(value)}"${value===current?' selected':''}>${esc(label)}</option>`).join('');
function toast(message) { const node=$('toast');node.textContent=message;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,5500); }
function sound(kind) { chime(kind,settings.sound&&!settings.muted); }
function updateMusic(){setMusic({theme:screen==='home'?setup.theme:game?.theme||setup.theme,enabled:settings.music,volume:settings.musicVolume/100,muted:settings.muted});}
function mountCard(parent,id,opts={}) { const element=cardElement(id,opts);parent.append(element);return element; }
function humanRole() { return mode==='ai-giver'||mode==='peer-guest' ? 'guesser' : mode==='local' ? localRole : 'giver'; }
function currentView() { return mode==='peer-guest' ? game : viewFor(game,humanRole()); }
function isHumanTurn() { return game && game.phase!=='over' && ((game.phase==='clue') === (humanRole()==='giver')); }
function isPeer() { return mode==='peer-host'||mode==='peer-guest'; }
function saveSession() {
  if (game && ['ai-giver','ai-guesser','local','peer-host'].includes(mode)) write('session',{game,mode,localRole});
}
function resetTurn() { selected.clear();clueCard=null;relation='similar';draftNote='';aiError='';pendingGuess=false; }
function cancelAI() { aiGeneration++;aiController?.abort();aiController=null;aiBusy=false; }
function showModal(title,eyebrow,body) {
  modal.classList.remove('outcome-dialog','win','loss');
  modalContent.innerHTML=`<div class="modal-header"><div><p class="eyebrow">${esc(eyebrow)}</p><h2 id="modal-title">${esc(title)}</h2></div><button class="modal-close" id="modal-close" aria-label="Close dialog">×</button></div>${body}`;
  $('modal-close').onclick=()=>modal.close();
  if (!modal.open) modal.showModal();
}
modal.addEventListener('click',event=>{if(event.target===modal&&!$('modal-close')?.hidden){const rect=modal.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)modal.close();}});
modal.addEventListener('close',()=>{
  if(pairingKind && !peer?.connected){peer?.close();peer=null;pairingKind=null;pairingBusy=false;updateConnection();}
});
function inspectCard(id) {
  const card=CARDS[id];if(!card)return;
  showModal(card.name,'Card collection',`<div class="inspect-layout"><div id="inspect-card"></div><div><p class="eyebrow">${esc(DECKS[card.deck].name)}</p><h3>${esc(card.name)}</h3><p>${esc(card.subtitle)}</p><p class="card-dates">${esc(card.dates)}</p><p class="card-description">${esc(card.description)}</p></div></div>`);
  mountCard($('inspect-card'),id);
}
function attachInspect(element,id) {
  if(element.closest('#board,#hand,#replay-board')){
    const wrapper=document.createElement('div');wrapper.className='card-with-details';
    element.replaceWith(wrapper);wrapper.append(element);
    const details=document.createElement('button');details.type='button';details.className='card-details';details.textContent='Details';
    details.setAttribute('aria-label',`View details of ${CARDS[id].name}`);details.onclick=()=>inspectCard(id);wrapper.append(details);
  }
  element.addEventListener('contextmenu',event=>{event.preventDefault();inspectCard(id);});
  element.addEventListener('dblclick',event=>{event.preventDefault();inspectCard(id);});
  element.addEventListener('keydown',event=>{if(event.key.toLowerCase()==='i'){event.preventDefault();inspectCard(id);}});
}
function renderHome() {
  screen='home';updateMusic();
  const saved=read('session',null);
  app.innerHTML=`${saved?.game?.phase!=='over' && saved?.game ? '<div class="resume-banner"><p>There’s an unfinished game on this browser.</p><button class="button small secondary" id="resume">Resume game ↗</button></div>':''}
  <section class="hero"><div><p class="eyebrow">A cooperative game of almost alike</p><h1>Same cards.<br>Different <em>minds.</em></h1><p>One secret card. Five visual clues. Explore people, places and stories—and discover what your partner really meant.</p><div class="hero-tags"><span>2 minds</span><span>5 rounds</span><span>One shared victory</span></div></div><div class="hero-art" id="hero-art"><span class="hero-stamp">TRUST YOUR INTERPRETATION</span></div></section>
  <div class="section-title"><h2>01 / CHOOSE YOUR PARTNER</h2><span>You win or lose together.</span></div>
  <div class="modes">
    <button class="mode ${setup.mode==='peer-host'?'selected':''}" data-mode="peer-host"><span class="mode-icon">⇄</span><span class="arrow">↗</span><h3>Play with a friend</h3><p>You give the clues. Your friend finds the card. Pair your browsers with an invitation.</p></button>
    <button class="mode ${setup.mode==='ai-giver'?'selected':''}" data-mode="ai-giver"><span class="mode-icon">✦</span><span class="arrow">↗</span><h3>Guess the AI’s card</h3><p>Your AI partner plays a card. You decide what it means—and which cards to remove.</p></button>
    <button class="mode ${setup.mode==='ai-guesser'?'selected':''}" data-mode="ai-guesser"><span class="mode-icon">▣</span><span class="arrow">↗</span><h3>Give clues to AI</h3><p>You know the secret. Choose your clues carefully and see how another mind reads them.</p></button>
  </div>
  <section class="setup-panel"><div class="section-title"><h2>02 / SET THE TABLE</h2><span>24 illustrated cards per deck</span></div><div class="deck-grid" id="deck-grid"></div>
  <div class="setup-options"><div><label class="field-label" for="clue-theme">Clue deck</label><select id="clue-theme">${options([['same','Same as the board'],...Object.values(DECKS).map(d=>[d.id,d.name])],setup.clueTheme)}</select><p class="help-text">Mix themes for unexpected associations.</p></div><div><span class="field-label">The clue giver’s hand</span><div class="segmented"><button id="classic" class="${setup.variant==='classic'?'selected':''}" aria-pressed="${setup.variant==='classic'}">Classic</button><button id="fixed" class="${setup.variant==='fixed'?'selected':''}" aria-pressed="${setup.variant==='fixed'}">Fixed five</button></div><p class="help-text">${setup.variant==='fixed'?'Five cards to start. No refills. Make every card count.':'Five cards in hand. Draw a new card after each clue.'}</p></div></div>
  <div class="setup-bottom"><p class="help-text">${setup.mode==='peer-host'?'Share an invitation, then paste your friend’s reply. No accounts or room server.':`AI partner: ${esc(settings.models[settings.provider])}<br>Explanations stay sealed until the final reveal.`}</p><button class="button" id="start-game">${setup.mode==='peer-host'?'Create invitation ⇄':'Deal the cards ↗'}</button></div></section>
  <div class="home-bottom"><button class="text-button" id="join-friend">Have an invitation? Join your friend →</button><button class="text-button" id="play-local">Play on one screen</button><button class="text-button" id="theme-ideas">More theme ideas ✦</button></div><div class="home-bottom"><button class="text-button" id="open-replay">Open a saved replay ↓</button><button class="text-button" id="browse-decks">Browse the card collection ▣</button><input id="replay-file" type="file" accept="application/json,.json" hidden></div>`;
  ['french-17','cities-0','singers-9'].forEach(id=>$('hero-art').insertBefore(cardElement(id),$('hero-art').querySelector('.hero-stamp')));
  for(const deck of Object.values(DECKS)) {
    const button=document.createElement('button');button.className=`deck-choice ${setup.theme===deck.id?'selected':''}`;button.type='button';button.setAttribute('aria-pressed',String(setup.theme===deck.id));
    mountCard(button,deck.cards[deck.preview ?? (deck.id==='greek'?4:deck.id==='scientists'?15:deck.id==='writers'?11:deck.id==='philosophers'?0:5)].id);
    const copy=document.createElement('div');copy.innerHTML=`<h3>${esc(deck.name)}</h3><p>${esc(deck.subtitle)}</p>`;button.append(copy);
    if(setup.theme===deck.id){const tick=document.createElement('span');tick.className='tick';tick.textContent='✓';button.append(tick);}
    button.onclick=()=>{setup.theme=deck.id;saveSetup();renderHome();};$('deck-grid').append(button);
  }
  app.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{setup.mode=button.dataset.mode;saveSetup();renderHome();});
  $('clue-theme').onchange=event=>{setup.clueTheme=event.target.value;saveSetup();};
  $('classic').onclick=()=>{setup.variant='classic';saveSetup();renderHome();};$('fixed').onclick=()=>{setup.variant='fixed';saveSetup();renderHome();};
  $('start-game').onclick=()=>start(setup.mode);
  $('join-friend').onclick=()=>openPairing('guest');
  $('play-local').onclick=()=>start('local');
  $('theme-ideas').onclick=showThemeIdeas;
  $('open-replay').onclick=()=>$('replay-file').click();
  $('replay-file').onchange=event=>importReplay(event.target.files[0]);
  $('browse-decks').onclick=()=>showCollection(setup.theme);
  if($('resume'))$('resume').onclick=resumeGame;
}
function saveSetup(){write('setup',setup);}
function gameOptions(){return {theme:setup.theme,clueTheme:setup.clueTheme==='same'?setup.theme:setup.clueTheme,variant:setup.variant};}
function start(nextMode) {
  if(nextMode.startsWith('ai-')&&!settings.keys[settings.provider]){toast('Add a provider key, then deal the cards.');openSettings();return;}
  cancelAI();peer?.close();peer=null;updateConnection();
  if(nextMode==='peer-host'){openPairing('host');return;}
  mode=nextMode;game=createGame(gameOptions());localRole='giver';resetTurn();screen='game';saveSession();renderGame();
  if(mode==='local')showPassScreen();else runAI();
}
function resumeGame(){
  const saved=read('session',null);
  if(!saved?.game || !['ai-giver','ai-guesser','local','peer-host'].includes(saved.mode)) {erase('session');toast('No saved game is available.');renderHome();return;}
  try {
    validatePublicView(viewFor(saved.game,'guesser'));
    if(!saved.game.board.includes(saved.game.secret)||!Array.isArray(saved.game.hand)||saved.game.hand.some(id=>!CARDS[id])||!Array.isArray(saved.game.draw)||saved.game.draw.some(id=>!CARDS[id]))throw new Error();
    cancelAI();game=saved.game;mode=saved.mode;localRole=saved.localRole==='guesser'?'guesser':'giver';resetTurn();screen=game.phase==='over'?'reveal':'game';
    if(mode==='peer-host' && game.phase!=='over') {renderGame();openPairing('host',true);}
    else if(game.phase==='over')renderReveal();else {renderGame();if(mode==='local')showPassScreen();else runAI();}
  }catch{erase('session');toast('The saved game could not be restored. Start a new one.');renderHome();}
}
function showPassScreen(){
  app.hidden=true;
  showModal(`Pass to the ${localRole==='giver'?'clue giver':'guesser'}`,'One-screen play',`<p class="pair-copy">${localRole==='giver'?'Only the clue giver should see the secret card and hand. The guesser looks away until the clue has been played.':'The secret and private hand are hidden. Read the clues and choose which cards to remove.'}</p><button class="button wide" id="pass-ready">I’m the ${localRole==='giver'?'clue giver':'guesser'} · Ready ↗</button>`);
  $('modal-close').hidden=true;
  modal.oncancel=event=>event.preventDefault();
  $('pass-ready').onclick=()=>{app.hidden=false;modal.oncancel=null;modal.close();};
}
function renderGame(){
  if(!game)return;
  if(game.phase==='over'){screen='reveal';renderReveal();return;}
  screen='game';updateMusic();
  const focused=document.activeElement;
  const focusedId=focused?.id;
  const focusedCard=focused?.closest?.('.card');
  const focusZone=focusedCard?.closest('#board,#hand')?.id;
  screen='game';const view=currentView(), role=humanRole(), myTurn=isHumanTurn();
  const turnTitle=myTurn?(role==='giver'?'Make a connection.':`Remove ${REMOVALS[view.round]} ${REMOVALS[view.round]===1?'card.':'cards.'}`):(aiBusy?'Your partner is thinking.':role==='giver'?'Your partner is guessing.':'A clue is on its way.');
  const turnCopy=myTurn?(role==='giver'?'Pick a card from your hand. Does it share a trait with the secret, or suggest a difference?':'Keep the secret card on the table. Every clue still counts. Click cards to mark them for removal.'):
    isPeer()?'The next move belongs to your friend. Their interpretation stays sealed until the reveal.':'Your AI partner sees only the information allowed for its role. Its explanation stays sealed.';
  const latest=view.history.at(-1);
  app.innerHTML=`<div class="game-heading"><div><p class="eyebrow">${esc(DECKS[view.theme].name)} · ${view.variant==='fixed'?'Fixed five':'Classic hand'}</p><h1>Find the one.</h1><p>${mode==='local'?'One-screen play':isPeer()?'Two browsers. One shared victory.':`With ${esc(settings.models[settings.provider])}`} · You are the ${role==='giver'?'clue giver':'guesser'}.</p></div><div class="controls"><button class="button small secondary" id="leave-table">Leave table</button></div></div>
  <div class="table-layout"><section class="board-section"><div class="board-label"><span>THE BOARD · ${remaining(view).length} STILL IN PLAY</span><label class="card-size-control" for="table-card-size">Card size <select id="table-card-size">${options(CARD_SIZES,settings.tableCardSize)}</select></label></div><div class="board" id="board"></div>
  <section class="history-section"><div class="section-title"><h2>THE CLUE TRAIL</h2><span>All clues remain relevant.</span></div><div class="clue-history" id="clue-history"></div></section>
  ${role==='giver'?`<section class="hand-section"><div class="section-title"><h2>YOUR PRIVATE HAND</h2><span>${view.variant==='fixed'?`${view.hand.length} LEFT · NO REFILLS`:'5 CARDS · REFILLS AFTER PLAY'}</span></div><div class="hand" id="hand"></div></section>`:''}</section>
  <aside class="side-panel"><p class="eyebrow">Round ${view.round+1} / 5</p><div class="round-track">${REMOVALS.map((n,i)=>`<span class="round-step ${i===view.round?'current':i<view.round?'done':''}" title="Round ${i+1}: remove ${n}">${i<view.round?'✓':n}</span>`).join('')}</div>${latest?`<div class="current-clue ${latest.relation}"><div id="current-clue-art"></div><div><small>CLUE ${latest.round}</small><p>${esc(CARDS[latest.card].name)}</p><strong>${latest.relation==='similar'?'↑ Similar':'→ Different'}</strong></div></div>`:''}<h2 class="turn-title">${turnTitle}</h2><p class="turn-copy">${turnCopy}</p>
  ${role==='giver'?'<div class="secret-preview"><div id="secret-preview"></div><div><p>'+esc(CARDS[view.secret].name)+'</p><small>Your secret card.<br>Keep it on the table.</small></div></div>':''}
  ${myTurn&&role==='guesser'&&view.round===4?'<button class="button small secondary wide" id="compare-final">Compare the final two ▣</button>':''}
  ${myTurn?`<form id="turn-form" class="turn-form">${role==='giver'?`<span class="field-label">The connection</span><div class="segmented"><button type="button" id="similar" class="${relation==='similar'?'selected':''}" aria-pressed="${relation==='similar'}">↑ Similar</button><button type="button" id="different" class="${relation==='different'?'selected':''}" aria-pressed="${relation==='different'}">→ Different</button></div>`:''}<label class="private-label" for="turn-note">Your interpretation <span>SEALED UNTIL THE END</span></label><textarea id="turn-note" maxlength="1200" placeholder="Optional: what connection are you making?">${esc(draftNote)}</textarea><button class="button wide ${role==='guesser'?'danger':''}" id="confirm-move" type="submit">${role==='giver'?'Play this clue ↑':'Confirm removal ×'}</button><p class="selection-count" id="selection-count"></p></form>`:''}
  ${aiBusy?'<div class="thinking" role="status"><i></i><i></i><i></i><span>Reading the table…</span></div><button class="text-button" id="cancel-ai">Cancel request</button>':''}
  ${aiError?`<div class="inline-error" role="alert">${esc(aiError)}</div><div class="pair-actions"><button class="button small" id="retry-ai">Retry turn</button><button class="button small secondary" id="fix-ai">Settings</button></div>`:''}
  ${pendingGuess?'<p class="status-note" role="status">Waiting for your partner’s browser to confirm your move…</p>':''}
  ${isPeer()&&!peer?.connected?'<p class="status-note">The connection is paused. Keep this game open and pair again.</p><button class="button small secondary" id="reconnect">Reconnect ⇄</button>':''}
  <p class="help-text">Tap Details below a card to read its dates and biography. Tap a clue to inspect it.</p></aside></div>`;
  for(let i=0;i<view.board.length;i++){
    const id=view.board[i], removed=view.eliminated.includes(id);
    const element=mountCard($('board'),id,{interactive:true,label:String(i+1).padStart(2,'0'),selected:selected.has(id),eliminated:removed,secret:role==='giver'&&id===view.secret,
      onClick:()=>{if(myTurn&&role==='guesser'&&!removed&&!pendingGuess){if(selected.has(id))selected.delete(id);else if(selected.size<REMOVALS[view.round])selected.add(id);else{toast(`Choose exactly ${REMOVALS[view.round]} cards. Unmark one to change your choice.`);return;}sound('select');renderGame();}else inspectCard(id);}});
    attachInspect(element,id);
  }
  renderClues($('clue-history'),view.history);
  if(latest)mountCard($('current-clue-art'),latest.card,{interactive:true,onClick:()=>inspectCard(latest.card)});
  if(role==='giver'){
    const section=$('hand').closest('.hand-section');
    $('board').parentElement.insertBefore(section,$('board').parentElement.querySelector('.history-section'));
    mountCard($('secret-preview'),view.secret);
    for(const id of view.hand){const element=mountCard($('hand'),id,{interactive:true,className:clueCard===id?'chosen':'',onClick:()=>{if(myTurn){clueCard=id;sound('select');renderGame();}else inspectCard(id);}});attachInspect(element,id);}
  }
  if(myTurn){
    $('turn-note').oninput=event=>draftNote=event.target.value;
    $('turn-form').onsubmit=event=>{event.preventDefault();submitMove();};
    if(role==='giver'){$('similar').onclick=()=>{relation='similar';renderGame();};$('different').onclick=()=>{relation='different';renderGame();};}
    updateConfirm();
  }
  $('table-card-size').onchange=event=>{settings.tableCardSize=event.target.value;persistPreferences();applyPreferences();};
  $('leave-table').onclick=confirmLeave;
  if($('retry-ai'))$('retry-ai').onclick=()=>{aiError='';runAI();};
  if($('fix-ai'))$('fix-ai').onclick=openSettings;
  if($('cancel-ai'))$('cancel-ai').onclick=()=>{cancelAI();aiError='Request cancelled. Retry when you’re ready.';renderGame();};
  if($('reconnect'))$('reconnect').onclick=()=>openPairing(mode==='peer-host'?'host':'guest',true);
  if($('compare-final'))$('compare-final').onclick=()=>compareFinal(view);
  if(focusedId && $(focusedId))$(focusedId).focus({preventScroll:true});
  else if(focusZone && focusedCard){const replacement=$(focusZone)?.querySelector(`[data-card="${focusedCard.dataset.card}"]`);replacement?.focus({preventScroll:true});}
}
function compareFinal(view){
  const latest=view.history.at(-1);
  showModal('One connection decides it.','The final two',`<div class="replay-clue"><div id="compare-clue"></div><div><h3>${esc(CARDS[latest.card].name)}</h3><p>${latest.relation==='similar'?'↑ Similar':'→ Different'}</p></div></div><div class="final-pair" id="final-pair"></div><p class="help-text">Look for a trait that distinguishes these two. Consider the illustration as well as the subject’s story.</p>`);
  mountCard($('compare-clue'),latest.card,{className:latest.relation==='different'?'sideways':''});
  for(const id of remaining(view))mountCard($('final-pair'),id,{interactive:true,onClick:()=>{selected.clear();selected.add(id);modal.close();renderGame();toast(`${CARDS[id].name} marked for removal. Confirm your choice on the table.`);}});
}
function renderClues(parent,history){
  if(!history.length){parent.innerHTML='<p class="empty-clues">The first clue will appear here. Similar ↑ · Different →</p>';return;}
  for(const round of history){const token=document.createElement('div');token.className=`clue-token ${round.relation}`;
    const art=mountCard(token,round.card,{interactive:true,onClick:()=>inspectCard(round.card)});attachInspect(art,round.card);
    const p=document.createElement('p');p.textContent=`${round.relation==='similar'?'↑':'→'} ${round.relation}`;
    const small=document.createElement('small');small.textContent=`ROUND ${round.round}`;const name=document.createElement('span');name.className='clue-name';name.textContent=CARDS[round.card].name;token.append(name,p,small);parent.append(token);}
}
function updateConfirm(){
  const role=humanRole();const permitted=!isPeer()||peer?.connected;
  $('confirm-move').disabled=!permitted||pendingGuess||(role==='giver'?!clueCard:selected.size!==REMOVALS[game.round]);
  $('selection-count').textContent=role==='giver'?(clueCard?CARDS[clueCard].name:'Choose one card from your hand.'):`${selected.size} / ${REMOVALS[game.round]} marked for removal`;
}
function submitMove(){
  try{
    if(!isHumanTurn()||pendingGuess)return;
    const role=humanRole();const action=role==='giver'?{card:clueCard,relation,rationale:draftNote,source:'Human'}:{cards:[...selected],rationale:draftNote,source:'Human'};
    if(mode==='peer-guest'){peer.send({type:'guess',gameId:game.id,revision:game.revision,action});pendingGuess=true;renderGame();return;}
    if(isPeer()&&!peer?.connected)throw new Error('Reconnect your partner before continuing.');
    commitGame(role==='giver'?playClue(game,action):eliminate(game,action));
    if(mode==='local'&&game.phase!=='over'){localRole=role==='giver'?'guesser':'giver';saveSession();renderGame();showPassScreen();}
    else runAI();
  }catch(error){toast(error.message);}
}
function commitGame(next){
  const oldPhase=game.phase;game=next;resetTurn();saveSession();
  if(mode==='peer-host'&&peer?.connected)sendState();
  if(game.phase==='over'){replayRound=Math.max(0,game.history.length-1);renderReveal();}
  else{sound(oldPhase==='clue'?'clue':'select');renderGame();}
}
async function runAI(){
  if(!game||screen!=='game'||!mode?.startsWith('ai-')||isHumanTurn()||game.phase==='over'||aiBusy)return;
  const generation=++aiGeneration, id=game.id, revision=game.revision;
  const role=humanRole()==='giver'?'guesser':'giver';
  aiBusy=true;aiError='';const controller=new AbortController();aiController=controller;renderGame();
  const timeout=setTimeout(()=>controller.abort(),180000);
  try{
    const image=observationImage(game,role);let next;let correction='';
    for(let attempt=0;attempt<2;attempt++){
      let move;
      try {move=await chooseMove(settings,game,role,image,controller.signal,correction);}
      catch(error){if(error.code!=='INVALID_MOVE'||attempt===1)throw error;correction=`Your previous output was invalid: ${error.message} Return ONLY the JSON move with the required fields.`;continue;}
      if(generation!==aiGeneration||game.id!==id||game.revision!==revision)return;
      try {next=role==='giver'?playClue(game,move):eliminate(game,move);break;}
      catch(error){if(attempt===1)throw error;correction=`Your previous move was invalid: ${error.message} Return a corrected legal move.`;}
    }
    aiBusy=false;commitGame(next);
  }catch(error){
    if(generation!==aiGeneration)return;
    aiBusy=false;aiError=error.name==='AbortError'?'The request timed out. Retry this turn or choose a faster model.':error.message;renderGame();
  }finally{clearTimeout(timeout);if(generation===aiGeneration)aiController=null;}
}
function confirmLeave(){
  showModal('Leave this table?','Game in progress',`<p class="pair-copy">${isPeer()?'Your friend will be disconnected. The clue giver can resume this game and create a fresh invitation.':'Your game is saved on this browser. You can resume it from the opening screen.'}</p><div class="pair-actions"><button class="button secondary" id="stay">Keep playing</button><button class="button danger" id="leave-confirm">Leave table</button></div>`);
  $('stay').onclick=()=>modal.close();$('leave-confirm').onclick=()=>{saveSession();cancelAI();const old=peer;peer=null;old?.close();mode=null;game=null;pairingKind=null;modal.close();app.hidden=false;updateConnection();renderHome();};
}
function renderReveal(){
  if(!game||game.phase!=='over')return;
  screen='reveal';app.hidden=false;updateMusic();const view=currentView();replayRound=Math.min(replayRound,view.history.length-1);const round=view.history[replayRound];
  app.innerHTML=`<section class="reveal-hero ${view.result}"><div><p class="eyebrow">${view.result==='win'?'A shared victory':'The secret slipped away'}</p><h1>${view.result==='win'?'You both win!':'You both lose.'}</h1><p>The secret was <strong>${esc(CARDS[view.secret].name)}</strong>. ${view.result==='win'?'You kept it on the table through all five rounds.':'It was removed in round '+view.history.length+'.'} Now open the sealed interpretations.</p><div class="reveal-controls"><button class="button small" id="rematch">Deal again ↗</button><button class="button small secondary" id="export-replay">Save replay ↓</button><button class="button small secondary" id="reveal-home">Back to start</button></div></div><div id="reveal-secret"></div></section>
  <div class="section-title"><h2>WHAT DID YOU SEE?</h2><span>Recorded when each move was made.</span></div><nav class="replay-tabs" aria-label="Replay rounds">${view.history.map((r,i)=>`<button class="replay-tab ${replayRound===i?'selected':''}" data-round="${i}" aria-pressed="${replayRound===i}">Round ${i+1} ${r.removed.includes(view.secret)?'×':'✓'}</button>`).join('')}</nav>
  <div class="replay-layout"><section><div class="board-label"><span>THE BOARD BEFORE ROUND ${replayRound+1}</span><span>RED MARKS: REMOVED THIS ROUND</span></div><div class="board replay-board" id="replay-board"></div></section><aside class="side-panel"><div class="replay-clue"><div id="replay-clue"></div><div><h3>${esc(CARDS[round.card].name)}</h3><p>${round.relation==='similar'?'↑ Similar':'→ Different'}</p></div></div><div class="rationale"><h3>The clue giver meant</h3><p>${esc(round.giverNote||'No interpretation was recorded.')}</p><small>${esc(round.giverSource||'Human')}</small></div><div class="rationale"><h3>The guesser saw</h3><p>${esc(round.guesserNote||'No interpretation was recorded.')}</p><small>${esc(round.guesserSource||'Human')}</small></div><p class="removed-list">Removed: <strong>${esc(round.removed.map(id=>CARDS[id].name).join(', '))}</strong></p></aside></div>`;
  mountCard($('reveal-secret'),view.secret);
  for(let i=0;i<view.board.length;i++){
    const id=view.board[i];const el=mountCard($('replay-board'),id,{interactive:true,label:String(i+1).padStart(2,'0'),secret:id===view.secret,eliminated:!round.active.includes(id),className:round.removed.includes(id)?'removed-this-round':'',onClick:()=>inspectCard(id)});attachInspect(el,id);
  }
  mountCard($('replay-clue'),round.card,{className:round.relation==='different'?'sideways':''});
  app.querySelectorAll('[data-round]').forEach(button=>button.onclick=()=>{replayRound=Number(button.dataset.round);renderReveal();});
  $('rematch').onclick=rematch;
  $('export-replay').onclick=exportReplay;
  $('reveal-home').onclick=()=>{cancelAI();const old=peer;peer=null;old?.close();mode=null;game=null;pairingKind=null;erase('session');updateConnection();renderHome();};
  if(mode==='peer-guest'){$('rematch').textContent='Ask for another game ⇄';$('rematch').disabled=!peer?.connected;}
  if(mode==='replay'){$('rematch').textContent='Play this setup ↗';}
  if(mode!=='replay'&&lastOutcome!==view.id){
    lastOutcome=view.id;window.scrollTo({top:0,behavior:'instant'});sound(view.result);showOutcome(view);
  }
}
function showOutcome(view){
  const win=view.result==='win';
  showModal(win?'GAME WON!':'GAME LOST',win?'One shared victory':'The secret was removed',`<canvas class="outcome-canvas" id="outcome-canvas" aria-hidden="true"></canvas><div class="outcome-content"><div class="outcome-emblem" aria-hidden="true">${win?'✦':'×'}</div><p class="outcome-summary">${win?'Five rounds. One card left. You did it together.':'The secret left the table in round '+view.history.length+'.'}</p><div id="outcome-secret"></div><p class="outcome-secret-name">${esc(CARDS[view.secret].name)}</p><p class="outcome-caption">${win?'The secret stayed safe.':'This was the card to protect.'}</p><button class="button wide ${win?'':'danger'}" id="outcome-continue">Open the interpretations ↗</button></div>`);
  modal.classList.add('outcome-dialog',view.result);mountCard($('outcome-secret'),view.secret);
  $('outcome-continue').onclick=()=>modal.close();$('outcome-continue').focus();
  animateOutcome($('outcome-canvas'),view.result,settings.effects);
  toast(win?'You both win! The secret survived all five rounds.':'You both lose. The secret was removed in round '+view.history.length+'.');
}
function rematch(){
  if(mode==='replay'){setup.theme=game.theme;setup.clueTheme=game.clueTheme===game.theme?'same':game.clueTheme;setup.variant=game.variant;game=null;mode=null;renderHome();return;}
  if(mode==='peer-guest'){try{peer.send({type:'rematch-request',gameId:game.id});toast('Your partner has been asked to deal again.');}catch(error){toast(error.message);}return;}
  if(mode==='peer-host'){
    if(!peer?.connected){toast('Reconnect your friend to deal again.');openPairing('host',true);return;}
    game=createGame({theme:game.theme,clueTheme:game.clueTheme,variant:game.variant});resetTurn();saveSession();sendState();renderGame();return;
  }
  const oldMode=mode;setup.theme=game.theme;setup.clueTheme=game.clueTheme===game.theme?'same':game.clueTheme;setup.variant=game.variant;
  if(oldMode.startsWith('ai-')){
    showModal('Play another round?','Swap perspectives',`<p class="pair-copy">Try the other role and discover how your partner reads your clues.</p><div class="pair-actions"><button class="button" id="swap-roles">Swap roles ↗</button><button class="button secondary" id="same-role">Keep my role</button></div>`);
    $('swap-roles').onclick=()=>{modal.close();start(oldMode==='ai-giver'?'ai-guesser':'ai-giver');};$('same-role').onclick=()=>{modal.close();start(oldMode);};
  }else start(oldMode);
}
function exportReplay(){
  const view=viewFor(game,'guesser');
  const blob=new Blob([JSON.stringify({format:'similo-arcade-replay',version:PROTOCOL,game:view},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`similo-${game.theme}-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('Replay saved. It contains the board and revealed notes, with no provider keys.');
}
async function importReplay(file){
  if(!file)return;
  try{
    if(file.size>131072)throw new Error('This replay is too large.');
    const replay=JSON.parse(await file.text());
    if(replay.format!=='similo-arcade-replay'||replay.version!==PROTOCOL||replay.game?.phase!=='over'||!replay.game.history?.length)throw new Error('Choose a completed Similo Arcade replay.');
    const imported=validatePublicView(replay.game);
    if(imported.history.some(r=>!Number.isInteger(r.round)||r.round<1||r.round>5||['giverNote','guesserNote','giverSource','guesserSource'].some(k=>typeof r[k]!=='string'||r[k].length>1200)))throw new Error('This replay contains invalid round notes.');
    cancelAI();peer?.close();peer=null;mode='replay';game=imported;replayRound=0;resetTurn();updateConnection();renderReveal();
  }catch(error){toast(error instanceof SyntaxError?'This file is not a valid replay.':error.message);}
}
function updateConnection(){
  const badge=$('connection-badge');badge.hidden=!peer;badge.textContent=peer?.connected?'● FRIEND CONNECTED':peerStatus==='connecting'?'◌ CONNECTING':'○ DISCONNECTED';badge.classList.toggle('offline',!peer?.connected);
}
function sendState(){peer.send({type:'state',game:viewFor(game,'guesser')});}
function newPeer(){
  const old=peer;peer=null;old?.close();
  const link=new PeerLink({stun:settings.stun,onStatus:status=>{
    if(peer!==link)return;peerStatus=status;updateConnection();
    if(status==='open'){
      pairingKind=null;pairingBusy=false;pairingError='';
      if(mode==='peer-host'){if(!game)game=createGame(gameOptions());saveSession();sendState();renderGame();}
      else{link.send({type:'hello'});}
      modal.close();toast('Connected. Your shared table is ready.');
    }else if(['closed','failed','disconnected'].includes(status)){
      pendingGuess=false;
      if(screen==='game')renderGame();
      if(status==='failed'){
        pairingBusy=false;pairingError='The browsers could not connect. Try a different network, or change the STUN server in Settings. Some networks need a relay, which this direct-pairing game does not use.';
        if(pairingKind)renderPairing();else toast('Connection lost. Create a fresh invitation to reconnect.');
      }
    }
  },onMessage:message=>handlePeerMessage(message)});
  peer=link;updateConnection();return link;
}
function handlePeerMessage(message){
  try{
    if(mode==='peer-host'){
      if(message.type==='hello'){sendState();return;}
      if(message.type==='guess'){
        if(!game||message.gameId!==game.id||message.revision!==game.revision)throw new Error('The table has changed. Your move was not applied; choose again.');
        commitGame(eliminate(game,{...message.action,source:'Human'}));return;
      }
      if(message.type==='rematch-request'&&message.gameId===game?.id&&game.phase==='over'){toast('Your friend would like another game. Choose “Deal again” to begin.');return;}
      throw new Error('Unknown message from your partner.');
    }
    if(mode==='peer-guest'){
      if(message.type==='state'){
        const next=validatePublicView(message.game);
        if(game?.id===next.id && next.revision<=game.revision)return;
        if(game && game.id!==next.id && game.phase!=='over')throw new Error('Unexpected new game. Pair again to resynchronize.');
        if(game && next.id===game.id && next.revision>game.revision+1)toast('The table has been resynchronized.');
        const oldPhase=game?.phase;game=next;resetTurn();
        if(next.phase==='over'){replayRound=next.history.length-1;renderReveal();}
        else{if(oldPhase==='clue'&&next.phase==='guess')sound('clue');renderGame();}
        return;
      }
      if(message.type==='error'){pendingGuess=false;toast(String(message.message).slice(0,500));renderGame();return;}
    }
  }catch(error){
    if(mode==='peer-host'&&peer?.connected)peer.send({type:'error',message:error.message});
    else toast(error.message);
  }
}
function openPairing(kind,reconnect=false,initial=''){
  cancelAI();pairingKind=kind;pairingCode='';pairingError='';pairingBusy=false;
  if(!reconnect){game=null;mode=kind==='host'?'peer-host':'peer-guest';resetTurn();}
  else mode=kind==='host'?'peer-host':'peer-guest';
  if(kind==='guest'&&reconnect)game=null;
  try{newPeer();renderPairing(initial);}catch(error){toast(error.message);pairingKind=null;}
}
function renderPairing(initial=''){
  if(!pairingKind)return;const host=pairingKind==='host';
  showModal(host?'Invite your guesser.':'Join your clue giver.','Two browsers · one table',`<div class="pair-steps"><span class="${!pairingCode?'active':''}">1. Invitation</span><span class="${pairingCode?'active':''}">2. Reply</span><span>3. Play</span></div>
  <p class="pair-copy">${host?'You’ll give the clues. Send your friend the invitation link. They’ll open it and send you a reply code to paste below.':'Your friend gives the clues; you guess the card. Paste their invitation, create a reply, and send that reply back.'}</p>
  ${host?(pairingCode?`<label class="field-label" for="pair-output">Send this invitation link</label><textarea id="pair-output" class="code-box" readonly spellcheck="false">${esc(invitationLink(pairingCode))}</textarea><button class="button small secondary" id="copy-pair">Copy invitation ↗</button><label class="field-label" for="pair-input" style="margin-top:22px">Paste your friend’s reply code</label><textarea id="pair-input" class="code-box" spellcheck="false" placeholder="SIMZ1.…"></textarea><button class="button wide" id="accept-reply" ${pairingBusy?'disabled':''}>${pairingBusy?'Connecting…':'Connect & play ⇄'}</button>`:
    `<button class="button wide" id="create-offer" ${pairingBusy?'disabled':''}>${pairingBusy?'Preparing invitation…':'Create invitation ⇄'}</button>`):
    (pairingCode?`<label class="field-label" for="pair-output">Send this reply code to your friend</label><textarea id="pair-output" class="code-box" readonly spellcheck="false">${esc(pairingCode)}</textarea><button class="button wide" id="copy-pair">Copy reply code ↗</button><p class="status-note">Keep this window open. The game begins when your friend accepts your reply.</p>`:
    `<label class="field-label" for="pair-input">Invitation link or code</label><textarea id="pair-input" class="code-box" spellcheck="false" placeholder="Paste the complete invitation here…">${esc(initial)}</textarea><button class="button wide" id="create-answer" ${pairingBusy?'disabled':''}>${pairingBusy?'Preparing reply…':'Create reply code ⇄'}</button>`)}
  ${pairingError?`<p class="inline-error" role="alert">${esc(pairingError)}</p><button class="text-button" id="retry-pair">Start pairing again</button>`:''}
  <p class="help-text">Pairing uses a direct browser connection and a public STUN service to find a route. There’s no room server. Keep both tabs open. Some restricted networks may prevent a direct connection.</p>`);
  if($('create-offer'))$('create-offer').onclick=async()=>{
    const link=peer;pairingBusy=true;renderPairing();
    try{pairingCode=await link.invite();if(peer!==link||!pairingKind)return;pairingBusy=false;renderPairing();}
    catch(error){if(peer!==link)return;pairingBusy=false;pairingError=error.message;renderPairing();}
  };
  if($('create-answer'))$('create-answer').onclick=async()=>{
    const input=$('pair-input').value,link=peer;pairingBusy=true;renderPairing(input);
    try{pairingCode=await link.join(input);if(peer!==link||!pairingKind)return;pairingBusy=false;renderPairing();}
    catch(error){if(peer!==link)return;pairingBusy=false;pairingError=error.message;renderPairing(input);}
  };
  if($('accept-reply'))$('accept-reply').onclick=async()=>{
    const input=$('pair-input').value,link=peer;pairingBusy=true;renderPairing();
    try{await link.accept(input);if(peer!==link||!pairingKind)return;pairingBusy=false;renderPairing();toast('Connecting the two browsers…');}
    catch(error){if(peer!==link)return;pairingBusy=false;pairingError=error.message;renderPairing();}
  };
  if($('copy-pair'))$('copy-pair').onclick=async()=>{try{await navigator.clipboard.writeText($('pair-output').value);toast(host?'Invitation copied. Send it to your friend.':'Reply copied. Send it to your friend.');}catch{$('pair-output').select();toast('Select and copy the code manually.');}};
  if($('retry-pair'))$('retry-pair').onclick=()=>openPairing(host?'host':'guest',!!game,initial);
}
function invitationLink(code){return location.href.split('#')[0]+'#pair='+encodeURIComponent(code);}
function showRules(){
  showModal('A little trust goes a long way.','How to play',`<p class="pair-copy">You’re a team. Keep one secret card on the table through five rounds.</p><ol class="rules-list"><li><strong>The clue giver sees the secret.</strong> There are 12 cards on the board and five private cards in the giver’s hand.</li><li><strong>Play one illustrated clue.</strong> Choose Similar ↑ for a shared trait, or Different → for a contrast. It can be a job, an era, a date, geography, a story, a trait, or a visual detail. Inspect cards for their dates and biographies. Only the card and its direction are shared.</li><li><strong>The guesser removes cards.</strong> Remove 1, then 2, then 3, then 4, then 1. All previous clues remain relevant.</li><li><strong>Leave the secret standing.</strong> Removing it ends the game immediately. If it’s the last card left, you both win.</li><li><strong>Open your sealed interpretations.</strong> Optional human notes and AI explanations are recorded with each move, then revealed together at the end.</li></ol><div class="rules-rounds"><span>1</span><span>2</span><span>3</span><span>4</span><span>1</span></div><p class="help-text"><strong>Classic:</strong> draw a new card after each clue.<br><strong>Fixed five:</strong> start with five cards and never draw replacements. Choose the order carefully.<br><strong>Mixed decks:</strong> use one theme for cards and another for clues.</p><p class="help-text">This is an independent game inspired by Similo, designed by Hjalmar Hach, Pierluca Zizzi and Martino Chiacchiera. The illustrations here are original generated artwork; they are not the commercial card art.</p>`);
}
function showThemeIdeas(){showModal('More worlds to interpret.','Future deck ideas',`<div class="theme-ideas">${THEME_IDEAS.map(([name,description])=>`<div class="theme-idea"><h3>${esc(name)}</h3><p>${esc(description)}</p></div>`).join('')}</div><p class="help-text">All ${Object.keys(DECKS).length} illustrated decks are available now. These are suggestions for future additions.</p>`);}
function showCollection(theme){
  showModal('The card collection.',`${Object.keys(DECKS).length} illustrated worlds`,`<label class="field-label" for="collection-theme">Deck</label><select id="collection-theme">${options(Object.values(DECKS).map(d=>[d.id,d.name]),theme)}</select><div class="collection-grid" id="collection-grid"></div><p class="help-text">Select a card to inspect its illustration up close.</p>${DECKS[theme].description?`<p class="help-text">${esc(DECKS[theme].description)}</p>`:''}`);
  for(const card of DECKS[theme].cards)mountCard($('collection-grid'),card.id,{interactive:true,onClick:()=>inspectCard(card.id)});
  $('collection-theme').onchange=event=>showCollection(event.target.value);
}
let settingsDraft, availableModels=[], settingsRemember=true;
function captureSettings(){
  if(!$('provider'))return;const provider=settingsDraft.provider;
  settingsDraft.keys[provider]=$('api-key').value.trim();settingsDraft.models[provider]=$('model').value.trim();settingsDraft.efforts[provider]=$('effort').value;
  settingsDraft.tokenBudget=Number($('token-budget').value);settingsDraft.stun=$('stun').value.trim();settingsDraft.effects=$('effects').checked;settingsDraft.sound=$('sound').checked;settingsDraft.music=$('music').checked;settingsDraft.musicVolume=Number($('music-volume').value);settingsDraft.appearance=$('appearance').value;settingsDraft.tableCardSize=$('preference-card-size').value;settingsRemember=$('remember-key').checked;
}
function openSettings(){settingsDraft=structuredClone(settings);availableModels=[];settingsRemember=settings.rememberKeys!==false;renderSettings();}
function renderSettings(){
  const provider=settingsDraft.provider,info=PROVIDERS[provider];
  showModal('Make yourself at home.','Settings',`<form id="settings-form"><div class="modal-grid"><div class="form-field"><label class="field-label" for="appearance">Appearance</label><select id="appearance">${options([['system','System'],['light','Light'],['dark','Dark']],settingsDraft.appearance)}</select></div><div class="form-field"><label class="field-label" for="preference-card-size">Table card size</label><select id="preference-card-size">${options(CARD_SIZES,settingsDraft.tableCardSize)}</select></div></div><div class="form-field"><label class="field-label" for="provider">Provider</label><select id="provider">${options(Object.entries(PROVIDERS).map(([id,p])=>[id,p.name]),provider)}</select></div>
  <div class="form-field"><label class="field-label" for="api-key">${esc(info.name)} API key</label><div class="form-row"><input id="api-key" type="password" autocomplete="off" spellcheck="false" placeholder="Your personal provider key" value="${esc(settingsDraft.keys[provider]||'')}"><button type="button" class="button small secondary" id="show-key">Show</button></div><label class="check-row"><input type="checkbox" id="remember-key" ${settingsRemember?'checked':''}>Remember keys on this browser</label><p class="help-text">${settingsRemember?'Saved in this browser’s local storage.':'Kept in memory for this visit.'} Keys go directly to your selected provider with AI requests. Browser storage is readable by scripts on this origin; use a personal key with a spending limit. <a href="${info.keyUrl}" target="_blank" rel="noopener noreferrer">Get a key ↗</a></p><button type="button" class="text-button" id="forget-keys">Forget all saved keys</button></div>
  <div class="form-field"><label class="field-label" for="model">Vision model</label><div class="form-row"><input id="model" list="model-list" autocomplete="off" spellcheck="false" value="${esc(settingsDraft.models[provider])}" required><button type="button" class="button small secondary" id="load-models">Load models</button></div><datalist id="model-list">${availableModels.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}</datalist><p class="help-text" id="model-status">${availableModels.length?`${availableModels.length} models available. Select one or enter an exact model ID.`:'Enter an exact model ID, or load the provider’s list. Choose a model that accepts images.'}</p></div>
  <div class="modal-grid"><div class="form-field"><label class="field-label" for="effort">Reasoning effort</label><select id="effort">${options(info.efforts.map(e=>[e,e==='default'?'Provider default':e[0].toUpperCase()+e.slice(1)]),settingsDraft.efforts[provider])}</select></div><div class="form-field"><label class="field-label" for="token-budget">Response token budget</label><select id="token-budget">${options([2048,4096,8192,16384,32768].map(n=>[String(n),n.toLocaleString()]),String(settingsDraft.tokenBudget))}</select></div></div><p class="help-text">Effort support depends on the model. “Provider default” leaves it unset. Higher effort may take longer and needs more response tokens. Unsupported choices are reported; they are never silently changed.</p>
  <details style="margin-top:20px"><summary class="field-label">Music, effects & connection</summary><label class="check-row"><input id="sound" type="checkbox" ${settingsDraft.sound?'checked':''}>Arcade sounds & outcome fanfares</label><label class="check-row"><input id="music" type="checkbox" ${settingsDraft.music?'checked':''}>Theme background music</label><label class="field-label" for="music-volume">Music volume · <span id="music-volume-value">${settingsDraft.musicVolume}%</span></label><input id="music-volume" type="range" min="0" max="70" step="1" value="${settingsDraft.musicVolume}"><p class="help-text">Original composition: ${esc(THEME_MUSIC[screen==='home'?setup.theme:game?.theme||setup.theme].title)}.<br>Music follows the board theme, fades between tracks and pauses when this tab is hidden. The top music button pauses music while keeping sound effects unchanged.</p><label class="check-row"><input id="effects" type="checkbox" ${settingsDraft.effects?'checked':''}>Table animations & result effects</label><label class="field-label" for="stun">STUN server for direct pairing</label><input id="stun" value="${esc(settingsDraft.stun)}" spellcheck="false" placeholder="stun:stun.l.google.com:19302"><p class="help-text">Comma-separated STUN URLs. Leave blank to try local-network connections only. No relay server is used.</p></details>
  <div class="modal-footer"><span class="help-text">No account with this game.<br>No keys in invitations or replays.</span><button class="button" type="submit">Save settings ✓</button></div></form>`);
  $('music-volume').oninput=()=>{$('music-volume-value').textContent=$('music-volume').value+'%';};
  $('provider').onchange=event=>{const next=event.target.value;captureSettings();settingsDraft.provider=next;availableModels=[];renderSettings();};
  $('show-key').onclick=()=>{const field=$('api-key');field.type=field.type==='password'?'text':'password';$('show-key').textContent=field.type==='password'?'Show':'Hide';};
  $('forget-keys').onclick=()=>{settings.keys={};settingsDraft.keys={};write('settings',{...settings,keys:{}});$('api-key').value='';toast('All saved provider keys were removed.');};
  $('load-models').onclick=async()=>{
    captureSettings();const currentProvider=settingsDraft.provider;const button=$('load-models'),status=$('model-status');button.disabled=true;status.textContent='Loading the provider’s model list…';
    try{const models=await listModels(currentProvider,settingsDraft.keys[currentProvider]||'',AbortSignal.timeout(20000));if(!$('provider')||settingsDraft.provider!==currentProvider)return;availableModels=models;$('model-list').innerHTML=models.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');status.textContent=`${models.length} ${currentProvider==='openrouter'?'image-capable ':''}models loaded. You can also enter an exact ID.`;}
    catch(error){status.textContent=error.message;}finally{button.disabled=false;}
  };
  $('settings-form').onsubmit=event=>{
    event.preventDefault();captureSettings();if(!settingsDraft.models[settingsDraft.provider])return;
    if(settingsDraft.stun&&settingsDraft.stun.split(',').some(url=>!/^stuns?:[^\s]+$/.test(url.trim()))){toast('Use STUN URLs such as stun:stun.l.google.com:19302.');return;}
    settings={...settingsDraft,rememberKeys:settingsRemember};const persisted={...settings,keys:settingsRemember?settings.keys:{}};
    const saved=write('settings',persisted);applyPreferences();modal.close();toast(saved?'Settings saved.':'Settings kept for this visit; browser storage is unavailable.');
    if(screen==='home')renderHome();else if(screen==='game')renderGame();
  };
}
function persistPreferences(){write('settings',{...settings,keys:settings.rememberKeys===false?{}:settings.keys});}
function applyAppearance(){
  const theme=settings.appearance==='system'?(colorPreference.matches?'dark':'light'):settings.appearance;
  document.documentElement.dataset.colorTheme=theme;
  document.querySelector('meta[name="theme-color"]').content=theme==='light'?'#f0eadb':'#102e31';
}
colorPreference.addEventListener('change',()=>{if(settings.appearance==='system')applyAppearance();});
function applyPreferences(){
  document.body.classList.toggle('no-effects',!settings.effects);applyAppearance();
  document.documentElement.style.setProperty('--table-card-width',({compact:112,comfortable:160,large:208}[settings.tableCardSize]||160)+'px');
  const audible=!settings.muted&&settings.music,button=$('sound-toggle');
  button.textContent=audible?'♪':'♩';button.setAttribute('aria-pressed',String(audible));
  button.setAttribute('aria-label',audible?'Mute background music':'Play background music');button.title=audible?'Mute music · keep sound effects':'Play background music';updateMusic();
}
$('settings-button').onclick=openSettings;$('rules-button').onclick=showRules;
$('sound-toggle').onclick=()=>{settings.music=!settings.music;persistPreferences();applyPreferences();};
for(const event of ['pointerdown','keydown'])document.addEventListener(event,e=>{if(e.isTrusted)unlockAudio();},{passive:true});
$('home-link').onclick=event=>{event.preventDefault();if(game&&game.phase!=='over')confirmLeave();else{if(screen==='reveal')$('reveal-home').click();else renderHome();}};
window.addEventListener('beforeunload',()=>saveSession());
applyPreferences();startAmbience($('ambience'),()=>settings.effects);
app.innerHTML=`<section class="hero"><div><p class="eyebrow">Setting the table</p><h1>${Object.keys(DECKS).length} worlds.<br>One <em>connection.</em></h1><p>Shuffling the illustrated decks…</p></div></section>`;
try{
  await loadArt();renderHome();
  if(location.hash.startsWith('#pair=')){
    const invitation=location.hash.slice(6);history.replaceState(null,'',location.pathname+location.search);openPairing('guest',false,decodeURIComponent(invitation));
  }
}catch(error){app.innerHTML=`<p class="inline-error">${esc(error.message)}</p><button class="button" id="reload">Reload artwork</button>`;$('reload').onclick=()=>location.reload();}
