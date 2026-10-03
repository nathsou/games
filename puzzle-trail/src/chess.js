// One rules implementation serves lessons, the coach, and complete games.
export const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
export const VALUES = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export const opposite = c => c === 'w' ? 'b' : 'w';
export const file = i => i % 8;
export const row = i => Math.floor(i / 8);
export const square = i => 'abcdefgh'[file(i)] + (8 - row(i));
export const index = s => (8 - Number(s[1])) * 8 + 'abcdefgh'.indexOf(s[0]);
const valid = (r, f) => r >= 0 && r < 8 && f >= 0 && f < 8;
const DIAGONAL = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const STRAIGHT = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const LEAPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
export function fromFEN(fen) {
  const [placement, turn = 'w', castle = '-', ep = '-', half = '0', full = '1'] = fen.split(' ');
  const board = Array(64).fill(null);
  let i = 0;
  for (const ch of placement) {
    if (ch === '/') continue;
    if (/\d/.test(ch)) i += Number(ch);
    else board[i++] = { type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? 'w' : 'b' };
  }
  if (i !== 64) throw new Error('Invalid board position');
  return { board, turn, castle: castle === '-' ? '' : castle, ep: ep === '-' ? null : index(ep), half: Number(half), full: Number(full) };
}
export function toFEN(s) {
  const rows = [];
  for (let r = 0; r < 8; r++) {
    let text = '', empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = s.board[r * 8 + f];
      if (!p) empty++;
      else { if (empty) text += empty; empty = 0; text += p.color === 'w' ? p.type.toUpperCase() : p.type; }
    }
    if (empty) text += empty;
    rows.push(text);
  }
  return `${rows.join('/')} ${s.turn} ${s.castle || '-'} ${s.ep === null ? '-' : square(s.ep)} ${s.half} ${s.full}`;
}
// Attacks include friendly occupied squares and differ from pawn movement.
export function attacksFrom(s, from) {
  const p = s.board[from];
  if (!p) return [];
  const result = [], r = row(from), f = file(from);
  if (p.type === 'p') {
    const dr = p.color === 'w' ? -1 : 1;
    for (const df of [-1, 1]) if (valid(r + dr, f + df)) result.push((r + dr) * 8 + f + df);
  } else if (p.type === 'n' || p.type === 'k') {
    for (const [dr, df] of p.type === 'n' ? LEAPS : [...DIAGONAL, ...STRAIGHT]) {
      if (valid(r + dr, f + df)) result.push((r + dr) * 8 + f + df);
    }
  } else {
    const directions = p.type === 'b' ? DIAGONAL : p.type === 'r' ? STRAIGHT : [...DIAGONAL, ...STRAIGHT];
    for (const [dr, df] of directions) {
      let nr = r + dr, nf = f + df;
      while (valid(nr, nf)) {
        const to = nr * 8 + nf;
        result.push(to);
        if (s.board[to]) break;
        nr += dr; nf += df;
      }
    }
  }
  return result;
}
export function attackers(s, target, color) {
  const result = [];
  s.board.forEach((p, i) => { if (p?.color === color && attacksFrom(s, i).includes(target)) result.push(i); });
  return result;
}
export function attacked(s, target, color) { return attackers(s, target, color).length > 0; }
export function attackMap(s, color) {
  const result = new Set();
  s.board.forEach((p, i) => { if (p?.color === color) attacksFrom(s, i).forEach(j => result.add(j)); });
  return result;
}
export function kingSquare(s, color) { return s.board.findIndex(p => p?.type === 'k' && p.color === color); }
export function inCheck(s, color = s.turn) {
  const king = kingSquare(s, color);
  return king >= 0 && attacked(s, king, opposite(color));
}
export function applyMove(s, m) {
  const board = s.board.slice(), piece = board[m.from], captured = board[m.to];
  board[m.from] = null;
  board[m.to] = m.promotion ? { type: m.promotion, color: piece.color } : piece;
  if (m.enPassant) board[m.to + (piece.color === 'w' ? 8 : -8)] = null;
  if (m.castling) {
    const rf = m.to > m.from ? m.from + 3 : m.from - 4;
    const rt = m.to > m.from ? m.from + 1 : m.from - 1;
    board[rt] = board[rf]; board[rf] = null;
  }
  let castle = s.castle;
  if (piece.type === 'k') for (const c of piece.color === 'w' ? ['K', 'Q'] : ['k', 'q']) castle = castle.replace(c, '');
  for (const [i, right] of [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']]) {
    if (m.from === i || m.to === i) castle = castle.replace(right, '');
  }
  return { board, turn: opposite(piece.color), castle, ep: piece.type === 'p' && Math.abs(m.to - m.from) === 16 ? (m.to + m.from) / 2 : null, half: piece.type === 'p' || captured || m.enPassant ? 0 : s.half + 1, full: s.full + (piece.color === 'b' ? 1 : 0) };
}
export function pseudoMoves(s, from) {
  const p = s.board[from];
  if (!p) return [];
  const result = [], r = row(from), f = file(from);
  const add = (to, extra = {}) => {
    const target = s.board[to];
    if (target?.color === p.color || target?.type === 'k') return;
    if (p.type === 'p' && (row(to) === 0 || row(to) === 7)) {
      for (const promotion of ['q', 'r', 'b', 'n']) result.push({ from, to, promotion, ...extra });
    } else result.push({ from, to, ...extra });
  };
  if (p.type === 'p') {
    const dr = p.color === 'w' ? -1 : 1, nr = r + dr;
    if (valid(nr, f) && !s.board[nr * 8 + f]) {
      add(nr * 8 + f);
      const home = p.color === 'w' ? 6 : 1;
      if (r === home && !s.board[(r + dr * 2) * 8 + f]) add((r + dr * 2) * 8 + f);
    }
    for (const df of [-1, 1]) if (valid(nr, f + df)) {
      const to = nr * 8 + f + df, target = s.board[to];
      if (target && target.color !== p.color) add(to);
      else if (to === s.ep && !target) {
        const pawn = s.board[to + (p.color === 'w' ? 8 : -8)];
        if (pawn?.type === 'p' && pawn.color !== p.color) add(to, { enPassant: true });
      }
    }
  } else {
    attacksFrom(s, from).forEach(to => add(to));
    if (p.type === 'k' && from === (p.color === 'w' ? 60 : 4) && !inCheck(s, p.color)) {
      const base = p.color === 'w' ? 56 : 0;
      for (const [right, rook, empty, safe, to] of [
        [p.color === 'w' ? 'K' : 'k', base + 7, [base + 5, base + 6], [base + 5, base + 6], base + 6],
        [p.color === 'w' ? 'Q' : 'q', base, [base + 1, base + 2, base + 3], [base + 3, base + 2], base + 2]
      ]) {
        if (s.castle.includes(right) && s.board[rook]?.type === 'r' && s.board[rook]?.color === p.color && empty.every(i => !s.board[i]) && safe.every(i => !attacked(s, i, opposite(p.color)))) add(to, { castling: true });
      }
    }
  }
  return result;
}
export function legalMoves(s, color = s.turn) {
  const result = [];
  s.board.forEach((p, from) => {
    if (p?.color === color) for (const move of pseudoMoves(s, from)) if (!inCheck(applyMove(s, move), color)) result.push(move);
  });
  return result;
}
export function deadPosition(s) {
  const pieces = s.board.map((p, i) => ({ ...p, i })).filter(p => p.type && p.type !== 'k');
  if (pieces.some(p => ['p', 'r', 'q'].includes(p.type))) return false;
  if (pieces.length <= 1) return true;
  return pieces.every(p => p.type === 'b') && pieces.every(p => (file(p.i) + row(p.i)) % 2 === (file(pieces[0].i) + row(pieces[0].i)) % 2);
}
export function status(s) {
  const moves = legalMoves(s);
  if (!moves.length && kingSquare(s, s.turn) >= 0) return inCheck(s) ? 'checkmate' : 'stalemate';
  if (kingSquare(s, 'w') >= 0 && kingSquare(s, 'b') >= 0 && deadPosition(s)) return 'dead';
  return inCheck(s) ? 'check' : 'playing';
}
export function positionKey(s) {
  // An en-passant square only distinguishes repetitions if it changes legal moves.
  const fen = toFEN(s).split(' ').slice(0, 4);
  if (s.ep !== null && !legalMoves(s).some(m => m.enPassant)) fen[3] = '-';
  return fen.join(' ');
}
export function notation(s, m) {
  const p = s.board[m.from];
  if (m.castling) return m.to > m.from ? 'O-O' : 'O-O-O';
  const capture = s.board[m.to] || m.enPassant;
  let name = p.type === 'p' ? (capture ? 'abcdefgh'[file(m.from)] : '') : p.type.toUpperCase();
  if (p.type !== 'p') {
    const others = legalMoves(s, p.color).filter(other => other.to === m.to && other.from !== m.from && s.board[other.from]?.type === p.type);
    if (others.length) name += others.every(other => file(other.from) !== file(m.from)) ? 'abcdefgh'[file(m.from)] : others.every(other => row(other.from) !== row(m.from)) ? String(8 - row(m.from)) : square(m.from);
  }
  name += (capture ? 'x' : '') + square(m.to) + (m.promotion ? '=' + m.promotion.toUpperCase() : '');
  const next = applyMove(s, m);
  if (inCheck(next)) name += legalMoves(next).length ? '+' : '#';
  return name;
}
export function explainIllegal(s, from, to) {
  const p = s.board[from];
  if (!p) return 'Select one of your pieces first.';
  if (s.board[to]?.color === p.color) return 'Your own piece occupies that square. You cannot capture a friendly piece.';
  const pseudo = pseudoMoves(s, from).find(m => m.to === to);
  if (pseudo) return inCheck(s, p.color) ? 'Your king is in check. This move does not remove the attack.' : 'That move would leave your king under attack. Your king must stay safe.';
  if (s.board[to]?.type === 'k') return 'Kings are never captured. Win by giving check with no legal escape: checkmate.';
  if (p.type === 'p') return 'Pawns move forward into empty squares and capture one square diagonally forward. Their first move may be two squares if both are empty.';
  if (p.type === 'n') return 'A knight moves two squares in one direction and one to the side. It can jump over pieces.';
  if (p.type === 'k') return 'A king moves one square in any direction, always away from enemy attacks. Castling has extra conditions.';
  return `A ${NAMES[p.type]} moves ${p.type === 'b' ? 'diagonally' : p.type === 'r' ? 'along a row or column' : 'along a row, column, or diagonal'}, and cannot jump over another piece.`;
}
export function evaluate(s, perspective = 'b') {
  let total = 0;
  s.board.forEach((p, i) => {
    if (!p) return;
    const center = 7 - Math.abs(3.5 - file(i)) - Math.abs(3.5 - row(i));
    const advance = p.color === 'w' ? 6 - row(i) : row(i) - 1;
    let bonus = p.type === 'p' ? advance * 9 + center * 3 : ['n', 'b'].includes(p.type) ? center * 10 : p.type === 'q' ? center * 2 : 0;
    if (p.type === 'k') bonus = s.full < 15 ? (file(i) < 3 || file(i) > 5 ? 35 : 0) : center * 4;
    total += (p.color === perspective ? 1 : -1) * (VALUES[p.type] + bonus);
  });
  return total;
}
export function chooseMove(s, level = 'gentle') {
  const side = s.turn;
  const ordered = state => legalMoves(state).sort((a, b) => (VALUES[state.board[b.to]?.type] || 0) - (VALUES[state.board[a.to]?.type] || 0));
  function search(state, depth, alpha, beta, ply) {
    const moves = ordered(state);
    if (!moves.length) return inCheck(state) ? (state.turn === side ? -100000 + ply : 100000 - ply) : 0;
    if (deadPosition(state)) return 0;
    if (depth === 0) return evaluate(state, side);
    const maximize = state.turn === side;
    let best = maximize ? -Infinity : Infinity;
    for (const move of moves) {
      const score = search(applyMove(state, move), depth - 1, alpha, beta, ply + 1);
      best = maximize ? Math.max(best, score) : Math.min(best, score);
      if (maximize) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  const ranked = ordered(s).map(move => ({ move, score: search(applyMove(s, move), level === 'thoughtful' ? 2 : 1, -Infinity, Infinity, 1) })).sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;
  const candidates = level === 'gentle' ? ranked.filter(r => r.score >= ranked[0].score - 65).slice(0, 4) : ranked.filter(r => r.score === ranked[0].score);
  return candidates[Math.floor(Math.random() * candidates.length)].move;
}
