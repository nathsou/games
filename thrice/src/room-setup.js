import {MODES} from './rules.js';
import {DIFFICULTIES} from './bot.js';
import {THEMES} from './themes.js';

export function validateSetup(value) {
  const {mode = 'simple', bots = 1, difficulty = 'normal', memoryAid = false, theme = 'bakery'} = value;
  if (!Object.hasOwn(MODES, mode) || !Number.isInteger(bots) || bots < 0 || bots > 4 || !Object.hasOwn(DIFFICULTIES, difficulty) || typeof memoryAid !== 'boolean' || !Object.hasOwn(THEMES, theme)) throw new Error('Choose valid Thrice settings.');
  return {mode, bots, difficulty, memoryAid, theme};
}
export default {
  validate: validateSetup,
  saved: read => read('thrice.preferences').room || {},
  fallback: {},
  summary: value => `${MODES[value.mode]} · ${value.bots ? value.bots + ' ' + DIFFICULTIES[value.difficulty].toLowerCase() + ' bot' + (value.bots > 1 ? 's' : '') : 'duel, no bots'} · ${THEMES[value.theme].name} cards${value.memoryAid ? ' · memory aid' : ''}`,
  render({select, checkbox, note, fields}, setup) {
    select('mode', 'Win with', {simple: 'Simple · three trios or the 7s', spicy: 'Spicy · two linked trios or the 7s'}, setup.mode);
    select('bots', 'Bots at the table', {0: 'None · two-player duel', 1: '1', 2: '2', 3: '3', 4: '4'}, setup.bots);
    select('difficulty', 'Bot memory', DIFFICULTIES, setup.difficulty);
    select('theme', 'Cards', Object.fromEntries(Object.entries(THEMES).map(([id, theme]) => [id, theme.name])), setup.theme);
    checkbox('memoryAid', 'Memory aid · list every card revealed so far', setup.memoryAid);
    note('Bots play in the room from what anyone at the table could remember. No API calls.');
    return () => ({mode: fields.mode.value, bots: Number(fields.bots.value), difficulty: fields.difficulty.value, theme: fields.theme.value, memoryAid: fields.memoryAid.checked});
  },
};
