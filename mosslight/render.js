import {WORLD, HOME, TYPES, random, distance, inWater, clamp} from './world.js';

const CREW = [
  '.....ll.....','....llll....','.....s......','.....s......','....cccc....','...cccccc...','...cwccwc...','...ckcckc...','....cccc....','.....cc.....','....d..d....'
];
const CAPTAIN = ['....eeee....','...eeeeee...','..eeeeeeee..','..eeaaaeee..','..eaaaaaae..','...akaaaka..','...aaaaaa...','....aaaa....','...dddddd...','..dddddddd..','..ddggggdd..','...dggggd...','....dddd....','...d....d...'];

function sprite(ctx,pattern,x,y,scale,palette){ctx.save();ctx.translate(Math.round(x-pattern[0].length*scale/2),Math.round(y-pattern.length*scale));for(let j=0;j<pattern.length;j++)for(let i=0;i<pattern[j].length;i++){const c=palette[pattern[j][i]];if(c){ctx.fillStyle=c;ctx.fillRect(i*scale,j*scale,scale,scale);}}ctx.restore();}
function ellipse(ctx,x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function line(ctx,x,y,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
function text(ctx,label,x,y,size=10,color='#d8e3bc',align='center'){ctx.font=`${size}px monospace`;ctx.textAlign=align;ctx.fillStyle='#12251fbb';ctx.fillText(label,x+1,y+1);ctx.fillStyle=color;ctx.fillText(label,x,y);}

export class Renderer {
  constructor(canvas,game){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.game=game;this.tick=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.resize();this.cacheTerrain();}
  resize(){const rect=this.canvas.getBoundingClientRect();this.canvas.width=Math.round(clamp(rect.width,600,1100));this.canvas.height=Math.round(this.canvas.width*rect.height/rect.width);this.w=this.canvas.width;this.h=this.canvas.height;}
  screenPoint(clientX,clientY){const r=this.canvas.getBoundingClientRect();return {x:(clientX-r.left)/r.width*this.w+this.game.camera.x,y:(clientY-r.top)/r.height*this.h+this.game.camera.y};}
  cacheTerrain(){
    const world=this.game.world;this.cachedWorld=world;this.terrain=document.createElement('canvas');this.terrain.width=WORLD.w;this.terrain.height=WORLD.h;const c=this.terrain.getContext('2d');const rng=random(world.seed);
    c.fillStyle='#354c36';c.fillRect(0,0,WORLD.w,WORLD.h);
    for(let y=0;y<WORLD.h;y+=24)for(let x=0;x<WORLD.w;x+=24){const n=rng(),north=y<630,east=x>1300;c.fillStyle=north?(n<.3?'#2e493a':n<.6?'#324d3c':'#35513f'):east?(n<.4?'#3c4633':'#414a35'):(n<.3?'#3b5037':n<.6?'#3e5438':'#42573a');c.fillRect(x,y,24,24);}
    // Broad, winding trails connect landmarks without turning the woods into a maze.
    const paths=[[[370,830],[560,790],[810,690],[1050,650]],[[550,820],[700,980],[920,1130],[1200,1150],[1530,1160],[1770,1130]],[[1330,650],[1460,610],[1500,430],[1650,350]],[[1470,650],[1710,750],[1830,1030],[1780,1130]]];
    for(const path of paths){c.strokeStyle='#60704a';c.lineWidth=72;c.lineCap='round';c.lineJoin='round';c.beginPath();path.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.strokeStyle='#69764e';c.lineWidth=53;c.stroke();}
    ellipse(c,HOME.x,HOME.y,140,105,'#667451');ellipse(c,HOME.x,HOME.y,105,75,'#75805a');
    for(let y=0;y<1000;y+=12){const offset=Math.sin(y*.026)*5;c.fillStyle='#98a87c';c.fillRect(1106+offset,y,186,12);c.fillStyle='#355e62';c.fillRect(1120,y,160,12);c.fillStyle='#3d6d6c';c.fillRect(1134,y,132,12);c.fillStyle='#447674';c.fillRect(1150,y,104,12);}
    for(let i=0;i<60;i++){const x=1130+rng()*140,y=25+rng()*945;line(c,x,y,x+5+rng()*10,y,'#649b9080',2);}
    for(const d of world.decor){
      if(inWater(d.x,d.y,world))continue;const x=Math.round(d.x),y=Math.round(d.y);
      if(distance(d,HOME)<100)continue;
      if(d.t<.5){c.fillStyle=d.v<.5?'#7e8a5060':'#1e3c3160';c.fillRect(x,y,2,3);c.fillRect(x+3,y-2,2,4);c.fillRect(x-3,y-1,2,3);}
      else if(d.t<.67){c.fillStyle='#243e3080';c.fillRect(x,y,7,3);c.fillStyle='#a5ac7050';c.fillRect(x,y-2,5,2);}
      else if(d.t<.85){c.fillStyle=d.v<.45?'#d7c68c':'#d59586';c.fillRect(x-2,y,3,3);c.fillRect(x+2,y-3,3,3);c.fillStyle='#557c43';c.fillRect(x,y+3,2,5);}
      else if(d.t<.93){ellipse(c,x,y,13,6,'#203e3066');c.fillStyle='#72834f';c.fillRect(x-6,y-5,12,5);c.fillRect(x-3,y-9,8,6);c.fillStyle='#9baa68';c.fillRect(x-2,y-9,4,3);}
      else{c.fillStyle='#a47f67';c.fillRect(x,y-1,3,7);c.fillStyle=d.v<.5?'#d7b898':'#c58371';c.fillRect(x-4,y-4,11,4);c.fillRect(x-2,y-7,7,3);c.fillStyle='#ecd6b0';c.fillRect(x-2,y-4,2,2);}
    }
    for(const f of world.fires){ellipse(c,f.x,f.y,f.r+10,f.r*.65,'#4e3f2e');ellipse(c,f.x,f.y,f.r,f.r*.5,'#3b3329');}
    for(const r of world.rocks)this.rock(c,r);
    // Tiny hand-painted signposts provide diegetic navigation.
    for(const [x,y,label] of [[610,810,'LANTERN →'],[1050,1125,'FORD →'],[1370,615,'↑ STREAM'],[1500,1190,'HOLLOW →']]){c.fillStyle='#6a4f3c';c.fillRect(x-2,y-4,5,30);c.fillStyle='#ad9b68';c.fillRect(x-34,y-14,70,18);c.fillStyle='#c2b17b';c.fillRect(x-34,y-14,70,3);text(c,label,x,y-2,8,'#293e30');}
  }
  rock(c,r){ellipse(c,r.x+6,r.y+5,r.r*1.14,r.r*.62,'#1c332966');c.fillStyle='#647165';c.beginPath();c.moveTo(r.x-r.r,r.y);c.lineTo(r.x-r.r*.7,r.y-r.r);c.lineTo(r.x+r.r*.4,r.y-r.r*1.25);c.lineTo(r.x+r.r,r.y-r.r*.5);c.lineTo(r.x+r.r*.8,r.y+r.r*.25);c.lineTo(r.x-r.r*.65,r.y+r.r*.3);c.fill();c.fillStyle='#7f8973';c.beginPath();c.moveTo(r.x-r.r*.7,r.y-r.r);c.lineTo(r.x+r.r*.4,r.y-r.r*1.25);c.lineTo(r.x+r.r*.15,r.y-r.r*.6);c.lineTo(r.x-r.r*.7,r.y-r.r*.3);c.fill();c.fillStyle='#8e9c5b';c.fillRect(r.x-r.r*.6,r.y-r.r*.9,r.r*.8,5);c.fillRect(r.x-r.r*.45,r.y-r.r*.9-4,r.r*.45,5);}
  draw(dt){
    this.tick+=dt;if(this.cachedWorld!==this.game.world)this.cacheTerrain();
    const c=this.ctx,g=this.game,p=g.player;if(g.mode==='title'){g.camera.x=-200;g.camera.y=HOME.y-this.h*.55;}else{const targetX=clamp(p.x-this.w/2,0,Math.max(0,WORLD.w-this.w)),targetY=clamp(p.y-this.h/2,0,Math.max(0,WORLD.h-this.h));const smooth=this.reduced?1:1-Math.exp(-dt*7);g.camera.x+=(targetX-g.camera.x)*smooth;g.camera.y+=(targetY-g.camera.y)*smooth;}
    const cx=Math.round(g.camera.x),cy=Math.round(g.camera.y);c.fillStyle='#2c4534';c.fillRect(0,0,this.w,this.h);c.save();c.translate(-cx,-cy);c.drawImage(this.terrain,0,0);
    this.water(c);this.bridge(c);this.camp(c);
    for(const f of g.world.fires)this.fire(c,f);
    if(g.mode==='playing'&&p.route.length){c.setLineDash([3,9]);c.strokeStyle='#e0e6a547';c.lineWidth=2;c.beginPath();c.moveTo(p.x,p.y);for(const n of p.route)c.lineTo(n.x,n.y);c.stroke();c.setLineDash([]);}
    const entities=[...g.world.cargo.filter(e=>!e.delivered),...g.world.sprouts.filter(e=>!e.picked),...g.world.enemies.filter(e=>!e.dead),...g.crew.filter(e=>e.state!=='lost'),{...p,kind:'captain'},...g.world.trees.map(t=>({...t,kind:'tree'}))].sort((a,b)=>a.y-b.y);
    for(const e of entities){if(e.x<cx-120||e.x>cx+this.w+120||e.y<cy-30||e.y>cy+this.h+170)continue;
      if(e.kind==='tree')this.tree(c,e);else if(e.kind==='captain')this.captain(c,e);else if(e.kind==='enemy')this.enemy(c,e);else if(e.kind==='core'||e.kind==='berry')this.cargo(c,e);else if(e.kind==='sprout')this.sprout(c,e);else this.crew(c,e);
    }
    for(const e of g.particles){c.globalAlpha=Math.min(1,e.life*2);c.fillStyle=e.color;c.fillRect(Math.round(e.x),Math.round(e.y),e.size,e.size);}c.globalAlpha=1;
    for(const f of g.floaters){c.globalAlpha=Math.min(1,f.life);text(c,f.text,f.x,f.y,11,f.color);}c.globalAlpha=1;
    for(const r of g.rings){c.globalAlpha=r.life;c.strokeStyle=r.color;c.lineWidth=2;c.beginPath();c.ellipse(r.x,r.y,r.r*(1.3-r.life*.4),r.r*(1.3-r.life*.4),0,0,6.28);c.stroke();}c.globalAlpha=1;
    if(g.whistleTime>0){const radius=Math.min(220,80+g.whistleTime*190);c.strokeStyle='#e0f0ac99';c.lineWidth=2;c.setLineDash([6,5]);c.beginPath();c.arc(p.x,p.y,radius,0,6.28);c.stroke();c.setLineDash([]);}
    if(g.mode==='playing'&&g.pointer.active){const target=g.getTarget(g.pointer,20);if(target&&target.kind!=='sprout'){c.strokeStyle='#f0dc97';c.lineWidth=2;c.setLineDash([4,4]);c.beginPath();c.ellipse(target.x,target.y,target.r+14,target.r+10,0,0,6.28);c.stroke();c.setLineDash([]);}}
    // Drifting pollen and shafts of light soften the pixel edges.
    if(!this.reduced){for(let i=0;i<25;i++){const x=(i*197+Math.sin(this.tick*.2+i)*25)%WORLD.w,y=(i*137-this.tick*8+WORLD.h*10)%WORLD.h;c.globalAlpha=.25+Math.sin(this.tick+i)*.2;c.fillStyle='#ecdd9e';c.fillRect(Math.round(x),Math.round(y),2,2);}}c.globalAlpha=1;
    c.restore();
    const shade=c.createRadialGradient(this.w*.5,this.h*.45,this.h*.2,this.w*.5,this.h*.5,this.w*.8);shade.addColorStop(0,'#12292000');shade.addColorStop(1,'#0d211952');c.fillStyle=shade;c.fillRect(0,0,this.w,this.h);
    if(!g.cozy&&g.mode!=='title'){const dusk=clamp((g.time-330)/150,0,1);c.fillStyle=`rgba(28,24,59,${dusk*.26})`;c.fillRect(0,0,this.w,this.h);}
    if(g.mode!=='title')this.minimap(c);
    if(g.mode==='playing'){this.location(c);}
  }
  water(c){const t=this.reduced?0:this.tick;for(let i=0;i<35;i++){const x=1130+(i*29)%130,y=(i*79+t*12)%985;line(c,x,y,x+8+Math.sin(t+i)*3,y,'#8fc5af55',2);}for(let i=0;i<9;i++){const y=i*109+45;line(c,1110,y,1106,y-14,'#859768',2);line(c,1290,y+25,1294,y+8,'#a7b879',2);}}
  camp(c){const t=this.tick,home=HOME;ellipse(c,home.x,home.y+15,72,27,'#273e3266');c.strokeStyle='#b9c78566';c.lineWidth=2;c.setLineDash([3,9]);c.beginPath();c.ellipse(home.x,home.y+8,90,65,0,0,6.28);c.stroke();c.setLineDash([]);
    // A brass, acorn-shaped ship, slowly lighting up as lanterns arrive.
    c.fillStyle='#3c5148';c.fillRect(home.x-32,home.y-25,64,38);c.fillStyle='#b9ad78';c.fillRect(home.x-38,home.y-58,76,47);c.fillStyle='#c9bf8c';c.fillRect(home.x-28,home.y-75,56,32);c.fillStyle='#879671';c.fillRect(home.x-17,home.y-87,34,15);c.fillStyle='#546c5d';c.fillRect(home.x-13,home.y-66,26,27);c.fillStyle='#96ceba';c.fillRect(home.x-9,home.y-62,18,16);c.fillStyle='#e3e4b3';c.fillRect(home.x-9,home.y-62,7,5);c.fillStyle='#ddca8b';c.fillRect(home.x-33,home.y-31,66,6);
    for(let i=0;i<3;i++){const x=home.x-23+i*23;ellipse(c,x,home.y-14,7,7,i<this.game.recovered?'#efd47e':'#536959');if(i<this.game.recovered){c.globalAlpha=.15;ellipse(c,x,home.y-14,14+Math.sin(t*3)*2,14,'#ffe799');c.globalAlpha=1;}}
    line(c,home.x-29,home.y+2,home.x-50,home.y+20,'#c0ad7a',7);line(c,home.x+29,home.y+2,home.x+50,home.y+20,'#c0ad7a',7);c.fillStyle='#807953';c.fillRect(home.x-59,home.y+16,23,6);c.fillRect(home.x+36,home.y+16,23,6);
    line(c,home.x,home.y-87,home.x,home.y-110,'#a6b781',2);ellipse(c,home.x,home.y-111,5,4,'#f0cc81');
    text(c,'THE ACORN',home.x,home.y+46,10,'#ecdfac');text(c,'home & nursery',home.x,home.y+60,8,'#bfce98');
  }
  bridge(c){const b=this.game.world.bridge;const length=180*(b.done?1:b.progress);ellipse(c,1200,656,120,36,'#152f3155');for(let x=1100;x<1100+length;x+=12){c.fillStyle=(x/12|0)%2?'#af9165':'#bda374';c.fillRect(x,620,11,63);c.fillStyle='#d0b37b';c.fillRect(x,621,11,4);c.fillStyle='#6f6247';c.fillRect(x+4,631,2,34);}for(const x of [1090,1300]){c.fillStyle='#776548';c.fillRect(x,614,8,76);c.fillStyle='#d0b37b';c.fillRect(x,612,8,5);}if(!b.done){text(c,'BUILD A BRIDGE',1200,598,10,'#efe4b4');text(c,`${b.workers||0}/5 working · ${Math.floor(b.progress*100)}%`,1200,710,9,'#d8dba8');}else{text(c,'FALLEN-LOG CROSSING',1200,600,9,'#d8dba8');}}
  fire(c,f){const t=this.reduced?0:this.tick;for(let i=0;i<7;i++){const a=i*2.4,x=f.x+Math.cos(a)*f.r*.6,y=f.y+Math.sin(a)*f.r*.4,h=12+(Math.sin(t*8+i)+1)*8;c.fillStyle='#bb695655';c.fillRect(x-5,y-h-5,12,h+6);c.fillStyle='#df9061';c.fillRect(x-3,y-h,7,h);c.fillStyle='#f1c878';c.fillRect(x-1,y-h*.65,3,h*.65);}text(c,'EMBER PATCH',f.x,f.y+f.r*.7+12,8,'#ddb18b');}
  tree(c,t){ellipse(c,t.x+18,t.y+3,t.r*1.9,t.r*.78,'#112c2560');c.fillStyle='#655842';c.fillRect(t.x-8,t.y-59,17,61);c.fillStyle='#a18a5b';c.fillRect(t.x-6,t.y-57,4,58);c.fillStyle='#4d4b36';c.fillRect(t.x-13,t.y-5,27,9);
    const blocks=[[-31,-87,55,31,'#223e30'],[-47,-105,85,35,'#2a4934'],[-32,-130,63,33,'#37573b'],[-21,-147,40,28,'#456542'],[-36,-102,34,16,'#42613d'],[8,-105,38,23,'#385a39'],[-16,-127,30,9,'#5c7848'],[-13,-143,18,7,'#66804b']];for(const [x,y,w,h,color] of blocks){c.fillStyle=color;c.fillRect(t.x+x,t.y+y,w,h);}c.fillStyle='#95a76b';c.fillRect(t.x-20,t.y-113,5,3);c.fillRect(t.x+17,t.y-95,6,3);}
  captain(c,p){if(p.invuln>0&&Math.floor(this.tick*12)%2)return;ellipse(c,p.x,p.y,14,6,'#17372b77');const bob=p.moving&&!this.reduced?Math.sin(this.tick*13)*2:0;sprite(c,CAPTAIN,p.x,p.y+bob,2,{e:'#e0d3a2',a:'#d79573',k:'#293c35',d:'#bf6d62',g:'#efe1b8'});c.fillStyle='#90b987';c.fillRect(p.x+12,p.y-22,4,8);text(c,'▼',p.x,p.y-40,9,'#eef1be');if(p.hp<3){for(let i=0;i<3;i++){c.fillStyle=i<p.hp?'#eab19a':'#4d5e44';c.fillRect(p.x-10+i*8,p.y+9,5,3);}}}
  crew(c,m){const type=TYPES[m.type];ellipse(c,m.x,m.y,7,3,'#17372b77');if(m.state==='wilt'){c.globalAlpha=.55;sprite(c,CREW,m.x,m.y+5,1.6,{l:'#829b6c',s:'#6b8558',c:type.dark,w:'#ddd6a8',k:'#263f35',d:type.dark});c.globalAlpha=1;const r=clamp(m.stun/16,0,1);c.fillStyle='#2b3b33';c.fillRect(m.x-8,m.y+8,16,2);c.fillStyle='#d1de9b';c.fillRect(m.x-8,m.y+8,16*r,2);text(c,'!',m.x,m.y-20,11,'#eff0bc');return;}
    const height=m.flight?Math.sin(m.flight.time/m.flight.duration*Math.PI)*36:0,bob=this.reduced?0:Math.sin(m.bob)*(m.state==='idle'?1:2);sprite(c,CREW,m.x,m.y-height+bob,1.7,{l:'#bdd987',s:'#87a960',c:type.color,w:type.light,k:'#2d4237',d:type.dark});
    if(m.type===0){c.fillStyle=type.light;c.fillRect(m.x-2,m.y-12-height+bob,2,3);}if(m.type===2){c.fillStyle=type.color;c.fillRect(m.x-7,m.y-8-height+bob,2,3);c.fillRect(m.x+6,m.y-8-height+bob,2,3);}
  }
  sprout(c,s){const bob=this.reduced?0:Math.sin(this.tick*2+s.x)*2;ellipse(c,s.x,s.y,8,4,'#19382a88');line(c,s.x,s.y,s.x,s.y-16+bob,'#b1d384',2);ellipse(c,s.x-5,s.y-13+bob,6,3,'#c0d893');ellipse(c,s.x+5,s.y-19+bob,6,3,'#9fc57e');c.fillStyle=TYPES[s.type].color;c.fillRect(s.x-3,s.y-4,6,5);if(distance(s,this.game.player)<170||this.game.mode==='title'){text(c,'+',s.x,s.y-29,12,'#d7e99d');}}
  cargo(c,o){const bob=this.reduced?0:Math.sin(this.tick*3+o.x)*2;ellipse(c,o.x,o.y,o.r+5,o.r*.42,'#213c2d77');if(o.kind==='core'){
      const glow=c.createRadialGradient(o.x,o.y-15,0,o.x,o.y-15,63);glow.addColorStop(0,'#eed58b35');glow.addColorStop(1,'#eed58b00');c.fillStyle=glow;c.fillRect(o.x-63,o.y-78,126,126);
      c.fillStyle='#907d50';c.fillRect(o.x-20,o.y-5+bob,40,8);c.fillRect(o.x-17,o.y-43+bob,34,7);c.fillStyle='#dfba6a';c.fillRect(o.x-14,o.y-38+bob,28,32);c.fillStyle='#f6de8a';c.fillRect(o.x-9,o.y-33+bob,18,23);c.fillStyle='#ffefb6';c.fillRect(o.x-5,o.y-30+bob,9,15);c.fillStyle='#a88c50';c.fillRect(o.x-17,o.y-38+bob,5,35);c.fillRect(o.x+12,o.y-38+bob,5,35);c.fillStyle='#e6cd88';c.fillRect(o.x-8,o.y-50+bob,16,7);c.fillStyle='#869656';c.fillRect(o.x-5,o.y-56+bob,10,7);
    }else{ellipse(c,o.x-7,o.y-13+bob,10,10,'#ab5e69');ellipse(c,o.x+5,o.y-15+bob,10,11,'#c67b80');ellipse(c,o.x-1,o.y-6+bob,10,10,'#db9291');c.fillStyle='#f4b1a3';c.fillRect(o.x-8,o.y-18+bob,4,4);c.fillRect(o.x+4,o.y-20+bob,4,4);line(c,o.x,o.y-18+bob,o.x+2,o.y-29+bob,'#608947',2);ellipse(c,o.x+7,o.y-29+bob,7,3,'#a5bf71');}
    const power=o.power||0;const x=o.x,y=o.y+20;const label=`${power} / ${o.need}`;const width=label.length*6+16;c.fillStyle='#18372fe6';c.fillRect(x-width/2,y-10,width,17);text(c,label,x,y+2,10,power>=o.need?'#d7e99d':'#f0d49a');if(o.kind==='core'&&!o.carrying)text(c,'LANTERN',o.x,o.y-70,8,'#ece0a8');
  }
  enemy(c,e){const t=this.tick,wiggle=this.reduced?0:Math.sin(t*10)*2;ellipse(c,e.x,e.y,e.r+9,12,'#17332988');if(e.phase==='windup'||e.phase==='bite'){const r=e.r+40;c.fillStyle=e.phase==='bite'?'#ef917860':'#ef91782c';c.strokeStyle='#f2aa86';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,r,0,6.28);c.fill();c.stroke();text(c,'!',e.x,e.y-50,17,'#ffc69b');}
    for(const side of [-1,1])for(let i=0;i<3;i++){line(c,e.x+side*14,e.y-18+i*10,e.x+side*(e.r+9),e.y-13+i*10+wiggle*(i%2?1:-1),'#342c28',4);}
    ellipse(c,e.x,e.y-15,e.r,e.r*.85,'#687949');ellipse(c,e.x-3,e.y-19,e.r-4,e.r*.68,'#8e9d58');line(c,e.x,e.y-e.r-14,e.x,e.y-2,'#607740',3);c.fillStyle='#b9c47b';c.fillRect(e.x-13,e.y-27,6,4);c.fillRect(e.x+6,e.y-23,5,4);ellipse(c,e.x,e.y-1,14,8,'#aa8b62');c.fillStyle='#e1d8a2';c.fillRect(e.x-10,e.y-8,6,6);c.fillRect(e.x+4,e.y-8,6,6);c.fillStyle='#283b31';c.fillRect(e.x-9,e.y-6,3,4);c.fillRect(e.x+5,e.y-6,3,4);
    if(e.hp<e.maxHp){c.fillStyle='#273d2b';c.fillRect(e.x-22,e.y-e.r-25,44,4);c.fillStyle='#e6a97b';c.fillRect(e.x-22,e.y-e.r-25,44*e.hp/e.maxHp,4);}
  }
  minimap(c){
    const g=this.game,w=132,h=96,x=this.w-w-18,y=this.h-h-105,scale=w/WORLD.w;c.fillStyle='#11291de8';c.fillRect(x-6,y-7,w+12,h+25);c.strokeStyle='#9cae6966';c.lineWidth=1;c.strokeRect(x-6,y-7,w+12,h+25);c.fillStyle='#415b3c';c.fillRect(x,y,w,h);c.fillStyle='#588b81';c.fillRect(x+1120*scale,y,160*scale,1000/WORLD.h*h);if(g.world.bridge.done){c.fillStyle='#d4ba7b';c.fillRect(x+1100*scale,y+610/WORLD.h*h,200*scale,80/WORLD.h*h);}
    const dot=(p,color,r=2)=>{c.fillStyle=color;c.fillRect(Math.round(x+p.x*scale-r),Math.round(y+p.y/WORLD.h*h-r),r*2,r*2);};dot(HOME,'#e6dbaa',3);for(const o of g.world.cargo.filter(o=>o.kind==='core'&&!o.delivered))dot(o,'#f6d784',3);for(const m of g.crew.filter(m=>m.state!=='lost'))dot(m,m.state==='wilt'?'#e38f85':TYPES[m.type].color,1);dot(g.player,'#fff5df',2);c.strokeStyle='#e7e3b466';c.strokeRect(x+g.camera.x*scale,y+g.camera.y/WORLD.h*h,this.w*scale,this.h/WORLD.h*h);text(c,'THE WOODS',x+w/2,y+h+12,8,'#b4c596');
  }
  location(c){const p=this.game.player;let label=p.x<1120?(p.y>1000?'FERNLOW FORD':'THE SOFT MEADOW'):(p.y<750?'GLASSWATER GROVE':'THE EMBER HOLLOW');if(distance(p,HOME)<170)label='ACORN LANDING';text(c,label,22,this.h-27,9,'#d2ddab','left');}
}
