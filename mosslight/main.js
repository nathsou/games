import {Game} from './game.js';
import {Renderer} from './render.js';
import {Audio} from './audio.js';
import {UI, formatTime} from './ui.js';

const canvas=document.getElementById('game'),audio=new Audio();
let ui,lastAccessible=-1;
const input={right:null,throwing:null,throwClock:0};
const hooks={
  start(){ui.guide=false;ui.focus=-1;lastAccessible=-1;clearInput();renderer.center();canvas.focus();},
  select(){},notice(text){ui.notice=text;},clearNotice(){ui.notice='';},
  pause(){ui.focus=-1;clearInput();},resume(){ui.focus=-1;canvas.focus();},
  hud(g){
    if(g.time-lastAccessible<1)return;lastAccessible=g.time;
    canvas.setAttribute('aria-label',`Mosslight. ${g.recovered} of 3 lanterns restored. ${g.crew.filter(c=>c.state==='follow').length} friends following. ${g.cozy?'No deadline.':formatTime(Math.max(0,g.dayLength-g.time))+' until dusk.'} Click to command; WASD moves; Q whistles; E sends crew; 1–4 selects; F fullscreen; Escape pauses.`);
  },
  end(g,won){ui.focus=-1;clearInput();canvas.setAttribute('aria-label',won?'Expedition complete. All three lanterns restored. Enter or click One more adventure to replay.':'Dusk has arrived. Enter or click to start another expedition.');try{ui.best=JSON.parse(localStorage.getItem('mosslight-best')||'null');}catch{/* Optional storage. */}}
};
const game=new Game(audio,hooks);ui=new UI(game,canvas);const renderer=new Renderer(canvas,game);renderer.ui=ui;
function clearInput(){input.right=null;input.throwing=null;input.throwClock=0;}
function fullscreen(){
  if(document.fullscreenElement){document.exitFullscreen?.().catch(()=>{});return;}
  if(!canvas.requestFullscreen){game.say('Fullscreen is unavailable here. The game already fills this window.',4);return;}
  canvas.requestFullscreen().catch(()=>game.say('Fullscreen is unavailable here. The game already fills this window.',4));
}
function closeGuide(){ui.guide=false;if(ui.guideResume)game.resume();ui.guideResume=false;ui.focus=-1;}
function cycle(direction){const types=['all',0,1,2],index=types.indexOf(game.selected);game.select(types[(index+direction+4)%4]);}
function act(id){
  audio.unlock();ui.focus=-1;clearInput();
  if(id==='start')game.start(false);
  else if(id==='cozy')game.start(true);
  else if(id==='again'||id==='restart')game.start(game.cozy);
  else if(id==='resume')game.resume();
  else if(id==='pause')game.pause();
  else if(id==='sound'){audio.setMuted(!audio.muted);ui.muted=audio.muted;}
  else if(id==='fullscreen')fullscreen();
  else if(id==='guide'){ui.guideResume=game.mode==='playing';if(ui.guideResume)game.pause();ui.guide=true;ui.guidePage=0;}
  else if(id==='guide-next')ui.guidePage=(ui.guidePage+1)%ui.guidePages;
  else if(id==='guide-prev')ui.guidePage=(ui.guidePage+ui.guidePages-1)%ui.guidePages;
  else if(id==='close-guide')closeGuide();
  else if(id==='title'){game.mode='title';game.keys.clear();audio.setActive(false);ui.notice='';}
  else if(id==='work')game.workNearby();
  else if(id==='whistle')game.whistle(game.player,220);
  else if(id.startsWith('select-'))game.select(id==='select-all'?'all':Number(id.slice(-1)));
}
function local(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*renderer.w,y:(e.clientY-r.top)/r.height*renderer.h};}
canvas.addEventListener('pointermove',e=>{
  const p=local(e),button=ui.hit(p.x,p.y),worldPoint=renderer.screenPoint(e.clientX,e.clientY);
  ui.hover=button?.id||null;canvas.style.cursor=button?'pointer':'crosshair';game.pointer={...worldPoint,active:!button&&!renderer.mapPoint(e.clientX,e.clientY)};
  if(input.right)input.right.point=worldPoint;if(input.throwing)input.throwing=worldPoint;
});
canvas.addEventListener('pointerleave',()=>{game.pointer.active=false;ui.hover=null;});
canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0&&e.button!==2)return;e.preventDefault();canvas.focus();const p=local(e),b=ui.hit(p.x,p.y);
  if(b&&e.button===0){act(b.id);return;}
  if(game.mode!=='playing'||ui.guide)return;
  canvas.setPointerCapture(e.pointerId);
  const map=renderer.mapPoint(e.clientX,e.clientY);if(map&&e.button===0){game.click(map);return;}
  const point=renderer.screenPoint(e.clientX,e.clientY);
  if(e.button===2){input.right={point,time:0};game.whistle(point);}
  else {game.click(point,e.shiftKey);if(e.shiftKey){input.throwing=point;input.throwClock=.18;}}
});
canvas.addEventListener('pointerup',e=>{if(e.button===2)input.right=null;if(e.button===0)input.throwing=null;});
canvas.addEventListener('pointercancel',clearInput);canvas.addEventListener('lostpointercapture',clearInput);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{if(game.mode==='playing'&&!ui.guide){e.preventDefault();cycle(Math.sign(e.deltaY)||1);}},{passive:false});
canvas.addEventListener('dblclick',e=>{if(game.mode==='playing'&&!ui.hit(local(e).x,local(e).y)){game.player.sprintUntil=game.time+4;}});
document.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();
  if(key==='f'&&!e.repeat){fullscreen();return;}
  if(ui.guide){if(key==='escape')closeGuide();else if(key==='enter'){const b=ui.buttons[ui.focus];if(b)act(b.id);else closeGuide();}else if(key==='arrowright')act('guide-next');else if(key==='arrowleft')act('guide-prev');else if(key==='tab'){e.preventDefault();ui.focus=(ui.focus+1)%ui.buttons.length;}return;}
  if(key==='tab'||(game.mode!=='playing'&&(key==='arrowup'||key==='arrowdown'))){e.preventDefault();const direction=e.shiftKey||key==='arrowup'?-1:1;ui.focus=(ui.focus+direction+ui.buttons.length)%ui.buttons.length;return;}
  if(key==='enter'){const b=ui.buttons[ui.focus>=0?ui.focus:0];if(b)act(b.id);return;}
  if(key==='escape'||key==='p'){if(game.mode==='playing')game.pause();else if(game.mode==='paused')game.resume();return;}
  if(key==='m'&&!e.repeat){act('sound');return;}
  if(game.mode!=='playing')return;game.keys.add(key);if(e.repeat)return;
  if(['1','2','3','4'].includes(key))game.select(key==='4'?'all':Number(key)-1);
  if(key==='z'||key==='x')cycle(key==='z'?-1:1);
  if(key==='e')game.workNearby();
  if(key===' '){const t=game.pointer.active?game.getTarget(game.pointer,50):null;if(t&&t.kind!=='sprout')game.command(t);else if(game.pointer.active)game.command(game.pointer);else game.workNearby();}
});
document.addEventListener('keyup',e=>game.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{game.keys.clear();clearInput();game.pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){game.pause(true);audio.setActive(false);clearInput();}});
document.addEventListener('fullscreenchange',()=>{ui.fullscreen=!!document.fullscreenElement;renderer.resize();game.keys.clear();clearInput();});
new ResizeObserver(()=>renderer.resize()).observe(canvas);
let previous=performance.now();
function frame(now){
  const dt=Math.min(.05,(now-previous)/1000);previous=now;
  if(game.mode==='playing'){
    if(input.right){input.right.time+=dt;game.whistle(input.right.point,Math.min(230,145+input.right.time*120),false);}
    if(input.throwing){input.throwClock-=dt;if(input.throwClock<=0&&game.following().length){input.throwClock=.18;game.command(game.getTarget(input.throwing,20)||input.throwing,true);}}
  }
  game.update(dt);renderer.draw(dt);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
