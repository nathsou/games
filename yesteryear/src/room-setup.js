import {MODES} from './rules.js';
import {DIFFICULTIES} from './bot.js';
import {THEMES} from './cards.js';

const DECK_NAMES = {mix: 'Everything', ...Object.fromEntries(Object.entries(THEMES).map(([id, theme]) => [id, theme.en]))};
const LANGS = {en: 'English', fr: 'Français'};
export function validateSetup(value) {
  const {mode = 'race', decks = 'mix', lang = 'en', bots = 0, difficulty = 'normal'} = value;
  if (!Object.hasOwn(MODES, mode) || !Object.hasOwn(DECK_NAMES, decks) || !Object.hasOwn(LANGS, lang) || !Number.isInteger(bots) || bots < 0 || bots > 4 || !Object.hasOwn(DIFFICULTIES, difficulty)) throw new Error('Choose valid Yesteryear settings.');
  return {mode, decks, lang, bots: mode === 'streak' ? 0 : bots, difficulty};
}
export default {
  validate: validateSetup,
  saved: read => read('yesteryear.preferences').room || {},
  fallback: {},
  summary: value => `${value.mode === 'streak' ? 'Co-op streak, one shared hand' : 'Race' + (value.bots ? ' with ' + value.bots + ' ' + DIFFICULTIES[value.difficulty].toLowerCase() + ' bot' + (value.bots > 1 ? 's' : '') : '')} · ${DECK_NAMES[value.decks]} · ${LANGS[value.lang]}`,
  render({select, note, fields}, setup) {
    select('mode', 'Game', {race: 'Race · first to empty their hand', streak: 'Co-op streak · one shared hand, three lives'}, setup.mode);
    select('decks', 'Deck', DECK_NAMES, setup.decks);
    select('lang', 'Card language', LANGS, setup.lang);
    select('bots', 'Bots in the race', {0: 'None', 1: '1', 2: '2', 3: '3', 4: '4'}, setup.bots);
    select('difficulty', 'Bot knowledge', DIFFICULTIES, setup.difficulty);
    note('Bots know each date only roughly and play in the room. No API calls.');
    return () => ({mode: fields.mode.value, decks: fields.decks.value, lang: fields.lang.value, bots: Number(fields.bots.value), difficulty: fields.difficulty.value});
  },
};
