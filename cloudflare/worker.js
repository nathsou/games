import {createTurnGame,turnSummary,turnView,advanceTurn,chatEntry} from './turn-games.js';
import {normalizeRoomCode,formatRoomCode,ROOM_CODE_ALPHABET} from '../shared/room-code.js';
import {DurableObject} from 'cloudflare:workers';
import {GAMES,ROOM,TOKEN,ROOM_TTL,FRIEND_TTL,validMetadata,signalMessage} from './protocol.js';

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
const hex=bytes=>[...crypto.getRandomValues(new Uint8Array(bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
const CODE_TTL=24*60*60*1000;
const bearer=request=>request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
async function roomBody(request,limit=2048){
  if(!request.body)throw Error();
  const reader=request.body.getReader(),chunks=[];let length=0;
  while(true){
    const {done,value}=await reader.read();if(done)break;length+=value.byteLength;
    if(length>limit){await reader.cancel();throw Error();}chunks.push(value);
  }
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder().decode(bytes);
}

export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
    if(url.pathname==='/api/config'&&request.method==='GET')return json({signaling:1,turn:Boolean(env.TURN_KEY_ID&&env.TURN_API_TOKEN)});
    // No cross-origin room creation, credential minting or WebSocket connections.
    const origin=request.headers.get('Origin');
    if(origin&&origin!==url.origin||request.method!=='GET'&&!origin||request.headers.get('Upgrade')&&!origin)
      return json({error:'Open this invitation on its original site.'},403);
    if(url.pathname==='/api/room-codes/join'&&request.method==='POST') {
      let code;
      try {
        if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error();
        code=normalizeRoomCode(JSON.parse(await roomBody(request,128)).code);if(!code)throw Error();
      }catch{return json({error:'Enter the eight-character room code.'},400);}
      const ip=request.headers.get('CF-Connecting-IP')||'local';
      if(!(await env.INVITE_LIMITS.getByName('code-attempts:'+await digest(ip)).fetch('https://internal/limit')).ok)
        return json({error:'Too many code attempts. Try again in an hour, or use an invitation link.'},429);
      const found=await env.INVITE_LIMITS.getByName('room-code:'+await digest(code)).fetch('https://internal/find-code',{method:'POST',body:JSON.stringify({origin:url.origin})});
      if(!found.ok)return json({error:'This code is invalid or expired. Ask your friend for a new code.'},410);
      const invitation=await found.json();
      const available=await env.SIGNAL_ROOMS.getByName('friends:'+invitation.room).fetch(url.origin+'/api/rooms/friends/'+invitation.room+'/info',{headers:{Origin:url.origin,Authorization:'Bearer '+invitation.key}});
      if(!available.ok)return json({error:'This code expired or your friend has already joined. Return to your saved room, or ask for a new invitation.'},410);
      return json({game:'friends',...invitation});
    }
    if(url.pathname==='/api/rooms'&&request.method==='POST'){
      if(!request.headers.get('Content-Type')?.startsWith('application/json')||Number(request.headers.get('Content-Length')||0)>2048)
        return json({error:'Invalid room request.'},400);
      let body;try{body=await roomBody(request);}catch{return json({error:'Invalid room request.'},400);}
      let options;try{options=JSON.parse(body);if(!Object.hasOwn(GAMES,options.game)||options.protocol!==GAMES[options.game])throw Error();options.metadata=validMetadata(options.game,options.metadata);}
      catch{return json({error:'Update the game page before inviting a friend.'},400);}
      const ip=request.headers.get('CF-Connecting-IP')||'local';
      const limiter=env.INVITE_LIMITS.getByName(await digest(ip));
      const permitted=await limiter.fetch('https://internal/limit');
      if(!permitted.ok)return json({error:'Too many invitations. Try again in an hour.'},429);
      const room=hex(16),hostKey=hex(32),guestKey=hex(32);
      const expiresAt=Date.now()+ROOM_TTL;
      await env.SIGNAL_ROOMS.getByName(options.game+':'+room).fetch('https://internal/create',{method:'POST',body:JSON.stringify({game:options.game,protocol:options.protocol,metadata:options.metadata,origin:url.origin,expiresAt,hostHash:await digest(hostKey),guestHash:await digest(guestKey)})});
      return json({room,hostKey,guestKey,expiresAt},201);
    }
    const match=url.pathname.match(/^\/api\/rooms\/([a-z-]+)\/([a-f0-9]+)\/(info|ice|socket|resume|code|chat|turns(?:\/[a-f0-9-]{36}(?:\/moves)?)?)$/);
    if(!match||!Object.hasOwn(GAMES,match[1])||!ROOM.test(match[2]))return json({error:'Invitation not found.'},404);
    return env.SIGNAL_ROOMS.getByName(match[1]+':'+match[2]).fetch(request);
  }
};

export class InviteLimiter extends DurableObject {
  async fetch(request){
    const action=new URL(request.url).pathname;
    if(action==='/register-code'||action==='/find-code')return this.ctx.blockConcurrencyWhile(async()=>{
      const entry=await this.ctx.storage.get('code');
      if(action==='/register-code') {
        if(entry?.expiresAt>Date.now())return new Response(null,{status:409});
        const value=await request.json();await this.ctx.storage.put('code',value);await this.ctx.storage.setAlarm(value.expiresAt);
        return new Response(null,{status:201});
      }
      const {origin}=await request.json();
      if(!entry||entry.expiresAt<=Date.now()||entry.origin!==origin)return new Response(null,{status:410});
      const {origin:_,...invitation}=entry;return json(invitation);
    });
    return this.ctx.blockConcurrencyWhile(async()=>{
      let rate=await this.ctx.storage.get('rate');
      if(!rate||rate.until<=Date.now())rate={count:0,until:Date.now()+60*60*1000};
      if(rate.count>=30)return new Response(null,{status:429});
      rate.count++;await this.ctx.storage.put('rate',rate);await this.ctx.storage.setAlarm(rate.until);
      return new Response(null,{status:204});
    });
  }
  async alarm(){await this.ctx.storage.deleteAll();}
}

export class SignalRoom extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.env=env;}
  async fetch(request){
    const url=new URL(request.url),action=url.pathname.split('/').at(-1);
    if(action==='create'&&request.method==='POST'){
      const meta=await request.json();await this.ctx.storage.put('meta',meta);await this.ctx.storage.setAlarm(meta.expiresAt);
      return new Response(null,{status:204});
    }
    const meta=await this.ctx.storage.get('meta');
    if(!meta||meta.expiresAt<=Date.now()||meta.finished&&meta.game!=='friends')return json({error:'This invitation expired or was already used. Ask for a fresh one.'},410);
    if(new URL(request.url).origin!==meta.origin||request.headers.get('Origin')&&request.headers.get('Origin')!==meta.origin)
      return json({error:'Open this invitation on its original site.'},403);
    let key=bearer(request);
    if(action==='socket'){
      if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'A WebSocket connection is required.'},400);
      const protocols=(request.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(s=>s.trim());
      if(!protocols.includes('games.v1'))return json({error:'Update the game page.'},400);
      key=protocols.find(p=>p.startsWith('auth.'))?.slice(5)||'';
    }
    if(!TOKEN.test(key))return json({error:'Invalid invitation.'},401);
    const hash=await digest(key),resume=meta.game==='friends'&&(hash===meta.hostResumeHash||hash===meta.guestResumeHash);
    const role=hash===meta.hostHash||hash===meta.hostResumeHash?'host':hash===meta.guestHash||hash===meta.guestResumeHash||hash===meta.codeGuestHash&&meta.codeExpiresAt>Date.now()?'guest':null;
    if(!role)return json({error:'Invalid invitation.'},401);
    if(meta.game==='friends'&&(meta.claimed||meta[role+'Claimed'])&&!resume)return json({error:'This invitation was already used. Reconnect from your saved room or ask for a fresh invitation.'},410);
    if(action==='resume'&&request.method==='POST'&&meta.game==='friends'){
      return this.ctx.blockConcurrencyWhile(async()=>{
        const latest=await this.ctx.storage.get('meta');
        const privateSeat=hash===latest[role+'ResumeHash'];
        if(!privateSeat&&(latest.claimed||latest[role+'Claimed']))return json({error:'This invitation was already used.'},410);
        if(!privateSeat&&hash!==latest[role+'Hash']&&!(role==='guest'&&hash===latest.codeGuestHash&&latest.codeExpiresAt>Date.now()))return json({error:'Invalid invitation.'},401);
        // Reusing a private seat is idempotent: losing a reconnect response must
        // not revoke the browser's only recovery credential.
        const resumeKey=privateSeat?key:hex(32);latest[role+'ResumeHash']=await digest(resumeKey);latest[role+'Claimed']=true;latest.expiresAt=Date.now()+FRIEND_TTL;
        await this.ctx.storage.put('meta',latest);await this.ctx.storage.setAlarm(latest.expiresAt);
        return json({key:resumeKey,role,expiresAt:latest.expiresAt});
      });
    }
    if(action==='code'&&request.method==='POST'&&meta.game==='friends') {
      if(role!=='host'||!resume)return json({error:'Only the room creator can generate a code.'},403);
      return this.ctx.blockConcurrencyWhile(async()=>{
        const latest=await this.ctx.storage.get('meta');
        if(latest.guestClaimed||latest.claimed)return json({error:'Your friend already joined. They can return to their saved room.'},410);
        let turn;
        try {
          const body=JSON.parse(await roomBody(request,128));turn=body.turn??null;
          if(turn!==null&&(!(await this.ctx.storage.get('turn-index')||[]).some(entry=>entry.id===turn)))throw Error();
        }catch{return json({error:'Choose a saved game from this room.'},400);}
        if(latest.joinCode&&latest.codeExpiresAt>Date.now()&&latest.codeTurn===turn)
          return json({code:formatRoomCode(latest.joinCode),expiresAt:latest.codeExpiresAt});
        const room=url.pathname.split('/')[4];
        if(!(await this.env.INVITE_LIMITS.getByName('code-create:'+room).fetch('https://internal/limit')).ok)
          return json({error:'Too many new codes. Try again in an hour, or share the invitation link.'},429);
        const key=hex(32),expiresAt=Math.min(latest.expiresAt,Date.now()+CODE_TTL);
        for(let attempt=0;attempt<5;attempt++) {
          const code=[...crypto.getRandomValues(new Uint8Array(8))].map(n=>ROOM_CODE_ALPHABET[n&31]).join('');
          const registered=await this.env.INVITE_LIMITS.getByName('room-code:'+await digest(code)).fetch('https://internal/register-code',{method:'POST',body:JSON.stringify({room,key,turn,expiresAt,origin:meta.origin})});
          if(!registered.ok)continue;
          Object.assign(latest,{joinCode:code,codeGuestHash:await digest(key),codeExpiresAt:expiresAt,codeTurn:turn});
          await this.ctx.storage.put('meta',latest);
          return json({code:formatRoomCode(code),expiresAt});
        }
        return json({error:'Could not generate a room code. Try again.'},503);
      });
    }
    if(meta.game==='friends'&&(action==='chat'||url.pathname.includes('/turns'))) {
      if(!resume)return json({error:'Claim your private room seat first.'},403);
      return this.ctx.blockConcurrencyWhile(async()=>{
        try {
          const latest=await this.ctx.storage.get('meta');
          if(hash!==latest[role+'ResumeHash'])return json({error:'Reconnect from your saved room.'},401);
          latest.expiresAt=Date.now()+FRIEND_TTL;await this.ctx.storage.put('meta',latest);await this.ctx.storage.setAlarm(latest.expiresAt);
          let body;
          if(request.method==='POST')body=JSON.parse(await roomBody(request,8192));
          if(action==='chat') {
            const history=await this.ctx.storage.get('chat')||{sequence:0,entries:[]};
            if(request.method==='POST') {
              const last=await this.ctx.storage.get('chat-rate-'+role)||0;
              if(Date.now()-last<500)return json({error:'Wait a moment before sending again.'},429);
              history.entries.push(chatEntry(body,role,++history.sequence));history.entries=history.entries.slice(-60);
              await this.ctx.storage.put('chat',history);await this.ctx.storage.put('chat-rate-'+role,Date.now());
            }else if(request.method!=='GET')return json({error:'Method not allowed.'},405);
            return json(history);
          }
          const parts=url.pathname.split('/turns')[1].split('/').filter(Boolean);
          let index=await this.ctx.storage.get('turn-index')||[];
          const save=async record=>{const entry={id:record.id,host:turnSummary(record,'host'),guest:turnSummary(record,'guest')};index=index.filter(e=>e.id!==record.id);index.push(entry);const retained=index.filter(e=>!e.host.finished).concat(index.filter(e=>e.host.finished).slice(-40)).sort((a,b)=>a.host.updatedAt-b.host.updatedAt);for(const entry of index)if(!retained.some(e=>e.id===entry.id))await this.ctx.storage.delete('turn-'+entry.id);index=retained;await this.ctx.storage.put({['turn-'+record.id]:record,'turn-index':index});};
          if(!parts.length) {
            if(request.method==='POST') {
              if(index.filter(e=>!e.host.finished).length>=20)return json({error:'Finish a saved game before starting another.'},409);
              const record=createTurnGame(body.game,body.setup,role);await save(record);return json(turnView(record,role),201);
            }
            if(request.method!=='GET')return json({error:'Method not allowed.'},405);
            return json({games:index.map(entry=>entry[role]).reverse()});
          }
          const record=index.some(entry=>entry.id===parts[0])?await this.ctx.storage.get('turn-'+parts[0]):null;
          if(!record)return json({error:'Saved game not found.'},404);
          if(parts[1]==='moves'&&request.method==='POST') {
            advanceTurn(record,role,body.revision,body.action);await save(record);
          }else if(parts.length!==1||request.method!=='GET')return json({error:'Method not allowed.'},405);
          return json(turnView(record,role));
        }catch(error){return json({error:error.message||'Choose valid game settings.'},error.status||400);}
      });
    }
    if(action==='info'&&request.method==='GET')return json({game:meta.game,protocol:meta.protocol,metadata:meta.metadata,expiresAt:meta.expiresAt,role});
    if(action==='ice'&&request.method==='POST'){
      if(!this.env.TURN_KEY_ID||!this.env.TURN_API_TOKEN)return json({iceServers:[]});
      let rate=await this.ctx.storage.get('turn-'+role);
      if(!rate||typeof rate==='number'||rate.until<=Date.now())rate={count:0,until:Date.now()+60*60*1000};
      if(rate.count>=(meta.game==='friends'?12:4))return json({error:'Relay refresh limit reached. Try reconnecting in an hour.'},429);
      await this.ctx.storage.put('turn-'+role,{...rate,count:rate.count+1});
      let response;
      try{response=await fetch('https://rtc.live.cloudflare.com/v1/turn/keys/'+encodeURIComponent(this.env.TURN_KEY_ID)+'/credentials/generate-ice-servers',{method:'POST',headers:{Authorization:'Bearer '+this.env.TURN_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({ttl:3600}),signal:AbortSignal.timeout(8000)});}
      catch{return json({error:'The relay service is unavailable. Try again or use a manual relay.'},503);}
      if(!response.ok)return json({error:'The relay is not configured correctly. Check the Worker secrets.'},503);
      const data=await response.json();
      const servers=Array.isArray(data.iceServers)?data.iceServers:data.iceServers?[data.iceServers]:[];
      if(!servers.length)return json({error:'The relay returned no connection settings.'},503);
      return json({iceServers:servers});
    }
    if(action!=='socket'||request.method!=='GET')return json({error:'Method not allowed.'},405);
    if(this.ctx.getWebSockets(role).some(ws=>ws.readyState===1))return json({error:'That seat is already open in another tab.'},409);
    if(meta.game==='friends'&&meta.finished){
      meta.finished=false;meta.hostConnected=meta.guestConnected=false;
      await this.ctx.storage.delete(['pending-host','pending-guest']);
      await this.ctx.storage.put('meta',meta);
    }
    const pair=new WebSocketPair(),[client,server]=Object.values(pair);
    this.ctx.acceptWebSocket(server,[role]);
    server.serializeAttachment({role,count:0,window:Date.now(),description:false});
    server.send(JSON.stringify({type:'ready',role,expiresAt:meta.expiresAt}));
    const pending=await this.ctx.storage.get('pending-'+(role==='host'?'guest':'host'))||[];
    for(const message of pending)server.send(JSON.stringify(message));
    await this.ctx.storage.delete('pending-'+(role==='host'?'guest':'host'));
    return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'games.v1'}});
  }
  async webSocketMessage(ws,data){return this.ctx.blockConcurrencyWhile(()=>this.handleSocketMessage(ws,data));}
  async handleSocketMessage(ws,data){
    const meta=await this.ctx.storage.get('meta');
    if(!meta||meta.expiresAt<=Date.now()||meta.finished){ws.close(1008,'Invitation expired.');return;}
    const state=ws.deserializeAttachment();
    if(Date.now()-state.window>60000){state.count=0;state.window=Date.now();}
    if(typeof data!=='string'||data.length>65536||++state.count>180){ws.close(1008,'Signaling limit exceeded.');return;}
    let message;
    try{
      message=signalMessage(JSON.parse(data),state.role);
      if(message.type==='offer'||message.type==='answer'){
        if(state.description)throw Error();state.description=true;
      }
    }catch{ws.close(1008,'Invalid signaling message.');return;}
    ws.serializeAttachment(state);
    if(message.type==='connected'){
      meta[state.role+'Connected']=true;
      if(meta.hostConnected&&meta.guestConnected){
        meta.finished=true;
        if(meta.game==='friends'){
          meta.claimed=true;meta.expiresAt=Date.now()+FRIEND_TTL;
          await this.ctx.storage.setAlarm(meta.expiresAt);
        }
        await this.ctx.storage.put('meta',meta);
        await this.ctx.storage.delete(['pending-host','pending-guest']);
        for(const socket of this.ctx.getWebSockets())socket.close(1000,'Connection ready.');
      }else await this.ctx.storage.put('meta',meta);
      return;
    }
    const recipients=this.ctx.getWebSockets(state.role==='host'?'guest':'host').filter(socket=>socket.readyState===1);
    if(recipients.length){for(const socket of recipients)socket.send(JSON.stringify(message));}
    else {
      const key='pending-'+state.role,pending=await this.ctx.storage.get(key)||[];
      if(pending.length>=64){ws.close(1008,'Too many pending connection candidates.');return;}
      pending.push(message);await this.ctx.storage.put(key,pending);
    }
  }
  async webSocketClose(ws,code,reason){ws.close(code===1005||code===1006?1000:code,reason);}
  async webSocketError(ws){ws.close(1011,'Connection interrupted.');}
  async alarm(){for(const ws of this.ctx.getWebSockets())ws.close(1008,'Invitation expired.');await this.ctx.storage.deleteAll();}
}
