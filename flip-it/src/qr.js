// Purpose-built QR Model 2 byte encoder: seven size profiles, level L.
// No imports, network services or QR package. Four-module quiet zone is added
// by drawQR. Independently decoded profile fixtures live in tests/qr.test.mjs.
const PROFILES = [[1, 7, 1], [10, 18, 4], [15, 22, 6], [20, 28, 8], [25, 26, 12], [30, 30, 15], [40, 30, 25]];
function rawWords(v) {
  let bits = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const n = Math.floor(v / 7) + 2;
    bits -= (25 * n - 10) * n - 55;
    if (v >= 7) bits -= 36;
  }
  return Math.floor(bits / 8);
}
function multiply(a, b) {
  let out = 0;
  while (b) {
    if (b & 1) out ^= a;
    a <<= 1;
    if (a & 256) a ^= 0x11d;
    b >>= 1;
  }
  return out;
}
function parity(data, degree) {
  let generator = [1], root = 1;
  for (let i = 0; i < degree; i++) {
    const next = Array(generator.length + 1).fill(0);
    for (let j = 0; j < generator.length; j++) {
      next[j] ^= generator[j];
      next[j + 1] ^= multiply(generator[j], root);
    }
    generator = next; root = multiply(root, 2);
  }
  const work = [...data, ...Array(degree).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const factor = work[i];
    for (let j = 1; j <= degree; j++) work[i + j] ^= multiply(generator[j], factor);
  }
  return work.slice(data.length);
}
const MASKS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
  (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
  (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0
];
export function qrMatrix(text) {
  const bytes = new TextEncoder().encode(text);
  const profile = PROFILES.find(([v, ecc, count]) => 4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= (rawWords(v) - ecc * count) * 8);
  if (!profile) throw new Error('This link is too long for one QR code. Use Copy link instead.');
  const [version, ecc, count] = profile;
  const total = rawWords(version), capacity = total - ecc * count;
  const bits = [];
  const append = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push(value >>> i & 1); };
  append(4, 4); append(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) append(b, 8);
  append(0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((n, b) => n * 2 + b, 0));
  for (let i = 0; data.length < capacity; i++) data.push(i % 2 ? 0x11 : 0xec);
  const short = Math.floor(total / count) - ecc, longCount = total % count;
  const blocks = [], checks = [];
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const length = short + Number(i >= count - longCount);
    const block = data.slice(offset, offset + length); offset += length;
    blocks.push(block); checks.push(parity(block, ecc));
  }
  const words = [];
  for (let i = 0; i <= short; i++) for (const block of blocks) if (i < block.length) words.push(block[i]);
  for (let i = 0; i < ecc; i++) for (const check of checks) words.push(check[i]);

  const size = version * 4 + 17;
  const base = Array.from({length: size}, () => Array(size).fill(false));
  const fixed = Array.from({length: size}, () => Array(size).fill(false));
  function mark(x, y, dark) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    base[y][x] = Boolean(dark); fixed[y][x] = true;
  }
  for (let i = 0; i < size; i++) { mark(6, i, i % 2 === 0); mark(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      const d = Math.max(Math.abs(x), Math.abs(y));
      mark(cx + x, cy + y, d !== 2 && d !== 4);
    }
  }
  if (version > 1) {
    const n = Math.floor(version / 7) + 2;
    const step = version === 32 ? 26 : Math.floor((version * 4 + n * 2 + 1) / (n * 2 - 2)) * 2;
    const positions = [6];
    for (let p = size - 7; positions.length < n; p -= step) positions.splice(1, 0, p);
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      if (ix === 0 && iy === 0 || ix === 0 && iy === n - 1 || ix === n - 1 && iy === 0) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(positions[ix] + dx, positions[iy] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  function format(mask, set) {
    const value = 8 | mask;
    let remainder = value << 10;
    for (let i = 14; i >= 10; i--) if (remainder >>> i & 1) remainder ^= 0x537 << (i - 10);
    const code = (value << 10 | remainder) ^ 0x5412;
    const bit = i => Boolean(code >>> i & 1);
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  }
  format(0, mark);
  if (version >= 7) {
    let remainder = version << 12;
    for (let i = 17; i >= 12; i--) if (remainder >>> i & 1) remainder ^= 0x1f25 << (i - 12);
    const code = version << 12 | remainder;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + i % 3, b = Math.floor(i / 3), dark = code >>> i & 1;
      mark(a, b, dark); mark(b, a, dark);
    }
  }
  let index = 0, up = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let i = 0; i < size; i++) {
      const y = up ? size - 1 - i : i;
      for (let x = right; x >= right - 1; x--) if (!fixed[y][x]) {
        base[y][x] = index < words.length * 8 ? Boolean(words[index >>> 3] >>> (7 - index % 8) & 1) : false;
        index++;
      }
    }
    up = !up;
  }
  let best, bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const grid = base.map((row, y) => row.map((b, x) => fixed[y][x] ? b : Boolean(b !== MASKS[mask](x, y))));
    format(mask, (x, y, b) => { grid[y][x] = b; });
    let penalty = 0, dark = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      dark += Number(grid[y][x]);
      if (x && y && grid[y][x] === grid[y - 1][x] && grid[y][x] === grid[y][x - 1] && grid[y][x] === grid[y - 1][x - 1]) penalty += 3;
    }
    for (let axis = 0; axis < 2; axis++) for (let i = 0; i < size; i++) {
      let line = '', run = 0, last;
      for (let j = 0; j < size; j++) {
        const value = axis ? grid[j][i] : grid[i][j];
        line += value ? '1' : '0';
        run = last === value ? run + 1 : 1; last = value;
        if (run === 5) penalty += 3; else if (run > 5) penalty++;
      }
      for (let j = 0; j <= size - 11; j++) if (['10111010000', '00001011101'].includes(line.slice(j, j + 11))) penalty += 40;
    }
    penalty += Math.floor(Math.abs(dark / (size * size) * 100 - 50) / 5) * 10;
    if (penalty < bestPenalty) { best = grid; bestPenalty = penalty; }
  }
  return best;
}
export function drawQR(canvas, text) {
  const matrix = qrMatrix(text), scale = 4, size = matrix.length;
  canvas.width = canvas.height = (size + 8) * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#101818';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (matrix[y][x]) ctx.fillRect((x + 4) * scale, (y + 4) * scale, scale, scale);
}
