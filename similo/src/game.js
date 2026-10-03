import {DECKS, CARDS} from './decks.js';

export const REMOVALS = [1, 2, 3, 4, 1];
export const PROTOCOL = 1;
export const DIMENSIONS = ['role', 'dates', 'geography', 'stories', 'traits', 'appearance'];
export function shuffle(items, random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function createGame({theme = 'french', clueTheme = theme, variant = 'classic'} = {}, random) {
  if (!DECKS[theme] || !DECKS[clueTheme]) throw new Error('Choose an available deck.');
  if (!['classic', 'fixed'].includes(variant)) throw new Error('Unknown hand variant.');
  const deck = shuffle(DECKS[theme].cards.map(c => c.id), random);
  const board = deck.slice(0, 12);
  const secret = board[Math.floor((random ? random() : crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 12)];
  const boardNames = new Set(board.map(id => CARDS[id].name));
  const clues = shuffle(DECKS[clueTheme].cards.map(c => c.id).filter(id => !boardNames.has(CARDS[id].name)), random);
  return {version: PROTOCOL, id: crypto.randomUUID(), theme, clueTheme, variant, board, secret,
    hand: clues.slice(0, 5), draw: clues.slice(5), eliminated: [], history: [], round: 0,
    revision: 0, phase: 'clue', result: null, started: Date.now()};
}
export function remaining(game) { return game.board.filter(id => !game.eliminated.includes(id)); }
export function note(text) { return typeof text === 'string' ? text.trim().slice(0, 1200) : ''; }
function cardList(ids, active) {
  return Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(id => active.includes(id));
}
function dimensionList(values) {
  return Array.isArray(values) && values.length > 0 && values.length <= DIMENSIONS.length &&
    new Set(values).size === values.length && values.every(value => DIMENSIONS.includes(value));
}
export function playClue(game, action) {
  if (game.phase !== 'clue') throw new Error('Wait for the next clue turn.');
  if (!game.hand.includes(action.card)) throw new Error('Choose a card from your hand.');
  if (!['similar', 'different'].includes(action.relation)) throw new Error('Choose Similar or Different.');
  if (action.expectedRemovals !== undefined && (!cardList(action.expectedRemovals, remaining(game)) ||
      action.expectedRemovals.length !== REMOVALS[game.round] || action.expectedRemovals.includes(game.secret))) {
    throw new Error('Expected removals must name exactly the required number of remaining alternatives, keeping the secret safe.');
  }
  if (action.dimensions !== undefined && !dimensionList(action.dimensions)) throw new Error('Choose valid clue dimensions.');
  const next = structuredClone(game);
  next.history.push({round: game.round + 1, active: remaining(game), card: action.card,
    relation: action.relation, giverNote: note(action.rationale), removed: [], guesserNote: '',
    giverSource: note(action.source), guesserSource: '',
    ...(action.expectedRemovals !== undefined ? {expectedRemovals:[...action.expectedRemovals]} : {}),
    ...(action.dimensions !== undefined ? {giverDimensions:[...action.dimensions]} : {})});
  next.hand = next.hand.filter(id => id !== action.card);
  if (next.variant === 'classic' && next.draw.length) next.hand.push(next.draw.shift());
  next.phase = 'guess';
  next.revision++;
  return next;
}
export function eliminate(game, action) {
  if (game.phase !== 'guess') throw new Error('Wait for a clue before removing cards.');
  const ids = action.cards;
  if (!Array.isArray(ids) || ids.length !== REMOVALS[game.round] || new Set(ids).size !== ids.length ||
      ids.some(id => !remaining(game).includes(id))) {
    throw new Error(`Choose exactly ${REMOVALS[game.round]} different remaining card(s).`);
  }
  if (action.keptCards !== undefined && (!cardList(action.keptCards, remaining(game)) ||
      action.keptCards.length !== remaining(game).length - ids.length || action.keptCards.some(id => ids.includes(id)))) {
    throw new Error('Keep and remove must be separate lists that together cover every remaining card.');
  }
  if (action.dimensions !== undefined && !dimensionList(action.dimensions)) throw new Error('Choose valid interpretation dimensions.');
  const next = structuredClone(game);
  Object.assign(next.history.at(-1), {removed: [...ids], guesserNote: note(action.rationale), guesserSource: note(action.source)});
  if (action.keptCards !== undefined) next.history.at(-1).keptCards = [...action.keptCards];
  if (action.dimensions !== undefined) next.history.at(-1).guesserDimensions = [...action.dimensions];
  next.eliminated.push(...ids);
  if (ids.includes(next.secret)) { next.phase = 'over'; next.result = 'loss'; }
  else if (next.round === 4) { next.phase = 'over'; next.result = 'win'; }
  else { next.round++; next.phase = 'clue'; }
  next.revision++;
  return next;
}
export function viewFor(game, role) {
  const {draw, hand, secret, history, ...publicState} = game;
  const view = {...structuredClone(publicState), role, history: history.map(({giverNote, guesserNote, giverSource, guesserSource,
    expectedRemovals, keptCards, giverDimensions, guesserDimensions, ...round}) => ({...structuredClone(round)}))};
  if (role === 'giver' && game.phase !== 'over') { view.secret = secret; view.hand = [...hand]; }
  if (game.phase === 'over') {
    view.secret = secret;
    view.history = structuredClone(history);
  }
  return view;
}
export function validatePublicView(view) {
  if (!view || view.version !== PROTOCOL || !DECKS[view.theme] || !DECKS[view.clueTheme] ||
      !['classic','fixed'].includes(view.variant) || !['clue','guess','over'].includes(view.phase) ||
      !Number.isInteger(view.round) || view.round < 0 || view.round > 4 ||
      !Number.isInteger(view.revision) || view.revision < 0 || typeof view.id !== 'string' ||
      !Array.isArray(view.board) || view.board.length !== 12 || new Set(view.board).size !== 12 ||
      view.board.some(id => !CARDS[id] || CARDS[id].deck !== view.theme) ||
      !Array.isArray(view.eliminated) || new Set(view.eliminated).size !== view.eliminated.length ||
      view.eliminated.some(id => !view.board.includes(id)) ||
      !Array.isArray(view.history) || view.history.length > 5 ||
      view.history.some(r => !CARDS[r.card] || !['similar','different'].includes(r.relation) ||
        !Array.isArray(r.active) || r.active.some(id => !view.board.includes(id)) ||
        !Array.isArray(r.removed) || r.removed.some(id => !view.board.includes(id)) ||
        (r.expectedRemovals !== undefined && (!cardList(r.expectedRemovals, r.active) ||
          r.expectedRemovals.length !== REMOVALS[r.round - 1] || r.expectedRemovals.includes(view.secret))) ||
        (r.keptCards !== undefined && (!cardList(r.keptCards, r.active) ||
          r.keptCards.length !== r.active.length - r.removed.length || r.keptCards.some(id => r.removed.includes(id)))) ||
        (r.giverDimensions !== undefined && !dimensionList(r.giverDimensions)) ||
        (r.guesserDimensions !== undefined && !dimensionList(r.guesserDimensions)))) {
    throw new Error('Your partner sent an incompatible game state.');
  }
  if (view.phase !== 'over' && ('secret' in view || 'hand' in view || 'draw' in view ||
      view.history.some(r => ['giverNote','guesserNote','giverSource','guesserSource','expectedRemovals','keptCards',
        'giverDimensions','guesserDimensions'].some(key => key in r)))) throw new Error('Unexpected private information in the game update.');
  if (view.phase === 'over' && (!view.board.includes(view.secret) || !['win','loss'].includes(view.result))) throw new Error('Invalid final reveal.');
  return view;
}
export function aiObservation(game, role) {
  const view = viewFor(game, role);
  return {role, round: view.round + 1, variant: view.variant, requiredEliminations: REMOVALS[view.round],
    boardDeck: {name: DECKS[view.theme].name, kind: DECKS[view.theme].kind},
    clueDeck: {name: DECKS[view.clueTheme].name, kind: DECKS[view.clueTheme].kind},
    board: view.board.map(id => ({id, name: CARDS[id].name, subtitle: CARDS[id].subtitle,
      dates: CARDS[id].dates, description: CARDS[id].description, eliminated: view.eliminated.includes(id)})),
    clues: view.history.map(r => ({card: r.card, name: CARDS[r.card].name,
      dates: CARDS[r.card].dates, description: CARDS[r.card].description, relation: r.relation, removed: r.removed})),
    ownPreviousExplanations: game.history.flatMap(r => {
      const explanation = role === 'giver' ? r.giverNote : r.guesserNote;
      const source = role === 'giver' ? r.giverSource : r.guesserSource;
      return source && source !== 'Human' && explanation ? [{round:r.round, explanation}] : [];
    }),
    ownPreviousActions: game.history.flatMap(r => {
      const source = role === 'giver' ? r.giverSource : r.guesserSource;
      if (!source || source === 'Human') return [];
      const clue = {id:r.card, name:CARDS[r.card].name, relation:r.relation};
      const removedCards = r.removed.map(id => ({id, name:CARDS[id].name}));
      return [{round:r.round, role, source,
        action: role === 'giver' ? {clue, ...(r.expectedRemovals ? {expectedRemovals:r.expectedRemovals.map(id => ({id,name:CARDS[id].name}))} : {})} :
          {removedCards, ...(r.keptCards ? {keptCards:r.keptCards.map(id => ({id,name:CARDS[id].name}))} : {})},
        dimensions: (role === 'giver' ? r.giverDimensions : r.guesserDimensions) || [],
        ...(role === 'giver' ? {publicResponse:{removedCards, resolved:r.removed.length>0}} : {receivedClue:clue}),
        explanation:role === 'giver' ? r.giverNote : r.guesserNote}];
    }),
    ...(role === 'giver' ? {secret: view.secret, hand: view.hand.map(id => ({id, name: CARDS[id].name,
      subtitle: CARDS[id].subtitle, dates: CARDS[id].dates, description: CARDS[id].description}))} : {removeCount: REMOVALS[view.round]}),
  };
}
