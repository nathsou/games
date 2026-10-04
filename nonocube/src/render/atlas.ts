import { CIRCLE, clueCount, clueKind, MAX_COUNT, SQUARE } from '../core/clues.ts';

/**
 * Glyph atlas: 8×8 cells of 128px. Slot = clue code (count*3 + kind) for counts 0..20,
 * slot 63 is the "hidden clue" marker used by the editor. Glyphs are drawn with the system
 * rounded font, then converted to a signed distance field so they stay sharp at any zoom.
 */
export const ATLAS_COLS = 8;
export const ATLAS_CELL = 128;
export const GLYPH_NONE = 127;
export const GLYPH_HIDDEN = 63;

export const FONT_STACK = 'Manrope, system-ui, sans-serif';

function drawGlyphs(): HTMLCanvasElement {
  const size = ATLAS_COLS * ATLAS_CELL;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const S = ATLAS_CELL;

  for (let code = 0; code <= MAX_COUNT * 3 + 2; code++) {
    const n = clueCount(code);
    const kind = clueKind(code);
    if (n < 2 && kind !== 0) continue; // impossible clues
    if (code >= GLYPH_HIDDEN) break;
    const cx = (code % ATLAS_COLS) * S + S / 2;
    const cy = Math.floor(code / ATLAS_COLS) * S + S / 2;
    const text = String(n);
    const two = text.length > 1;
    const fontPx = kind === 0 ? (two ? 64 : 76) : two ? 50 : 58;
    g.font = `800 ${fontPx}px ${FONT_STACK}`;
    g.fillText(text, cx, cy + fontPx * 0.04);
    g.lineWidth = 8;
    if (kind === CIRCLE) {
      g.beginPath();
      g.arc(cx, cy, S * 0.35, 0, Math.PI * 2);
      g.stroke();
    } else if (kind === SQUARE) {
      const r = S * 0.33;
      roundRect(g, cx - r, cy - r, r * 2, r * 2, 12);
      g.stroke();
    }
  }
  // hidden marker: small dot
  {
    const cx = (GLYPH_HIDDEN % ATLAS_COLS) * S + S / 2;
    const cy = Math.floor(GLYPH_HIDDEN / ATLAS_COLS) * S + S / 2;
    g.globalAlpha = 0.5;
    g.lineWidth = 6;
    g.setLineDash([10, 10]);
    g.beginPath();
    g.arc(cx, cy, S * 0.3, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;
  }
  return cv;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Distance (in px) covered by the field on each side of a glyph edge. */
const SDF_RADIUS = 10;

/** Build the atlas as a single-channel SDF: 0.5 on the edge, > 0.5 inside. */
export function buildAtlas(): { size: number; data: Uint8Array } {
  const cv = drawGlyphs();
  const size = cv.width;
  const px = cv.getContext('2d')!.getImageData(0, 0, size, size).data;
  const n = size * size;
  const INF = 1e20;
  const outer = new Float64Array(n);
  const inner = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = px[i * 4 + 3] / 255;
    if (a >= 1) {
      outer[i] = 0;
      inner[i] = INF;
    } else if (a <= 0) {
      outer[i] = INF;
      inner[i] = 0;
    } else {
      // anti-aliased edge pixel: sub-pixel offset of the contour
      outer[i] = Math.max(0, 0.5 - a) ** 2;
      inner[i] = Math.max(0, a - 0.5) ** 2;
    }
  }
  const f = new Float64Array(size);
  const v = new Uint16Array(size);
  const z = new Float64Array(size + 1);
  edt(outer, size, f, v, z);
  edt(inner, size, f, v, z);
  const data = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const d = Math.sqrt(outer[i]) - Math.sqrt(inner[i]);
    data[i] = Math.max(0, Math.min(255, Math.round(255 * (0.5 - d / (2 * SDF_RADIUS)))));
  }
  return { size, data };
}

/** 2D squared Euclidean distance transform (Felzenszwalb & Huttenlocher), in place. */
function edt(grid: Float64Array, size: number, f: Float64Array, v: Uint16Array, z: Float64Array): void {
  for (let x = 0; x < size; x++) edt1d(grid, x, size, size, f, v, z);
  for (let y = 0; y < size; y++) edt1d(grid, y * size, 1, size, f, v, z);
}

function edt1d(grid: Float64Array, offset: number, stride: number, length: number, f: Float64Array, v: Uint16Array, z: Float64Array): void {
  v[0] = 0;
  z[0] = -1e20;
  z[1] = 1e20;
  f[0] = grid[offset];
  for (let q = 1, k = 0, s = 0; q < length; q++) {
    f[q] = grid[offset + q * stride];
    const q2 = q * q;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = 1e20;
  }
  for (let q = 0, k = 0; q < length; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    const qr = q - r;
    grid[offset + q * stride] = f[r] + qr * qr;
  }
}
