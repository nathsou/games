export const ROOM_TTL=15*60*1000;
export const TOKEN=/^[a-f0-9]{64}$/;
export const ROOM=/^[a-f0-9]{32}$/;
export const GAMES=Object.freeze({'flip-it':5,cluance:1});
export function validMetadata(game,value={}){
  if(game==='flip-it')return {};
  if(!value||!['giver','guesser'].includes(value.role)||!value.options||
    !['classic','fixed'].includes(value.options.variant)||
    !['theme','clueTheme'].every(k=>typeof value.options[k]==='string'&&/^[a-z][a-z0-9-]{0,39}$/.test(value.options[k])))
    throw new Error('Invalid table options.');
  return {role:value.role,options:{theme:value.options.theme,clueTheme:value.options.clueTheme,variant:value.options.variant}};
}
export function signalMessage(value,role){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid signaling message.');
  if(value.type==='offer'||value.type==='answer'){
    if(value.type!==(role==='host'?'offer':'answer')||typeof value.sdp!=='string'||
      !value.sdp.startsWith('v=0')||value.sdp.length>60000)throw new Error('Invalid connection description.');
    return {type:value.type,sdp:value.sdp};
  }
  if(value.type==='candidate'){
    const c=value.candidate;
    if(c===null)return {type:'candidate',candidate:null};
    if(!c||typeof c.candidate!=='string'||c.candidate.length>4096||
      c.sdpMid!==null&&c.sdpMid!==undefined&&(typeof c.sdpMid!=='string'||c.sdpMid.length>128)||
      c.sdpMLineIndex!==null&&c.sdpMLineIndex!==undefined&&(!Number.isInteger(c.sdpMLineIndex)||c.sdpMLineIndex<0||c.sdpMLineIndex>255)||
      c.usernameFragment!==undefined&&c.usernameFragment!==null&&(typeof c.usernameFragment!=='string'||c.usernameFragment.length>256))
      throw new Error('Invalid connection candidate.');
    return {type:'candidate',candidate:{candidate:c.candidate,sdpMid:c.sdpMid??null,sdpMLineIndex:c.sdpMLineIndex??null,...(c.usernameFragment?{usernameFragment:c.usernameFragment}:{})}};
  }
  if(value.type==='connected')return {type:'connected'};
  throw new Error('Only connection metadata is allowed.');
}
