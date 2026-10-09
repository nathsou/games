import {ROOM_GAMES} from './room-games.js';
import flipIt from '../flip-it/src/room-setup.js';
import cluance from '../cluance/src/room-setup.js';
import midnight from '../midnight/src/room-setup.js';
import thrice from '../thrice/src/room-setup.js';

// Each room game describes its public settings: validation (shared by the page
// and the room), saved preferences, a one-line summary and the setup form.
const SETUPS = {'flip-it': flipIt, cluance, midnight, thrice};
export const SETUP_GAMES = Object.freeze({collection:'Just a room', ...ROOM_GAMES});
export function validateGameSetup(game, value = {}) {
  if (game === 'collection') return {};
  if (!Object.hasOwn(SETUPS, game)) throw new Error('Choose a multiplayer game.');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Choose valid game settings.');
  return SETUPS[game].validate(value);
}
function saved(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } }
export function defaultGameSetup(game) {
  if (game === 'collection') return {};
  try { return validateGameSetup(game, SETUPS[game].saved?.(saved) ?? SETUPS[game].fallback); }
  catch { /* Invalid saved preferences do not block an invitation. */ }
  return validateGameSetup(game, SETUPS[game].fallback);
}
export function setupSummary(game, setup, host = true) {
  if (game === 'collection') return 'A room for chatting and choosing games together.';
  return SETUPS[game].summary(validateGameSetup(game, setup), host);
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
  function note(text) { const p=document.createElement('p');p.className='setup-note';p.textContent=text;container.append(p);return p; }
  if (game === 'collection') {
    note('Connect first, then choose a game together. Other games can be shared with virtual cursors.');
    return ()=>({});
  }
  const read=SETUPS[game].render({select,checkbox,note,fields,container,prefix},setup);
  return ()=>validateGameSetup(game,read());
}
