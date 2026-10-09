import {optionsFor} from './rules.js';

// Room settings for Flip It, validated identically by the page and the room.
export default {
  validate(value) {
    const options = optionsFor(value.options);
    const team = value.team ?? false, aiPlayers = value.aiPlayers ?? [];
    if (typeof team !== 'boolean' || !Array.isArray(aiPlayers) || aiPlayers.length > (team ? 4 : 3) || team && !aiPlayers.length || aiPlayers.some(kind => !['dealer','model'].includes(kind))) throw new Error('Choose the players for this table.');
    return {options, team, aiPlayers:[...aiPlayers]};
  },
  saved(read) {
    const prefs=read('flip-it.preferences'),team=Boolean(prefs.onlineTeam),count=Math.min(team?4:3,Math.max(team?1:0,prefs.onlineAiCount||0));
    return {options:prefs.options,team,aiPlayers:Array.from({length:count},(_,i)=>prefs.onlineAiKinds?.[i]==='model'?'model':'dealer')};
  },
  fallback: {},
  summary: value => `${value.options.quickTurns?'One action':'Two actions'} per turn · ${value.options.compactDeck?'24':'40'} cards · first to ${value.options.target} · ${value.options.lastChance?'last chance':'immediate win'} · ${value.team?'shared hand': 'opponents'}${value.aiPlayers.length?' · '+value.aiPlayers.length+' bot / AI players':''}`,
  render(form, setup) {
    const {select, checkbox, fields, container, prefix} = form;
    select('target','Rounds needed to win',{1:'1 · single round',2:'2',3:'3',4:'4',5:'5'},setup.options.target);
    checkbox('quickTurns','One action per turn',setup.options.quickTurns);
    checkbox('compactDeck','Compact deck · 24 cards',setup.options.compactDeck);
    checkbox('lastChance','Give other players a last-chance reply',setup.options.lastChance);
    checkbox('team','Share a hand against bots / AI',setup.team);
    const count=select('count','Extra bot / AI players',Object.fromEntries([0,1,2,3,4].map(n=>[n,String(n)])),setup.aiPlayers.length),kinds=document.createElement('div');container.append(kinds);
    let players=setup.aiPlayers.slice();
    function updatePlayers() {
      players=[...kinds.querySelectorAll('select')].map(input=>input.value).concat(players.slice(kinds.children.length));
      const minimum=fields.team.checked?1:0,maximum=fields.team.checked?4:3;
      for(const option of count.options)option.disabled=Number(option.value)<minimum||Number(option.value)>maximum;
      count.value=String(Math.max(minimum,Math.min(maximum,Number(count.value))));
      kinds.replaceChildren();
      for(let i=0;i<Number(count.value);i++) {
        const row=document.createElement('label');row.className='setup-field';row.textContent='Extra player '+(i+1);
        const input=document.createElement('select');input.id=prefix+'-player-'+i;row.htmlFor=input.id;input.append(new Option('Bot · no API calls','dealer'),new Option('AI · your provider settings','model'));input.value=players[i]||'dealer';row.append(input);kinds.append(row);
      }
    }
    count.onchange=fields.team.onchange=updatePlayers;updatePlayers();
    form.note('AI players use the room creator’s provider settings. Keys are never included in an invite.');
    return ()=>({options:{target:Number(fields.target.value),...Object.fromEntries(['quickTurns','compactDeck','lastChance'].map(key=>[key,fields[key].checked]))},team:fields.team.checked,aiPlayers:[...kinds.querySelectorAll('select')].map(input=>input.value)});
  },
};
