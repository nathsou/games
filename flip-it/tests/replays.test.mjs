import test from 'node:test';
import assert from 'node:assert/strict';
import {ReplayStore,REPLAY_KEY,highlights} from '../src/replays.js';
import {createMatch,applyAction,playerView} from '../src/rules.js';
import {botAction} from '../src/bot.js';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};};
test('recordings retain every action across rounds, reload and keep opponents hidden',()=>{
  const storage=memory(),store=new ReplayStore(storage);let state=createMatch({},42),moves=0;
  const record=()=>store.record({id:'match',mode:'online',names:['Alex','Jamie'],seat:1,view:playerView(state,1)});
  record();
  for(let i=0;i<150&&state.phase!=='matchOver';i++){
    state=applyAction(state,state.phase==='roundOver'?0:state.turn,state.phase==='roundOver'?{kind:'next'}:botAction(state,state.turn));moves++;record();record();
  }
  const loaded=new ReplayStore(storage).records[0];
  assert.equal(loaded.entries.length,moves+1);assert(loaded.entries.length>12);
  assert(loaded.entries.some(e=>e.view.round>0));assert(loaded.entries.every(e=>e.view.hands[0].every(c=>c.hidden)));
  assert(loaded.entries.every(e=>!('seed' in e.view)&&!('discard' in e.view)));
  assert.equal(loaded.partial,false);assert(highlights(loaded).some(h=>h.label==='Round result'));
  assert.deepEqual(loaded,store.records[0]);
});
test('partial recordings are labelled, damaged private frames rejected, deletion persists',()=>{
  const storage=memory(),store=new ReplayStore(storage);let state=createMatch({},2);
  state=applyAction(state,0,botAction(state,0));
  store.record({id:'late',mode:'solo',names:['You','Dealer'],seat:0,view:playerView(state,0)});
  assert.equal(store.records[0].partial,true);
  const raw=JSON.parse(storage.getItem(REPLAY_KEY));raw[0].entries[0].view.hands[1][0]={id:'stolen'};
  storage.setItem(REPLAY_KEY,JSON.stringify(raw));assert.equal(new ReplayStore(storage).records.length,0);
  store.remove('late');assert.equal(new ReplayStore(storage).records.length,0);
});
test('storage denial preserves the full current replay in memory',()=>{
  const store=new ReplayStore({getItem(){throw Error('Denied');},setItem(){throw Error('Full');}});
  store.record({id:'match',mode:'solo',names:['You','Dealer'],seat:0,view:playerView(createMatch({},5),0)});
  assert.equal(store.persistent,false);assert.equal(store.records[0].entries.length,1);
});
