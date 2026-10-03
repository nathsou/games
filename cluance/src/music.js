// Original eight-bar miniatures. Melody degrees belong to each track's scale.
const score=(lines,steps)=>lines.map(line=>{
  const notes=line.split(' ').map(n=>n==='.'?null:Number(n));
  if(notes.length!==steps)throw new Error('A melody must fill its measure.');return notes;
});
const minor=[0,2,3,5,7,8,10],major=[0,2,4,5,7,9,11];
export const THEME_MUSIC={
  french:{title:'A Candle at Court',style:'Courtly waltz · plucked keys',bpm:104,steps:6,root:62,scale:minor,
    chords:[0,5,3,4,0,2,5,0],voice:'pluck',arp:'waltz',drums:'brush',
    melody:score(['4 . 5 4 2 .','3 . 4 3 1 .','2 3 4 . 6 5','4 . 2 1 0 .'],6)},
  global:{title:'Across the Atlas',style:'Wandering groove · warm mallets',bpm:92,steps:8,root:57,scale:[0,2,3,5,7,9,10],
    chords:[0,3,5,4,0,2,3,0],voice:'glass',arp:'offbeat',drums:'frame',swing:.08,
    melody:score(['0 . 2 3 . 4 . 2','3 . 5 . 4 3 . 1','5 4 . 2 . 3 4 .','2 . 1 . 0 . . .'],8)},
  greek:{title:'The Hearth of Olympus',style:'Seven-beat lyre · soft frame drum',bpm:104,steps:7,root:64,scale:minor,
    chords:[0,3,5,4,0,5,3,0],voice:'pluck',arp:'lyre',drums:'frame',
    melody:score(['0 . 2 4 . 3 .','5 4 . 2 . 1 .','3 . 4 6 . 5 4','2 . 1 . 0 . .'],7)},
  scientists:{title:'Clockwork Constellations',style:'Lydian arpeggios · glass pulses',bpm:116,steps:8,root:60,scale:[0,2,4,6,7,9,11],
    chords:[0,1,5,3,0,2,1,0],voice:'glass',arp:'clock',drums:'tick',
    melody:score(['0 2 4 6 . 4 3 .','1 . 3 5 7 . 5 3','5 4 2 . 3 6 4 .','3 . 2 1 0 . . .'],8)},
  philosophers:{title:'An Unanswered Question',style:'Five-beat meditation · mellow bells',bpm:78,steps:10,root:62,scale:[0,2,3,5,7,9,10],
    chords:[0,3,1,5,0,2,3,0],voice:'warm',arp:'sparse',drums:'none',pad:true,
    melody:score(['2 . . 4 . . 3 . 1 .','3 . . . 5 . 4 . . .','5 . 4 . . 2 . 3 . .','2 . . 1 . . 0 . . .'],10)},
  writers:{title:'Ink After Midnight',style:'Lilting six-eight · intimate keys',bpm:84,steps:6,root:57,scale:minor,
    chords:[0,5,2,4,0,3,5,0],voice:'glass',arp:'flow',drums:'brush',
    melody:score(['4 . 2 3 . 4','5 4 . 2 . 1','3 . 5 4 2 .','1 . 2 0 . .'],6)},
  singers:{title:'Velvet Microphone',style:'Syncopated pop · rounded lead',bpm:106,steps:8,root:63,scale:major,
    chords:[0,5,3,4,0,2,3,4],voice:'reed',arp:'offbeat',drums:'funk',swing:.12,
    melody:score(['4 . . 5 4 . 2 0','. 2 4 . 5 . 4 .','3 . 4 5 . 6 5 .','4 . 2 . 1 0 . .'],8)},
  actors:{title:'The Last Close-Up',style:'Noir score · slow brushed swing',bpm:86,steps:8,root:55,scale:minor,
    chords:[0,5,1,4,0,3,5,4],voice:'glass',arp:'sparse',drums:'brush',pad:true,swing:.18,
    melody:score(['4 . . . 3 . 2 .','. 5 . 4 . . 2 .','6 . 5 . 3 . . 4','2 . 1 . 0 . . .'],8)},
  cities:{title:'Windows at Blue Hour',style:'Night drive · soft synth ostinato',bpm:112,steps:8,root:64,scale:minor,
    chords:[0,5,3,4,0,2,5,4],voice:'chip',arp:'clock',drums:'tick',
    melody:score(['0 . 4 . 6 4 . 2','5 . 4 2 . 3 . 4','3 4 . 6 . 5 4 .','2 . 1 2 0 . . .'],8)},
  countries:{title:'Postcards in Motion',style:'Open-road melody · gentle percussion',bpm:98,steps:8,root:60,scale:[0,2,4,5,7,9,10],
    chords:[0,3,5,4,0,1,3,0],voice:'warm',arp:'flow',drums:'frame',pad:true,
    melody:score(['0 . 2 . 4 5 . 4','3 . 2 1 . 0 2 .','5 . 4 . 3 4 6 .','4 2 . 1 0 . . .'],8)},
  regions:{title:'Sunday on the River',style:'Musette waltz · soft reed duet',bpm:114,steps:6,root:67,scale:major,
    chords:[0,3,4,0,5,3,4,0],voice:'reed',arp:'waltz',drums:'brush',swing:.05,
    melody:score(['2 3 4 . 2 .','3 . 5 4 3 .','4 5 6 . 4 2','1 . 2 0 . .'],6)},
};
function pitch(track,degree,octave=0){return track.root+track.scale[((degree%7)+7)%7]+12*Math.floor(degree/7)+octave*12;}
const frequency=midi=>440*2**((midi-69)/12);
const waves={
  pluck:{type:'triangle',overtone:2,blend:.2,attack:.006,cutoff:2500},
  glass:{type:'sine',overtone:3,blend:.13,attack:.008,cutoff:3800},
  warm:{type:'sine',overtone:2,blend:.15,attack:.035,cutoff:1500},
  reed:{type:'triangle',overtone:2,blend:.24,attack:.024,cutoff:1800},
  chip:{type:'square',overtone:2,blend:.04,attack:.018,cutoff:1050},
};
function tone(ctx,output,midi,when,duration,voice,level,pan=0){
  const timbre=waves[voice],gain=ctx.createGain(),filter=ctx.createBiquadFilter(),position=ctx.createStereoPanner();
  filter.type='lowpass';filter.frequency.value=timbre.cutoff;position.pan.value=pan;
  gain.connect(filter);filter.connect(position);position.connect(output);
  gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(level,when+timbre.attack);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0001,level*.24),when+duration*.7);
  gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
  for(const [i,multiple] of [1,timbre.overtone].entries()){
    const oscillator=ctx.createOscillator(),blend=ctx.createGain();oscillator.type=i?'sine':timbre.type;
    oscillator.frequency.value=frequency(midi)*multiple;blend.gain.value=i?timbre.blend:1;
    oscillator.connect(blend);blend.connect(gain);oscillator.start(when);oscillator.stop(when+duration+.025);
    oscillator.onended=()=>{oscillator.disconnect();blend.disconnect();if(!i){gain.disconnect();filter.disconnect();position.disconnect();}};
  }
}
const noiseBuffers=new WeakMap();
function noise(ctx){
  if(noiseBuffers.has(ctx))return noiseBuffers.get(ctx);
  const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.16),ctx.sampleRate),data=buffer.getChannelData(0);
  let seed=4729;for(let i=0;i<data.length;i++){seed=(seed*16807)%2147483647;data[i]=seed/1073741823.5-1;}
  noiseBuffers.set(ctx,buffer);return buffer;
}
function percussion(ctx,output,when,kind,level){
  const gain=ctx.createGain();gain.connect(output);gain.gain.setValueAtTime(level,when);gain.gain.exponentialRampToValueAtTime(.0001,when+.12);
  if(kind==='kick'){
    const source=ctx.createOscillator();source.frequency.setValueAtTime(105,when);source.frequency.exponentialRampToValueAtTime(48,when+.09);
    source.connect(gain);source.start(when);source.stop(when+.14);source.onended=()=>{source.disconnect();gain.disconnect();};
  }else{
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter();source.buffer=noise(ctx);
    filter.type=kind==='hat'?'highpass':'bandpass';filter.frequency.value=kind==='hat'?5200:1450;filter.Q.value=.6;
    source.connect(filter);filter.connect(gain);source.start(when);source.stop(when+(kind==='hat'?.045:.14));
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
}
// Shared score scheduler for live playback and native offline rendering.
export function scheduleTrackStep(ctx,output,track,step,time){
  const interval=30/track.bpm,bar=Math.floor(step/track.steps)%8,beat=step%track.steps;
  const chord=track.chords[bar],when=time+(beat%2?(track.swing||0)*interval:0),melody=track.melody[bar%4],degree=melody[beat];
  if(degree!==null){
    let length=1;while(beat+length<track.steps&&melody[beat+length]===null)length++;
    const variation=bar>=4&&beat===0&&bar!==7?7:0;
    tone(ctx,output,pitch(track,degree+variation),when,interval*length*.88,track.voice,.13,-.16);
  }
  if(beat===0||(track.arp!=='waltz'&&beat===Math.ceil(track.steps/2)))tone(ctx,output,pitch(track,chord+(beat?4:0),-2),when,interval*1.8,'warm',.17,0);
  let arp;
  if(track.arp==='waltz')arp=beat===2?2:beat===4?4:null;
  else if(track.arp==='sparse')arp=beat===2?4:null;
  else if(track.arp==='offbeat')arp=beat%2?[0,2,4][Math.floor(beat/2)%3]:null;
  else if(track.arp==='lyre')arp=[0,null,2,null,4,2,null][beat];
  else if(track.arp==='clock')arp=[0,2,4,2][beat%4];
  else arp=beat%2===0?[0,2,4][Math.floor(beat/2)%3]:null;
  if(arp!==null)tone(ctx,output,pitch(track,chord+arp,-1),when,interval*1.4,track.voice,.075,.27);
  if(track.pad&&beat===0)for(const offset of [0,2,4])tone(ctx,output,pitch(track,chord+offset,-1),when,interval*track.steps*.95,'warm',.033,.12);
  if(track.drums!=='none'){
    if(beat===0)percussion(ctx,output,when,'kick',track.drums==='funk'?.13:.06);
    if(beat===Math.floor(track.steps/2))percussion(ctx,output,when,'brush',track.drums==='funk'?.06:.022);
    if(beat%2)percussion(ctx,output,when,'hat',track.drums==='tick'?.022:.013);
  }
}
export class ThemeMusic{
  constructor(context,destination){this.context=context;this.destination=destination;this.enabled=false;this.theme='french';this.volume=.22;this.timer=null;this.channel=null;this.duckedUntil=0;}
  configure({theme,enabled,volume}){
    const next=THEME_MUSIC[theme]?theme:'french',changed=next!==this.theme;
    const nextVolume=Math.max(0,Math.min(.7,Number(volume)||0)),volumeChanged=nextVolume!==this.volume;
    this.theme=next;this.enabled=Boolean(enabled);this.volume=nextVolume;
    if(!this.enabled||document.hidden||this.context.state!=='running'){this.stop();return;}
    if(changed||!this.timer){this.stop();this.start();}
    else if(volumeChanged){
      const now=this.context.currentTime,ducked=now<this.duckedUntil;
      this.channel.gain.cancelScheduledValues(now);this.channel.gain.setTargetAtTime(this.volume*(ducked?.2:1),now,.08);
      if(ducked)this.channel.gain.setTargetAtTime(this.volume,this.duckedUntil,.3);
    }
  }
  start(){
    const ctx=this.context;this.channel=ctx.createGain();this.channel.connect(this.destination);
    this.channel.gain.setValueAtTime(0,ctx.currentTime);this.channel.gain.linearRampToValueAtTime(this.volume,ctx.currentTime+.4);
    this.step=0;this.next=ctx.currentTime+.06;
    const schedule=()=>{
      // Resume stalled tabs at a measure boundary instead of bursting overdue notes.
      if(this.next<ctx.currentTime-.2){this.step=Math.ceil(this.step/THEME_MUSIC[this.theme].steps)*THEME_MUSIC[this.theme].steps;this.next=ctx.currentTime+.04;}
      while(this.next<ctx.currentTime+.16){scheduleTrackStep(ctx,this.channel,THEME_MUSIC[this.theme],this.step++,this.next);this.next+=30/THEME_MUSIC[this.theme].bpm;}
    };
    schedule();this.timer=setInterval(schedule,25);
  }
  stop(){
    clearInterval(this.timer);this.timer=null;this.duckedUntil=0;
    if(this.channel){const retiring=this.channel,now=this.context.currentTime;retiring.gain.cancelScheduledValues(now);retiring.gain.setTargetAtTime(0,now,.045);setTimeout(()=>retiring.disconnect(),400);this.channel=null;}
  }
  duck(seconds=2.4){
    if(!this.channel)return;const now=this.context.currentTime;this.channel.gain.cancelScheduledValues(now);
    this.duckedUntil=now+seconds;this.channel.gain.setTargetAtTime(this.volume*.2,now,.03);this.channel.gain.setTargetAtTime(this.volume,this.duckedUntil,.3);
  }
}
