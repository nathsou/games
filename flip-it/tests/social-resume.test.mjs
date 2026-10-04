import test from 'node:test';
import assert from 'node:assert/strict';
import {FlipSession} from '../src/session.js';
import {saveTable, loadTable, forgetTable} from '../src/resume.js';
import {legalActions,playerView,createMatch} from '../src/rules.js';

function pair() {
  const errors = [];
  const host = new FlipSession({name:'Alex', onError:e=>errors.push(e.message)});
  const guest = new FlipSession({seat:1, name:'Jamie', onError:e=>errors.push(e.message)});
  host.setPeer({connected:true, send:m=>guest.receive(structuredClone(m))});
  guest.setPeer({connected:true, send:m=>host.receive(structuredClone(m))});
  guest.opened();
  let seed=1;while(createMatch({},seed).turn!==0)seed++;host.start({},seed);
  return {host, guest, errors};
}
const memory = () => {const data = new Map(); return {getItem:k=>data.get(k), setItem:(k,v)=>data.set(k,v), removeItem:k=>data.delete(k)};};
test('chat and reactions reach both peers without altering game revision or private views', () => {
  const {host, guest, errors} = pair();
  const before = structuredClone(host.state);
  host.sendSocial('chat', '<img src=x onerror=alert(1)>');
  guest.sendSocial('reaction', '🔥');
  assert.deepEqual(host.messages, guest.messages);
  assert.equal(host.messages[1].seat, 1); assert.equal(host.messages[1].text, '🔥');
  assert.deepEqual(host.state, before); assert.deepEqual(errors, []);
  assert(guest.view.hands[0].every(c=>c.hidden));
});
test('invalid, forged, oversized, stale and repeated social messages cannot enter chat', () => {
  const {host, guest, errors} = pair();
  assert.throws(()=>host.sendSocial('chat', ' '.repeat(5)));
  assert.throws(()=>host.sendSocial('chat', 'a'.repeat(241)));
  assert.throws(()=>host.sendSocial('reaction', 'unknown'));
  guest.receive({type:'social-entry',epoch:guest.epoch,entry:{kind:'chat',text:'Forged',seat:8,sequence:1}});
  host.receive({type:'social',epoch:'old',kind:'chat',text:'Old'});
  host.sendSocial('chat','Hello');
  assert.throws(()=>host.sendSocial('chat','Too fast'));
  guest.receive({type:'social-entry',epoch:guest.epoch,entry:host.messages[0]});
  assert.equal(host.messages.length,1); assert.equal(guest.messages.length,1); assert.equal(errors.length,2);
  host.peer.connected=false; assert.throws(()=>host.sendSocial('chat','Offline'));
});
test('a restored host resumes its exact authoritative match with a new peer and epoch', () => {
  const {host, guest} = pair(), storage = memory();
  host.choose(legalActions(host.view,0).find(a=>a.kind==='play'));
  saveTable(host,storage); const saved=loadTable(storage); assert(saved);
  const restored = new FlipSession({name:saved.members[0]});
  Object.assign(restored, {members:saved.members, controllers:saved.controllers, state:saved.state, view:saved.view});
  assert.equal(restored.readyForPlay,false);
  assert.deepEqual(restored.state,host.state);
  restored.setPeer({connected:true,send:m=>guest.receive(structuredClone(m))});
  guest.setPeer({connected:true,send:m=>restored.receive(structuredClone(m))});
  guest.opened(); assert.deepEqual(guest.view.table,restored.view.table);
  guest.choose(legalActions(guest.view,1)[0]); assert.equal(restored.state.revision,2);
  forgetTable(storage); assert.equal(loadTable(storage),null);
});
test('guest persistence is redacted and damaged or inaccessible saves fail gracefully', () => {
  const {guest}=pair(), storage=memory();
  saveTable(guest,storage); const saved=loadTable(storage); assert(saved);
  assert.equal(saved.state,null); assert(saved.view.hands[0].every(c=>c.hidden));
  saved.view.hands[0][0]={id:'stolen'}; storage.setItem('flip-it.last-table.v2',JSON.stringify(saved));
  assert.equal(loadTable(storage),null);
  assert.equal(loadTable({getItem(){throw new Error('Denied');}}),null);
  assert.doesNotThrow(()=>saveTable(guest,{setItem(){throw new Error('Full');}}));
});

test('legacy two-space quick saves preserve retired cards flipped without exposing guest hands',()=>{
  const {host}=pair(),storage=memory();
  const card=host.state.hands[1].pop();host.state.table[1][1]=[card];
  host.view=playerView(host.state,0);
  saveTable(host,storage);const raw=JSON.parse(storage.getItem('flip-it.last-table.v2'));raw.version=2;
  storage.setItem('flip-it.last-table.v2',JSON.stringify(raw));
  const saved=loadTable(storage);assert(saved?.migrated);
  assert.equal(saved.state.table[1][1].length,0);assert.equal(saved.state.hands[1].at(-1).face,1-card.face);
  assert(saved.view.hands[1].every(c=>c.hidden));assert.equal(saved.view.hands[1].length,host.state.hands[1].length+1);
});

test('pre-star saves keep their current turn and gain the physical marker',()=>{
  const {host}=pair(),storage=memory();host.choose({kind:'flip',lane:0});saveTable(host,storage);
  const raw=JSON.parse(storage.getItem('flip-it.last-table.v2'));raw.version=3;
  for(const state of[raw.state,raw.view]){
    delete state.firstPlayer;
    for(const card of[...state.hands.flat(),...state.table.flat(2),...(state.discard||[])])delete card.star;
  }
  storage.setItem('flip-it.last-table.v2',JSON.stringify(raw));const saved=loadTable(storage);
  assert(saved);assert.equal(saved.state.turn,raw.state.turn);assert.equal(saved.state.revision,raw.state.revision);
  assert.equal([...saved.state.hands.flat(),...saved.state.table.flat(2),...saved.state.discard].filter(c=>c.star).length,1);
  assert(saved.view.hands[1].every(c=>c.hidden));assert.deepEqual(saved.view,playerView(saved.state,0));
});
