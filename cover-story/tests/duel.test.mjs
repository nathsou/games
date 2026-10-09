import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, applyAction, actingSeat, playerView} from '../src/rules.js';
import {BANK, fold} from '../src/words.js';
import {lineup} from '../src/room.js';
import {validateSetup} from '../src/room-setup.js';

test('Duel has two human controllers, private answers, alternating guesses and scoring', () => {
  const setup=validateSetup({mode:'duel',turns:7});assert.deepEqual(lineup(setup),['host','guest']);
  let state=createGame(setup,42);const seat=actingSeat(state),v=playerView(state,seat);
  for(const key of ['key','keys','myKey','rng','usedClues']) assert.equal(key in v,false);
  const right=state.words.findIndex(w=>BANK[state.lang][w].some(a=>fold(a)===fold(state.clue.word)));
  assert.throws(()=>applyAction(state,1-seat,{kind:'guess',index:right}),/Wait/);
  state=applyAction(state,seat,{kind:'guess',index:right});assert.equal(state.scores[seat],1);assert.equal(actingSeat(state),1-seat);
  assert.throws(()=>applyAction(state,1-seat,{kind:'guess',index:right}),/untried/);
  const wrong=state.words.findIndex((w,i)=>!state.revealed[i]&&!BANK[state.lang][w].some(a=>fold(a)===fold(state.clue.word)));
  state=applyAction(state,1-seat,{kind:'guess',index:wrong});assert.equal(state.scores[1-seat],-1);assert.equal(state.revealed[wrong],null);
  assert.throws(()=>applyAction(state,seat,{kind:'guess',index:wrong}),/untried/);
});
test('Duel ends after a bounded number of printed clues, supports draws and both languages', () => {
  for(const lang of ['en','fr']) for(let seed=0;seed<30;seed++) {
    let state=createGame({mode:'duel',lang,turns:7},seed);let moves=0;
    while(state.phase!=='over') {state=applyAction(state,actingSeat(state),{kind:'pass'});assert(++moves<=14);}
    assert.equal(state.winner,null);assert.deepEqual(state.scores,[0,0]);assert.equal(state.round,7);
  }
});
test('Duo remains a human cooperative game with a fixed turn budget', () => {
  assert.deepEqual(lineup(validateSetup({mode:'duo'})),['host','guest']);
  let state=createGame({mode:'duo',turns:7},42);
  while(state.phase!=='over') {
    const giver=actingSeat(state);state=applyAction(state,giver,{kind:'clue',word:'zebrafinch',number:1});
    const neutral=state.keys[giver].findIndex((kind,i)=>kind==='neutral'&&!state.bystanders[giver][i]&&!state.revealed[i]);
    state=applyAction(state,actingSeat(state),{kind:'guess',index:neutral});
  }
  assert.equal(state.result,'time');assert.equal(state.turnsLeft,0);
});
