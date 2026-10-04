export async function roomRequest(credential,path,{method='GET',body}={}) {
  const response=await fetch('/api/rooms/friends/'+credential.room+'/'+path,{method,cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+credential.key,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=Error(data.error||'Could not reach your room. Your last saved move is safe.');error.status=response.status;throw error;}
  return data;
}
export class TurnClient {
  constructor(session,record){this.session=session;this.record=record;this.busy=false;this.listeners=new Set();}
  subscribe(callback){this.listeners.add(callback);callback(this.record);return ()=>this.listeners.delete(callback);}
  publish(record){this.record=record;for(const callback of this.listeners)callback(record);this.session.onChange();}
  async refresh(){if(this.busy)return;const record=await roomRequest(this.session.resumeCredentials,'turns/'+this.record.id);if(!this.busy&&record.revision>=this.record.revision&&JSON.stringify(record)!==JSON.stringify(this.record))this.publish(record);}
  async move(action){
    if(this.busy)return;this.busy=true;this.publish(this.record);
    try{this.publish(await roomRequest(this.session.resumeCredentials,'turns/'+this.record.id+'/moves',{method:'POST',body:{revision:this.record.revision,action}}));this.session.send({type:'friend-turns-updated'});}
    catch(error){if(error.status===409){this.busy=false;await this.refresh();}throw error;}
    finally{this.busy=false;this.publish(this.record);this.session.refreshInbox?.();}
  }
}
