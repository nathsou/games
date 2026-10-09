import {PUZZLE, PUZZLES, CAMPAIGNS} from './puzzles.js';
import {ASSISTS} from './rules.js';

const ROOM_MODES = {together: 'Together · one shared board', race: 'Race · same grid, separate boards'};
export function validateSetup(value) {
  const {puzzle = 'heist-1', mode = 'together', assist = 'guided'} = value;
  if (!Object.hasOwn(PUZZLE, puzzle) || !Object.hasOwn(ROOM_MODES, mode) || !Object.hasOwn(ASSISTS, assist)) throw new Error('Choose valid Ripples settings.');
  return {puzzle, mode, assist};
}
const label = puzzle => (puzzle.lang === 'fr' ? '🇫🇷 ' : '🇬🇧 ') + CAMPAIGNS[puzzle.campaign].title + ' · ' + puzzle.title;
export default {
  validate: validateSetup,
  saved: read => read('ripples.preferences').room || {},
  fallback: {},
  summary: value => label(PUZZLE[value.puzzle]) + ' · ' + (value.mode === 'race' ? 'race' : 'together') + ' · ' + (value.assist === 'guided' ? 'guided' : 'classic'),
  render({select, note, fields}, setup) {
    select('puzzle', 'Puzzle', Object.fromEntries(PUZZLES.map(puzzle => [puzzle.id, label(puzzle)])), setup.puzzle);
    select('mode', 'Play', ROOM_MODES, setup.mode);
    select('assist', 'Checking', ASSISTS, setup.assist);
    note('Together: either of you can place pebbles, hints and the final answer. Race: first to read the hidden line wins.');
    return () => ({puzzle: fields.puzzle.value, mode: fields.mode.value, assist: fields.assist.value});
  },
};
