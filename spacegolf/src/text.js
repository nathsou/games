// Text without HTML: glyphs are rasterised once into a 2D canvas (three weights),
// uploaded as a texture, and drawn as instanced quads by the UI pass.

const FONT_SIZE = 80;
const FAMILY = '"SF Pro Display", "Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, "Noto Sans", Arial, sans-serif';
const CHARS = (() => {
  let s = '';
  for (let c = 32; c < 127; c++) s += String.fromCharCode(c);
  return s + '·×−–—…’°';
})();

export const WEIGHTS = { light: 0, medium: 1, heavy: 2 };
const CSS_WEIGHTS = [400, 600, 800];

export class TextAtlas {
  constructor() {
    const cols = 16;
    const rows = Math.ceil(CHARS.length / cols);
    this.cellW = Math.round(FONT_SIZE * 1.1);
    this.cellH = Math.round(FONT_SIZE * 1.4);
    this.baseline = Math.round(FONT_SIZE * 1.0);
    const canvas = document.createElement('canvas');
    canvas.width = cols * this.cellW;
    canvas.height = rows * this.cellH * CSS_WEIGHTS.length;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    this.glyphs = CSS_WEIGHTS.map(() => new Map());
    CSS_WEIGHTS.forEach((weight, wi) => {
      ctx.font = `${weight} ${FONT_SIZE}px ${FAMILY}`;
      for (let i = 0; i < CHARS.length; i++) {
        const ch = CHARS[i];
        const cx = (i % cols) * this.cellW;
        const cy = (wi * rows + Math.floor(i / cols)) * this.cellH;
        const adv = ctx.measureText(ch).width;
        ctx.fillText(ch, cx + (this.cellW - adv) / 2, cy + this.baseline);
        this.glyphs[wi].set(ch, {
          adv: adv / FONT_SIZE,
          u0: cx / canvas.width,
          v0: cy / canvas.height,
          u1: (cx + this.cellW) / canvas.width,
          v1: (cy + this.cellH) / canvas.height,
        });
      }
      // the star is drawn as an icon by the UI (fonts differ in whether they have it)
      this.glyphs[wi].set('★', { adv: 0.95, icon: 13, u0: 0, v0: 0, u1: 0, v1: 0 });
    });
    this.canvas = canvas;
  }

  glyph(ch, weight = 1) {
    const m = this.glyphs[weight];
    return m.get(ch) || m.get('?');
  }

  // text width in px at a given font size
  measure(str, size, spacing = 0, weight = 1) {
    let w = 0;
    for (let i = 0; i < str.length; i++) w += this.glyph(str[i], weight).adv * size + spacing * size;
    return w - (str.length ? spacing * size : 0);
  }
}

export { FONT_SIZE };
