// Eight unambiguous base-32 characters: 40 bits, formatted for reading aloud.
export const ROOM_CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function normalizeRoomCode(value) {
  if(typeof value!=='string')return null;
  const code=value.trim().toUpperCase().replace(/[\s-]/g,'');
  return /^[A-HJ-NP-Z2-9]{8}$/.test(code)?code:null;
}
export function formatRoomCode(code) { return code.slice(0,4)+'-'+code.slice(4); }
