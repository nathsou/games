import {ThemeMusic} from './music.js';
let context,music,master,effects,unlocked=false;
let preferences={theme:'french',enabled:false,volume:.22,muted:false};
function initialize(){
  if(context)return true;
  const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return false;
  context=new Audio();master=context.createGain();effects=context.createGain();
  const compressor=context.createDynamicsCompressor();compressor.threshold.value=-14;compressor.ratio.value=4;
  master.connect(compressor);compressor.connect(context.destination);effects.connect(master);
  music=new ThemeMusic(context,master);return true;
}
export async function unlockAudio(){
  try{
    if(!initialize())return;await context.resume();unlocked=context.state==='running';
    master.gain.setTargetAtTime(preferences.muted?0:1,context.currentTime,.025);
    music.configure({...preferences,enabled:preferences.enabled&&!preferences.muted});
  }catch{ /* A browser may require another user gesture to allow audio. */ }
}
export function setMusic(next){
  preferences={...preferences,...next};if(!context||!unlocked)return;
  master.gain.setTargetAtTime(preferences.muted?0:1,context.currentTime,.025);
  music.configure({...preferences,enabled:preferences.enabled&&!preferences.muted});
}
document.addEventListener('visibilitychange',()=>{
  if(!music)return;if(document.hidden)music.stop();else if(unlocked)music.configure({...preferences,enabled:preferences.enabled&&!preferences.muted});
});
export function chime(kind,enabled){
  if(!enabled||!unlocked||!context||context.state!=='running')return;
  try{
    const win=kind==='win',loss=kind==='loss',start=context.currentTime+.025;
    if(win||loss)music.duck(win?3:2.8);
    const notes=win?[72,76,79,84,79,84,88]:loss?[64,62,60,59,57]:kind==='clue'?[69,76]:[72];
    notes.forEach((midi,i)=>{
      const oscillator=context.createOscillator(),gain=context.createGain(),when=start+i*(win?.16:loss?.23:.1);
      oscillator.type=win?'triangle':'sine';oscillator.frequency.value=440*2**((midi-69)/12);
      gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(win?.09:.06,when+.008);
      const length=win?.4:loss?.6:.16;gain.gain.exponentialRampToValueAtTime(.0001,when+length);
      oscillator.connect(gain);gain.connect(effects);oscillator.start(when);oscillator.stop(when+length+.02);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    });
    if(win)for(const midi of [60,64,67,72]){
      const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type='triangle';oscillator.frequency.value=440*2**((midi-69)/12);
      gain.gain.setValueAtTime(.035,start+1.1);gain.gain.exponentialRampToValueAtTime(.0001,start+2.5);
      oscillator.connect(gain);gain.connect(effects);oscillator.start(start+1.1);oscillator.stop(start+2.55);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    }
  }catch{ /* Audio is optional. */ }
}
