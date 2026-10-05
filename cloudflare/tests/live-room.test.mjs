import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {displayName} from '../protocol.js';

const origin='https://games.example';
const modules=[];
function addModule(url){const path=fileURLToPath(url);if(modules.some(m=>m.path===path))return;modules.push({type:'ESModule',path});for(const match of readFileSync(path,'utf8').matchAll(/from ['"](\.[^'"]+)['"]/g))addModule(new URL(match[1],url));}
addModule(new URL('../worker.js',import.meta.url));
const runtime=()=>new Miniflare(convertV4MiniflareOptions({modules,modulesRoot:fileURLToPath(new URL('../..',import.meta.url)),compatibilityDate:'2026-10-04',durableObjects:{SIGNAL_ROOMS:{className:'SignalRoom',useSQLite:true},INVITE_LIMITS:{className:'InviteLimiter',useSQLite:true}}}));
async function until(fn,label='room update'){const start=Date.now();while(!fn()){if(Date.now()-start>5000)throw Error('Timed out waiting for '+label+'.');await new Promise(r=>setTimeout(r,10));}}

async function friendRoom(mf){
  const created=await mf.dispatchFetch(origin+'/api/rooms',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({game:'friends',protocol:1})});
  const room=await created.json(),base=origin+'/api/rooms/friends/'+room.room;
  const call=async(key,path,body,method)=>{const response=await mf.dispatchFetch(base+'/'+path,{method:method||(body===undefined?'GET':'POST'),headers:{Origin:origin,Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json().catch(()=>null)};};
  const host=(await call(room.hostKey,'resume',{})).data;
  return {room,base,call,host,claimGuest:async(name)=>(await call(room.guestKey,'resume',name?{name}:{})).data};
}
async function live(mf,room,key){
  const response=await mf.dispatchFetch(origin+'/api/rooms/friends/'+room+'/live',{headers:{Origin:origin,Upgrade:'websocket','Sec-WebSocket-Protocol':'games.v1, auth.'+key}});
  if(response.status!==101)return {status:response.status};
  const ws=response.webSocket,messages=[];
  ws.addEventListener('message',e=>messages.push(JSON.parse(e.data)));ws.accept();
  const last=type=>messages.findLast(m=>m.type===type);
  return {ws,messages,last,send:message=>ws.send(JSON.stringify(message))};
}

test('display names drop control and invisible characters and keep 24 characters',()=>{
  assert.equal(displayName('  Ada\u0000 ‮Lovelace  '),'Ada Lovelace');
  assert.equal(displayName('x'.repeat(40)).length,24);
  assert.equal(displayName(42),'');assert.equal(displayName('\n\t'),'');
});

test('live room pages need a private seat and report presence, names and departures',async()=>{
  const mf=runtime();try{
    const {room,call,host,claimGuest}=await friendRoom(mf);
    assert.equal((await live(mf,room.room,room.guestKey)).status,403,'An unclaimed invitation cannot open a live page');
    const hostPage=await live(mf,room.room,host.key);await until(()=>hostPage.last('welcome'));
    const welcome=hostPage.last('welcome');
    assert.equal(welcome.role,'host');assert.deepEqual(welcome.friend,{name:'',joined:false,online:false,visible:false,page:null,game:null});
    assert.deepEqual(welcome.chat,{sequence:0,entries:[]});assert.deepEqual(welcome.games,[]);
    assert.equal((await call(host.key,'profile',{name:'  '})).status,400);
    assert.equal((await call(host.key,'profile',{name:'Ada'})).data.name,'Ada');
    await until(()=>hostPage.last('presence')?.you.name==='Ada','own name');
    const guest=await claimGuest();
    await until(()=>hostPage.last('presence')?.friend.joined,'guest claim');
    const guestPage=await live(mf,room.room,guest.key);await until(()=>guestPage.last('welcome'));
    assert.equal(guestPage.last('welcome').friend.name,'Ada');assert(guestPage.last('welcome').friend.online);
    await until(()=>hostPage.last('presence')?.friend.online,'guest online');
    guestPage.send({type:'presence',page:'flip-it',game:null,visible:false});
    await until(()=>hostPage.last('presence')?.friend.page==='flip-it','guest page');
    assert.equal(hostPage.last('presence').friend.visible,false);
    await until(()=>guestPage.last('presence')?.type,'heartbeat reply');
    guestPage.send({type:'presence',page:'<script>',visible:true});
    await until(()=>hostPage.last('presence')?.friend.visible,'sanitized presence');
    assert.equal(hostPage.last('presence').friend.page,null);
    await call(guest.key,'profile',{name:'Grace'});
    await until(()=>hostPage.last('presence')?.friend.name==='Grace','friend name');
    guestPage.ws.close(1000);
    await until(()=>!hostPage.last('presence').friend.online,'guest departure');
  }finally{await mf.dispose();}
});

test('chat, game creation, moves and endings are pushed with role-private views',async()=>{
  const mf=runtime();try{
    const {room,call,host,claimGuest}=await friendRoom(mf),guest=await claimGuest();
    const hostPage=await live(mf,room.room,host.key),guestPage=await live(mf,room.room,guest.key);
    await until(()=>hostPage.last('welcome')&&guestPage.last('welcome'));
    await call(guest.key,'chat',{kind:'text',value:'Ready when you are'});
    await until(()=>hostPage.last('chat'),'chat push');
    assert.equal(hostPage.last('chat').history.entries[0].value,'Ready when you are');assert.equal(hostPage.last('chat').by,'guest');
    const created=await call(host.key,'turns',{game:'flip-it',setup:{}});assert.equal(created.status,201);
    await until(()=>guestPage.last('game'),'game push');
    const pushed=guestPage.last('game');
    assert.deepEqual(pushed.cause,{by:'host',kind:'created'});assert.equal(pushed.game.creator,'host');
    assert(pushed.game.view.hands[0].every(card=>card.hidden),'The guest never receives the host hand');
    assert(hostPage.last('game').game.view.hands[1].every(card=>card.hidden),'The host never receives the guest hand');
    const turn=pushed.game.view.turn,mover=turn===0?host:guest,moverPage=turn===0?hostPage:guestPage,waitingPage=turn===0?guestPage:hostPage;
    const count=waitingPage.messages.length;
    assert.equal((await call(mover.key,'turns/'+created.data.id+'/moves',{revision:0,action:{kind:'flip',lane:0}})).status,200);
    await until(()=>waitingPage.messages.length>count&&waitingPage.last('game').game.revision===1,'move push');
    assert.equal(waitingPage.last('game').cause.kind,'move');assert(waitingPage.last('game').game.myTurn);
    assert(moverPage.last('game').game.revision===1||await until(()=>moverPage.last('game').game.revision===1));
    assert.equal((await call(guest.key,'turns/'+created.data.id,undefined,'DELETE')).status,200);
    await until(()=>hostPage.last('game').cause.kind==='abandoned','ending push');
    const ended=hostPage.last('game').game;assert(ended.finished);assert.equal(ended.abandoned,'guest');assert(!ended.myTurn);
    assert.equal((await call(host.key,'turns/'+created.data.id+'/moves',{revision:1,action:{kind:'flip',lane:0}})).status,400);
    assert.equal((await call(host.key,'turns/'+created.data.id,undefined,'DELETE')).status,400);
  }finally{await mf.dispose();}
});

test('relayed requests reach only the friend and invalid messages close the page',async()=>{
  const mf=runtime();try{
    const {room,host,claimGuest}=await friendRoom(mf),guest=await claimGuest();
    const hostPage=await live(mf,room.room,host.key),second=await live(mf,room.room,host.key),guestPage=await live(mf,room.room,guest.key);
    await until(()=>hostPage.last('welcome')&&second.last('welcome')&&guestPage.last('welcome'));
    hostPage.send({type:'relay',data:{kind:'cursors-invite',id:'x',page:'spacegolf'}});
    await until(()=>guestPage.last('relay'),'relay');
    assert.deepEqual(guestPage.last('relay').data,{kind:'cursors-invite',id:'x',page:'spacegolf'});
    assert(!second.last('relay'),'Relays are not echoed to the sender seat');
    let closed=false;second.ws.addEventListener('close',()=>{closed=true;});
    second.send({type:'relay',data:{kind:'<bad>'}});
    await until(()=>closed,'invalid relay close');
    assert(hostPage.ws.readyState===1);
  }finally{await mf.dispose();}
});

test('a name sent while claiming a seat reaches the friend with the join',async()=>{
  const mf=runtime();try{
    const {room,host,claimGuest}=await friendRoom(mf);
    const hostPage=await live(mf,room.room,host.key);await until(()=>hostPage.last('welcome'));
    await claimGuest('  Grace\u0007 ');
    await until(()=>hostPage.last('presence')?.friend.joined,'join');
    assert.equal(hostPage.last('presence').friend.name,'Grace');
  }finally{await mf.dispose();}
});
