import test from 'node:test';
import assert from 'node:assert/strict';
import {createTurnGame,advanceTurn,turnSummary,turnView} from '../turn-games.js';
import {botAction} from '../../flip-it/src/bot.js';

test('Flip It waits for both seats between rounds and protects finished matches',()=>{
  const record=createTurnGame('flip-it',{options:{target:2}},'host');
  while(record.state.phase==='playing'){
    const seat=record.state.turn;
    advanceTurn(record,seat===0?'host':'guest',record.state.revision,botAction(record.state,seat));
  }
  const revision=record.state.revision;
  assert.equal(record.state.phase,'roundOver');
  advanceTurn(record,'guest',revision,{kind:'next'});assert.equal(record.state.phase,'roundOver');assert(!turnSummary(record,'guest').myTurn);assert(turnSummary(record,'host').myTurn);
  advanceTurn(record,'guest',revision,{kind:'next'});assert.equal(record.ready.length,1);
  advanceTurn(record,'host',revision,{kind:'next'});assert.equal(record.state.round,1);assert.equal(record.state.revision,revision+1);assert.deepEqual(record.ready,[]);
  assert(!('seed' in turnView(record,'guest').view));assert(!('visits' in turnView(record,'guest').view));
  assert.throws(()=>advanceTurn(record,'host',revision,{kind:'flip'}),/changed/);
});
test('a guest-created Cluance game assigns the requested role to its creator',()=>{
  const record=createTurnGame('cluance',{role:'giver',options:{theme:'french',clueTheme:'global',variant:'classic'}},'guest');
  assert.equal(turnView(record,'guest').role,'giver');assert(turnView(record,'guest').view.secret);assert(!turnView(record,'host').view.secret);assert(turnSummary(record,'guest').myTurn);
  assert.throws(()=>createTurnGame('flip-it',{team:true,aiPlayers:['dealer']},'host'),/two human/);
});
