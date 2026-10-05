import {normalizeRoomCode} from './room-code.js';
import {friendSession} from './friend-context.js';
// Hosted invitations contain a random guest capability in the URL fragment.
// This module handles SDP/ICE signaling. Turn games and durable chat use
// the room APIs in turn-client.js; live game traffic uses PeerLink.
const ROOM=/^[a-f0-9]{32}$/,KEY=/^[a-f0-9]{64}$/;
let servicePromise;
async function request(path,{key,method='GET',body,signal}={}){
  const response=await fetch(path,{method,credentials:'omit',cache:'no-store',signal:signal||AbortSignal.timeout(10000),
    headers:{...(key?{Authorization:'Bearer '+key}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data.error||'The invitation service is unavailable. Try again.');error.status=response.status;throw error;}
  return data;
}
export function signalingService(){
  servicePromise||=(async()=>{
    const response=await fetch('/api/config',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(5000)});
    if(response.status===404)return null; // The original static/local servers.
    if(!response.ok)throw new Error('The invitation service is unavailable. Try again.');
    const data=await response.json();return data.signaling===1?data:null;
  })().catch(error=>{servicePromise=null;throw error;});
  return servicePromise;
}
export function hostedInvitation(input,game,base=location.href){
  let url;try{url=new URL(String(input),base);}catch{return null;}
  const params=new URLSearchParams(url.hash.slice(1));
  if(!params.has('room'))return null;
  if(url.origin!==new URL(base).origin)throw new Error('Open this invitation link on its original site.');
  const roomPath = game === 'friends' ? '/' : new URL('./',base).pathname;
  if(url.pathname!==roomPath||game!=='friends'&&!url.pathname.endsWith('/'+game+'/')||!ROOM.test(params.get('room')||'')||!KEY.test(params.get('key')||''))
    throw new Error('Paste a complete '+game+' invitation link.');
  return {game,room:params.get('room'),key:params.get('key')};
}
export function hostedLink({game,room,key},base=location.href){
  if(!ROOM.test(room)||!KEY.test(key))throw new Error('Invalid invitation.');
  const url=new URL(game === 'friends' ? '/' : './',base);url.search='';
  const params=new URLSearchParams({room,key});
  if(friendSession())params.set('together','1');
  url.hash=params;
  if(game!=='friends'&&!url.pathname.endsWith('/'+game+'/'))throw new Error('Invalid game invitation.');
  return url.href;
}
export async function createHostedRoom(game,protocol,metadata={}){
  const data=await request('/api/rooms',{method:'POST',body:{game,protocol,metadata}});
  if(!ROOM.test(data.room)||!KEY.test(data.hostKey)||!KEY.test(data.guestKey))throw new Error('Invalid invitation service response.');
  return {game,protocol,room:data.room,key:data.hostKey,guestKey:data.guestKey,metadata,expiresAt:data.expiresAt};
}
export async function roomDetails(invitation,protocol){
  const details=await request('/api/rooms/'+invitation.game+'/'+invitation.room+'/info',{key:invitation.key});
  if(details.game!==invitation.game||details.protocol!==protocol||details.role!=='guest')throw new Error('Update both game pages and create a fresh invitation.');
  return {...invitation,...details};
}
export async function roomConfig(invitation,config){
  // A manually supplied relay takes precedence; its password stays in memory.
  if(config.iceServers?.some(s=>[].concat(s.urls).some(url=>/^turns?:/.test(url))))return config;
  const {iceServers=[]}=await request('/api/rooms/'+invitation.game+'/'+invitation.room+'/ice',{key:invitation.key,method:'POST'});
  return {...config,iceServers:[...(config.iceServers||[]),...iceServers]};
}
export class SignalConnection {
  constructor(invitation,{onMessage,onError}){this.invitation=invitation;this.onMessage=onMessage;this.onError=onError;this.closed=false;}
  async connect(){
    const {game,room,key}=this.invitation,url=new URL('/api/rooms/'+game+'/'+room+'/socket',location.href);
    url.protocol=url.protocol==='https:'?'wss:':'ws:';
    const ws=this.socket=new WebSocket(url,['games.v1','auth.'+key]);
    await new Promise((resolve,reject)=>{
      let ready=false;
      const timer=setTimeout(()=>{reject(new Error('The invitation service did not respond. Try again.'));this.close();},10000);
      this.reject=reject;
      ws.addEventListener('message',event=>{
        let message;try{message=JSON.parse(event.data);}catch{this.onError(new Error('Invalid connection message.'));this.close();return;}
        if(message.type==='ready'){ready=true;clearTimeout(timer);this.reject=null;resolve();return;}
        if(!ready)return;
        Promise.resolve(this.onMessage(message)).catch(error=>{if(!this.closed)this.onError(error);});
      });
      ws.addEventListener('close',event=>{
        clearTimeout(timer);
        if(!ready)reject(new Error('This invitation expired, is already open, or could not connect. Ask for a fresh one.'));
        else if(!this.closed&&event.code!==1000)this.onError(new Error(event.reason||'The invitation connection was interrupted. Create a fresh invitation.'));
      });
      ws.addEventListener('error',()=>{clearTimeout(timer);if(!ready)reject(new Error('Could not reach the invitation service. Try again.'));});
    });
  }
  send(message){if(!this.closed&&this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(message));}
  close(){if(this.closed)return;this.closed=true;this.reject?.(new Error('The invitation was cancelled.'));this.reject=null;this.socket?.close(1000);}
}

export async function claimRoomResume(invitation,name='') {
  const details=await request('/api/rooms/friends/'+invitation.room+'/resume',{key:invitation.key,method:'POST',...(name?{body:{name}}:{})});
  if(!KEY.test(details.key)||!['host','guest'].includes(details.role))throw new Error('The room could not be restored. Create a fresh invitation.');
  return {game:'friends',room:invitation.room,key:details.key,role:details.role,expiresAt:details.expiresAt};
}

export async function createRoomCode(credential,turn=null) {
  const data=await request('/api/rooms/friends/'+credential.room+'/code',{key:credential.key,method:'POST',body:{turn}});
  if(!normalizeRoomCode(data.code)||!Number.isFinite(data.expiresAt))throw Error('Could not generate a room code. Try again.');
  return data;
}
export async function resolveRoomCode(input) {
  const code=normalizeRoomCode(input);
  if(!code)throw Error('Enter the eight-character room code or a complete invitation link.');
  const data=await request('/api/room-codes/join',{method:'POST',body:{code}});
  if(data.game!=='friends'||!ROOM.test(data.room)||!KEY.test(data.key))throw Error('Invalid room-code response. Try again.');
  return data;
}
