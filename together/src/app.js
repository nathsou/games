import {FriendSession, FRIEND_GAMES} from '../../shared/friend-session.js';
import {friendPanel} from '../../shared/friend-panel.js';
import {installFriendChat} from '../../shared/friend-chat-view.js';
import {installSharedPlay} from '../../shared/shared-play-view.js';
import {installPanelVisibility} from '../../shared/friend-panel-visibility.js';
import {FRIEND_PAGES, isFriendPage} from '../../shared/friend-pages.js';
import {SETUP_GAMES, defaultGameSetup, validateGameSetup, renderGameSetup, setupSummary} from '../../shared/friend-setup.js';
import {createHostedRoom, hostedLink, hostedInvitation, roomConfig, roomDetails, claimRoomResume,createRoomCode,resolveRoomCode} from '../../shared/signaling.js';

import {readFriendRoom, saveFriendRoom} from '../../shared/friend-resume.js';
import {normalizeRoomCode} from '../../shared/room-code.js';
import {RoomChat} from '../../shared/room-chat.js';
import {TurnClient,roomRequest} from '../../shared/turn-client.js';
import {readCheckpoint} from '../../shared/game-checkpoint.js';

const savedRoom=readFriendRoom();
let manualOffline=Boolean(savedRoom?.manualOffline),inbox=[],inboxBusy=false,inboxError='',resumeBusy=false,reconnectTimer,reconnectAttempt=0,leaving=false;
document.body.innerHTML = friendPanel;
const $ = id => document.getElementById(id);
const frame=$('game-frame'),dialog=$('friend-dialog');
for(const [game,title] of Object.entries(FRIEND_PAGES))$('next-game').append(new Option(title,game));
for(const [game,title] of Object.entries(SETUP_GAMES))$('room-game').append(new Option(title,game));
const url=new URL(location.href);
const initialGame=!url.hash&&savedRoom&&isFriendPage(savedRoom.page)?savedRoom.page:isFriendPage(url.searchParams.get('game'))?url.searchParams.get('game'):'collection';
let autoInvite=url.searchParams.get('action')==='invite', autoJoin=url.searchParams.get('action')==='join';
const invitation=url.hash;url.hash='';url.searchParams.delete('action');history.replaceState(null,'',url);
let renderChat,renderScreen,readInviteSetup,readNextSetup;
let inviteGame='collection',nextGame,inviteDefaults;
function showError(message){$('friend-error').textContent=message;$('friend-error').hidden=false;}
function loadGame(game) {
  frame.contentWindow?.__gameCheckpoint?.save();
  $('friend-error').hidden=true;
  const target=new URL('../../'+game+'/',import.meta.url);
  frame.title=FRIEND_PAGES[game];frame.src=target.href;
  const page=new URL(game==='collection'?'/':'/together/',location.origin);
  if(game!=='collection')page.searchParams.set('game',game);
  history.replaceState(null,'',page);document.title=FRIEND_PAGES[game]+' · Play together';
}
function currentSetup(game) {
  return validateGameSetup(game,game===session.game&&session.adapter?.setup?session.adapter.setup():defaultGameSetup(game));
}
frame.addEventListener('load',()=>{
  if(session.game==='collection')session.registerGame('collection',{setup:()=>({}),start(){}});
  else if(!session.supports(session.game)&&!session.screen.active){session.adapter={};render();}
  frame.contentDocument?.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(!link||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
    const target=new URL(link.href);if(target.origin!==location.origin)return;
    const game=target.pathname==='/'?'collection':target.pathname.split('/')[1];
    if(isFriendPage(game)){event.preventDefault();navigate(game);}
  });
});
function render() {
  const title=FRIEND_PAGES[session.game];
  let status='Play solo or invite a friend · '+title;
  if(resumeBusy||reconnectTimer)status='Reconnecting to your friend…';
  else if(session.asyncGame)status='Take turns · '+(session.asyncGame.record.finished?'Finished':session.asyncGame.record.myTurn?'Your turn':'Waiting for your friend')+' · '+title;
  else if(!session.connected&&!session.connecting&&session.resumeCredentials)status='Your room is saved · '+title;
  else if(session.loading)status='Loading '+title+' together…';
  else if(session.connected)status=session.paused?'Friend connected · Table paused':'Friend connected · '+title;
  else if(session.connecting)status=(session.isHost?'Waiting for your friend · ':'Joining your friend · ')+title;
  if(session.screen?.active)status='Virtual cursors · '+title;
  $('friend-status').textContent=status;
  $('next-game').disabled=session.loading||Boolean(session.proposal)||Boolean(session.screen?.busy&&!session.screen.active);
  for(const option of $('next-game').options)option.disabled=!session.independent&&session.connected&&!session.screen?.active&&Boolean(option.value)&&!session.supports(option.value);
  const waiting=session.connecting&&session.isHost&&session.friendInvitation;
  $('invite-friend').hidden=session.connected||session.connecting&&!waiting;
  $('invite-friend').textContent=waiting?'Invite link':'Invite a friend';
  $('invite-friend').disabled=Boolean(session.roomBusy);
  $('join-friend').hidden=session.connected||session.connecting;
  $('disconnect').hidden=!session.connected&&!session.connecting&&!session.resumeCredentials;
  $('reconnect-friend').hidden=session.connected||session.connecting||!session.resumeCredentials;
  $('reconnect-friend').disabled=resumeBusy;
  renderChat?.();renderScreen?.();
  if(session.connected&&$('room-dialog').open)$('room-dialog').close();
  const proposal=session.proposal;
  if(proposal){
    dialog.dataset.kind='switch';
    $('dialog-title').textContent=proposal.outgoing?'Waiting for your friend':'Play '+FRIEND_GAMES[proposal.game].title+'?';
    const description=setupSummary(proposal.game,proposal.metadata,session.isHost);
    $('dialog-copy').textContent=(proposal.outgoing?'Your friend can accept or decline. ':(proposal.resume?'This resumes your saved game and keeps your connection open. ':'This starts a fresh game and keeps your connection open. '))+description;
    $('accept-switch').textContent='Play together';$('accept-switch').hidden=proposal.outgoing;$('accept-switch').disabled=Boolean(proposal.accepted);
    $('decline-switch').textContent=proposal.cancelled?'Cancelling…':proposal.outgoing?'Cancel request':'Keep playing';
    $('decline-switch').disabled=Boolean(proposal.accepted||proposal.cancelled);
    if(!dialog.open)dialog.showModal();
  }else if(dialog.dataset.kind==='switch'&&dialog.open)dialog.close();
  if((autoInvite||autoJoin)&&session.adapter){
    const join=autoJoin;autoInvite=autoJoin=false;
    queueMicrotask(()=>join?openJoin():openInvitation(session.game));
  }
  persistRoom();renderSavedGames();renderInbox();
}
const session=new FriendSession({game:initialGame,onChange:render,onSwitch:loadGame,onError:showError,onPicker:()=>navigate('collection')});
session.resumeGame=Boolean(savedRoom&&!invitation);session.resumeSharedPage=Boolean(savedRoom?.shared&&!invitation);session.sharedResume=session.resumeSharedPage;
if(savedRoom&&!invitation){session.chat=new RoomChat(session);session.chat.restore(savedRoom.chat);session.resumeCredentials=savedRoom;session.isHost=savedRoom.role==='host';session.independent=Boolean(savedRoom.independent);}
renderChat=installFriendChat(session);renderScreen=installSharedPlay(session,render);installPanelVisibility(session);
window.__friendSession=session;
session.openInvitation=openInvitation;session.openJoin=openJoin;session.openGameSetup=openGameSetup;
Object.defineProperty(window,'__together',{value:{
  get game(){return session.game;},get connected(){return session.connected;},get epoch(){return session.epoch;},get loading(){return session.loading;},get paused(){return session.paused;},get screen(){return session.screen.phase;},
}});
function navigate(game) {
  if(!isFriendPage(game))return;
  if(session.independent){session.asyncGame=null;session.link?.close(true);session.link=null;session.game=game;session.adapter=null;session.resumeGame=session.resumeSharedPage=false;loadGame(game);render();return;}
  if(session.screen?.active){session.requestGame(game);return;}
  if(session.connected&&session.supports(game)&&game!=='collection'){openGameSetup(game);return;}
  if(session.supports(game))session.requestGame(game);
  else if(!session.connected){session.disconnect();session.game=game;session.adapter={};loadGame(game);render();}
  else showError('Use Cursors to share this game, or choose a multiplayer game.');
}
$('next-game').onchange=event=>{const game=event.target.value;event.target.value='';navigate(game);};
function openGameSetup(game,metadata) {
  if(session.loading||session.proposal||session.screen?.busy)return;
  $('game-play-mode').value=session.independent?'async':'live';$('game-play-mode').querySelector('[value=async]').disabled=!['cluance','flip-it'].includes(game);
  if(!['cluance','flip-it'].includes(game))$('game-play-mode').value='live';
  nextGame=game;$('game-setup-title').textContent='Play '+SETUP_GAMES[game]+' together';
  $('game-setup-error').hidden=true;
  readNextSetup=renderGameSetup($('game-setup-fields'),game,metadata||currentSetup(game));
  configurePlayMode('game',game);
  $('game-setup-dialog').showModal();
}
$('game-setup-start').onclick=async()=>{
  try {const metadata=readNextSetup();if($('game-play-mode').value==='async'){await startTurnGame(nextGame,metadata);$('game-setup-dialog').close();}else{if(!session.connected)throw Error('Reconnect your friend before starting a live game.');$('game-setup-dialog').close();session.requestGame(nextGame,metadata);}}
  catch(error){$('game-setup-error').textContent=error.message;$('game-setup-error').hidden=false;}
};
$('game-setup-cancel').onclick=()=>$('game-setup-dialog').close();
function configureInvitation(game,metadata) {
  $('room-play-mode').querySelector('[value=async]').disabled=!['cluance','flip-it'].includes(game);
  if(!['cluance','flip-it'].includes(game))$('room-play-mode').value='live';
  inviteGame=game;inviteDefaults=metadata||currentSetup(game);$('room-game').value=game;
  readInviteSetup=renderGameSetup($('room-setup'),game,inviteDefaults);
  const canResume=game===session.game&&Boolean(session.adapter?.canResume?.());
  $('room-resume-row').hidden=!canResume;$('room-resume').checked=canResume;
  $('room-setup').querySelectorAll('input,select').forEach(input=>input.disabled=canResume);configurePlayMode('room',game);
}
function openInvitation(game=session.game,metadata) {
  if(session.screen?.active){session.showPanel();return;}
  if(!session.connected&&session.resumeCredentials?.inviteLink&&!session.connecting){session.showPanel();$('room-title').textContent='Your room invitation';$('room-status').textContent='Share the code or link with one friend. Once joined, return in the same browser.';$('room-settings').hidden=$('room-create').hidden=$('room-join-form').hidden=true;$('room-output').hidden=$('room-copy').hidden=false;$('room-link').value=session.resumeCredentials.inviteLink;$('room-copy').disabled=false;$('room-dialog').showModal();offerRoomCode();return;}
  if(session.connected||session.resumeCredentials&&!session.connecting){if(Object.hasOwn(SETUP_GAMES,game)&&game!=='collection')openGameSetup(game,metadata);else session.showPanel();return;}
  session.showPanel();
  $('room-title').textContent='Invite a friend';$('room-join-form').hidden=true;
  $('room-copy').hidden=false;
  const waiting=session.connecting&&session.friendInvitation;
  $('room-settings').hidden=Boolean(waiting);
  $('room-output').hidden=!waiting;$('room-create').hidden=waiting;
  if(!waiting){
    $('room-link').value='';$('room-copy').disabled=true;$('room-settings').disabled=false;
    $('room-status').textContent='Choose a game, then share a room code or invitation link.';
    configureInvitation(Object.hasOwn(SETUP_GAMES,game)?game:'collection',metadata);
  }
  $('room-dialog').showModal();if(waiting)offerRoomCode();
}
$('room-game').onchange=()=>configureInvitation($('room-game').value);
$('room-resume').onchange=()=>{$('room-setup').querySelectorAll('input,select').forEach(input=>input.disabled=$('room-resume').checked);};
$('invite-friend').onclick=()=>openInvitation();
async function createRoom() {
  const dialog=$('room-dialog');
  const asyncMode=$('room-play-mode').value==='async';
  const metadata=readInviteSetup(),resume=!$('room-resume-row').hidden&&$('room-resume').checked;
  $('room-status').textContent='Creating an invitation…';session.roomBusy=true;$('room-create').disabled=true;$('room-settings').disabled=true;render();
  try {
    const room=await createHostedRoom('friends',1);
    if(!dialog.open)return;
    const credential=await claimRoomResume(room);
    session.resumeCredentials={...credential,page:inviteGame,setup:metadata,shared:false,independent:asyncMode};session.isHost=true;attachRoomChat();persistRoom();
    if(asyncMode){await startTurnGame(inviteGame,metadata);}else{
      const config=await roomConfig(credential,{iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
      await session.connectFriendRoom(credential,'host',config,{game:inviteGame,metadata,resume,restoring:true});
    }
    $('room-link').value=hostedLink({...room,key:room.guestKey})+(asyncMode?'&turn='+session.asyncGame.record.id:'');session.resumeCredentials.inviteLink=$('room-link').value;persistRoom();$('room-copy').disabled=false;$('room-output').hidden=false;$('room-create').hidden=true;$('room-settings').hidden=true;
    $('room-title').textContent=FRIEND_PAGES[inviteGame]+' · '+(asyncMode?'Take turns':'Play live');
    $('room-status').textContent=setupSummary(inviteGame,metadata).replace(/\.$/,'')+'. Share the code or link with one friend. Your room and saved games stay available for 90 days after your last visit.';
    await offerRoomCode();
  }catch(error){$('room-status').textContent=error.message;$('room-settings').disabled=false;}
  finally{session.roomBusy=false;$('room-create').disabled=false;render();}
}
$('room-create').onclick=()=>createRoom().catch(error=>{$('room-status').textContent=error.message;});
async function offerRoomCode() {
  const credential=session.resumeCredentials;
  if(!credential || credential.role!=='host')return;
  $('room-code').value='';$('room-code').placeholder='Generating…';$('room-code-copy').disabled=true;$('room-code-copy').textContent='Copy code';$('room-code-refresh').hidden=true;
  $('room-code-status').textContent='Generating your room code…';
  try {
    const turn=credential.inviteLink?new URLSearchParams(new URL(credential.inviteLink).hash.slice(1)).get('turn'):null;
    const code=await createRoomCode(credential,turn);
    if(session.resumeCredentials?.room!==credential.room)return;
    session.resumeCredentials.inviteCode=code;persistRoom();$('room-code').value=code.code;
    $('room-code-copy').disabled=false;$('room-code-status').textContent='Expires '+new Date(code.expiresAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+' · admits one friend.';
  }catch(error){
    $('room-code').placeholder='Code unavailable';$('room-code-status').textContent=error.message;$('room-code-refresh').hidden=error.status===410;
  }
}
$('room-code-refresh').onclick=offerRoomCode;
$('room-code-copy').onclick=async()=>{
  try {await navigator.clipboard.writeText($('room-code').value);$('room-code-copy').textContent='Copied';}
  catch {$('room-code').focus();$('room-code').select();$('room-code-status').textContent='Select and copy the room code.';}
};
function openJoin() {
  if(session.connected){session.showPanel();return;}
  session.showPanel();$('room-title').textContent='Join a friend';
  $('room-status').textContent='Enter your friend’s room code or paste their invitation link.';
  $('room-settings').hidden=$('room-create').hidden=$('room-output').hidden=$('room-copy').hidden=true;
  $('room-join-form').hidden=false;$('room-dialog').showModal();$('room-input').focus();
}
$('join-friend').onclick=openJoin;
async function joinRoom(input) {
  let room,turn;
  if(normalizeRoomCode(input)) {room=await resolveRoomCode(input);turn=room.turn;}
  else {
    room=hostedInvitation(input,'friends');
    if(!room)throw new Error('Enter the eight-character room code or paste a complete invitation link.');
    turn=new URLSearchParams(new URL(input,location.href).hash.slice(1)).get('turn');
  }
  const existing=readFriendRoom();
  const details=existing?.room===room.room?existing:await roomDetails(room,1);
  const credential=await claimRoomResume(details);session.resumeCredentials={...credential,page:'collection',setup:{},shared:false,independent:Boolean(turn)};session.isHost=credential.role==='host';attachRoomChat();persistRoom();
  if(turn){session.independent=true;await openTurnGame(turn);await refreshInbox();$('room-dialog').close();}
  else{const config=await roomConfig(credential,{iceServers:[{urls:'stun:stun.l.google.com:19302'}]});await session.connectFriendRoom(credential,credential.role,config,{game:'collection',restoring:true});}
}
$('room-join-form').onsubmit=async event=>{
  event.preventDefault();$('room-join').disabled=true;$('room-status').textContent='Connecting to your friend…';
  try{await joinRoom($('room-input').value);}catch(error){$('room-status').textContent=error.message;}
  finally{$('room-join').disabled=false;}
};
$('room-copy').onclick=async()=>{
  try{await navigator.clipboard.writeText($('room-link').value);$('room-copy').textContent='Copied';}
  catch{$('room-link-details').open=true;$('room-link').select();$('room-status').textContent='Select and copy the invitation link.';}
};
$('room-close').onclick=()=>$('room-dialog').close();
$('accept-switch').onclick=()=>{if(dialog.dataset.kind==='leave'){manualOffline=true;clearTimeout(reconnectTimer);reconnectTimer=null;frame.contentWindow?.__gameCheckpoint?.save();if(session.screen?.active){session.sharedResume=true;session.screen.suspend();}session.disconnect();persistRoom();dialog.close();}else session.accept();};
$('decline-switch').onclick=()=>{if(dialog.dataset.kind==='leave')dialog.close();else if(session.proposal?.outgoing)session.cancel();else session.decline();};
dialog.addEventListener('cancel',event=>{
  if(dialog.dataset.kind!=='switch')return;event.preventDefault();
  if(session.proposal?.accepted||session.proposal?.cancelled)return;
  if(session.proposal?.outgoing)session.cancel();else session.decline();
});
$('disconnect').onclick=()=>{
  dialog.dataset.kind='leave';$('dialog-title').textContent='Go offline?';$('dialog-copy').textContent='Your room, chat and saved games stay available. Reconnect whenever you want to play live again.';
  $('accept-switch').textContent='Go offline';$('accept-switch').hidden=false;$('accept-switch').disabled=false;
  $('decline-switch').textContent='Stay together';$('decline-switch').disabled=false;dialog.showModal();
};
$('collection-link').onclick=event=>{event.preventDefault();navigate('collection');};
window.addEventListener('pagehide',()=>{clearTimeout(reconnectTimer);frame.contentWindow?.__gameCheckpoint?.save();persistRoom();leaving=true;if(session.screen?.active){session.sharedResume=true;session.screen.suspend();}session.disconnect();});
loadGame(initialGame);render();if(savedRoom&&!invitation)$('chat-input').value=savedRoom.draft||'';
if(invitation){
  try {await joinRoom(location.origin+'/'+invitation);}
  catch(error){showError(error.message);}
}

function persistRoom() {
  if(!session.resumeCredentials||leaving)return;
  const old=session.resumeCredentials;
  let setup=old.setup||{};
  if(session.supports(session.game)&&session.adapter?.setup&&!session.loading){try{setup=currentSetup(session.game);}catch{}}
  session.resumeCredentials={...old,page:session.game,setup,shared:Boolean(session.screen?.active||session.sharedResume),manualOffline,independent:Boolean(session.independent),asyncId:session.asyncGame?.record.id||null,chat:session.chat.snapshot(),draft:$('chat-input').value};
  saveFriendRoom(session.resumeCredentials);
}
$('chat-input').addEventListener('input',persistRoom);
function renderSavedGames() {
  const checkpoints=Object.keys(FRIEND_PAGES).map(game=>readCheckpoint(game)).filter(Boolean);
  const signature=JSON.stringify(checkpoints.map(c=>[c.game,Math.floor(c.updatedAt/60000)]))+Boolean(session.connected);
  const list=$('saved-games-list');if(list.dataset.signature===signature)return;list.dataset.signature=signature;list.replaceChildren();
  if(!checkpoints.length){const empty=document.createElement('p');empty.className='setup-note';empty.textContent='Your games are saved here as you play.';list.append(empty);return;}
  for(const checkpoint of checkpoints){
    const button=document.createElement('button');button.type='button';button.textContent='Resume '+FRIEND_PAGES[checkpoint.game];
    button.onclick=()=>resumeSavedGame(checkpoint);list.append(button);
  }
}
function resumeSavedGame(checkpoint) {
  const {game,data}=checkpoint;
  if(session.connected){
    if(session.independent){session.asyncGame=null;session.game=game;session.adapter=null;session.resumeGame=session.resumeSharedPage=true;loadGame(game);render();}
    else if(session.screen?.active){session.resumeSharedPage=true;session.screen.navigate(game);}
    else if(session.supports(game)&&data.setup){session.requestGame(game,data.setup,true);}
    else session.screen.request(game,true);
  }else{
    session.disconnect();session.game=game;session.adapter=null;session.resumeGame=session.resumeSharedPage=true;loadGame(game);render();
  }
}
async function reconnectRoom() {
  if(resumeBusy||session.connected||leaving||!session.resumeCredentials)return;
  clearTimeout(reconnectTimer);reconnectTimer=null;resumeBusy=true;render();
  try {
    frame.contentWindow?.__gameCheckpoint?.save();
    const saved=session.resumeCredentials,credential=await claimRoomResume(saved);
    session.resumeCredentials={...saved,...credential};persistRoom();
    const config=await roomConfig(credential,{iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
    await session.connectFriendRoom(credential,credential.role,config,{game:saved.page,metadata:saved.setup||{},resume:true,shared:saved.shared,restoring:true,independent:saved.independent});
    reconnectAttempt=0;
  }catch(error){showError('Your progress is saved. '+error.message);}
  finally{resumeBusy=false;render();}
}
function scheduleReconnect() {
  if(manualOffline||leaving||resumeBusy||reconnectTimer||!session.resumeCredentials||session.independent)return;
  const delay=[1000,3000,8000,15000][Math.min(reconnectAttempt++,3)];
  reconnectTimer=setTimeout(()=>{reconnectTimer=null;reconnectRoom();},delay);render();
}
session.onReconnect=scheduleReconnect;
$('reconnect-friend').onclick=()=>{manualOffline=false;reconnectRoom();};
window.addEventListener('online',scheduleReconnect);
setInterval(()=>{persistRoom();renderSavedGames();},5000);
if(savedRoom&&!invitation){attachRoomChat();if(savedRoom.independent){if(savedRoom.asyncId)openTurnGame(savedRoom.asyncId).catch(error=>showError(error.message));refreshInbox();}else if(!manualOffline)reconnectRoom();}

function attachRoomChat(){
  if(!session.chat.persistent){const history=session.chat.snapshot();session.chat=new RoomChat(session);session.chat.restore(history);}
  session.chat.refresh().catch(error=>showError(error.message));
}
async function startTurnGame(game,setup){
  if(!session.resumeCredentials)throw Error('Invite a friend first.');
  const record=await roomRequest(session.resumeCredentials,'turns',{method:'POST',body:{game,setup}});
  await openTurnGame(record.id,record);session.send({type:'friend-turns-updated'});refreshInbox();
}
async function openTurnGame(id,initial){
  const record=initial||await roomRequest(session.resumeCredentials,'turns/'+id);
  frame.contentWindow?.__gameCheckpoint?.save();session.link?.close(true);session.link=null;
  if(session.screen?.active)session.screen.stop();
  session.asyncGame=new TurnClient(session,record);session.independent=true;session.game=record.game;session.adapter=null;session.resumeGame=session.resumeSharedPage=false;session.loading=false;
  loadGame(record.game);render();
}
async function refreshInbox(){
  if(inboxBusy||!session.resumeCredentials||leaving)return;inboxBusy=true;
  try{const data=await roomRequest(session.resumeCredentials,'turns');inbox=data.games;inboxError='';if(session.asyncGame)await session.asyncGame.refresh();}
  catch(error){inboxError=error.message;}finally{inboxBusy=false;renderInbox();}
}
function renderInbox(){
  $('turn-inbox').hidden=!session.resumeCredentials;
  $('new-turn-game').disabled=session.loading||Boolean(session.proposal);
  const list=$('turn-games-list'),signature=JSON.stringify(inbox);
  if(list.dataset.signature!==signature){list.dataset.signature=signature;list.replaceChildren();
    for(const item of inbox){const button=document.createElement('button');button.type='button';button.textContent=FRIEND_PAGES[item.game]+' · '+(item.finished?'Finished':item.myTurn?'Your turn':'Waiting for friend')+' · Round '+(item.round+1);button.classList.toggle('your-turn',item.myTurn);button.onclick=()=>openTurnGame(item.id).catch(error=>showError(error.message));list.append(button);}
  }
  $('turn-status').textContent=inboxError||(!inbox.length?'Choose Cluance or Flip It and invite your friend to take turns.':'Moves save automatically. You can leave anytime.');
  const pending=inbox.filter(item=>item.myTurn).length;
  session.setFriendBadge?.(pending);
}
session.refreshInbox=refreshInbox;
setInterval(()=>{if(!document.hidden&&session.resumeCredentials){refreshInbox();session.chat.refresh?.().catch(error=>{$('chat-status').textContent=error.message;});}},10000);
window.addEventListener('focus',refreshInbox);
$('room-play-mode').onchange=()=>configurePlayMode('room',inviteGame);
$('game-play-mode').onchange=()=>configurePlayMode('game',nextGame);
function configurePlayMode(scope,game){
  const asyncMode=$(scope+'-play-mode').value==='async',container=$(scope==='room'?'room-setup':'game-setup-fields');
  if(scope==='room'&&asyncMode){$('room-resume').checked=false;container.querySelectorAll('input,select').forEach(input=>input.disabled=false);}
  if(game==='flip-it'){
    const team=container.querySelector('[id$="-team"]'),count=container.querySelector('[id$="-count"]');
    if(asyncMode){team.checked=false;count.value='0';count.dispatchEvent(new Event('change'));}
    team.disabled=count.disabled=asyncMode||scope==='room'&&$('room-resume').checked;
  }
}
$('new-turn-game').onclick=()=>{const game=['cluance','flip-it'].includes(session.game)?session.game:'flip-it';openGameSetup(game);$('game-play-mode').value='async';configurePlayMode('game',game);};
