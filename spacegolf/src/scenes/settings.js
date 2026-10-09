import { COL, ICON } from '../ui.js';
import { header } from './common.js';

const ASSIST = [['Off', 0], ['Short', 0.5], ['Normal', 1], ['Long', 2]];
const FIELD = ['Off', 'Contours', 'Grid'];

export class SettingsScene {
  constructor(app) {
    this.app = app;
    this.confirmReset = false;
    this.tab = 'game';
  }

  frame(dt) {
    const app = this.app;
    const ui = app.ui;
    const u = Math.min(ui.u, ui.h / 690);
    const st = app.store;
    const s = st.settings;
    app.backdrop(4, 0.45, true);
    if (header(app, 'Settings', null)) app.openTitle();
    for (const k of ui.keys) if (k.key === 'Escape') app.openTitle();

    const colW = Math.min(ui.w - 32 * u, 640 * u);
    const x0 = (ui.w - colW) / 2;
    const tabW = (colW - 8 * u) / 2;
    if (ui.button('tab-game', x0, 78 * u, tabW, 38 * u, { label: 'Gameplay', selected: this.tab === 'game' })) this.tab = 'game';
    if (ui.button('tab-graphics', x0 + tabW + 8 * u, 78 * u, tabW, 38 * u, { label: 'Graphics', selected: this.tab === 'graphics' })) this.tab = 'graphics';
    let y = 130 * u;
    const rowH = 96 * u;

    const row = (label, hint, draw) => {
      ui.glass(x0, y, colW, rowH - 8 * u, { radius: 18 * u, shadowAlpha: 0.22, shadowBlur: 10 * u, shadowOffset: 4 * u });
      ui.text(label, x0 + 20 * u, y + 20 * u, Math.max(13, 16 * u), COL.text, { weight: 'heavy' });
      if (hint) ui.text(hint, x0 + 20 * u, y + 38 * u, Math.max(10, 11 * u), COL.dim, { weight: 'light' });
      draw(x0 + colW - 12 * u, y + 48 * u, 32 * u);
      y += rowH;
    };
    const segmented = (id, rx, ry, h, options, current, onPick) => {
      let x = rx;
      for (let i = options.length - 1; i >= 0; i--) {
        const size = Math.max(12, 14 * u);
        const w = Math.max(64 * u, ui.measure(options[i], size) + 28 * u);
        x -= w;
        if (ui.button(id + i, x, ry, w, h, { label: options[i], size: size / ui.u, selected: current === i })) onPick(i);
        x -= 6 * u;
      }
    };

    if (this.tab === 'game') {
      row('Sound', 'Effects and ambient music', (rx, ry, h) => {
        segmented('snd', rx, ry, h, ['Off', 'On'], s.sound ? 1 : 0, (i) => {
          s.sound = i === 1;
          app.sound.setEnabled(s.sound);
          st.save();
        });
      });
      row('Aim hint', 'How much of the shot\'s start is shown as dots', (rx, ry, h) => {
        let cur = 0;
        ASSIST.forEach((a, i) => { if (Math.abs(a[1] - s.assist) < Math.abs(ASSIST[cur][1] - s.assist)) cur = i; });
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

    } else {
      const update = () => { st.save(); app.applyQuality(); };
      row('Quality preset', 'Auto adapts; Low disables glow and blur', (rx, ry, h) => {
        const opts = ['auto', 'high', 'medium', 'low'];
        segmented('gq', rx, ry, h, ['Auto', 'High', 'Medium', 'Low'], Math.max(0, opts.indexOf(s.quality)), i => { s.quality = opts[i]; update(); });
      });
      row('Frame limit', '30 FPS uses less power; 60 FPS feels smoother', (rx, ry, h) => {
        segmented('fps', rx, ry, h, ['30 FPS', '60 FPS'], s.fps === 30 ? 0 : 1, i => { s.fps = i ? 60 : 30; update(); });
      });
      row('Background', 'Stars cost less; Low always uses stars', (rx, ry, h) => {
        segmented('bg', rx, ry, h, ['Stars', 'Nebula'], s.background === 'stars' ? 0 : 1, i => { s.background = i ? 'nebula' : 'stars'; update(); });
      });
      row('Glow effects', 'Bloom around bright objects; disabled on Low', (rx, ry, h) => {
        segmented('bl', rx, ry, h, ['Off', 'On'], s.bloom ? 1 : 0, i => { s.bloom = !!i; update(); });
      });
      row('Frosted glass', 'Off uses solid panels; disabled on Low', (rx, ry, h) => {
        segmented('glass', rx, ry, h, ['Off', 'On'], s.glass ? 1 : 0, i => { s.glass = !!i; update(); });
      });
      const g = app.r.graphics;
      ui.text(`Rendering: ${Math.round(app.r.dpr * 100)}% pixel density · ${g.bloomLevels ? 'glow' : 'no glow'} · ${g.glass ? 'glass' : 'solid panels'}`, x0, y + 10 * u, 11 * u, COL.dim);
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
        app.applyQuality();
        app.sound.setEnabled(st.settings.sound);
        this.confirmReset = false;
        ui.toast('Progress reset');
      }
    }
  }
}
