// Modeless windows above the game; placement never changes room or game state.
const KEY = 'games.social-windows.v1', GAP = 8;
export function fitRect(rect, viewport, minimum = {width:64, height:60}) {
  const width=Math.min(Math.max(rect.width,minimum.width),Math.max(1,viewport.width-GAP*2));
  const height=Math.min(Math.max(rect.height,minimum.height),Math.max(1,viewport.height-GAP*2));
  return {x:Math.min(Math.max(rect.x,viewport.x+GAP),viewport.x+viewport.width-width-GAP),
    y:Math.min(Math.max(rect.y,viewport.y+GAP),viewport.y+viewport.height-height-GAP),width,height};
}
export function installFloatingWindows() {
  let preferences={},layer=10,gesture;
  try { preferences=JSON.parse(localStorage.getItem(KEY))||{}; } catch { /* Optional storage. */ }
  if(typeof preferences!=='object'||Array.isArray(preferences))preferences={};
  const controllers=[],shield=document.createElement('div');
  shield.className='window-drag-shield';shield.hidden=true;document.body.append(shield);
  const viewport=()=>{const v=window.visualViewport;return {x:v?.offsetLeft||0,y:v?.offsetTop||0,width:v?.width||innerWidth,height:v?.height||innerHeight};};
  function persist() {
    for(const c of controllers)preferences[c.id]={rect:c.rect,launcher:c.launcherRect,open:c.open};
    try { localStorage.setItem(KEY,JSON.stringify(preferences)); } catch { /* Optional storage. */ }
  }
  function validRect(value) {
    return value&&['x','y','width','height'].every(k=>Number.isFinite(value[k])&&Math.abs(value[k])<100000)&&value.width>0&&value.height>0;
  }
  function paint(element,rect) {
    Object.assign(element.style,{left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px'});
  }
  const overlaps=(a,b)=>a.x<b.x+b.width+GAP&&a.x+a.width+GAP>b.x&&a.y<b.y+b.height+GAP&&a.y+a.height+GAP>b.y;
  function draw() {
    const v=viewport(),occupied=[];
    for(const c of controllers) {
      paint(c.element,c.bounds());
      if(!c.element.hidden) {
        const r=c.element.querySelector('.window-titlebar').getBoundingClientRect();
        occupied.push({x:r.x,y:r.y,width:r.width,height:r.height});
      }
    }
    // Keep launchers separate and title bars unobstructed without overwriting preferred placement.
    for(const c of [...controllers].reverse()) {
      let r=fitRect(c.launcherRect,v);
      if(occupied.some(other=>overlaps(r,other))) {
        const candidates=occupied.flatMap(other=>[
          {...r,x:other.x-r.width-GAP},{...r,x:other.x+other.width+GAP},
          {...r,y:other.y-r.height-GAP},{...r,y:other.y+other.height+GAP},
        ]).map(candidate=>fitRect(candidate,v)).filter(candidate=>!occupied.some(other=>overlaps(candidate,other)));
        candidates.sort((a,b)=>Math.hypot(a.x-r.x,a.y-r.y)-Math.hypot(b.x-r.x,b.y-r.y));
        if(candidates.length)r=candidates[0];
      }
      c.displayLauncher=r;occupied.push(r);paint(c.launcher,r);
    }
  }
  function resizeRect(r,c) {
    const v=viewport();
    return fitRect({...r,width:Math.min(r.width,v.x+v.width-GAP-r.x),height:Math.min(r.height,v.y+v.height-GAP-r.y)},v,c.minimum);
  }
  function finish(cancel=false) {
    if(!gesture)return;
    const g=gesture;gesture=undefined;
    if(cancel)g.c[g.launcher?'launcherRect':'rect']=g.preferred;
    g.c.draw();shield.hidden=true;
    try { g.handle.releasePointerCapture(g.pointer); } catch { /* Capture may already be gone. */ }
    if(g.moved)g.suppressClick();
    persist();
  }
  document.addEventListener('keydown',e=>{
    if(gesture&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(true);}
  },true);
  function pointer(handle,c,kind) {
    let suppress=false;
    handle.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();}},true);
    handle.addEventListener('pointerdown',e=>{
      if(gesture||e.button!==0||!e.isPrimary||e.target.closest('button')&&e.target.closest('button')!==handle)return;
      if(document.querySelector('dialog[open]'))return;
      c.front();const launcher=kind==='launcher';
      gesture={c,handle,kind,launcher,pointer:e.pointerId,px:e.clientX,py:e.clientY,start:c.bounds(launcher),preferred:{...(launcher?c.launcherRect:c.rect)},moved:false,
        suppressClick(){suppress=true;setTimeout(()=>{suppress=false;},0);}};
      handle.setPointerCapture(e.pointerId);
      if(!launcher){e.preventDefault();handle.focus({preventScroll:true});}
    });
    handle.addEventListener('pointermove',e=>{
      const g=gesture;if(!g||g.handle!==handle||g.pointer!==e.pointerId)return;
      const dx=e.clientX-g.px,dy=e.clientY-g.py;
      if(!g.moved&&Math.hypot(dx,dy)<5)return;
      g.moved=true;shield.hidden=false;
      shield.style.cursor=kind.startsWith('resize')?getComputedStyle(handle).cursor:'grabbing';
      const r={...g.start};
      if(kind.startsWith('resize')){if(kind!=='resize-y')r.width+=dx;if(kind!=='resize-x')r.height+=dy;}
      else{r.x+=dx;r.y+=dy;}
      c[g.launcher?'launcherRect':'rect']=kind.startsWith('resize')?resizeRect(r,c):fitRect(r,viewport(),g.launcher?undefined:c.minimum);
      c.draw();e.preventDefault();
    });
    handle.addEventListener('pointerup',()=>{if(gesture?.handle===handle)finish();});
    handle.addEventListener('pointercancel',()=>{if(gesture?.handle===handle)finish(true);});
    handle.addEventListener('lostpointercapture',()=>{if(gesture?.handle===handle)finish(true);});
  }
  function keyboard(handle,c,launcher=false,resize=false) {
    handle.addEventListener('keydown',e=>{
      if(e.target!==handle||e.ctrlKey||e.metaKey||e.altKey)return;
      if(e.key==='Home'){e.preventDefault();c.reset(launcher);return;}
      const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if(!direction)return;e.preventDefault();
      const r=c.bounds(launcher),[dx,dy]=direction.map(n=>n*16);
      if(resize||e.shiftKey&&!launcher){r.width+=dx;r.height+=dy;}else{r.x+=dx;r.y+=dy;}
      c[launcher?'launcherRect':'rect']=(resize||e.shiftKey&&!launcher)?resizeRect(r,c):fitRect(r,viewport(),launcher?undefined:c.minimum);c.draw();persist();
    });
  }
  function create({id,element,launcher,close,title,defaults,launcherDefaults,onVisibility}) {
    const saved=preferences[id];
    const c={id,element,launcher,minimum:{width:280,height:300},
      rect:validRect(saved?.rect)?saved.rect:defaults(viewport()),
      launcherRect:validRect(saved?.launcher)?saved.launcher:launcherDefaults(viewport()),open:saved?.open===true,
      bounds(isLauncher=false){return isLauncher?(c.displayLauncher||fitRect(c.launcherRect,viewport())):fitRect(c.rect,viewport(),c.minimum);},
      draw,
      front(){element.style.zIndex=++layer;},
      setOpen(open,focus=true){
        c.open=open;element.hidden=!open;launcher.setAttribute('aria-expanded',String(open));
        c.draw();if(open)c.front();if(focus)(open?title:launcher).focus({preventScroll:true});
        persist();onVisibility?.(open);
      },
      reset(isLauncher=false){c[isLauncher?'launcherRect':'rect']=(isLauncher?launcherDefaults:defaults)(viewport());c.draw();persist();},
      badge(count,description){
        const badge=launcher.querySelector('.launcher-badge');badge.textContent=count>99?'99+':String(count);badge.hidden=!count;
        launcher.setAttribute('aria-label',`Toggle ${id}${count?'. '+count+' '+description:''}`);
      },
    };
    controllers.push(c);
    launcher.onclick=()=>c.setOpen(!c.open);close.onclick=()=>c.setOpen(false);
    element.querySelector('[data-window-reset]').onclick=()=>c.reset();
    element.addEventListener('pointerdown',()=>c.front());element.addEventListener('focusin',()=>c.front());
    element.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!document.querySelector('dialog[open]')){e.preventDefault();e.stopPropagation();c.setOpen(false);}
    });
    pointer(launcher,c,'launcher');keyboard(launcher,c,true);pointer(title,c,'move');keyboard(title,c);
    for(const kind of ['resize-x','resize-y','resize-xy']){
      const handle=document.createElement('span');handle.className='window-'+kind;
      if(kind==='resize-xy'){
        handle.tabIndex=0;handle.setAttribute('role','button');
        handle.setAttribute('aria-label',`Resize ${id} window. Use arrow keys; Home resets placement.`);keyboard(handle,c,false,true);
      }else handle.setAttribute('aria-hidden','true');
      element.append(handle);pointer(handle,c,kind);
    }
    element.hidden=!c.open;c.draw();launcher.setAttribute('aria-expanded',String(c.open));if(c.open)c.front();return c;
  }
  const redraw=()=>{if(gesture)finish(true);draw();};
  window.addEventListener('blur',()=>finish(true));
  window.addEventListener('resize',redraw);window.visualViewport?.addEventListener('resize',redraw);window.visualViewport?.addEventListener('scroll',redraw);
  return {create};
}
