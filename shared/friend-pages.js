export const FRIEND_PAGES = Object.freeze({
  collection: 'Games', 'flip-it': 'Flip It', cluance: 'Cluance',
  spacegolf: 'Spacegolf', midnight: 'Midnight Table', nonocube: 'Nonocube', 'pawn-quest': 'Pawn Quest',
});
export const isFriendPage = page => Object.hasOwn(FRIEND_PAGES, page);
