import {registerCheckpoint} from '../../shared/game-checkpoint.js';
import {friendSession, registerFriendGame, inviteFriendGame, joinFriendRoom} from '../../shared/friend-context.js';
import {esc, loadPrefs, savePrefs, toast, openDialog, playSound, installTopbar, seatNames, playerName} from '../../shared/parlor.js';
import {openAISettings} from '../../shared/ai/panel.js';
import {PACKS, LANGS, WORDS} from './words.js';
import {createGame, applyAction, playerView, validateView, actingSeat, clueProblem, teamOf, TURNS} from './rules.js';
import {botAction} from './bot.js';
import {choosePlan, nextFromPlan} from './ai.js';
import {validateSetup} from './room-setup.js';

const KEY = 'cover-story.preferences', app = document.querySelector('#app');
let prefs = loadPrefs(KEY);
const OTHERS = {dealer: 'Bot · no API calls', model: 'AI · your provider settings'};
function soloSetup(value = prefs.solo || {}) {
  const base = {mode: 'duo', lang: 'en', pack: 'all', turns: 11, role: 'spy', partner: 'dealer', opponents: 'dealer', ...value};
  try { validateSetup({...base, others: base.partner}); } catch { return soloSetup({}); }
  if (!['dealer', 'model'].includes(base.opponents) || !['dealer', 'model'].includes(base.partner)) return soloSetup({});
  return {mode: base.mode, lang: base.lang, pack: base.pack, turns: Number(base.turns), role: base.role, partner: base.partner, opponents: base.opponents};
}
let solo = soloSetup(), scene = 'menu', mode = 'solo', game = null, client = null, picked = null, timer = null, lastSeen = null;
let aiBusy = false, aiError = '', aiController = null, draft = {word: '', number: 2};
const plans = new Map();

// Seats --------------------------------------------------------------------------
function soloControllers() {
  if (solo.mode === 'duo') return ['me', solo.partner];
  return solo.role === 'spy' ? ['me', solo.partner, solo.opponents, solo.opponents] : [solo.partner, 'me', solo.opponents, solo.opponents];
}
const view = () => mode === 'async' ? client.record.view : game ? playerView(game, soloControllers().indexOf('me')) : null;
const mySeat = () => mode === 'async' ? client.record.seat : soloControllers().indexOf('me');
const lang = () => view()?.lang || solo.lang;
function seatLabel(seat) {
  const v = view();
  if (v.mode === 'duo') {
    if (mode === 'async') return seatNames(client.record, client)[seat];
    return seat === mySeat() ? playerName() : solo.partner === 'model' ? 'AI partner' : 'Bot partner';
  }
  const role = ['Red spymaster', 'Red operative', 'Blue spymaster', 'Blue operative'][seat];
  const who = mode === 'async' ? seatNames(client.record, client)[seat] : seat === mySeat() ? playerName() : soloControllers()[seat] === 'model' ? 'AI' : 'Bot';
  return who + ' · ' + role;
}
const myTurn = () => { const v = view(); return Boolean(v && v.phase !== 'over' && v.acting === mySeat() && !(mode === 'async' && client.busy)); };
const roomSetup = () => validateSetup({mode: solo.mode, lang: solo.lang, pack: solo.pack, turns: solo.turns, lineup: 'together', role: solo.role, others: solo.opponents});

// Menu ------------------------------------------------------------------------------
function renderMenu() {
  const room = friendSession(), friend = room?.friend?.joined ? room.friend.name || 'your friend' : '';
  const option = (map, current) => Object.entries(map).map(([id, label]) => '<option value="' + id + '"' + (String(current) === String(id) ? ' selected' : '') + '>' + esc(label) + '</option>').join('');
  const sample = WORDS[solo.lang][solo.pack].slice(0, 10).map(word => '<span class="word mini">' + esc(word) + '</span>').join('');
  const usesAI = solo.partner === 'model' || solo.mode === 'teams' && solo.opponents === 'model';
  app.innerHTML = '<section class="menu"><div><p class="eyebrow">Word association · co-op or teams · English & French</p><h1>Keep your <em>cover.</em></h1>'
    + '<p class="lede">Twenty-five words. A spymaster knows which ones are friendly agents and gives a single-word clue with a number. Their partner guesses. Hit the assassin and it’s over.</p>'
    + '<div class="mode-cards"><button type="button" class="box mode' + (solo.mode === 'duo' ? ' on' : '') + '" data-action="mode" data-mode="duo"><strong>Duo</strong><span>Co-op. Each partner holds half of the key and gives clues for the other. Find 15 agents before time runs out.</span></button>'
    + '<button type="button" class="box mode' + (solo.mode === 'teams' ? ' on' : '') + '" data-action="mode" data-mode="teams"><strong>Teams</strong><span>Red against Blue. One spymaster and one operative per team; first to find all their agents wins.</span></button></div>'
    + '<div class="sample">' + sample + '</div></div>'
    + '<aside class="box stack" aria-label="Play options"><p class="eyebrow">Take a seat</p>'
    + '<label class="field">Words<select id="lang">' + option(LANGS, solo.lang) + '</select></label>'
    + '<label class="field">Word pack<select id="pack">' + option(Object.fromEntries(Object.entries(PACKS).map(([id, p]) => [id, p[solo.lang]])), solo.pack) + '</select></label>'
    + (solo.mode === 'duo' ? '<label class="field">Turns<select id="turns">' + option(TURNS, solo.turns) + '</select></label>'
      : '<label class="field">Your role<select id="role">' + option({spy: 'Spymaster · give clues', op: 'Operative · guess'}, solo.role) + '</select></label><label class="field">Opponents<select id="opponents">' + option(OTHERS, solo.opponents) + '</select></label>')
    + '<label class="field">Your partner<select id="partner">' + option(OTHERS, solo.partner) + '</select></label>'
    + (usesAI ? '<button class="btn ghost small" data-action="ai-settings">AI settings ↗</button>' : '<p class="muted small">The bot knows a few associations per word and plays it safe. The AI uses your own provider key.</p>')
    + '<div class="row"><button class="btn" data-action="start">Play</button>' + (game && game.phase !== 'over' ? '<button class="btn ghost" data-action="resume">Resume</button>' : '') + '<button class="btn ghost" data-action="rules">Rules</button></div>'
    + '<hr><p class="muted small">' + (friend ? 'Play Duo with ' + esc(friend) + ', or team up against bots.' : 'Different screens? Invite a friend with a room code.') + '</p>'
    + '<div class="row"><button class="btn alt" data-action="host">' + (friend ? 'Play with ' + esc(friend) : 'Play a friend') + '</button>' + (friend ? '' : '<button class="btn ghost" data-action="join">Join a friend</button>') + '</div></aside></section>';
  app.querySelectorAll('aside select').forEach(input => input.onchange = () => {
    const read = id => app.querySelector('#' + id)?.value;
    solo = soloSetup({...solo, lang: read('lang'), pack: read('pack'), turns: Number(read('turns') || solo.turns), role: read('role') || solo.role, opponents: read('opponents') || solo.opponents, partner: read('partner')});
    prefs.solo = solo; savePrefs(KEY, prefs); render();
  });
}

// Board ------------------------------------------------------------------------------
function cardClass(v, i) {
  const classes = ['word'], length = v.words[i].length;
  if (length >= 11) classes.push('longer'); else if (length >= 9) classes.push('long');
  const shown = v.revealed[i];
  if (shown) classes.push('shown', shown);
  else if (v.key) classes.push('key-' + v.key[i]);
  else if (v.myKey) classes.push('key-' + v.myKey[i]);
  if (v.mode === 'duo' && v.keys && !shown) classes.push('end-' + v.keys[0][i] + '-' + v.keys[1][i]);
  if (picked === i) classes.push('picked');
  return classes.join(' ');
}
function marks(v, i) {
  if (v.mode !== 'duo') return '';
  const me = mySeat(), out = [];
  for (const side of [0, 1]) if (v.bystanders[side][i]) out.push('<i class="mark' + (side === me ? ' mine' : '') + '" title="Bystander on ' + (side === me ? 'your' : 'your partner’s') + ' side">' + (side === me ? 'you' : 'them') + '</i>');
  return out.length ? '<span class="marks">' + out.join('') + '</span>' : '';
}
function canGuess(v, i) {
  return myTurn() && v.phase === 'guess' && v.revealed[i] === null && !(v.mode === 'duo' && v.bystanders[v.giver][i]);
}
function statusLine(v) {
  if (v.phase === 'over') {
    if (v.mode === 'duo') return v.winner ? 'All 15 agents found!' : v.result === 'assassin' ? 'The assassin got you.' : 'Out of time.';
    const mine = teamOf(mySeat()) === v.winner;
    return (v.winner === 'red' ? 'Red' : 'Blue') + ' wins' + (v.result === 'assassin' ? ': the other team hit the assassin.' : '.') + (mine ? ' Well played!' : '');
  }
  if (mode === 'async' && client.busy) return 'Sending…';
  if (aiBusy) return seatLabel(v.acting) + ' is thinking…';
  if (myTurn()) return v.phase === 'clue' ? 'Your clue.' : 'Your guess: ' + esc(v.clue.word.toUpperCase()) + ' · ' + v.clue.number + '.';
  return seatLabel(v.acting) + (v.phase === 'clue' ? ' is choosing a clue…' : ' is guessing…');
}
function controls(v) {
  if (v.phase === 'over') return '<div class="row"><button class="btn" data-action="again">' + (mode === 'async' ? 'Rematch' : 'Play again') + '</button><button class="btn ghost" data-action="menu">Menu</button></div>';
  if (aiError && !aiBusy) return '<p class="error">' + esc(aiError) + '</p><button class="btn small" data-action="retry-ai">Retry AI</button>';
  if (mode === 'async' && client.aiError) return '<p class="error">' + esc(client.aiError) + '</p><button class="btn small" data-action="retry-room-ai">Retry AI</button>';
  if (!myTurn()) return '<p class="muted">Waiting for ' + esc(seatLabel(v.acting)) + '.</p>';
  if (v.phase === 'clue') {
    const problem = draft.word ? clueProblem(v, draft.word) : null;
    return '<form class="clue-form" data-form="clue"><label class="field">Clue<input id="clue-word" autocomplete="off" maxlength="24" value="' + esc(draft.word) + '" placeholder="One word"></label>'
      + '<label class="field">Number<select id="clue-number">' + Array.from({length: 9}, (_, i) => '<option' + (draft.number === i + 1 ? ' selected' : '') + '>' + (i + 1) + '</option>').join('') + '</select></label>'
      + '<button class="btn" type="submit"' + (!draft.word || problem ? ' disabled' : '') + '>Give clue</button></form><p class="error" id="clue-problem">' + esc(problem || '') + '</p>';
  }
  const limit = v.mode === 'teams' ? ' · up to ' + (v.clue.number + 1) + ' guesses' : '';
  return '<p class="muted">' + (picked !== null ? 'Tap <strong>' + esc(v.words[picked].toUpperCase()) + '</strong> again to reveal it.' : 'Tap a word, then tap it again to reveal.') + limit + '</p>'
    + '<button class="btn ghost" data-action="pass"' + (v.guesses ? '' : ' disabled') + '>End guessing</button>';
}
function scoreboard(v) {
  if (v.mode === 'duo') {
    return '<div class="row"><span class="tag">Turns left <strong>' + v.turnsLeft + '</strong></span><span class="tag">Agents found <strong>' + v.found + '/15</strong></span></div>'
      + '<p class="muted small">Your side of the key is shown: green agents for your partner to find, black assassins. Clue giver: ' + esc(seatLabel(v.giver)) + '.</p>';
  }
  return '<div class="row teams"><span class="team red' + (v.team === 'red' && v.phase !== 'over' ? ' on' : '') + '">Red · ' + v.left.red + ' left</span><span class="team blue' + (v.team === 'blue' && v.phase !== 'over' ? ' on' : '') + '">Blue · ' + v.left.blue + ' left</span></div>'
    + '<ul class="seats">' + [0, 1, 2, 3].map(seat => '<li class="' + teamOf(seat) + (seat === v.acting ? ' acting' : '') + '">' + esc(seatLabel(seat)) + (seat === mySeat() ? ' <span class="tag">you</span>' : '') + '</li>').join('') + '</ul>';
}
function history(v) {
  if (!v.log.length) return '';
  return '<details class="box log"' + (v.phase === 'over' ? ' open' : '') + '><summary>Clues · ' + v.log.length + '</summary><ol>' + v.log.map(entry => '<li><strong class="' + (entry.team || '') + '">' + esc(entry.word.toUpperCase()) + ' · ' + entry.number + '</strong> → '
    + (entry.guesses.length ? entry.guesses.map(g => '<span class="g ' + (g.color || g.kind) + '">' + esc(v.words[g.index]) + '</span>').join(' ') : '<span class="muted">no guess yet</span>') + '</li>').join('') + '</ol></details>';
}
function renderGame() {
  const v = view();
  if (picked !== null && !canGuess(v, picked)) picked = null;
  const board = v.words.map((word, i) => '<button type="button" class="' + cardClass(v, i) + '" data-action="card" data-index="' + i + '"' + (canGuess(v, i) ? '' : ' aria-disabled="true"') + '><span>' + esc(word) + '</span>' + marks(v, i) + '</button>').join('');
  const clue = v.clue ? '<div class="clue-banner"><span class="muted small">Clue</span><strong>' + esc(v.clue.word.toUpperCase()) + '</strong><b>' + v.clue.number + '</b><span class="muted small">' + v.guesses + ' guessed</span></div>' : '';
  app.innerHTML = '<div class="table-head row"><p class="status" role="status">' + statusLine(v) + '</p><span class="spacer"></span>'
    + (mode === 'async' ? '<span class="tag">' + (client.friendHere ? 'With ' + esc(client.names.friend) : esc(client.names.friend) + ' is away') + '</span>' : '')
    + '<span class="tag">' + LANGS[v.lang] + ' · ' + esc(PACKS[v.pack][v.lang]) + '</span><button class="btn ghost small" data-action="rules">Rules</button><button class="btn ghost small" data-action="menu">Menu</button></div>'
    + '<div class="play"><section class="board' + (v.key || v.myKey ? ' spy' : '') + '" aria-label="Board">' + board + '</section>'
    + '<aside class="box side stack">' + scoreboard(v) + clue + controls(v) + '</aside></div>' + history(v);
  const input = app.querySelector('#clue-word');
  if (input) {
    input.oninput = () => { draft.word = input.value.trim(); const problem = draft.word ? clueProblem(v, draft.word) : null; app.querySelector('#clue-problem').textContent = problem || ''; app.querySelector('.clue-form button').disabled = !draft.word || Boolean(problem); };
    app.querySelector('#clue-number').onchange = event => { draft.number = Number(event.target.value); };
  }
}
function render() {
  const active = document.activeElement, focus = active?.id === 'clue-word' ? {id: 'clue-word', at: active.selectionStart} : active?.dataset?.action ? {...active.dataset} : null;
  if (scene === 'menu' || !view()) renderMenu(); else renderGame();
  if (focus?.id) { const input = app.querySelector('#clue-word'); if (input) { input.focus(); input.setSelectionRange(focus.at, focus.at); } }
  else if (focus) { const match = [...app.querySelectorAll('[data-action="' + focus.action + '"]')].find(el => el.dataset.index === focus.index && el.dataset.mode === focus.mode); match?.focus({preventScroll: true}); }
}

// Play -------------------------------------------------------------------------------
function announce(v) {
  if (lastSeen === null || lastSeen === v.revision) { lastSeen = v.revision; return; }
  lastSeen = v.revision;
  const last = v.log.at(-1)?.guesses.at(-1);
  if (v.phase === 'over') playSound(v.mode === 'duo' ? (v.winner ? 'win' : 'bad') : teamOf(mySeat()) === v.winner ? 'win' : 'bad');
  else if (v.phase === 'guess' && !v.guesses) playSound('turn');
  else if (last) playSound(last.color === 'assassin' || last.kind === 'assassin' ? 'bad' : (last.color === teamOf(mySeat()) || last.kind === 'agent') ? 'good' : 'flip');
}
function startSolo() {
  stopAI(); mode = 'solo'; client = null; picked = null; lastSeen = null; plans.clear(); draft = {word: '', number: 2};
  game = createGame({mode: solo.mode, lang: solo.lang, pack: solo.pack, turns: solo.turns}, crypto.getRandomValues(new Uint32Array(1))[0]);
  game.id = crypto.randomUUID();
  scene = 'game'; render(); schedule();
}
function stopAI() { clearTimeout(timer); aiController?.abort(); aiController = null; aiBusy = false; aiError = ''; }
// Solo: bots answer after a short pause; AI seats call the provider once per clue.
function schedule() {
  clearTimeout(timer);
  if (mode !== 'solo' || !game || game.phase === 'over' || aiBusy || aiError) return;
  const seat = actingSeat(game), kind = soloControllers()[seat];
  if (kind === 'me') return;
  if (kind === 'dealer') { timer = setTimeout(() => step(seat, botAction(game, seat)), game.phase === 'clue' ? 1300 : 1000); return; }
  timer = setTimeout(() => runAI(seat), 300);
}
async function runAI(seat) {
  const current = game, v = playerView(current, seat), key = current.id + '/' + current.round;
  try {
    let action;
    if (v.phase === 'guess' && plans.has(key)) action = nextFromPlan(v, plans.get(key));
    else {
      aiBusy = true; aiController = new AbortController(); render();
      const plan = await choosePlan(v, {signal: AbortSignal.any([aiController.signal, AbortSignal.timeout(90000)]), gameId: current.id});
      aiBusy = false; aiController = null;
      if (game !== current) return;
      if (plan.kind === 'guesses') { plans.set(key, plan); action = nextFromPlan(v, plan); }
      else action = plan;
    }
    step(seat, action, 900);
  } catch (error) {
    aiBusy = false; aiController = null;
    if (error.name === 'AbortError') return;
    aiError = error.name === 'TimeoutError' ? 'The AI took too long.' : error.message; render();
  }
}
function step(seat, action, delay = 0) {
  const run = () => {
    try { game = applyAction(game, seat, action); } catch (error) { aiError = error.message; render(); return; }
    announce(view()); render(); schedule();
  };
  if (delay) timer = setTimeout(run, delay); else run();
}
async function act(action) {
  if (!myTurn()) return;
  picked = null;
  if (mode === 'async') { try { await client.move(action); if (action.kind === 'clue') draft = {word: '', number: 2}; } catch (error) { toast(error.message); render(); } return; }
  try { game = applyAction(game, mySeat(), action); } catch (error) { toast(error.message); return; }
  if (action.kind === 'clue') draft = {word: '', number: 2};
  announce(view()); render(); schedule();
}
// Room AI seats: the creator's page plans once per clue and plays it out.
async function chooseRoomAI({view: seatView, record}, {signal}) {
  const key = record.id + '/' + seatView.round;
  if (seatView.phase === 'guess' && plans.has(key)) return nextFromPlan(seatView, plans.get(key));
  const plan = await choosePlan(seatView, {signal, gameId: record.id});
  if (plan.kind === 'guesses') { plans.set(key, plan); return nextFromPlan(seatView, plan); }
  return {kind: 'clue', word: plan.word, number: plan.number};
}
function showRules() {
  openDialog('How to play Cover Story', '<p><strong>Clues.</strong> A clue is one word plus a number: how many board words it points to. It can’t be a word still on the board, or contain one, or sit inside one. Accents and capitals don’t matter.</p>'
    + '<p><strong>Duo.</strong> You and your partner each see one side of the key: green agents your partner must find, black assassins. Take turns giving clues. The guesser keeps going while they find agents on the giver’s side, and may stop after one. A bystander ends the turn and is marked for that side; an assassin ends the game. Find all 15 agents before the turns run out. If one side has no agents left to give, the other gives every remaining clue.</p>'
    + '<p><strong>Teams.</strong> Red and Blue each have a spymaster, who sees the whole key, and an operative. The operative may guess up to the number plus one. A bystander or an opponent’s agent ends the turn; the assassin loses at once. First team to uncover all its agents wins; the team that starts has nine, the other eight.</p>'
    + '<p class="muted small">Bots know a handful of associations per word and play safely. AI players use your provider settings and only see what their seat may see.</p>', 'Rules');
}
document.addEventListener('submit', event => {
  if (event.target.dataset.form !== 'clue') return;
  event.preventDefault();
  const word = app.querySelector('#clue-word').value.trim(), number = Number(app.querySelector('#clue-number').value);
  draft = {word, number};
  act({kind: 'clue', word, number});
});
document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action = target.dataset.action, v = view();
  if (action === 'card') {
    const index = Number(target.dataset.index);
    if (!v || !canGuess(v, index)) return;
    if (picked === index) act({kind: 'guess', index}); else { picked = index; playSound('tap'); render(); }
  } else if (action === 'pass') act({kind: 'pass'});
  else if (action === 'mode') { solo = soloSetup({...solo, mode: target.dataset.mode}); prefs.solo = solo; savePrefs(KEY, prefs); render(); }
  else if (action === 'start') startSolo();
  else if (action === 'resume') { scene = 'game'; render(); schedule(); }
  else if (action === 'menu') { stopAI(); if (mode === 'async') { mode = 'solo'; client = null; game = null; friendSession()?.leaveRoomGame?.(); } scene = 'menu'; render(); }
  else if (action === 'again') { if (mode === 'async') friendSession()?.openGameSetup('cover-story', client.record.setup); else startSolo(); }
  else if (action === 'retry-ai') { aiError = ''; render(); schedule(); }
  else if (action === 'retry-room-ai') client.retryAI();
  else if (action === 'ai-settings') openAISettings(() => render());
  else if (action === 'rules') showRules();
  else if (action === 'host') inviteFriendGame('cover-story', roomSetup());
  else if (action === 'join') joinFriendRoom('cover-story');
});

installTopbar(KEY);
registerCheckpoint('cover-story', {
  capture: () => mode === 'solo' && game ? {setup: solo, state: game} : null,
  restore(data) {
    if (!data?.state) throw new Error('Invalid saved board.');
    const setup = soloSetup(data.setup);
    if (data.state.mode !== setup.mode) throw new Error('Invalid saved board.');
    validateView(playerView(data.state, 0));
    solo = setup; game = data.state; mode = 'solo'; scene = 'game'; render(); schedule();
  },
});
registerFriendGame('cover-story', {
  setup: roomSetup,
  startAsync(next) {
    stopAI(); client = next; mode = 'async'; scene = 'game'; picked = null; lastSeen = null; draft = {word: '', number: 2};
    const unsubscribe = next.subscribe(record => { if (mode !== 'async' || client !== next) return; announce(record.view); render(); });
    window.addEventListener('pagehide', unsubscribe, {once: true});
  },
  chooseAI: chooseRoomAI,
});
// Read-only hooks for the browser audits.
Object.defineProperty(window, '__coverStory', {value: {get mode() { return mode; }, get view() { return view(); }}});
render();
