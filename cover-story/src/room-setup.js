import {MODES, TURNS} from './rules.js';
import {PACKS, LANGS} from './words.js';

const LINEUPS = {together: 'You two on one team, against bots or AI', spymasters: 'Rival spymasters, each with a bot or AI operative', operatives: 'Rival operatives, each with a bot or AI spymaster'};
export function validateSetup(value) {
  const {mode = 'duo', lang = 'en', pack = 'all', turns = 9, lineup = 'together', role = 'spy', others = 'dealer'} = value;
  if (!Object.hasOwn(MODES, mode) || !Object.hasOwn(LANGS, lang) || !Object.hasOwn(PACKS, pack) || !Object.hasOwn(TURNS, turns) || !Object.hasOwn(LINEUPS, lineup) || !['spy', 'op'].includes(role) || !['dealer', 'model'].includes(others)) throw new Error('Choose valid Cover Story settings.');
  return mode === 'duo' ? {mode, lang, pack, turns} : {mode, lang, pack, lineup, role, others};
}
export default {
  validate: validateSetup,
  saved: read => read('cover-story.preferences').room || {},
  fallback: {},
  summary: (value, host) => {
    const words = LANGS[value.lang] + ' · ' + PACKS[value.pack].en;
    if (value.mode === 'duo') return 'Duo co-op · ' + value.turns + ' turns · ' + words;
    const ai = value.others === 'model' ? 'AI' : 'bots';
    const mine = (value.role === 'spy') === host ? 'you give clues' : 'you guess';
    return {together: 'One team against ' + ai + ' · ' + mine, spymasters: 'Rival spymasters with ' + ai + ' operatives', operatives: 'Rival operatives with ' + ai + ' spymasters'}[value.lineup] + ' · ' + words;
  },
  render({select, note, fields}, setup) {
    select('mode', 'Game', {duo: 'Duo · co-op, each holds half of the key', teams: 'Teams · Red against Blue'}, setup.mode);
    select('lang', 'Words', LANGS, setup.lang);
    select('pack', 'Word pack', Object.fromEntries(Object.entries(PACKS).map(([id, pack]) => [id, pack.en])), setup.pack);
    select('turns', 'Duo turns', TURNS, setup.turns ?? 9);
    select('lineup', 'Teams lineup', LINEUPS, setup.lineup ?? 'together');
    select('role', 'Your role together', {spy: 'Spymaster · give clues', op: 'Operative · guess'}, setup.role ?? 'spy');
    select('others', 'Other roles', {dealer: 'Bot · no API calls', model: 'AI · your provider settings'}, setup.others ?? 'dealer');
    note('AI roles use the room creator’s provider settings while the creator has the game open.');
    return () => ({mode: fields.mode.value, lang: fields.lang.value, pack: fields.pack.value, turns: Number(fields.turns.value), lineup: fields.lineup.value, role: fields.role.value, others: fields.others.value});
  },
};
