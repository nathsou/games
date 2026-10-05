import {FriendChat} from './friend-chat.js';
import {roomRequest} from './turn-client.js';
// The room stores the latest 60 entries and pushes the history after each send.
export class RoomChat extends FriendChat {
  persistent=true;
  apply(history){if(history&&history.sequence>=this.sequence){this.restore(history);this.session.onChange();}}
  async refresh(){this.apply(await roomRequest(this.session.credential,'chat'));}
  async send(kind,value){
    if(!this.session.credential)throw Error('Join a room before sending a message.');
    this.apply(await roomRequest(this.session.credential,'chat',{method:'POST',body:{kind,value}}));
  }
  receive(){return false;}
}
