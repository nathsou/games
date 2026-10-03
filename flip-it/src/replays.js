import {validateView} from './session.js';

export const REPLAY_KEY = 'flip-it.replays.v1';
const clone = value => structuredClone(value);
function validEntry(entry) {
  if (!entry || !Number.isInteger(entry.seat) || !entry.view) throw new Error('Invalid replay frame.');
  validateView({...entry.view,log:entry.event && entry.event.kind !== 'deal' ? [entry.event] : []},entry.seat);
  if (entry.event?.kind === 'deal' && entry.view.moves !== 0) throw new Error('Invalid deal.');
}
export function highlights(record) {
  return record.entries.flatMap((entry,index) => {
    const e=entry.event,v=entry.view;
    if(v.phase!=='playing')return [{index,label:v.phase==='matchOver'?'Match point':'Round result'}];
    if(e?.returned?.length)return [{index,label:'Tables turned · '+e.returned.reduce((n,r)=>n+r.count,0)+' cards returned'}];
    if(v.pending!==null && (index===0||record.entries[index-1].view.pending!==v.pending))return [{index,label:'Last chance'}];
    if(e?.cashed>=3)return [{index,label:'Big bank · '+e.cashed+' cards'}];
    if(e?.kind==='play'&&e.count>=3)return [{index,label:'Big set · '+e.count+' × '+e.value}];
    return [];
  });
}
export class ReplayStore {
  constructor(storage) {
    this.storage=storage;this.records=[];this.persistent=true;
    try {
      this.storage ||= globalThis.localStorage;
      const raw=this.storage.getItem(REPLAY_KEY);
      if(raw&&raw.length<=6000000) {
        const records=JSON.parse(raw);
        if(!Array.isArray(records)||records.length>8)throw new Error();
        for(const r of records) {
          if(typeof r.id!=='string'||r.id.length>160||!['solo','local','online'].includes(r.mode)||!Array.isArray(r.names)||r.names.length<2||r.names.length>5||r.names.some(n=>typeof n!=='string'||n.length>40)||!Array.isArray(r.entries)||!r.entries.length||r.entries.length>10000||!Number.isFinite(r.started)||!Number.isFinite(r.updated))throw new Error();
          let previous=-1;
          for(const entry of r.entries){validEntry(entry);if(entry.view.revision<=previous)throw new Error();previous=entry.view.revision;}
        }
        this.records=records;
      }
    } catch {this.records=[];}
  }
  record({id,mode,names,seat,view}) {
    if(!id||!view)return null;
    let record=this.records.find(r=>r.id===id);
    if(record&&record.entries.at(-1).view.revision>=view.revision)return record;
    const snapshot=clone(view);snapshot.log=[];
    // Only the received/visible perspective enters storage, never host state,
    // the deal seed, chat, credentials or the other players' private hands.
    const event=view.moves ? clone(view.log.at(-1)||null) : {kind:'deal'};
    const entry={seat,view:snapshot,event};validEntry(entry);
    if(!record){record={id,mode,names:[...names],started:Date.now(),updated:Date.now(),entries:[],partial:view.revision!==0};this.records.unshift(record);}
    else if(view.revision!==record.entries.at(-1).view.revision+1)record.partial=true;
    record.names=[...names];record.updated=Date.now();record.entries.push(entry);
    this.records=this.records.filter(r=>r!==record);this.records.unshift(record);this.records=this.records.slice(0,8);
    this.persist();return record;
  }
  persist() {
    // Prune complete old recordings, keeping the active recording intact.
    while(this.records.length>1&&JSON.stringify(this.records).length>3000000)this.records.pop();
    while(true){try{this.storage.setItem(REPLAY_KEY,JSON.stringify(this.records));this.persistent=true;return true;}
      catch{if(this.records.length>1){this.records.pop();continue;}this.persistent=false;return false;}}
  }
  remove(id){this.records=this.records.filter(r=>r.id!==id);this.persist();}
}
