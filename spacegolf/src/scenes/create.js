import { COL, ICON, hex, withAlpha } from '../ui.js';
import { header, drawThumb } from './common.js';
import { GameScene } from './game.js';
import { EditorScene } from './editor.js';
import { decodeLevel, encodeLevel, cloneLevel, playable } from '../level.js';

function playCustom(app, entry, fromList = true) {
  const level = cloneLevel(entry.level);
  level.name = entry.name || level.name;
  const cfg = {
    level,
    kind: 'custom',
    title: level.name,
    subtitle: 'Custom level',
    paletteSalt: 3,
    onWin: (res) => ({ extra: res.strokes <= (level.par ?? 3) ? 'Par or better!' : '' }),
    onExit: () => app.go(new CreateScene(app)),
  };
  app.go(new GameScene(app, cfg));
}

// level shared through a link: save a copy into My Levels and play it
export async function playSharedLevel(app, encoded) {
  const level = await decodeLevel(encoded);
  if (!level) {
    app.ui.toast('That shared level could not be read');
    return;
  }
  const list = app.store.data.custom;
  const name = level.name || 'Shared level';
  let entry = list.find((e) => e.name === name && JSON.stringify(e.level.bodies) === JSON.stringify(level.bodies));
  if (!entry) {
    entry = { id: 'c' + Date.now().toString(36), name, level, verified: false, updated: Date.now() };
    list.unshift(entry);
    app.store.save();
  }
  history.replaceState(null, '', location.pathname);
  playCustom(app, entry);
}

export class CreateScene {
  constructor(app) {
    this.app = app;
    this.page = 0;
    this.confirmDelete = null;
  }

  frame(dt) {
    const app = this.app;
    const ui = app.ui;
    const u = ui.u;
    const store = app.store;
    app.backdrop(5, 0.42, true);
    if (header(app, 'Create', 'Build your own holes and share them')) app.openTitle();
    for (const k of ui.keys) if (k.key === 'Escape') app.openTitle();

    const colW = Math.min(ui.w - 32 * u, 780 * u);
    const x0 = (ui.w - colW) / 2;
    let y = 90 * u;
    const bw = (colW - 12 * u) / 2;
    if (ui.button('c-new', x0, y, bw, 56 * u, { label: 'New level', icon: ICON.plus, size: 18, kind: 'primary' })) app.go(new EditorScene(app));
    if (ui.button('c-paste', x0 + bw + 12 * u, y, bw, 56 * u, { label: 'Paste shared link', icon: ICON.copy, size: 16 })) this.paste();
    y += 76 * u;

    const list = store.data.custom;
    if (!list.length) {
      ui.text('No levels yet.', ui.w / 2, y + 60 * u, 20 * u, COL.dim, { align: 'center' });
      ui.text('Make one, test it, and send the link to a friend.', ui.w / 2, y + 92 * u, 14 * u, COL.faint, { align: 'center' });
      return;
    }
    const rowH = 84 * u;
    const perPage = Math.max(1, Math.floor((ui.h - y - 70 * u) / rowH));
    const pages = Math.max(1, Math.ceil(list.length / perPage));
    this.page = Math.min(this.page, pages - 1);
    const slice = list.slice(this.page * perPage, this.page * perPage + perPage);
    slice.forEach((e, i) => {
      const yy = y + i * rowH;
      ui.rect(x0, yy, colW, rowH - 10 * u, { fill: hex('#0b1230', 0.7), border: 1.2, borderColor: COL.panelEdge, radius: 16 * u });
      const th = rowH - 26 * u;
      drawThumb(ui, e.level, x0 + 12 * u, yy + 8 * u, th * 1.78, th);
      const tx = x0 + 12 * u + th * 1.78 + 16 * u;
      ui.text(e.name, tx, yy + 24 * u, 18 * u, COL.text);
      const ok = playable(e.level);
      ui.text(ok ? `${e.level.bodies.length} bodies  ·  par ${e.level.par ?? 3}${e.verified ? '  ·  tested' : ''}` : 'Unfinished', tx, yy + 48 * u, 13 * u, ok ? (e.verified ? COL.good : COL.dim) : COL.bad);
      // actions
      const bs = 44 * u;
      let bx = x0 + colW - 12 * u - bs;
      const by = yy + (rowH - 10 * u - bs) / 2;
      if (this.confirmDelete === e.id) {
        if (ui.button('c-del-y' + e.id, bx - 60 * u, by, bs + 60 * u, bs, { label: 'Delete?', kind: 'danger', size: 14 })) {
          store.data.custom = list.filter((q) => q.id !== e.id);
          store.save();
          this.confirmDelete = null;
        }
        if (ui.button('c-del-n' + e.id, bx - 60 * u - bs - 6 * u, by, bs, bs, { icon: ICON.cross, iconScale: 0.45 })) this.confirmDelete = null;
        return;
      }
      if (ui.button('c-del' + e.id, bx, by, bs, bs, { icon: ICON.trash, iconScale: 0.5 })) this.confirmDelete = e.id;
      bx -= bs + 6 * u;
      if (ui.button('c-share' + e.id, bx, by, bs, bs, { icon: ICON.copy, iconScale: 0.5, disabled: !ok })) this.share(e);
      bx -= bs + 6 * u;
      if (ui.button('c-edit' + e.id, bx, by, bs, bs, { icon: ICON.pencil, iconScale: 0.5 })) app.go(new EditorScene(app, e));
      bx -= bs + 6 * u;
      if (ui.button('c-play' + e.id, bx, by, bs, bs, { icon: ICON.play, iconScale: 0.5, kind: 'primary', disabled: !ok })) playCustom(app, e);
    });
    if (pages > 1) {
      const py = ui.h - 52 * u;
      if (ui.button('c-prev', ui.w / 2 - 110 * u, py, 44 * u, 40 * u, { icon: ICON.left, iconScale: 0.5, disabled: this.page === 0 })) this.page--;
      ui.text(`${this.page + 1} / ${pages}`, ui.w / 2, py + 20 * u, 15 * u, COL.dim, { align: 'center' });
      if (ui.button('c-next', ui.w / 2 + 66 * u, py, 44 * u, 40 * u, { icon: ICON.right, iconScale: 0.5, disabled: this.page >= pages - 1 })) this.page++;
    }
  }

  async share(entry) {
    try {
      const code = await encodeLevel(entry.level);
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}#level=${code}`);
      this.app.ui.toast('Share link copied to clipboard');
    } catch (e) {
      this.app.ui.toast('Could not copy the link');
    }
  }

  async paste() {
    const app = this.app;
    try {
      const text = (await navigator.clipboard.readText()).trim();
      const m = text.match(/level=([^&\s]+)/);
      const code = m ? m[1] : text;
      await playSharedLevel(app, code);
    } catch (e) {
      app.ui.toast('Clipboard unavailable: open the shared link instead');
    }
  }
}
