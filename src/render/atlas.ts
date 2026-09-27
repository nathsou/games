import { CIRCLE, clueCount, clueKind, MAX_COUNT, SQUARE } from '../core/clues.ts';

/**
 * Glyph atlas: 8×8 cells of 128px. Slot = clue code (count*3 + kind) for counts 0..20,
 * slot 63 is the "hidden clue" marker used by the editor. Glyphs are white on transparent
 * (the shader tints them); drawn with the system rounded font.
 */
export const ATLAS_COLS = 8;
export const ATLAS_CELL = 128;
export const GLYPH_NONE = 127;
export const GLYPH_HIDDEN = 63;

export const FONT_STACK = 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function buildAtlas(): HTMLCanvasElement {
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
