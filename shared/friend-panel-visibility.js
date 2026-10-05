import {installFloatingWindows} from './floating-windows.js';
import {loadTheme,THEME_KEY} from './theme.js';
export function installPanelVisibility(session) {
  const $=id=>document.getElementById(id),windows=installFloatingWindows(),media=matchMedia('(prefers-color-scheme: dark)');
  function theme(){const value=loadTheme();document.documentElement.dataset.colorTheme=value==='system'?(media.matches?'dark':'light'):value;}
  media.addEventListener('change',theme);window.addEventListener('storage',e=>{if(e.key===THEME_KEY)theme();});window.addEventListener('games-theme-change',theme);theme();
  const panel=windows.create({id:'Play together',element:$('friend-header'),launcher:$('show-friend-panel'),close:$('hide-friend-panel'),title:$('friends-titlebar'),
    defaults:v=>({x:v.x+v.width-Math.min(392,v.width-16)-72,y:v.y+Math.max(16,v.height-560),width:Math.min(380,v.width-16),height:Math.min(520,v.height-32)}),
    launcherDefaults:v=>({x:v.x+v.width-80,y:v.y+v.height*.25,width:64,height:64}),onVisibility:open=>{session.onPanelVisibility?.(open);session.onChange();}});
  session.panel=panel;
  session.showPanel=(tab)=>{if(tab)session.selectTab?.(tab);panel.setOpen(true);};
  session.openChat=()=>session.showPanel('chat');
}
