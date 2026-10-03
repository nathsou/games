import { WORLD, HOME, TYPES, makeWorld, Navigation, distance, clamp, blocked, inWater } from './world.js';

export class Game {
  constructor(audio, hooks){this.audio=audio;this.hooks=hooks;this.keys=new Set();this.pointer={x:700,y:760,active:false};this.selected='all';this.mode='title';this.cozy=false;this.time=0;this.dayLength=480;this.seed=7234;this.init(this.seed);}
  init(seed){
    this.world=makeWorld(seed);this.nav=new Navigation(this.world);this.player={x:430,y:870,r:12,hp:3,invuln:0,angle:0,route:[],moving:false};
    this.crew=[];this.nextId=0;this.particles=[];this.floaters=[];this.rings=[];this.time=0;this.recovered=0;this.lost=0;this.grown=0;this.bridgeSeen=false;this.firstCargo=false;this.firstFight=false;this.reinforceAt=0;this.warnings=new Set();this.noticeTime=0;this.selected='all';this.whistleTime=0;this.camera={x:0,y:0};
    for(let i=0;i<12;i++)this.addCrew(HOME.x+65+Math.cos(i*2.4)*28,HOME.y+35+Math.sin(i*2.4)*28,i%3,'follow');
  }
  start(cozy=false){this.cozy=cozy;this.seed=7234;this.init(this.seed);this.mode='playing';this.audio.unlock();this.audio.setActive(true);this.hooks.start();this.select('all');this.say('Welcome, captain. Click the nearby sprouts to grow your crew, then bring a dewberry home.',7);}
  addCrew(x,y,type,state='idle'){
    if(this.crew.filter(c=>c.state!=='lost').length>=60)return;
    const c={id:this.nextId++,x,y,type,state,r:6,task:null,route:[],routeAge:0,angle:0,bob:Math.random()*6.28,stun:0,flight:null};this.crew.push(c);return c;
  }
  select(type){this.selected=type;this.hooks.select(type);}
  following(){return this.crew.filter(c=>c.state==='follow'&&(this.selected==='all'||c.type===this.selected));}
  say(text,duration=4){this.hooks.notice(text);this.noticeTime=duration;}
  burst(x,y,color,n=10){for(let i=0;i<n;i++){const a=Math.random()*6.28,s=20+Math.random()*60;this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-25,life:.6+Math.random()*.5,max:1,color,size:2+Math.random()*2});}}
  float(x,y,text,color='#f5e4a0'){this.floaters.push({x,y,text,color,life:2});}
  getTarget(point,radius=55){
    const tasks=[...this.world.cargo.filter(c=>!c.delivered),...this.world.enemies.filter(e=>!e.dead),...this.world.sprouts.filter(s=>!s.picked)];
    if(!this.world.bridge.done)tasks.push(this.world.bridge);
    return tasks.filter(t=>distance(t,point)<t.r+radius).sort((a,b)=>distance(a,point)-distance(b,point))[0];
  }
  click(point,single=false){
    if(this.mode!=='playing')return;
    this.audio.unlock();this.pointer={...point,active:true};
    const target=this.getTarget(point,20);
    if(target?.kind==='sprout'){this.movePlayer(target);return;}
    if(target){this.command(target,single);return;}
    if(single){this.command(point,true);return;}
    this.movePlayer(point);
  }
  movePlayer(point){
    this.player.route=this.nav.path(this.player,point);this.rings.push({x:point.x,y:point.y,r:7,life:.6,color:'#d2e39c'});
    if(!this.player.route.length)this.say('That spot is out of reach. Build the bridge, or take the southern ford.',3);
  }
  workNearby(){
    const target=this.getTarget(this.player,155);
    if(target?.kind==='sprout'){this.movePlayer(target);return;}
    if(target)this.command(target);else this.say('Walk closer to a berry, lantern, bridge, or beetle. Then press E.',3);
  }
  command(target,single=false){
    if(distance(this.player,target)>350){this.say('A little closer, captain. Your crew can reach about one clearing away.',3);return;}
    let members=this.following();
    if(!members.length){this.say('No selected friends with you. Whistle workers back, or select Everyone (4).',3);return;}
    const existing=this.crew.filter(c=>c.task===target&&c.state!=='lost'&&c.state!=='wilt');
    const limit=single?1:target.kind==='bridge'?Math.max(0,5-existing.length):target.kind==='berry'?Math.max(0,target.need+1-existing.reduce((s,c)=>s+TYPES[c.type].strength,0)):target.kind==='core'?Math.max(0,target.need+4-existing.reduce((s,c)=>s+TYPES[c.type].strength,0)):members.length;
    if(limit<=0){this.say('That crew has it covered. Let them work, or whistle them back.',2);return;}
    members=members.sort((a,b)=>distance(a,this.player)-distance(b,this.player));
    const sent=members.slice(0,limit);
    for(const c of sent){c.state='task';c.task=target;c.route=[];c.routeAge=0;c.flight={time:0,duration:.35,fromX:c.x,fromY:c.y,toX:this.player.x+(target.x-this.player.x)*.28,toY:this.player.y+(target.y-this.player.y)*.28};}
    this.rings.push({x:target.x,y:target.y,r:14,life:.7,color:'#f1d78c'});this.audio.play('throw');
    if(!this.firstCargo&&(target.kind==='core'||target.kind==='berry')){this.firstCargo=true;this.say('Your carriers take cargo home on their own. Honey friends count as two. Go explore!',5);}
    if(!this.firstFight&&target.kind==='enemy'){this.firstFight=true;this.say('Embers hit hardest. Red rings mean a bite is coming. Whistle wilted friends awake!',5);}
  }
  whistle(point,radius=145,makeSound=true){
    if(this.mode!=='playing')return;
    if(distance(point,this.player)>350)point=this.player;
    let revived=0;
    for(const c of this.crew){
      if(c.state==='lost'||distance(c,point)>radius)continue;
      if(c.state==='wilt'){revived++;this.burst(c.x,c.y,TYPES[c.type].light,6);}
      c.state='follow';c.task=null;c.route=[];c.routeAge=0;c.flight=null;c.stun=0;
    }
    if(makeSound){this.audio.play('whistle');this.rings.push({x:point.x,y:point.y,r:radius,life:.6,color:'#d6efb2'});}
    if(revived)this.float(point.x,point.y-20,`+${revived} revived`,'#c9df93');
  }
  pause(auto=false){
    if(this.mode!=='playing')return;this.mode='paused';this.keys.clear();this.player.route=[];this.audio.setActive(false);this.hooks.pause(auto);
  }
  resume(){if(this.mode!=='paused')return;this.mode='playing';this.audio.unlock();this.audio.setActive(true);this.hooks.resume();}
  wilt(c){if(c.state==='wilt'||c.state==='lost')return;c.state='wilt';c.task=null;c.flight=null;c.stun=16;c.route=[];this.burst(c.x,c.y,TYPES[c.type].color,6);}
  hurt(){
    const p=this.player;if(p.invuln>0)return;p.hp--;p.invuln=2.5;this.audio.play('hurt');this.burst(p.x,p.y,'#fff2ce',12);
    if(p.hp<=0){p.x=HOME.x+65;p.y=HOME.y+50;p.hp=3;p.route=[];if(!this.cozy)this.time+=20;this.say('The ship patched you up. Your crew is still out there. Go whistle them home.',5);}
  }
  walk(entity,target,speed,dt,swim=false){
    entity.routeAge=(entity.routeAge||0)-dt;
    if(!entity.route?.length||entity.routeAge<=0){entity.route=this.nav.path(entity,target,swim);entity.routeAge=.65+(entity.id||0)%5*.08;}
    return this.followRoute(entity,speed,dt,swim);
  }
  followRoute(entity,speed,dt,swim=false){
    if(!entity.route?.length)return false;
    let step=speed*dt;
    while(step>0&&entity.route.length){const p=entity.route[0],d=distance(entity,p);if(d<1){entity.route.shift();continue;}const move=Math.min(step,d),dx=(p.x-entity.x)/d*move,dy=(p.y-entity.y)/d*move;
      if(blocked(entity.x+dx,entity.y+dy,this.world,swim,entity.r||6)){entity.route=[];return false;}
      entity.x+=dx;entity.y+=dy;entity.angle=Math.atan2(dy,dx);step-=move;if(move>=d)entity.route.shift();
    }
    return true;
  }
  update(dt){
    if(this.mode!=='playing')return;
    this.time+=dt;this.audio.update();this.noticeTime-=dt;if(this.noticeTime<=0)this.hooks.clearNotice();
    this.player.invuln=Math.max(0,this.player.invuln-dt);
    let dx=(this.keys.has('d')||this.keys.has('arrowright')?1:0)-(this.keys.has('a')||this.keys.has('arrowleft')?1:0),dy=(this.keys.has('s')||this.keys.has('arrowdown')?1:0)-(this.keys.has('w')||this.keys.has('arrowup')?1:0);
    const speed=this.keys.has('shift')?270:195,p=this.player;
    if(dx||dy){p.route=[];const length=Math.hypot(dx,dy);dx=dx/length*speed*dt;dy=dy/length*speed*dt;if(!blocked(p.x+dx,p.y,this.world,false,p.r))p.x+=dx;if(!blocked(p.x,p.y+dy,this.world,false,p.r))p.y+=dy;p.angle=Math.atan2(dy,dx);p.moving=true;}else p.moving=this.followRoute(p,speed,dt);
    if(this.keys.has('q')){if(this.whistleTime===0)this.audio.play('whistle');this.whistleTime+=dt;this.whistle(p,Math.min(220,80+this.whistleTime*190),false);}else this.whistleTime=0;
    for(const s of this.world.sprouts){if(!s.picked&&distance(s,p)<48){s.picked=true;this.addCrew(s.x,s.y,s.type,'follow');this.grown++;this.audio.play('pluck');this.burst(s.x,s.y,TYPES[s.type].light,10);this.float(s.x,s.y-15,'+1 '+TYPES[s.type].name);}}
    for(const c of this.crew){
      c.bob+=dt*(c.state==='follow'||c.state==='task'?11:3);
      if(c.state==='lost')continue;
      if(c.state==='wilt'){c.stun-=dt;if(c.stun<=0){c.state='lost';this.lost++;this.burst(c.x,c.y,'#acc999',12);}continue;}
      if(c.flight){const f=c.flight;f.time+=dt;const t=Math.min(1,f.time/f.duration);const nx=f.fromX+(f.toX-f.fromX)*t,ny=f.fromY+(f.toY-f.fromY)*t;if(!blocked(nx,ny,this.world,c.type===1,c.r)){c.x=nx;c.y=ny;}if(t>=1)c.flight=null;continue;}
      if(c.state==='carry')continue;
      if(c.state==='follow'){
        const n=c.id%12,row=Math.floor(c.id/12),a=n*2.4+this.time*.12,ring=30+Math.sqrt(c.id+1)*8+row*4;
        const target={x:p.x+Math.cos(a)*ring-Math.cos(p.angle)*(p.moving?25:0),y:p.y+Math.sin(a)*ring-Math.sin(p.angle)*(p.moving?25:0)};
        if(distance(c,p)>500){this.walk(c,p,240,dt,c.type===1);}else if(distance(c,target)>10)this.walk(c,target,205+(distance(c,p)>160?55:0),dt,c.type===1);
      }
      if(c.state==='task')this.updateTask(c,dt);
      if(c.type!==0&&this.world.fires.some(f=>distance(c,f)<f.r*.75))this.wilt(c);
    }
    this.updateCargo(dt);this.updateBridge(dt);this.updateEnemies(dt);
    const alive=this.crew.filter(c=>c.state!=='lost'&&c.state!=='wilt');
    if(alive.length<6&&this.time>this.reinforceAt){for(let i=0;i<4;i++)this.addCrew(HOME.x+Math.cos(i*2)*40,HOME.y+65+Math.sin(i*2)*20,i%3,distance(p,HOME)<180?'follow':'idle');this.reinforceAt=this.time+30;this.say('The ship grew four reinforcements. Find them at camp.',4);}
    for(const e of this.particles){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vy+=75*dt;e.life-=dt;}this.particles=this.particles.filter(e=>e.life>0);
    for(const f of this.floaters){f.y-=16*dt;f.life-=dt;}this.floaters=this.floaters.filter(f=>f.life>0);
    for(const r of this.rings)r.life-=dt;this.rings=this.rings.filter(r=>r.life>0);
    if(!this.cozy){for(const [remaining,text] of [[120,'Two minutes until dusk. Keep those lanterns moving!'],[45,'Dusk is close. Your carriers can finish while you explore.']])if(this.dayLength-this.time<remaining&&!this.warnings.has(remaining)){this.warnings.add(remaining);this.say(text,5);}if(this.time>=this.dayLength)this.finish(false);}
    this.hooks.hud(this);
  }
  updateTask(c,dt){
    const t=c.task;if(!t||t.dead||t.delivered||t.done){c.state='idle';c.task=null;return;}
    if(t.kind==='bridge'){
      const spot={x:c.x<1200?1085:1315,y:650+(c.id%5-2)*13};
      if(distance(c,spot)>12)this.walk(c,spot,200,dt,c.type===1);
      return;
    }
    const range=t.kind==='enemy'?t.r+8:t.r+15;
    if(distance(c,t)>range){this.walk(c,t,220,dt,c.type===1);return;}
    if(t.kind==='core'||t.kind==='berry'){c.state='carry';return;}
    if(t.kind==='enemy'){
      t.hp-=TYPES[c.type].attack*5.5*dt;
      if(Math.random()<dt*5){this.burst(t.x,t.y-8,TYPES[c.type].light,2);if(Math.random()<.2)this.audio.play('hit');}
      if(t.hp<=0){t.dead=true;this.burst(t.x,t.y,'#edba81',24);this.audio.play('deliver');this.float(t.x,t.y-25,'Mossback defeated');this.world.cargo.push({x:t.x,y:t.y,kind:'berry',name:'Mossback seed pod',need:3,r:14,value:5,delivered:false,route:null,routeAge:0,carrying:false});for(const m of this.crew.filter(m=>m.task===t)){m.state='follow';m.task=null;m.route=[];}}
      return;
    }
    c.state='idle';c.task=null;
  }
  updateCargo(dt){
    for(const cargo of this.world.cargo){
      if(cargo.delivered)continue;
      const carriers=this.crew.filter(c=>c.task===cargo&&c.state==='carry');const power=carriers.reduce((n,c)=>n+TYPES[c.type].strength,0);cargo.power=power;cargo.carrying=power>=cargo.need;
      if(!cargo.carrying)continue;
      const swim=carriers.every(c=>c.type===1);
      const routeKey=swim?'swim':'land';
      if(!cargo.route?.length||cargo.routeKey!==routeKey){cargo.route=this.nav.path(cargo,HOME,swim);cargo.routeKey=routeKey;}
      this.followRoute(cargo,70+Math.min(35,(power-cargo.need)*5),dt,swim);
      carriers.forEach((c,i)=>{const a=i/carriers.length*Math.PI*2;c.x=cargo.x+Math.cos(a)*(cargo.r+9);c.y=cargo.y+Math.sin(a)*(cargo.r+7);c.angle=a;});
      if(distance(cargo,HOME)<60){
        cargo.delivered=true;this.audio.play('deliver');this.burst(HOME.x,HOME.y-30,'#f0d58c',25);
        for(const c of carriers){c.state=distance(c,this.player)<190?'follow':'idle';c.task=null;c.route=[];}
        for(const c of this.crew.filter(c=>c.task===cargo)){c.state='idle';c.task=null;}
        const grow=Math.min(cargo.value,60-this.crew.filter(c=>c.state!=='lost').length);
        for(let i=0;i<grow;i++)this.addCrew(HOME.x+Math.cos(i*2.4)*45,HOME.y+50+Math.sin(i*2.4)*30,(this.grown+i)%3,distance(this.player,HOME)<190?'follow':'idle');
        this.grown+=grow;this.float(HOME.x,HOME.y-70,`+${grow} new friends`);
        if(cargo.kind==='core'){this.recovered++;this.say(`${cargo.name} is home! ${this.recovered}/3 restored. Your ship grew ${grow} new friends.`,5);if(this.recovered===3)this.finish(true);}else this.say(`Dewberry delivered. ${grow} new friends are waiting at camp.`,3);
      }
    }
  }
  updateBridge(dt){
    const b=this.world.bridge;if(b.done)return;
    const workers=this.crew.filter(c=>c.task===b&&c.state==='task'&&Math.abs(c.x-1200)>85&&Math.abs(c.x-1200)<135&&Math.abs(c.y-650)<60);
    b.workers=workers.length;
    if(workers.length){b.progress+=dt*workers.length*.018;if(Math.random()<dt*10)this.burst(1130+b.progress*140,650,'#d5b177',2);}
    if(b.progress>=1){b.done=true;b.progress=1;this.nav.rebuild();for(const c of workers){c.state='follow';c.task=null;c.route=[];}this.audio.play('bridge');this.say('Bridge complete! A shortcut to the northern woods. Everyone can cross safely.',5);this.float(1200,610,'A path forward.');}
  }
  updateEnemies(dt){
    for(const e of this.world.enemies){
      if(e.dead)continue;e.cool-=dt;
      const nearby=this.crew.filter(c=>c.state!=='lost'&&c.state!=='wilt'&&distance(c,e)<130);
      const playerNear=distance(this.player,e)<150;const target=nearby[0]||(playerNear?this.player:null);
      if(e.phase==='windup'){
        e.timer-=dt;if(e.timer<=0){e.phase='bite';e.timer=.2;this.burst(e.x,e.y,'#ef927b',9);for(const c of this.crew)if(c.state!=='lost'&&c.state!=='wilt'&&distance(c,e)<e.r+40)this.wilt(c);if(distance(this.player,e)<e.r+40)this.hurt();}
      }else if(e.phase==='bite'){e.timer-=dt;if(e.timer<=0){e.phase='roam';e.cool=2.8;}}
      else if(target){
        e.angle=Math.atan2(target.y-e.y,target.x-e.x);
        if(distance(e,target)<e.r+38&&e.cool<=0){e.phase='windup';e.timer=.85;}
        else if(distance(e,target)>e.r+18&&distance(e,{x:e.homeX,y:e.homeY})<180){const dx=Math.cos(e.angle)*38*dt,dy=Math.sin(e.angle)*38*dt;if(!blocked(e.x+dx,e.y+dy,this.world,false,e.r)){e.x+=dx;e.y+=dy;}}
      }else{const a=this.time*.35+e.homeX,t={x:e.homeX+Math.cos(a)*30,y:e.homeY+Math.sin(a)*22};const d=distance(e,t);if(d>2){e.x+=(t.x-e.x)/d*18*dt;e.y+=(t.y-e.y)/d*18*dt;}}
    }
  }
  finish(won){
    if(this.mode!=='playing')return;this.mode=won?'won':'ended';this.keys.clear();this.audio.play(won?'win':'hurt');
    if(won&&!this.cozy){try{const old=JSON.parse(localStorage.getItem('mosslight-best')||'null');if(!old||this.time<old.time)localStorage.setItem('mosslight-best',JSON.stringify({time:Math.round(this.time),crew:this.crew.filter(c=>c.state!=='lost').length}));}catch{/* Storage is optional. */}}
    this.hooks.end(this,won);setTimeout(()=>{if(this.mode!=='playing')this.audio.setActive(false);},1600);
  }
}
