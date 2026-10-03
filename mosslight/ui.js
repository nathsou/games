import {TYPES, distance} from './world.js';

const C={ink:'#14251ff2',edge:'#87966366',cream:'#f0edce',muted:'#b3c0a3',leaf:'#c9df93'};
export const formatTime=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

// All visible interface elements are painted into the game, with one hit map
// shared by mouse, touch, and keyboard navigation. No DOM overlays are used.
export class UI {
  constructor(game,canvas){
    this.game=game;this.canvas=canvas;this.buttons=[];this.focus=-1;this.hover=null;
    this.notice='';this.guide=false;this.guidePage=0;this.guideResume=false;this.muted=false;this.fullscreen=false;this.best=null;
    this.touch=matchMedia('(pointer: coarse)').matches;
    try{this.best=JSON.parse(localStorage.getItem('mosslight-best')||'null');}catch{/* Storage is optional. */}
  }
  text(c,label,x,y,size=12,color=C.cream,align='left',family='monospace'){
    c.font=`${size}px ${family}`;c.fillStyle=color;c.textAlign=align;c.fillText(label,x,y);
  }
  wrap(c,label,x,y,width,size=13,color=C.muted,line=22){
    c.font=`${size}px sans-serif`;c.fillStyle=color;c.textAlign='left';const words=label.split(' ');let row='';
    for(const word of words){const next=row?row+' '+word:word;if(c.measureText(next).width>width&&row){c.fillText(row,x,y);y+=line;row=word;}else row=next;}
    c.fillText(row,x,y);return y+line;
  }
  panel(c,x,y,w,h,color=C.ink){c.fillStyle=color;c.fillRect(x,y,w,h);c.strokeStyle=C.edge;c.lineWidth=1;c.strokeRect(x+.5,y+.5,w-1,h-1);}
  button(c,id,label,x,y,w,h,primary=false,sub=''){
    this.buttons.push({id,x,y,w,h,label});const focus=this.hover===id||this.focus===this.buttons.length-1;
    c.fillStyle=primary?(focus?'#e3efb2':C.leaf):(focus?'#446044':C.ink);c.fillRect(x,y,w,h);
    c.strokeStyle=primary?'#f0efbb88':focus?C.leaf:C.edge;c.lineWidth=1;c.strokeRect(x+.5,y+.5,w-1,h-1);
    this.text(c,label,x+16,y+h/2+(sub?-2:4),13,primary?'#233b29':C.cream,'left','sans-serif');
    if(sub)this.text(c,sub,x+16,y+h/2+16,9,primary?'#4c663d':C.muted);
    if(w>180)this.text(c,'↗',x+w-22,y+h/2+5,20,primary?'#233b29':C.leaf,'center','sans-serif');
  }
  hit(x,y){return this.buttons.find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);}
  draw(c,w,h){
    this.buttons=[];
    if(this.guide){this.fieldGuide(c,w,h);return;}
    if(this.game.mode==='title'){this.title(c,w,h);return;}
    this.hud(c,w,h);
    if(this.game.mode==='paused')this.pause(c,w,h);
    if(this.game.mode==='won'||this.game.mode==='ended')this.end(c,w,h);
  }
  title(c,w,h){
    const compact=w<720,x=compact?36:Math.max(65,w*.065),y=Math.max(120,h*.21),width=Math.min(420,w-2*x),scale=compact?.85:1;
    const shade=c.createLinearGradient(0,0,w,0);shade.addColorStop(0,'#101e20f5');shade.addColorStop(.52,'#101e20dc');shade.addColorStop(1,'#101e2038');c.fillStyle=shade;c.fillRect(0,0,w,h);
    this.text(c,'mosslight✳',x,57,27,C.cream,'left','sans-serif');this.text(c,'A SMALL WOODLAND ADVENTURE',x,79,9,C.muted);
    this.text(c,'LITTLE FRIENDS. BIG ADVENTURE.',x,y,10,C.leaf);
    this.text(c,'The woods are',x,y+69*scale,57*scale,C.cream,'left','sans-serif');this.text(c,'full of wonder.',x,y+129*scale,57*scale,C.leaf,'left','Georgia');
    const after=this.wrap(c,'Your ship has gone dark. Gather a leafy crew, recover three lost lanterns, and find your way home.',x,y+173*scale,width,15,C.muted,25);
    this.button(c,'start','Venture into the woods',x,after+19,Math.min(310,width),55,true);
    this.button(c,'cozy','Take your time',x,after+85,Math.min(310,width),55,false,'A relaxed expedition · no dusk timer');
    const foot=after+168;this.text(c,'CLICK',x,foot,10,C.cream);this.text(c,'move / send crew',x,foot+18,10,C.muted);this.text(c,'RIGHT CLICK / Q',x+175,foot,10,C.cream);this.text(c,'whistle friends back',x+175,foot+18,10,C.muted);
    if(this.best&&Number.isFinite(this.best.time))this.text(c,`QUICKEST EXPEDITION · ${formatTime(this.best.time)}`,x,foot+47,10,C.leaf);
    this.button(c,'guide','?',w-124,22,40,36);this.button(c,'fullscreen',this.fullscreen?'↙':'⛶',w-74,22,50,36);
    this.text(c,'F · FULLSCREEN',w-26,h-23,9,C.muted,'right');this.text(c,'WASD · MOVE    TAB / ENTER · MENUS',x,h-23,9,C.muted);
  }
  hud(c,w,h){
    const g=this.game,small=w<720;
    this.panel(c,20,20,small?181:210,89);this.text(c,'BRING THE LIGHT HOME',34,41,9,C.leaf);this.text(c,`${g.recovered} / 3`,34,72,26,C.cream);this.text(c,'lanterns',139,71,11,C.muted,'left','sans-serif');
    for(let i=0;i<3;i++){c.fillStyle=i<g.recovered?'#f1d988':'#5e704a';c.fillRect(34+i*40,89,33,3);}
    const bx=w-72,clockX=w-(small?175:205);this.panel(c,clockX,20,small?93:115,89);this.text(c,g.cozy?'TAKE YOUR TIME':'UNTIL DUSK',clockX+(small?46:57),40,8,C.muted,'center');
    this.text(c,g.cozy?'∞':formatTime(Math.max(0,g.dayLength-g.time)),clockX+(small?46:57),71,24,!g.cozy&&g.dayLength-g.time<60?'#f5a481':C.cream,'center');
    c.fillStyle='#596b46';c.fillRect(clockX+12,89,small?69:91,3);c.fillStyle=C.leaf;c.fillRect(clockX+12,89,(small?69:91)*(g.cozy?1:Math.max(0,1-g.time/g.dayLength)),3);
    this.button(c,'pause','Ⅱ',bx,20,48,35);this.button(c,'fullscreen',this.fullscreen?'↙':'⛶',bx,65,48,35);this.button(c,'guide','?',bx,110,48,35);this.button(c,'sound',this.muted?'♪̸':'♫',bx,155,48,35);
    const active=g.crew.filter(m=>m.state!=='lost'),barWidth=Math.min(660,w-32),barX=(w-barWidth)/2,barY=h-86,unit=(barWidth-70)/4;
    this.panel(c,barX,barY,barWidth,65);
    ['all',0,1,2].forEach((type,i)=>{
      const x=barX+5+i*unit,selected=g.selected===type;
      this.buttons.push({id:'select-'+type,x,y:barY+5,w:unit-4,h:55,label:type==='all'?'Everyone':TYPES[type].name});
      if(selected||this.focus===this.buttons.length-1||this.hover==='select-'+type){c.fillStyle='#c9df931f';c.fillRect(x,barY+5,unit-4,55);c.strokeStyle='#c9df9380';c.strokeRect(x+.5,barY+5.5,unit-5,54);}
      const color=type==='all'?C.leaf:TYPES[type].color;
      this.text(c,type==='all'?'✳':'♠',x+14,barY+36,24,color);this.text(c,type==='all'?'Everyone':TYPES[type].name,x+34,barY+26,small?10:12,C.cream,'left','sans-serif');
      this.text(c,type==='all'?'4 · all crew':`${i} · ${['fighters','swimmers','2× carry'][type]}`,x+34,barY+44,small?7:8,C.muted);
      this.text(c,String(type==='all'?active.length:active.filter(m=>m.type===type).length),x+unit-15,barY+37,16,C.cream,'right');
    });
    this.text(c,String(g.crew.filter(m=>m.state==='follow').length),barX+barWidth-34,barY+29,21,C.cream,'center');this.text(c,'with you',barX+barWidth-34,barY+45,8,C.muted,'center');
    if(this.notice&&g.noticeTime>0){const width=Math.min(440,w-40),x=(w-width)/2,y=small?123:22;c.fillStyle='#eeefd3';const rows=Math.ceil(this.notice.length/(width/6.4));c.fillRect(x,y,width,rows*18+22);this.wrap(c,this.notice,x+15,y+23,width-30,12,'#2b432d',18);}
    const target=g.pointer.active?g.getTarget(g.pointer,20):null;
    if(target&&distance(target,g.player)<430){let hint='';if(target.kind==='sprout')hint=`${TYPES[target.type].name} sprout · walk close to recruit`;if(target.kind==='enemy')hint='Mossback beetle · click to attack · Embers hit hardest';if(target.kind==='core'||target.kind==='berry')hint=`${target.name} · ${target.power||0}/${target.need} carrying`;if(target.kind==='bridge')hint='Fallen-log bridge · click to assign builders';if(hint){const width=Math.min(w-40,hint.length*6.3+26);this.panel(c,(w-width)/2,h-124,width,25);this.text(c,hint,w/2,h-107,10,C.cream,'center');}}
    if(this.touch){this.button(c,'work','Send crew',20,h-139,112,38);this.button(c,'whistle','Whistle',142,h-139,100,38);}
    else this.text(c,'CLICK · MOVE / WORK    RMB / Q · WHISTLE    E · NEARBY WORK',20,h-102,8,'#bfcca377');
  }
  scrim(c,w,h){c.fillStyle='#0c1c1bd9';c.fillRect(0,0,w,h);}
  pause(c,w,h){
    this.scrim(c,w,h);this.buttons=[];const pw=Math.min(410,w-44),x=(w-pw)/2,y=Math.max(25,(h-350)/2);this.panel(c,x,y,pw,350);
    this.text(c,'A MOMENT IN THE MOSS',x+30,y+40,10,C.leaf);this.text(c,'Take a breather.',x+30,y+96,36,C.cream,'left','Georgia');this.text(c,'The woods can wait.',x+30,y+130,14,C.muted,'left','sans-serif');
    this.button(c,'resume','Keep exploring',x+30,y+159,pw-60,49,true);this.button(c,'restart','Start a fresh expedition',x+30,y+222,pw-60,43);this.button(c,'title','Return to the clearing',x+30,y+280,pw-60,43);
  }
  end(c,w,h){
    this.scrim(c,w,h);this.buttons=[];const won=this.game.mode==='won',pw=Math.min(460,w-44),x=(w-pw)/2,y=Math.max(20,(h-465)/2);this.panel(c,x,y,pw,465);this.text(c,won?'ALL THREE LANTERNS RESTORED':'THE WOODS HAVE FALLEN ASLEEP',x+30,y+39,9,C.leaf);
    this.text(c,won?'A little light':'There’s always',x+30,y+99,39,C.cream,'left','Georgia');this.text(c,won?'goes a long way.':'another morning.',x+30,y+145,39,C.cream,'left','Georgia');
    this.wrap(c,won?'The Acorn glows again. A pocketful of brave little friends made a very big difference.':'Your crew tucked in safely for the night. Try a fresh expedition, or explore without a deadline.',x+30,y+184,pw-60,14,C.muted,23);
    const vals=[`${this.game.recovered}/3`,formatTime(this.game.time),String(this.game.crew.filter(m=>m.state!=='lost').length)],labels=['lanterns home','explored','little friends'];for(let i=0;i<3;i++){const sx=x+30+i*(pw-60)/3;this.text(c,vals[i],sx,y+270,25,C.cream);this.text(c,labels[i],sx,y+289,9,C.muted);}
    this.button(c,'again','One more adventure',x+30,y+318,pw-60,49,true);this.button(c,'cozy','Explore without a timer',x+30,y+382,pw-60,47);this.button(c,'fullscreen',this.fullscreen?'↙':'⛶',w-74,22,50,36);
  }
  fieldGuide(c,w,h){
    this.scrim(c,w,h);const pw=Math.min(650,w-34),ph=Math.min(h-28,625),x=(w-pw)/2,y=(h-ph)/2;this.panel(c,x,y,pw,ph);
    const size=ph<520?11:13,line=ph<520?16:21;
    this.text(c,'THE CAPTAIN’S FIELD GUIDE',x+26,y+32,10,C.leaf);this.text(c,this.guidePage?'Small but mighty.':'Leave no leaf behind.',x+26,y+78,31,C.cream,'left','Georgia');
    let row=this.wrap(c,this.guidePage?'Three kinds of friend. Three lanterns to recover. A whole little world to explore.':'Recover all three lanterns. Crews carry them home automatically. Deliver berries to grow more friends at the ship.',x+26,y+109,pw-52,size,C.muted,line)+18;
    const entries=this.guidePage?[['EMBER','Brave red friends. Fight twice as hard, and pass through ember patches unharmed.'],['TIDE','Blue friends can swim across the stream. A team made entirely of Tides can carry cargo across water.'],['HONEY','Golden friends count as two carriers. Perfect for heavy lanterns and small hauling teams.'],['GROW','Walk close to sprouts to recruit. Whistle new friends at camp. If only a few survive, the ship grows reinforcements.'],['RESCUE','Red rings warn of bites. Whistle wilted friends before their glow fades. Build the bridge or use the southern ford.']]:[['MOVE','WASD / arrows, or click ground. Shift to sprint. Click the map to travel farther.'],['SEND','Click a task; E works nearby; Space sends toward your pointer. Shift + click throws one; hold to keep throwing.'],['WHISTLE','Hold right click around the pointer, or hold Q around you. Recalls workers and revives wilted friends.'],['SELECT','1 Ember · 2 Tide · 3 Honey · 4 Everyone. Mouse wheel or Z / X cycles through your crew.'],['REST','Esc / P pauses. M toggles sound. F toggles fullscreen. Switching tabs pauses the expedition.']];
    for(const [label,copy] of entries){this.text(c,label,x+26,row,9,C.leaf);row=this.wrap(c,copy,x+104,row,pw-130,size,C.muted,line)+18;}
    this.button(c,this.guidePage?'guide-prev':'guide-next',this.guidePage?'← Controls':'Crew & tactics →',x+26,y+ph-65,150,43);this.button(c,'close-guide','Back to the woods',x+188,y+ph-65,pw-214,43,true);
  }
}
