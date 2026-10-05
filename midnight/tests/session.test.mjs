import test from 'node:test';
import assert from 'node:assert/strict';
import {validateView} from '../src/session.js';
import {createGame, applyAction, playerView} from '../src/rules.js';

test('malformed snapshots are rejected before a UI update', () => {
  const guest=playerView(createGame('heist',7),1);
  assert.equal(validateView(structuredClone(guest)).type,'heist');
  for(const field of ['loot','used','guards','raids']) {
    const view=structuredClone(guest);view[field]=null;
    assert.throws(()=>validateView(view));
  }
  const view=structuredClone(guest);view.log=[{kind:'heist',outcomes:null}];
  assert.throws(()=>validateView(view));
});

test('untrusted round labels and discard amounts cannot enter rendered snapshots', () => {
  let state=createGame('backhand',3);
  state=applyAction(state,0,{kind:'bid',card:'b05'});state=applyAction(state,1,{kind:'bid',card:'b11'});
  let view=playerView(state,1);
  assert.equal(validateView(structuredClone(view)).phase,'reveal');
  view.log[0].round='<img src=x onerror=alert(1)>';
  assert.throws(()=>validateView(view));
  view=playerView(state,1);
  view.result.discarded='<img src=x onerror=alert(1)>';
  assert.throws(()=>validateView(view));
});
