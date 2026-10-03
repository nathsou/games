import test from 'node:test';
import assert from 'node:assert/strict';
import {TableSession, commitment, validateView} from '../src/session.js';

async function pair(type, team = false) {
  const queue = [], errors = [];
  const host = new TableSession({seat: 0, name: 'Alex', team, onUpdate() {}, onError: e => errors.push(e)});
  const guest = new TableSession({seat: 1, name: 'Jamie', onUpdate() {}, onError: e => errors.push(e)});
  host.initialGame = type;
  host.setPeer({connected: true, send: m => queue.push([guest, structuredClone(m)])});
  guest.setPeer({connected: true, send: m => queue.push([host, structuredClone(m)])});
  async function flush() { while(queue.length) { const [receiver, message] = queue.shift(); await receiver.receive(message); } }
  host.opened(); guest.opened(); await flush();
  return {host, guest, queue, errors, flush, close() {host.peer.connected = guest.peer.connected = false; clearTimeout(host.botTimer);}};
}
test('actual session messages resolve all simultaneous phases without exposing a first choice', async () => {
  for (const type of ['backhand','heist']) {
    const room = await pair(type);
    const {host,guest,flush,errors} = room;
    const action = (client, phase) => phase === 'raid' ? {kind:'raid',choice:'safe'} : {kind:type==='backhand'?'bid':'guard',card:client.view.hands[client.seat][0].id};
    await host.choose(action(host,host.view.phase)); await flush();
    assert.equal(host.state.revision,0);
    assert(guest.locked(0));
    assert.equal(guest.view.phase,type==='backhand'?'choose':'guard');
    assert(guest.view.hands[0].every(c=>c.hidden));
    await guest.choose(action(guest,guest.view.phase)); await flush();
    assert.equal(host.state.revision,2);
    if(type==='heist') {
      await guest.choose(action(guest,'raid'));await flush();
      assert.equal(host.state.revision,2);
      await host.choose(action(host,'raid'));await flush();
    }
    assert.equal(host.view.phase,'reveal');
    assert.deepEqual(host.view.scores,guest.view.scores);
    await guest.choose({kind:'next'});await flush();
    assert.equal(host.state.phase,'reveal');
    await host.choose({kind:'next'});await flush();
    assert.equal(host.state.round,1);
    assert.deepEqual(errors,[]);
    room.close();
  }
});
test('stale sequential moves and illegal remote turns cannot mutate the game', async () => {
  const room=await pair('closing'),{host,guest,flush,errors}=room;
  const lot=host.state.auctions[0].id;
  await host.choose({kind:'cube',to:lot});await flush();
  await host.choose({kind:'tick',lot:host.state.auctions[1].id});await flush();
  const revision=host.state.revision;
  await host.receive({type:'action',epoch:host.epoch,revision:revision-1,action:{kind:'skip'}});await flush();
  assert.equal(host.state.revision,revision);
  await guest.choose({kind:'skip'});await flush();
  await guest.choose({kind:'tick',lot});await flush();
  assert.equal(host.state.turn,0);
  const before=structuredClone(host.state);
  await host.receive({type:'action',epoch:host.epoch,revision:host.state.revision,action:{kind:'skip'}});
  assert.deepEqual(host.state,before);
  assert.equal(errors.length,1);
  room.close();
});
test('a changed reveal and replay from another phase fail before advancing a game', async () => {
  const room=await pair('backhand'),{host,guest,flush,errors}=room;
  const context=host.context(),salt='a'.repeat(32),action={kind:'bid',card:'b15'};
  await host.choose({kind:'bid',card:'b05'});await flush();
  const hash=await commitment(context,1,action,salt);
  await host.receive({type:'commit',context,hash});
  await host.receive({type:'reveal',context,action:{kind:'bid',card:'b14'},salt});
  assert.equal(host.state.revision,0);
  assert.match(errors[0].message,/did not match/);
  await host.receive({type:'commit',context:'old-table/backhand/1/choose',hash});
  assert.equal(host.state.revision,0);
  assert.equal(errors.length,2);
  room.close();
});
test('co-op shares one redacted hand and accepts only one of two simultaneous teammate clicks', async () => {
  const room=await pair('backhand',true),{host,guest,flush,errors}=room;
  assert(guest.team);
  assert.deepEqual(host.view.hands,guest.view.hands);
  assert(guest.view.hands[1].every(c=>c.hidden));
  const action={kind:'bid',card:host.view.hands[0][0].id};
  await guest.choose(action); // queued against revision zero
  await host.choose(action); // accepted first at the authority
  await flush();
  assert.equal(host.state.revision,1);
  assert.equal(host.state.pending[0],action.card);
  assert(!guest.movePending);
  await new Promise(resolve=>setTimeout(resolve,450));await flush();
  assert.equal(host.state.revision,2);
  assert.equal(host.view.phase,'reveal');
  assert.deepEqual(host.view.scores,guest.view.scores);
  assert.deepEqual(errors,[]);
  room.close();
});
test('malformed snapshots are rejected before a UI update', async () => {
  const room=await pair('heist'),{guest}=room;
  for(const field of ['loot','used','guards','raids']) {
    const view=structuredClone(guest.view);view[field]=null;
    assert.throws(()=>validateView(view));
  }
  const view=structuredClone(guest.view);view.log=[{kind:'heist',outcomes:null}];
  assert.throws(()=>validateView(view));
  room.close();
});

test('untrusted round labels and discard amounts cannot enter rendered snapshots', async () => {
  const room=await pair('backhand'),{host,guest,flush}=room;
  await host.choose({kind:'bid',card:'b05'});await flush();
  await guest.choose({kind:'bid',card:'b11'});await flush();
  let view=structuredClone(guest.view);
  view.log[0].round='<img src=x onerror=alert(1)>';
  assert.throws(()=>validateView(view));
  view=structuredClone(guest.view);
  view.result.discarded='<img src=x onerror=alert(1)>';
  assert.throws(()=>validateView(view));
  room.close();
});
test('a model co-op dealer is requested only on its own auction turn',async()=>{
 const {legalActions,playerView}=await import('../src/rules.js');let calls=0;const errors=[];
 let host,guest;
 host=new TableSession({seat:0,team:true,onUpdate:()=>{},onError:e=>errors.push(e.message),chooseBot:(view,seat)=>{calls++;const actions=legalActions(view,seat);assert(actions.length>0);return actions[0];}});
 guest=new TableSession({seat:1,team:true,onUpdate:()=>{},onError:e=>errors.push(e.message)});
 host.setPeer({connected:true,send:m=>guest.receive(structuredClone(m))});guest.setPeer({connected:true,send:m=>host.receive(structuredClone(m))});host.start('closing',8);host.readyForPlay=true;
 await Promise.resolve();assert.equal(calls,0);
 await host.choose(legalActions(host.state,0)[0]);await Promise.resolve();assert.equal(calls,0);
 await host.choose(legalActions(host.state,0)[0]);await new Promise(resolve=>setTimeout(resolve,5));assert.equal(calls,1);assert.deepEqual(errors,[]);clearTimeout(host.botTimer);
});
