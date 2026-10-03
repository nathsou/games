// Practice: daily puzzle, endless generated drills, Coordinate Rush and your own Mistake Gym.
import { START_FEN, sqName, BLACK, WHITE } from './chess.js';
import { save, persist } from './save.js';
import { h, button, modal, toast, richEl, starsRow, confetti } from './ui.js';
import { createPlayCtx, solvePuzzle } from './level.js';
import { DRILLS } from './gen.js';
import { ask } from './ai.js';
import { sfx, playMusic } from './audio.js';
import { pixelText } from './font.js';
import { Position } from './chess.js';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const DAILY_KINDS = ['mate1', 'fork', 'free-piece', 'mate1-rook', 'save-piece', 'mate1-queen', 'fork'];

export function practiceScreen(app, nav, arg) {
  playMusic('calm');
  if (arg === 'rush') return rush(app, nav);
  if (arg === 'gym') return gym(app, nav);
  if (arg === 'daily') return daily(app, nav);
  if (arg && DRILLS[arg]) return drill(app, nav, arg);
  const header = h('header', { class: 'hud' },
    button('◀ Back', () => nav.title(), 'small ghost back'),
    h('div', { class: 'hud-title' }, h('span', { class: 'hud-sub' }, 'Sharpen your eye'), h('span', { class: 'hud-main' }, 'Practice')),
    h('div', { class: 'hud-right' }, button('Map', () => nav.map(), 'small ghost')));
  const card = (title, meta, text, onclick, disabled = false) => h('button', { class: 'practice-card', onclick, disabled }, h('span', { class: 'meta' }, meta), h('h3', {}, title), richEl('p', text));
  const d = save.practice.daily[today()];
  const grid = h('div', { class: 'practice-grid' },
    card('Daily Puzzle', d ? '✓ Solved today' : 'New every day', 'One fresh puzzle each day. Come back tomorrow for another!', () => go('daily')),
    card('Coordinate Rush', `Best: ${save.practice.rush || 0}`, 'Tap the named square as fast as you can. 30 seconds. Knowing squares makes you faster at everything!', () => go('rush')),
    card('Mistake Gym', `${save.gym.length} position${save.gym.length === 1 ? '' : 's'}`, save.gym.length ? 'Replay the positions where you slipped in Arena games, and find the better move.' : 'Play Arena games, then use **Review** to save your mistakes here.', () => go('gym'), !save.gym.length),
    ...Object.entries(DRILLS).map(([id, dr]) => card(dr.title, `Best streak: ${save.practice.drills[id] || 0}`, dr.blurb + ' Endless: how long can your streak go?', () => go(id))),
  );
  app.replaceChildren(h('div', { class: 'screen' }, header, h('div', { class: 'arena-setup' }, h('div', { class: 'arena-inner' }, h('div', { class: 'section-title' }, 'Training'), grid))));
  function go(id) { location.hash = '#/practice/' + id; }
  return null;
}

function back() { location.hash = '#/practice'; }

// Endless generated puzzles; three mistakes end the streak.
function drill(app, nav, kind) {
  const ctx = createPlayCtx(app, { title: DRILLS[kind].title, subtitle: 'Practice', onBack: back, backLabel: 'Practice' });
  (async () => {
    let streak = 0, lives = 3, seed = Math.floor(Math.random() * 1e9);
    ctx.speech.show(DRILLS[kind].blurb + ' You have 3 lives.');
    while (ctx.alive && lives > 0) {
      let p = null;
      for (let i = 0; i < 5 && !p; i++) p = await ask('gen', { fen: START_FEN, kind, seed: seed++ });
      if (!ctx.alive) return;
      if (!p) { ctx.speech.show('Couldn\'t build a puzzle. Try again!'); return; }
      ctx.counter.textContent = `Streak ${streak} · ${'♥'.repeat(lives)}${'♡'.repeat(3 - lives)}`;
      const before = ctx.mistakes;
      const r = await solvePuzzle(ctx, p);
      if (!r || !ctx.alive) return;
      if (ctx.mistakes > before) { lives -= Math.min(lives, ctx.mistakes - before); }
      streak++;
      save.stats.puzzlesSolved++;
      if (streak > (save.practice.drills[kind] || 0)) { save.practice.drills[kind] = streak; }
      persist();
    }
    if (!ctx.alive) return;
    sfx.lose();
    const v = await modal({ body: h('div', { class: 'result' }, pixelText('GAME OVER', { scale: 4 }), h('p', { class: 'result-note' }, `Streak: ${streak} puzzles. Best: ${save.practice.drills[kind] || 0}.`)), buttons: [{ label: 'Practice', value: 'back', cls: 'ghost' }, { label: 'Again', value: 'again', cls: 'gold' }], dismissable: false });
    if (v === 'again') { ctx.destroy(); drill(app, nav, kind); } else back();
  })();
  return () => ctx.destroy();
}

function daily(app, nav) {
  const ctx = createPlayCtx(app, { title: 'Daily Puzzle', subtitle: today(), onBack: back, backLabel: 'Practice' });
  (async () => {
    const day = today();
    const seed = +day.replace(/-/g, '');
    const kind = DAILY_KINDS[seed % DAILY_KINDS.length];
    let p = null;
    for (let i = 0; i < 6 && !p; i++) p = await ask('gen', { fen: START_FEN, kind, seed: seed * 13 + i });
    if (!ctx.alive || !p) return;
    const r = await solvePuzzle(ctx, p);
    if (!r || !ctx.alive) return;
    const first = !save.practice.daily[day];
    save.practice.daily[day] = { mistakes: r.mistakes };
    persist();
    if (first) confetti(80);
    sfx.win();
    await modal({ body: h('div', { class: 'result' }, pixelText('SOLVED!', { scale: 4 }), starsRow(r.mistakes === 0 ? 3 : r.mistakes === 1 ? 2 : 1, 3, 3), h('p', { class: 'result-note' }, 'A new puzzle arrives tomorrow.')), buttons: [{ label: 'Practice', value: 1 }], dismissable: false });
    back();
  })();
  return () => ctx.destroy();
}

function gym(app, nav) {
  const ctx = createPlayCtx(app, { title: 'Mistake Gym', subtitle: 'Your own games', onBack: back, backLabel: 'Practice' });
  (async () => {
    const list = [...save.gym].reverse();
    let i = 0;
    for (const g of list) {
      if (!ctx.alive) return;
      i++;
      const pos = Position.fromFEN(g.fen);
      ctx.board.flipped = pos.turn === BLACK;
      const p = { fen: g.fen, accept: 'engine', margin: 60, prompt: `In your game you played **${g.played}**. Find a better move!`, explain: `Yes! In the game: ${g.text}` };
      const r = await solvePuzzle(ctx, p, { index: i - 1, total: list.length });
      if (!r || !ctx.alive) return;
      if (r.mistakes === 0) { save.gym = save.gym.filter(x => x.fen !== g.fen); persist(); toast('Mastered! Removed from the gym.'); }
    }
    if (!ctx.alive) return;
    await modal({ body: h('div', { class: 'result' }, pixelText('WORKOUT DONE', { scale: 3 }), h('p', { class: 'result-note' }, 'Positions solved on the first try are cleared from the gym.')), buttons: [{ label: 'Practice', value: 1 }], dismissable: false });
    back();
  })();
  return () => ctx.destroy();
}

// Coordinate Rush: tap the named square, 30 seconds.
function rush(app, nav) {
  const ctx = createPlayCtx(app, { title: 'Coordinate Rush', subtitle: 'Practice', onBack: back, backLabel: 'Practice' });
  const { board, speech } = ctx;
  board.setPosition(Position.fromFEN(START_FEN));
  board.coords = true;
  const target = h('div', { class: 'rush-target' }, '—');
  const timer = h('div', { class: 'timer-bar' }, h('div', { style: { width: '100%' } }));
  const stats = h('div', { class: 'rush-stats' }, h('span', {}, 'Score 0'), h('span', {}, `Best ${save.practice.rush || 0}`));
  ctx.choices.append(target, timer, stats);
  const coordsToggle = h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: true, onchange: e => { board.coords = e.target.checked; } }), h('span', {}, h('b', {}, 'Show coordinates'), h('small', {}, 'Turn off for hard mode')));
  const flipToggle = h('label', { class: 'toggle' }, h('input', { type: 'checkbox', onchange: e => { board.flipped = e.target.checked; } }), h('span', {}, h('b', {}, 'Play from Black\'s side'), h('small', {}, 'The board is flipped')));
  ctx.setControls([button('Start ▶', () => start(), 'gold'), coordsToggle, flipToggle]);
  speech.show('Tap the square I name. As many as you can in **30 seconds**! Remember: letter = file (column), number = rank (row).');
  let running = false, score = 0, want = -1, t0 = 0, raf = 0;
  function nextTarget() { let s; do { s = Math.floor(Math.random() * 8) * 16 + Math.floor(Math.random() * 8); } while (s === want); want = s; target.textContent = sqName(s); }
  async function start() {
    if (running) return;
    running = true; score = 0; t0 = performance.now();
    ctx.setControls([]);
    board.interactive = 'tap';
    nextTarget();
    const tick = () => {
      if (!ctx.alive) return;
      const left = Math.max(0, 1 - (performance.now() - t0) / 30000);
      timer.firstChild.style.width = left * 100 + '%';
      if (left <= 0) { end(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    while (running && ctx.alive) {
      const sq = await ctx.waitTap();
      if (!running || sq == null) break;
      if (sq === want) { score++; sfx.star(); board.burst(sq, ['#5ef2c4', '#ffd23f', '#fff'], 10); nextTarget(); }
      else { sfx.wrong(); board.flash(sq, 'bad', 300); t0 -= 1500; }
      stats.firstChild.textContent = `Score ${score}`;
    }
  }
  async function end() {
    running = false; board.interactive = false; ctx.tapWaiter?.(null);
    const best = score > (save.practice.rush || 0);
    if (best) { save.practice.rush = score; persist(); confetti(80); }
    sfx.win();
    stats.lastChild.textContent = `Best ${save.practice.rush}`;
    target.textContent = '—';
    const v = await modal({ body: h('div', { class: 'result' }, pixelText(best ? 'NEW RECORD!' : 'TIME!', { scale: 4 }), h('p', { class: 'result-note' }, `${score} squares in 30 seconds.${score >= 25 ? ' Lightning fast!' : score >= 15 ? ' Great board vision!' : ' Keep practising!'}`)), buttons: [{ label: 'Practice', value: 'back', cls: 'ghost' }, { label: 'Again', value: 'again', cls: 'gold' }], dismissable: false });
    if (v === 'again') { ctx.setControls([]); start(); } else back();
  }
  return () => { running = false; cancelAnimationFrame(raf); ctx.destroy(); };
}

export { WHITE };
