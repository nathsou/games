import {assertState,playerView,optionsFor} from './rules.js';
import {validateView} from './session.js';
export function validateCheckpoint(data) {
  if(!data||!['solo','local','online'].includes(data.mode)||!Number.isInteger(data.seat)||data.seat<0||data.seat>4)throw new Error('Invalid saved table.');
  if(data.state){assertState(data.state);optionsFor(data.state.options);validateView(playerView(data.state,data.seat),data.seat);}
  else if(data.mode==='online')validateView(data.view,data.team?0:data.seat);
  else throw new Error('No saved game state.');
  if(!Array.isArray(data.controllers)||data.controllers.length<2||data.controllers.length>5||data.controllers.some(kind=>!['human','dealer','model'].includes(kind)))throw new Error('Invalid saved players.');
  return data;
}
