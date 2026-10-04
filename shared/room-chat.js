import {FriendChat} from './friend-chat.js';
import {roomRequest} from './turn-client.js';
export class RoomChat extends FriendChat {
  persistent=true;
  async refresh(){const history=await roomRequest(this.session.resumeCredentials,'chat');if(history.sequence>=this.sequence){this.restore(history);this.session.onChange();}}
  async send(kind,value){
    if(!this.session.resumeCredentials)throw Error('Join a room before sending a message.');
    const history=await roomRequest(this.session.resumeCredentials,'chat',{method:'POST',body:{kind,value}});
    this.restore(history);this.session.onChange();this.session.send({type:'friend-chat-updated'});
  }
  receive(message){if(message.type==='friend-chat-updated'){this.refresh().catch(error=>this.session.onError(error.message));return true;}return message.type==='friend-chat-send'||message.type==='friend-chat-entry';}
}
