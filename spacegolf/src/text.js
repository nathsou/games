// Text without HTML: glyphs are rasterised once into a 2D canvas, uploaded as a
// texture, and drawn as instanced quads by the UI pass.

const FONT_SIZE = 80;
const FAMILY = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, "Noto Sans", Arial, sans-serif';
const CHARS = (() => {
  let s = '';
  for (let c = 32; c < 127; c++) s += String.fromCharCode(c);
  return s + '·×−–—…’°';
})();

export class TextAtlas {
  constructor() {
    const cols = 16;
    const rows = Math.ceil(CHARS.length / cols);
    this.cellW = Math.round(FONT_SIZE * 1.1);
    this.cellH = Math.round(FONT_SIZE * 1.4);
    this.baseline = Math.round(FONT_SIZE * 1.0);
    const canvas = document.createElement('canvas');
    canvas.width = cols * this.cellW;
    canvas.height = rows * this.cellH;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `700 ${FONT_SIZE}px ${FAMILY}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    this.glyphs = new Map();
    for (let i = 0; i < CHARS.length; i++) {
      const ch = CHARS[i];
      const cx = (i % cols) * this.cellW;
      const cy = Math.floor(i / cols) * this.cellH;
      const adv = ctx.measureText(ch).width;
      ctx.fillText(ch, cx + (this.cellW - adv) / 2, cy + this.baseline);
      this.glyphs.set(ch, {
        adv: adv / FONT_SIZE,
        u0: cx / canvas.width,
        v0: cy / canvas.height,
        u1: (cx + this.cellW) / canvas.width,
        v1: (cy + this.cellH) / canvas.height,
      });
    }
    this.canvas = canvas;
    this.fallback = this.glyphs.get('?');
  }

  glyph(ch) {
    return this.glyphs.get(ch) || this.fallback;
  }

  // text width in px at a given font size
  measure(str, size, spacing = 0) {
    let w = 0;
    for (let i = 0; i < str.length; i++) w += this.glyph(str[i]).adv * size + spacing * size;
    return w - (str.length ? spacing * size : 0);
  }
}

export { FONT_SIZE };
