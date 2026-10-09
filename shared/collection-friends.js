import {friendSession} from './friend-context.js';
import {ROOM_GAMES as GAMES} from './room-games.js';
// The collection's "play with a friend" strip mirrors the outer room.
export function installCollectionFriends(container){
  const session=friendSession();
  if(!session){container.hidden=true;return;}
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let signature='';
  function render(){
    const friend=session.friend,joined=session.inRoom&&friend.joined,turns=session.games.filter(game=>game.myTurn).length;
    const next=JSON.stringify([session.inRoom,joined,friend.name,friend.online&&session.status==='open',turns]);
    if(next===signature)return;signature=next;
    if(!session.inRoom){
      container.innerHTML='<div><strong>Play with a friend</strong><span>Invite someone with a room code. Play at the same time or take turns; games are saved for both of you.</span></div><div class="friend-strip-actions"><button type="button" data-friend="invite" class="primary">Invite a friend</button><button type="button" data-friend="join">Join with a code</button></div>';
    }else if(!joined){
      container.innerHTML='<div><strong>Waiting for your friend</strong><span>Share your room code. We’ll let you know when they join.</span></div><div class="friend-strip-actions"><button type="button" data-friend="panel" class="primary">Show invitation</button></div>';
    }else{
      const name=esc(friend.name||'your friend');
      container.innerHTML='<div><strong><i class="friend-dot'+(friend.online&&session.status==='open'?' online':'')+'" aria-hidden="true"></i>Playing with '+name+'</strong><span>'+(turns?turns+(turns===1?' game needs':' games need')+' your move.':friend.online?esc(friend.name||'Your friend')+' is online.':'Start a game; '+name+' can play when they’re back.')+'</span></div><div class="friend-strip-actions">'+Object.entries(GAMES).map(([id,title])=>'<button type="button" data-friend="play" data-game="'+id+'">'+title+'</button>').join('')+(turns?'<button type="button" data-friend="games" class="primary">Your turns</button>':'')+'</div>';
    }
    container.hidden=false;
  }
  container.addEventListener('click',event=>{
    const button=event.target.closest('[data-friend]');if(!button)return;
    const action=button.dataset.friend;
    if(action==='invite')session.openInvitation('collection');
    else if(action==='join')session.openJoin();
    else if(action==='panel')session.showPanel();
    else if(action==='games')session.showPanel('games');
    else if(action==='play')session.openGameSetup(button.dataset.game);
  });
  session.listeners?.add(render);
  window.addEventListener('pagehide',()=>session.listeners?.delete(render),{once:true});
  render();
}
