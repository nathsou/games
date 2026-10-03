import test from 'node:test';
import assert from 'node:assert/strict';
import {FlipSession, validateView} from '../src/session.js';
import {createMatch, legalActions, playerView} from '../src/rules.js';
import {botAction} from '../src/bot.js';
import {encodePairing, decodePairing, makeLink, iceConfig} from '../src/peer.js';

function pair(options, team = false) {
  const errors=[];
  const host=new FlipSession({name:'Alex',options,team,onError:e=>errors.push(e.message)});
  const guest=new FlipSession({seat:1,name:'Jamie',onError:e=>errors.push(e.message)});
  const a={connected:true,send:m=>guest.receive(structuredClone(m))};
  const b={connected:true,send:m=>host.receive(structuredClone(m))};
  host.setPeer(a);guest.setPeer(b);host.opened();guest.opened();
  return {host,guest,a,b,errors};
}
test('Duel peers get the same options and table, with their opponent’s hand hidden',()=>{
  const {host,guest,errors}=pair({compactDeck:false,quickTurns:false,lastChance:true});
  assert.deepEqual(host.view.options,guest.view.options);
  assert.ok(host.view.hands[1].every(c=>c.hidden));assert.ok(guest.view.hands[0].every(c=>c.hidden));
  host.choose(legalActions(host.view,0)[0]);
  guest.choose(legalActions(guest.view,1)[0]);
  assert.equal(host.view.revision,2);assert.equal(guest.view.revision,2);assert.deepEqual(errors,[]);
});
test('Stale and out-of-turn guest actions cannot change authoritative state',()=>{
  const {host,guest,errors}=pair();
  const before=structuredClone(host.state);
  host.receive({type:'action',epoch:host.epoch,revision:host.state.revision,action:{kind:'flip',lane:0}});
  assert.deepEqual(host.state,before);assert.equal(errors.length,1);
  host.choose({kind:'flip',lane:0});
  const updated=structuredClone(host.state);
  host.receive({type:'action',epoch:host.epoch,revision:0,action:{kind:'flip',lane:0}});
  assert.deepEqual(host.state,updated);assert.equal(guest.movePending,false);
});
test('Team peers share a visible hand and reject a competing move at an old revision',()=>{
  const {host,guest}=pair({},true);
  assert.deepEqual(host.view.hands,guest.view.hands);
  guest.choose({kind:'flip',lane:0});assert.equal(host.state.turn,1);
  const before=structuredClone(host.state);
  host.receive({type:'action',epoch:host.epoch,revision:0,action:{kind:'flip',lane:0}});
  assert.deepEqual(host.state,before);
  host.dealerMove(botAction(playerView(host.state,1)));
  assert.equal(guest.view.revision,host.state.revision);
});
test('Both peers must be ready before the next round; reconnect preserves the match',()=>{
  const {host,guest,a,b,errors}=pair();
  while(host.state.phase==='playing') {
    const acting=host.state.turn===0?host:guest;
    acting.choose(botAction(acting.view));
  }
  const revision=host.state.revision;
  host.choose({kind:'next'});assert.equal(host.state.revision,revision);
  guest.choose({kind:'next'});assert.equal(host.state.round,1);assert.equal(guest.view.round,1);
  const before=structuredClone(host.state),oldEpoch=host.epoch;
  host.setPeer(a);guest.setPeer(b);host.opened();guest.opened();
  assert.deepEqual(host.state,before);assert.notEqual(host.epoch,oldEpoch);assert.deepEqual(host.view.table,guest.view.table);
  a.connected=false;assert.throws(()=>host.choose({kind:'flip',lane:0}));assert.deepEqual(errors,[]);
});
test('Pairing links round-trip and reject cross-game tokens or wrong types',async()=>{
  const offer={type:'offer',sdp:'v=0\r\na=test'};const room='0123456789abcdef';
  const token=await encodePairing(offer,room);
  const decoded=await decodePairing(makeLink(token,'offer','https://example.test/flip-it/?old=1'),'offer');
  assert.equal(decoded.sdp,offer.sdp);assert.equal(decoded.room,room);
  await assert.rejects(()=>decodePairing(token,'answer'));
  await assert.rejects(()=>decodePairing(token.replace('FI1','MT1'),'offer'));
  await assert.rejects(()=>decodePairing('not a link','offer'));
  assert.deepEqual(iceConfig(''),{iceServers:[]});assert.throws(()=>iceConfig('https://bad'));
});
test('Malformed end-of-round snapshots are rejected before the UI reads a missing result',()=>{
  const view=playerView(createMatch({},14),1);
  const missing=structuredClone(view);missing.phase='roundOver';assert.throws(()=>validateView(missing,1));
  const score=structuredClone(view);score.scores=[2,0];assert.throws(()=>validateView(score,1));
  const history=structuredClone(view);history.round=1;assert.throws(()=>validateView(history,1));
});
