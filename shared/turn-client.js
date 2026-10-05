export async function roomRequest(credential,path,{method='GET',body}={}) {
  const response=await fetch('/api/rooms/friends/'+credential.room+'/'+path,{method,cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+credential.key,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=Error(data.error||'Could not reach your room. Your last saved move is safe.');error.status=response.status;throw error;}
  return data;
}
// A saved game shared with the friend. The room pushes every change; requests
// return the same role-private view, so whichever arrives first wins.
export class TurnClient {
  constructor(session,record){this.session=session;this.record=record;this.busy=false;this.listeners=new Set();}
  get names(){return {me:this.session.me?.name||'You',friend:this.session.friend?.name||'Friend'};}
  get friendHere(){const friend=this.session.friend;return Boolean(friend?.online&&friend.game===this.record.id);}
  subscribe(callback){this.listeners.add(callback);callback(this.record);return ()=>this.listeners.delete(callback);}
  publish(record){this.record=record;for(const callback of this.listeners)callback(record);this.session.onChange();}
  newer(record){return record.id===this.record.id&&(record.revision>this.record.revision||record.revision===this.record.revision&&JSON.stringify(record)!==JSON.stringify(this.record));}
  apply(record){if(this.newer(record))this.publish(record);}
  async refresh(){const record=await roomRequest(this.session.credential,'turns/'+this.record.id);if(!this.busy)this.apply(record);}
  async request(body){
    if(this.busy)return;this.busy=true;this.publish(this.record);
    try{this.apply(await roomRequest(this.session.credential,'turns/'+this.record.id+'/moves',{method:'POST',body:{revision:this.record.revision,...body}}));}
    catch(error){if(error.status===409){this.busy=false;await this.refresh().catch(()=>{});}throw error;}
    finally{this.busy=false;this.publish(this.record);}
  }
  move(action){return this.request({action});}
  async end(){this.apply(await roomRequest(this.session.credential,'turns/'+this.record.id,{method:'DELETE'}));}
}
