import {DurableObject} from 'cloudflare:workers';
import {GAMES,ROOM,TOKEN,ROOM_TTL,validMetadata,signalMessage} from './protocol.js';

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
const hex=bytes=>[...crypto.getRandomValues(new Uint8Array(bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
const bearer=request=>request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';

export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
    if(url.pathname==='/api/config'&&request.method==='GET')return json({signaling:1,turn:Boolean(env.TURN_KEY_ID&&env.TURN_API_TOKEN)});
    // No cross-origin room creation, credential minting or WebSocket connections.
    const origin=request.headers.get('Origin');
    if(origin&&origin!==url.origin||request.method!=='GET'&&!origin||request.headers.get('Upgrade')&&!origin)
      return json({error:'Open this invitation on its original site.'},403);
    if(url.pathname==='/api/rooms'&&request.method==='POST'){
      if(!request.headers.get('Content-Type')?.startsWith('application/json')||Number(request.headers.get('Content-Length')||0)>2048)
        return json({error:'Invalid room request.'},400);
      const body=await request.text();if(body.length>2048)return json({error:'Invalid room request.'},400);
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
    const match=url.pathname.match(/^\/api\/rooms\/([a-z-]+)\/([a-f0-9]+)\/(info|ice|socket)$/);
    if(!match||!Object.hasOwn(GAMES,match[1])||!ROOM.test(match[2]))return json({error:'Invitation not found.'},404);
    return env.SIGNAL_ROOMS.getByName(match[1]+':'+match[2]).fetch(request);
  }
};

export class InviteLimiter extends DurableObject {
  async fetch(){
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
    if(!meta||meta.expiresAt<=Date.now()||meta.finished)return json({error:'This invitation expired or was already used. Ask for a fresh one.'},410);
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
    const hash=await digest(key),role=hash===meta.hostHash?'host':hash===meta.guestHash?'guest':null;
    if(!role)return json({error:'Invalid invitation.'},401);
    if(action==='info'&&request.method==='GET')return json({game:meta.game,protocol:meta.protocol,metadata:meta.metadata,expiresAt:meta.expiresAt,role});
    if(action==='ice'&&request.method==='POST'){
      if(!this.env.TURN_KEY_ID||!this.env.TURN_API_TOKEN)return json({iceServers:[]});
      const count=await this.ctx.storage.get('turn-'+role)||0;
      if(count>=4)return json({error:'Relay refresh limit reached. Create a fresh invitation.'},429);
      await this.ctx.storage.put('turn-'+role,count+1);
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
    const pair=new WebSocketPair(),[client,server]=Object.values(pair);
    this.ctx.acceptWebSocket(server,[role]);
    server.serializeAttachment({role,count:0,window:Date.now(),description:false});
    server.send(JSON.stringify({type:'ready',role,expiresAt:meta.expiresAt}));
    const pending=await this.ctx.storage.get('pending-'+(role==='host'?'guest':'host'))||[];
    for(const message of pending)server.send(JSON.stringify(message));
    await this.ctx.storage.delete('pending-'+(role==='host'?'guest':'host'));
    return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'games.v1'}});
  }
  async webSocketMessage(ws,data){
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
        meta.finished=true;await this.ctx.storage.put('meta',meta);
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
