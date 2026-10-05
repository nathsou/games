import test from 'node:test';
import assert from 'node:assert/strict';
import {validateView} from '../src/session.js';
import {createMatch, playerView} from '../src/rules.js';

test('Malformed end-of-round snapshots are rejected before the UI reads a missing result',()=>{
  const view=playerView(createMatch({},14),1);
  assert.equal(validateView(structuredClone(view),1).revision,0);
  const missing=structuredClone(view);missing.phase='roundOver';assert.throws(()=>validateView(missing,1));
  const score=structuredClone(view);score.scores=[2,0];assert.throws(()=>validateView(score,1));
  const history=structuredClone(view);history.round=1;assert.throws(()=>validateView(history,1));
  const exposed=structuredClone(view);exposed.hands[0][0]={id:'c0',ends:[1,2],face:0};assert.throws(()=>validateView(exposed,1));
});
