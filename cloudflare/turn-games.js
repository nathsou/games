import {createMatch, applyAction as flipAction, playerView as flipView} from '../flip-it/src/rules.js';
import {botAction as flipBot} from '../flip-it/src/bot.js';
import {createGame, playClue, eliminate, viewFor} from '../cluance/src/game.js';
import {createGame as midnightGame, applyAction as midnightAction, playerView as midnightView, legalActions as midnightLegal} from '../midnight/src/rules.js';
import {botAction as midnightBot} from '../midnight/src/bot.js';
import {validateGameSetup} from '../shared/friend-setup.js';
import {REACTIONS} from '../shared/friend-chat.js';

// Room games run here, so both players always see the same table. Seats are
// controlled by a person ('host', 'guest', or 'team' for both), a rules bot
// ('dealer') or the creator's AI provider ('model'), which never runs here.
export const ROOM_GAMES=['flip-it','cluance','midnight'];
const AI=['dealer','model'];
const roleIndex=role=>role==='host'?0:1;
const seed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
function failure(message,status=400){const error=Error(message);error.status=status;return error;}

function controllersFor(game,setup){
  if(game==='flip-it')return [...(setup.team?['team']:['host','guest']),...setup.aiPlayers];
  if(game==='midnight')return setup.team?['team',setup.opponent]:['host','guest'];
  return ['host','guest'];
}
export function controllers(record){return record.controllers||controllersFor(record.game,record.setup);}
export function seatOf(record,role){const seats=controllers(record);return seats.includes('team')?seats.indexOf('team'):seats.indexOf(role);}

export function createTurnGame(game, settings, role) {
  if (!ROOM_GAMES.includes(game)) throw Error('Choose Flip It, Cluance or Midnight Table.');
  const setup=validateGameSetup(game,settings);
  if(game==='cluance'&&role==='guest')setup.role=setup.role==='giver'?'guesser':'giver';
  const seats=controllersFor(game,setup);
  const state=game==='flip-it'?createMatch(setup.options,seed(),0,seats.length):game==='cluance'?createGame(setup.options):midnightGame(setup.type,seed());
  return {id:crypto.randomUUID(),game,setup,creator:role,controllers:seats,updatedAt:Date.now(),state,ready:[]};
}
export function turnRole(record,role) { return role==='host'?record.setup.role:record.setup.role==='giver'?'guesser':'giver'; }
function finished(record){
  const {state}=record;
  return Boolean(record.abandoned)||(record.game==='flip-it'?state.phase==='matchOver':state.phase==='over');
}
// Between rounds both people confirm before the next deal.
function betweenRounds(record){return !finished(record)&&(record.game==='flip-it'&&record.state.phase==='roundOver'||record.game==='midnight'&&record.state.phase==='reveal');}
// Seats that may act now, ignoring the between-round confirmation.
function actingSeats(record){
  const {state}=record;
  if(finished(record)||betweenRounds(record))return [];
  if(record.game==='flip-it')return state.phase==='playing'?[state.turn]:[];
  if(record.game==='midnight')return [0,1].filter(seat=>midnightLegal(state,seat).length);
  return [];
}
function waitingAI(record){
  const seats=controllers(record);
  return actingSeats(record).filter(seat=>AI.includes(seats[seat])).map(seat=>({seat,kind:seats[seat]}));
}
export function turnSummary(record,role) {
  const state=record.state,done=finished(record);
  let myTurn=false;
  if(!done){
    if(betweenRounds(record))myTurn=!record.ready.includes(roleIndex(role));
    else if(record.game==='cluance')myTurn=(state.phase==='clue')===(turnRole(record,role)==='giver');
    else myTurn=actingSeats(record).includes(seatOf(record,role));
  }
  return {id:record.id,game:record.game,setup:record.setup,revision:state.revision,updatedAt:record.updatedAt,phase:state.phase,round:state.round,myTurn,finished:done,ready:record.ready,
    creator:record.creator||'host',abandoned:record.abandoned?.by||null,controllers:controllers(record),waiting:done?[]:waitingAI(record)};
}
function seatView(record,seat){return record.game==='flip-it'?flipView(record.state,seat):midnightView(record.state,seat);}
export function turnView(record,role) {
  const summary=turnSummary(record,role);
  if(record.game==='cluance')return {...summary,seat:roleIndex(role),role:turnRole(record,role),view:viewFor(record.state,turnRole(record,role))};
  const seat=seatOf(record,role),result={...summary,seat,view:seatView(record,seat)};
  // The creator's browser chooses for AI seats with its own provider settings,
  // so it alone receives that seat's private view, and only while it acts.
  const model=summary.waiting.find(entry=>entry.kind==='model');
  if(model&&role===summary.creator)result.aiTurn={seat:model.seat,view:seatView(record,model.seat)};
  return result;
}
function apply(record,seat,action){
  record.state=record.game==='flip-it'?flipAction(record.state,seat,action):midnightAction(record.state,seat,action);
}
// Returns the kind of change for notifications: move, ready, round, bot or ai.
export function advanceTurn(record,role,body) {
  const {revision,action}=body||{};
  if(record.abandoned)throw Error('This game has ended.');
  if(revision!==record.state.revision) throw failure('The game changed. Refresh before playing.',409);
  let kind='move';
  if(record.game==='cluance') {
    if(!action||typeof action!=='object')throw Error('Choose a move.');
    if(!turnSummary(record,role).myTurn)throw Error('Wait for your friend’s turn.');
    record.state=turnRole(record,role)==='giver'?playClue(record.state,action):eliminate(record.state,action);
  } else if(body.bot===true) {
    const dealer=waitingAI(record).find(entry=>entry.kind==='dealer');
    if(!dealer)throw failure('No bot is waiting to play.',409);
    const view=seatView(record,dealer.seat);
    apply(record,dealer.seat,record.game==='flip-it'?flipBot(view,dealer.seat):midnightBot(view,dealer.seat));
    kind='bot';
  } else if(body.seat!==undefined) {
    if(role!==(record.creator||'host'))throw Error('Only the game’s creator runs its AI players.');
    if(!waitingAI(record).some(entry=>entry.kind==='model'&&entry.seat===body.seat))throw failure('That AI player is not waiting to play.',409);
    if(!action||typeof action!=='object')throw Error('Choose a move.');
    apply(record,body.seat,action);kind='ai';
  } else {
    if(!action||typeof action!=='object')throw Error('Choose a move.');
    if(action.kind==='next') {
      if(!betweenRounds(record))throw Error('Finish this round first.');
      const index=roleIndex(role);
      if(!record.ready.includes(index))record.ready.push(index);
      kind='ready';
      if(record.ready.length===2){apply(record,record.game==='midnight'?0:seatOf(record,role),action);record.ready=[];kind='round';}
    } else {
      const seat=seatOf(record,role);
      if(seat<0||!actingSeats(record).includes(seat))throw Error('Wait for your turn.');
      apply(record,seat,action);
    }
  }
  record.updatedAt=Date.now();return kind;
}
// Either player may end a game; it stays in both lists as finished.
export function abandonTurn(record,role) {
  if(finished(record))throw Error('This game has already ended.');
  record.abandoned={by:role,at:Date.now()};record.updatedAt=Date.now();
}
export function chatEntry(body,role,sequence) {
  const value=typeof body.value==='string'?body.value.trim():'';
  if(!(body.kind==='text'?value.length>0&&value.length<=280:body.kind==='reaction'&&Object.hasOwn(REACTIONS,value)))throw Error('Write a message of up to 280 characters.');
  return {sequence,seat:role==='host'?0:1,kind:body.kind,value};
}
