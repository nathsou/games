import {isFriendPage} from './friend-pages.js';
const PREFIX='games.checkpoint.';
const MAX=2*1024*1024;
export function readCheckpoint(game,storage) {
  if(!isFriendPage(game)||game==='collection')return null;
  try {
    storage ??= globalThis.localStorage;
    const raw=storage.getItem(PREFIX+game);if(!raw||raw.length>MAX)return null;
    const value=JSON.parse(raw);
    return value?.version===1&&value.game===game&&Number.isFinite(value.updatedAt)&&value.data&&typeof value.data==='object'?value:null;
  }catch{return null;}
}
export function writeCheckpoint(game,data,storage) {
  if(!isFriendPage(game)||game==='collection'||!data)return false;
  try{storage ??= globalThis.localStorage;const raw=JSON.stringify({version:1,game,updatedAt:Date.now(),data});if(raw.length>MAX)return false;storage.setItem(PREFIX+game,raw);return true;}catch{return false;}
}
export function registerCheckpoint(game,{capture,restore}) {
  const save=()=>writeCheckpoint(game,capture());
  window.__gameCheckpoint={game,save,capture,restore:()=>{const checkpoint=readCheckpoint(game);if(checkpoint)return restore(checkpoint.data);}};
  let resume=false;
  try{const room=parent!==window&&parent.__friendSession;resume=Boolean(room?.game===game&&(room.resumeGame||room.resumeSharedPage));}catch{}
  if(resume){try{window.__gameCheckpoint.restore();}catch(error){try{parent.__friendSession?.onError('The saved '+game+' game could not be restored: '+error.message);}catch{}}}
  // Checkpoints also work in standalone play. The guest renderer never registers one.
  const timer=setInterval(save,1000);
  window.addEventListener('pagehide',()=>{clearInterval(timer);save();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
  return save;
}
