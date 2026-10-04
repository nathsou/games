import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {signalMessage} from '../protocol.js';
import {hostedInvitation,hostedLink} from '../../shared/signaling.js';

const origin='https://games.example';
const modules=[];
function addModule(url){const path=fileURLToPath(url);if(modules.some(m=>m.path===path))return;modules.push({type:'ESModule',path});for(const match of readFileSync(path,'utf8').matchAll(/from ['"](\.[^'"]+)['"]/g))addModule(new URL(match[1],url));}
addModule(new URL('../worker.js',import.meta.url));
function runtime(options={}){return new Miniflare(convertV4MiniflareOptions({modules,modulesRoot:fileURLToPath(new URL('../..',import.meta.url)),compatibilityDate:'2026-10-04',durableObjects:{SIGNAL_ROOMS:{className:'SignalRoom',useSQLite:true},INVITE_LIMITS:{className:'InviteLimiter',useSQLite:true}},...options}));}

async function create(mf,game='flip-it',metadata){
  const response=await mf.dispatchFetch(origin+'/api/rooms',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({game,protocol:game==='flip-it'?6:1,metadata})});
  assert.equal(response.status,201);return response.json();
}
async function connect(mf,room,key,game='flip-it'){
  const response=await mf.dispatchFetch(origin+'/api/rooms/'+game+'/'+room+'/socket',{headers:{Origin:origin,Upgrade:'websocket','Sec-WebSocket-Protocol':'games.v1, auth.'+key}});
  if(response.status!==101)return response;
  const ws=response.webSocket,messages=[];ws.addEventListener('message',e=>messages.push(JSON.parse(e.data)));ws.addEventListener('close',e=>ws.close(e.code,e.reason));ws.accept();
  return {ws,messages};
}
async function until(fn){const start=Date.now();while(!fn()){if(Date.now()-start>5000)throw Error('Timed out waiting for signaling.');await new Promise(r=>setTimeout(r,10));}}
test('room permissions, buffering, role restrictions, replay prevention and origin checks',async()=>{
  for(const game of ['flip-it','friends']) {
  const mf=runtime();
  try{
    assert.equal((await mf.dispatchFetch(origin+'/api/config')).status,200);
    const room=await create(mf,game);assert.notEqual(room.hostKey,room.guestKey);
    const path=origin+'/api/rooms/'+game+'/'+room.room;
    assert.equal((await mf.dispatchFetch(path+'/info')).status,401);
    assert.equal((await mf.dispatchFetch(path+'/info',{headers:{Authorization:'Bearer '+'f'.repeat(64)}})).status,401);
    assert.equal((await mf.dispatchFetch(path+'/info',{headers:{Origin:'https://other.example',Authorization:'Bearer '+room.guestKey}})).status,403);
    const info=await mf.dispatchFetch(path+'/info',{headers:{Authorization:'Bearer '+room.guestKey}});assert.equal(info.status,200);assert.equal((await info.json()).role,'guest');
    assert.equal((await mf.dispatchFetch(origin+'/api/rooms/cluance/'+room.room+'/info',{headers:{Authorization:'Bearer '+room.guestKey}})).status,410);
    const host=await connect(mf,room.room,room.hostKey,game);await until(()=>host.messages.length);assert.equal(host.messages[0].role,'host');
    assert.equal((await connect(mf,room.room,room.hostKey,game)).status,409);
    host.ws.send(JSON.stringify({type:'candidate',candidate:{candidate:'candidate:test',sdpMid:'0',sdpMLineIndex:0}}));
    host.ws.send(JSON.stringify({type:'offer',sdp:'v=0\r\n'}));
    const guest=await connect(mf,room.room,room.guestKey,game);await until(()=>guest.messages.length===3);
    assert.deepEqual(guest.messages.map(m=>m.type),['ready','candidate','offer']);
    guest.ws.send(JSON.stringify({type:'answer',sdp:'v=0\r\n'}));await until(()=>host.messages.length===2);assert.equal(host.messages[1].type,'answer');
    host.ws.send(JSON.stringify({type:'connected'}));guest.ws.send(JSON.stringify({type:'connected'}));
    await until(()=>host.ws.readyState===3);
    assert.equal((await mf.dispatchFetch(path+'/info',{headers:{Authorization:'Bearer '+room.guestKey}})).status,410);
  }finally{await mf.dispose();}
  }
});
test('gameplay and oversized messages cannot enter signaling; TURN requires an invitation',async()=>{
  const mf=runtime();try{
    const room=await create(mf),guest=await connect(mf,room.room,room.guestKey);await until(()=>guest.messages.length);
    guest.ws.send(JSON.stringify({type:'offer',sdp:'v=0\r\n'}));await until(()=>guest.ws.readyState===3);
    const other=await create(mf),host=await connect(mf,other.room,other.hostKey);await until(()=>host.messages.length);
    host.ws.send(JSON.stringify({type:'chat',text:'private game data'}));await until(()=>host.ws.readyState===3);
    const big=await create(mf),socket=await connect(mf,big.room,big.hostKey);await until(()=>socket.messages.length);
    socket.ws.send('x'.repeat(65537));await until(()=>socket.ws.readyState===3);
    const endpoint=origin+'/api/rooms/flip-it/'+other.room+'/ice';
    assert.equal((await mf.dispatchFetch(endpoint,{method:'POST',headers:{Origin:origin}})).status,401);
    const ice=await mf.dispatchFetch(endpoint,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+other.guestKey}});assert.equal(ice.status,200);assert.deepEqual(await ice.json(),{iceServers:[]});
  }finally{await mf.dispose();}
});
test('room creation is limited, scoped to an origin and validates public Cluance roles',async()=>{
  const mf=runtime();try{
    assert.equal((await mf.dispatchFetch(origin+'/api/rooms',{method:'POST',headers:{Origin:'https://other.example'}})).status,403);
    assert.equal((await mf.dispatchFetch(origin+'/api/rooms',{method:'POST'})).status,403);
    const tooLarge=JSON.stringify({game:'flip-it',protocol:6,padding:'🙂'.repeat(600)});
    assert.equal((await mf.dispatchFetch(origin+'/api/rooms',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:tooLarge})).status,400);
    const metadata={role:'guesser',options:{theme:'french',clueTheme:'global',variant:'fixed'},secret:'must be stripped'};
    const room=await create(mf,'cluance',metadata);
    const info=await mf.dispatchFetch(origin+'/api/rooms/cluance/'+room.room+'/info',{headers:{Authorization:'Bearer '+room.guestKey}});
    assert.deepEqual((await info.json()).metadata,{role:'guesser',options:metadata.options});
    for(let i=1;i<30;i++)await create(mf);
    assert.equal((await mf.dispatchFetch(origin+'/api/rooms',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({game:'flip-it',protocol:6})})).status,429);
  }finally{await mf.dispose();}
});
test('short invitations keep capabilities in fragments and reject other games and sites',()=>{
  const invitation={game:'flip-it',room:'a'.repeat(32),key:'b'.repeat(64)},base=origin+'/flip-it/';
  const link=hostedLink(invitation,base);assert(!new URL(link).search);assert.deepEqual(hostedInvitation(link,'flip-it',base),invitation);
  assert.throws(()=>hostedInvitation(link,'cluance',origin+'/cluance/'));
  assert.throws(()=>hostedInvitation(link,'flip-it','https://other.example/flip-it/'));
  assert.equal(hostedInvitation(base+'#invite=legacy','flip-it',base),null);
  assert.throws(()=>signalMessage({type:'chat',text:'not signaling'},'host'));
});
test('TURN credentials are short-lived, limited per seat, and never expose the long-term token',async()=>{
  let calls=0;
  const mf=runtime({bindings:{TURN_KEY_ID:'test-key',TURN_API_TOKEN:'server-only-secret'},outboundService:async request=>{
    assert.equal(request.url,'https://rtc.live.cloudflare.com/v1/turn/keys/test-key/credentials/generate-ice-servers');
    assert.equal(request.headers.get('Authorization'),'Bearer server-only-secret');assert.deepEqual(await request.json(),{ttl:3600});calls++;
    return Response.json({iceServers:[{urls:'turn:turn.cloudflare.com:3478',username:'temporary-user',credential:'temporary-password'}]}, {status:201});
  }});
  try{
    const room=await create(mf),url=origin+'/api/rooms/flip-it/'+room.room+'/ice';
    for(let i=0;i<4;i++){
      const response=await mf.dispatchFetch(url,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+room.guestKey}});
      assert.equal(response.status,200);const body=await response.text();assert(body.includes('temporary-password'));assert(!body.includes('server-only-secret'));assert.equal(response.headers.get('Cache-Control'),'no-store');
    }
    assert.equal((await mf.dispatchFetch(url,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+room.guestKey}})).status,429);
    assert.equal(calls,4);
    assert.equal((await mf.dispatchFetch(url,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+room.hostKey}})).status,200);
  }finally{await mf.dispose();}
});
test('expired room capabilities cannot read metadata, mint credentials or open a socket',async()=>{
  const mf=runtime();try{
    const room=await create(mf),ns=await mf.getDurableObjectNamespace('SIGNAL_ROOMS');
    await ns.getByName('flip-it:'+room.room).fetch('https://internal/create',{method:'POST',body:JSON.stringify({game:'flip-it',protocol:6,origin,expiresAt:Date.now()-1000})});
    const path=origin+'/api/rooms/flip-it/'+room.room;
    for(const action of ['info','ice'])assert.equal((await mf.dispatchFetch(path+'/'+action,{method:action==='ice'?'POST':'GET',headers:{Origin:origin,Authorization:'Bearer '+room.guestKey}})).status,410);
    assert.equal((await connect(mf,room.room,room.guestKey)).status,410);
  }finally{await mf.dispose();}
});

test('private seats resume, turn games survive offline, and stale moves never apply twice',async()=>{
  const mf=runtime();try{
    const room=await create(mf,'friends'),base=origin+'/api/rooms/friends/'+room.room;
    const call=async(key,path,body)=>{const response=await mf.dispatchFetch(base+'/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};};
    const host=(await call(room.hostKey,'resume',{})).data,guest=(await call(room.guestKey,'resume',{})).data;
    assert.equal((await call(room.guestKey,'resume',{})).status,410);
    assert.equal((await call(room.hostKey,'info')).status,410);
    const settings={role:'giver',options:{theme:'french',clueTheme:'global',variant:'fixed'}};
    const created=await call(host.key,'turns',{game:'cluance',setup:settings});assert.equal(created.status,201);
    const id=created.data.id,giver=created.data.view;assert(giver.secret&&giver.hand.length===5);assert(!giver.draw);
    const waiting=(await call(guest.key,'turns/'+id)).data;assert(!waiting.myTurn);assert(!waiting.view.secret&&!waiting.view.hand&&!waiting.view.draw);
    assert.equal((await call(guest.key,'turns/'+id+'/moves',{revision:0,action:{cards:[waiting.view.board[0]]}})).status,400);
    const action={card:giver.hand[0],relation:'similar',rationale:'sealed private meaning'+'é'.repeat(1100)};
    const moves=await Promise.all([call(host.key,'turns/'+id+'/moves',{revision:0,action}),call(host.key,'turns/'+id+'/moves',{revision:0,action})]);assert.deepEqual(moves.map(m=>m.status).sort(),[200,409]);
    const updated=(await call(guest.key,'turns/'+id)).data;assert(updated.myTurn);assert(!JSON.stringify(updated).includes('sealed private meaning'));
    const safe=giver.board.find(card=>card!==giver.secret);
    assert.equal((await call(guest.key,'turns/'+id+'/moves',{revision:1,action:{cards:[safe],rationale:'also sealed'}})).status,200);
    const rotated=(await call(host.key,'resume',{})).data;assert.equal(rotated.key,host.key);assert.equal((await call(host.key,'turns')).status,200);
    const resumed=(await call(rotated.key,'turns/'+id)).data;assert.equal(resumed.view.revision,2);assert.equal(resumed.view.secret,giver.secret);assert(resumed.myTurn);
    const flip=await call(guest.key,'turns',{game:'flip-it',setup:{}});assert.equal(flip.status,201);assert(flip.data.view.hands[0].every(c=>c.hidden));assert(flip.data.view.hands[1].every(c=>!c.hidden));
    assert.equal((await call(rotated.key,'turns')).data.games.length,2);
    const message=await call(rotated.key,'chat',{kind:'text',value:'Come back whenever you can.'});assert.equal(message.status,200);
    assert.equal((await call(guest.key,'chat')).data.entries[0].value,'Come back whenever you can.');
    assert.equal((await call(guest.key,'chat',{kind:'reaction',value:'<script>'})).status,400);
    assert.equal((await call(rotated.key,'chat',{kind:'text',value:'too fast'})).status,429);
  }finally{await mf.dispose();}
});

test('room codes use the existing guest seat, retain links, and cannot claim host authority',async()=>{
  const mf=runtime();try {
    const room=await create(mf,'friends'),base=origin+'/api/rooms/friends/'+room.room;
    const post=async(path,key,body={})=>{const response=await mf.dispatchFetch(path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(key?{Authorization:'Bearer '+key}:{})},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
    const host=(await post(base+'/resume',room.hostKey)).data;
    assert.equal((await post(base+'/code',room.guestKey)).status,403);
    assert.equal((await post(base+'/code',host.key,{turn:'not-in-this-room'})).status,400);
    const issued=await post(base+'/code',host.key);assert.equal(issued.status,200);assert.match(issued.data.code,/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    assert(issued.data.expiresAt>Date.now()+23*60*60*1000);assert.deepEqual((await post(base+'/code',host.key)).data,issued.data);
    const limiters=await mf.getDurableObjectNamespace('INVITE_LIMITS');
    for(let i=0;i<29;i++)assert.equal((await limiters.getByName('code-create:'+room.room).fetch('https://internal/limit')).status,204);
    assert.equal((await post(base+'/code',host.key)).status,200,'Reopening an existing code must not use the generation quota');
    const otherGame=(await post(base+'/turns',host.key,{game:'flip-it',setup:{}})).data;
    assert.equal((await post(base+'/code',host.key,{turn:otherGame.id})).status,429);
    const resolved=await post(origin+'/api/room-codes/join',null,{code:issued.data.code.toLowerCase().replace('-',' ')});assert.equal(resolved.status,200);assert.equal(resolved.data.room,room.room);assert.equal(resolved.data.game,'friends');assert.equal(resolved.data.turn,null);
    const info=await mf.dispatchFetch(base+'/info',{headers:{Authorization:'Bearer '+resolved.data.key}});assert.equal((await info.json()).role,'guest');
    assert.equal((await mf.dispatchFetch(base+'/info',{headers:{Authorization:'Bearer '+room.guestKey}})).status,200,'A code must not revoke the original link');
    assert.equal((await post(base+'/code',resolved.data.key)).status,403);
    const claims=await Promise.all([post(base+'/resume',resolved.data.key),post(base+'/resume',room.guestKey)]);assert.deepEqual(claims.map(r=>r.status).sort(),[200,410]);
    const guest=claims.find(r=>r.status===200).data;assert.equal(guest.role,'guest');assert.equal((await post(base+'/resume',guest.key)).data.key,guest.key);
    assert.equal((await post(origin+'/api/room-codes/join',null,{code:issued.data.code})).status,410);
    assert.equal((await post(base+'/code',host.key)).status,410);
    assert.equal((await post(base+'/code',guest.key)).status,403);
  }finally{await mf.dispose();}
});
test('room codes are scoped to the origin and selected turn, expire, and rate-limit guesses',async()=>{
  const mf=runtime();try {
    const room=await create(mf,'friends'),base=origin+'/api/rooms/friends/'+room.room;
    const post=async(path,key,body={},site=origin)=>{const response=await mf.dispatchFetch(path,{method:'POST',headers:{Origin:site,'Content-Type':'application/json',...(key?{Authorization:'Bearer '+key}:{})},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
    const host=(await post(base+'/resume',room.hostKey)).data;
    const game=(await post(base+'/turns',host.key,{game:'cluance',setup:{role:'giver',options:{theme:'french',clueTheme:'global',variant:'fixed'}}})).data;
    const issued=(await post(base+'/code',host.key,{turn:game.id})).data;
    const alias=(await post(origin+'/api/room-codes/join',null,{code:issued.code})).data;assert.equal(alias.turn,game.id);
    assert.equal((await post(origin+'/api/room-codes/join',null,{code:issued.code},'https://other.example')).status,403);
    assert.equal((await post('https://other.example/api/room-codes/join',null,{code:issued.code},'https://other.example')).status,410);
    const hash=async key=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)))].map(n=>n.toString(16).padStart(2,'0')).join('');
    const ns=await mf.getDurableObjectNamespace('SIGNAL_ROOMS');
    await ns.getByName('friends:'+room.room).fetch('https://internal/create',{method:'POST',body:JSON.stringify({game:'friends',protocol:1,origin,expiresAt:Date.now()+86400000,hostResumeHash:await hash(host.key),hostClaimed:true,guestHash:await hash(room.guestKey),codeGuestHash:await hash(alias.key),codeExpiresAt:Date.now()-1})});
    assert.equal((await post(base+'/resume',alias.key)).status,401);
    assert.equal((await post(origin+'/api/room-codes/join',null,{code:issued.code})).status,410);
    const registry=await mf.getDurableObjectNamespace('INVITE_LIMITS');
    const id='room-code:'+await hash('YYYYYYYY');
    assert.equal((await registry.getByName(id).fetch('https://internal/register-code',{method:'POST',body:JSON.stringify({origin,room:room.room,key:alias.key,expiresAt:Date.now()-1})})).status,201);
    assert.equal((await post(origin+'/api/room-codes/join',null,{code:'YYYYYYYY'})).status,410);
    for(let i=0;i<26;i++)assert.equal((await post(origin+'/api/room-codes/join',null,{code:'ZZZZZZZZ'})).status,410);
    assert.equal((await post(origin+'/api/room-codes/join',null,{code:'ZZZZZZZZ'})).status,429);
    assert.equal((await post(origin+'/api/room-codes/join',null,{code:'bad'})).status,400);
  }finally{await mf.dispose();}
});
