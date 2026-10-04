// The level screen: intro dialogue, then one of the four level kinds.
import { Position, WHITE, BLACK, QUEEN, typeOf, colorOf, mFrom, mTo, mFlags, F_CAPTURE, F_PROMO, sqParse, sqName, uci, START_FEN } from './chess.js';
import { BoardView } from './board.js';
import { h, Speech, button, starsRow, modal, toast, banner, confetti, richEl, linkSquares, portrait, CHAR_NAMES, materialStrip } from './ui.js';
import { pixelText } from './font.js';
import { sfx, playMusic } from './audio.js';
import { save, recordLevel, unlockCodex } from './save.js';
import { makePosition, collectSetup, collectMoves, collectSolve, capturedPiece, quizPosition, quizAnswer, FREE_RULES, illegalReason } from './levelkit.js';
import { attackMap, hangingPieces } from './coach.js';
import { Game, BOT_LINES } from './game.js';
import { turnAdvice, captureNote } from './battlecoach.js';
import { ask } from './ai.js';
import { nextLevel } from './curriculum.js';
import { CODEX } from './codex-data.js';

const wait = ms => new Promise(r => setTimeout(r, ms));
const pick = a => a[Math.floor(Math.random() * a.length)];

export function playLayout(app, { title, subtitle, onBack, backLabel = 'Map' }) {
  const backBtn = button('◀ ' + backLabel, onBack, 'small ghost back');
  const hudRight = h('div', { class: 'hud-right' });
  const header = h('header', { class: 'hud' }, backBtn, h('div', { class: 'hud-title' }, h('span', { class: 'hud-sub' }, subtitle || ''), h('span', { class: 'hud-main' }, title)), hudRight);
  const boardBox = h('div', { class: 'board-box' });
  const boardArea = h('div', { class: 'board-area' }, boardBox);
  const side = h('aside', { class: 'side' });
  const root = h('div', { class: 'screen play-screen' }, header, h('main', { class: 'stage' }, boardArea, side));
  app.replaceChildren(root);
  return { root, header, hudRight, boardBox, boardArea, side };
}

// Board + speech + goal card + controls, shared by levels, practice and the gym.
export function createPlayCtx(app, { title, subtitle, onBack, backLabel = 'Map' }) {
  const ui = playLayout(app, { title, subtitle, onBack, backLabel });
  const board = new BoardView(ui.boardBox, { theme: save.settings.theme });
  board.coords = save.settings.coords !== false;
  const speech = new Speech(ui.side);
  const goalCard = h('div', { class: 'goal-card' }, h('div', { class: 'goal-text' }), h('div', { class: 'goal-progress' }));
  const choices = h('div', { class: 'choices' });
  const controls = h('div', { class: 'controls' });
  ui.side.append(goalCard, choices, controls);
  linkSquares(ui.side, board);
  const counter = h('span', { class: 'hud-counter' });
  ui.hudRight.append(counter);
  const ctx = {
    board, speech, ui, choices, controls, counter,
    alive: true, mistakes: 0, hints: 0, moveWaiter: null,
    setGoal(text, progress = '') { const gt = goalCard.querySelector('.goal-text'); gt.innerHTML = ''; gt.append(richEl('span', text)); goalCard.querySelector('.goal-progress').innerHTML = progress; goalCard.hidden = !text; },
    setProgress(html) { goalCard.querySelector('.goal-progress').innerHTML = html; },
    setControls(list) { controls.replaceChildren(...list.filter(Boolean)); },
    waitMove() { return new Promise(res => { ctx.moveWaiter = res; board.onMove = moves => { const r = ctx.moveWaiter; ctx.moveWaiter = null; r?.(moves); }; }); },
    waitTap() { return new Promise(res => { ctx.tapWaiter = res; board.onTap = sq => { const r = ctx.tapWaiter; ctx.tapWaiter = null; r?.(sq); }; }); },
    destroy() {
      ctx.alive = false;
      ctx.game?.destroy();
      ctx.moveWaiter?.(null); ctx.tapWaiter?.(null); ctx.choiceWaiter?.(null);
      speech.destroy();
      board.destroy();
    },
  };
  ctx.setGoal('');
  return ctx;
}

export function levelScreen(app, L, nav) {
  const world = L.world;
  const ctx = createPlayCtx(app, {
    title: L.title, subtitle: `Rank ${world.rank} · ${world.name}`,
    onBack: async () => {
      // Don't throw away a battle in progress by accident.
      const g = ctx.game;
      if (g && g.history.length && !g.over && !(await modal({ title: 'Leave the battle?', body: 'Your progress in this game will be lost.', buttons: [{ label: 'Stay', value: false, cls: 'ghost' }, { label: 'Leave', value: true, cls: 'coral' }] }))) return;
      nav.map(world.id);
    },
  });
  ctx.L = L; ctx.nav = nav;
  if(nav.resume?.hash===location.hash){ctx.resume=nav.resume;nav.resume=null;}
  window.pawnQuest.active={capture:()=>({hash:location.hash,battle:ctx.captureBattle?.()||null,lesson:ctx.captureLesson?.()||null})};

  playMusic(L.kind === 'battle' ? 'battle' : 'calm');
  run(ctx).catch(e => { if (ctx.alive) { console.error(e); ctx.speech.show('Hoo... something went wrong: ' + e.message); } });
  return () => ctx.destroy();
}

// ---------------------------------------------------------------- intro demos

export function applyDemo(board, d) {
  if (!d) return;
  const pos = d.fen ? makePosition({ fen: d.fen }, { variant: 'standard' }) : makePosition({ setup: d.setup || '' }, FREE_RULES);
  board.setPosition(pos);
  board.clearAnnotations();
  board.threat = d.danger ? attackMap(pos, BLACK) : null;
  board.hanging = []; board.opportunities = [];
  for (const [sq, kind] of Object.entries(d.marks || {})) board.marks.set(sqParse(sq), kind);
  board.arrows = (d.arrows || []).map(([a, b, c]) => ({ from: sqParse(a), to: sqParse(b), color: c || 'hint' }));
  board.lastMove = null;
  if (d.legal) {
    const from = sqParse(d.legal);
    pos.turn = colorOf(pos.b[from]);
    board.legalFor = sq => sq === from ? pos.gen([]).filter(m => mFrom(m) === from) : [];
    board.selected = from;
  } else board.selected = -1;
}

async function intro(ctx) {
  const { L, speech, board } = ctx;
  if (!L.intro?.length) return;
  board.interactive = false;
  const lines = L.intro.map(l => typeof l === 'string' ? { text: l } : { ...l, onShow: () => l.board && applyDemo(board, l.board) });
  const skip = button('Skip intro ▸▸', () => { ctx.skipIntro = true; speech.skipAll(); }, 'small ghost');
  ctx.setControls([skip]);
  for (const line of lines) {
    if (!ctx.alive || ctx.skipIntro) break;
    if (line.who && line.who !== 'pip') { board.dim = 0; }
    await speech.say([line], line.who || 'pip');
  }
  ctx.skipIntro = false;
  board.selected = -1;
  ctx.setControls([]);
}

// Show the level's opening position while Pip talks.
function preview(ctx, L) {
  const { board } = ctx;
  try {
    if (L.kind === 'collect') {
      const { pos, stars, targets } = collectSetup(L);
      board.setPosition(pos); board.clearAnnotations();
      stars.forEach(s => board.marks.set(s, 'star')); targets.forEach(t => board.marks.set(t, 'target'));
      board.threat = L.showDanger ? attackMap(pos, BLACK) : null;
    } else if (L.kind === 'battle') {
      board.setPosition(makePosition(L, { castling: true, enPassant: true, checks: true, ...L.rules }));
      board.clearAnnotations();
    } else if (L.kind === 'quiz') { board.setPosition(quizPosition(L.questions[0])); board.clearAnnotations(); }
    else if (L.puzzles) { board.setPosition(makePosition(L.puzzles[0], { variant: 'standard' })); board.clearAnnotations(); }
    else board.setPosition(makePosition({ setup: '' }, FREE_RULES));
  } catch (e) { console.warn(e); board.setPosition(makePosition({ setup: '' }, FREE_RULES)); }
}

async function run(ctx) {
  const { L } = ctx;
  preview(ctx, L);
  if(!ctx.resume?.battle&&!ctx.resume?.lesson)await intro(ctx);
  if (!ctx.alive) return;
  if (L.boss) { banner('FIGHT!', { color: '#ff8aa0', shadow: '#5a1428', ms: 800 }); sfx.check(); }
  const kind = KINDS[L.kind];
  while (ctx.alive) {
    ctx.mistakes = ctx.resume?.lesson?.mistakes||0; ctx.hints = ctx.resume?.lesson?.hints||0;
    const res = await kind(ctx, L);
    if (!ctx.alive || !res) return;
    if (res.retry) continue;
    if (res.success) { await victory(ctx, res); return; }
    const again = await defeat(ctx, res);
    if (!again) return;
  }
}

// ---------------------------------------------------------------- results

async function victory(ctx, res) {
  const { L, nav } = ctx;
  const stars = Math.max(1, Math.min(3, res.stars));
  const { improved, first } = recordLevel(L.uid, stars);
  save.justCleared = L.uid;
  save.stats.puzzlesSolved += res.solved || 0;
  const fresh = unlockCodex(L.codex || []);
  sfx.win();
  if (L.boss) confetti(160); else confetti(60);
  if (L.outro && first) await ctx.speech.say(L.outro);
  const next = nextLevel(L);
  const starEl = h('div', { class: 'result-stars' });
  const body = h('div', { class: 'result' },
    h('div', { class: 'result-title' }, pixelText(L.boss ? 'BOSS DEFEATED!' : 'LEVEL CLEAR!', { scale: 4 })),
    starEl,
    res.note ? richEl('p', res.note, 'result-note') : null,
    res.criteria ? h('ul', { class: 'criteria' }, res.criteria.map(c => h('li', { class: c.ok ? 'ok' : 'miss' }, (c.ok ? '★ ' : '☆ ') + c.label))) : null,
    fresh.length ? h('div', { class: 'codex-unlock' }, h('span', {}, '📖 New in your Codex: '), ...fresh.map(id => h('span', { class: 'chip' }, CODEX[id]?.title || id))) : null,
    improved && !first ? h('p', { class: 'result-note' }, 'New best!') : null,
  );
  const shown = { n: 0 };
  const showStars = async () => { for (let i = 0; i < 3; i++) { await wait(260); starEl.replaceChildren(starsRow(i < stars ? i + 1 : stars, 3, 4)); if (i < stars) sfx.star(); shown.n = i; } };
  starEl.append(starsRow(0, 3, 4));
  showStars();
  const buttons = [{ label: 'Play again', value: 'again', cls: 'ghost' }, { label: 'Map', value: 'map', cls: 'ghost' }];
  if (next) buttons.push({ label: next.world !== L.world ? 'Next rank ▶' : 'Next ▶', value: 'next', cls: 'gold' });
  else buttons.push({ label: 'The end ♛', value: 'end', cls: 'gold' });
  const v = await modal({ body, buttons, className: 'result-modal', dismissable: false });
  if (!ctx.alive) return;
  if (v === 'again') nav.level(L.uid, true);
  else if (v === 'next') next.world !== L.world ? nav.map(next.world.id, true) : nav.level(next.uid);
  else if (v === 'end') nav.ending();
  else nav.map(L.world.id);
}

async function defeat(ctx, res) {
  sfx.lose();
  const body = h('div', { class: 'result' },
    h('div', { class: 'result-title' }, pixelText(res.title || 'NOT QUITE!', { scale: 4, color: '#ff8aa0', shadow: '#5a1428' })),
    res.text ? richEl('p', res.text, 'result-note') : null,
    res.tip ? h('div', { class: 'tip' }, portrait('pip', 2), richEl('p', res.tip)) : null,
  );
  const v = await modal({ body, buttons: [{ label: 'Map', value: 'map', cls: 'ghost' }, { label: 'Try again', value: 'again', cls: 'gold' }], dismissable: false });
  if (!ctx.alive) return false;
  if (v === 'map') { ctx.nav.map(ctx.L.world.id); return false; }
  return true;
}

// ---------------------------------------------------------------- collect

async function playCollect(ctx, L) {
  const { board, speech } = ctx;
  const { pos, stars, targets, types } = collectSetup(L);
  const starsLeft = new Set(stars), targetsLeft = new Set(targets);
  const solution = collectSolve(L);
  const par = solution ? solution.length : 99;
  let moves = 0, sMask = 0, tMask = 0;
  board.setPosition(pos);
  board.clearAnnotations();
  board.lastMove = null;
  for (const s of stars) board.marks.set(s, 'star');
  for (const t of targets) board.marks.set(t, 'target');
  const refreshDanger = () => { board.threat = L.showDanger ? attackMap(pos, BLACK) : null; };
  refreshDanger();
  board.interactive = 'move'; board.movable = WHITE; board.showLegal = true;
  board.legalFor = sq => collectMoves(pos, types, sq);
  board.onIllegal = (f, t) => { sfx.illegal(); const r = illegalReason(pos, f, t); if (r) speech.show(r, 'pip', 'bad'); };
  const goalText = () => {
    const parts = [];
    if (stars.length) parts.push(`${stars.length - starsLeft.size}/${stars.length} ★`);
    if (targets.length) parts.push(`${targets.length - targetsLeft.size}/${targets.length} captured`);
    return parts.join(' · ');
  };
  const goal = L.goal || (targets.length && stars.length ? 'Capture the targets and collect the stars.' : targets.length ? 'Capture all the marked pieces.' : 'Collect all the stars.');
  ctx.setGoal(goal, `${goalText()} · Moves: ${moves} (par ${par})`);
  ctx.counter.textContent = `Par ${par}`;
  let hintUsed = 0;
  const hintBtn = button('💡 Hint', async () => {
    const path = collectSolve(L, { pos, s: sMask, t: tMask });
    if (!path?.length) { speech.show('Hmm, no way to finish from here. Try **Restart**!'); return; }
    hintUsed++;
    board.arrows = [{ from: mFrom(path[0]), to: mTo(path[0]), color: 'hint' }];
    speech.show(`Try this move. (Hints cost a star!)`);
  }, 'small');
  let restart = false;
  const restartBtn = button('↺ Restart', () => { restart = true; ctx.moveWaiter?.('restart'); }, 'small ghost');
  ctx.setControls([hintBtn, restartBtn]);
  speech.show(L.tip || (L.showDanger ? 'Red stripes = guarded squares. Don\'t stop on them!' : 'Tap a piece, then tap where it should go. Or drag it!'));

  if(ctx.resume?.lesson?.kind==='collect'){
    const data=ctx.resume.lesson;ctx.resume=null;
    Object.assign(pos,Position.fromFEN(data.fen,pos.rules));starsLeft.clear();targetsLeft.clear();for(const sq of data.starsLeft)starsLeft.add(sq);for(const sq of data.targetsLeft)targetsLeft.add(sq);
    moves=data.moves;sMask=data.sMask;tMask=data.tMask;hintUsed=data.hintUsed;
    for(const sq of stars)if(!starsLeft.has(sq))board.marks.delete(sq);for(const sq of targets)if(!targetsLeft.has(sq))board.marks.delete(sq);refreshDanger();ctx.setProgress(`${goalText()} · Moves: ${moves} (par ${par})`);
  }
  ctx.captureLesson=()=>({kind:'collect',fen:pos.toFEN(),starsLeft:[...starsLeft],targetsLeft:[...targetsLeft],moves,sMask,tMask,hintUsed});
  while (ctx.alive) {
    const ms = await ctx.waitMove();
    if (!ctx.alive || !ms) return null;
    if (ms === 'restart' || restart) return { retry: true };
    const m = ms[0];
    board.arrows = [];
    const cap = mFlags(m) & F_CAPTURE;
    await board.animateMove(m);
    pos.make(m); pos.turn = WHITE;
    moves++;
    if (mFlags(m) & F_PROMO) { sfx.promote(); board.burst(mTo(m), ['#ffd23f', '#fff', '#ff9ad5'], 30); board.floatText(mTo(m), 'QUEEN!', '#ffd23f'); }
    else if (cap) sfx.capture(); else sfx.move();
    const to = mTo(m);
    if (starsLeft.has(to)) { starsLeft.delete(to); board.marks.delete(to); sfx.star(); board.burst(to, ['#ffd23f', '#fff7c2', '#ffffff'], 22); board.floatText(to, '+1', '#ffd23f'); }
    if (targetsLeft.has(to)) { targetsLeft.delete(to); board.marks.delete(to); board.floatText(to, 'GOT IT', '#5ef2c4'); }
    sMask = stars.reduce((a, s, i) => starsLeft.has(s) ? a : a | (1 << i), 0);
    tMask = targets.reduce((a, s, i) => targetsLeft.has(s) ? a : a | (1 << i), 0);
    refreshDanger();
    ctx.setProgress(`${goalText()} · Moves: ${moves} (par ${par})`);
    if (!starsLeft.size && !targetsLeft.size) {
      await wait(350);
      const s = moves <= par ? 3 : moves <= par + 2 ? 2 : 1;
      const st = Math.max(1, s - hintUsed);
      const hintNote = hintUsed ? ` (Hints used: −${Math.min(hintUsed, s - 1)}★)` : '';
      return { success: true, stars: st, note: (moves <= par ? `Perfect! ${moves} moves, exactly par.` : `${moves} moves. Par is ${par}: can you do it in fewer?`) + hintNote };
    }
    if (!L.passive) {
      const c = capturedPiece(pos);
      if (c) {
        await wait(150);
        const attacker = pos.b[c.attacker], victim = pos.b[c.victim];
        await board.animateSlide(c.attacker, c.victim, attacker);
        board.shatter(c.victim, victim);
        pos.b[c.victim] = attacker; pos.b[c.attacker] = 0;
        sfx.capture();
        board.marks.set(c.victim, 'x');
        await wait(500);
        const names = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
        return { success: false, title: 'CAPTURED!', text: `The ${names[typeOf(attacker)]} on [${sqName(c.attacker)}] was guarding [${sqName(c.victim)}].`, tip: 'Before each move, check whether an enemy piece could capture you on the square you land on.' };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------- quiz

async function playQuiz(ctx, L) {
  const { board, speech, choices } = ctx;
  const resumed=ctx.resume?.lesson?.kind==='quiz'?ctx.resume.lesson:null;ctx.resume=null;
  let qi = resumed?.question||0;
  ctx.captureLesson=()=>({kind:'quiz',question:qi-1,mistakes:ctx.mistakes,hints:ctx.hints});
  for (const q of L.questions.slice(qi)) {
    qi++;
    if (!ctx.alive) return null;
    const pos = quizPosition(q);
    board.setPosition(pos);
    board.clearAnnotations();
    board.threat = null; board.lastMove = null; board.selected = -1;
    board.flipped = false;
    board.arrows = (q.arrows || []).map(([a, b, c]) => ({ from: sqParse(a), to: sqParse(b), color: c || 'info' }));
    const ans = quizAnswer(q, pos.clone());
    ctx.counter.textContent = `${qi} / ${L.questions.length}`;
    speech.show(q.prompt);
    choices.replaceChildren();
    if (ans.options) {
      ctx.setGoal('Choose an answer.', '');
      board.interactive = false;
      const v = await new Promise(res => {
        ctx.choiceWaiter = res;
        choices.replaceChildren(...ans.options.map((o, i) => h('button', { class: 'btn choice', onclick: e => { e.currentTarget.blur(); res(i); } }, o)));
      });
      if (v == null || !ctx.alive) return null;
      const btns = [...choices.children];
      btns[ans.choice].classList.add('right');
      if (v === ans.choice) sfx.correct();
      else {
        btns[v].classList.add('wrong'); sfx.wrong(); ctx.mistakes++;
        await speech.say({ text: `Not quite: the answer is **${ans.options[ans.choice]}**.${q.explain ? '' : ' Take a good look at the board.'}` });
      }
      for (const b of choices.children) b.disabled = true;
    } else {
      const want = new Set(ans.squares.map(sqParse));
      const found = new Set(qi-1===resumed?.question?resumed.found||[]:[]);
      ctx.captureLesson=()=>({kind:'quiz',question:qi-1,found:[...found],mistakes:ctx.mistakes,hints:ctx.hints});
      for(const sq of found)board.marks.set(sq,'check');
      board.interactive = 'tap';
      ctx.setGoal(want.size > 1 ? 'Tap every correct square.' : 'Tap the right square.', `${found.size}/${want.size} found`);
      const hintBtn = button('💡 Hint', () => {
        const left = [...want].filter(s => !found.has(s));
        if (!left.length) return;
        ctx.hints++;
        board.flash(left[0], 'hint', 1400);
      }, 'small');
      ctx.setControls([hintBtn]);
      while (found.size < want.size && ctx.alive) {
        const sq = await ctx.waitTap();
        if (sq == null || !ctx.alive) return null;
        if (want.has(sq) && !found.has(sq)) {
          found.add(sq); board.marks.set(sq, 'check'); sfx.correct(); board.burst(sq, ['#5ef2c4', '#ffffff'], 10);
        } else if (!found.has(sq)) {
          ctx.mistakes++; sfx.wrong(); board.marks.set(sq, 'x'); board.shake(1, 150);
          speech.show(`${tapReason(q, pos, sq)} ${q.prompt}`, 'pip', 'bad');
          setTimeout(() => { if (board.marks.get(sq) === 'x') board.marks.delete(sq); }, 700);
        }
        ctx.setProgress(`${found.size}/${want.size} found`);
      }
      board.interactive = false;
      ctx.setControls([]);
    }
    if (q.explain) await speech.say(q.explain);
    else await wait(500);
    choices.replaceChildren();
  }
  const m = ctx.mistakes + ctx.hints;
  return { success: true, stars: m === 0 ? 3 : m <= 2 ? 2 : 1, note: m === 0 ? 'Flawless!' : `${m} slip${m > 1 ? 's' : ''} along the way.` };
}

// Why a tapped square is wrong, in one sentence.
function tapReason(q, pos, sq) {
  const a = q.answer, p = pos.b[sq], name = sqName(sq);
  const NAMES = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
  if (a.type === 'squares') return `That's [${name}]. File letter first (the column), then rank number (the row).`;
  if (a.type === 'moves') {
    const from = sqParse(a.from), t = typeOf(pos.b[from]);
    if (p && colorOf(p) === colorOf(pos.b[from])) return `Pieces can't land on a friend, like the one on [${name}].`;
    return `The ${NAMES[t]} on [${a.from}] can't reach [${name}].`;
  }
  if (a.type === 'checkers') {
    if (!p) return `[${name}] is empty.`;
    if (colorOf(p) === pos.turn) return 'That\'s one of your own pieces!';
    return `The ${NAMES[typeOf(p)]} on [${name}] isn't attacking your king${[3, 4, 5].includes(typeOf(p)) ? ': something blocks its path, or it\'s not on the king\'s line' : ''}.`;
  }
  if (a.type === 'hanging') {
    if (!p || colorOf(p) !== (a.color === 'b' ? BLACK : WHITE)) return 'Tap your own pieces.';
    const them = colorOf(p) ^ 1;
    return pos.attackers(sq, them).length ? `The ${NAMES[typeOf(p)]} on [${name}] is attacked, but it's protected well enough: any capture there is a fair trade.` : `Nothing attacks the ${NAMES[typeOf(p)]} on [${name}].`;
  }
  return 'Not that one.';
}

// ---------------------------------------------------------------- puzzles

async function buildPuzzles(ctx, L) {
  if (L.puzzles) return L.puzzles;
  const gens = L.drill.gens || Array(L.drill.count).fill(L.drill.gen);
  ctx.speech.show('Setting up the boards...');
  const out = [];
  let seed = Math.floor(Math.random() * 1e9);
  for (const g of gens) {
    let p = null;
    for (let i = 0; i < 4 && !p; i++) p = await ask('gen', { fen: START_FEN, kind: g, seed: seed++ });
    if (p) out.push(L.drill.prompt ? { ...p, prompt: L.drill.prompt } : p);
  }
  return out;
}

export async function solvePuzzle(ctx, p, { index = 0, total = 1, mistakesBefore = 0 } = {}) {
  const { board, speech } = ctx;
  const pos = makePosition(p, { variant: 'standard' });
  board.setPosition(pos);
  board.clearAnnotations();
  board.threat = null; board.hanging = []; board.opportunities = [];
  board.flipped = pos.turn === BLACK;
  board.lastMove = p.lastMove ? [sqParse(p.lastMove.slice(0, 2)), sqParse(p.lastMove.slice(2, 4))] : null;
  if (p.danger) board.marks.set(sqParse(p.danger), 'danger');
  const sol = p.solution || [];
  let step = 0, mistakes = 0, hintLevel = 0;
  let roots = null;
  if (p.accept === 'engine') roots = ask('roots', { fen: pos.toFEN(), rules: pos.rules, depth: 4 });
  speech.show(p.prompt || 'Find the best move!');
  ctx.counter.textContent = total > 1 ? `${index + 1} / ${total}` : '';
  board.interactive = 'move'; board.movable = pos.turn; board.showLegal = true;
  board.legalFor = sq => pos.legalMoves().filter(m => mFrom(m) === sq);
  board.onIllegal = (f, t) => { sfx.illegal(); const r = illegalReason(pos, f, t); if (r) speech.show(r, 'pip', 'bad'); };
  const hintBtn = button('💡 Hint', async () => {
    let best = null;
    if (p.accept === 'engine') { const r = await roots; best = r?.[0]?.uci; }
    else if (p.accept === 'mate') { best = sol[0] || (await ask('search', { fen: pos.toFEN(), rules: pos.rules, depth: 3 }))?.uci; }
    else best = sol[step];
    if (!best) return;
    ctx.hints++;
    hintLevel++;
    const from = sqParse(best.slice(0, 2)), to = sqParse(best.slice(2, 4));
    if (hintLevel === 1) { board.flash(from, 'hint', 2500); speech.show(`Look at the ${['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'][typeOf(pos.b[from])]} on [${sqName(from)}]...`); }
    else { board.arrows = [{ from, to, color: 'hint' }]; speech.show('This move!'); }
  }, 'small');
  ctx.setControls([hintBtn]);
  ctx.setGoal(p.goal || (p.accept === 'mate' ? 'Checkmate in one.' : sol.length > 1 ? `Find the winning line (${Math.ceil(sol.length / 2)} moves).` : 'Find the best move.'), '');

  while (ctx.alive) {
    const ms = await ctx.waitMove();
    if (!ctx.alive || !ms) return null;
    let m = ms[0];
    if (ms.length > 1 && (mFlags(m) & F_PROMO)) {
      const { promotionPicker } = await import('./game.js');
      const t = await promotionPicker(pos.turn);
      m = ms.find(x => (x >> 14 & 7) === t) || m;
    }
    const u = uci(m);
    let ok = false;
    if (p.accept === 'mate') { pos.make(m); const st = pos.status(); pos.unmake(); ok = st?.reason === 'checkmate'; }
    else if (p.accept === 'engine') {
      const r = await roots;
      const best = r[0].score, mine = r.find(x => x.uci === u);
      ok = (mine && mine.score >= best - (p.margin || 80)) || (p.alts || []).includes(u) || (p.solution || [])[0] === u;
    } else ok = sol[step] === u || (step === 0 && (p.alts || []).includes(u)) || (step === 0 && sol.length === 0);
    if (!ok && p.accept === 'list' && !p.wrong && sol.length === 1) {
      // An equally strong alternative is fine too.
      const r = await ask('roots', { fen: pos.toFEN(), rules: pos.rules, depth: 4 });
      const want = r.find(x => x.uci === sol[0]), mine = r.find(x => x.uci === u);
      ok = !!(want && mine && mine.score >= want.score - 30);
    }
    board.arrows = [];
    const fenBefore = pos.toFEN();
    const cap = mFlags(m) & F_CAPTURE;
    await board.animateMove(m);
    pos.make(m);
    board.lastMove = [mFrom(m), mTo(m)];
    if (cap) sfx.capture(); else sfx.move();
    if (ok) {
      step++;
      const st = pos.status();
      if (step < sol.length && !st && p.accept === 'list') {
        // Opponent's scripted reply.
        sfx.correct();
        board.floatText(mTo(m), 'GOOD', '#5ef2c4');
        await wait(450);
        const reply = pos.moveFromUci(sol[step]);
        if (reply) {
          await board.animateMove(reply);
          const c2 = mFlags(reply) & F_CAPTURE;
          pos.make(reply); step++;
          board.lastMove = [mFrom(reply), mTo(reply)];
          c2 ? sfx.capture() : sfx.move();
          speech.show('Your move again. Finish it!');
          continue;
        }
      }
      if (st?.reason === 'checkmate') { banner('CHECKMATE!', { ms: 900 }); board.burst(pos.king[pos.turn], ['#ffd23f', '#ff5e7a', '#fff'], 30); }
      else board.burst(mTo(m), ['#5ef2c4', '#ffd23f', '#fff'], 22);
      sfx.correct();
      board.interactive = false;
      ctx.setControls([]);
      await speech.say(p.explain || pick(['Well done!', 'Excellent!', 'That\'s it!', 'Hoo-hoo, brilliant!']));
      return { mistakes };
    }
    // Wrong: explain why, then undo.
    mistakes++; ctx.mistakes++;
    sfx.wrong();
    board.interactive = false;
    speech.show('Hmm, let me think about that move...', 'pip', 'bad');
    let why = null;
    try {
      const before = makePosition({ fen: fenBefore }, { variant: 'standard' });
      why = await ask('explain', { fen: before.toFEN(), rules: before.rules, uci: u, userColor: before.turn, depth: 3, timeMs: 500 });
    } catch {}
    if (!ctx.alive) return null;
    if (why && why.reply) board.arrows = (why.arrows || []).filter(a => a.color === 'bad').slice(0, 1);
    const msg = p.wrong ? `Not quite. ${p.wrong}` : p.accept === 'mate' ? (pos.inCheck() ? 'That\'s check, but the king can escape. Look for a check with no way out!' : pos.status()?.reason === 'stalemate' ? 'Oh no, that\'s **stalemate**! Leave the king a move.' : 'That\'s not checkmate. Look at every check you can give!')
      : why && why.grade !== 'best' && why.grade !== 'good' ? `Not quite. ${why.text}` : 'That\'s a fine move, but there\'s something stronger. Try again!';
    await speech.say(msg);
    await board.animateSlide(mTo(m), mFrom(m), pos.b[mTo(m)], 200);
    pos.unmake();
    board.setPosition(pos);
    board.arrows = []; board.lastMove = p.lastMove ? [sqParse(p.lastMove.slice(0, 2)), sqParse(p.lastMove.slice(2, 4))] : null;
    board.interactive = 'move';
    speech.show((p.prompt || 'Find the best move!') + (mistakes >= 2 ? ' (Stuck? Try the hint.)' : ''));
  }
  return null;
}

async function playPuzzles(ctx, L) {
  const resumed=ctx.resume?.lesson?.kind==='puzzles'?ctx.resume.lesson:null;ctx.resume=null;
  const puzzles = resumed?.puzzles||await buildPuzzles(ctx, L);
  if (!puzzles.length) return { success: false, text: 'Could not generate puzzles. Try again!' };
  let solved = resumed?.solved||0, combo = resumed?.combo||0;
  for (let i = solved; i < puzzles.length; i++) {
    ctx.captureLesson=()=>({kind:'puzzles',puzzles,solved,combo,mistakes:ctx.mistakes,hints:ctx.hints});
    const hintsBefore = ctx.hints;
    const r = await solvePuzzle(ctx, puzzles[i], { index: i, total: puzzles.length });
    if (!r) return null;
    solved++;
    combo = r.mistakes === 0 && ctx.hints === hintsBefore ? combo + 1 : 0;
    if (combo >= 2) { toast(`🔥 **${combo} in a row!**`); sfx.unlock(); }
  }
  const m = ctx.mistakes + ctx.hints;
  return { success: true, solved, stars: m === 0 ? 3 : m <= 2 ? 2 : 1, note: m === 0 ? 'Every puzzle on the first try!' : `${m} slip${m > 1 ? 's' : ''} or hint${m > 1 ? 's' : ''}.` };
}

// ---------------------------------------------------------------- battles

async function playBattle(ctx, L) {
  const { board, speech } = ctx;
  const char = L.character;
  const lines = { ...(BOT_LINES[char] || {}), ...(L.lines || {}) };
  const rules = { castling: true, enPassant: true, checks: true, ...L.rules };
  const start = makePosition(L, rules);
  const userColor = L.side === 'b' ? BLACK : WHITE;
  let castled = false, lostQueen = false;
  const customEnd = L.custom === 'develop' ? developEnd(userColor) : L.custom === 'surrender' ? surrenderEnd(userColor) : null;
  const game = new Game({
    board, fen: start.toFEN(), rules, user: userColor, bot: L.bot, maxMoves: L.maxMoves, onLimit: L.onLimit,
    threats: L.threats, warnings: L.warnings, advice: false, botDelay: L.botDelay, customEnd,
    onEvent: (type, d) => onEvent(type, d),
  });
  ctx.game = game;
  board.clearAnnotations();
  board.showLegal = true;
  const tauntEl = h('div', { class: 'taunt', hidden: true });
  const portraitBox = h('div', { class: 'opponent' }, portrait(char, 3), h('div', { class: 'opp-info' }, h('b', {}, CHAR_NAMES[char] || ''), h('div', { class: 'opp-status' }, 'Ready'), tauntEl));
  ctx.ui.side.insertBefore(portraitBox, ctx.ui.side.firstChild);
  const status = portraitBox.querySelector('.opp-status');
  ctx.setGoal(L.goal, L.maxMoves ? `Moves: 0 / ${L.maxMoves}` : '');
  ctx.counter.textContent = '';
  let hintStage = 0, lastHint = null;
  const hintBtn = button('💡 Hint', async () => {
    if (game.thinking || game.over) return;
    if (!lastHint || hintStage >= 3) { hintStage = 0; speech.show('Thinking...'); lastHint = await game.hint(); }
    if (!lastHint || !ctx.alive) return;
    hintStage++;
    if (hintStage === 1) speech.show(lastHint.nudge);
    else if (hintStage === 2) { board.flash(lastHint.from, 'hint', 3000); speech.show(`${lastHint.nudge} Look at your piece on [${sqName(lastHint.from)}].`); }
    else { board.arrows = [{ from: lastHint.from, to: lastHint.to, color: 'hint' }]; speech.show(`**${lastHint.san}**. ${lastHint.why}`); }
  }, 'small');
  const undoBtn = button('↶ Undo', () => { if (game.takeback()) { board.arrows = []; lastHint = null; } }, 'small ghost');
  const resignBtn = button('⚑ Restart', async () => {
    if (game.history.length && !(await modal({ title: 'Restart the battle?', body: 'This game will be lost and the pieces set up again.', buttons: [{ label: 'Keep playing', value: false, cls: 'ghost' }, { label: 'Restart', value: true, cls: 'coral' }] }))) return;
    ctx.restartBattle?.();
  }, 'small ghost');
  ctx.setControls([hintBtn, undoBtn, resignBtn]);
  const matBox = h('div');
  ctx.ui.side.append(matBox);
  const paintMat = () => matBox.replaceChildren(materialStrip(start, game.pos, userColor));
  paintMat();
  const finished = new Promise(res => { ctx.finishBattle = res; ctx.restartBattle = () => res({ restart: true }); });

  function say(text, who = 'pip', tone = '') { if (ctx.alive) speech.show(text, who, tone); }

  let pendingNote = null, turnNo = 0;
  const taunt = text => { tauntEl.textContent = '“' + text + '”'; tauntEl.hidden = false; clearTimeout(taunt.t); taunt.t = setTimeout(() => { tauntEl.hidden = true; }, 3500); };
  function onEvent(type, d) {
    if (!ctx.alive) return;
    if (type === 'thinking') { status.textContent = d.who === 'coach' ? 'Pip is checking your move' : 'Thinking'; portraitBox.classList.add('thinking'); }
    if (type === 'move') {
      portraitBox.classList.remove('thinking'); status.textContent = 'Your move';
      lastHint = null; hintStage = 0; board.arrows = []; board.opportunities = [];
      const e = d.entry;
      if (d.by === 'user' && /^O-O/.test(e.san)) castled = true;
      if (d.by === 'bot' && d.capture === QUEEN) lostQueen = true;
      if (d.by === 'bot' && d.capture && lines.capture?.length && Math.random() < 0.7) taunt(pick(lines.capture));
      else if (d.by === 'user' && d.capture && lines.captured?.length && Math.random() < 0.7) taunt(pick(lines.captured));
      if (d.by === 'bot' && d.capture) pendingNote = captureNote(game.pos, e, userColor, CHAR_NAMES[char] || 'Your opponent', game.history[game.history.length - 2]);
      if (d.by === 'user') say(pick(['Nice. Now watch the reply...', 'Let\'s see what happens...', 'Hmm, interesting...']));
      if (L.maxMoves) ctx.setProgress(`Moves: ${game.history.filter(x => x.by === 'user').length} / ${L.maxMoves}`);
      paintMat();
    }
    if (type === 'your-turn') {
      status.textContent = 'Your move';
      portraitBox.classList.remove('thinking');
      const adv = turnAdvice(game.pos, userColor, { variant: rules.variant, coaching: !!L.threats, name: CHAR_NAMES[char], turn: turnNo++ });
      board.opportunities = L.threats ? (adv.opportunities || []) : [];
      // A capture explanation matters more than a routine reminder.
      if (pendingNote && (!adv.tone || adv.tone === '' || pendingNote.tone === 'good')) say(pendingNote.text + (adv.tone === 'good' ? ' ' + adv.text : ''), 'pip', pendingNote.tone || adv.tone || '');
      else if (pendingNote && adv.tone === 'good') say(pendingNote.text + ' ' + adv.text, 'pip', 'good');
      else say(adv.text, 'pip', adv.tone || '');
      pendingNote = null;
    }
    if (type === 'illegal') { const r = illegalReason(game.pos, d.from, d.to); if (r) say(r, 'pip', 'bad'); }
    if (type === 'warning-undo' || type === 'takeback') paintMat();
    if (type === 'warning-undo') say('Good call. Look for a safer move.');
    if (type === 'takeback') say('Move taken back. (Undos cost a star.)');
    if (type === 'end') { status.textContent = 'Game over'; portraitBox.classList.remove('thinking'); ctx.finishBattle?.(d); }
  }

  if (lines.start) { taunt(lines.start); say(L.goal); }
  ctx.captureBattle=()=>!game.over?{history:game.history,hints:game.hints,takebacks:game.takebacks,warningsShown:game.warningsShown,castled,lostQueen}:null;
  if(ctx.resume?.battle){
    const saved=ctx.resume.battle;ctx.resume=null;
    if(!Array.isArray(saved.history)||saved.history.length>1000)throw Error('Invalid saved battle.');
    for(const entry of saved.history){const move=game.pos.moveFromUci(entry.uci);if(!move)throw Error('Invalid saved chess move.');game.pos.make(move);game.history.push(entry);}
    game.hints=saved.hints||0;game.takebacks=saved.takebacks||0;game.warningsShown=saved.warningsShown||0;castled=Boolean(saved.castled);lostQueen=Boolean(saved.lostQueen);game.refresh();paintMat();
  }
  game.start();
  const end = await finished;
  game.destroy();
  if (!ctx.alive) return null;
  portraitBox.remove(); matBox.remove();
  if (end.restart) return { retry: true };
  const won = end.winner === userColor;
  if (won) {
    if (end.reason === 'checkmate') banner('CHECKMATE!', { ms: 1200 });
    if (lines.lose) say(lines.lose, char);
    await wait(1300);
    const winNote = { surrender: 'Only one lonely piece was left, so your opponent gave up!', 'move-limit': 'Out of moves, but you were ahead on points!', checkmate: 'Checkmate!', 'king-captured': 'You captured the king!', 'all-captured': 'You captured every piece!', promoted: 'Your pawn reached the last rank!', developed: 'Pieces out, king castled. A model opening!' }[end.reason];
    const criteria = [{ label: 'Win', ok: true }, { label: 'No hints or undos', ok: game.hints === 0 && game.takebacks === 0 }];
    const ex = L.extra;
    if (ex) {
      let ok = false;
      const userMoves = game.history.filter(x => x.by === 'user').length;
      if (ex.type === 'keep') ok = game.pos.pieces(userColor).length >= ex.count;
      if (ex.type === 'moves') ok = userMoves <= ex.n;
      if (ex.type === 'keepQueen') ok = !lostQueen;
      if (ex.type === 'castled') ok = castled;
      if (ex.type === 'noHints') ok = game.hints === 0 && game.takebacks === 0;
      criteria.push({ label: ex.label, ok });
    }
    return { success: true, stars: criteria.filter(c => c.ok).length, criteria, note: winNote };
  }
  if (lines.win && end.winner === (userColor ^ 1)) say(lines.win, char);
  await wait(1200);
  const reasonText = {
    checkmate: 'You were checkmated.', stalemate: 'Stalemate! The enemy king had no legal move but wasn\'t in check, so it\'s a draw.',
    'move-limit': L.onLimit === 'material' ? 'Out of moves, and you weren\'t ahead on points.' : `You ran out of moves (${L.maxMoves}).`, surrender: 'You had only one piece left against a big army.', repetition: 'Draw by repetition.', 'fifty-moves': 'Draw by the 50-move rule.', insufficient: 'Draw: not enough pieces left to checkmate.',
    'king-captured': 'Your king was captured!', 'all-captured': 'All your pieces were captured.', promoted: 'An enemy pawn reached the end first.', 'no-moves': 'You ran out of moves.',
    develop: end.text,
  };
  const tips = {
    gus: 'Gus always grabs. Put a piece where he can take it only if you can take back with something cheaper.',
    prance: 'Before each move, check every enemy piece: can any of them reach your king next move?',
    stomp: 'Keep your pawns side by side so they protect each other, and race when you have a passed pawn.',
    rollo: 'Box him in with the queen a knight\'s move away, walk your king up, and avoid stalemate!',
    hangs: 'Look for free pieces every move, then trade down and checkmate with your extra material.',
    tess: 'Castle, bring all your pieces out, then open lines toward her king.',
    fiona: 'Watch out for knight forks on your king and queen. Keep valuable pieces off squares her knights can reach.',
    iron: 'Play solid: develop, castle, and check for threats every move. Hints and undos are allowed!',
  };
  return { success: false, title: end.winner === -1 ? 'DRAW!' : 'DEFEAT', text: reasonText[end.reason] || 'The game is over.', tip: L.tip || tips[char] || 'Use the hint button when you\'re stuck. Every loss teaches something!' };
}

// Capture-all battles: stop the endless chase once one side is hopelessly behind.
function surrenderEnd(userColor) {
  return game => {
    const pos = game.pos, vals = [0, 1, 3, 3, 5, 9, 0];
    const mat = c => pos.pieces(c).reduce((s, sq) => s + vals[typeOf(pos.b[sq])], 0);
    const mine = mat(userColor), theirs = mat(userColor ^ 1);
    if (pos.pieces(userColor ^ 1).length <= 1 && mine >= theirs + 5) return { winner: userColor, reason: 'surrender' };
    if (pos.pieces(userColor).length <= 1 && theirs >= mine + 5) return { winner: userColor ^ 1, reason: 'surrender' };
    return null;
  };
}

function developEnd(userColor) {
  return game => {
    const pos = game.pos;
    const userMoves = game.history.filter(x => x.by === 'user').length;
    const home = userColor === WHITE ? { n: [1, 6], b: [2, 5], k: [6, 2] } : { n: [113, 118], b: [114, 117], k: [118, 114] };
    const knightsOut = home.n.every(sq => pos.b[sq] !== ((userColor << 3) | 2));
    const bishopsOut = home.b.every(sq => pos.b[sq] !== ((userColor << 3) | 3));
    const castled = game.history.some(x => x.by === 'user' && /^O-O/.test(x.san));
    let mat = 0;
    for (const sq of pos.pieces()) { const p = pos.b[sq]; const v = [0, 1, 3, 3, 5, 9, 0][typeOf(p)]; mat += colorOf(p) === userColor ? v : -v; }
    const safe = !hangingPieces(pos, userColor).some(x => x.gain >= 200);
    if (knightsOut && bishopsOut && castled && mat >= 0 && safe && !game.isUserTurn()) return { winner: userColor, reason: 'developed' };
    if (userMoves >= 10 && !game.isUserTurn()) {
      const miss = [];
      if (!knightsOut) miss.push('develop both knights'); if (!bishopsOut) miss.push('develop both bishops'); if (!castled) miss.push('castle'); if (mat < 0) miss.push('keep your material'); if (!safe) miss.push('keep every piece safe');
      return { winner: userColor ^ 1, reason: 'develop', text: `Time's up! You still needed to: ${miss.join(', ')}.` };
    }
    return null;
  };
}

const KINDS = { collect: playCollect, quiz: playQuiz, puzzle: playPuzzles, battle: playBattle };
