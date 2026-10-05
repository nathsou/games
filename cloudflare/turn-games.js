import {createMatch, applyAction, playerView} from '../flip-it/src/rules.js';
import {createGame, playClue, eliminate, viewFor} from '../cluance/src/game.js';
import {validateGameSetup} from '../shared/friend-setup.js';
import {REACTIONS} from '../shared/friend-chat.js';

export function createTurnGame(game, settings, role) {
  if (!['flip-it','cluance'].includes(game)) throw Error('Take turns is available for Cluance and Flip It.');
  const setup=validateGameSetup(game,settings);
  if(game==='flip-it'&&(setup.team||setup.aiPlayers.length)) throw Error('Take turns uses two human players.');
  if(game==='cluance'&&role==='guest')setup.role=setup.role==='giver'?'guesser':'giver';
  return {id:crypto.randomUUID(),game,setup,creator:role,updatedAt:Date.now(),state:game==='flip-it'?createMatch(setup.options,crypto.getRandomValues(new Uint32Array(1))[0]):createGame(setup.options),ready:[]};
}
export function turnRole(record,role) { return role==='host'?record.setup.role:record.setup.role==='giver'?'guesser':'giver'; }
export function turnSummary(record,role) {
  const state=record.state,seat=role==='host'?0:1,finished=Boolean(record.abandoned)||(record.game==='flip-it'?state.phase==='matchOver':state.phase==='over');
  const myTurn=!finished&&(record.game==='flip-it'?(state.phase==='roundOver'?!record.ready.includes(seat):state.turn===seat):(state.phase==='clue')===(turnRole(record,role)==='giver'));
  return {id:record.id,game:record.game,setup:record.setup,revision:state.revision,updatedAt:record.updatedAt,phase:state.phase,round:state.round,myTurn,finished,ready:record.ready,creator:record.creator||'host',abandoned:record.abandoned?.by||null};
}
export function turnView(record,role) {
  return {...turnSummary(record,role),seat:role==='host'?0:1,role:turnRole(record,role),view:record.game==='flip-it'?playerView(record.state,role==='host'?0:1):viewFor(record.state,turnRole(record,role))};
}
export function advanceTurn(record,role,revision,action) {
  if(record.abandoned)throw Error('This game has ended.');
  if(revision!==record.state.revision) { const error=Error('The game changed. Refresh before playing.');error.status=409;throw error; }
  if(!action||typeof action!=='object')throw Error('Choose a move.');
  const seat=role==='host'?0:1;
  let kind='move';
  if(record.game==='flip-it') {
    if(action.kind==='next') {
      if(record.state.phase!=='roundOver')throw Error('Finish this round first.');
      if(!record.ready.includes(seat))record.ready.push(seat);
      kind='ready';
      if(record.ready.length===2){record.state=applyAction(record.state,seat,action);record.ready=[];kind='round';}
    } else record.state=applyAction(record.state,seat,action);
  } else {
    if(!turnSummary(record,role).myTurn)throw Error('Wait for your friend’s turn.');
    record.state=turnRole(record,role)==='giver'?playClue(record.state,action):eliminate(record.state,action);
  }
  record.updatedAt=Date.now();return kind;
}
// Either player may end a game; it stays in both lists as finished.
export function abandonTurn(record,role) {
  if(turnSummary(record,role).finished)throw Error('This game has already ended.');
  record.abandoned={by:role,at:Date.now()};record.updatedAt=Date.now();
}
export function chatEntry(body,role,sequence) {
  const value=typeof body.value==='string'?body.value.trim():'';
  if(!(body.kind==='text'?value.length>0&&value.length<=280:body.kind==='reaction'&&Object.hasOwn(REACTIONS,value)))throw Error('Write a message of up to 280 characters.');
  return {sequence,seat:role==='host'?0:1,kind:body.kind,value};
}
