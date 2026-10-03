// Engine-side request handler, shared by the Web Worker and the main-thread fallback.
import { Position, uci, mFrom, mTo, mFlags, F_CAPTURE } from './chess.js';
import { search, rootScores, botMove } from './engine.js';
import { explainMove, hint, threatSummary } from './coach.js';
import { bookMove } from './book.js';
import { generate } from './gen.js';

function rebuild({ fen, rules, moves = [] }) {
  const pos = Position.fromFEN(fen, rules);
  const hist = [];
  for (const u of moves) {
    const m = pos.moveFromUci(u);
    if (!m) break;
    const capType = (mFlags(m) & F_CAPTURE) ? ((pos.b[mTo(m)] & 7) || 1) : 0;
    hist.push({ from: mFrom(m), to: mTo(m), cap: !!capType, capType });
    pos.make(m);
  }
  pos.stack.length = 0; // keep hash history for repetitions, drop undo info
  return { pos, hist };
}

export function handle(msg) {
  const { pos, hist } = rebuild(msg);
  switch (msg.cmd) {
    case 'bot': {
      if (msg.bot?.book && pos.rules.variant === 'standard') {
        const b = bookMove(msg.fen, msg.moves || [], Math.random);
        if (b && pos.moveFromUci(b)) return { uci: b, book: true };
      }
      const r = botMove(pos, msg.bot || {});
      return { uci: r.move ? uci(r.move) : null, score: r.score, slip: !!r.slip };
    }
    case 'search': {
      const r = search(pos, { depth: msg.depth || 4, timeMs: msg.timeMs || 1000 });
      return { uci: r.move ? uci(r.move) : null, score: r.score, pv: r.pv.map(uci), depth: r.depth };
    }
    case 'roots': {
      return rootScores(pos, msg.depth || 3, { timeMs: msg.timeMs || 2000 }).map(r => ({ uci: uci(r.move), score: r.score }));
    }
    case 'explain': {
      const m = pos.moveFromUci(msg.uci);
      if (!m) return null;
      return explainMove(pos, m, { depth: msg.depth || 4, timeMs: msg.timeMs || 900, history: hist, userColor: msg.userColor ?? pos.turn });
    }
    case 'hint': return hint(pos, { depth: msg.depth || 4, history: hist });
    case 'threats': return threatSummary(pos);
    case 'gen': return generate(msg.kind, msg.seed);
    default: throw new Error('Unknown command ' + msg.cmd);
  }
}
