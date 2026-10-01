// Small deterministic helpers: seeded PRNG and shareable seed codes.

export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed) {
    this.next = mulberry32(seed);
  }
  range(a, b) {
    return a + (b - a) * this.next();
  }
  int(a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  chance(p) {
    return this.next() < p;
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// Crockford base32: no I, L, O, U so codes are easy to read out loud.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const SEED_ALPHABET = ALPHABET;
export const SEED_LENGTH = 6;

export function randomSeed() {
  let s;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    s = a[0];
  } else {
    s = Math.floor(Math.random() * 4294967296);
  }
  return s & 0x3fffffff;
}

export function seedToCode(seed) {
  let s = '';
  let v = seed & 0x3fffffff;
  for (let i = 0; i < SEED_LENGTH; i++) {
    s = ALPHABET[v & 31] + s;
    v >>>= 5;
  }
  return s;
}

export function normalizeCode(text) {
  return String(text)
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V');
}

export function codeToSeed(code) {
  const c = normalizeCode(code);
  if (c.length !== SEED_LENGTH) return null;
  let v = 0;
  for (let i = 0; i < c.length; i++) {
    const k = ALPHABET.indexOf(c[i]);
    if (k < 0) return null;
    v = (v << 5) | k;
  }
  return v & 0x3fffffff;
}

export function prettyCode(code) {
  return code.slice(0, 3) + '-' + code.slice(3);
}
