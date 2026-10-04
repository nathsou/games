// Every sound is synthesized locally. Audio starts only after a player gesture.
export class Audio {
  constructor(){this.ctx=null;this.muted=false;this.step=0;this.next=0;this.active=false;}
  unlock(){
    if(!this.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=.22;this.master.connect(this.ctx.destination);}
    this.ctx.resume().catch(()=>{});
  }
  tone(freq,duration=.15,type='sine',volume=.12,delay=0,slide=1){
    if(!this.ctx||this.muted||!this.active)return;
    const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*slide),t+duration);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.02);
  }
  play(name){
    if(name==='whistle'){this.tone(660,.22,'sine',.17,0,1.5);this.tone(990,.16,'sine',.07,.08,1.16);}
    if(name==='throw')this.tone(420,.09,'triangle',.1,0,1.7);
    if(name==='pluck'){this.tone(523,.15,'triangle',.2);this.tone(784,.18,'sine',.13,.08);}
    if(name==='deliver'||name==='win')[523,659,784,1047].forEach((f,i)=>this.tone(f,.4,'triangle',.16,i*.11));
    if(name==='hit')this.tone(110,.09,'sawtooth',.08,0,.5);
    if(name==='hurt')this.tone(210,.2,'triangle',.16,0,.5);
    if(name==='bridge')[330,440,660].forEach((f,i)=>this.tone(f,.3,'triangle',.12,i*.12));
  }
  setMuted(value){this.muted=value;if(this.master)this.master.gain.setTargetAtTime(value?0:.22,this.ctx.currentTime,.02);}
  setActive(value){this.active=value;if(this.master)this.master.gain.setTargetAtTime(value&&!this.muted?.22:0,this.ctx.currentTime,.02);}
  update(){
    if(!this.ctx||!this.active||this.muted)return;
    const now=this.ctx.currentTime;if(now<this.next)return;this.next=now+.4;
    const melody=[0,7,12,7,4,7,9,7,0,7,12,14,12,7,4,2,5,9,12,9,5,9,7,4,2,7,11,7,2,7,4,7];
    const i=this.step++%32;this.tone(261.63*Math.pow(2,melody[i]/12),.48,'sine',.055);
    if(i%4===0)this.tone(65.41*Math.pow(2,[0,5,2,0][Math.floor(i/8)]/12),1.3,'triangle',.065);
  }
}
