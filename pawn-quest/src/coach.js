// The coach: turns engine numbers into beginner-friendly explanations.
// Everything here is algorithmic: static exchange evaluation, tactic
// pattern detection, opening principles and a small search.
import {
  WHITE, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, F_CAPTURE, F_CASTLE, F_PROMO, F_EP,
  typeOf, colorOf, mFrom, mTo, mFlags, mPromo, sqName, NAMES, COLOR_NAMES, BISHOP_D, ROOK_D, uci,
} from './chess.js';
import { search, MATE, isMateScore } from './engine.js';

export const PV = [0, 100, 300, 300, 500, 900, 10000];
const N = t => NAMES[t];

// ------------------------------------------------------------ static exchange

// Best material gain (centipawns, >= 0) for the side to move by capturing on `sq`.
export function see(pos, sq, depth = 0) {
  if (depth > 12) return 0;
  const caps = pos.legalMoves().filter(m => mTo(m) === sq && (mFlags(m) & F_CAPTURE) && !(mFlags(m) & F_EP));
  if (!caps.length) return 0;
  let m = caps[0];
  for (const c of caps) if (PV[typeOf(pos.b[mFrom(c)])] < PV[typeOf(pos.b[mFrom(m)])]) m = c;
  const victim = PV[typeOf(pos.b[sq])];
  if (victim >= 10000) return victim; // capturing a king ends it (king-capture variant)
  const promo = (mFlags(m) & F_PROMO) ? PV[QUEEN] - PV[PAWN] : 0;
  pos.make(m);
  const reply = see(pos, sq, depth + 1);
  pos.unmake();
  return Math.max(0, victim + promo - reply);
}

// How much `byColor` could win by capturing the piece on `sq` right now.
export function threatOn(pos, sq, byColor) {
  if (pos.turn === byColor) return see(pos, sq);
  if (pos.usesChecks() && pos.inCheck()) return 0;
  pos.makeNull();
  const g = see(pos, sq);
  pos.unmakeNull();
  return g;
}

// Pieces of `color` that the opponent could win right now.
export function hangingPieces(pos, color) {
  const out = [];
  for (const sq of pos.pieces(color)) {
    const t = typeOf(pos.b[sq]);
    if (t === KING && pos.rules.variant !== 'king-capture' && pos.rules.variant !== 'capture-all') continue;
    const gain = threatOn(pos, sq, color ^ 1);
    if (gain > 0) out.push({ sq, type: t, gain, attackers: pos.attackers(sq, color ^ 1), defenders: pos.attackers(sq, color) });
  }
  return out.sort((a, b) => b.gain - a.gain);
}

// Squares attacked by `color` (count per square, 0x88 indexed).
export function attackMap(pos, color) {
  const map = new Int8Array(128);
  for (const sq of pos.pieces(color)) for (const t of pos.attacksFrom(sq)) map[t]++;
  return map;
}

export function mateInOne(pos) {
  if (!pos.usesChecks() && pos.rules.variant !== 'king-capture') return 0;
  for (const m of pos.legalMoves()) {
    pos.make(m);
    const st = pos.status();
    pos.unmake();
    if (st && (st.reason === 'checkmate' || st.reason === 'king-captured')) return m;
  }
  return 0;
}

// What would the opponent do if it were their move? (null-move threat check)
export function opponentThreat(pos, depth = 3) {
  if (pos.usesChecks() && pos.inCheck()) return null;
  const me = pos.turn;
  const p = pos.clone();
  p.makeNull();
  const mate = mateInOne(p);
  if (mate) return { kind: 'mate', mate: true, move: mate, san: p.san(mate), gain: 0 };
  const base = materialBalance(p, me ^ 1);
  const r = search(p, { depth, timeMs: 400 });
  if (!r.move) return null;
  // Material after the threatening line, as seen by the threatening side.
  const gain = lineMaterial(p, r.pv.slice(0, 4), me ^ 1) - base;
  if (gain >= 200 || isMateScore(r.score) && r.score > 0) {
    const victimSq = mTo(r.move);
    const victim = p.b[victimSq];
    return { kind: victim ? 'capture' : 'tactic', move: r.move, san: p.san(r.move), gain, victimSq, victimType: victim ? typeOf(victim) : 0, mate: isMateScore(r.score) && r.score > 0 };
  }
  return null;
}

export function materialBalance(pos, color) {
  let s = 0;
  for (const sq of pos.pieces()) {
    const p = pos.b[sq], t = typeOf(p);
    if (t === KING) continue;
    s += (colorOf(p) === color ? 1 : -1) * PV[t];
  }
  return s;
}

// Material balance for `color` after playing a line (stops at an illegal move).
function lineMaterial(pos, line, color) {
  let n = 0;
  for (const m of line) { if (!m) break; pos.make(m); n++; }
  const v = materialBalance(pos, color);
  while (n--) pos.unmake();
  return v;
}

// ------------------------------------------------------------ tactics

const isSlider = t => t === BISHOP || t === ROOK || t === QUEEN;
const dirsOf = t => t === BISHOP ? BISHOP_D : t === ROOK ? ROOK_D : [...BISHOP_D, ...ROOK_D];

// Describe a tactic created by move `m` in `pos` (before the move).
// Returns {type, text, targets, arrows} or null.
export function describeTactic(pos, m, who = 'You') {
  const us = pos.turn, them = us ^ 1;
  const from = mFrom(m), to = mTo(m);
  const moverType = (mFlags(m) & F_PROMO) ? mPromo(m) : typeOf(pos.b[from]);
  pos.make(m);
  const res = [];
  try {
    const st = pos.status();
    if (st && (st.reason === 'checkmate' || st.reason === 'king-captured')) return { type: 'mate', text: 'Checkmate!', targets: [pos.king[them]], arrows: [] };
    const check = pos.inCheck(them);
    const checkers = check ? pos.attackers(pos.king[them], us) : [];
    // Fork / double attack by the moved piece.
    const targets = [];
    for (const t of pos.attacksFrom(to)) {
      const q = pos.b[t];
      if (!q || colorOf(q) !== them) continue;
      const qt = typeOf(q);
      if (qt === KING) { targets.push(t); continue; }
      const defended = pos.attackers(t, them).length > 0;
      if (PV[qt] > PV[moverType] || !defended) targets.push(t);
    }
    const moverSafe = threatOn(pos, to, them) < PV[moverType] || targets.some(t => typeOf(pos.b[t]) === KING);
    if (targets.length >= 2 && moverSafe) {
      const names = targets.map(t => `the ${N(typeOf(pos.b[t]))} on [${sqName(t)}]`);
      const kind = moverType === KNIGHT ? 'knight fork' : moverType === PAWN ? 'pawn fork' : 'double attack';
      res.push({ type: 'fork', score: 90, text: `${cap(kind)}! ${who === 'You' ? 'Your' : who + "'s"} ${N(moverType)} attacks ${listJoin(names)} at once.`, targets, arrows: targets.map(t => [to, t]) });
    }
    // Discovered attack / double check.
    for (const sq of pos.pieces(us)) {
      if (sq === to || !isSlider(typeOf(pos.b[sq]))) continue;
      for (const d of dirsOf(typeOf(pos.b[sq]))) {
        let t = sq + d, passed = false;
        while (!(t & 0x88)) { if (t === from) passed = true; if (pos.b[t]) break; t += d; }
        if (!passed || (t & 0x88)) continue;
        const q = pos.b[t];
        if (colorOf(q) !== them) continue;
        const qt = typeOf(q);
        if (qt === KING || PV[qt] >= 300) {
          const dbl = qt === KING && checkers.length >= 2;
          res.push({ type: dbl ? 'double check' : 'discovered attack', score: dbl ? 95 : 80, text: dbl ? 'Double check! Two pieces attack the king, so it must move.' : `Discovered ${qt === KING ? 'check' : 'attack'}! Moving the ${N(moverType)} uncovered the ${N(typeOf(pos.b[sq]))}'s line to the ${N(qt)} on [${sqName(t)}].`, targets: [t], arrows: [[sq, t]] });
        }
      }
    }
    // Pins and skewers by the moved piece.
    if (isSlider(moverType)) {
      for (const d of dirsOf(moverType)) {
        let t = to + d;
        while (!(t & 0x88) && !pos.b[t]) t += d;
        if (t & 0x88) continue;
        const first = pos.b[t];
        if (colorOf(first) !== them) continue;
        let t2 = t + d;
        while (!(t2 & 0x88) && !pos.b[t2]) t2 += d;
        if (t2 & 0x88) continue;
        const second = pos.b[t2];
        if (colorOf(second) !== them) continue;
        const ft = typeOf(first), stt = typeOf(second);
        if ((stt === KING || PV[stt] > PV[ft]) && ft !== KING && ft !== PAWN) {
          res.push({ type: 'pin', score: stt === KING ? 70 : 55, text: `Pin! The ${N(ft)} on [${sqName(t)}] can't move${stt === KING ? '' : ' safely'} without exposing the ${N(stt)} behind it.`, targets: [t, t2], arrows: [[to, t2]] });
        } else if ((ft === KING || PV[ft] > PV[stt]) && PV[stt] >= 300) {
          res.push({ type: 'skewer', score: 75, text: `Skewer! The ${N(ft)} must step aside, and then the ${N(stt)} on [${sqName(t2)}] falls.`, targets: [t, t2], arrows: [[to, t2]] });
        }
      }
    }
    if (check && !res.length) res.push({ type: 'check', score: 20, text: 'Check! The king is attacked and must deal with it.', targets: [pos.king[them]], arrows: [[checkers[0] ?? to, pos.king[them]]] });
    // Mate threat: if the opponent passed, could we mate?
    if (!check && pos.usesChecks()) {
      pos.makeNull();
      const mt = mateInOne(pos);
      if (mt) { const ms = pos.san(mt); res.push({ type: 'mate threat', score: 60, mateSan: ms, text: `This threatens checkmate with ${ms}.`, targets: [], arrows: [[mFrom(mt), mTo(mt)]] }); }
      pos.unmakeNull();
    }
  } finally {
    pos.unmake();
  }
  if (!res.length) return null;
  res.sort((a, b) => b.score - a.score);
  return res[0];
}

const cap = s => s[0].toUpperCase() + s.slice(1);
const listJoin = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

// ------------------------------------------------------------ grading

export function winProb(cp) {
  if (cp > MATE - 1000) return 1; if (cp < -MATE + 1000) return 0;
  return 1 / (1 + Math.pow(10, -cp / 400));
}

export const GRADES = {
  brilliant: { label: 'Brilliant', icon: '!!', tone: 'great' },
  best: { label: 'Best move', icon: '★', tone: 'great' },
  good: { label: 'Good', icon: '✓', tone: 'good' },
  ok: { label: 'Okay', icon: '·', tone: 'ok' },
  inaccuracy: { label: 'Inaccuracy', icon: '?!', tone: 'meh' },
  mistake: { label: 'Mistake', icon: '?', tone: 'bad' },
  blunder: { label: 'Blunder', icon: '??', tone: 'awful' },
  book: { label: 'Opening', icon: '♦', tone: 'ok' },
};

// Opening and endgame principles, as gentle notes on a move.
export function principleNote(pos, m, history = []) {
  if (pos.rules.variant !== 'standard') return null;
  const us = pos.turn, from = mFrom(m), to = mTo(m), t = typeOf(pos.b[from]), fl = mFlags(m);
  const ply = history.length;
  const homeRank = us === WHITE ? 0 : 7;
  let phase = 0;
  for (const sq of pos.pieces()) phase += [0, 0, 1, 1, 2, 4, 0][typeOf(pos.b[sq])];
  if (fl & F_CASTLE) return { tone: 'good', tag: 'castling', text: 'Castling tucks your king behind its pawns and brings a rook toward the center. Great habit!' };
  if (phase >= 18 && ply < 24) {
    if (t === PAWN && ['d4', 'e4', 'd5', 'e5'].includes(sqName(to)) && !(fl & F_CAPTURE)) return { tone: 'good', tag: 'center', text: 'Central pawns claim space and open lines for your bishops and queen.' };
    if (t === QUEEN && ply < 10) {
      const undeveloped = pos.pieces(us).filter(sq => (typeOf(pos.b[sq]) === KNIGHT || typeOf(pos.b[sq]) === BISHOP) && (sq >> 4) === homeRank).length;
      if (undeveloped >= 3 && !(fl & F_CAPTURE)) return { tone: 'meh', tag: 'development', text: 'Bringing the queen out this early lets the opponent chase it with tempo. Develop knights and bishops first.' };
    }
    if (t === KING && !(fl & F_CASTLE) && ply < 30) return { tone: 'meh', tag: 'castling', text: 'Moving the king gives up castling. Keep it home until you can castle.' };
    if ((t === KNIGHT || t === BISHOP) && (from >> 4) === homeRank) {
      if (t === KNIGHT && ((to & 7) === 0 || (to & 7) === 7)) return { tone: 'meh', tag: 'development', text: 'A knight on the edge of the board controls fewer squares. "A knight on the rim is dim!"' };
      return { tone: 'good', tag: 'development', text: `Developing your ${N(t)}: every piece wants to join the game early.` };
    }
    if (t === PAWN && (from & 7) === 5 && (from >> 4) === (us === WHITE ? 1 : 6) && pos.castle & (us === WHITE ? 3 : 12)) return { tone: 'meh', tag: 'king-safety', text: 'Moving the f-pawn early opens a diagonal toward your own king. Be careful!' };
    if (t === PAWN && ((to & 7) === 0 || (to & 7) === 7) && ply < 12 && !(fl & F_CAPTURE)) return { tone: 'meh', tag: 'development', text: 'Edge pawn moves don\'t help your pieces develop. Central pawns and pieces first!' };
    if (t !== PAWN && t !== KING && !(fl & F_CAPTURE) && ply < 16) {
      // Same piece twice in the opening?
      const moved = history.filter((h, i) => (i % 2) === (ply % 2)).some(h => h.to === from);
      if (moved) return { tone: 'meh', tag: 'development', text: 'Moving the same piece twice in the opening is slow. Try to develop a new piece each move.' };
    }
  }
  if (phase <= 8 && t === KING) {
    const cd = Math.max(3 - (to & 7), (to & 7) - 4) + Math.max(3 - (to >> 4), (to >> 4) - 4);
    const cd0 = Math.max(3 - (from & 7), (from & 7) - 4) + Math.max(3 - (from >> 4), (from >> 4) - 4);
    if (cd < cd0) return { tone: 'good', tag: 'active-king', text: 'In the endgame the king becomes a fighter. Bringing it to the center is excellent.' };
  }
  if (phase <= 10 && t === PAWN) {
    let passed = true;
    for (const e of pos.pieces(us ^ 1)) if (typeOf(pos.b[e]) === PAWN && Math.abs((e & 7) - (to & 7)) <= 1 && (us === WHITE ? (e >> 4) > (to >> 4) : (e >> 4) < (to >> 4))) passed = false;
    if (passed) return { tone: 'good', tag: 'passed-pawn', text: 'Passed pawns must be pushed! Nothing can block it with a pawn any more.' };
  }
  return null;
}

// Full analysis of a move: grade, explanation and arrows.
// `pos` is the position before the move; it is not modified.
export function explainMove(pos, m, { depth = 4, timeMs = 900, history = [], userColor = pos.turn } = {}) {
  pos = pos.clone();
  const us = pos.turn, them = us ^ 1;
  const you = us === userColor;
  const Your = you ? 'Your' : `${COLOR_NAMES[us]}'s`, your = you ? 'your' : `${COLOR_NAMES[us]}'s`;
  const Them = you ? COLOR_NAMES[them] : 'You';
  const theirPossessive = you ? `${COLOR_NAMES[them]}'s` : 'your';
  const legal = pos.legalMoves();
  const san = pos.san(m, legal);
  const from = mFrom(m), to = mTo(m), moverType = typeOf(pos.b[from]);
  const hangingBefore = hangingPieces(pos, us);

  // Search the reply after our move, then the best move from the start.
  pos.make(m);
  const st = pos.status();
  const after = st ? { move: 0, score: st.winner === us ? -MATE : st.winner === -1 ? 0 : MATE, pv: [] } : search(pos, { depth: depth - 1, timeMs });
  const scoreAfter = -after.score;
  const replyPv = after.pv.slice();
  pos.unmake();
  const before = search(pos, { depth, timeMs });
  let scoreBest = Math.max(before.score, scoreAfter);
  const bestMove = before.score >= scoreAfter ? before.move : m;
  const isBest = bestMove === m || scoreBest - scoreAfter <= 10;
  const loss = Math.max(0, winProb(scoreBest) - winProb(scoreAfter));
  const cpLoss = Math.max(0, scoreBest - scoreAfter);

  let grade;
  if (st && st.winner === us) grade = 'best';
  else if (isBest) grade = 'best';
  else if (loss < 0.04 || cpLoss < 40) grade = 'good';
  else if (loss < 0.08) grade = 'ok';
  else if (loss < 0.17) grade = 'inaccuracy';
  else if (loss < 0.3) grade = 'mistake';
  else grade = 'blunder';
  // Missing a forced mate or allowing one is always serious.
  if (isMateScore(scoreBest) && scoreBest > 0 && !(isMateScore(scoreAfter) && scoreAfter > 0)) grade = scoreAfter > 600 ? 'inaccuracy' : 'blunder';
  if (isMateScore(scoreAfter) && scoreAfter < 0 && !(isMateScore(scoreBest) && scoreBest < 0)) grade = 'blunder';

  const out = { san, uci: uci(m), grade, scoreBest, scoreAfter, cpLoss, loss, text: '', arrows: [], marks: [], tags: [], best: bestMove && bestMove !== m ? { uci: uci(bestMove), san: pos.san(bestMove, legal) } : null, reply: replyPv[0] ? { uci: uci(replyPv[0]) } : null };
  if (replyPv[0]) { pos.make(m); out.reply.san = pos.san(replyPv[0]); pos.unmake(); }

  const tacticNow = describeTactic(pos, m, you ? 'You' : COLOR_NAMES[us]);
  const note = principleNote(pos, m, history);

  if (st && st.winner === us) {
    out.text = 'Checkmate! The king is attacked and has no escape. Game over.';
    out.tags.push('checkmate');
    return out;
  }
  if (st && st.winner === -1) {
    out.text = st.reason === 'stalemate' ? 'Stalemate: the king is not attacked but there is no legal move, so the game is a draw.' : 'This leads to a draw.';
    if (isMateScore(scoreBest) && scoreBest > 0 || scoreBest > 300) { out.grade = 'blunder'; out.text += ' You were winning, so a draw is a big let-down. Always leave the enemy king a move unless it\'s checkmate!'; }
    out.tags.push('stalemate');
    return out;
  }

  if (grade === 'best' || grade === 'good' || grade === 'ok') {
    const parts = [];
    const gained = materialSwing(pos, [m, ...replyPv.slice(0, 3)], us);
    const last = history.length ? history[history.length - 1] : null;
    const lastTo = last && last.cap ? last.to : -1;
    const capturedType = (mFlags(m) & F_CAPTURE) ? (typeOf(pos.b[mTo(m)]) || PAWN) : 0;
    if (isMateScore(scoreAfter) && scoreAfter > 0) parts.push(`You have a forced checkmate coming. Keep finding the checks!`);
    else if (tacticNow && tacticNow.type !== 'check') { parts.push(tacticNow.text); out.arrows.push(...tacticNow.arrows.map(a => ({ from: a[0], to: a[1], color: 'good' }))); out.tags.push(tacticNow.type); }
    else if (capturedType && to === lastTo) parts.push(`You take back the ${N(capturedType)}. Recapturing keeps the trade even.`);
    else if (capturedType && gained >= 80) parts.push(`You win material: the ${N(capturedType)} on [${sqName(to)}] was there for the taking.`);
    else if (capturedType) {
      pos.make(m);
      const canTakeBack = pos.attackers(to, them).length > 0;
      pos.unmake();
      parts.push(canTakeBack && moverType !== KING && Math.abs(PV[capturedType] - PV[moverType]) <= 50 ? `A fair trade: ${N(moverType)} for ${N(capturedType)}.` : `You capture the ${N(capturedType)}.`);
    }
    const saved = hangingBefore.find(h => h.sq === from && h.gain >= 200);
    if (saved && !parts.length) parts.push(`${Your} ${N(saved.type)} was under attack, and now it's safe.`);
    if (!parts.length && note && note.tone === 'meh' && grade !== 'best') { parts.push(note.text); out.tags.push(note.tag); }
    if (!parts.length && tacticNow) { parts.push(tacticNow.text); out.tags.push('check'); }
    if (!parts.length && note && note.tone === 'good') { parts.push(note.text); out.tags.push(note.tag); }
    if (!parts.length) {
      // Describe what the move does: protect something, or create a threat.
      const hangingAfter = (() => { pos.make(m); const x = hangingPieces(pos, us); pos.unmake(); return x; })();
      const fixed = hangingBefore.filter(hb => hb.gain >= 100 && hb.sq !== from && !hangingAfter.some(ha => ha.sq === hb.sq));
      pos.make(m);
      const hits = pos.attacksFrom(to).filter(t => pos.b[t] && colorOf(pos.b[t]) === them && typeOf(pos.b[t]) !== KING && threatOn(pos, t, us) >= 200);
      pos.unmake();
      if (fixed.length) parts.push(`It protects ${your} ${N(fixed[0].type)} on [${sqName(fixed[0].sq)}].`);
      else if (hits.length) parts.push(`It attacks the ${N(typeOf(pos.b[hits[0]]))} on [${sqName(hits[0])}]. Your opponent has to deal with that!`);
      else parts.push(grade === 'best' ? ['Exactly what I would play.', 'Strong move!', 'Spot on.', 'That\'s the move!'][Math.floor(Math.random() * 4)] : ['A sensible move.', 'Solid.', 'Reasonable choice.'][Math.floor(Math.random() * 3)]);
    }
    out.text = parts.join(' ');
    if (grade !== 'best' && out.best && cpLoss >= 40) out.text += ` (**${out.best.san}** was a little stronger.)`;
    return out;
  }

  // ---- Something went wrong: explain why.
  const reasons = [];
  if (isMateScore(scoreAfter) && scoreAfter < 0) {
    const n = Math.ceil((MATE + scoreAfter) / 2);
    reasons.push(n <= 1 ? `This allows checkmate: ${Them} can play **${out.reply?.san || '…'}**.` : `This allows a forced checkmate in ${n}, starting with **${out.reply?.san || '…'}**.`);
    if (replyPv[0]) out.arrows.push({ from: mFrom(replyPv[0]), to: mTo(replyPv[0]), color: 'bad' });
    out.tags.push('checkmate');
  } else {
    pos.make(m);
    const reply = replyPv[0];
    if (reply) {
      const rFrom = mFrom(reply), rTo = mTo(reply);
      const victim = pos.b[rTo];
      const capturer = typeOf(pos.b[rFrom]);
      out.arrows.push({ from: rFrom, to: rTo, color: 'bad' });
      if (victim && colorOf(victim) === us) {
        const vt = typeOf(victim);
        const lost = -materialSwing(pos, replyPv.slice(0, 4), us);
        if (lost >= 90 || vt === QUEEN) {
          if (rTo === to) {
            const defenders = pos.attackers(to, us).length, attackers = pos.attackers(to, them).length;
            reasons.push(!defenders
              ? `${Your} ${N(vt)} on [${sqName(to)}] is unprotected: ${theirPossessive} ${N(capturer)} can simply take it.`
              : PV[capturer] < PV[vt]
                ? `${Your} ${N(vt)} on [${sqName(to)}] can be taken by a ${N(capturer)}. Even though it's protected, a ${N(capturer)} is worth less than a ${N(vt)}, so you lose material.`
                : `${Your} ${N(vt)} on [${sqName(to)}] is attacked ${attackers} time${attackers > 1 ? 's' : ''} but protected only ${defenders} time${defenders > 1 ? 's' : ''}, so it will be lost. Count attackers and defenders!`);
            out.tags.push('hanging');
          } else if (hangingBefore.some(h => h.sq === rTo)) {
            reasons.push(`${Your} ${N(vt)} on [${sqName(rTo)}] was already under attack and is still hanging. Save attacked pieces first!`);
            out.tags.push('hanging');
          } else {
            pos.unmake();
            const wasDefender = pos.attackers(rTo, us).includes(from);
            const lineOpened = isSlider(capturer) && onLine(rFrom, rTo, from);
            pos.make(m);
            if (lineOpened) reasons.push(`Moving the ${N(moverType)} opened a line: ${theirPossessive} ${N(capturer)} can now capture ${your} ${N(vt)} on [${sqName(rTo)}].`);
            else if (wasDefender) reasons.push(`${Your} ${N(moverType)} was protecting the ${N(vt)} on [${sqName(rTo)}]. Now it can be captured.`);
            else reasons.push(`${Them} can capture ${your} ${N(vt)} on [${sqName(rTo)}].`);
            out.tags.push('hanging');
          }
        }
      }
      if (!reasons.length) {
        const tac = describeTactic(pos, reply, Them);
        const lost = -materialSwing(pos, replyPv.slice(0, 5), us);
        if (tac && tac.type === 'mate threat') {
          reasons.push(`After **${out.reply.san}**, ${Them} threatens ${tac.mateSan ? `**${tac.mateSan}** ` : ''}checkmate!`);
          out.tags.push('mate threat');
        } else if (tac && tac.type !== 'check') {
          reasons.push(`${Them} has a ${tac.type} with **${out.reply.san}**${lost >= 150 ? ', winning material' : ''}. ${tac.text.replace(/^[^!]*! /, '')}`);
          out.tags.push(tac.type);
        } else if (lost >= 150) {
          reasons.push(`After **${out.reply.san}**, ${Them === 'You' ? 'you win' : Them + ' wins'} material by force.`);
        }
      }
    }
    pos.unmake();
    // Missed chance?
    if (bestMove && bestMove !== m) {
      const missed = describeTactic(pos, bestMove, you ? 'You' : COLOR_NAMES[us]);
      const bestGain = materialSwing(pos, before.pv.slice(0, 4), us);
      if (isMateScore(scoreBest) && scoreBest > 0) {
        const n = Math.ceil((MATE - scoreBest) / 2);
        reasons.push(n <= 1 ? `You had checkmate with **${out.best.san}**!` : `You had a forced checkmate in ${n}, starting with **${out.best.san}**.`);
        out.tags.push('checkmate');
      } else if (missed && missed.type !== 'check' && bestGain >= 150) {
        reasons.push(`Missed chance: **${out.best.san}** is a ${missed.type}. ${missed.text.replace(/^[^!]*! /, '')}`);
        out.tags.push(missed.type);
      } else if ((mFlags(bestMove) & F_CAPTURE) && bestGain >= 90) {
        reasons.push(`Missed chance: **${out.best.san}** wins the ${N(typeOf(pos.b[mTo(bestMove)]) || PAWN)} on [${sqName(mTo(bestMove))}] for free.`);
        out.tags.push('hanging');
      }
      out.arrows.push({ from: mFrom(bestMove), to: mTo(bestMove), color: 'best' });
    }
  }
  if (!reasons.length) {
    if (note && note.tone === 'meh') reasons.push(note.text);
    else reasons.push(`This makes ${your} position worse.`);
    if (out.best) reasons.push(`**${out.best.san}** was better.`);
  } else if (out.best && !reasons.some(r => r.includes(out.best.san))) reasons.push(`Better was **${out.best.san}**.`);
  out.text = reasons.join(' ');
  return out;
}

function onLine(a, b, c) {
  // Is square c strictly between a and b on a straight line?
  const df = Math.sign((b & 7) - (a & 7)), dr = Math.sign((b >> 4) - (a >> 4));
  const step = dr * 16 + df;
  if (!step) return false;
  for (let t = a + step; t !== b && !(t & 0x88); t += step) if (t === c) return true;
  return false;
}

// Material change for `color` along a line of moves.
function materialSwing(pos, line, color) {
  const before = materialBalance(pos, color);
  return lineMaterial(pos, line, color) - before;
}

// ------------------------------------------------------------ hints

// Lone-king technique (king + queen / rook(s) vs king): the "box" method.
// The box = squares the enemy king could reach, step by step, without crossing guarded squares.
function boxArea(pos, them) {
  const k = pos.king[them];
  const seen = new Set([k]), stack = [k];
  while (stack.length) {
    const sq = stack.pop();
    for (const d of [1, -1, 16, -16, 15, 17, -15, -17]) {
      const t = sq + d;
      if (t & 0x88 || seen.has(t)) continue;
      if (pos.isAttacked(t, them ^ 1)) continue;
      const p = pos.b[t];
      if (p && colorOf(p) === them) continue;
      seen.add(t); stack.push(t);
    }
  }
  return seen.size;
}

export function isLoneKing(pos) {
  const us = pos.turn, them = us ^ 1;
  if (pos.rules.variant !== 'standard' || pos.pieces(them).length !== 1) return false;
  const mine = pos.pieces(us).map(sq => typeOf(pos.b[sq]));
  return mine.some(t => t === QUEEN || t === ROOK) && !mine.includes(PAWN);
}

// Pick a teaching move: mate if possible, else shrink the box safely, else walk the king closer.
export function techniqueMove(pos) {
  const us = pos.turn, them = us ^ 1;
  const dist = (a, b) => Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 4) - (b >> 4)));
  const area0 = boxArea(pos, them);
  const options = [];
  for (const m of pos.legalMoves()) {
    const t = typeOf(pos.b[mFrom(m)]);
    pos.make(m);
    const st = pos.status();
    if (st && st.reason === 'checkmate') { pos.unmake(); return { move: m, kind: 'mate', area0, area: 0 }; }
    const safe = !st && !hangingPieces(pos, us).length && pos.repetitions() < 2;
    const area = boxArea(pos, them), kd = dist(pos.king[us], pos.king[them]);
    pos.unmake();
    if (safe) options.push({ move: m, t, area, kd });
  }
  const kd0 = dist(pos.king[us], pos.king[them]);
  const shrink = options.filter(o => o.t !== KING && o.area < area0).sort((a, b) => a.area - b.area || a.kd - b.kd);
  // Don't squeeze so hard that only the king's own square is left before our king arrives.
  if (shrink.length && (shrink[0].area >= 2 || kd0 <= 2)) return { move: shrink[0].move, kind: 'shrink', area0, area: shrink[0].area };
  const walk = options.filter(o => o.t === KING && o.area <= area0 && o.kd < kd0).sort((a, b) => a.kd - b.kd || a.area - b.area);
  if (walk.length) return { move: walk[0].move, kind: 'walk', area0, area: walk[0].area };
  // Otherwise let the engine find the precise move (king + rook needs tempo play).
  const r = search(pos, { depth: 5, timeMs: 700 });
  return r.move ? { move: r.move, kind: 'engine', area0, area: area0 } : null;
}

function loneKingHint(pos) {
  if (!isLoneKing(pos)) return null;
  const tm = techniqueMove(pos);
  if (!tm) return null;
  const sq = n => `${n} square${n === 1 ? '' : 's'}`;
  const texts = {
    mate: ['Time for the final blow! Find a check where the king has no escape square and your piece can\'t be captured.', 'Checkmate!'],
    shrink: [`Squeeze the box! His king can roam ${sq(tm.area0)}. Find a safe move that makes his box smaller, without stalemating him.`, `It shrinks the box from ${sq(tm.area0)} to ${sq(tm.area)}.`],
    walk: ['The box can\'t shrink any more on its own. Walk your king closer: checkmate needs teamwork!', 'Your king steps toward his king to help.'],
    engine: ['Keep the box closed. Sometimes you need a clever waiting move so his king has to step back.', 'It keeps the box tight and forces his king to give way.'],
  }[tm.kind];
  return { move: tm.move, nudge: texts[0], why: texts[1] };
}

const VARIANT_MATE = {
  'pawn-wars': ['You can force a pawn through! Count the moves: who reaches the end first?', 'It wins the race to promote.'],
  'king-capture': ['You can hunt down the enemy king! Look at what attacks it.', 'It leads to capturing the king.'],
  'capture-all': ['You can win this! Go after the last enemy pieces.', 'It leads to capturing everything.'],
};
const VARIANT_DEFAULT = {
  'pawn-wars': ['Keep your pawns side by side so they protect each other, and look for a pawn that can break through.', 'It keeps your pawns strong.'],
  'king-capture': ['Is your king safe? Then look for a piece of his you can capture safely.', 'It improves your position.'],
  'capture-all': ['Look at each enemy piece: can you capture one safely? If not, move a piece to a square where nothing can capture it.', 'It keeps your pieces safe.'],
};

// Graduated hint for the side to move. level 1 = nudge, 2 = which piece, 3 = the move.
export function hint(pos, { depth = 4, timeMs = 900, history = [] } = {}) {
  pos = pos.clone();
  const us = pos.turn, v = pos.rules.variant;
  const best = search(pos, { depth, timeMs });
  if (!best.move) return null;
  const m = best.move, from = mFrom(m), to = mTo(m);
  const t = typeOf(pos.b[from]);
  const san = pos.san(m);
  const out = { move: m, uci: uci(m), san, from, to, piece: t, score: best.score };
  const lone = loneKingHint(pos);
  if (lone) { const lm = lone.move; return { ...out, move: lm, uci: uci(lm), san: pos.san(lm), from: mFrom(lm), to: mTo(lm), piece: typeOf(pos.b[mFrom(lm)]), nudge: lone.nudge, why: lone.why }; }
  const hanging = hangingPieces(pos, us);
  const tac = v === 'standard' ? describeTactic(pos, m) : null;
  const threat = opponentThreat(pos, 2);
  let nudge, why;
  if (isMateScore(best.score) && best.score > 0) {
    const n = Math.ceil((MATE - best.score) / 2);
    if (VARIANT_MATE[v]) [nudge, why] = VARIANT_MATE[v];
    else {
      nudge = n === 1 ? 'There is a checkmate in one move! Look at every check you can give.' : `You have a forced checkmate in ${n}. Start with a forcing move: a check!`;
      why = n === 1 ? 'It\'s checkmate.' : 'It starts a forced mate.';
    }
  } else if ((mFlags(m) & F_CAPTURE) && threatOn(pos, to, us) >= 200 && !hanging.some(h => h.gain >= 300)) {
    const defended = pos.attackers(to, us ^ 1).length > 0;
    nudge = defended ? 'You can win material! Is one of your cheaper pieces attacking something valuable?' : 'Is anything of your opponent\'s unprotected? Count attackers and defenders.';
    why = `It wins the ${N(typeOf(pos.b[to]))} on [${sqName(to)}]${defended ? ': even if they take back, you come out ahead' : ''}.`;
  } else if (tac && tac.type !== 'check' && tac.type !== 'mate threat') {
    nudge = `Look for a ${tac.type}${tac.type === 'fork' ? ': one piece attacking two at once' : ''}.`;
    why = tac.text;
  } else if (threat && threat.mate) {
    nudge = v === 'pawn-wars' ? 'Danger! An enemy pawn is about to reach the end. Stop it or be faster!' : v === 'standard' ? `Careful! Your opponent threatens checkmate with ${threat.san}. Find a way to stop it.` : 'Careful! Your king is in danger. Make it safe first.';
    why = v === 'pawn-wars' ? 'It deals with the enemy pawn.' : 'It stops the threat.';
  } else if (hanging.length && hanging[0].gain >= 200) {
    const h = hanging[0];
    nudge = `Your ${N(h.type)} on [${sqName(h.sq)}] is in danger. Move it, protect it, or block the attack.`;
    why = from === h.sq ? 'It moves the attacked piece to safety.' : 'It deals with the threat.';
  } else if (threat && threat.gain >= 200) {
    nudge = `Your opponent threatens ${threat.san}. How can you stop it?`;
    why = 'It stops your opponent\'s threat.';
  } else if (VARIANT_DEFAULT[v]) {
    [nudge, why] = VARIANT_DEFAULT[v];
  } else {
    const note = principleNote(pos, m, history);
    if (note && note.tone === 'good') { nudge = { castling: 'Your king would love to be safe. Can you castle?', center: 'Fight for the center squares d4, e4, d5 and e5.', development: 'Bring a new piece into the game.', 'active-king': 'Endgame time: activate your king!', 'passed-pawn': 'A passed pawn wants to run!' }[note.tag]; why = note.text; }
    else {
      pos.make(m);
      const hits = pos.attacksFrom(to).filter(x => pos.b[x] && colorOf(pos.b[x]) !== us && typeOf(pos.b[x]) !== KING && PV[typeOf(pos.b[x])] >= 300);
      pos.unmake();
      nudge = 'No tricks right now. Which of your pieces is doing the least? Find it a better square.';
      why = hits.length ? `It puts pressure on the ${N(typeOf(pos.b[hits[0]]))} on [${sqName(hits[0])}].` : `It brings your ${N(t)} to a more useful square.`;
    }
  }
  return { ...out, nudge, why };
}

// ------------------------------------------------------------ tidy summaries

// Short text about what the opponent's last move threatens (for "advice" mode).
export function threatSummary(pos) {
  const us = pos.turn;
  const out = [];
  if (pos.usesChecks() && pos.inCheck()) out.push({ kind: 'check', text: 'You are in check! Move the king, block the attack, or capture the attacker.' });
  const t = out.length ? null : opponentThreat(pos, 2);
  if (t && t.mate) out.push({ kind: 'mate', move: t.move, text: `Danger: your opponent threatens checkmate with **${t.san}**!` });
  const hanging = hangingPieces(pos, us).filter(h => h.gain >= 200);
  for (const h of hanging.slice(0, 2)) out.push({ kind: 'hanging', sq: h.sq, text: `Your ${N(h.type)} on [${sqName(h.sq)}] is under attack${h.defenders.length ? ' and not protected enough' : ' and unprotected'}.` });
  if (!out.length && t && t.gain >= 200) out.push({ kind: 'threat', move: t.move, text: `Your opponent threatens **${t.san}**, winning material.` });
  return out;
}

