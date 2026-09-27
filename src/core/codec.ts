import type { Dims } from './grid.ts';
import type { Difficulty, PuzzleDef } from './types.ts';

/**
 * Compact binary share code (base64url):
 *   [version][W][H][D][difficulty][paletteLen] [rgb × paletteLen]
 *   [nameLen][name utf-8] [cells, 4 bits each] [hasMask][mask bits]
 */
const VERSION = 1;
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

function toB64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(code: string): Uint8Array {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const s = atob(b64 + '==='.slice((b64.length + 3) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function encodePuzzle(p: PuzzleDef): string {
  const [W, H, D] = p.dims;
  const size = W * H * D;
  const name = new TextEncoder().encode(p.name.slice(0, 60));
  const out: number[] = [VERSION, W, H, D, Math.max(0, DIFFS.indexOf(p.difficulty)), p.palette.length];
  for (const c of p.palette) out.push(...hexToRgb(c));
  out.push(name.length, ...name);
  for (let i = 0; i < size; i += 2) out.push((p.cells[i] & 15) | ((i + 1 < size ? p.cells[i + 1] & 15 : 0) << 4));
  if (p.mask) {
    out.push(1);
    for (let i = 0; i < p.mask.length; i += 8) {
      let b = 0;
      for (let k = 0; k < 8 && i + k < p.mask.length; k++) if (p.mask[i + k]) b |= 1 << k;
      out.push(b);
    }
  } else out.push(0);
  return toB64url(Uint8Array.from(out));
}

export function decodePuzzle(code: string, id = 'shared'): PuzzleDef {
  const b = fromB64url(code.trim());
  let o = 0;
  const next = () => {
    if (o >= b.length) throw new Error('Truncated puzzle code');
    return b[o++];
  };
  if (next() !== VERSION) throw new Error('Unsupported puzzle code version');
  const dims: Dims = [next(), next(), next()];
  if (dims.some((d) => d < 1 || d > 20)) throw new Error('Invalid puzzle size');
  const difficulty = DIFFS[next()] ?? 'medium';
  const palLen = next();
  if (palLen > 15) throw new Error('Invalid palette');
  const palette: string[] = [];
  for (let i = 0; i < palLen; i++) palette.push(rgbToHex(next(), next(), next()));
  const nameLen = next();
  const name = new TextDecoder().decode(b.slice(o, o + nameLen));
  o += nameLen;
  const size = dims[0] * dims[1] * dims[2];
  const cells = new Uint8Array(size);
  for (let i = 0; i < size; i += 2) {
    const v = next();
    cells[i] = v & 15;
    if (i + 1 < size) cells[i + 1] = v >> 4;
  }
  for (let i = 0; i < size; i++) if (cells[i] > palLen) throw new Error('Invalid cell color');
  let mask: Uint8Array | undefined;
  if (next() === 1) {
    const lines = dims[1] * dims[2] + dims[0] * dims[2] + dims[0] * dims[1];
    mask = new Uint8Array(lines);
    for (let i = 0; i < lines; i += 8) {
      const v = next();
      for (let k = 0; k < 8 && i + k < lines; k++) mask[i + k] = (v >> k) & 1;
    }
  }
  return { id, name, dims, cells, palette, difficulty, mask };
}
