// Evaluation and alpha-beta search. Variant-aware, with "personalities" so
// opponents can be greedy, timid, sloppy or sharp.
import {
  WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, F_CAPTURE, F_PROMO,
  typeOf, colorOf, mFrom, mTo, mFlags, mPromo, uci,
} from './chess.js';

export const MATE = 100000;
export const CP = [0, 100, 320, 330, 500, 900, 0];
const INF = 1e9;

// Simplified evaluation tables (rank 8 first, from White's point of view).
const PST_SRC = {
  [PAWN]: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  [KNIGHT]: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  [BISHOP]: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  [ROOK]: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  [QUEEN]: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  [KING]: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
  7: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50],
};
// PST[color][type][sq88]
const PST = [[], []];
for (let c = 0; c < 2; c++) for (let t = 1; t <= 7; t++) {
  const a = new Int16Array(128);
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const idx = c === WHITE ? (7 - r) * 8 + f : r * 8 + f;
    a[r * 16 + f] = PST_SRC[t][idx];
  }
  PST[c][t] = a;
}
const PASSED = [0, 5, 12, 22, 40, 65, 105, 0];
const PHASE_W = [0, 0, 1, 1, 2, 4, 0];
const centerDist = sq => Math.max(3 - (sq & 7), (sq & 7) - 4) + Math.max(3 - (sq >> 4), (sq >> 4) - 4);
const dist = (a, b) => Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 4) - (b >> 4)));

const NO_STYLE = { aggression: 0, timid: 0, knights: 0, bishops: 0, pawnPush: 0, kingWalk: 0 };

// Static evaluation from the side to move's point of view.
export function evaluate(pos, style = NO_STYLE) {
  const v = pos.rules.variant;
  if (v === 'pawn-wars') return evalPawnWars(pos);
  const b = pos.b;
  let mg = 0, eg = 0, phase = 0;
  const mat = [0, 0], pawnFiles = [new Int8Array(8), new Int8Array(8)], bishops = [0, 0];
  const pawnsSq = [[], []];
  let extra = 0;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const p = b[sq];
    if (!p) continue;
    const t = p & 7, c = p >> 3, sgn = c === WHITE ? 1 : -1;
    phase += PHASE_W[t];
    if (t === KING) {
      mg += sgn * PST[c][KING][sq]; eg += sgn * PST[c][7][sq];
      continue;
    }
    mat[c] += CP[t];
    const ps = PST[c][t][sq];
    mg += sgn * (CP[t] + ps); eg += sgn * (CP[t] + (t === PAWN ? 0 : ps));
    if (t === PAWN) { pawnFiles[c][sq & 7]++; pawnsSq[c].push(sq); }
    else if (t === BISHOP) bishops[c]++;
    if (style !== NO_STYLE) {
      const adv = c === WHITE ? (sq >> 4) : 7 - (sq >> 4);
      if (t !== PAWN) extra += sgn * (style.aggression * (adv >= 4 ? 12 : 0) - style.timid * (adv >= 4 ? 18 : 0));
      if (t === KNIGHT) extra += sgn * style.knights * 25;
      if (t === BISHOP) extra += sgn * style.bishops * 25;
      if (t === PAWN) extra += sgn * style.pawnPush * adv * 4;
    }
  }
  // Pawn structure.
  for (let c = 0; c < 2; c++) {
    const sgn = c === WHITE ? 1 : -1, them = c ^ 1;
    for (let f = 0; f < 8; f++) if (pawnFiles[c][f] > 1) { mg -= sgn * 12 * (pawnFiles[c][f] - 1); eg -= sgn * 20 * (pawnFiles[c][f] - 1); }
    for (const sq of pawnsSq[c]) {
      const f = sq & 7, r = sq >> 4;
      const isolated = (f === 0 || !pawnFiles[c][f - 1]) && (f === 7 || !pawnFiles[c][f + 1]);
      if (isolated) { mg -= sgn * 10; eg -= sgn * 12; }
      let passed = true;
      for (const e of pawnsSq[them]) {
        const ef = e & 7, er = e >> 4;
        if (Math.abs(ef - f) <= 1 && (c === WHITE ? er > r : er < r)) { passed = false; break; }
      }
      if (passed) {
        const adv = c === WHITE ? r : 7 - r;
        mg += sgn * PASSED[adv] * 0.5; eg += sgn * PASSED[adv] * 1.3;
        // Can the enemy king catch it? (rule of the square, endgame only)
        const ek = pos.king[them];
        if (ek >= 0 && mat[them] === 0) {
          const promoSq = c === WHITE ? 112 + f : f;
          const pawnDist = 7 - adv - (adv === 1 ? 1 : 0);
          const kingDist = dist(ek, promoSq) - (pos.turn === them ? 1 : 0);
          if (kingDist > pawnDist) eg += sgn * 500;
        }
      }
    }
  }
  if (bishops[0] >= 2) { mg += 30; eg += 40; }
  if (bishops[1] >= 2) { mg -= 30; eg -= 40; }
  // Rooks on open files and simple king shelter.
  for (let c = 0; c < 2; c++) {
    const sgn = c === WHITE ? 1 : -1;
    const k = pos.king[c];
    if (k >= 0 && phase > 10) {
      const kf = k & 7, kr = k >> 4, fwd = c === WHITE ? 16 : -16;
      if ((c === WHITE && kr <= 1) || (c === BLACK && kr >= 6)) {
        let shield = 0;
        for (let df = -1; df <= 1; df++) {
          const f = kf + df; if (f < 0 || f > 7) continue;
          const p1 = b[k + fwd + df], p2 = b[k + 2 * fwd + df];
          if (p1 === (PAWN | (c << 3)) || p2 === (PAWN | (c << 3))) shield++;
        }
        mg += sgn * (shield - 3) * 15;
      } else mg -= sgn * 25; // king wandered off its home ranks
    }
  }
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const p = b[sq];
    if ((p & 7) !== ROOK) continue;
    const c = p >> 3, sgn = c === WHITE ? 1 : -1, f = sq & 7;
    if (!pawnFiles[c][f]) { const open = !pawnFiles[c ^ 1][f]; mg += sgn * (open ? 20 : 10); eg += sgn * (open ? 10 : 5); }
  }
  if (phase > 24) phase = 24;
  let score = (mg * phase + eg * (24 - phase)) / 24;
  // Mop-up: drive a lone king to the edge and walk our king closer.
  const wk = pos.king[WHITE], bk = pos.king[BLACK];
  if (wk >= 0 && bk >= 0) {
    const diff = mat[WHITE] - mat[BLACK];
    if (Math.abs(diff) >= 400 && (mat[WHITE] === 0 || mat[BLACK] === 0 || phase <= 6)) {
      const win = diff > 0 ? WHITE : BLACK, loserK = win === WHITE ? bk : wk, winK = win === WHITE ? wk : bk;
      const mop = centerDist(loserK) * 12 + (14 - dist(wk, bk) * 2) * 4 + (loserK & 7 && (loserK & 7) !== 7 && (loserK >> 4) && (loserK >> 4) !== 7 ? 0 : 20);
      score += win === WHITE ? mop : -mop;
      void winK;
    }
  }
  if (v === 'capture-all') score = (mat[WHITE] - mat[BLACK]) + (score - (mat[WHITE] - mat[BLACK])) * 0.3;
  score += extra;
  const s = pos.turn === WHITE ? score : -score;
  return Math.round(s + 10);
}

function evalPawnWars(pos) {
  let score = 0;
  const pawns = [[], []];
  for (const sq of pos.pieces()) { const p = pos.b[sq]; pawns[colorOf(p)].push(sq); }
  let bestRace = [99, 99];
  for (let c = 0; c < 2; c++) {
    const sgn = c === WHITE ? 1 : -1;
    for (const sq of pawns[c]) {
      const f = sq & 7, r = sq >> 4, adv = c === WHITE ? r : 7 - r;
      score += sgn * (100 + adv * adv * 6 + (f >= 2 && f <= 5 ? 6 : 0));
      let passed = true;
      for (const e of pawns[c ^ 1]) { const ef = e & 7, er = e >> 4; if (Math.abs(ef - f) <= 1 && (c === WHITE ? er > r : er < r)) { passed = false; break; } }
      if (passed) {
        const steps = 7 - adv - (adv === 1 ? 1 : 0);
        score += sgn * (60 + adv * 25);
        bestRace[c] = Math.min(bestRace[c], steps);
      }
      // Defended pawns are sturdier.
      const back = c === WHITE ? -16 : 16;
      for (const d of [back - 1, back + 1]) { const t = sq + d; if (!(t & 0x88) && pos.b[t] === pos.b[sq]) score += sgn * 8; }
    }
  }
  // Pure pawn races: the side that queens first usually wins.
  const us = pos.turn, them = us ^ 1;
  if (bestRace[us] < 99 || bestRace[them] < 99) {
    if (bestRace[us] <= bestRace[them]) score += (us === WHITE ? 1 : -1) * 400;
    else if (bestRace[them] < bestRace[us] - 0) score -= (us === WHITE ? 1 : -1) * 400;
  }
  return pos.turn === WHITE ? score : -score;
}

// ---------------------------------------------------------------- search

const TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;

export class Searcher {
  constructor(pos, opts = {}) {
    this.pos = pos;
    this.style = opts.style || NO_STYLE;
    this.deadline = opts.timeMs ? performance.now() + opts.timeMs : Infinity;
    this.nodeLimit = opts.nodeLimit || Infinity;
    this.nodes = 0;
    this.stopped = false;
    this.ttKey = new Int32Array(TT_SIZE); this.ttMove = new Int32Array(TT_SIZE);
    this.ttScore = new Int32Array(TT_SIZE); this.ttDepth = new Int8Array(TT_SIZE); this.ttFlag = new Int8Array(TT_SIZE);
    this.killers = [];
    this.history = new Int32Array(128 * 128);
    this.v = pos.rules.variant;
  }

  timeUp() {
    if (this.stopped) return true;
    if ((this.nodes & 1023) === 0 && (performance.now() > this.deadline || this.nodes > this.nodeLimit)) this.stopped = true;
    return this.stopped;
  }

  terminal(ply) {
    const pos = this.pos, v = this.v;
    if (v === 'standard') return null;
    const us = pos.turn, them = us ^ 1;
    if (v === 'king-capture') { if (pos.king[us] < 0) return -MATE + ply; return null; }
    if (v === 'capture-all') {
      let mine = false;
      for (let sq = 0; sq < 128; sq++) { if (sq & 0x88) { sq += 7; continue; } const p = pos.b[sq]; if (p && (p >> 3) === us) { mine = true; break; } }
      return mine ? null : -MATE + ply;
    }
    if (v === 'pawn-wars') {
      const rank = them === WHITE ? 112 : 0;
      for (let f = 0; f < 8; f++) { const p = pos.b[rank + f]; if (p && (p >> 3) === them) return -MATE + ply; }
      let mine = false;
      for (let sq = 0; sq < 128; sq++) { if (sq & 0x88) { sq += 7; continue; } const p = pos.b[sq]; if (p && (p >> 3) === us) { mine = true; break; } }
      return mine ? null : -MATE + ply;
    }
    return null;
  }

  orderMoves(moves, ttMove, ply) {
    const b = this.pos.b, scores = new Int32Array(moves.length);
    const k = this.killers[ply] || [];
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      if (m === ttMove) { scores[i] = 1e8; continue; }
      const fl = mFlags(m);
      if (fl & F_CAPTURE) {
        const victim = (fl & 2) ? PAWN : (b[mTo(m)] & 7);
        scores[i] = 1e6 + CP[victim] * 10 - CP[b[mFrom(m)] & 7] / 10 + (victim === KING ? 1e7 : 0);
      } else if (fl & F_PROMO) scores[i] = 9e5 + CP[mPromo(m)];
      else if (m === k[0]) scores[i] = 8e5;
      else if (m === k[1]) scores[i] = 7e5;
      else scores[i] = this.history[mFrom(m) * 128 + mTo(m)];
    }
    // insertion sort, small arrays
    for (let i = 1; i < moves.length; i++) {
      const m = moves[i], s = scores[i];
      let j = i - 1;
      while (j >= 0 && scores[j] < s) { moves[j + 1] = moves[j]; scores[j + 1] = scores[j]; j--; }
      moves[j + 1] = m; scores[j + 1] = s;
    }
    return moves;
  }

  negamax(depth, alpha, beta, ply, pvOut) {
    const pos = this.pos;
    this.nodes++;
    if (this.timeUp()) return 0;
    const term = this.terminal(ply);
    if (term !== null) return term;
    if (ply > 0 && (pos.half >= 100 || pos.repetitions() >= 2)) return 0;
    const checks = pos.usesChecks();
    const inCheck = checks && pos.inCheck();
    if (inCheck && ply < 40) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply, 0);
    if (ply > 60) return evaluate(pos, this.style);

    const idx = pos.hLo & TT_MASK;
    let ttMove = 0;
    if (this.ttKey[idx] === (pos.hHi | 0)) {
      ttMove = this.ttMove[idx];
      if (ply > 0 && this.ttDepth[idx] >= depth) {
        let s = this.ttScore[idx];
        if (s > MATE - 1000) s -= ply; else if (s < -MATE + 1000) s += ply;
        const f = this.ttFlag[idx];
        if (f === 0 || (f === 1 && s >= beta) || (f === 2 && s <= alpha)) return s;
      }
    }

    const moves = this.orderMoves(pos.gen([]), ttMove, ply);
    const us = pos.turn, alpha0 = alpha;
    let best = -INF, bestMove = 0, legal = 0;
    const childPv = [];
    for (const m of moves) {
      pos.make(m);
      if (checks && pos.isAttacked(pos.king[us], us ^ 1)) { pos.unmake(); continue; }
      legal++;
      childPv.length = 0;
      let score;
      if (legal === 1) score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, childPv);
      else {
        score = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1, childPv);
        if (score > alpha && score < beta) { childPv.length = 0; score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, childPv); }
      }
      pos.unmake();
      if (this.stopped) return 0;
      if (score > best) {
        best = score; bestMove = m;
        if (score > alpha) {
          alpha = score;
          if (pvOut) { pvOut.length = 0; pvOut.push(m, ...childPv); }
          if (alpha >= beta) {
            if (!(mFlags(m) & F_CAPTURE)) {
              const k = this.killers[ply] || (this.killers[ply] = [0, 0]);
              if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
              this.history[mFrom(m) * 128 + mTo(m)] += depth * depth;
            }
            break;
          }
        }
      }
    }
    if (!legal) {
      if (this.v === 'standard') return inCheck ? -MATE + ply : 0;
      return -MATE + ply;
    }
    let st = best;
    if (st > MATE - 1000) st += ply; else if (st < -MATE + 1000) st -= ply;
    this.ttKey[idx] = pos.hHi | 0; this.ttMove[idx] = bestMove; this.ttScore[idx] = st; this.ttDepth[idx] = depth;
    this.ttFlag[idx] = best <= alpha0 ? 2 : best >= beta ? 1 : 0;
    return best;
  }

  quiesce(alpha, beta, ply, qply) {
    const pos = this.pos;
    this.nodes++;
    if (this.timeUp()) return 0;
    const term = this.terminal(ply);
    if (term !== null) return term;
    const checks = pos.usesChecks();
    const inCheck = checks && qply < 4 && pos.inCheck();
    const us = pos.turn;
    let best;
    if (!inCheck) {
      best = evaluate(pos, this.style);
      if (best >= beta || ply > 70) return best;
      if (best > alpha) alpha = best;
    } else best = -INF;
    const moves = this.orderMoves(pos.gen([], !inCheck), 0, ply);
    let legal = 0;
    for (const m of moves) {
      pos.make(m);
      if (checks && pos.isAttacked(pos.king[us], us ^ 1)) { pos.unmake(); continue; }
      legal++;
      const score = -this.quiesce(-beta, -alpha, ply + 1, qply + 1);
      pos.unmake();
      if (this.stopped) return 0;
      if (score > best) { best = score; if (score > alpha) { alpha = score; if (alpha >= beta) break; } }
    }
    if (inCheck && !legal) return this.v === 'standard' || checks ? -MATE + ply : -MATE + ply;
    if (!inCheck && this.v !== 'standard' && !legal) {
      // No captures is fine; but having no moves at all loses in variants.
    }
    return best;
  }

  // Iterative deepening. Returns {move, score, pv, depth}.
  run(maxDepth) {
    let result = { move: 0, score: 0, pv: [], depth: 0 };
    for (let d = 1; d <= maxDepth; d++) {
      const pv = [];
      const score = this.negamax(d, -INF, INF, 0, pv);
      if (this.stopped && d > 1) break;
      if (pv.length) result = { move: pv[0], score, pv: pv.slice(), depth: d };
      else if (!result.move) result = { move: 0, score, pv: [], depth: d };
      if (Math.abs(score) > MATE - 1000 && d >= 2) break;
      if (this.stopped) break;
    }
    return result;
  }

  // Exact score of every legal root move at `depth` (each move searched with a full window).
  rootScores(depth) {
    const pos = this.pos, us = pos.turn, checks = pos.usesChecks();
    this.run(Math.max(1, depth - 1)); // warm the tables
    this.stopped = false;
    const out = [];
    const moves = this.orderMoves(pos.gen([]), 0, 0);
    for (const m of moves) {
      pos.make(m);
      if (checks && pos.isAttacked(pos.king[us], us ^ 1)) { pos.unmake(); continue; }
      const pv = [];
      const score = -this.negamax(depth - 1, -INF, INF, 1, pv);
      pos.unmake();
      out.push({ move: m, score, pv: [m, ...pv] });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }
}

export function search(pos, { depth = 4, timeMs = 0, nodeLimit = 0, style } = {}) {
  const s = new Searcher(pos.clone(), { timeMs, nodeLimit, style });
  const r = s.run(depth);
  r.nodes = s.nodes;
  return r;
}

export function rootScores(pos, depth = 3, opts = {}) {
  const s = new Searcher(pos.clone(), { ...opts });
  return s.rootScores(depth);
}

export const isMateScore = s => Math.abs(s) > MATE - 1000;
export const mateIn = s => s > 0 ? Math.ceil((MATE - s) / 2) : -Math.ceil((MATE + s) / 2);

// ---------------------------------------------------------------- personalities

function gauss(rand) { let u = 0, v = 0; while (!u) u = rand(); v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// Pick a move for a bot. `bot` fields:
//   depth, timeMs  — search effort
//   noise          — gaussian noise (centipawns) added to root scores
//   blunder        — chance per move to play a natural-looking but weaker move
//   greed          — bonus (centipawns per pawn of value) for any capture
//   style          — evaluation flavour (see NO_STYLE)
export function botMove(pos, bot = {}, rand = Math.random) {
  const legal = pos.legalMoves();
  if (!legal.length) return { move: 0 };
  if (legal.length === 1) return { move: legal[0] };
  const style = bot.style ? { ...NO_STYLE, ...bot.style } : NO_STYLE;
  if (!bot.noise && !bot.blunder && !bot.greed && !bot.opening) {
    return search(pos, { depth: bot.depth || 4, timeMs: bot.timeMs || 1500, style });
  }
  const scored = rootScores(pos, bot.depth || 2, { style, timeMs: bot.timeMs || 2500 });
  const best = scored[0].score;
  // A forced mate is always found by anyone except the sloppiest bots.
  if (best > MATE - 1000 && (bot.blunder || 0) < 0.3) return { move: scored[0].move, score: best };
  let pool = scored.map(s => {
    let v = s.score;
    if (bot.greed && (mFlags(s.move) & F_CAPTURE)) v += bot.greed * CP[pos.b[mTo(s.move)] & 7 || PAWN] / 100;
    if (bot.noise) v += gauss(rand) * bot.noise;
    if (bot.opening && pos.full <= 6) v += rand() * bot.opening;
    return { ...s, v };
  });
  if (bot.blunder && rand() < bot.blunder) {
    // A believable slip: a move that is clearly worse, but not pure nonsense
    // (prefers moves that develop, capture, or push pawns).
    const slips = pool.filter(s => s.score < best - 80 && s.score > -MATE + 1000);
    if (slips.length) {
      const natural = slips.filter(s => {
        const p = pos.b[mFrom(s.move)] & 7, fl = mFlags(s.move);
        return (fl & F_CAPTURE) || p === KNIGHT || p === BISHOP || p === PAWN || p === QUEEN;
      });
      const from = natural.length ? natural : slips;
      const pick = from[Math.floor(rand() * from.length)];
      return { move: pick.move, score: pick.score, slip: true };
    }
  }
  pool.sort((a, b) => b.v - a.v);
  return { move: pool[0].move, score: pool[0].score };
}

export { uci };
