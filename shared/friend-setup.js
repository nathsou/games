import {optionsFor} from '../flip-it/src/rules.js';
import {DECKS} from '../cluance/src/decks.js';

export const SETUP_GAMES = Object.freeze({collection:'Just a room', 'flip-it':'Flip It', cluance:'Cluance', midnight:'Midnight Table'});
const MIDNIGHT = {backhand:'Backhand', closing:'Closing Time', heist:'Heist Night'};
export function validateGameSetup(game, value = {}) {
  if (game === 'collection') return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Choose valid game settings.');
  if (game === 'flip-it') {
    const options = optionsFor(value.options);
    const team = value.team ?? false, aiPlayers = value.aiPlayers ?? [];
    if (typeof team !== 'boolean' || !Array.isArray(aiPlayers) || aiPlayers.length > (team ? 4 : 3) || team && !aiPlayers.length || aiPlayers.some(kind => !['dealer','model'].includes(kind))) throw new Error('Choose the players for this table.');
    return {options, team, aiPlayers:[...aiPlayers]};
  }
  if (game === 'cluance') {
    const {role, options} = value;
    if (!['giver','guesser'].includes(role) || !options || !Object.hasOwn(DECKS,options.theme) || !Object.hasOwn(DECKS,options.clueTheme) || !['classic','fixed'].includes(options.variant)) throw new Error('Choose valid Cluance decks, role and hand.');
    return {role, options:{theme:options.theme, clueTheme:options.clueTheme, variant:options.variant}};
  }
  if (game === 'midnight') {
    const {type = 'backhand', team = false, opponent = 'dealer'} = value;
    if (!Object.hasOwn(MIDNIGHT,type) || typeof team !== 'boolean' || !['dealer','model'].includes(opponent)) throw new Error('Choose valid Midnight Table settings.');
    return {type,team,opponent};
  }
  throw new Error('Choose a multiplayer game.');
}
function saved(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } }
export function defaultGameSetup(game) {
  try {
    if (game === 'flip-it') {
      const prefs=saved('flip-it.preferences'),team=Boolean(prefs.onlineTeam),count=Math.min(team?4:3,Math.max(team?1:0,prefs.onlineAiCount||0));
      return validateGameSetup(game,{options:prefs.options,team,aiPlayers:Array.from({length:count},(_,i)=>prefs.onlineAiKinds?.[i]==='model'?'model':'dealer')});
    }
    if (game === 'cluance') {
      const setup=saved('cluance-v1:setup');
      return validateGameSetup(game,{role:setup.mode==='peer-host'?'giver':'guesser',options:{theme:setup.theme||'french',clueTheme:!setup.clueTheme||setup.clueTheme==='same'?setup.theme||'french':setup.clueTheme,variant:setup.variant||'classic'}});
    }
    if (game === 'midnight') return validateGameSetup(game,{type:'backhand',team:false});
  } catch { /* Invalid saved preferences do not block an invitation. */ }
  if (game === 'flip-it') return validateGameSetup(game,{});
  if (game === 'cluance') return validateGameSetup(game,{role:'guesser',options:{theme:'french',clueTheme:'french',variant:'classic'}});
  return validateGameSetup(game,{});
}
export function setupSummary(game, setup, host = true) {
  if (game === 'collection') return 'A room for chatting and choosing games together.';
  const value=validateGameSetup(game,setup);
  if (game === 'flip-it') return `${value.options.quickTurns?'One':'Two'} actions per turn · ${value.options.compactDeck?'24':'40'} cards · first to ${value.options.target} · ${value.options.lastChance?'last chance':'immediate win'} · ${value.team?'shared hand': 'opponents'}${value.aiPlayers.length?' · '+value.aiPlayers.length+' bot / AI players':''}`;
  if (game === 'cluance') return `${DECKS[value.options.theme].name} · clues from ${DECKS[value.options.clueTheme].name} · ${value.options.variant==='fixed'?'fixed five':'draw replacements'} · you ${((value.role==='giver')===host)?'give clues':'guess'}`;
  return `${MIDNIGHT[value.type]} · ${value.team?'shared hand against '+(value.opponent==='model'?'AI':'the dealer'):'play against each other'}`;
}
// All choices are public game settings. Credentials remain in each game's settings.
export function renderGameSetup(container, game, initial = defaultGameSetup(game)) {
  const setup=validateGameSetup(game,initial), prefix=container.id;
  container.replaceChildren();
  const fields={};
  function select(key,label,choices,current) {
    const row=document.createElement('label');row.className='setup-field';row.htmlFor=prefix+'-'+key;row.append(document.createTextNode(label));
    const input=document.createElement('select');input.id=row.htmlFor;
    for(const [value,title] of Object.entries(choices))input.append(new Option(title,value));
    input.value=String(current);row.append(input);container.append(row);fields[key]=input;return input;
  }
  function checkbox(key,label,current) {
    const row=document.createElement('label');row.className='setup-check';
    const input=document.createElement('input');input.type='checkbox';input.id=prefix+'-'+key;input.checked=current;row.append(input,document.createTextNode(label));container.append(row);fields[key]=input;return input;
  }
  if (game === 'cluance') {
    select('role','Your role',{guesser:'Guess the secret',giver:'Give the clues'},setup.role);
    const decks=Object.fromEntries(Object.entries(DECKS).map(([id,deck])=>[id,deck.name]));
    select('theme','Board deck',decks,setup.options.theme);
    select('clueTheme','Clue deck',{same:'Same as the board',...decks},setup.options.clueTheme===setup.options.theme?'same':setup.options.clueTheme);
    select('variant','Clue giver’s hand',{classic:'Draw a replacement after each clue',fixed:'Keep the initial five cards'},setup.options.variant);
    return ()=>validateGameSetup(game,{role:fields.role.value,options:{theme:fields.theme.value,clueTheme:fields.clueTheme.value==='same'?fields.theme.value:fields.clueTheme.value,variant:fields.variant.value}});
  }
  if (game === 'flip-it') {
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
    const note=document.createElement('p');note.className='setup-note';note.textContent='AI players use the room creator’s provider settings. Keys are never included in an invite.';container.append(note);
    return ()=>validateGameSetup(game,{options:{target:Number(fields.target.value),...Object.fromEntries(['quickTurns','compactDeck','lastChance'].map(key=>[key,fields[key].checked]))},team:fields.team.checked,aiPlayers:[...kinds.querySelectorAll('select')].map(input=>input.value)});
  }
  if (game === 'midnight') {
    select('type','Game',MIDNIGHT,setup.type);checkbox('team','Share a hand against the dealer / AI',setup.team);
    select('opponent','Team opponent',{dealer:'Dealer · no API calls',model:'AI · your provider settings'},setup.opponent);
    return ()=>validateGameSetup(game,{type:fields.type.value,team:fields.team.checked,opponent:fields.opponent.value});
  }
  const note=document.createElement('p');note.className='setup-note';note.textContent='Connect first, then choose a game together. Other games can be shared with virtual cursors.';container.append(note);
  return ()=>({});
}
