import {registerCheckpoint} from '../../shared/game-checkpoint.js';
import {friendSession, registerFriendGame, inviteFriendGame, joinFriendRoom} from '../../shared/friend-context.js';
import {esc, loadPrefs, savePrefs, toast, openDialog, playSound, installTopbar} from '../../shared/parlor.js';
import {PUZZLE, PUZZLES, CAMPAIGNS} from './puzzles.js';
import {createGame, applyAction, playerView, validateView, aligned, ASSISTS} from './rules.js';
import {validateSetup} from './room-setup.js';

const KEY = 'ripples.preferences', app = document.querySelector('#app');
let prefs = loadPrefs(KEY);
if (!['en', 'fr'].includes(prefs.lang)) prefs.lang = 'en';
if (!Object.hasOwn(ASSISTS, prefs.assist)) prefs.assist = 'guided';
if (!Object.hasOwn(PUZZLE, prefs.puzzle)) prefs.puzzle = PUZZLES.find(p => p.lang === prefs.lang).id;
let scene = 'menu', mode = 'solo', game = null, client = null, first = null, lastSeen = null, draft = '';
const solved = () => new Set(Array.isArray(prefs.solved) ? prefs.solved : []);

const view = () => mode === 'async' ? client.record.view : game ? playerView(game, 0) : null;
const busy = () => mode === 'async' && client.busy;
const canPlay = () => { const v = view(); return Boolean(v && v.phase === 'playing' && !v.board.solved && !v.board.gaveUp && !busy()); };
const fr = () => PUZZLE[view()?.puzzle || prefs.puzzle].lang === 'fr';
const roomSetup = () => validateSetup({puzzle: prefs.puzzle, mode: 'together', assist: prefs.assist});
const sceneArt = campaign => {
  const index = {heist: 0, gang: 0, manor: 1, chateau: 1, kitchen: 2, cuisine: 2}[campaign];
  return '<span class="scene-art" aria-hidden="true" style="background-position:' + index * 50 + '% 0%"></span>';
};

// Menu -----------------------------------------------------------------------------
function renderMenu() {
  const room = friendSession(), friend = room?.friend?.joined ? room.friend.name || 'your friend' : '', done = solved();
  const campaigns = Object.entries(CAMPAIGNS).filter(([, c]) => c.lang === prefs.lang);
  app.innerHTML = '<section class="menu"><div><p class="eyebrow">Co-op word puzzles · English & French</p><h1>Make <em>ripples.</em></h1>'
    + '<p class="lede">Each puzzle is a little scene whose last line is missing. Starting from two clues, follow two chains of associations across the grid, covering a pair of words at each step. The pair must share a row or a column. The words left uncovered, read aloud, sound out the missing line.</p>'
    + '<div class="row lang" role="tablist">' + [['en', 'English'], ['fr', 'Français']].map(([id, name]) => '<button type="button" class="chip' + (prefs.lang === id ? ' on' : '') + '" role="tab" aria-selected="' + (prefs.lang === id) + '" data-action="lang" data-lang="' + id + '">' + name + '</button>').join('') + '</div>'
    + campaigns.map(([id, c]) => '<section class="campaign box">' + sceneArt(id) + '<h2>' + esc(c.title) + '</h2><p class="muted">' + esc(c.blurb) + '</p><div class="puzzles">'
      + PUZZLES.filter(p => p.campaign === id).map((p, i) => '<button type="button" class="puzzle' + (prefs.puzzle === p.id ? ' on' : '') + '" data-action="pick" data-puzzle="' + p.id + '"><span class="num">' + (i + 1) + '</span><span>' + esc(p.title) + '</span>' + (done.has(p.id) ? '<span class="done" aria-label="solved">✓</span>' : '') + '</button>').join('') + '</div></section>').join('')
    + '</div><aside class="box stack" aria-label="Play options"><p class="eyebrow">' + esc(CAMPAIGNS[PUZZLE[prefs.puzzle].campaign].title) + '</p><h2 class="pick">' + esc(PUZZLE[prefs.puzzle].title) + '</h2>'
    + '<label class="field">Checking<select id="assist">' + Object.entries(ASSISTS).map(([id, label]) => '<option value="' + id + '"' + (prefs.assist === id ? ' selected' : '') + '>' + esc(label) + '</option>').join('') + '</select></label>'
    + '<p class="muted small">' + (prefs.assist === 'guided' ? 'A wrong pair bounces back, so you never wander off the path.' : 'Like the paper version: nothing is checked until you read the final line. Undo freely.') + '</p>'
    + '<div class="row"><button class="btn" data-action="start">Play</button>' + (game && game.phase === 'playing' ? '<button class="btn ghost" data-action="resume">Resume</button>' : '') + '<button class="btn ghost" data-action="rules">Rules</button></div>'
    + '<hr><p class="muted small">' + (friend ? 'Solve it with ' + esc(friend) + ' on one board, or race on the same grid.' : 'Two heads are better than one. Invite a friend with a room code.') + '</p>'
    + '<div class="row"><button class="btn alt" data-action="host">' + (friend ? 'Play with ' + esc(friend) : 'Play a friend') + '</button>' + (friend ? '' : '<button class="btn ghost" data-action="join">Join a friend</button>') + '</div></aside></section>';
  app.querySelector('#assist').onchange = event => { prefs.assist = event.target.value; savePrefs(KEY, prefs); render(); };
}

// Puzzle -----------------------------------------------------------------------------
function pebbles(v) {
  const marks = new Map();
  v.board.covered.forEach(([a, b], step) => { marks.set(a, step + 1); marks.set(b, step + 1); });
  return marks;
}
function cellClasses(v, i, marks) {
  const classes = ['cell'], hint = v.board.hint;
  if (marks.has(i)) classes.push('covered');
  if (first === i) classes.push('first');
  else if (first !== null && !marks.has(i) && aligned(first, i)) classes.push('aligned');
  if (hint && !hint.wrong && hint.line && (hint.line.row === Math.floor(i / 5) || hint.line.col === i % 5) && !marks.has(i)) classes.push('hint-line');
  if (hint?.words?.includes(i)) classes.push('hint-word');
  if (v.board.guess?.wrong && v.board.guess.a !== undefined && [v.board.guess.a, v.board.guess.b].includes(i)) classes.push('miss');
  if (v.board.covered.length === v.steps && !marks.has(i)) classes.push('leftover');
  if (v.solution) classes.push('final');
  return classes.join(' ');
}
function dialogue(v) {
  const puzzle = PUZZLE[v.puzzle], lines = puzzle.dialogue, finished = Boolean(v.answer);
  const last = lines.at(-1)[1].startsWith('(') ? lines.length - 1 : -1;
  return '<section class="box dialogue" aria-label="Scene">' + sceneArt(puzzle.campaign) + '<p class="eyebrow">' + esc(CAMPAIGNS[puzzle.campaign].title) + '</p><h2>' + esc(puzzle.title) + '</h2><dl>'
    + lines.map(([who, line], i) => '<dt>' + esc(who) + '</dt><dd>' + (i === last ? '<i>' + esc(line) + '</i>' : esc(line)) + '</dd>').join('')
    + '<dt>' + esc(puzzle.speaker) + '</dt><dd class="missing">' + (finished ? '<strong>' + esc(v.answer) + '</strong>' : '<span aria-label="Missing line">? ? ?</span>') + '</dd></dl></section>';
}
function statusLine(v) {
  const board = v.board;
  if (board.solved) return fr() ? 'Bravo ! Énigme résolue.' : 'Solved!';
  if (board.gaveUp) return fr() ? 'Solution révélée.' : 'Answer revealed.';
  if (busy()) return '…';
  if (board.covered.length === v.steps) return fr() ? 'Lisez les mots restants à voix haute.' : 'Read the leftover words aloud.';
  const step = board.covered.length + 1;
  return (first === null ? (fr() ? 'Étape ' : 'Step ') + step + (fr() ? ' : choisissez deux mots alignés.' : ': pick two words in a row or column.') : (fr() ? 'Choisissez le deuxième mot.' : 'Now pick the second word.'));
}
function hintText(v) {
  const hint = v.board.hint;
  if (!hint) return '';
  if (hint.wrong) return '<p class="note bad">' + (fr() ? 'L’étape ' + (hint.step + 1) + ' sort du chemin. Annulez jusque-là.' : 'Step ' + (hint.step + 1) + ' is off the path. Undo back to it.') + '</p>';
  const where = hint.line.row !== undefined ? (fr() ? 'la ligne ' : 'row ') + (hint.line.row + 1) : (fr() ? 'la colonne ' : 'column ') + (hint.line.col + 1);
  return '<p class="note">' + (fr() ? 'Indice : la paire est sur ' : 'Hint: the pair is in ') + where + (hint.level >= 2 ? (fr() ? ', avec ' : ', with ') + hint.words.map(i => esc(v.grid[i])).join(fr() ? ' et ' : ' and ') : '') + '.</p>';
}
function sidePanel(v) {
  const board = v.board, puzzle = PUZZLE[v.puzzle], allPlaced = board.covered.length === v.steps, finished = board.solved || board.gaveUp;
  let html = '<div class="progress"><span>' + (fr() ? 'Étapes ' : 'Steps ') + board.covered.length + ' / ' + v.steps + '</span><span class="muted small">' + board.hints + (fr() ? ' indice(s) · ' : ' hint(s) · ') + board.misses + (fr() ? ' erreur(s)' : ' miss(es)') + '</span></div>'
    + '<div class="bar"><i style="width:' + (100 * board.covered.length / v.steps) + '%"></i></div>';
  if (v.mode === 'race') html += v.rivals.map(r => '<p class="muted small">' + (fr() ? 'Adversaire : ' : 'Rival: ') + (r.solved ? (fr() ? 'a trouvé !' : 'solved it!') : r.gaveUp ? (fr() ? 'a abandonné' : 'gave up') : r.covered + ' / ' + v.steps) + '</p>').join('');
  if (mode === 'async') html += '<span class="tag">' + (client.friendHere ? 'With ' + esc(client.names.friend) : esc(client.names.friend) + ' is away') + '</span>';
  if (finished) {
    html += '<p class="note good">' + esc(v.sounds) + '</p><p class="small">' + (fr() ? 'Les deux chaînes : ' : 'The two chains: ') + '</p>'
      + puzzle.chains.map((chain, i) => '<p class="chain small"><strong>' + esc(puzzle.start[i]) + '</strong> → ' + chain.map(esc).join(' → ') + '</p>').join('')
      + '<div class="row">' + (mode === 'async' ? '<button class="btn" data-action="again">' + (fr() ? 'Autre énigme' : 'Another puzzle') + '</button>' : nextPuzzle(v) ? '<button class="btn" data-action="next">' + (fr() ? 'Énigme suivante' : 'Next puzzle') + '</button>' : '') + '<button class="btn ghost" data-action="menu">Menu</button></div>';
    return html;
  }
  if (allPlaced) {
    html += '<form data-form="answer" class="stack"><label class="field">' + (fr() ? 'La réplique manquante' : 'The missing line') + '<input id="answer" maxlength="120" autocomplete="off" value="' + esc(draft) + '"></label>'
      + '<button class="btn" type="submit"' + (canPlay() ? '' : ' disabled') + '>' + (fr() ? 'Valider' : 'Submit') + '</button></form>'
      + (board.guess?.wrong && board.guess.text !== undefined ? '<p class="note bad">' + (fr() ? 'Pas tout à fait. Lisez les mots lumineux à voix haute, dans l’ordre.' : 'Not quite. Read the glowing words aloud, in order.') + (v.assist === 'classic' ? (fr() ? ' Ou le chemin s’est égaré quelque part.' : ' Or the path went astray somewhere.') : '') + '</p>' : '');
  }
  html += hintText(v);
  html += '<div class="row">' + (allPlaced && v.assist === 'guided' ? '' : '<button class="btn ghost small" data-action="hint"' + (canPlay() ? '' : ' disabled') + '>' + (fr() ? 'Indice' : 'Hint') + '</button>')
    + (v.assist === 'classic' ? '<button class="btn ghost small" data-action="undo"' + (canPlay() && board.covered.length ? '' : ' disabled') + '>' + (fr() ? 'Annuler' : 'Undo') + '</button>' : '')
    + '<button class="btn ghost small" data-action="giveup"' + (canPlay() ? '' : ' disabled') + '>' + (fr() ? 'Voir la solution' : 'Reveal') + '</button></div>';
  return html;
}
function nextPuzzle(v) {
  const list = PUZZLES.filter(p => p.lang === PUZZLE[v.puzzle].lang), index = list.findIndex(p => p.id === v.puzzle);
  return list[index + 1] || null;
}
function renderGame() {
  const v = view(), marks = pebbles(v), puzzle = PUZZLE[v.puzzle];
  const cells = v.grid.map((word, i) => '<button type="button" class="' + cellClasses(v, i, marks) + '" data-action="cell" data-index="' + i + '"' + (canPlay() && !marks.has(i) && v.board.covered.length < v.steps ? '' : ' aria-disabled="true"') + '><span class="w">' + esc(word) + '</span>' + (marks.has(i) ? '<span class="pebble" aria-label="' + (fr() ? 'étape ' : 'step ') + marks.get(i) + '">' + marks.get(i) + '</span>' : '') + '</button>').join('');
  app.innerHTML = '<div class="table-head row"><p class="status" role="status">' + statusLine(v) + '</p><span class="spacer"></span><span class="tag">' + (v.assist === 'guided' ? (fr() ? 'Guidé' : 'Guided') : (fr() ? 'Classique' : 'Classic')) + (v.mode !== 'solo' ? ' · ' + (v.mode === 'race' ? (fr() ? 'course' : 'race') : (fr() ? 'ensemble' : 'together')) : '') + '</span><button class="btn ghost small" data-action="rules">' + (fr() ? 'Règles' : 'Rules') + '</button><button class="btn ghost small" data-action="menu">Menu</button></div>'
    + '<div class="play">' + dialogue(v) + '<section class="board-area" aria-label="Grid"><div class="start"><span class="muted small">' + (fr() ? 'Départ' : 'Start') + '</span>' + puzzle.start.map(word => '<span class="start-word">' + esc(word) + '</span>').join('') + '</div><div class="grid">' + cells + '</div></section>'
    + '<aside class="box side stack">' + sidePanel(v) + '</aside></div>';
  const input = app.querySelector('#answer');
  if (input) input.oninput = () => { draft = input.value; };
}
function render() {
  const active = document.activeElement, focus = active?.id === 'answer' ? {id: 'answer'} : active?.dataset?.action ? {...active.dataset} : null;
  if (scene === 'menu' || !view()) renderMenu(); else renderGame();
  if (focus?.id) app.querySelector('#answer')?.focus();
  else if (focus) [...app.querySelectorAll('[data-action="' + focus.action + '"]')].find(el => el.dataset.index === focus.index && el.dataset.puzzle === focus.puzzle && el.dataset.lang === focus.lang)?.focus({preventScroll: true});
}

// Play -------------------------------------------------------------------------------
function announce(v) {
  if (lastSeen === null || lastSeen === v.revision) { lastSeen = v.revision; return; }
  lastSeen = v.revision;
  if (v.board.solved) { playSound('win'); markSolved(v.puzzle); }
  else if (v.board.guess?.wrong) playSound('bad');
  else playSound('flip');
}
function markSolved(id) { const set = solved(); set.add(id); prefs.solved = [...set]; savePrefs(KEY, prefs); }
function startSolo(id = prefs.puzzle) {
  mode = 'solo'; client = null; first = null; lastSeen = null; draft = '';
  prefs.puzzle = id; savePrefs(KEY, prefs);
  game = createGame({puzzle: id, mode: 'solo', assist: prefs.assist}, crypto.getRandomValues(new Uint32Array(1))[0]);
  scene = 'game'; render();
}
async function act(action) {
  if (!canPlay()) return;
  if (mode === 'async') { try { await client.move(action); } catch (error) { toast(error.message); render(); } return; }
  try { game = applyAction(game, 0, action); } catch (error) { toast(error.message); return; }
  announce(view()); render();
}
function clickCell(index) {
  const v = view();
  if (!canPlay() || v.board.covered.length === v.steps || pebbles(v).has(index)) return;
  if (first === null) { first = index; playSound('tap'); render(); return; }
  if (first === index) { first = null; render(); return; }
  if (!aligned(first, index)) { toast(fr() ? 'Les deux mots doivent être sur la même ligne ou colonne.' : 'The two words must share a row or a column.'); first = index; render(); return; }
  const a = first; first = null;
  act({kind: 'cover', a, b: index});
}
function showRules() {
  const french = scene === 'game' ? fr() : prefs.lang === 'fr';
  openDialog(french ? 'Comment jouer à Ripples' : 'How to play Ripples', french
    ? '<ol><li>Lisez la scène : la dernière réplique manque.</li><li>Les deux mots de <strong>départ</strong> évoquent chacun un mot de la grille. Ces deux mots doivent être sur la même ligne ou la même colonne : couvrez-les.</li><li>Chaque mot couvert en évoque un autre (synonyme, mot composé, expression, catégorie…). Les deux nouveaux mots doivent eux aussi être alignés. Continuez ainsi, étape par étape.</li><li>Quand toutes les paires sont posées, il reste trois à cinq mots. Lus à voix haute dans l’ordre de la grille, ils forment un rébus : la réplique manquante.</li><li><strong>Guidé</strong> vérifie chaque paire. <strong>Classique</strong> ne vérifie que la réponse finale ; annulez si le rébus n’a pas de sens.</li></ol>'
    : '<ol><li>Read the scene: its last line is missing.</li><li>Each of the two <strong>start</strong> words brings one grid word to mind. Those two words must share a row or a column: cover them.</li><li>Each covered word leads to the next in its chain: a synonym, a compound word, a saying, a category… The two new words must share a row or column too. Keep going, step by step.</li><li>When every pair is placed, three to five words are left. Read aloud in grid order, they sound out the missing line.</li><li><strong>Guided</strong> checks each pair. <strong>Classic</strong> only checks the final line; undo if the leftover words make no sense.</li></ol>',
    'Ripples');
}
document.addEventListener('submit', event => {
  if (event.target.dataset.form !== 'answer') return;
  event.preventDefault();
  act({kind: 'answer', text: app.querySelector('#answer').value});
});
document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action = target.dataset.action;
  if (action === 'cell') clickCell(Number(target.dataset.index));
  else if (action === 'hint') act({kind: 'hint'});
  else if (action === 'undo') act({kind: 'undo'});
  else if (action === 'giveup') act({kind: 'giveup'});
  else if (action === 'lang') { prefs.lang = target.dataset.lang; prefs.puzzle = PUZZLES.find(p => p.lang === prefs.lang).id; savePrefs(KEY, prefs); render(); }
  else if (action === 'pick') { prefs.puzzle = target.dataset.puzzle; savePrefs(KEY, prefs); render(); }
  else if (action === 'start') startSolo();
  else if (action === 'next') startSolo(nextPuzzle(view()).id);
  else if (action === 'resume') { scene = 'game'; render(); }
  else if (action === 'menu') { if (mode === 'async') { mode = 'solo'; client = null; game = null; friendSession()?.leaveRoomGame?.(); } scene = 'menu'; first = null; render(); }
  else if (action === 'again') friendSession()?.openGameSetup('ripples', {...client.record.setup, puzzle: nextPuzzle(view())?.id || client.record.setup.puzzle});
  else if (action === 'rules') showRules();
  else if (action === 'host') inviteFriendGame('ripples', roomSetup());
  else if (action === 'join') joinFriendRoom('ripples');
});

installTopbar(KEY);
registerCheckpoint('ripples', {
  capture: () => mode === 'solo' && game ? {state: game} : null,
  restore(data) {
    if (!data?.state || data.state.mode !== 'solo') throw new Error('Invalid saved puzzle.');
    validateView(playerView(data.state, 0));
    game = data.state; mode = 'solo'; scene = 'game'; prefs.puzzle = game.puzzle; render();
  },
});
registerFriendGame('ripples', {
  setup: roomSetup,
  startAsync(next) {
    client = next; mode = 'async'; scene = 'game'; first = null; lastSeen = null; draft = '';
    const unsubscribe = next.subscribe(record => { if (mode !== 'async' || client !== next) return; announce(record.view); render(); });
    window.addEventListener('pagehide', unsubscribe, {once: true});
  },
});
// Read-only hooks for the browser audits.
Object.defineProperty(window, '__ripples', {value: {get mode() { return mode; }, get view() { return view(); }}});
render();
