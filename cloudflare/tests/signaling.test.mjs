import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {signalMessage} from '../protocol.js';
import {hostedInvitation,hostedLink} from '../../shared/signaling.js';

const origin='https://games.example';
function runtime(options={}){return new Miniflare(convertV4MiniflareOptions({modules:['worker.js','protocol.js'].map(file=>({type:'ESModule',path:fileURLToPath(new URL('../'+file,import.meta.url))})),modulesRoot:fileURLToPath(new URL('..',import.meta.url)),compatibilityDate:'2026-10-04',durableObjects:{SIGNAL_ROOMS:{className:'SignalRoom',useSQLite:true},INVITE_LIMITS:{className:'InviteLimiter',useSQLite:true}},...options}));}
async function create(mf,game='flip-it',metadata){
  const response=await mf.dispatchFetch(origin+'/api/rooms',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({game,protocol:game==='flip-it'?5:1,metadata})});
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
  const mf=runtime();
  try{
    assert.equal((await mf.dispatchFetch(origin+'/api/config')).status,200);
    const room=await create(mf);assert.notEqual(room.hostKey,room.guestKey);
    const path=origin+'/api/rooms/flip-it/'+room.room;
    assert.equal((await mf.dispatchFetch(path+'/info')).status,401);
    assert.equal((await mf.dispatchFetch(path+'/info',{headers:{Authorization:'Bearer '+'f'.repeat(64)}})).status,401);
    assert.equal((await mf.dispatchFetch(path+'/info',{headers:{Origin:'https://other.example',Authorization:'Bearer '+room.guestKey}})).status,403);
    const info=await mf.dispatchFetch(path+'/info',{headers:{Authorization:'Bearer '+room.guestKey}});assert.equal(info.status,200);assert.equal((await info.json()).role,'guest');
    assert.equal((await mf.dispatchFetch(origin+'/api/rooms/cluance/'+room.room+'/info',{headers:{Authorization:'Bearer '+room.guestKey}})).status,410);
    const host=await connect(mf,room.room,room.hostKey);await until(()=>host.messages.length);assert.equal(host.messages[0].role,'host');
    assert.equal((await connect(mf,room.room,room.hostKey)).status,409);
    host.ws.send(JSON.stringify({type:'candidate',candidate:{candidate:'candidate:test',sdpMid:'0',sdpMLineIndex:0}}));
    host.ws.send(JSON.stringify({type:'offer',sdp:'v=0\r\n'}));
    const guest=await connect(mf,room.room,room.guestKey);await until(()=>guest.messages.length===3);
    assert.deepEqual(guest.messages.map(m=>m.type),['ready','candidate','offer']);
    guest.ws.send(JSON.stringify({type:'answer',sdp:'v=0\r\n'}));await until(()=>host.messages.length===2);assert.equal(host.messages[1].type,'answer');
    host.ws.send(JSON.stringify({type:'connected'}));guest.ws.send(JSON.stringify({type:'connected'}));
    await until(()=>host.ws.readyState===3);
    assert.equal((await mf.dispatchFetch(path+'/info',{headers:{Authorization:'Bearer '+room.guestKey}})).status,410);
  }finally{await mf.dispose();}
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
    const metadata={role:'guesser',options:{theme:'french',clueTheme:'global',variant:'fixed'},secret:'must be stripped'};
    const room=await create(mf,'cluance',metadata);
    const info=await mf.dispatchFetch(origin+'/api/rooms/cluance/'+room.room+'/info',{headers:{Authorization:'Bearer '+room.guestKey}});
    assert.deepEqual((await info.json()).metadata,{role:'guesser',options:metadata.options});
    for(let i=1;i<30;i++)await create(mf);
    assert.equal((await mf.dispatchFetch(origin+'/api/rooms',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({game:'flip-it',protocol:5})})).status,429);
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
    await ns.getByName('flip-it:'+room.room).fetch('https://internal/create',{method:'POST',body:JSON.stringify({game:'flip-it',protocol:5,origin,expiresAt:Date.now()-1000})});
    const path=origin+'/api/rooms/flip-it/'+room.room;
    for(const action of ['info','ice'])assert.equal((await mf.dispatchFetch(path+'/'+action,{method:action==='ice'?'POST':'GET',headers:{Origin:origin,Authorization:'Bearer '+room.guestKey}})).status,410);
    assert.equal((await connect(mf,room.room,room.guestKey)).status,410);
  }finally{await mf.dispose();}
});
