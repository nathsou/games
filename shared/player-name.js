// Display names are public to the friend; control characters never reach their page.
export function displayName(value){
  if(typeof value!=='string')return '';
  return value.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069]/g,'').replace(/\s+/g,' ').trim().slice(0,24);
}
// One display name for every game and room in this browser.
const KEY='games.player-name';
export function loadPlayerName(){
  try{
    const saved=displayName(localStorage.getItem(KEY)||'');if(saved)return saved;
    const flip=displayName(JSON.parse(localStorage.getItem('flip-it.preferences')||'{}').name||'');return flip==='You'?'':flip;
  }catch{return '';}
}
export function savePlayerName(value){const name=displayName(value);try{if(name)localStorage.setItem(KEY,name);}catch{/* Optional storage. */}return name;}
