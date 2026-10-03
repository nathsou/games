// A game against a bot (or a friend), with optional coaching.
import { Position, WHITE, BLACK, KING, QUEEN, KNIGHT, ROOK, BISHOP, PAWN, typeOf, colorOf, mFrom, mTo, mFlags, mPromo, F_CAPTURE, F_PROMO, F_CASTLE, uci, sqName, START_FEN } from './chess.js';
import { ask } from './ai.js';
import { attackMap, hangingPieces, threatSummary } from './coach.js';
import { sfx } from './audio.js';
import { h, modal, richEl, pieceIcon } from './ui.js';

export const BOTS = {
  rookie: { name: 'Rookie Ray', char: 'rookie', level: 1, blurb: 'Just learned the moves. Makes lots of mistakes.', bot: { depth: 1, noise: 180, blunder: 0.45 } },
  hangs: { name: 'Sir Hangs-a-Lot', char: 'hangs', level: 2, blurb: 'Brave but clumsy. Often leaves pieces hanging.', bot: { depth: 1, noise: 90, blunder: 0.3 } },
  gus: { name: 'Grabby Gus', char: 'gus', level: 3, blurb: 'Captures everything he can, even when it\'s a trap.', bot: { depth: 2, noise: 50, greed: 260, blunder: 0.12 } },
  tess: { name: 'Turtle Tess', char: 'tess', level: 4, blurb: 'Hides behind her pawns and waits for your mistakes.', bot: { depth: 2, noise: 35, blunder: 0.1, style: { timid: 1 } } },
  fiona: { name: 'Fiona Forks', char: 'fiona', level: 5, blurb: 'Loves knights and double attacks. Watch your pieces!', bot: { depth: 3, noise: 25, blunder: 0.05, style: { knights: 1, aggression: 1 }, book: true } },
  iron: { name: 'The Iron Queen', char: 'iron', level: 6, blurb: 'Cold and precise. The final test of the quest.', bot: { depth: 3, noise: 12, blunder: 0.02, book: true, opening: 20 } },
  pip: { name: 'Professor Pip', char: 'pip', level: 7, blurb: 'Your teacher, at full strength. Good luck!', bot: { depth: 5, timeMs: 1600, book: true } },
};

export const BOT_LINES = {
  gus: { start: 'Har har! Everything on this board is MINE!', capture: ['Mine!', 'Grab grab grab!', 'Yoink!', 'Ooh, shiny!'], captured: ['Hey! That was mine!', 'Grr, give it back!'], lose: 'Noooo! My precious pieces!', win: 'Ha! I grabbed them all!' },
  prance: { start: 'En garde! My knights shall find your king!', capture: ['Hup!', 'A fine leap!'], captured: ['A mere scratch!', 'Most unsporting!'], lose: 'I yield, most worthy foe!', win: 'Your king is mine! Tally-ho!' },
  stomp: { start: 'Ten-hut! My pawns march as one! LEFT, RIGHT, LEFT!', capture: ['Flanked!', 'Out of formation!'], captured: ['Man down!', 'Close ranks!'], lose: 'At ease... you win, soldier.', win: 'Mission complete! Promotion for me!' },
  rollo: { start: 'Eek! A queen?! You\'ll never catch me! Wheee!', capture: [], captured: [], lose: 'Cornered... checkmate. Well played!', win: 'Hee hee! Stalemate! Or too slow! I escaped!' },
  hangs: { start: 'Ahoy! Ready for a jolly good game? I hope I don\'t drop anything...', capture: ['Oh! I got one!', 'Whoopsie, I mean, hooray!'], captured: ['Oh dear, was that important?', 'Oopsie daisy!', 'I meant to do that!'], lose: 'Oh bother. Well played, friend!', win: 'Goodness, did I win?' },
  tess: { start: 'Mmm... slow and steady. I\'ll just stay in my shell.', capture: ['Mm. Thank you.'], captured: ['Hm.', 'Slowly...'], lose: 'Mmm... you got through my shell. Well done.', win: 'Slow and steady wins the race.' },
  fiona: { start: 'Two for the price of one! Let\'s see if you can spot my forks.', capture: ['Forked!', 'Thanks for the gift!', 'Snack time!'], captured: ['Clever...', 'Ooh, sneaky!'], lose: 'A worthy rival! I\'ll sharpen my forks.', win: 'Didn\'t see that coming, did you?' },
  iron: { start: 'So, the little pawn wants a crown. Earn it.', capture: ['Expected.', 'Efficient.'], captured: ['Interesting.', 'Hmph.'], lose: '...You have earned your crown, Queen.', win: 'Not today. Return when you are ready.' },
  pip: { start: 'Hoo! No holding back this time!', capture: ['Hoo!'], captured: ['Well spotted!'], lose: 'Hoo-ray! The student beats the teacher!', win: 'Good game! Shall we look at your mistakes together?' },
  rookie: { start: 'Hi! I\'m new too! Let\'s have fun!', capture: ['Yay!'], captured: ['Aw!'], lose: 'Good game! You\'re really good!', win: 'I won?! Wow!' },
};

export function promotionPicker(color) {
  return new Promise(resolve => {
    const row = h('div', { class: 'promo-row' });
    const overlay = h('div', { class: 'overlay' }, h('div', { class: 'modal promo' }, h('h2', {}, 'Promote to…'), row));
    for (const t of [QUEEN, ROOK, BISHOP, KNIGHT]) {
      row.append(h('button', { class: 'promo-btn', 'aria-label': ['', '', 'Knight', 'Bishop', 'Rook', 'Queen'][t], onclick: () => { overlay.remove(); resolve(t); } }, pieceIcon(t, color, 4)));
    }
    document.body.append(overlay);
    row.querySelector('button').focus();
  });
}

const wait = ms => new Promise(r => setTimeout(r, ms));

export class Game {
  // opts: { board, fen, rules, user: WHITE|BLACK|'both', bot, botId, advice, warnings, threats, onEvent }
  constructor(opts) {
    this.o = opts;
    this.board = opts.board;
    this.startFen = opts.fen || START_FEN;
    this.pos = Position.fromFEN(this.startFen, opts.rules);
    this.history = [];   // { uci, san, by, fenBefore, grade?, text? }
    this.over = null;
    this.thinking = false;
    this.hints = 0; this.takebacks = 0; this.warningsShown = 0;
    this.token = 0;
    this.user = opts.user ?? WHITE;
    this.board.setPosition(this.pos);
    this.board.flipped = this.user === BLACK;
    this.board.interactive = 'move';
    this.board.movable = this.user === 'both' ? 'both' : this.user;
    this.board.legalFor = sq => (this.over || this.thinking || (this.user !== 'both' && this.pos.turn !== this.user)) ? [] : this.pos.legalMoves().filter(m => mFrom(m) === sq);
    this.board.onMove = moves => this.userMove(moves);
    this.board.onIllegal = () => sfx.illegal();
    this.refresh();
  }

  emit(type, data) { this.o.onEvent?.(type, data); }
  get moves() { return this.history.map(h => h.uci); }
  isUserTurn() { return this.user === 'both' || this.pos.turn === this.user; }

  async start() {
    this.emit('start');
    if (!this.isUserTurn()) await this.botTurn();
    else this.afterTurn();
  }

  destroy() { this.token++; this.over = this.over || { aborted: true }; }

  refresh() {
    const b = this.board, pos = this.pos;
    const last = this.history[this.history.length - 1];
    b.lastMove = last ? [last.from, last.to] : null;
    const me = this.user === 'both' ? pos.turn : this.user;
    if (this.o.threats && !this.over) {
      b.threat = attackMap(pos, me ^ 1);
      b.hanging = hangingPieces(pos, me).filter(x => x.gain >= 100).map(x => x.sq);
    } else { b.threat = null; b.hanging = []; }
    if (this.o.rules?.variant === 'king-capture' && !this.over) {
      // No "check" rule here, so point out an attacked king.
      const k = pos.king[me];
      b.hanging = k >= 0 && pos.isAttacked(k, me ^ 1) ? [...b.hanging, k] : b.hanging;
    }
  }

  async userMove(moves) {
    if (this.over || this.thinking || !this.isUserTurn()) return;
    let m = moves[0];
    if (moves.length > 1 && (mFlags(m) & F_PROMO)) {
      const t = this.pos.rules.variant === 'pawn-wars' ? QUEEN : await promotionPicker(this.pos.turn);
      m = moves.find(x => mPromo(x) === t) || m;
    }
    const tok = ++this.token;
    const fenBefore = this.pos.toFEN();
    const mover = this.pos.turn;
    const san = this.pos.san(m);
    // Coach check before committing (warnings mode).
    let review = null;
    const wantsReview = (this.o.warnings || this.o.advice) && this.pos.rules.variant === 'standard';
    const reviewP = wantsReview ? ask('explain', { fen: this.startFen, rules: this.pos.rules, moves: this.moves, uci: uci(m), userColor: mover, depth: 4, timeMs: 700 }).catch(() => null) : null;
    await this.playMove(m, 'user', fenBefore, san);
    if (tok !== this.token) return;
    if (reviewP) {
      this.thinking = true;
      this.emit('thinking', { who: 'coach' });
      review = await reviewP;
      this.thinking = false;
      if (tok !== this.token) return;
      const entry = this.history[this.history.length - 1];
      if (review) { entry.grade = review.grade; entry.text = review.text; entry.best = review.best; entry.review = review; }
      if (review && this.o.warnings && !this.over && (review.grade === 'blunder' || (review.grade === 'mistake' && review.cpLoss >= 180))) {
        this.warningsShown++;
        sfx.warn();
        this.board.arrows = (review.arrows || []).filter(a => a.color === 'bad').map(a => ({ ...a }));
        const choice = await modal({
          title: h('h2', { class: 'warn-title' }, '⚠ Wait a second!'),
          body: richEl('div', `${review.text}`, 'modal-body'),
          buttons: [{ label: 'Take it back', value: 'undo', cls: 'gold' }, { label: 'Play it anyway', value: 'keep', cls: 'ghost' }],
          dismissable: false,
        });
        this.board.arrows = [];
        if (tok !== this.token) return;
        if (choice === 'undo') { this.undoLast(); entry.undone = true; this.emit('warning-undo', { review }); this.afterTurn(); return; }
      }
      if (review && this.o.advice) this.emit('review', { entry, review });
    }
    if (this.over) return;
    if (this.user !== 'both') await this.botTurn();
    else this.afterTurn();
  }

  async playMove(m, by, fenBefore = this.pos.toFEN(), san = this.pos.san(m)) {
    const capture = mFlags(m) & F_CAPTURE, promo = mFlags(m) & F_PROMO, castle = mFlags(m) & F_CASTLE;
    const capturedType = capture ? typeOf(this.pos.b[mTo(m)]) || PAWN : 0;
    await this.board.animateMove(m);
    this.pos.make(m);
    const entry = { uci: uci(m), san, by, fenBefore, from: mFrom(m), to: mTo(m), color: this.pos.turn ^ 1, capturedType };
    this.history.push(entry);
    if (promo) sfx.promote(); else if (capture) sfx.capture(); else sfx.move();
    if (castle) this.board.burst(mTo(m), ['#5ef2c4', '#ffffff'], 12);
    if (this.pos.usesChecks() && this.pos.inCheck()) { sfx.check(); this.board.floatText(this.pos.king[this.pos.turn], 'CHECK!', '#ff5e7a'); }
    this.emit('move', { entry, capture: capturedType, by });
    this.checkEnd();
    this.refresh();
    return entry;
  }

  checkEnd() {
    const st = this.pos.status();
    let over = st;
    if (!over && this.o.customEnd) over = this.o.customEnd(this);
    const lim = this.o.maxMoves;
    if (!over && lim) {
      const userMoves = this.history.filter(h => h.by === 'user').length;
      if (userMoves >= lim && !this.isUserTurn()) over = { winner: this.o.onLimit === 'material' ? this.materialLeader() : (this.user ^ 1), reason: 'move-limit' };
    }
    if (over) {
      this.over = over;
      this.board.interactive = false;
      this.emit('end', over);
    }
    return over;
  }

  materialLeader() {
    let s = 0;
    for (const sq of this.pos.pieces()) { const p = this.pos.b[sq]; const v = [0, 1, 3, 3, 5, 9, 0][typeOf(p)]; s += colorOf(p) === this.user ? v : -v; }
    return s > 0 ? this.user : s < 0 ? (this.user ^ 1) : -1;
  }

  async botTurn() {
    if (this.over) return;
    const tok = ++this.token;
    this.thinking = true;
    this.emit('thinking', { who: 'bot' });
    const t0 = performance.now();
    let res = null;
    try { res = await ask('bot', { fen: this.startFen, rules: this.pos.rules, moves: this.moves, bot: this.o.bot }); } catch (e) { console.error(e); }
    const minDelay = this.o.botDelay ?? 450;
    const spent = performance.now() - t0;
    if (spent < minDelay) await wait(minDelay - spent);
    this.thinking = false;
    if (tok !== this.token || this.over) return;
    const m = res?.uci ? this.pos.moveFromUci(res.uci) : 0;
    if (!m) { this.checkEnd(); return; }
    await this.playMove(m, 'bot');
    if (tok !== this.token) return;
    this.afterTurn();
  }

  async afterTurn() {
    if (this.over) return;
    this.emit('your-turn');
    if (this.o.advice && this.pos.rules.variant === 'standard' && this.isUserTurn()) {
      const tok = this.token;
      const threats = await ask('threats', { fen: this.startFen, rules: this.pos.rules, moves: this.moves }).catch(() => []);
      if (tok === this.token && threats?.length) this.emit('threats', threats);
    }
  }

  undoLast() {
    const e = this.history.pop();
    if (!e) return;
    this.pos = Position.fromFEN(this.startFen, this.o.rules);
    for (const h of this.history) this.pos.make(this.pos.moveFromUci(h.uci));
    this.board.setPosition(this.pos);
    this.over = null;
    this.board.interactive = 'move';
    this.refresh();
  }

  // Take back the user's last move (and the bot reply after it).
  takeback() {
    if (this.thinking || !this.history.some(e => e.by === 'user')) return false;
    this.token++;
    while (this.history.length) {
      const last = this.history[this.history.length - 1];
      this.undoLast();
      if (last.by === 'user') break;
    }
    this.takebacks++;
    this.over = null;
    this.board.interactive = 'move';
    this.refresh();
    this.emit('takeback');
    return true;
  }

  async hint() {
    if (this.over || this.thinking || !this.isUserTurn()) return null;
    this.hints++;
    const tok = this.token;
    const r = await ask('hint', { fen: this.startFen, rules: this.pos.rules, moves: this.moves });
    if (tok !== this.token) return null;
    return r;
  }
}

export { WHITE, BLACK, sqName };
