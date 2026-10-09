import test from 'node:test';
import assert from 'node:assert/strict';
import {createTurnGame,advanceTurn,abandonTurn,turnSummary,turnView} from '../turn-games.js';
import {botAction} from '../../flip-it/src/bot.js';
import {legalActions as midnightLegal} from '../../midnight/src/rules.js';

const move=(record,role,body)=>advanceTurn(record,role,{revision:record.state.revision,...body});
// Play a room game to its end with legal choices from each acting browser.
function playOut(record,choose,limit=2000){
  for(let step=0;step<limit&&!turnSummary(record,'host').finished;step++){
    const summary=turnSummary(record,'host');
    if(summary.waiting.some(entry=>entry.kind==='dealer')){move(record,'guest',{bot:true});continue;}
    const creator=summary.creator,model=turnView(record,creator).aiTurn;
    if(model){move(record,creator,{seat:model.seat,action:choose(model.view,model.seat)});continue;}
    const role=['host','guest'].find(r=>turnSummary(record,r).myTurn);
    assert(role,'Someone must be able to act');
    const view=turnView(record,role);
    move(record,role,{action:['roundOver','reveal'].includes(view.phase)?{kind:'next'}:choose(view.view,view.seat)});
  }
  assert(turnSummary(record,'host').finished,'The game must finish');
}

test('Flip It waits for both people between rounds and protects finished matches',()=>{
  const record=createTurnGame('flip-it',{options:{target:2}},'host');
  while(record.state.phase==='playing'){
    const seat=record.state.turn;
    move(record,seat===0?'host':'guest',{action:botAction(record.state,seat)});
  }
  const revision=record.state.revision;
  assert.equal(record.state.phase,'roundOver');
  assert.equal(move(record,'guest',{action:{kind:'next'}}),'ready');assert.equal(record.state.phase,'roundOver');assert(!turnSummary(record,'guest').myTurn);assert(turnSummary(record,'host').myTurn);
  move(record,'guest',{action:{kind:'next'}});assert.equal(record.ready.length,1);
  assert.equal(move(record,'host',{action:{kind:'next'}}),'round');assert.equal(record.state.round,1);assert.equal(record.state.revision,revision+1);assert.deepEqual(record.ready,[]);
  assert(!('seed' in turnView(record,'guest').view));assert(!('visits' in turnView(record,'guest').view));
  assert.throws(()=>advanceTurn(record,'host',{revision,action:{kind:'flip'}}),/changed/);
  abandonTurn(record,'guest');assert(turnSummary(record,'host').finished);
  assert.throws(()=>move(record,'host',{action:{kind:'flip',lane:0}}),/ended/);
});

test('Flip It bots play in the room; only the creator chooses for AI seats and sees their hand',()=>{
  const record=createTurnGame('flip-it',{options:{target:1},aiPlayers:['dealer','model']},'guest');
  assert.deepEqual(turnSummary(record,'host').controllers,['host','guest','dealer','model']);
  assert.equal(record.state.hands.length,4);
  for(const role of ['host','guest'])assert.equal(turnView(record,role).view.hands.filter(h=>h.some(c=>!c.hidden)).length,1);
  if(record.state.turn!==2)assert.throws(()=>move(record,'guest',{bot:true}),/No bot/);
  playOut(record,(view,seat)=>botAction(view,seat));
  // A model seat waits for the creator: the host cannot act for it.
  const other=createTurnGame('flip-it',{options:{target:1},aiPlayers:['model']},'guest');
  while(other.state.turn!==2&&!turnSummary(other,'host').finished){
    const role=other.state.turn===0?'host':'guest';move(other,role,{action:botAction(turnView(other,role).view,other.state.turn)});
  }
  if(other.state.turn===2){
    assert(!turnView(other,'host').aiTurn,'The non-creator never receives the AI hand');
    const ai=turnView(other,'guest').aiTurn;assert.equal(ai.seat,2);assert(ai.view.hands[2].every(c=>!c.hidden));
    assert.throws(()=>move(other,'host',{seat:2,action:botAction(ai.view,2)}),/creator/);
    assert.equal(move(other,'guest',{seat:2,action:botAction(ai.view,2)}),'ai');
  }
});

test('Flip It team play shares one hand between both people',()=>{
  const record=createTurnGame('flip-it',{options:{target:1},team:true,aiPlayers:['dealer']},'host');
  assert.deepEqual(turnSummary(record,'guest').controllers,['team','dealer']);
  assert.deepEqual(turnView(record,'host').view.hands[0],turnView(record,'guest').view.hands[0]);
  assert.equal(turnView(record,'guest').seat,0);
  playOut(record,(view,seat)=>botAction(view,seat));
});

test('Midnight Table hides simultaneous choices and runs the dealer in team play',()=>{
  const duel=createTurnGame('midnight',{type:'backhand'},'host');
  assert(turnSummary(duel,'host').myTurn&&turnSummary(duel,'guest').myTurn,'Both people choose at once');
  const card=turnView(duel,'host').view.hands[0][4].id;
  move(duel,'host',{action:{kind:'bid',card}});
  assert(!turnSummary(duel,'host').myTurn);assert.equal(turnView(duel,'guest').view.pending[0],true,'The guest only learns that a card is locked');
  assert(!JSON.stringify(turnView(duel,'guest')).includes(card));
  const pick=(view,seat)=>midnightLegal(view,seat)[0];
  playOut(duel,pick);
  for(const type of ['closing','heist']) playOut(createTurnGame('midnight',{type},'guest'),pick);
  const team=createTurnGame('midnight',{type:'heist',team:true,opponent:'dealer'},'guest');
  assert.deepEqual(turnSummary(team,'host').controllers,['team','dealer']);
  playOut(team,pick);
});

test('a guest-created Cluance game assigns the requested role to its creator',()=>{
  const record=createTurnGame('cluance',{role:'giver',options:{theme:'french',clueTheme:'global',variant:'classic'}},'guest');
  assert.equal(turnView(record,'guest').role,'giver');assert(turnView(record,'guest').view.secret);assert(!turnView(record,'host').view.secret);assert(turnSummary(record,'guest').myTurn);
  assert.equal(turnSummary(record,'host').creator,'guest');
});

test('saved games from before room bots keep two human seats',()=>{
  const record=createTurnGame('flip-it',{},'host');delete record.controllers;delete record.creator;
  assert.deepEqual(turnSummary(record,'guest').controllers,['host','guest']);assert.equal(turnSummary(record,'guest').creator,'host');
  move(record,record.state.turn===0?'host':'guest',{action:{kind:'flip',lane:0}});
});

// A person's legal choice from a Thrice view: any hand end or face-down middle card.
function thriceChoice(view){
  const options=[];
  view.counts.forEach((count,seat)=>{const left=seat===view.seat?view.hand.length:count;if(left)options.push({kind:'reveal',from:'hand',seat,end:'low'});if(left>1)options.push({kind:'reveal',from:'hand',seat,end:'high'});});
  view.middle.forEach((card,index)=>{if(card&&!card.up)options.push({kind:'reveal',from:'middle',index});});
  return options[(view.revision*7+view.round)%options.length];
}
test('Thrice seats both people and room bots, hides hands and plays to a winner',()=>{
  const record=createTurnGame('thrice',{mode:'simple',bots:2,difficulty:'normal',memoryAid:false,theme:'bakery'},'guest');
  assert.deepEqual(turnSummary(record,'host').controllers,['host','guest','dealer','dealer']);
  const view=turnView(record,'host');
  assert.equal(view.seat,0);assert(!('hands' in view.view));assert.deepEqual(view.view.hand,record.state.hands[0]);
  assert(!JSON.stringify(turnView(record,'guest').view.middle).includes('value'));
  playOut(record,thriceChoice);
  assert(Number.isInteger(record.state.winner));
  assert.throws(()=>createTurnGame('thrice',{bots:5},'host'),/Thrice/);
});

test('Yesteryear races with bots and plays a co-op streak from one shared hand',()=>{
  const choose=view=>({kind:'place',card:view.hand[0],slot:view.revision%(view.timeline.length+1)});
  const race=createTurnGame('yesteryear',{mode:'race',decks:'mix',lang:'fr',bots:1,difficulty:'hard'},'host');
  assert.deepEqual(turnSummary(race,'guest').controllers,['host','guest','dealer']);
  assert(!('hands' in turnView(race,'guest').view));
  playOut(race,choose);
  const streak=createTurnGame('yesteryear',{mode:'streak',decks:'france',lang:'en'},'guest');
  assert.deepEqual(turnSummary(streak,'host').controllers,['team']);
  assert.deepEqual(turnView(streak,'host').view.hand,turnView(streak,'guest').view.hand);
  assert(turnSummary(streak,'host').myTurn&&turnSummary(streak,'guest').myTurn,'Either person can play the shared hand');
  playOut(streak,choose);
});
