// Chess rules on a 0x88 board. Supports standard chess plus the teaching
// variants used by the quest: boards without kings, "capture the king",
// "capture everything" and pawn wars.

export const WHITE = 0, BLACK = 1;
export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
export const F_CAPTURE = 1, F_EP = 2, F_CASTLE = 4, F_DOUBLE = 8, F_PROMO = 16;

export const piece = (color, type) => type | (color << 3);
export const typeOf = p => p & 7;
export const colorOf = p => p >> 3;

export const mFrom = m => m & 127;
export const mTo = m => (m >> 7) & 127;
export const mPromo = m => (m >> 14) & 7;
export const mFlags = m => m >> 17;
export const mkMove = (from, to, promo = 0, flags = 0) => from | (to << 7) | (promo << 14) | (flags << 17);

export const fileOf = sq => sq & 7;
export const rankOf = sq => sq >> 4;
export const sqName = sq => 'abcdefgh'[sq & 7] + ((sq >> 4) + 1);
export const sqParse = s => (s.charCodeAt(1) - 49) * 16 + (s.charCodeAt(0) - 97);
export const onBoard = sq => !(sq & 0x88);
export const sq64 = sq => (sq >> 4) * 8 + (sq & 7);
export const sq88 = i => (i >> 3) * 16 + (i & 7);

export const VALUE = [0, 1, 3, 3, 5, 9, 0];
export const NAMES = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
export const LETTERS = ' PNBRQK';
export const COLOR_NAMES = ['White', 'Black'];

export const KNIGHT_D = [33, 31, 18, 14, -33, -31, -18, -14];
export const KING_D = [1, -1, 16, -16, 17, 15, -17, -15];
export const BISHOP_D = [17, 15, -17, -15];
export const ROOK_D = [16, -16, 1, -1];

export const DEFAULT_RULES = Object.freeze({
  variant: 'standard', // standard | king-capture | capture-all | pawn-wars | free
  checks: true,        // illegal to leave your king attacked (when you have one)
  castling: true,
  enPassant: true,
});

// Zobrist keys (deterministic xorshift so hashes are stable across sessions).
let seed = 0x2545f491;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
const Z_LO = new Uint32Array(16 * 128), Z_HI = new Uint32Array(16 * 128);
for (let i = 0; i < Z_LO.length; i++) { Z_LO[i] = rnd(); Z_HI[i] = rnd(); }
const Z_SIDE = [rnd(), rnd()];
const Z_CASTLE_LO = new Uint32Array(16), Z_CASTLE_HI = new Uint32Array(16);
for (let i = 0; i < 16; i++) { Z_CASTLE_LO[i] = rnd(); Z_CASTLE_HI[i] = rnd(); }
const Z_EP_LO = new Uint32Array(8), Z_EP_HI = new Uint32Array(8);
for (let i = 0; i < 8; i++) { Z_EP_LO[i] = rnd(); Z_EP_HI[i] = rnd(); }

const CASTLE_MASK = new Uint8Array(128).fill(15);
CASTLE_MASK[0] = 15 & ~2; CASTLE_MASK[7] = 15 & ~1; CASTLE_MASK[4] = 15 & ~3;
CASTLE_MASK[112] = 15 & ~8; CASTLE_MASK[119] = 15 & ~4; CASTLE_MASK[116] = 15 & ~12;

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export class Position {
  constructor(rules = {}) {
    this.b = new Int8Array(128);
    this.turn = WHITE;
    this.castle = 0;
    this.ep = -1;
    this.half = 0;
    this.full = 1;
    this.king = [-1, -1];
    this.rules = { ...DEFAULT_RULES, ...rules };
    this.hLo = 0; this.hHi = 0;
    this.stack = [];
    this.hist = [];
  }

  static fromFEN(fen, rules) {
    const p = new Position(rules);
    const [placement, turn = 'w', castle = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
    let rank = 7, file = 0;
    for (const ch of placement) {
      if (ch === '/') { rank--; file = 0; continue; }
      if (ch >= '1' && ch <= '8') { file += +ch; continue; }
      const t = LETTERS.indexOf(ch.toUpperCase());
      if (t <= 0) throw new Error('Bad FEN: ' + fen);
      p.b[rank * 16 + file] = piece(ch === ch.toUpperCase() ? WHITE : BLACK, t);
      file++;
    }
    p.turn = turn === 'b' ? BLACK : WHITE;
    if (castle !== '-') for (const ch of castle) p.castle |= { K: 1, Q: 2, k: 4, q: 8 }[ch] || 0;
    p.ep = ep === '-' ? -1 : sqParse(ep);
    p.half = +half || 0; p.full = +full || 1;
    p.sanitizeCastling();
    p.refresh();
    return p;
  }

  // Compact placement notation used by the lessons: "Ke1 Qd1 ke8 pa7".
  // Uppercase = White, lowercase = Black.
  static fromPieces(spec, turn = WHITE, rules) {
    const p = new Position(rules);
    for (const tok of spec.trim().split(/[\s,]+/).filter(Boolean)) {
      const t = LETTERS.indexOf(tok[0].toUpperCase());
      if (t <= 0) throw new Error('Bad piece token: ' + tok);
      p.b[sqParse(tok.slice(1, 3))] = piece(tok[0] === tok[0].toUpperCase() ? WHITE : BLACK, t);
    }
    p.turn = turn;
    if (p.rules.castling) {
      if (p.b[4] === piece(WHITE, KING)) { if (p.b[7] === piece(WHITE, ROOK)) p.castle |= 1; if (p.b[0] === piece(WHITE, ROOK)) p.castle |= 2; }
      if (p.b[116] === piece(BLACK, KING)) { if (p.b[119] === piece(BLACK, ROOK)) p.castle |= 4; if (p.b[112] === piece(BLACK, ROOK)) p.castle |= 8; }
    }
    p.refresh();
    return p;
  }

  sanitizeCastling() {
    const b = this.b;
    if (b[4] !== piece(WHITE, KING)) this.castle &= ~3;
    if (b[7] !== piece(WHITE, ROOK)) this.castle &= ~1;
    if (b[0] !== piece(WHITE, ROOK)) this.castle &= ~2;
    if (b[116] !== piece(BLACK, KING)) this.castle &= ~12;
    if (b[119] !== piece(BLACK, ROOK)) this.castle &= ~4;
    if (b[112] !== piece(BLACK, ROOK)) this.castle &= ~8;
    if (!this.rules.castling) this.castle = 0;
  }

  refresh() {
    this.king = [-1, -1];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = this.b[sq];
      if (typeOf(p) === KING) this.king[colorOf(p)] = sq;
    }
    this.computeHash();
    this.hist = [this.hLo];
  }

  computeHash() {
    let lo = 0, hi = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = this.b[sq];
      if (p) { lo ^= Z_LO[p * 128 + sq]; hi ^= Z_HI[p * 128 + sq]; }
    }
    lo ^= Z_SIDE[this.turn]; hi ^= Z_SIDE[this.turn ^ 1];
    lo ^= Z_CASTLE_LO[this.castle]; hi ^= Z_CASTLE_HI[this.castle];
    if (this.ep >= 0) { lo ^= Z_EP_LO[this.ep & 7]; hi ^= Z_EP_HI[this.ep & 7]; }
    this.hLo = lo >>> 0; this.hHi = hi >>> 0;
  }

  clone() {
    const p = new Position(this.rules);
    p.b.set(this.b);
    p.turn = this.turn; p.castle = this.castle; p.ep = this.ep; p.half = this.half; p.full = this.full;
    p.king = this.king.slice(); p.hLo = this.hLo; p.hHi = this.hHi;
    p.hist = this.hist.slice();
    return p;
  }

  toFEN() {
    let s = '';
    for (let r = 7; r >= 0; r--) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.b[r * 16 + f];
        if (!p) { empty++; continue; }
        if (empty) { s += empty; empty = 0; }
        const ch = LETTERS[typeOf(p)];
        s += colorOf(p) === WHITE ? ch : ch.toLowerCase();
      }
      if (empty) s += empty;
      if (r) s += '/';
    }
    let c = '';
    if (this.castle & 1) c += 'K'; if (this.castle & 2) c += 'Q';
    if (this.castle & 4) c += 'k'; if (this.castle & 8) c += 'q';
    return `${s} ${this.turn ? 'b' : 'w'} ${c || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.half} ${this.full}`;
  }

  get(sq) { return this.b[typeof sq === 'string' ? sqParse(sq) : sq]; }

  pieces(color) {
    const out = [];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = this.b[sq];
      if (p && (color === undefined || colorOf(p) === color)) out.push(sq);
    }
    return out;
  }

  // ---------------------------------------------------------------- attacks

  isAttacked(sq, by) {
    const b = this.b;
    let t;
    if (by === WHITE) {
      t = sq - 15; if (!(t & 0x88) && b[t] === 1) return true;
      t = sq - 17; if (!(t & 0x88) && b[t] === 1) return true;
    } else {
      t = sq + 15; if (!(t & 0x88) && b[t] === 9) return true;
      t = sq + 17; if (!(t & 0x88) && b[t] === 9) return true;
    }
    const kn = piece(by, KNIGHT), kg = piece(by, KING);
    for (let i = 0; i < 8; i++) {
      t = sq + KNIGHT_D[i]; if (!(t & 0x88) && b[t] === kn) return true;
      t = sq + KING_D[i]; if (!(t & 0x88) && b[t] === kg) return true;
    }
    const bi = piece(by, BISHOP), ro = piece(by, ROOK), qu = piece(by, QUEEN);
    for (let i = 0; i < 4; i++) {
      let d = BISHOP_D[i]; t = sq + d;
      while (!(t & 0x88)) { const p = b[t]; if (p) { if (p === bi || p === qu) return true; break; } t += d; }
      d = ROOK_D[i]; t = sq + d;
      while (!(t & 0x88)) { const p = b[t]; if (p) { if (p === ro || p === qu) return true; break; } t += d; }
    }
    return false;
  }

  // All squares holding pieces of `by` that attack `sq`.
  attackers(sq, by) {
    const b = this.b, out = [];
    let t;
    const pd = by === WHITE ? [-15, -17] : [15, 17], pw = piece(by, PAWN);
    for (const d of pd) { t = sq + d; if (!(t & 0x88) && b[t] === pw) out.push(t); }
    const kn = piece(by, KNIGHT), kg = piece(by, KING);
    for (let i = 0; i < 8; i++) {
      t = sq + KNIGHT_D[i]; if (!(t & 0x88) && b[t] === kn) out.push(t);
      t = sq + KING_D[i]; if (!(t & 0x88) && b[t] === kg) out.push(t);
    }
    const bi = piece(by, BISHOP), ro = piece(by, ROOK), qu = piece(by, QUEEN);
    for (let i = 0; i < 4; i++) {
      let d = BISHOP_D[i]; t = sq + d;
      while (!(t & 0x88)) { const p = b[t]; if (p) { if (p === bi || p === qu) out.push(t); break; } t += d; }
      d = ROOK_D[i]; t = sq + d;
      while (!(t & 0x88)) { const p = b[t]; if (p) { if (p === ro || p === qu) out.push(t); break; } t += d; }
    }
    return out;
  }

  // Squares attacked by the piece standing on `sq` (ignores pins and turn).
  attacksFrom(sq) {
    const b = this.b, p = b[sq], out = [];
    if (!p) return out;
    const t0 = typeOf(p), c = colorOf(p);
    if (t0 === PAWN) {
      for (const d of c === WHITE ? [15, 17] : [-15, -17]) { const t = sq + d; if (!(t & 0x88)) out.push(t); }
    } else if (t0 === KNIGHT || t0 === KING) {
      for (const d of t0 === KNIGHT ? KNIGHT_D : KING_D) { const t = sq + d; if (!(t & 0x88)) out.push(t); }
    } else {
      const dirs = t0 === BISHOP ? BISHOP_D : t0 === ROOK ? ROOK_D : KING_D;
      for (const d of dirs) { let t = sq + d; while (!(t & 0x88)) { out.push(t); if (b[t]) break; t += d; } }
    }
    return out;
  }

  inCheck(color = this.turn) {
    const k = this.king[color];
    return k >= 0 && this.isAttacked(k, color ^ 1);
  }

  // ---------------------------------------------------------------- moves

  gen(out = [], capturesOnly = false) {
    const b = this.b, us = this.turn, them = us ^ 1;
    const dir = us === WHITE ? 16 : -16, startRank = us === WHITE ? 1 : 6, lastRank = us === WHITE ? 7 : 0;
    const promos = this.rules.variant === 'pawn-wars' ? [QUEEN] : [QUEEN, KNIGHT, ROOK, BISHOP];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p || (p >> 3) !== us) continue;
      const t0 = p & 7;
      if (t0 === PAWN) {
        const one = sq + dir;
        if (!(one & 0x88) && !b[one]) {
          if ((one >> 4) === lastRank) {
            if (capturesOnly) out.push(mkMove(sq, one, QUEEN, F_PROMO));
            else for (const pr of promos) out.push(mkMove(sq, one, pr, F_PROMO));
          } else if (!capturesOnly) {
            out.push(mkMove(sq, one));
            const two = one + dir;
            if ((sq >> 4) === startRank && !b[two]) out.push(mkMove(sq, two, 0, F_DOUBLE));
          }
        }
        for (const t of [one - 1, one + 1]) {
          if (t & 0x88) continue;
          const q = b[t];
          if (q && (q >> 3) === them) {
            if ((t >> 4) === lastRank) {
              if (capturesOnly) out.push(mkMove(sq, t, QUEEN, F_CAPTURE | F_PROMO));
              else for (const pr of promos) out.push(mkMove(sq, t, pr, F_CAPTURE | F_PROMO));
            } else out.push(mkMove(sq, t, 0, F_CAPTURE));
          } else if (t === this.ep && this.rules.enPassant) out.push(mkMove(sq, t, 0, F_CAPTURE | F_EP));
        }
      } else if (t0 === KNIGHT || t0 === KING) {
        const ds = t0 === KNIGHT ? KNIGHT_D : KING_D;
        for (let i = 0; i < 8; i++) {
          const t = sq + ds[i];
          if (t & 0x88) continue;
          const q = b[t];
          if (!q) { if (!capturesOnly) out.push(mkMove(sq, t)); }
          else if ((q >> 3) === them) out.push(mkMove(sq, t, 0, F_CAPTURE));
        }
      } else {
        const ds = t0 === BISHOP ? BISHOP_D : t0 === ROOK ? ROOK_D : KING_D;
        for (let i = 0; i < ds.length; i++) {
          const d = ds[i];
          let t = sq + d;
          while (!(t & 0x88)) {
            const q = b[t];
            if (!q) { if (!capturesOnly) out.push(mkMove(sq, t)); }
            else { if ((q >> 3) === them) out.push(mkMove(sq, t, 0, F_CAPTURE)); break; }
            t += d;
          }
        }
      }
    }
    if (!capturesOnly && this.castle && this.rules.castling) this.genCastles(out);
    return out;
  }

  genCastles(out) {
    const b = this.b, us = this.turn, them = us ^ 1, base = us === WHITE ? 0 : 112;
    const kRight = us === WHITE ? 1 : 4, qRight = us === WHITE ? 2 : 8;
    if (b[base + 4] !== piece(us, KING)) return;
    const safe = sq => !this.isAttacked(sq, them);
    if ((this.castle & kRight) && !b[base + 5] && !b[base + 6] && b[base + 7] === piece(us, ROOK)
      && safe(base + 4) && safe(base + 5) && safe(base + 6)) out.push(mkMove(base + 4, base + 6, 0, F_CASTLE));
    if ((this.castle & qRight) && !b[base + 3] && !b[base + 2] && !b[base + 1] && b[base] === piece(us, ROOK)
      && safe(base + 4) && safe(base + 3) && safe(base + 2)) out.push(mkMove(base + 4, base + 2, 0, F_CASTLE));
  }

  usesChecks() { return this.rules.checks && this.king[this.turn] >= 0; }

  legalMoves() {
    const out = this.gen([]);
    if (!this.usesChecks()) return out;
    const us = this.turn, res = [];
    for (const m of out) {
      this.make(m);
      if (!this.isAttacked(this.king[us], us ^ 1)) res.push(m);
      this.unmake();
    }
    return res;
  }

  isLegal(m) {
    if (!this.usesChecks()) return true;
    const us = this.turn;
    this.make(m);
    const ok = !this.isAttacked(this.king[us], us ^ 1);
    this.unmake();
    return ok;
  }

  make(m) {
    const b = this.b, from = m & 127, to = (m >> 7) & 127, fl = m >> 17, us = this.turn, them = us ^ 1;
    const p = b[from];
    let capSq = to;
    if (fl & F_EP) capSq = to + (us === WHITE ? -16 : 16);
    const cap = b[capSq];
    this.stack.push(m, cap, this.castle, this.ep, this.half, this.hLo, this.hHi, this.king[0], this.king[1]);
    let lo = this.hLo, hi = this.hHi;
    if (cap) { lo ^= Z_LO[cap * 128 + capSq]; hi ^= Z_HI[cap * 128 + capSq]; b[capSq] = 0; if ((cap & 7) === KING) this.king[them] = -1; }
    lo ^= Z_LO[p * 128 + from]; hi ^= Z_HI[p * 128 + from];
    b[from] = 0;
    const placed = (fl & F_PROMO) ? piece(us, (m >> 14) & 7) : p;
    b[to] = placed;
    lo ^= Z_LO[placed * 128 + to]; hi ^= Z_HI[placed * 128 + to];
    if ((p & 7) === KING) {
      this.king[us] = to;
      if (fl & F_CASTLE) {
        const rFrom = to > from ? to + 1 : to - 2, rTo = to > from ? to - 1 : to + 1, r = b[rFrom];
        b[rFrom] = 0; b[rTo] = r;
        lo ^= Z_LO[r * 128 + rFrom] ^ Z_LO[r * 128 + rTo]; hi ^= Z_HI[r * 128 + rFrom] ^ Z_HI[r * 128 + rTo];
      }
    }
    lo ^= Z_CASTLE_LO[this.castle]; hi ^= Z_CASTLE_HI[this.castle];
    this.castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
    lo ^= Z_CASTLE_LO[this.castle]; hi ^= Z_CASTLE_HI[this.castle];
    if (this.ep >= 0) { lo ^= Z_EP_LO[this.ep & 7]; hi ^= Z_EP_HI[this.ep & 7]; }
    this.ep = -1;
    if (fl & F_DOUBLE) {
      const epSq = (from + to) >> 1, enemyPawn = piece(them, PAWN);
      if ((!((to - 1) & 0x88) && b[to - 1] === enemyPawn) || (!((to + 1) & 0x88) && b[to + 1] === enemyPawn)) {
        this.ep = epSq; lo ^= Z_EP_LO[epSq & 7]; hi ^= Z_EP_HI[epSq & 7];
      }
    }
    this.half = (cap || (p & 7) === PAWN) ? 0 : this.half + 1;
    if (us === BLACK) this.full++;
    lo ^= Z_SIDE[us] ^ Z_SIDE[them]; hi ^= Z_SIDE[them] ^ Z_SIDE[us];
    this.turn = them;
    this.hLo = lo >>> 0; this.hHi = hi >>> 0;
    this.hist.push(this.hLo);
  }

  unmake() {
    const s = this.stack, n = s.length;
    const m = s[n - 9], cap = s[n - 8];
    this.castle = s[n - 7]; this.ep = s[n - 6]; this.half = s[n - 5]; this.hLo = s[n - 4]; this.hHi = s[n - 3];
    this.king[0] = s[n - 2]; this.king[1] = s[n - 1];
    s.length = n - 9;
    this.hist.pop();
    const b = this.b, from = m & 127, to = (m >> 7) & 127, fl = m >> 17;
    this.turn ^= 1;
    const us = this.turn;
    if (us === BLACK) this.full--;
    const moved = (fl & F_PROMO) ? piece(us, PAWN) : b[to];
    b[from] = moved; b[to] = 0;
    if (fl & F_EP) b[to + (us === WHITE ? -16 : 16)] = cap;
    else b[to] = cap;
    if (fl & F_CASTLE) {
      const rFrom = to > from ? to + 1 : to - 2, rTo = to > from ? to - 1 : to + 1;
      b[rFrom] = b[rTo]; b[rTo] = 0;
    }
  }

  // Pass the turn (used for "what does the opponent threaten?" analysis).
  makeNull() {
    this.stack.push(0, 0, this.castle, this.ep, this.half, this.hLo, this.hHi, this.king[0], this.king[1]);
    let lo = this.hLo, hi = this.hHi;
    if (this.ep >= 0) { lo ^= Z_EP_LO[this.ep & 7]; hi ^= Z_EP_HI[this.ep & 7]; }
    this.ep = -1;
    lo ^= Z_SIDE[this.turn] ^ Z_SIDE[this.turn ^ 1]; hi ^= Z_SIDE[this.turn ^ 1] ^ Z_SIDE[this.turn];
    this.turn ^= 1;
    this.hLo = lo >>> 0; this.hHi = hi >>> 0;
    this.hist.push(this.hLo);
  }

  unmakeNull() {
    const s = this.stack, n = s.length;
    this.castle = s[n - 7]; this.ep = s[n - 6]; this.half = s[n - 5]; this.hLo = s[n - 4]; this.hHi = s[n - 3];
    s.length = n - 9;
    this.hist.pop();
    this.turn ^= 1;
  }

  repetitions() {
    const h = this.hist, cur = this.hLo;
    let n = 0;
    for (let i = h.length - 1; i >= 0 && i >= h.length - 1 - this.half; i -= 2) if (h[i] === cur) n++;
    return n;
  }

  insufficientMaterial() {
    let minors = 0, bishopsColor = new Set();
    for (const sq of this.pieces()) {
      const t = typeOf(this.b[sq]);
      if (t === KING) continue;
      if (t === PAWN || t === ROOK || t === QUEEN) return false;
      minors++;
      if (t === BISHOP) bishopsColor.add(((sq >> 4) + (sq & 7)) & 1);
    }
    if (minors <= 1) return true;
    // Only bishops, all on the same colour.
    const all = this.pieces().filter(sq => typeOf(this.b[sq]) !== KING);
    return all.every(sq => typeOf(this.b[sq]) === BISHOP) && bishopsColor.size === 1;
  }

  // Did `color` reach its variant goal on the board as it stands?
  hasPromoted(color) {
    const rank = color === WHITE ? 112 : 0;
    for (let f = 0; f < 8; f++) { const p = this.b[rank + f]; if (p && colorOf(p) === color && typeOf(p) !== KING && this.rules.variant === 'pawn-wars') return true; }
    return false;
  }

  countPieces(color) { let n = 0; for (const sq of this.pieces(color)) if (typeOf(this.b[sq]) !== KING || this.rules.variant !== 'standard') n++; return n; }

  // Game status from the point of view of the board as it stands.
  // Returns null while the game goes on.
  status() {
    const v = this.rules.variant, us = this.turn, them = us ^ 1;
    if (v === 'free') return null;
    if (v === 'king-capture') {
      if (this.king[us] < 0) return { winner: them, reason: 'king-captured' };
    }
    if (v === 'capture-all') {
      if (this.pieces(us).length === 0) return { winner: them, reason: 'all-captured' };
    }
    if (v === 'pawn-wars') {
      if (this.hasPromoted(them)) return { winner: them, reason: 'promoted' };
      if (this.pieces(us).length === 0) return { winner: them, reason: 'all-captured' };
    }
    const moves = this.legalMoves();
    if (!moves.length) {
      if (v === 'standard') return this.inCheck(us) ? { winner: them, reason: 'checkmate' } : { winner: -1, reason: 'stalemate' };
      if (this.usesChecks() && this.inCheck(us)) return { winner: them, reason: 'checkmate' };
      return { winner: them, reason: 'no-moves' };
    }
    if (v === 'standard') {
      if (this.half >= 100) return { winner: -1, reason: 'fifty-moves' };
      if (this.repetitions() >= 3) return { winner: -1, reason: 'repetition' };
      if (this.insufficientMaterial()) return { winner: -1, reason: 'insufficient' };
    }
    return null;
  }

  // ---------------------------------------------------------------- notation

  san(m, legal) {
    const from = mFrom(m), to = mTo(m), fl = mFlags(m), p = this.b[from], t = typeOf(p);
    let s;
    if (fl & F_CASTLE) s = to > from ? 'O-O' : 'O-O-O';
    else {
      s = '';
      if (t === PAWN) {
        if (fl & F_CAPTURE) s += 'abcdefgh'[fileOf(from)] + 'x';
        s += sqName(to);
        if (fl & F_PROMO) s += '=' + LETTERS[mPromo(m)];
      } else {
        s += LETTERS[t];
        legal = legal || this.legalMoves();
        const rivals = legal.filter(o => o !== m && mTo(o) === to && this.b[mFrom(o)] === p);
        if (rivals.length) {
          const sameFile = rivals.some(o => fileOf(mFrom(o)) === fileOf(from));
          const sameRank = rivals.some(o => rankOf(mFrom(o)) === rankOf(from));
          if (!sameFile) s += 'abcdefgh'[fileOf(from)];
          else if (!sameRank) s += rankOf(from) + 1;
          else s += sqName(from);
        }
        if (fl & F_CAPTURE) s += 'x';
        s += sqName(to);
      }
    }
    this.make(m);
    if (this.rules.variant === 'standard' || this.usesChecks()) {
      if (this.inCheck()) s += this.legalMoves().length ? '+' : '#';
    }
    this.unmake();
    return s;
  }

  findMove(from, to, promo = QUEEN) {
    if (typeof from === 'string') from = sqParse(from);
    if (typeof to === 'string') to = sqParse(to);
    const cands = this.legalMoves().filter(m => mFrom(m) === from && mTo(m) === to);
    if (!cands.length) return 0;
    return cands.find(m => !(mFlags(m) & F_PROMO) || mPromo(m) === promo) || cands[0];
  }

  moveFromUci(u) {
    const promo = u.length > 4 ? LETTERS.indexOf(u[4].toUpperCase()) : QUEEN;
    return this.findMove(u.slice(0, 2), u.slice(2, 4), promo);
  }

  moveFromSan(san) {
    const clean = s => s.replace(/[+#!?]/g, '');
    const legal = this.legalMoves();
    return legal.find(m => clean(this.san(m, legal)) === clean(san)) || 0;
  }
}

export const uci = m => sqName(mFrom(m)) + sqName(mTo(m)) + ((mFlags(m) & F_PROMO) ? LETTERS[mPromo(m)].toLowerCase() : '');

export function perft(pos, depth) {
  if (depth === 0) return 1;
  const moves = pos.legalMoves();
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) { pos.make(m); n += perft(pos, depth - 1); pos.unmake(); }
  return n;
}

export const squareColor = sq => ((sq >> 4) + (sq & 7)) & 1 ? 'light' : 'dark';
