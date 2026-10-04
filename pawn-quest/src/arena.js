// Arena: a normal game of chess against a character (or a friend), with an optional coach.
import { WHITE, BLACK, START_FEN, Position, mFrom, mTo } from './chess.js';
import { Game, BOTS, BOT_LINES } from './game.js';
import { playLayout } from './level.js';
import { illegalReason } from './levelkit.js';
import { BoardView } from './board.js';
import { save, persist } from './save.js';
import { h, button, modal, toast, richEl, portrait, Speech, linkSquares, banner, confetti, materialStrip } from './ui.js';
import { GRADES } from './coach.js';
import { TAG_TO_CODEX, CODEX } from './codex-data.js';
import { ask } from './ai.js';
import { sfx, playMusic } from './audio.js';
import { pixelText } from './font.js';

const pick = a => a[Math.floor(Math.random() * a.length)];

export function arenaScreen(app, nav) {
  if(nav.resume?.hash==='#/arena'&&nav.resume.arena){const s=nav.resume.arena;nav.resume=null;startGame(app,nav,s.botId,s.color,s.moves);return ()=>app.__arenaCleanup?.();}
  playMusic('map');
  const o = save.arena.options;
  if (save.arena.saved) {
    const s = save.arena.saved;
    // Offer to resume an unfinished game.
    setTimeout(async () => {
      const v = await modal({ title: 'Resume your game?', body: `You have an unfinished game against **${BOTS[s.botId]?.name || 'a friend'}** (${s.moves.length} moves played).`, buttons: [{ label: 'New game', value: false, cls: 'ghost' }, { label: 'Resume', value: true, cls: 'gold' }] });
      if (v) startGame(app, nav, s.botId, s.color, s.moves);
      else { save.arena.saved = null; persist(); }
    }, 50);
  }
  const header = h('header', { class: 'hud' },
    button('◀ Back', () => nav.title(), 'small ghost back'),
    h('div', { class: 'hud-title' }, h('span', { class: 'hud-sub' }, `Played ${save.arena.played} · Won ${save.arena.wins}`), h('span', { class: 'hud-main' }, 'Arena')),
    h('div', { class: 'hud-right' }, button('Map', () => nav.map(), 'small ghost')));
  const grid = h('div', { class: 'bot-grid' });
  const ids = [...Object.keys(BOTS), 'friend'];
  const paintBots = () => grid.replaceChildren(...ids.map(id => {
    const b = BOTS[id];
    const rec = save.arena.byBot[id];
    return h('button', { class: 'bot-card' + (o.bot === id ? ' selected' : ''), onclick: () => { o.bot = id; persist(); sfx.click(); paintBots(); } },
      id === 'friend' ? h('div', { class: 'portrait', style: { '--portrait-bg': '#a8e0ff' } }, h('span', { style: { fontSize: '30px' } }, '👥')) : portrait(b.char, 4),
      h('div', {},
        h('h3', {}, id === 'friend' ? 'A friend' : b.name),
        id === 'friend' ? null : h('div', { class: 'lvl' }, '★'.repeat(b.level) + '☆'.repeat(7 - b.level)),
        h('p', {}, id === 'friend' ? 'Two players taking turns on this device.' : b.blurb),
        rec ? h('p', {}, `Wins ${rec.w} · Draws ${rec.d} · Losses ${rec.l}`) : null));
  }));
  paintBots();
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Your color' });
  const paintSeg = () => seg.replaceChildren(...[['w', 'White'], ['b', 'Black'], ['r', 'Random']].map(([v, l]) => h('button', { class: o.color === v ? 'on' : '', onclick: () => { o.color = v; persist(); paintSeg(); } }, l)));
  paintSeg();
  const toggle = (key, label, sub) => {
    const input = h('input', { type: 'checkbox' }); input.checked = !!o[key];
    input.onchange = () => { o[key] = input.checked; persist(); };
    return h('label', { class: 'toggle' }, input, h('span', {}, h('b', {}, label), h('small', {}, sub)));
  };
  const setup = h('div', { class: 'arena-setup' }, h('div', { class: 'arena-inner' },
    h('div', { class: 'section-title' }, 'Choose your opponent'), grid,
    h('div', { class: 'section-title' }, 'Your pieces'), h('div', {}, seg),
    h('div', { class: 'section-title' }, 'Coach'),
    h('div', { class: 'options-grid' },
      toggle('advice', 'Coach comments', 'Professor Pip grades your moves and explains what happened.'),
      toggle('warnings', 'Blunder warnings', 'Pip stops you before you hang a piece or allow checkmate.'),
      toggle('threats', 'Danger vision', 'Red stripes on attacked squares; your pieces in danger glow.'),
      toggle('takebacks', 'Allow undo', 'Take back moves when you change your mind.'),
    ),
    h('div', { class: 'start-bar' }, button('Start game ▶', () => {
      const color = o.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : o.color;
      startGame(app, nav, o.bot, color, []);
    }, 'gold')),
  ));
  app.replaceChildren(h('div', { class: 'screen' }, header, setup));
  return () => app.__arenaCleanup?.();
}

function startGame(app, nav, botId, color, moves) {
  app.__arenaCleanup?.();
  const o = save.arena.options;
  const friend = botId === 'friend';
  const bot = BOTS[botId];
  const user = friend ? 'both' : color === 'b' ? BLACK : WHITE;
  playMusic('battle');
  const ui = playLayout(app, { title: friend ? 'Friendly game' : `vs ${bot.name}`, subtitle: 'Arena', onBack: () => leave(), backLabel: 'Arena' });
  const board = new BoardView(ui.boardBox, { theme: save.settings.theme });
  board.coords = save.settings.coords !== false;
  const opp = friend ? null : h('div', { class: 'opponent' }, portrait(bot.char, 3), h('div', {}, h('b', {}, bot.name), h('div', { class: 'opp-status' }, 'Ready')));
  if (opp) ui.side.append(opp);
  const speech = new Speech(ui.side);
  const controls = h('div', { class: 'controls' });
  const movelist = h('div', { class: 'movelist', 'aria-label': 'Moves' });
  const feed = h('div', { class: 'feed' });
  const matBox = h('div');
  ui.side.append(controls, matBox, movelist, feed);
  linkSquares(ui.side, board);
  const lines = BOT_LINES[bot?.char] || {};
  let ended = false, hintStage = 0, lastHint = null;
  const game = new Game({
    board, fen: START_FEN, rules: { variant: 'standard' }, user, bot: bot?.bot, botId,
    advice: o.advice, warnings: o.warnings, threats: o.threats,
    onEvent: (t, d) => onEvent(t, d),
  });
  window.pawnQuest.active={capture:()=>!game.over?{hash:'#/arena',arena:{botId,color,moves:game.moves}}:null};
  // Replay saved moves.
  for (const u of moves) { const m = game.pos.moveFromUci(u); if (!m) break; const san = game.pos.san(m); const fenBefore = game.pos.toFEN(); game.pos.make(m); game.history.push({ uci: u, san, by: friend || (game.pos.turn ^ 1) === user ? 'user' : 'bot', fenBefore, from: mFrom(m), to: mTo(m), color: game.pos.turn ^ 1 }); }
  game.refresh();
  paintMoves();

  const hintBtn = button('💡 Hint', async () => {
    if (game.thinking || game.over) return;
    if (!lastHint || hintStage >= 3) { hintStage = 0; speech.show('Hmm, let me look...'); lastHint = await game.hint(); }
    if (!lastHint) return;
    hintStage++;
    if (hintStage === 1) speech.show(lastHint.nudge);
    else if (hintStage === 2) { board.flash(lastHint.from, 'hint', 3000); speech.show(`${lastHint.nudge} Look at your piece on [${squareName(lastHint.from)}].`); }
    else { board.arrows = [{ from: lastHint.from, to: lastHint.to, color: 'hint' }]; speech.show(`**${lastHint.san}**. ${lastHint.why}`); }
  }, 'small');
  const undoBtn = o.takebacks || friend ? button('↶ Undo', () => { if (game.takeback()) { board.arrows = []; lastHint = null; paintMoves(); speech.show('Move taken back.'); persistGame(); } }, 'small ghost') : null;
  const flipBtn = button('⇅ Flip', () => { board.flipped = !board.flipped; }, 'small ghost');
  const resignBtn = button('⚑ Resign', async () => {
    if (game.over) return;
    const v = await modal({ title: 'Resign?', body: 'Give up this game?', buttons: [{ label: 'Keep playing', value: false, cls: 'ghost' }, { label: 'Resign', value: true, cls: 'coral' }] });
    if (v && !game.over) { game.over = { winner: friend ? (game.pos.turn ^ 1) : (user ^ 1), reason: 'resign', resigner: friend ? (game.pos.turn === WHITE ? 'White' : 'Black') : 'You' }; board.interactive = false; onEvent('end', game.over); }
  }, 'small ghost');
  controls.append(hintBtn, undoBtn || '', flipBtn, resignBtn);
  speech.show(friend ? 'Two players, one board. White moves first. Have fun!' : (lines.start || 'Good luck!'), friend ? 'pip' : bot.char);
  if (!friend && o.advice) setTimeout(() => { if (!ended && game.history.length === 0) speech.show('I\'ll comment on your moves as we go. Tap a square name like [e4] to see it on the board.'); }, 3500);
  game.start();

  function squareName(sq) { return 'abcdefgh'[sq & 7] + ((sq >> 4) + 1); }

  function persistGame() {
    if (ended) { save.arena.saved = null; }
    else save.arena.saved = { botId, color: user === BLACK ? 'b' : 'w', moves: game.history.map(x => x.uci) };
    persist();
  }

  function paintMoves() {
    matBox.replaceChildren(materialStrip(Position.fromFEN(START_FEN), game.pos, friend ? WHITE : user));
    movelist.replaceChildren();
    game.history.forEach((e, i) => {
      if (i % 2 === 0) movelist.append(h('span', { class: 'n' }, (i / 2 + 1) + '.'));
      movelist.append(h('span', { class: e.grade ? 'g-' + e.grade : '' }, e.san + (e.grade && GRADES[e.grade] && ['blunder', 'mistake', 'inaccuracy'].includes(e.grade) ? GRADES[e.grade].icon : '')));
    });
    movelist.scrollTop = movelist.scrollHeight;
  }

  function addFeed(html, tone, tags = [], ply = game.history.length) {
    const item = h('div', { class: 'feed-item tone-' + tone, 'data-ply': ply });
    item.append(html);
    const links = [...new Set(tags.map(t => TAG_TO_CODEX[t]).filter(id => id && save.codex[id]))];
    if (links.length) item.append(h('div', { class: 'learn' }, 'Learn more: ', ...links.map(id => h('a', { onclick: () => { persistGame(); nav.codex(id); } }, CODEX[id].title))));
    feed.prepend(item);
    while (feed.children.length > 12) feed.lastChild.remove();
  }

  function onEvent(type, d) {
    if (type === 'thinking' && opp) { opp.classList.add('thinking'); opp.querySelector('.opp-status').textContent = d.who === 'coach' ? 'Pip is checking your move' : 'Thinking'; }
    if (type === 'move') {
      opp?.classList.remove('thinking'); if (opp) opp.querySelector('.opp-status').textContent = 'Your move';
      lastHint = null; hintStage = 0; board.arrows = [];
      paintMoves(); persistGame();
      if (!friend && d.by === 'bot' && d.capture && lines.capture?.length && Math.random() < 0.5) speech.show(pick(lines.capture), bot.char);
      else if (!friend && d.by === 'user' && d.capture && lines.captured?.length && Math.random() < 0.5) speech.show(pick(lines.captured), bot.char);
      else if (d.by === 'bot' || friend) speech.show(friend ? `${game.pos.turn === WHITE ? 'White' : 'Black'} to move.` : pick(['Your move. Checks, captures, threats?', 'Your move. What did that move attack?', 'Your move.']));
    }
    if (type === 'review') {
      const { review } = d;
      const g = GRADES[review.grade] || GRADES.ok;
      const el = h('div', {}, h('span', { class: 'grade' }, `${g.icon} ${review.san}: ${g.label}.`), richEl('span', review.text));
      addFeed(el, g.tone, review.tags || []);
      paintMoves();
      if (['blunder', 'mistake'].includes(review.grade)) speech.show(review.text, 'pip', 'bad');
      else if (review.grade === 'best' && (review.tags || []).some(t => ['fork', 'pin', 'skewer', 'discovered attack', 'double check', 'checkmate'].includes(t))) speech.show(review.text, 'pip', 'good');
    }
    if (type === 'warning-undo') { paintMoves(); persistGame(); speech.show('Good idea. Have another look: checks, captures, threats!'); }
    if (type === 'threats') {
      const t = d[0];
      speech.show(t.text, 'pip', t.kind === 'mate' || t.kind === 'check' ? 'bad' : '');
      if (t.move) board.arrows = [{ from: t.move & 127, to: (t.move >> 7) & 127, color: 'bad' }];
    }
    if (type === 'takeback' || type === 'warning-undo') { paintMoves(); for (const it of [...feed.children]) if (+it.dataset.ply > game.history.length) it.remove(); }
    if (type === 'illegal') { const r = illegalReason(game.pos, d.from, d.to); if (r) speech.show(r, 'pip', 'bad'); }
    if (type === 'end') { opp?.classList.remove('thinking'); if (opp) opp.querySelector('.opp-status').textContent = 'Game over'; finish(d); }
  }

  async function finish(end) {
    if (ended) return;
    ended = true;
    persistGame();
    const userWon = !friend && end.winner === user, userLost = !friend && end.winner === (user ^ 1);
    if (!friend) {
      save.arena.played++;
      const rec = save.arena.byBot[botId] || (save.arena.byBot[botId] = { w: 0, d: 0, l: 0 });
      if (userWon) { save.arena.wins++; rec.w++; } else if (userLost) rec.l++; else { save.arena.draws++; rec.d++; }
      persist();
    }
    const reason = { checkmate: 'by checkmate', stalemate: 'by stalemate', repetition: 'by repetition', 'fifty-moves': 'by the 50-move rule', insufficient: '(not enough material)', resign: `(${end.resigner || 'a player'} resigned)` }[end.reason] || '';
    let title = 'DRAW', sub = `Draw ${reason}`;
    if (friend) { if (end.winner >= 0) { title = end.winner === WHITE ? 'WHITE WINS' : 'BLACK WINS'; sub = `${end.winner === WHITE ? 'White' : 'Black'} wins ${reason}`; } }
    else if (userWon) { title = 'VICTORY!'; sub = `You win ${reason}`; sfx.win(); confetti(140); if (lines.lose) speech.show(lines.lose, bot.char); }
    else if (userLost) { title = 'DEFEAT'; sub = `${bot.name} wins ${reason}`; sfx.lose(); if (lines.win) speech.show(lines.win, bot.char); }
    if (end.reason === 'checkmate') banner('CHECKMATE!', { ms: 1000 });
    await new Promise(r => setTimeout(r, 1200));
    const v = await modal({
      body: h('div', { class: 'result' }, h('div', { class: 'result-title' }, pixelText(title, { scale: 4, color: userLost ? '#ff8aa0' : '#ffd23f', shadow: userLost ? '#5a1428' : '#8a3a12' })), h('p', { class: 'result-note' }, sub)),
      buttons: [{ label: 'Arena', value: 'arena', cls: 'ghost' }, { label: 'Rematch', value: 'again', cls: 'ghost' }, { label: 'Review game 🔍', value: 'review', cls: 'gold' }],
      dismissable: false,
    });
    if (v === 'again') startGame(app, nav, botId, user === BLACK ? 'b' : 'w', []);
    else if (v === 'review') reviewGame(app, nav, game.history, user, friend ? { name: 'a friend', char: 'pip' } : bot);
    else nav.arena();
  }

  function leave() {
    if (!ended && game.history.length) toast('Game saved. Resume it from the Arena!');
    nav.arena();
  }

  app.__arenaCleanup = () => { game.destroy(); speech.destroy(); board.destroy(); app.__arenaCleanup = null; };
}

// Step through the finished game with the coach's verdict on every one of your moves.
async function reviewGame(app, nav, history, user, bot) {
  app.__arenaCleanup?.();
  playMusic('calm');
  const ui = playLayout(app, { title: 'Game review', subtitle: `vs ${bot.name}`, onBack: () => nav.arena(), backLabel: 'Arena' });
  const board = new BoardView(ui.boardBox, { theme: save.settings.theme });
  board.flipped = user === BLACK;
  board.interactive = false;
  const speech = new Speech(ui.side);
  const summary = h('div', { class: 'review-summary' });
  const nav2 = h('div', { class: 'controls' });
  const movelist = h('div', { class: 'movelist' });
  const gymBtn = button('Save my mistakes to the Gym', () => saveToGym(), 'small mint');
  ui.side.append(summary, nav2, movelist, h('div', { class: 'controls' }, gymBtn));
  linkSquares(ui.side, board);
  let idx = -1, alive = true;
  const positions = [];
  const start = Position.fromFEN(START_FEN);
  positions.push(start.clone());
  for (const e of history) { start.make(start.moveFromUci(e.uci)); positions.push(start.clone()); }

  const show = i => {
    idx = Math.max(-1, Math.min(history.length - 1, i));
    board.setPosition(positions[idx + 1]);
    board.arrows = [];
    const e = history[idx];
    board.lastMove = e ? [e.from, e.to] : null;
    [...movelist.querySelectorAll('[data-i]')].forEach(s => s.classList.toggle('cur', +s.dataset.i === idx));
    if (!e) { speech.show('Step through the game with the arrows. I\'ll explain each of your moves.'); return; }
    if (e.by !== 'user') { speech.show(`${bot.name} played **${e.san}**.`, bot.char); return; }
    if (!e.review) { speech.show(`**${e.san}**: analysing...`); return; }
    const g = GRADES[e.review.grade] || GRADES.ok;
    speech.show(`${g.icon} **${e.san}**: ${g.label}. ${e.review.text}`, 'pip', ['awful', 'bad'].includes(g.tone) ? 'bad' : g.tone === 'great' ? 'good' : '');
    board.arrows = (e.review.arrows || []).map(a => ({ ...a }));
  };
  const paintList = () => {
    movelist.replaceChildren();
    history.forEach((e, i) => {
      if (i % 2 === 0) movelist.append(h('span', { class: 'n' }, (i / 2 + 1) + '.'));
      const s = h('span', { 'data-i': i, class: (e.review ? 'g-' + e.review.grade : '') + (i === idx ? ' cur' : ''), onclick: () => show(i) }, e.san + (e.review && ['blunder', 'mistake', 'inaccuracy'].includes(e.review.grade) ? GRADES[e.review.grade].icon : ''));
      movelist.append(s);
    });
  };
  const paintSummary = () => {
    const mine = history.filter(e => e.by === 'user' && e.review);
    const count = g => mine.filter(e => e.review.grade === g).length;
    const acc = mine.length ? Math.round(mine.reduce((s, e) => s + Math.max(0, 1 - (e.review.loss || 0) * 2.5), 0) / mine.length * 100) : 0;
    summary.replaceChildren(
      h('div', {}, acc + '%', h('small', {}, 'accuracy')),
      h('div', { style: { color: '#4fe08a' } }, count('best') + count('good'), h('small', {}, 'good moves')),
      h('div', { style: { color: '#e0b020' } }, count('inaccuracy'), h('small', {}, 'inaccuracies')),
      h('div', { style: { color: '#ff9a4a' } }, count('mistake'), h('small', {}, 'mistakes')),
      h('div', { style: { color: '#ff5e7a' } }, count('blunder'), h('small', {}, 'blunders')));
  };
  nav2.append(
    button('⏮', () => show(-1), 'small ghost'), button('◀', () => show(idx - 1), 'small ghost'), button('▶', () => show(idx + 1), 'small ghost'), button('⏭', () => show(history.length - 1), 'small ghost'),
    button('Next mistake', () => { const j = history.findIndex((e, k) => k > idx && e.review && ['blunder', 'mistake'].includes(e.review.grade)); if (j >= 0) show(j); else toast('No more mistakes!'); }, 'small'));
  const onKey = e => { if (e.key === 'ArrowLeft') show(idx - 1); if (e.key === 'ArrowRight') show(idx + 1); };
  document.addEventListener('keydown', onKey);
  paintList(); paintSummary(); show(-1);
  // Analyse any of the user's moves that weren't graded during play.
  for (let i = 0; i < history.length && alive; i++) {
    const e = history[i];
    if (e.by !== 'user' || e.review) continue;
    try { e.review = await ask('explain', { fen: START_FEN, rules: { variant: 'standard' }, moves: history.slice(0, i).map(x => x.uci), uci: e.uci, userColor: user, depth: 4, timeMs: 700 }); } catch {}
    if (!alive) return;
    paintList(); paintSummary(); if (idx === i) show(i);
  }

  function saveToGym() {
    let n = 0;
    history.forEach((e, i) => {
      if (e.by !== 'user' || !e.review || !['blunder', 'mistake'].includes(e.review.grade) || !e.review.best) return;
      if (save.gym.some(g => g.fen === e.fenBefore)) return;
      save.gym.push({ fen: e.fenBefore, best: e.review.best.uci, san: e.review.best.san, played: e.san, text: e.review.text, date: Date.now() });
      n++;
    });
    if (save.gym.length > 60) save.gym = save.gym.slice(-60);
    persist();
    toast(n ? `${n} position${n > 1 ? 's' : ''} saved to the Mistake Gym (Practice).` : 'Nothing new to save. Nice game!');
  }

  app.__arenaCleanup = () => { alive = false; document.removeEventListener('keydown', onKey); speech.destroy(); board.destroy(); app.__arenaCleanup = null; };
}

