const KEY='games.friend-room.v1';
export function readFriendRoom(storage) {
  try {
    storage ??= globalThis.localStorage;
    const room=JSON.parse(storage.getItem(KEY));
    if(room?.version!==1||room.game!=='friends'||!/^[a-f0-9]{32}$/.test(room.room)||!/^[a-f0-9]{64}$/.test(room.key)||!['host','guest'].includes(room.role))return null;
    return room;
  }catch{return null;}
}
export function saveFriendRoom(room,storage) {
  try {storage ??= globalThis.localStorage;storage.setItem(KEY,JSON.stringify({...room,version:1}));return true;}catch{return false;}
}
export function forgetFriendRoom(storage) {try{storage ??= globalThis.localStorage;storage.removeItem(KEY);}catch{}}
