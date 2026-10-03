import {Game} from './game.js';
import {Renderer} from './render.js';
import {Audio} from './audio.js';
import {distance,TYPES} from './world.js';

const $=id=>document.getElementById(id),canvas=$('game'),audio=new Audio();
const timer=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
let lastHud=0,guidePaused=false;
const hooks={
  start(){for(const id of ['title-screen','pause-screen','end-screen'])$(id).hidden=true;for(const id of ['hud','crew-bar'])$(id).hidden=false;$('touch-controls').hidden=!matchMedia('(pointer: coarse)').matches;canvas.focus();lastHud=-1;},
  select(type){document.querySelectorAll('[data-type]').forEach(b=>{const selected=b.dataset.type===String(type);b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',selected);});},
  notice(text){$('notice').textContent=text;$('notice').classList.add('show');},
  clearNotice(){$('notice').classList.remove('show');},
  pause(auto){$('pause-title').textContent=auto?'The woods are waiting.':'Take a breather.';$('pause-screen').hidden=false;$('tooltip').hidden=true;},
  resume(){$('pause-screen').hidden=true;canvas.focus();},
  hud(g){
    if(g.time-lastHud<.12)return;lastHud=g.time;
    $('cores').innerHTML=`${g.recovered} / 3 <small>lanterns</small>`;[...$('pips').children].forEach((p,i)=>p.classList.toggle('filled',i<g.recovered));
    $('clock').textContent=g.cozy?'∞':timer(Math.max(0,g.dayLength-g.time));$('day-label').textContent=g.cozy?'TAKE YOUR TIME':'UNTIL DUSK';$('day-progress').style.width=(g.cozy?100:Math.max(0,100-g.time/g.dayLength*100))+'%';document.querySelector('.day').classList.toggle('urgent',!g.cozy&&g.dayLength-g.time<60);
    const active=g.crew.filter(c=>c.state!=='lost');$('count-all').textContent=active.length;for(let i=0;i<3;i++)$('count-'+i).textContent=active.filter(c=>c.type===i).length;$('following').textContent=g.crew.filter(c=>c.state==='follow').length;
    const target=g.pointer.active?g.getTarget(g.pointer,20):null;
    if(target&&distance(target,g.player)<400){let hint='';if(target.kind==='sprout')hint=`${TYPES[target.type].name} sprout · walk close to recruit`;if(target.kind==='enemy')hint=`${target.name} · click to attack · Embers hit hardest`;if(target.kind==='core'||target.kind==='berry')hint=`${target.name} · ${target.power||0}/${target.need} carrying · click to send crew`;if(target.kind==='bridge')hint='Fallen-log bridge · click to assign builders';$('tooltip').textContent=hint;$('tooltip').hidden=!hint;}else $('tooltip').hidden=true;
  },
  end(g,won){$('end-screen').hidden=false;$('end-kicker').textContent=won?'ALL THREE LANTERNS RESTORED':'THE WOODS HAVE FALLEN ASLEEP';$('end-title').innerHTML=won?'A little light<br>goes a long way.':'There’s always<br>another morning.';$('end-copy').textContent=won?'The Acorn glows again. A pocketful of brave little friends made a very big difference.':'Your crew tucked in safely for the night. Try a fresh expedition, or explore at your own pace without a deadline.';$('end-stats').innerHTML=`<span><strong>${g.recovered}/3</strong>lanterns home</span><span><strong>${timer(g.time)}</strong>explored</span><span><strong>${g.crew.filter(c=>c.state!=='lost').length}</strong>little friends</span>`;$('tooltip').hidden=true;$('again').focus();}
};
const game=new Game(audio,hooks),renderer=new Renderer(canvas,game);
$('start').onclick=()=>game.start(false);$('cozy').onclick=()=>game.start(true);$('again').onclick=()=>game.start(game.cozy);$('end-cozy').onclick=()=>game.start(true);$('restart').onclick=()=>game.start(game.cozy);$('resume').onclick=()=>game.resume();$('pause').onclick=()=>game.pause();
document.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{game.select(b.dataset.type==='all'?'all':Number(b.dataset.type));canvas.focus();});
function mute(){audio.setMuted(!audio.muted);$('sound').textContent=audio.muted?'♪̸':'♫';$('sound').setAttribute('aria-label',audio.muted?'Unmute sound':'Mute sound');$('sound').title=audio.muted?'Unmute (M)':'Mute (M)';}
$('sound').onclick=mute;
$('help').onclick=()=>{guidePaused=game.mode==='playing';if(guidePaused)game.pause();$('guide').showModal();};$('guide').addEventListener('close',()=>{if(guidePaused){game.resume();guidePaused=false;}});
$('touch-work').onclick=()=>game.workNearby();$('touch-whistle').onclick=()=>game.whistle(game.player,220);
canvas.addEventListener('pointermove',e=>{game.pointer={...renderer.screenPoint(e.clientX,e.clientY),active:true};});
canvas.addEventListener('pointerleave',()=>game.pointer.active=false);
canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;e.preventDefault();canvas.focus();const point=renderer.screenPoint(e.clientX,e.clientY);if(e.button===2)game.whistle(point);else game.click(point,e.shiftKey);});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
  if($('guide').open)return;
  const key=e.key.toLowerCase();if(e.target!==canvas&&e.target.closest('button, a, input, select')){if(key==='escape'&&game.mode==='playing')game.pause();return;}
  if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(key)&&game.mode==='playing')e.preventDefault();
  if(e.repeat){game.keys.add(key);return;}
  if(key==='escape'||key==='p'){if(game.mode==='playing')game.pause();else if(game.mode==='paused')game.resume();return;}
  if(key==='m'){mute();return;}
  if(game.mode!=='playing')return;game.keys.add(key);
  if(['1','2','3','4'].includes(key))game.select(key==='4'?'all':Number(key)-1);
  if(key==='e')game.workNearby();
  if(key===' '){const t=game.getTarget(game.pointer,50);if(t&&t.kind!=='sprout')game.command(t);else game.command(game.pointer);}
});
document.addEventListener('keyup',e=>game.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{game.keys.clear();game.pause(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden){game.pause(true);audio.setActive(false);}});
new ResizeObserver(()=>renderer.resize()).observe(canvas);
try{const best=JSON.parse(localStorage.getItem('mosslight-best')||'null');if(best&&Number.isFinite(best.time))$('best').textContent=`YOUR QUICKEST EXPEDITION · ${timer(best.time)}`;}catch{/* Private browsing still gets the complete game. */}
let previous=performance.now();function frame(now){const dt=Math.min(.05,(now-previous)/1000);previous=now;game.update(dt);renderer.draw(dt);requestAnimationFrame(frame);}requestAnimationFrame(frame);
