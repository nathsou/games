// Turn-by-turn coaching for quest battles: what should a beginner look at right now?
// Priorities: king danger > free material > own pieces in danger > pawn races > a gentle routine reminder.
import { WHITE, PAWN, KING, typeOf, colorOf, sqName, NAMES } from './chess.js';
import { hangingPieces, see, PV, mateInOne } from './coach.js';

const N = t => NAMES[t];
const ROUTINE = [
  'Your move. Checks, captures, threats?',
  'Your move. What did that last move attack?',
  'Your move. Is anything of yours unprotected?',
  'Your move. Can you capture something safely?',
];

// Pawns that no enemy pawn can ever block or capture, with moves needed to promote.
function passedPawns(pos, color) {
  const out = [];
  for (const sq of pos.pieces(color)) {
    if (typeOf(pos.b[sq]) !== PAWN) continue;
    const f = sq & 7, r = sq >> 4;
    let passed = true;
    for (const e of pos.pieces(color ^ 1)) {
      if (typeOf(pos.b[e]) !== PAWN) continue;
      const ef = e & 7, er = e >> 4;
      if (Math.abs(ef - f) <= 1 && (color === WHITE ? er > r : er < r)) { passed = false; break; }
    }
    if (passed) {
      const adv = color === WHITE ? r : 7 - r;
      out.push({ sq, steps: 7 - adv - (adv === 1 ? 1 : 0) });
    }
  }
  return out.sort((a, b) => a.steps - b.steps);
}

export function turnAdvice(pos, me, { variant = 'standard', coaching = true, name = 'Your opponent', turn = 0 } = {}) {
  const them = me ^ 1;
  if (variant === 'king-capture') {
    const k = pos.king[me];
    if (k >= 0 && pos.isAttacked(k, them)) return { text: '⚠ Your **king** is under attack! Move it, block the attack, or capture the attacker!', tone: 'bad', danger: [k] };
    const ek = pos.king[them];
    if (ek >= 0 && pos.isAttacked(ek, me)) return { text: `${name}'s king is under attack. **Capture it** to win!`, tone: 'good', opportunities: [ek] };
  }
  if (variant === 'standard' && pos.inCheck(me)) return { text: 'You are in **check**! Move the king, block the attack, or capture the attacker.', tone: 'bad' };
  if (!coaching) return { text: ROUTINE[turn % ROUTINE.length] };
  if (variant === 'standard') {
    const mate = mateInOne(pos);
    if (mate) return { text: 'There is a **checkmate** in one move! Look at every check.', tone: 'good' };
  }
  if (variant === 'pawn-wars') {
    const mine = passedPawns(pos, me), theirs = passedPawns(pos, them);
    // We move first, so we win a race if our pawn needs no more steps than theirs.
    if (mine.length && (!theirs.length || mine[0].steps <= theirs[0].steps)) return { text: `Your pawn on [${sqName(mine[0].sq)}] is **passed**: no pawn can stop it. Run!`, tone: 'good', opportunities: [mine[0].sq] };
    if (theirs.length) return { text: `Danger! ${name}'s pawn on [${sqName(theirs[0].sq)}] is passed and needs ${theirs[0].steps} move${theirs[0].steps > 1 ? 's' : ''}. Can you capture it, or be faster?`, tone: 'bad', danger: [theirs[0].sq] };
  }
  // Free material first: that's what wins games against these characters.
  const loot = hangingPieces(pos, them).filter(h => h.gain >= (variant === 'pawn-wars' ? 100 : 200) && h.type !== KING);
  if (loot.length) {
    const h = loot[0];
    const free = !h.defenders.length;
    return { text: free ? `Look! ${name}'s ${N(h.type)} on [${sqName(h.sq)}] is **unprotected**. Can you grab it?` : `You can **win** the ${N(h.type)} on [${sqName(h.sq)}]: you attack it with something cheaper.`, tone: 'good', opportunities: loot.slice(0, 2).map(x => x.sq) };
  }
  const mine = hangingPieces(pos, me).filter(h => h.gain >= (variant === 'pawn-wars' ? 100 : 200) && h.type !== KING);
  if (mine.length) {
    const h = mine[0];
    return { text: `Careful: your ${N(h.type)} on [${sqName(h.sq)}] is in danger${h.defenders.length ? ' (not protected enough)' : ' (nothing protects it)'}. Move it, protect it, or block!`, tone: 'bad', danger: mine.map(x => x.sq) };
  }
  return { text: ROUTINE[turn % ROUTINE.length] };
}

// After the opponent captures one of our pieces: say why it happened, or that we can take back.
export function captureNote(pos, entry, me, name) {
  const sq = entry.to, victim = entry.capturedType;
  if (!victim) return null;
  const attacker = typeOf(pos.b[sq]);
  const back = see(pos, sq); // our turn now
  if (back >= PV[attacker] - 50 || (back > 0 && PV[victim] <= PV[attacker])) return { text: `${name} took your ${N(victim)}. You can **take back** on [${sqName(sq)}]!`, tone: '' };
  if (back > 0) return { text: `${name} took your ${N(victim)} with a ${N(attacker)}. You can capture back, but you'll still be down material: a ${N(attacker)} is worth less than a ${N(victim)}.`, tone: 'bad' };
  return { text: `${name} took your ${N(victim)} on [${sqName(sq)}]: nothing was protecting it. Before each move, check which enemy pieces can reach your piece's square!`, tone: 'bad' };
}

export { colorOf };
