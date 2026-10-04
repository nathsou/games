const KEY = 'games.friend-panel-open';

export function installPanelVisibility(session) {
  const panel=document.getElementById('friend-header'),toggle=document.getElementById('show-friend-panel');
  let open=true;
  try { open=localStorage.getItem(KEY)!=='closed'; } catch { /* Storage is optional. */ }
  function setOpen(value,focus=false) {
    open=value;panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
    toggle.setAttribute('aria-label',open?'Hide friend panel':'Show friend panel');
    try { localStorage.setItem(KEY,open?'open':'closed'); } catch { /* Storage is optional. */ }
    if(focus)(open?panel.querySelector('button'):toggle).focus();
    session.onChange();
  }
  toggle.onclick=()=>setOpen(!open,true);
  document.getElementById('hide-friend-panel').onclick=()=>setOpen(false,true);
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!document.querySelector('dialog[open]')){event.preventDefault();setOpen(false,true);}
  });
  session.showPanel=()=>setOpen(true);
  panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
  return ()=>{
    toggle.textContent=document.getElementById('chat-toggle').textContent.replace('Chat','Friends');
    toggle.setAttribute('aria-label',open?'Hide friend panel':'Show friend panel');
  };
}
