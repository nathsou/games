export async function roomRequest(credential,path,{method='GET',body}={}) {
  const response=await fetch('/api/rooms/friends/'+credential.room+'/'+path,{method,cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+credential.key,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=Error(data.error||'Could not reach your room. Your last saved move is safe.');error.status=response.status;throw error;}
  return data;
}
// A saved game shared with the friend. The room pushes every change; requests
// return the same role-private view. Record versions order moves, readiness and
// ending a game; the rules revision is still used to submit moves.
const turnVersion=record=>record.version??record.revision;
export class TurnClient {
  constructor(session,record){this.session=session;this.record=record;this.busy=false;this.aiBusy=false;this.aiError='';this.listeners=new Set();}
  get names(){return {me:this.session.me?.name||'You',friend:this.session.friend?.name||'Friend'};}
  get friendHere(){const friend=this.session.friend;return Boolean(friend?.online&&friend.game===this.record.id);}
  subscribe(callback){this.listeners.add(callback);callback(this.record);return ()=>this.listeners.delete(callback);}
  publish(record){this.record=record;for(const callback of this.listeners)callback(record);this.session.onChange();this.schedule();}
  newer(record){return record.id===this.record.id&&turnVersion(record)>turnVersion(this.record);}
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
  // Any open page paces the rules bot; the room chooses its move. AI seats are
  // chosen by the creator's open page with its own provider settings.
  schedule(){
    clearTimeout(this.botTimer);
    if(this.closed||this.busy||this.aiBusy||this.record.finished)return;
    const revision=this.record.revision;
    if(this.record.waiting?.some(entry=>entry.kind==='dealer')&&this.botFailed!==revision){
      // When both people are at the table, the room creator's page paces the bot.
      const delay=this.friendHere&&this.session.role!=='host'?3500:1100;
      this.botTimer=setTimeout(()=>this.request({bot:true}).catch(error=>{if(error.status!==409)this.botFailed=revision;}),delay);
    } else if(this.record.aiTurn&&this.session.adapter?.chooseAI&&this.aiFailed!==revision) this.runAI();
  }
  async runAI(){
    const turn=this.record.aiTurn,revision=this.record.revision,controller=new AbortController();
    this.aiBusy=true;this.aiError='';this.aiController=controller;this.publish(this.record);
    try{
      const action=await this.session.adapter.chooseAI({...turn,record:this.record},{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)])});
      if(this.closed||controller.signal.aborted||this.record.revision!==revision)return;
      this.aiBusy=false;
      await this.request({seat:turn.seat,action});
    }catch(error){
      if(this.closed||controller.signal.aborted)return;
      this.aiFailed=revision;this.aiError=error.name==='TimeoutError'?'The AI took too long.':error.message;
    }finally{this.aiBusy=false;if(!this.closed)this.publish(this.record);}
  }
  retryAI(){this.aiFailed=null;this.aiError='';this.schedule();}
  close(){this.closed=true;clearTimeout(this.botTimer);this.aiController?.abort();this.listeners.clear();}
}
