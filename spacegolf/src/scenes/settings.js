import { COL, ICON, hex, withAlpha } from '../ui.js';
import { header } from './common.js';

const ASSIST = [['Short', 0.6], ['Normal', 1], ['Long', 1.8]];
const FIELD = ['Off', 'Contours', 'Grid'];

export class SettingsScene {
  constructor(app) {
    this.app = app;
    this.confirmReset = false;
  }

  frame(dt) {
    const app = this.app;
    const ui = app.ui;
    const u = ui.u;
    const st = app.store;
    const s = st.settings;
    app.backdrop(4, 0.45, true);
    if (header(app, 'Settings', null)) app.openTitle();
    for (const k of ui.keys) if (k.key === 'Escape') app.openTitle();

    const colW = Math.min(ui.w - 32 * u, 640 * u);
    const x0 = (ui.w - colW) / 2;
    let y = 110 * u;
    const rowH = 64 * u;

    const row = (label, hint, draw) => {
      ui.rect(x0, y, colW, rowH - 8 * u, { fill: hex('#0b1230', 0.62), border: 1, borderColor: hex('#7ea4ff', 0.2), radius: 14 * u });
      ui.text(label, x0 + 18 * u, y + (hint ? 22 : 28) * u, 17 * u, COL.text);
      if (hint) ui.text(hint, x0 + 18 * u, y + 43 * u, 12 * u, COL.dim);
      draw(x0 + colW - 14 * u, y + 6 * u, rowH - 20 * u);
      y += rowH;
    };
    const segmented = (id, rx, ry, h, options, current, onPick) => {
      let x = rx;
      for (let i = options.length - 1; i >= 0; i--) {
        const w = Math.max(64 * u, ui.measure(options[i], 14 * u) + 28 * u);
        x -= w;
        if (ui.button(id + i, x, ry, w, h, { label: options[i], size: 14, selected: current === i })) onPick(i);
        x -= 6 * u;
      }
    };

    row('Sound', 'Effects and ambient music', (rx, ry, h) => {
      segmented('snd', rx, ry, h, ['Off', 'On'], s.sound ? 1 : 0, (i) => {
        s.sound = i === 1;
        app.sound.setEnabled(s.sound);
        st.save();
      });
    });
    row('Aim preview', 'How far the dotted trajectory reaches', (rx, ry, h) => {
      const cur = ASSIST.findIndex((a) => a[1] === s.assist);
      segmented('as', rx, ry, h, ASSIST.map((a) => a[0]), cur, (i) => {
        s.assist = ASSIST[i][1];
        st.save();
      });
    });
    row('Gravity view', 'Default overlay while playing (press G)', (rx, ry, h) => {
      segmented('fl', rx, ry, h, FIELD, s.field | 0, (i) => {
        s.field = i;
        st.save();
      });
    });
    row('Glow effects', 'Bloom and lens flares (turn off on slow devices)', (rx, ry, h) => {
      segmented('bl', rx, ry, h, ['Off', 'On'], s.bloom ? 1 : 0, (i) => {
        s.bloom = i === 1;
        st.save();
      });
    });
    if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
      row('Fullscreen', 'Best on tablets and phones', (rx, ry, h) => {
        const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
        segmented('fs', rx, ry, h, ['Off', 'On'], on ? 1 : 0, (i) => {
          try {
            const el = document.documentElement;
            if (i === 1) (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
            else (document.exitFullscreen || document.webkitExitFullscreen).call(document);
          } catch (e) { /* not allowed here */ }
        });
      });
    }
    y += 6 * u;
    if (ui.button('reset', x0, y, colW, 50 * u, { label: 'Reset all progress', icon: ICON.trash, kind: 'danger', size: 16 })) this.confirmReset = true;
    y += 66 * u;

    ui.text('HOW TO PLAY', x0, y, 12 * u, COL.dim, { spacing: 0.25 });
    y += 26 * u;
    const lines = [
      'Drag anywhere to pull back, release to shoot (right-click cancels).',
      'Arrow keys aim, Space fires.   R retry   U undo   G gravity view   F fast-forward',
      'Hold a finger or the mouse button during flight to fast-forward.',
    ];
    for (const l of lines) {
      ui.text(l, x0, y, Math.min(14 * u, (colW / (l.length * 0.52))), COL.dim);
      y += 22 * u;
    }

    if (this.confirmReset) {
      ui.rect(0, 0, ui.w, ui.h, { fill: [0.01, 0.02, 0.06, 0.7], radius: 0 });
      const pw = Math.min(400 * u, ui.w - 32);
      const ph = 190 * u;
      const px = (ui.w - pw) / 2;
      const py = (ui.h - ph) / 2;
      ui.panel(px, py, pw, ph);
      ui.text('Reset all progress?', px + pw / 2, py + 44 * u, 22 * u, COL.text, { align: 'center' });
      ui.text('Campaign stars and records will be erased.', px + pw / 2, py + 76 * u, 13 * u, COL.dim, { align: 'center' });
      const bw = (pw - 56 * u) / 2;
      if (ui.button('rs-no', px + 20 * u, py + ph - 70 * u, bw, 48 * u, { label: 'Cancel', size: 16 })) this.confirmReset = false;
      if (ui.button('rs-yes', px + 36 * u + bw, py + ph - 70 * u, bw, 48 * u, { label: 'Reset', size: 16, kind: 'danger' })) {
        st.reset();
        app.sound.setEnabled(st.settings.sound);
        this.confirmReset = false;
        ui.toast('Progress reset');
      }
    }
  }
}
