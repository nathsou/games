// Pure level logic (no DOM): positions, collect-mode rules and par, quiz answers.
import { Position, WHITE, BLACK, KING, QUEEN, PAWN, LETTERS, START_FEN, typeOf, colorOf, mFrom, mTo, mFlags, mPromo, F_PROMO, F_CASTLE, sqParse, sqName } from './chess.js';
import { hangingPieces } from './coach.js';

export const FREE_RULES = { variant: 'free', checks: false, castling: false, enPassant: false };

export function makePosition(spec, rules) {
  const turn = spec.turn === 'b' ? BLACK : WHITE;
  if (spec.fen) {
    const p = Position.fromFEN(spec.fen === 'start' ? START_FEN : spec.fen, rules);
    if (spec.turn) { p.turn = turn; p.computeHash(); }
    return p;
  }
  return Position.fromPieces(spec.setup || '', turn, rules);
}

// ---------------------------------------------------------------- collect

export function collectSetup(L) {
  const pos = makePosition(L, FREE_RULES);
  const stars = (L.stars || []).map(sqParse);
  const targets = L.targets === 'all' ? pos.pieces(BLACK) : (L.targets || []).map(sqParse);
  const types = L.moveTypes ? new Set([...L.moveTypes].map(c => LETTERS.indexOf(c))) : null;
  return { pos, stars, targets, types };
}

export function collectMoves(pos, types, sq) {
  const p = pos.b[sq];
  if (!p || colorOf(p) !== WHITE) return [];
  if (types && !types.has(typeOf(p))) return [];
  pos.turn = WHITE;
  return pos.gen([]).filter(m => mFrom(m) === sq && (!(mFlags(m) & F_PROMO) || mPromo(m) === QUEEN));
}

// The first white piece standing on a guarded square, with its cheapest attacker.
export function capturedPiece(pos) {
  const order = [0, 1, 3, 3, 5, 9, 100];
  for (const sq of pos.pieces(WHITE)) {
    const att = pos.attackers(sq, BLACK);
    if (att.length) {
      att.sort((a, b) => order[typeOf(pos.b[a])] - order[typeOf(pos.b[b])]);
      return { victim: sq, attacker: att[0] };
    }
  }
  return null;
}

// Fewest moves to finish a collect level (breadth-first search). Returns the
// move list of an optimal solution from the given state, or null.
export function collectSolve(L, state = null, limit = 250000) {
  const base = collectSetup(L);
  const { stars, targets, types } = base;
  const pos = state ? state.pos.clone() : base.pos;
  const s0 = state ? state.s : 0, t0 = state ? state.t : 0;
  const allMask = (1 << stars.length) - 1, allT = (1 << targets.length) - 1;
  const key = (p, s, t) => p.pieces(WHITE).map(q => q + ':' + p.b[q]).join(',') + '|' + p.pieces(BLACK).join(',') + '|' + s + '|' + t;
  let frontier = [{ p: pos, s: s0, t: t0, path: [] }];
  const seen = new Set([key(pos, s0, t0)]);
  for (let depth = 1; depth <= 40 && frontier.length; depth++) {
    const next = [];
    for (const node of frontier) {
      for (const sq of node.p.pieces(WHITE)) {
        for (const m of collectMoves(node.p, types, sq)) {
          const q = node.p.clone();
          q.make(m); q.turn = WHITE;
          let s = node.s, t = node.t;
          const to = mTo(m);
          stars.forEach((x, i) => { if (x === to) s |= 1 << i; });
          targets.forEach((x, i) => { if (x === to) t |= 1 << i; });
          const path = [...node.path, m];
          if (s === allMask && t === allT) return path;
          if (!L.passive && capturedPiece(q)) continue;
          const k = key(q, s, t);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push({ p: q, s, t, path });
          if (seen.size > limit) return null;
        }
      }
    }
    frontier = next;
  }
  return null;
}

export function collectPar(L) { const p = collectSolve(L); return p ? p.length : null; }

// ---------------------------------------------------------------- quiz

export function quizPosition(q) {
  const rules = q.answer?.type === 'castle' || q.answer?.type === 'status' || q.answer?.type === 'checkers' || q.fen ? { variant: 'standard' } : FREE_RULES;
  return makePosition(q, rules);
}

// Returns { squares: [names] } or { choice: index, options }.
export function quizAnswer(q, pos = quizPosition(q)) {
  const a = q.answer;
  switch (a.type) {
    case 'squares': return { squares: a.list };
    case 'moves': {
      const from = sqParse(a.from);
      pos.turn = colorOf(pos.b[from]);
      const set = new Set(pos.gen([]).filter(m => mFrom(m) === from).map(m => sqName(mTo(m))));
      return { squares: [...set] };
    }
    case 'checkers': {
      const k = pos.king[pos.turn];
      return { squares: pos.attackers(k, pos.turn ^ 1).map(sqName) };
    }
    case 'hanging': {
      const c = a.color === 'b' ? BLACK : WHITE;
      return { squares: hangingPieces(pos, c).map(h => sqName(h.sq)) };
    }
    case 'status': {
      const st = pos.status();
      const options = ['Check', 'Checkmate', 'Stalemate'];
      const idx = st?.reason === 'checkmate' ? 1 : st?.reason === 'stalemate' ? 2 : 0;
      return { choice: idx, options };
    }
    case 'castle': {
      const can = pos.legalMoves().some(m => (mFlags(m) & F_CASTLE) && (a.side === 'k' ? mTo(m) > mFrom(m) : mTo(m) < mFrom(m)));
      return { choice: can ? 0 : 1, options: ['Yes', 'No'] };
    }
    case 'choice': return { choice: a.correct, options: a.options };
    default: return { squares: [] };
  }
}

export { sqParse, sqName, KING, PAWN };
