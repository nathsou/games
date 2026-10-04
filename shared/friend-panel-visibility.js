import {installFloatingWindows} from './floating-windows.js';
import {loadTheme,THEME_KEY} from './theme.js';
export function installPanelVisibility(session) {
  const $=id=>document.getElementById(id),windows=installFloatingWindows(),media=matchMedia('(prefers-color-scheme: dark)');
  function theme(){const value=loadTheme();document.documentElement.dataset.colorTheme=value==='system'?(media.matches?'dark':'light'):value;}
  media.addEventListener('change',theme);window.addEventListener('storage',e=>{if(e.key===THEME_KEY)theme();});window.addEventListener('games-theme-change',theme);theme();
  const friends=windows.create({id:'Friends',element:$('friend-header'),launcher:$('show-friend-panel'),close:$('hide-friend-panel'),title:$('friends-titlebar'),
    defaults:v=>({x:v.x+v.width-368,y:v.y+Math.max(16,v.height-448),width:352,height:360}),
    launcherDefaults:v=>({x:v.x+v.width-152,y:v.y+v.height-80,width:64,height:60}),onVisibility:()=>session.onChange()});
  const chat=windows.create({id:'Chat',element:$('friend-chat'),launcher:$('chat-toggle'),close:$('chat-close'),title:$('chat-titlebar'),
    defaults:v=>({x:v.x+(v.width>760?v.width-740:16),y:v.y+Math.max(16,v.height-520),width:352,height:432}),
    launcherDefaults:v=>({x:v.x+v.width-80,y:v.y+v.height-80,width:64,height:60}),onVisibility:open=>session.onChatVisibility?.(open)});
  session.showPanel=()=>friends.setOpen(true);session.chatWindow=chat;session.setFriendBadge=count=>friends.badge(count,'games need your turn');
}
