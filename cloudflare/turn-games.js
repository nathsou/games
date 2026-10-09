import flipIt from '../flip-it/src/room.js';
import cluance from '../cluance/src/room.js';
import midnight from '../midnight/src/room.js';
import {validateGameSetup} from '../shared/friend-setup.js';
import {REACTIONS} from '../shared/friend-chat.js';

// Room games run here, so both players always see the same table. Seats are
// controlled by a person ('host', 'guest', or 'team' for both), a rules bot
// ('dealer') or the creator's AI provider ('model'), which never runs here.
// Each game supplies an engine: its pure rules seen through numbered seats.
export const ENGINES=Object.freeze({'flip-it':flipIt,cluance,midnight});
export const ROOM_GAMES=Object.keys(ENGINES);
const AI=['dealer','model'];
const roleIndex=role=>role==='host'?0:1;
const seed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
function failure(message,status=400){const error=Error(message);error.status=status;return error;}
const engine=record=>ENGINES[record.game];

export function controllers(record){return record.controllers||engine(record).controllers(record.setup);}
export function seatOf(record,role){const seats=controllers(record);return seats.includes('team')?seats.indexOf('team'):seats.indexOf(role);}

export function createTurnGame(game, settings, role) {
  if (!Object.hasOwn(ENGINES,game)) throw Error('Choose a room game.');
  const rules=ENGINES[game];
  let setup=validateGameSetup(game,settings);
  if(rules.prepare)setup=rules.prepare(setup,role);
  const seats=rules.controllers(setup);
  const state=rules.create(setup,{seed:seed(),seats,creator:role});
  return {id:crypto.randomUUID(),game,setup,creator:role,controllers:seats,version:state.revision,updatedAt:Date.now(),state,ready:[]};
}
function finished(record){return Boolean(record.abandoned)||engine(record).finished(record.state,record.setup);}
// Between rounds both people confirm before the next deal.
function betweenRounds(record){return !finished(record)&&Boolean(engine(record).between?.(record.state,record.setup));}
// Seats that may act now, ignoring the between-round confirmation.
function actingSeats(record){
  if(finished(record)||betweenRounds(record))return [];
  return engine(record).acting(record.state,record.setup);
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
    else myTurn=actingSeats(record).includes(seatOf(record,role));
  }
  return {id:record.id,game:record.game,setup:record.setup,revision:state.revision,version:record.version??state.revision,updatedAt:record.updatedAt,phase:state.phase,round:state.round,myTurn,finished:done,ready:[...record.ready],
    creator:record.creator||'host',abandoned:record.abandoned?.by||null,controllers:controllers(record),waiting:done?[]:waitingAI(record)};
}
function seatView(record,seat){return engine(record).view(record.state,seat,record.setup);}
export function turnView(record,role) {
  const summary=turnSummary(record,role),seat=seatOf(record,role);
  const result={...summary,seat,...engine(record).decorate?.(record,seat),view:seatView(record,seat)};
  // The creator's browser chooses for AI seats with its own provider settings,
  // so it alone receives that seat's private view, and only while it acts.
  const model=summary.waiting.find(entry=>entry.kind==='model');
  if(model&&role===summary.creator)result.aiTurn={seat:model.seat,view:engine(record).aiView?.(record.state,model.seat,record.setup)??seatView(record,model.seat)};
  return result;
}
function apply(record,seat,action){record.state=engine(record).apply(record.state,seat,action,record.setup);}
// Returns the kind of change for notifications: move, ready, round, bot or ai.
export function advanceTurn(record,role,body) {
  const {revision,action}=body||{};
  const version=record.version??record.state.revision;
  if(record.abandoned)throw Error('This game has ended.');
  if(revision!==record.state.revision) throw failure('The game changed. Refresh before playing.',409);
  let kind='move';
  if(body.bot===true) {
    const dealer=waitingAI(record).find(entry=>entry.kind==='dealer');
    if(!dealer)throw failure('No bot is waiting to play.',409);
    apply(record,dealer.seat,engine(record).bot(record.state,dealer.seat,record.setup));
    kind='bot';
  } else if(body.seat!==undefined) {
    if(role!==(record.creator||'host'))throw Error('Only the game’s creator runs its AI players.');
    if(!waitingAI(record).some(entry=>entry.kind==='model'&&entry.seat===body.seat))throw failure('That AI player is not waiting to play.',409);
    if(!action||typeof action!=='object')throw Error('Choose a move.');
    apply(record,body.seat,action);kind='ai';
  } else {
    if(!action||typeof action!=='object')throw Error('Choose a move.');
    if(action.kind==='next'&&engine(record).between) {
      if(!betweenRounds(record))throw Error('Finish this round first.');
      const index=roleIndex(role);
      if(!record.ready.includes(index))record.ready.push(index);
      kind='ready';
      if(record.ready.length===2){apply(record,engine(record).nextSeat?.(record)??seatOf(record,role),action);record.ready=[];kind='round';}
    } else {
      const seat=seatOf(record,role);
      if(seat<0||!actingSeats(record).includes(seat))throw Error(engine(record).waitMessage||'Wait for your turn.');
      apply(record,seat,action);
    }
  }
  record.version=version+1;record.updatedAt=Date.now();return kind;
}
// Either player may end a game; it stays in both lists as finished.
export function abandonTurn(record,role) {
  if(finished(record))throw Error('This game has already ended.');
  record.version=(record.version??record.state.revision)+1;
  record.abandoned={by:role,at:Date.now()};record.updatedAt=Date.now();
}
export function chatEntry(body,role,sequence) {
  const value=typeof body.value==='string'?body.value.trim():'';
  if(!(body.kind==='text'?value.length>0&&value.length<=280:body.kind==='reaction'&&Object.hasOwn(REACTIONS,value)))throw Error('Write a message of up to 280 characters.');
  return {sequence,seat:role==='host'?0:1,kind:body.kind,value};
}
