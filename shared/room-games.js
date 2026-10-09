// Games whose rules run in the room, with the titles and one-line descriptions
// shown in the Play together window. Kept free of rules imports: every game
// page loads it.
export const ROOM_GAME_INFO = Object.freeze({
  'flip-it': {title: 'Flip It', about: 'Card duel · bots and teams optional'},
  cluance: {title: 'Cluance', about: 'Co-op clues · one gives, one guesses'},
  midnight: {title: 'Midnight Table', about: 'Three quick card games'},
  thrice: {title: 'Thrice', about: 'Memory card game · bots fill the table'},
  yesteryear: {title: 'Yesteryear', about: 'Timeline trivia · race or co-op streak'},
  'cover-story': {title: 'Cover Story', about: 'Word spies · Duo co-op or teams, EN/FR'},
});
export const ROOM_GAMES = Object.freeze(Object.fromEntries(Object.entries(ROOM_GAME_INFO).map(([id, info]) => [id, info.title])));
export const isRoomGame = game => Object.hasOwn(ROOM_GAME_INFO, game);
