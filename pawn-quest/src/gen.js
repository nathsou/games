// Procedurally generated training positions. Every position is verified
// with the rules engine before it is used, so drills never run out.
import { Position, WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, piece, typeOf, colorOf, mFrom, mTo, mFlags, F_CAPTURE, KNIGHT_D, uci, sqName } from './chess.js';
import { see, hangingPieces, mateInOne, threatOn } from './coach.js';
import { search, rootScores } from './engine.js';

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const ri = (r, n) => Math.floor(r() * n);
const randSq = r => ri(r, 8) * 16 + ri(r, 8);
const kdist = (a, b) => Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 4) - (b >> 4)));

function emptyPos() { return new Position({ variant: 'standard', castling: false }); }

function place(p, sq, pc) { if (p.b[sq]) return false; p.b[sq] = pc; return true; }

function finalize(p, turn = WHITE) {
  p.turn = turn; p.castle = 0; p.ep = -1;
  p.refresh();
  // Pawns can't sit on the first or last rank.
  for (const sq of p.pieces()) if (typeOf(p.b[sq]) === PAWN && ((sq >> 4) === 0 || (sq >> 4) === 7)) return null;
  if (p.king[WHITE] < 0 || p.king[BLACK] < 0) return null;
  if (kdist(p.king[WHITE], p.king[BLACK]) < 2) return null;
  if (p.inCheck(turn ^ 1)) return null; // side not to move can't be in check
  return p;
}

function mates(p) {
  const out = [];
  for (const m of p.legalMoves()) { p.make(m); const st = p.status(); p.unmake(); if (st && st.reason === 'checkmate') out.push(m); }
  return out;
}

// Mate in one with a given attacking force.
function genMate1(r, kind) {
  for (let tries = 0; tries < 4000; tries++) {
    const p = emptyPos();
    // Defending king near an edge, with a few of its own pawns.
    const edge = ri(r, 4);
    let bk;
    if (edge === 0) bk = 7 * 16 + ri(r, 8); else if (edge === 1) bk = 6 * 16 + ri(r, 8); else if (edge === 2) bk = ri(r, 8) * 16 + (r() < 0.5 ? 0 : 7); else bk = 7 * 16 + ri(r, 8);
    place(p, bk, piece(BLACK, KING));
    const nPawns = ri(r, 4);
    for (let i = 0; i < nPawns; i++) { const sq = bk - 16 + ri(r, 3) - 1; if (!(sq & 0x88) && (sq >> 4) >= 1 && (sq >> 4) <= 6) place(p, sq, piece(BLACK, PAWN)); }
    if (r() < 0.4) place(p, randSq(r), piece(BLACK, [KNIGHT, BISHOP, ROOK][ri(r, 3)]));
    let wk; do { wk = randSq(r); } while (p.b[wk]);
    place(p, wk, piece(WHITE, KING));
    const force = kind === 'queen' ? [QUEEN] : kind === 'rook' ? [ROOK] : kind === 'two' ? [ROOK, ROOK] : [[QUEEN], [ROOK, BISHOP], [QUEEN, KNIGHT], [ROOK, KNIGHT], [ROOK, ROOK], [QUEEN, BISHOP]][ri(r, 6)];
    for (const t of force) { let sq; do { sq = randSq(r); } while (p.b[sq]); place(p, sq, piece(WHITE, t)); }
    if (r() < 0.5) { const sq = randSq(r); if ((sq >> 4) >= 1 && (sq >> 4) <= 6) place(p, sq, piece(WHITE, PAWN)); }
    if (!finalize(p)) continue;
    if (p.inCheck(WHITE)) continue;
    const ms = mates(p);
    if (ms.length < 1 || ms.length > 2) continue;
    // Not too trivial: the mating piece shouldn't already be giving check-adjacent nonsense.
    const legal = p.legalMoves().length;
    if (legal < 8) continue;
    return { fen: p.toFEN(), accept: 'mate', solution: ms.map(uci), prompt: 'White to move: checkmate in one!', tag: 'checkmate' };
  }
  return null;
}

// One enemy piece can be captured for free.
function genFreePiece(r) {
  for (let tries = 0; tries < 6000; tries++) {
    const p = emptyPos();
    place(p, ri(r, 2) * 16 + 2 + ri(r, 4), piece(WHITE, KING));
    place(p, (6 + ri(r, 2)) * 16 + 2 + ri(r, 4), piece(BLACK, KING));
    const types = [PAWN, PAWN, KNIGHT, BISHOP, ROOK, QUEEN];
    const nW = 3 + ri(r, 3), nB = 3 + ri(r, 3);
    for (let i = 0; i < nW; i++) place(p, randSq(r), piece(WHITE, types[ri(r, types.length)]));
    for (let i = 0; i < nB; i++) place(p, randSq(r), piece(BLACK, types[ri(r, types.length)]));
    if (!finalize(p)) continue;
    if (p.inCheck(WHITE)) continue;
    if (mateInOne(p)) continue;
    // Exactly one black piece worth >= 3 hanging, white has nothing big hanging.
    const theirs = hangingPieces(p, BLACK).filter(h => h.gain >= 300);
    if (theirs.length !== 1) continue;
    const mine = hangingPieces(p, WHITE).filter(h => h.gain >= 100);
    if (mine.length) continue;
    const target = theirs[0];
    // Accept every capture of that piece that keeps the full gain.
    const good = p.legalMoves().filter(m => mTo(m) === target.sq && (mFlags(m) & F_CAPTURE)).filter(m => {
      p.make(m); const back = see(p, target.sq); p.unmake();
      return PIECE_CP[typeOf(p.b[target.sq])] - back >= target.gain - 1;
    });
    if (!good.length) continue;
    // Make sure there isn't something even better (like a mate) that the engine prefers.
    const best = search(p, { depth: 3, timeMs: 300 });
    if (!good.includes(best.move)) continue;
    return { fen: p.toFEN(), accept: 'list', solution: [uci(good[0])], alts: good.slice(1).map(uci), prompt: 'One enemy piece is unprotected. Win it!', tag: 'hanging', target: sqName(target.sq) };
  }
  return null;
}
const PIECE_CP = [0, 100, 300, 300, 500, 900, 10000];

// Knight fork of king + big piece.
function genFork(r) {
  for (let tries = 0; tries < 6000; tries++) {
    const p = emptyPos();
    const forkSq = (2 + ri(r, 5)) * 16 + 1 + ri(r, 6);
    const targets = KNIGHT_D.map(d => forkSq + d).filter(t => !(t & 0x88));
    if (targets.length < 4) continue;
    const kSq = targets[ri(r, targets.length)];
    let vSq; do { vSq = targets[ri(r, targets.length)]; } while (vSq === kSq);
    place(p, kSq, piece(BLACK, KING));
    place(p, vSq, piece(BLACK, r() < 0.5 ? ROOK : QUEEN));
    // The knight starts one jump away from the fork square.
    const starts = KNIGHT_D.map(d => forkSq + d).filter(t => !(t & 0x88) && !p.b[t]);
    if (!starts.length) continue;
    const nSq = starts[ri(r, starts.length)];
    place(p, nSq, piece(WHITE, KNIGHT));
    let wk; do { wk = randSq(r); } while (p.b[wk] || (wk >> 4) > 3);
    place(p, wk, piece(WHITE, KING));
    for (let i = 0; i < 2 + ri(r, 3); i++) { const sq = randSq(r); const black = r() < 0.5; if ((sq >> 4) >= 1 && (sq >> 4) <= 6) place(p, sq, piece(black ? BLACK : WHITE, PAWN)); }
    if (r() < 0.5) place(p, randSq(r), piece(WHITE, [BISHOP, ROOK][ri(r, 2)]));
    if (!finalize(p)) continue;
    if (p.inCheck(WHITE)) continue;
    const fork = p.findMove(nSq, forkSq);
    if (!fork) continue;
    // Fork square must be safe for the knight.
    p.make(fork);
    const safe = !p.isAttacked(forkSq, BLACK);
    const check = p.inCheck(BLACK);
    p.unmake();
    if (!safe || !check) continue;
    if (mateInOne(p)) continue;
    // The fork must clearly be the best move.
    const roots = rootScores(p, 3, { timeMs: 400 });
    if (!roots.length || roots[0].move !== fork) continue;
    if (roots[1] && roots[1].score > roots[0].score - 250) continue;
    return { fen: p.toFEN(), accept: 'list', solution: [uci(fork)], prompt: 'Find the knight fork: attack the king and a big piece at once!', tag: 'fork' };
  }
  return null;
}

// A white piece is attacked: save it (any move that doesn't lose material counts).
function genSavePiece(r) {
  for (let tries = 0; tries < 6000; tries++) {
    const p = emptyPos();
    place(p, ri(r, 2) * 16 + 1 + ri(r, 6), piece(WHITE, KING));
    place(p, (6 + ri(r, 2)) * 16 + 1 + ri(r, 6), piece(BLACK, KING));
    const types = [PAWN, KNIGHT, BISHOP, ROOK];
    for (let i = 0; i < 2 + ri(r, 3); i++) place(p, randSq(r), piece(WHITE, types[ri(r, 4)]));
    for (let i = 0; i < 2 + ri(r, 3); i++) place(p, randSq(r), piece(BLACK, types[ri(r, 4)]));
    if (r() < 0.5) place(p, randSq(r), piece(WHITE, QUEEN));
    if (!finalize(p)) continue;
    if (p.inCheck(WHITE)) continue;
    const mine = hangingPieces(p, WHITE).filter(h => h.gain >= 300);
    if (mine.length !== 1) continue;
    if (hangingPieces(p, BLACK).some(h => h.gain >= 100)) continue;
    if (mateInOne(p)) continue;
    const roots = rootScores(p, 3, { timeMs: 500 });
    if (roots.length < 4) continue;
    const best = roots[0].score;
    const ok = roots.filter(x => x.score >= best - 60);
    const bad = roots.filter(x => x.score < best - 200);
    if (bad.length < roots.length / 2 || ok.length > roots.length / 2) continue;
    return { fen: p.toFEN(), accept: 'list', solution: [uci(ok[0].move)], alts: ok.slice(1).map(x => uci(x.move)), prompt: `Your ${['', 'pawn', 'knight', 'bishop', 'rook', 'queen'][mine[0].type]} on [${sqName(mine[0].sq)}] is in danger. Save it!`, tag: 'hanging', danger: sqName(mine[0].sq) };
  }
  return null;
}

export function generate(kind, seed = Date.now()) {
  const r = rng(seed);
  switch (kind) {
    case 'mate1-queen': return genMate1(r, 'queen');
    case 'mate1-rook': return genMate1(r, 'rook');
    case 'mate1-two': return genMate1(r, 'two');
    case 'mate1': return genMate1(r, 'any');
    case 'free-piece': return genFreePiece(r);
    case 'fork': return genFork(r);
    case 'save-piece': return genSavePiece(r);
    default: return null;
  }
}

export const DRILLS = {
  'mate1-queen': { title: 'Queen Mates', blurb: 'Checkmate in one with the queen.' },
  'mate1-rook': { title: 'Rook Mates', blurb: 'Checkmate in one with a rook.' },
  'mate1': { title: 'Mate in One', blurb: 'Any pieces. Find the checkmate!' },
  'free-piece': { title: 'Free Lunch', blurb: 'Spot the unprotected enemy piece and take it.' },
  'save-piece': { title: 'Rescue', blurb: 'One of your pieces is attacked. Save it.' },
  'fork': { title: 'Fork Finder', blurb: 'Fork the king and a big piece with your knight.' },
};
export { BLACK };
