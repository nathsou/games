import {registerCheckpoint} from '../../shared/game-checkpoint.js';
import {GameScene} from './scenes/game.js';
import {WORLDS} from './campaign.js';
import {validateLevel} from './level.js';
import {EndlessRun,playHole} from './scenes/endless.js';
import {playCustom} from './scenes/create.js';
export function installCheckpoint(app){
  registerCheckpoint('spacegolf',{
    capture(){
      const scene=app.nextScene||app.scene;if(!(scene instanceof GameScene)||scene.cfg.kind==='replay')return null;
      const run=scene.cfg.resumeRun;
      return {level:scene.level,kind:scene.cfg.kind,title:scene.cfg.title,subtitle:scene.cfg.subtitle,paletteSalt:scene.cfg.paletteSalt,S:{...scene.S,stars:Array.from(scene.S.stars)},history:scene.history.map(s=>({...s,stars:Array.from(s.stars)})),shotLog:scene.shotLog,state:scene.state,win:scene.win,
        run:run?{base:run.base,ramp:run.ramp,holes:run.holes,over:run.over,aces:run.aces,seed:scene.cfg.resumeEntry.seed,d:scene.cfg.resumeEntry.d}:null};
    },
    restore(data){
      if(!data?.level||validateLevel(data.level).length||!data.S||!Number.isFinite(data.S.ball?.x)||!Number.isFinite(data.S.ball?.y)||!Array.isArray(data.history)||!Array.isArray(data.shotLog)||!['play','win'].includes(data.state))throw Error('Invalid saved golf hole.');
      if(data.kind==='campaign'){
        let found=false;for(let wi=0;wi<WORLDS.length;wi++){const li=WORLDS[wi].levels.findIndex(level=>level.id===data.level.id);if(li>=0){app.playCampaign(wi,li);found=true;break;}}
        if(!found)throw Error('That campaign hole is unavailable.');
      }else if(data.kind==='endless'&&data.run){const run=new EndlessRun(app,data.run.base,data.run.ramp);Object.assign(run,{holes:data.run.holes,over:data.run.over,aces:data.run.aces});playHole(app,run,{seed:data.run.seed,d:data.run.d,level:data.level});}
      else if(data.kind==='custom'){const entry=app.store.data.custom.find(e=>e.level.id===data.level.id)||{name:data.level.name,level:data.level};playCustom(app,entry);}
      else throw Error('Unknown saved golf mode.');
      const scene=app.nextScene||app.scene;scene.S={...structuredClone(data.S),stars:Uint8Array.from(data.S.stars)};scene.history=data.history.map(s=>({...s,stars:Uint8Array.from(s.stars)}));scene.shotLog=structuredClone(data.shotLog);scene.state=data.state;scene.win=data.win;app.nextScene=null;app.go(scene,true);
    },
  });
}
