import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,applyAction,playerView,legalActions,assertState,makeDeck,valueOf} from '../src/rules.js';
import {validateView,FlipSession} from '../src/session.js';
import {botAction} from '../src/bot.js';
import {describeTurn} from '../src/ai.js';
test('2–5 seats conserve cards and hide every other hand through all option combinations',()=>{
  for(let players=2;players<=5;players++)for(let mask=0;mask<8;mask++)for(let seed=1;seed<=15;seed++) {
    let state=createMatch({quickTurns:!!(mask&1),compactDeck:!!(mask&2),lastChance:!!(mask&4)},seed,0,players);
    let steps=0;
    while(state.phase==='playing') {
      const seat=state.turn,view=playerView(state,seat);validateView(view,seat);
      for(let p=0;p<players;p++)if(p!==seat)assert(view.hands[p].every(c=>c.hidden&&Object.keys(c).length===1));
      const action=botAction(view,seat);assert(legalActions(view,seat).some(a=>JSON.stringify(a)===JSON.stringify(action)));
      const d=describeTurn(state,seat);assert(d.candidates.length>0);assert.equal(d.observation.seed,undefined);
      state=applyAction(state,seat,action);assertState(state);assert(++steps<=185);
    }
    assert.equal(state.history.length,1);
  }
});
test('each other player gets one last-chance reply and the first empty hand retains priority',()=>{
  const state=createMatch({},9,0,4);
  state.discard.push(...state.hands[0]);state.hands[0]=[];state.pending=0;state.repliesRemaining=3;state.turn=1;
  let next=applyAction(state,1,{kind:'flip',lane:0});assert.equal(next.phase,'playing');assert.equal(next.repliesRemaining,2);assert.equal(next.turn,2);
  next=applyAction(next,2,{kind:'flip',lane:0});assert.equal(next.repliesRemaining,1);assert.equal(next.turn,3);
  next=applyAction(next,3,{kind:'flip',lane:0});assert.equal(next.phase,'roundOver');assert.equal(next.result.winner,0);assertState(next);
});
test('targets name an opponent seat and an illegal target is atomic',()=>{
  let state=createMatch({lastChance:false},13,0,4);
  const action=legalActions(state,0).find(a=>a.kind==='play'&&a.cards.length===1);state=applyAction(state,0,action);
  const take=legalActions(state,1).find(a=>a.kind==='take');assert.equal(take.targetSeat,0);
  const before=structuredClone(state);assert.throws(()=>applyAction(state,1,{...take,targetSeat:1}));assert.deepEqual(state,before);
  state=applyAction(state,1,take);assertState(state);
});
test('a counter from a later seat closes the pending window and returns public ranks',()=>{
  let state=createMatch({},1,0,4),pool=makeDeck(true);
  const take=rank=>{const i=pool.findIndex(c=>c.ends.includes(rank)),c=pool.splice(i,1)[0];c.face=c.ends.indexOf(rank);return c;};
  state.hands=[[],[take(1)],[take(5),take(5),take(2)],[take(4)]];state.table=[[[take(3),take(3)],[]],[[],[]],[[],[]],[[],[]]];state.discard=pool;state.pending=0;state.repliesRemaining=2;state.turn=2;
  state=applyAction(state,2,{kind:'play',lane:0,cards:state.hands[2].filter(c=>valueOf(c)===5).map(c=>c.id)});
  assert.equal(state.pending,null);assert.equal(state.hands[0].length,2);assertState(state);
});
test('mixed online tables send only public controller types and the guest hand',()=>{
  let host,guest;const errors=[];
  host=new FlipSession({aiPlayers:['model','dealer','model'],onError:e=>errors.push(e.message)});guest=new FlipSession({seat:1,onError:e=>errors.push(e.message)});
  host.setPeer({connected:true,send:m=>guest.receive(structuredClone(m))});guest.setPeer({connected:true,send:m=>host.receive(structuredClone(m))});guest.opened();
  assert.equal(guest.view.hands.length,5);assert.equal(guest.controllers.length,5);
  assert(guest.view.hands.filter((_,p)=>p!==1).flat().every(c=>c.hidden));
  host.choose(botAction(host.view,0));guest.choose(botAction(guest.view,1));
  for(let seat=2;seat<5;seat++)host.botMove(seat,botAction(playerView(host.state,seat),seat));
  assert.equal(host.state.turn,0);assert.equal(host.state.revision,5);assert.deepEqual(errors,[]);
  assert.equal(JSON.stringify(guest.view).includes('keys'),false);
  const bad=structuredClone(guest.view);bad.repliesRemaining=2;assert.throws(()=>validateView(bad,1));
});
