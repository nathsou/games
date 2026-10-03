import { NAMES, VALUES, START, opposite, square, index, row, file, fromFEN, toFEN, attacksFrom, attackers, attacked, attackMap, kingSquare, inCheck, legalMoves, applyMove, status, positionKey, notation, explainIllegal, chooseMove } from './chess.js';
import { LESSONS, REGIONS, HANDBOOK } from './lessons.js';
import { pieceSVG, lanternSVG, guideSVG, worldSVG } from './art.js';
import { sound, setSound } from './sound.js';
const $ = id => document.getElementById(id);
const STORAGE = 'puzzle-trail.v1';
const defaults = { sound:false, moves:true, coords:true, motion:window.matchMedia('(prefers-reduced-motion: reduce)').matches, threats:false };
let progress = { version:1, completed:[], current:0, settings:{...defaults}, game:null };
let persistent = true;
try {
  const raw = JSON.parse(localStorage.getItem(STORAGE) || 'null');
  if (raw?.version === 1) {
    progress.completed = [...new Set((Array.isArray(raw.completed) ? raw.completed : []).filter(id => Number.isInteger(id) && id >= 0 && id < LESSONS.length))];
    progress.current = Number.isInteger(raw.current) && raw.current >= 0 && raw.current < LESSONS.length ? raw.current : 0;
    for (const key of Object.keys(defaults)) if (typeof raw.settings?.[key] === 'boolean') progress.settings[key] = raw.settings[key];
    if (raw.game?.fen && ['w','b'].includes(raw.game.human) && ['gentle','thoughtful'].includes(raw.game.level) && Array.isArray(raw.game.history)) {
      fromFEN(raw.game.fen);
      if (raw.game.history.length <= 2000 && raw.game.history.every(h => typeof h.before === 'string' && typeof h.after === 'string' && typeof h.text === 'string' && typeof h.key === 'string' && ['w','b'].includes(h.color))) progress.game = raw.game;
    }
  }
} catch { /* An unavailable or old save never prevents play. */ }
let mode = 'trail', lesson = LESSONS[0], state, history = [], selected = null, route = 0, finished = false, failed = false, hintLevel = 0, hinted = [], flipped = false, focusSquare = index('a1'), lastMove = null;
let human = 'w', level = 'gentle', busy = false, epoch = 0, gameInitial = START, toastTimer, pendingPromotion = null;
let worker;
try { worker = new Worker(new URL('./opponent.js', import.meta.url), { type:'module' }); } catch { /* Native, small-search fallback below. */ }
const firstUnfinished = () => LESSONS.find(l => !progress.completed.includes(l.id))?.id ?? LESSONS.length - 1;
const unlocked = id => id <= firstUnfinished() || progress.completed.includes(id);
const regionLessons = r => LESSONS.filter(l => l.region === r);
const regionCount = r => regionLessons(r).filter(l => progress.completed.includes(l.id)).length;
const restored = () => REGIONS.map((_,r) => r).filter(r => regionCount(r) === regionLessons(r).length);
function save() {
  if (mode === 'game') progress.game = { fen:toFEN(state), human, level, initial:gameInitial, history, finished };
  try { localStorage.setItem(STORAGE, JSON.stringify(progress)); persistent = true; }
  catch { persistent = false; }
  $('save-label').textContent = persistent ? 'Progress saved on this device' : 'Playing without a persistent save';
}
function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
}
function feedback(message, kind = '') {
  $('feedback').textContent = message;
  $('feedback').className = 'guide-copy' + (kind ? ' feedback-' + kind : '');
  $('mobile-feedback').textContent = message;
}
function closeDialogs() { document.querySelectorAll('dialog[open]').forEach(d => d.close()); }
function openDialog(id) { closeDialogs(); $(id).showModal(); }
function applySettings() {
  document.body.classList.toggle('reduced-motion', progress.settings.motion);
  $('board-frame').classList.toggle('no-coords', !progress.settings.coords);
  $('moves-button').setAttribute('aria-pressed', String(progress.settings.moves));
  $('threats-button').setAttribute('aria-pressed', String(progress.settings.threats));
  setSound(progress.settings.sound);
}
function renderJourney() {
  const completed = progress.completed.length;
  $('total-count').textContent = `${completed} / ${LESSONS.length}`;
  $('total-fill').style.width = `${completed / LESSONS.length * 100}%`;
  $('journey-note').textContent = completed === LESSONS.length ? 'The observatory is full of light.' : completed === 0 ? 'A whole world, waiting to light up.' : `${restored().length} of 6 places restored. Keep exploring.`;
  $('region-list').innerHTML = REGIONS.map((r,i) => {
    const count = regionCount(i), total = regionLessons(i).length, available = unlocked(regionLessons(i)[0].id), active = mode === 'trail' && lesson.region === i;
    return `<button class="region-button ${active ? 'active' : ''} ${count === total ? 'complete' : ''}" data-region="${i}" ${available ? '' : 'disabled'} ${active ? 'aria-current="step"' : ''} aria-label="${r.name}: ${r.subtitle}. ${count} of ${total} encounters complete${available ? '' : '. Complete the previous region to unlock'}"><span class="region-node" aria-hidden="true">${count === total ? '✓' : available ? r.symbol : '·'}</span><span class="region-copy"><strong>${r.name}</strong><small>${r.subtitle}</small>${available ? `<span class="region-progress"><span style="width:${count/total*100}%"></span></span>` : ''}</span><span class="region-arrow" aria-hidden="true">${active ? '›' : count === total ? '✦' : ''}</span></button>`;
  }).join('');
  $('mini-world').innerHTML = worldSVG(restored());
}
function targetSquares() {
  if (mode !== 'trail' || finished) return [];
  if (lesson.goal.type === 'route') return lesson.goal.squares.slice(route, route+1);
  return lesson.targets || [];
}
function renderBoard() {
  const hadFocus = document.activeElement?.closest('#board');
  const side = mode === 'game' ? human : 'w';
  const moves = !busy && !finished && !failed ? legalMoves(state, side) : [];
  const inspectingOpponent = selected !== null && state.board[selected]?.color !== side;
  const destinations = new Set(selected === null || inspectingOpponent ? [] : moves.filter(m => m.from === selected).map(m => m.to));
  const threats = progress.settings.threats ? attackMap(state, opposite(side)) : new Set();
  if (inspectingOpponent) attacksFrom(state,selected).forEach(i=>threats.add(i));
  const targets = targetSquares().map(index), king = kingSquare(state, state.turn), check = inCheck(state) ? king : -1;
  $('board').innerHTML = Array.from({length:64},(_,v) => {
    const i = flipped ? 63-v : v, p = state.board[i], target = targets.includes(i);
    const classes = ['square', (row(i)+file(i))%2 ? 'dark' : '', p ? 'occupied' : '', selected === i ? 'selected' : '', progress.settings.moves && destinations.has(i) ? 'legal' : '', threats.has(i) ? 'threat' : '', check === i ? 'check' : '', hinted.includes(i) ? 'hinted' : '', target ? 'target' : '', lastMove && [lastMove.from,lastMove.to].includes(i) ? 'last-move' : '', mode === 'trail' && lesson.goal.type === 'route' && lesson.goal.squares.slice(0,route).map(index).includes(i) ? 'route-done' : ''].filter(Boolean).join(' ');
    const label = `${square(i)}, ${p ? (p.color === 'w' ? 'ivory ' : 'violet ') + NAMES[p.type] : 'empty'}${target ? ', lantern target' : ''}${destinations.has(i) && progress.settings.moves ? ', legal destination' : ''}${threats.has(i) ? ', attacked by opponent' : ''}${selected === i ? ', selected' : ''}`;
    return `<button type="button" role="gridcell" class="${classes}" data-square="${i}" aria-label="${label}" aria-selected="${selected === i}" aria-rowindex="${Math.floor(v/8)+1}" aria-colindex="${v%8+1}" tabindex="${i === focusSquare ? 0 : -1}">${target ? `<span class="target-lantern">${lanternSVG()}</span>` : ''}${p ? pieceSVG(p.type,p.color) : ''}</button>`;
  }).join('');
  $('ranks').innerHTML = Array.from({length:8},(_,i) => `<span>${flipped ? i+1 : 8-i}</span>`).join('');
  $('files').innerHTML = (flipped ? 'hgfedcba' : 'abcdefgh').split('').map(f=>`<span>${f}</span>`).join('');
  if (hadFocus) $('board').querySelector(`[data-square="${focusSquare}"]`)?.focus({preventScroll:true});
  $('undo-button').disabled = !history.length || busy || (mode === 'game' && !history.some(h=>h.color===human));
  $('retry-button').disabled = busy;
  $('hint-button').disabled = busy || finished || mode === 'game';
  $('hint-button').hidden = mode === 'game';
  $('lesson-list-button').textContent = mode === 'game' ? 'Return to trail ↗' : 'Encounters ⌄';
  $('turn-dot').className = `${state.turn === 'b' ? 'violet' : ''} ${busy ? 'thinking' : ''}`;
  $('turn-label').textContent = mode === 'game' ? finished ? 'GAME COMPLETE' : busy ? 'MILO IS THINKING…' : state.turn === human ? `YOUR ${human === 'w' ? 'IVORY' : 'VIOLET'} PIECES` : 'MILO’S TURN' : finished ? 'A LITTLE DISCOVERY' : failed ? 'A CHANCE TO REWIND' : lesson.mode === 'inspect' ? 'LOOK CLOSELY' : 'YOUR IVORY PIECES';
  const turns = Math.ceil(history.length/2);
  $('goal-progress').textContent = mode === 'trail' ? lesson.goal.type === 'route' ? `${route} / ${lesson.goal.squares.length}` : history.length ? `${history.length} ${history.length === 1 ? 'MOVE' : 'MOVES'}` : '' : history.length ? `${turns} ${turns === 1 ? 'TURN' : 'TURNS'}` : '';
  renderInspector();
}
function renderInspector() {
  if (selected === null || !state.board[selected]) { $('inspector').innerHTML = '<p class="quiet-copy">Select a piece to discover<br>where it can go.</p>'; return; }
  const p = state.board[selected], legal = legalMoves(state,p.color).filter(m=>m.from===selected), destinations = new Set(legal.map(m=>m.to));
  const threatened = attackers(state,selected,opposite(p.color));
  const defended = attackers(state,selected,p.color);
  const detail = p.type === 'p' ? 'Forward to move, diagonal to capture. Attack markings show diagonal threats, not forward moves.' : p.type === 'k' ? 'One square in any direction, always away from attacks. Castling may also be available.' : HANDBOOK.find(h=>h[0]===NAMES[p.type])?.[2] || `${NAMES[p.type]} movement follows the usual chess rules.`;
  $('inspector').innerHTML = `<div class="piece-inspection">${pieceSVG(p.type,p.color)}<div><strong>${NAMES[p.type]}</strong><small>${p.color === 'w' ? 'IVORY' : 'VIOLET'} · ${square(selected).toUpperCase()}${VALUES[p.type] ? ` · ≈ ${Math.round(VALUES[p.type]/100)} ${p.type==='p' ? 'PAWN' : 'PAWNS'}` : ''}</small></div></div><p class="inspection-detail">${detail}</p><p class="inspection-detail">${destinations.size} legal destination${destinations.size === 1 ? '' : 's'}${threatened.length ? ` · attacked from ${threatened.map(square).join(', ')}` : ' · not currently attacked'}${defended.length ? ` · defended from ${defended.map(square).join(', ')}` : ''}</p>`;
}
function loadLesson(id) {
  if (!unlocked(id)) { toast('A few earlier discoveries will prepare you for this encounter.'); return; }
  epoch++; busy = false; pendingPromotion = null; closeDialogs(); mode = 'trail'; lesson = LESSONS[id]; state = fromFEN(lesson.fen);
  history = []; route = 0; selected = null; finished = false; failed = false; hintLevel = 0; hinted = []; lastMove = null; flipped = false;
  focusSquare = state.board.findIndex(p=>p?.color==='w' && (!lesson.allowed || lesson.allowed.includes(p.type)));
  if (focusSquare < 0) focusSquare = index('a1');
  progress.current = id;
  const region = REGIONS[lesson.region], local = regionLessons(lesson.region), number = local.findIndex(l=>l.id===id)+1;
  $('region-name').textContent = region.name; $('region-icon').textContent = region.symbol;
  $('lesson-number').textContent = `ENCOUNTER ${String(number).padStart(2,'0')} / ${String(local.length).padStart(2,'0')}`;
  $('region-scene').innerHTML = worldSVG(restored(),lesson.region);
  $('scene-caption').textContent = ['A first step into the meadow.','Listen. Look. A little further.','A safe place for a small king.','Good ideas grow in high places.','A few surprises across the river.','The stars are closer than you think.'][lesson.region];
  $('mode-label').textContent = lesson.mode === 'drill' ? 'MOVEMENT DRILL · NO OPPONENT TURNS' : lesson.mode === 'inspect' ? 'OBSERVATION CHALLENGE' : lesson.maxMoves > 1 ? 'CHESS ENCOUNTER · TWO OF YOUR MOVES' : 'CHESS PUZZLE · SOLVE IN ONE MOVE';
  $('lesson-title').textContent = lesson.title; $('objective').textContent = lesson.objective;
  $('board-objective').textContent = lesson.objective;
  $('guide-greeting').textContent = 'Small steps. Big discoveries.';
  $('pocket-tip').innerHTML = ['You don’t need to be clever.<br><em>Just curious.</em>','Before you leap,<br><em>take a little look.</em>','Even a king<br><em>needs a friend.</em>','A little foresight.<br><em>A lovely surprise.</em>','The small pieces<br><em>have big futures.</em>','You know more<br><em>than when you arrived.</em>'][lesson.region];
  $('hint-note').hidden = true; $('mobile-hint').hidden = true; $('hint-count').textContent = ''; $('result').hidden = true; $('move-log-card').hidden = true;
  $('retry-button').innerHTML = '<span aria-hidden="true">↻</span> Start over';
  feedback(lesson.intro); applySettings(); renderJourney(); renderBoard(); save();
}
function goalReached(move, before, captured) {
  const g = lesson.goal, moved = before.board[move.from];
  if (g.minMoves && history.length < g.minMoves) return false;
  if (g.piece && moved.type !== g.piece) return false;
  switch (g.type) {
    case 'reach': return g.squares.map(index).includes(move.to) && (!g.safe || !attacked(state,move.to,'b'));
    case 'route': return route >= g.squares.length;
    case 'capture': return Boolean(captured) && move.to === index(g.square);
    case 'safeCapture': return Boolean(captured) && captured.color === 'b' && (!g.square || move.to === index(g.square)) && state.board[move.to]?.color === 'w' && !attacked(state,move.to,'b');
    case 'defend': return state.board[index(g.square)]?.color === 'w' && attacked(state,index(g.square),'w');
    case 'safe': return state.board[move.to]?.color === 'w' && !attacked(state,move.to,'b');
    case 'escape': return !inCheck(state,'w');
    case 'mate': return state.turn === 'b' && status(state) === 'checkmate';
    case 'stalemate': return state.turn === 'b' && status(state) === 'stalemate';
    case 'fork': {
      const attackedPieces = attacksFrom(state,move.to).map(i=>state.board[i]).filter(p=>p?.color==='b').map(p=>p.type);
      return g.pieces.every(type=>attackedPieces.includes(type));
    }
    case 'pin': {
      const target = index(g.square), piece = state.board[target];
      if (piece?.color !== 'b' || !attacksFrom(state,move.to).includes(target) || inCheck(state,'b')) return false;
      const removed = { ...state, board:state.board.slice() }; removed.board[target] = null;
      return inCheck(removed,'b');
    }
    case 'skewer': {
      if (!inCheck(state,'b')) return false;
      if (legalMoves(state,'b').some(reply=>reply.to===move.to)) return false;
      const removed = { ...state, board:state.board.slice() }; removed.board[kingSquare(state,'b')] = null;
      return attacksFrom(removed,move.to).includes(index(g.square)) && state.board[index(g.square)]?.color === 'b';
    }
    case 'material': {
      const material = position => position.board.reduce((total,p)=>total+(p ? (p.color==='w' ? 1 : -1)*VALUES[p.type] : 0),0);
      return material(state) - material(fromFEN(lesson.fen)) >= g.gain;
    }
    case 'trade': return Boolean(captured) && move.to === index(g.square) && VALUES[captured.type] === VALUES[moved.type];
    case 'promotion': return Boolean(move.promotion);
    case 'castle': return Boolean(move.castling) && (g.side === 'king' ? move.to > move.from : move.to < move.from);
    case 'enPassant': return Boolean(move.enPassant);
    default: return false;
  }
}
function completeLesson() {
  finished = true; failed = false; selected = null; hinted = [];
  const newlyCompleted = !progress.completed.includes(lesson.id);
  if (newlyCompleted) progress.completed.push(lesson.id);
  const regionDone = regionCount(lesson.region) === regionLessons(lesson.region).length && (newlyCompleted || lesson.id === regionLessons(lesson.region).at(-1).id);
  const allDone = progress.completed.length === LESSONS.length && lesson.id === LESSONS.length-1;
  const next = LESSONS[lesson.id+1];
  $('result').className = 'result-card';
  $('result').innerHTML = `<p class="eyebrow">${allDone ? 'THE OBSERVATORY IS AWAKE' : regionDone ? REGIONS[lesson.region].badge.toUpperCase() + ' STAMP DISCOVERED' : 'A LANTERN LIT'}</p><h3>${allDone ? 'Look how far you’ve come.' : regionDone ? REGIONS[lesson.region].name + ', restored.' : 'A lovely little discovery.'}</h3><p>${lesson.success}${regionDone ? '<br><br>' + REGIONS[lesson.region].reward : ''}</p><button id="continue-button" class="primary-button">${next ? 'Keep exploring' : 'Play a friendly game'} <span aria-hidden="true">↗</span></button>${allDone ? '<button id="complete-map-button" class="secondary-button">See your restored world</button>' : ''}`;
  $('result').hidden = false;
  feedback(lesson.success,'success'); $('guide-greeting').textContent = 'You found your own way.';
  $('continue-button').addEventListener('click',()=> { if (next) loadLesson(next.id); else showPractice(); });
  $('complete-map-button')?.addEventListener('click',showMap);
  renderJourney(); renderBoard(); save(); sound('win');
  if (newlyCompleted && regionDone) toast(`${REGIONS[lesson.region].badge} stamp discovered. ${REGIONS[lesson.region].name} restored!`);
}
function showFailure(message) {
  failed = true; selected = null;
  feedback(message,'error');
  $('result').className = 'result-card failure';
  $('result').innerHTML = '<p class="eyebrow">EVERY TRY TEACHES YOU SOMETHING</p><h3>A chance to look again.</h3><p>That move is legal, but this mission needs a different idea. Rewind, inspect the board, or ask Milo for a hint.</p><button id="rewind-result-button" class="primary-button">Rewind that move <span aria-hidden="true">↶</span></button>';
  $('result').hidden = false;
  $('rewind-result-button').addEventListener('click',undo);
  renderBoard(); sound('error');
}
function makeLessonMove(move) {
  const before = state, captured = before.board[move.to] || (move.enPassant ? before.board[move.to+8] : null);
  history.push({ before:toFEN(before), route, lastMove, feedback:$('feedback').textContent });
  state = applyMove(before,move); lastMove = move; selected = null; focusSquare = move.to; hinted = [];
  if (lesson.goal.type === 'route' && move.to === index(lesson.goal.squares[route])) route++;
  sound(captured ? 'capture' : 'move');
  const candidate = goalReached(move,before,captured);
  if (lesson.refute && captured && attacked(state,move.to,'b')) {
    const reply = legalMoves(state,'b').find(m=>m.to===move.to);
    if (reply) {
      const attacker = NAMES[state.board[reply.from].type], text = notation(state,reply);
      state = applyMove(state,reply); lastMove = reply;
      showFailure(`The violet ${attacker} can capture your ${NAMES[before.board[move.from].type]} back (${text}). The destination was defended. Nothing is lost from your progress—rewind and inspect the other options.`);
      return;
    }
  }
  let replyText = '';
  const replyCode = lesson.replies?.[history.length-1];
  if (replyCode) {
    // Unexpected human moves still get a legal reply instead of skipping a turn.
    const reply = legalMoves(state,'b').find(m=>m.from===index(replyCode.slice(0,2)) && m.to===index(replyCode.slice(2,4))) || chooseMove(state,'thoughtful');
    if (reply) { replyText = notation(state,reply); state = applyMove(state,reply); lastMove = reply; sound('move'); }
  }
  // A trade is judged before the deliberate recapture; other goals use the final board.
  if (lesson.goal.type === 'trade' ? candidate : goalReached(move,before,captured)) { completeLesson(); return; }
  if (history.length >= lesson.maxMoves) {
    showFailure(lesson.goal.type === 'mate' && status({...state,turn:'b'}) === 'stalemate' ? 'The opponent has no legal move, but the king is not in check. That is stalemate—a draw. Try giving check while covering the escapes.' : 'That move is legal. Look again at the mission, and consider what your piece needs to do. You can rewind without losing any progress.');
    return;
  }
  state = { ...state, turn:'w' };
  feedback(replyText ? `Violet replies ${replyText}. The board has changed—look again before your next move.` : lesson.goal.type === 'route' && route > 0 ? `Lantern ${route} is lit. Now follow another straight path to ${lesson.goal.squares[route]}.` : 'A legal step. Keep looking for a clear path to your mission.');
  renderBoard();
}
function activateSquare(i) {
  focusSquare = i;
  if (busy || finished || failed || (mode === 'game' && state.turn !== human)) return;
  const p = state.board[i], side = mode === 'game' ? human : 'w';
  if (mode === 'trail' && lesson.mode === 'inspect') {
    selected = i;
    if (lesson.goal.squares.map(index).includes(i)) { completeLesson(); }
    else { feedback(p ? 'Trace the violet attacks and look for the ivory piece in this mission. Selecting is enough; no move is needed.' : 'Look at the pieces, rather than an empty square. Follow the violet lines to see who is in danger.'); renderBoard(); sound('select'); }
    return;
  }
  if (p?.color === side) {
    if (mode === 'trail' && lesson.allowed && !lesson.allowed.includes(p.type)) { feedback(`This encounter practises your ${lesson.allowed.map(t=>NAMES[t]).join(' or ')}. Select that piece to explore its movement.`); return; }
    selected = selected === i ? null : i; hinted = []; sound('select'); renderBoard();
    if (mode === 'game' && selected !== null) coachSelection(i);
    return;
  }
  if (p && (selected === null || state.board[selected]?.color !== side)) {
    selected = selected === i ? null : i;
    feedback(`Inspecting the ${p.color==='w' ? 'ivory' : 'violet'} ${NAMES[p.type]} on ${square(i)}. The × marks show its attacks. Select one of your own pieces when you are ready to move.`);
    renderBoard(); sound('select'); return;
  }
  if (selected !== null && state.board[selected]?.color !== side) { feedback('You are inspecting an opponent’s piece. Select one of your own pieces to make a move.'); return; }
  if (selected === null) { feedback('Select one of your pieces first, then select where you want it to go.'); return; }
  const moves = legalMoves(state,side).filter(m=>m.from===selected && m.to===i);
  if (!moves.length) { feedback(explainIllegal(state,selected,i),'error'); sound('error'); return; }
  if (moves.some(m=>m.promotion)) { showPromotion(moves); return; }
  if (mode === 'trail') makeLessonMove(moves[0]); else makeGameMove(moves[0]);
}
function showPromotion(moves) {
  pendingPromotion = { moves, epoch };
  $('promotion-choices').innerHTML = moves.map(m=>`<button class="promotion-choice" data-promotion="${m.promotion}">${pieceSVG(m.promotion,state.board[m.from].color)}<span>${NAMES[m.promotion]}</span></button>`).join('');
  openDialog('promotion-dialog');
}
function undo() {
  if (busy || !history.length) return;
  epoch++; finished = false; failed = false; hinted = []; selected = null; $('result').hidden = true;
  if (mode === 'trail') {
    const entry = history.pop(); state = fromFEN(entry.before); route = entry.route; lastMove = entry.lastMove;
    feedback('Rewound. You can try a different idea, inspect threats, or use a hint.');
  } else {
    // Rewind the human move and its computer reply as one decision.
    if (history.at(-1)?.color !== human) { const reply = history.pop(); state = fromFEN(reply.before); }
    if (history.at(-1)?.color === human) { const move = history.pop(); state = fromFEN(move.before); }
    lastMove = history.at(-1)?.move || null;
    feedback('Your decision is rewound. Look at the position again and try another plan.'); renderMoveLog();
    if (state.turn !== human) { renderBoard(); save(); requestOpponent(); return; }
  }
  focusSquare = kingSquare(state, mode === 'game' ? human : 'w'); if (focusSquare < 0) focusSquare = index('a1');
  renderBoard(); save(); sound('move');
}
function giveHint() {
  if (mode !== 'trail' || finished || busy) return;
  hintLevel = Math.min(hintLevel+1,lesson.hints.length);
  $('hint-note').innerHTML = `<span>HINT ${hintLevel} OF ${lesson.hints.length} · NO PENALTY</span>${lesson.hints[hintLevel-1]}`;
  $('hint-note').hidden = false; $('hint-count').textContent = `${hintLevel}/${lesson.hints.length}`;
  $('mobile-hint').textContent = `Hint ${hintLevel} of ${lesson.hints.length}: ${lesson.hints[hintLevel-1]}`;
  $('mobile-hint').hidden = false;
  if (hintLevel === lesson.hints.length) {
    const words = lesson.hints.at(-1).match(/\b[a-h][1-8]\b/g) || [];
    hinted = [...new Set(words.map(index))];
  }
  renderBoard(); sound('hint');
}
function showMap() {
  $('map-title').textContent = progress.completed.length === LESSONS.length ? 'A world full of light.' : 'A world waiting for light.';
  $('full-world').innerHTML = worldSVG(restored()) + REGIONS.map((r,i)=>`<button class="map-node ${restored().includes(i) ? 'complete' : ''}" data-map-region="${i}" style="left:${r.x/10}%;top:${r.y/4.4}%" ${unlocked(regionLessons(i)[0].id) ? '' : 'disabled'} aria-label="Explore ${r.name}">${restored().includes(i) ? '✓' : i+1}</button>`).join('');
  $('map-regions').innerHTML = REGIONS.map((r,i)=>`<button class="map-region" data-map-region="${i}" ${unlocked(regionLessons(i)[0].id) ? '' : 'disabled'}><strong>${r.symbol} ${r.name}</strong><span>${r.subtitle}</span><small>${regionCount(i)} / ${regionLessons(i).length} DISCOVERIES${restored().includes(i) ? ' · RESTORED' : ''}</small></button>`).join('');
  openDialog('map-dialog'); sound('map');
}
function showLessons(region) {
  $('lessons-subtitle').textContent = REGIONS[region].name;
  $('lesson-choices').innerHTML = regionLessons(region).map((l,i)=>`<button class="lesson-choice" data-lesson="${l.id}" ${unlocked(l.id) ? '' : 'disabled'}><span class="lesson-marker">${String(i+1).padStart(2,'0')}</span><span><strong>${l.title}</strong><small>${l.objective}</small></span><span class="lesson-state">${progress.completed.includes(l.id) ? '✓' : unlocked(l.id) ? '›' : '·'}</span></button>`).join('');
  openDialog('lessons-dialog');
}
function showBook() {
  const discovered = new Set(progress.completed.map(id=>LESSONS[id].concept));
  const pieceTypes = { rook:'r', bishop:'b', knight:'n', queen:'q', pawn:'p', king:'k' };
  $('book-entries').innerHTML = HANDBOOK.map(([key,title,text])=>`<article class="book-entry ${discovered.has(key) ? 'discovered' : ''}">${pieceTypes[key] ? `<div class="book-piece">${pieceSVG(pieceTypes[key])}</div>` : ''}<h3>${title}</h3><p>${text}</p>${discovered.has(key) ? '<span class="discovery-stamp">✦ DISCOVERED ON THE TRAIL</span>' : ''}</article>`).join('');
  openDialog('book-dialog');
}
function showPractice() { $('resume-game-button').hidden = !progress.game || progress.game.finished; openDialog('practice-dialog'); }
function setGameUI() {
  $('region-name').textContent = 'The Friendly Table'; $('region-icon').textContent = '♟'; $('lesson-number').textContent = 'NO CLOCK · NO PRESSURE';
  $('region-scene').innerHTML = worldSVG(restored(),5); $('scene-caption').textContent = 'A quiet table under the stars.';
  $('mode-label').textContent = 'ORDINARY CHESS · ALL THE USUAL RULES'; $('lesson-title').textContent = 'A game with Milo'; $('objective').textContent = 'Keep your king safe, make a plan, and aim for checkmate.';
  $('board-objective').textContent = 'Take your time. Keep your king safe and aim for checkmate.';
  $('guide-greeting').textContent = 'A friendly game. Take your time.'; $('pocket-tip').innerHTML = 'What changed?<br><em>What could happen next?</em>';
  $('hint-note').hidden = true; $('mobile-hint').hidden = true; $('result').hidden = true; $('move-log-card').hidden = false; $('retry-button').innerHTML = '<span aria-hidden="true">↻</span> New game';
  applySettings(); renderJourney(); renderBoard(); renderMoveLog();
}
function startGame(resume = false) {
  epoch++; busy = false; mode = 'game'; selected = null; hinted = []; pendingPromotion = null; failed = false; finished = false; hintLevel = 0;
  closeDialogs();
  if (resume && progress.game) {
    const g = progress.game; state = fromFEN(g.fen); human = g.human; level = g.level; history = g.history; gameInitial = g.initial || START; lastMove = history.at(-1)?.move || null;
  } else {
    human = $('practice-side').value; level = $('practice-level').value;
    const endgames = { queen:'5k2/8/8/8/8/3Q1K2/8/8 w - - 0 1', rook:'5k2/8/8/8/8/R4K2/8/8 w - - 0 1' };
    state = fromFEN(endgames[$('practice-position').value] || START);
    if ($('practice-position').value !== 'standard' && human === 'b') state = { ...state, turn:'b', board:state.board.map(p=>p ? {...p,color:opposite(p.color)} : null) };
    history = []; gameInitial = toFEN(state); lastMove = null;
  }
  flipped = human === 'b'; focusSquare = kingSquare(state,human);
  setGameUI(); feedback(`You are playing ${human === 'w' ? 'ivory (White)' : 'violet (Black)'}. ${state.turn === human ? 'Your move.' : 'Milo moves first.'} Select a piece to inspect its moves. The Threats button marks squares attacked by your opponent.`); save();
  if (!finishGameIfNeeded() && state.turn !== human) requestOpponent();
}
function coachSelection(i) {
  const p = state.board[i], threats = attackers(state,i,opposite(human));
  if (inCheck(state,human)) feedback('Your king is in check. Find a legal escape, block the attacking line, or capture the attacker. The move guide includes only moves that remove the check.');
  else if (threats.length) feedback(`Your ${NAMES[p.type]} is attacked from ${threats.map(square).join(', ')}. Look at its defenders and safe destinations before deciding.`);
  else feedback(`Your ${NAMES[p.type]} is not currently attacked. Inspect your opponent’s threats, then consider how this piece can help your plan.`);
}
function recordGameMove(move) {
  const before = state, text = notation(before,move), capture = before.board[move.to] || move.enPassant;
  state = applyMove(before,move);
  history.push({ before:toFEN(before), after:toFEN(state), move, text, color:before.turn, key:positionKey(state) });
  lastMove = move; selected = null; hinted = []; focusSquare = move.to;
  sound(capture ? 'capture' : 'move'); renderBoard(); renderMoveLog(); save();
  return text;
}
function makeGameMove(move) {
  const moved = state.board[move.from], text = recordGameMove(move);
  if (finishGameIfNeeded()) return;
  const threat = attackers(state,move.to,opposite(human));
  feedback(threat.length ? `${text} is legal. Your ${NAMES[moved.type]} can now be attacked from ${threat.map(square).join(', ')}. Watch the reply, and rewind if you want to explore another idea.` : `${text}. Now it is Milo’s turn. Watch what changes before choosing your next move.`);
  requestOpponent();
}
function askOpponent(position, difficulty, requestId) {
  if (!worker) return Promise.resolve(chooseMove(position,difficulty));
  return new Promise(resolve => {
    const timer = setTimeout(()=> { cleanup(); resolve(chooseMove(position,'gentle')); },6000);
    const receive = event => { if (event.data.id === requestId) { cleanup(); resolve(event.data.move); } };
    const error = () => { cleanup(); worker?.terminate(); worker = null; resolve(chooseMove(position,'gentle')); };
    function cleanup() { clearTimeout(timer); worker?.removeEventListener('message',receive); worker?.removeEventListener('error',error); }
    worker.addEventListener('message',receive); worker.addEventListener('error',error,{once:true}); worker.postMessage({ state:position, level:difficulty, id:requestId });
  });
}
async function requestOpponent() {
  if (mode !== 'game' || finished || state.turn === human) return;
  const requestId = ++epoch; busy = true; renderBoard();
  const position = state;
  const move = await askOpponent(position,level,requestId);
  if (requestId !== epoch || mode !== 'game') return;
  busy = false;
  const currentMoves = legalMoves(state);
  const legal = move && currentMoves.find(m=>m.from===move.from && m.to===move.to && m.promotion===move.promotion);
  if (!legal) { if (!finishGameIfNeeded()) { feedback('Milo could not choose a move. Rewind or start a fresh game to continue.'); renderBoard(); } return; }
  const text = recordGameMove(legal);
  if (finishGameIfNeeded()) return;
  if (inCheck(state,human)) feedback(`Milo played ${text}. Your king is in check. Select a piece to find a legal way to remove the attack.`);
  else {
    const endangered = state.board.map((p,i)=>({p,i})).filter(({p,i})=>p?.color===human && p.type!=='k' && attacked(state,i,opposite(human)) && !attacked(state,i,human));
    feedback(endangered.length ? `Milo played ${text}. Your ${NAMES[endangered[0].p.type]} on ${square(endangered[0].i)} is attacked and undefended. Inspect the threats before moving.` : `Milo played ${text}. Your turn: look for checks, useful captures, and threats to your own pieces.`);
  }
  renderBoard(); save();
}
function repetitionCount() {
  const key = positionKey(state);
  return (positionKey(fromFEN(gameInitial)) === key ? 1 : 0) + history.filter(h=>h.key===key).length;
}
function finishGameIfNeeded() {
  const result = status(state);
  if (result === 'checkmate') { gameResult(state.turn !== human ? 'A well-earned checkmate.' : 'A game full of discoveries.', state.turn !== human ? 'You checkmated Milo. The king is attacked and has no legal escape. Take a moment to enjoy it.' : 'Milo delivered checkmate. You can rewind the last decision and see whether a different move keeps the game alive.'); return true; }
  const reason = result === 'stalemate' ? 'Stalemate: the player to move has no legal move and their king is not in check.' : result === 'dead' ? 'Neither side can possibly deliver checkmate with the pieces remaining.' : repetitionCount() >= 5 ? 'The same position occurred five times. This is an automatic draw.' : state.half >= 150 ? 'Seventy-five moves by each side passed without a pawn move or capture. This is an automatic draw.' : null;
  if (reason) { gameResult('A peaceful draw.',reason); return true; }
  return false;
}
function gameResult(title,message) {
  finished = true; busy = false; selected = null;
  $('result').className = 'result-card'; $('result').innerHTML = `<p class="eyebrow">EVERY GAME HAS SOMETHING TO TEACH YOU</p><h3>${title}</h3><p>${message}</p><button id="another-game-button" class="primary-button">Another friendly game <span aria-hidden="true">↗</span></button><button id="return-trail-button" class="secondary-button">Return to your trail</button>`;
  $('result').hidden = false; $('another-game-button').addEventListener('click',showPractice); $('return-trail-button').addEventListener('click',()=>loadLesson(progress.current));
  feedback(message,'success'); renderBoard(); renderMoveLog(); save(); sound('win');
}
function renderMoveLog() {
  $('move-log').replaceChildren();
  const rows = new Map();
  for (const h of history) {
    const before = fromFEN(h.before); const number = before.full;
    if (!rows.has(number)) rows.set(number,{w:null,b:null});
    rows.get(number)[h.color] = h;
  }
  for (const [number,moves] of rows) {
    for (const [text, cls] of [[number+'.','move-number'],[moves.w?.text || '…',moves.w===history.at(-1)?'move-current':''],[moves.b?.text || '',moves.b===history.at(-1)?'move-current':'']]) {
      const span = document.createElement('span'); span.className = cls; span.textContent = text; $('move-log').append(span);
    }
  }
  $('move-log').scrollTop = $('move-log').scrollHeight;
  const canClaim = !finished && !busy && state.turn === human && (state.half >= 100 || repetitionCount() >= 3);
  $('game-extra').innerHTML = `${canClaim ? '<button id="claim-draw-button" class="secondary-button">Claim a draw</button>' : ''}${finished ? '' : '<button id="resign-button" class="danger-button">End this game…</button>'}`;
  $('claim-draw-button')?.addEventListener('click',()=>gameResult('A draw, claimed.',state.half>=100 ? 'Fifty moves by each side without a pawn move or capture: you may claim a draw.' : 'This position occurred three times: you may claim a draw.'));
  $('resign-button')?.addEventListener('click',()=> {
    if (busy) { toast('Let Milo finish this move, then end the game.'); return; }
    $('resign-button').textContent = 'Confirm: end game';
    $('resign-button').onclick = ()=>gameResult('A pause along the journey.','You ended this game. Return to the trail, start another game, or rewind your last decision.');
  },{once:true});
}
$('brand-lantern').innerHTML = lanternSVG(); $('goal-icon').innerHTML = lanternSVG(); $('guide-portrait').innerHTML = guideSVG();
$('board').addEventListener('click',event=> { const cell = event.target.closest('[data-square]'); if (cell) activateSquare(Number(cell.dataset.square)); });
$('board').addEventListener('keydown',event=> {
  const cell = event.target.closest('[data-square]'); if (!cell) return;
  const i = Number(cell.dataset.square), visual = flipped ? 63-i : i;
  const deltas = { ArrowLeft:[0,-1], ArrowRight:[0,1], ArrowUp:[-1,0], ArrowDown:[1,0] };
  if (!deltas[event.key]) return;
  event.preventDefault(); const [dr,df] = deltas[event.key];
  const r = Math.max(0,Math.min(7,row(visual)+dr)), f = Math.max(0,Math.min(7,file(visual)+df));
  focusSquare = flipped ? 63-(r*8+f) : r*8+f;
  $('board').querySelectorAll('[tabindex="0"]').forEach(b=>b.tabIndex=-1);
  const next = $('board').querySelector(`[data-square="${focusSquare}"]`); next.tabIndex = 0; next.focus({preventScroll:true});
});
document.addEventListener('keydown',event=> {
  if (document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
  if (event.key.toLowerCase()==='h') { event.preventDefault(); giveHint(); }
  if (event.key.toLowerCase()==='u') { event.preventDefault(); undo(); }
  if (event.key==='Escape' && selected!==null) { selected=null; renderBoard(); }
});
$('region-list').addEventListener('click',event=> { const b=event.target.closest('[data-region]'); if(b) showLessons(Number(b.dataset.region)); });
$('map-button').addEventListener('click',showMap); $('book-button').addEventListener('click',showBook); $('practice-button').addEventListener('click',showPractice);
$('lesson-list-button').addEventListener('click',()=> { if(mode==='game') loadLesson(progress.current); else showLessons(lesson.region); });
$('map-dialog').addEventListener('click',event=> { const b=event.target.closest('[data-map-region]'); if(b && !b.disabled) showLessons(Number(b.dataset.mapRegion)); });
$('lessons-dialog').addEventListener('click',event=> { const b=event.target.closest('[data-lesson]'); if(b && !b.disabled) loadLesson(Number(b.dataset.lesson)); });
$('undo-button').addEventListener('click',undo); $('retry-button').addEventListener('click',()=> mode==='trail' ? loadLesson(lesson.id) : showPractice()); $('hint-button').addEventListener('click',giveHint);
$('moves-button').addEventListener('click',()=> { progress.settings.moves=!progress.settings.moves; applySettings(); renderBoard(); save(); });
$('threats-button').addEventListener('click',()=> {
  progress.settings.threats=!progress.settings.threats; applySettings(); renderBoard(); save();
  if(progress.settings.threats) toast('× marks squares attacked by your opponent. Pawn attacks differ from pawn movement.');
});
$('flip-button').addEventListener('click',()=> { flipped=!flipped; renderBoard(); });
$('settings-button').addEventListener('click',()=> {
  for(const [id,key] of [['sound','sound'],['moves','moves'],['coords','coords'],['motion','motion']]) $('setting-'+id).checked=progress.settings[key];
  openDialog('settings-dialog');
});
for(const [id,key] of [['sound','sound'],['moves','moves'],['coords','coords'],['motion','motion']]) $('setting-'+id).addEventListener('change',event=> { progress.settings[key]=event.target.checked; applySettings(); renderBoard(); save(); if(key==='sound') sound('hint'); });
$('start-game-button').addEventListener('click',()=>startGame()); $('resume-game-button').addEventListener('click',()=>startGame(true));
$('reset-button').addEventListener('click',()=>openDialog('reset-dialog'));
$('confirm-reset-button').addEventListener('click',()=> { progress.completed=[]; progress.current=0; loadLesson(0); toast('A fresh trail. Your preferences and saved chess game are kept.'); });
$('promotion-choices').addEventListener('click',event=> {
  const b=event.target.closest('[data-promotion]'); if(!b || !pendingPromotion || pendingPromotion.epoch!==epoch) return;
  const move=pendingPromotion.moves.find(m=>m.promotion===b.dataset.promotion); pendingPromotion=null; $('promotion-dialog').close();
  if(mode==='trail') makeLessonMove(move); else makeGameMove(move);
});
$('promotion-dialog').addEventListener('cancel',()=> { pendingPromotion=null; });
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
// Start where the traveller left off, without making completed exercises a gate.
loadLesson(unlocked(progress.current) ? progress.current : firstUnfinished());
