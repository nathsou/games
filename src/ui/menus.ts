import { modelScene, type App, type Screen } from '../app.ts';
import { sfx, unlockAudio } from '../audio/sfx.ts';
import { decodePuzzle, encodePuzzle } from '../core/codec.ts';
import type { Collection, ModelDef, PuzzleDef } from '../core/types.ts';
import { allCollections } from '../data/collections.ts';
import { save, store } from '../game/storage.ts';
import { BlockScene } from '../render/scene.ts';
import type { DrawList } from '../render/renderer.ts';
import { button, h, icon, iconButton, modal, toast } from './dom.ts';
import { COLLECTION_ICONS, I } from './icons.ts';
import { openSettings } from './settings.ts';

export interface Nav {
  home(): void;
  collections(): void;
  collection(c: Collection): void;
  play(c: Collection, index: number): void;
  playCustom(p: PuzzleDef, back: () => void, saveKey?: string | null): void;
  daily(): void;
  tutorial(): void;
  editor(p?: PuzzleDef, userId?: string): void;
  myPuzzles(): void;
}

const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

function collectionStats(c: Collection): { solved: number; stars: number; total: number } {
  let solved = 0;
  let stars = 0;
  for (const p of c.puzzles) {
    const r = store.records[p.id];
    if (r) {
      solved++;
      stars += r.stars;
    }
  }
  return { solved, stars, total: c.puzzles.length };
}

function totalStars(): { stars: number; max: number; solved: number; count: number } {
  let stars = 0;
  let max = 0;
  let solved = 0;
  let count = 0;
  for (const c of allCollections) {
    const s = collectionStats(c);
    stars += s.stars;
    max += s.total * 3;
    solved += s.solved;
    count += s.total;
  }
  return { stars, max, solved, count };
}

/** Screen that shows a spinning model behind the DOM (home). */
class ShowcaseScreen {
  protected scene = new BlockScene();
  protected model: ModelDef | null = null;
  protected app: App;
  protected spinT = 0;
  constructor(app: App) {
    this.app = app;
  }
  protected setModel(m: ModelDef): void {
    this.model = m;
    modelScene(this.scene, m);
    const cam = this.app.camera;
    cam.fit(m.dims, 1.35);
    cam.autoSpin = store.settings.reducedMotion ? 0 : 0.25;
    this.spinT = 0;
  }
  update(dt: number): void {
    this.spinT = Math.min(1, this.spinT + dt * 1.5);
  }
  draw(): DrawList | null {
    if (!this.model) return null;
    return { block: this.scene, shadow: { dims: this.model.dims, alpha: 0.2 } };
  }
}

export class HomeScreen extends ShowcaseScreen implements Screen {
  el: HTMLElement;
  private nav: Nav;
  private cycle = 0;

  constructor(app: App, nav: Nav) {
    super(app);
    this.nav = nav;
    const t = totalStars();
    const inProgress = Object.keys(store.progress).length;
    this.el = h('div', { class: 'home' },
      h('div', { class: 'home-top' }, iconButton(I.gear, 'Settings', () => openSettings(app))),
      h('div', { class: 'home-card glass' },
        h('div', { class: 'logo', 'aria-label': 'Nonocube' }, logoMark(), h('span', null, 'Nono', h('em', null, 'cube'))),
        h('p', { class: 'tagline' }, '3D nonogram puzzles. Break the block, reveal the shape.'),
        h('div', { class: 'home-actions' },
          button(inProgress ? 'Continue playing' : 'Play', () => nav.collections(), 'primary big', I.play),
          button('Daily sculpture', () => nav.daily(), '', I.calendar),
          button('How to play', () => nav.tutorial(), '', I.help),
          button('Level editor', () => nav.editor(), '', I.edit),
        ),
        h('div', { class: 'home-stats' },
          icon(I.star, 'on'), h('b', null, `${t.stars}`), h('span', null, `/ ${t.max} stars`),
          h('span', { class: 'sep' }, '·'), h('b', null, `${t.solved}`), h('span', null, `/ ${t.count} solved`)),
      ),
      h('p', { class: 'home-foot' }, 'Drag to spin · Made with WebGL 2'),
    );
    const solved = allCollections.flatMap((c) => c.puzzles).filter((p) => store.records[p.id]);
    const pool = solved.length >= 3 ? solved : allCollections.flatMap((c) => c.puzzles).filter((p) => ['k-teapot', 'g-mushroom', 's-rocket', 'c-duck', 'a-lighthouse', 'g-tree'].includes(p.id));
    this.pool = pool;
  }
  private pool: PuzzleDef[];

  enter(): void {
    const m = this.pool[Math.floor(Math.random() * this.pool.length)];
    this.setModel(m);
    this.app.camera.pitch = 0.35;
    if (!store.welcomed) {
      store.welcomed = true;
      save();
      setTimeout(async () => {
        const r = await modal({
          title: 'Welcome to Nonocube!',
          body: 'A shape is hidden inside every block. Use the number clues to chip away the extra cubes. New here? The tutorial takes about two minutes.',
          actions: [{ label: 'Skip', value: 'skip' }, { label: 'Start tutorial', value: 'go', cls: 'primary' }],
        });
        unlockAudio();
        if (r === 'go') this.nav.tutorial();
      }, 500);
    }
  }

  update(dt: number): void {
    super.update(dt);
    this.cycle += dt;
    const cam = this.app.camera;
    const wide = cam.width > 900;
    cam.offset = [wide ? cam.width * 0.2 : 0, wide ? 0 : -cam.height * 0.22];
    if (this.cycle > 14 && this.pool.length > 1) {
      this.cycle = 0;
      let m = this.model;
      while (m === this.model) m = this.pool[Math.floor(Math.random() * this.pool.length)];
      if (m) this.setModel(m);
    }
  }
}

function logoMark(): HTMLElement {
  return h('span', {
    class: 'logo-mark',
    html: `<svg viewBox="0 0 48 48" width="44" height="44"><path d="M24 4l17 9.5v21L24 44 7 34.5v-21z" fill="var(--accent)"/><path d="M24 24l17-10.5M24 24L7 13.5M24 24v20" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".85"/><text x="24" y="21" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family="ui-rounded, system-ui">3</text></svg>`,
  });
}

function header(title: string, onBack: () => void, extra?: HTMLElement): HTMLElement {
  return h('header', { class: 'menu-head' }, iconButton(I.back, 'Back', onBack), h('h1', null, title), h('div', { class: 'spacer' }), extra ?? null);
}

export class CollectionsScreen implements Screen {
  el: HTMLElement;
  constructor(app: App, nav: Nav) {
    const cards = allCollections.map((c) => {
      const s = collectionStats(c);
      const done = s.solved === s.total;
      return h('button', { class: `coll-card ${done ? 'done' : ''}`, style: `--t1:${c.tint[0]};--t2:${c.tint[1]}`, onclick: () => nav.collection(c) },
        h('div', { class: 'coll-icon' }, icon(COLLECTION_ICONS[c.icon] ?? I.cube)),
        h('div', { class: 'coll-body' },
          h('div', { class: 'coll-name' }, c.name),
          h('div', { class: 'coll-blurb' }, c.blurb),
          h('div', { class: 'coll-meta' },
            h('span', { class: `tag ${c.difficulty}` }, DIFF_LABEL[c.difficulty]),
            h('span', null, `${s.solved}/${s.total}`),
            h('span', { class: 'mini-stars' }, icon(I.star, 'on'), `${s.stars}`)),
        ),
        h('div', { class: 'coll-bar' }, h('i', { style: `width:${(s.solved / s.total) * 100}%` })),
      );
    });
    const daily = h('button', { class: 'coll-card special', style: '--t1:#ffe1f0;--t2:#f7a8cf', onclick: () => nav.daily() },
      h('div', { class: 'coll-icon' }, icon(I.calendar)),
      h('div', { class: 'coll-body' }, h('div', { class: 'coll-name' }, 'Daily Sculpture'), h('div', { class: 'coll-blurb' }, 'A fresh random puzzle every day.')));
    const mine = h('button', { class: 'coll-card special', style: '--t1:#e2f3ff;--t2:#9fd0f5', onclick: () => nav.myPuzzles() },
      h('div', { class: 'coll-icon' }, icon(I.user)),
      h('div', { class: 'coll-body' }, h('div', { class: 'coll-name' }, 'My Puzzles'), h('div', { class: 'coll-blurb' }, `${store.user.length} made in the editor.`)));
    this.el = h('div', { class: 'menu' },
      header('Puzzles', () => nav.home(), iconButton(I.gear, 'Settings', () => openSettings(app))),
      h('div', { class: 'menu-scroll' }, h('div', { class: 'coll-grid' }, ...cards, daily, mine)),
    );
  }
  update(): void {}
  draw(): null {
    return null;
  }
}

export class CollectionScreen implements Screen {
  el: HTMLElement;
  constructor(app: App, nav: Nav, c: Collection) {
    const s = collectionStats(c);
    const tiles = c.puzzles.map((p, i) => {
      const rec = store.records[p.id];
      const prog = store.progress[p.id];
      const thumb = rec ? h('img', { src: app.thumbnail(p), alt: p.name, loading: 'lazy' }) : h('div', { class: 'mystery' }, '?');
      return h('button', { class: `puzzle-tile ${rec ? 'solved' : ''}`, onclick: () => nav.play(c, i), 'aria-label': rec ? p.name : `Puzzle ${i + 1}` },
        h('div', { class: 'thumb' }, thumb, prog && !rec ? h('span', { class: 'badge' }, 'In progress') : null),
        h('div', { class: 'tile-name' }, rec ? p.name : `#${i + 1}`),
        h('div', { class: 'tile-meta' },
          h('span', null, p.dims.join('×')),
          h('span', { class: 'mini-stars' }, ...[1, 2, 3].map((k) => icon(k <= (rec?.stars ?? 0) ? I.star : I.starOutline, k <= (rec?.stars ?? 0) ? 'on' : '')))),
      );
    });
    this.el = h('div', { class: 'menu', style: `--t1:${c.tint[0]};--t2:${c.tint[1]}` },
      header(c.name, () => nav.collections(), h('div', { class: 'head-stat' }, icon(I.star, 'on'), `${s.stars}/${s.total * 3}`)),
      h('div', { class: 'menu-scroll' }, h('p', { class: 'menu-blurb' }, c.blurb), h('div', { class: 'tile-grid' }, ...tiles)),
    );
  }
  update(): void {}
  draw(): null {
    return null;
  }
}

export class MyPuzzlesScreen implements Screen {
  el: HTMLElement;
  private app: App;
  private nav: Nav;
  constructor(app: App, nav: Nav) {
    this.app = app;
    this.nav = nav;
    this.el = h('div', { class: 'menu' });
    this.render();
  }

  private render(): void {
    const { app, nav } = this;
    const tiles = store.user
      .slice()
      .sort((a, b) => b.updated - a.updated)
      .map((u) => {
        let p: PuzzleDef;
        try {
          p = decodePuzzle(u.code, u.id);
        } catch {
          return null;
        }
        const rec = store.records[u.id];
        return h('div', { class: 'puzzle-tile user' },
          h('button', { class: 'thumb', onclick: () => nav.playCustom(p, () => nav.myPuzzles(), u.id), 'aria-label': `Play ${p.name}` }, h('img', { src: app.thumbnail(p), alt: p.name })),
          h('div', { class: 'tile-name' }, p.name || 'Untitled'),
          h('div', { class: 'tile-meta' }, h('span', null, p.dims.join('×')), rec ? h('span', { class: 'mini-stars' }, icon(I.check), 'solved') : null),
          h('div', { class: 'tile-actions' },
            iconButton(I.play, 'Play', () => nav.playCustom(p, () => nav.myPuzzles(), u.id)),
            iconButton(I.edit, 'Edit', () => nav.editor(p, u.id)),
            iconButton(I.share, 'Share link', () => shareCode(encodePuzzle(p))),
            iconButton(I.trash, 'Delete', async () => {
              const r = await modal({ title: `Delete “${p.name}”?`, body: 'This can’t be undone.', actions: [{ label: 'Cancel', value: 'no' }, { label: 'Delete', value: 'yes', cls: 'danger' }] });
              if (r !== 'yes') return;
              store.user = store.user.filter((x) => x.id !== u.id);
              save();
              this.render();
            })),
        );
      });
    const newTile = h('button', { class: 'puzzle-tile new', onclick: () => nav.editor() }, h('div', { class: 'thumb' }, icon(I.plus)), h('div', { class: 'tile-name' }, 'New puzzle'));
    this.el.replaceChildren(
      header('My Puzzles', () => nav.collections(), button('Import', () => importCode(nav), 'small', I.download)),
      h('div', { class: 'menu-scroll' },
        store.user.length ? null : h('p', { class: 'menu-blurb' }, 'Puzzles you save in the level editor appear here. Share them with a link!'),
        h('div', { class: 'tile-grid' }, newTile, ...tiles.filter((t): t is HTMLDivElement => !!t))),
    );
  }
  update(): void {}
  draw(): null {
    return null;
  }
}

export function shareUrl(code: string): string {
  return `${location.origin}${location.pathname}#p=${code}`;
}

export async function shareCode(code: string): Promise<void> {
  const url = shareUrl(code);
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied to clipboard', 'good');
    sfx.tick();
  } catch {
    const input = h('textarea', { class: 'code-box', readonly: true, rows: 4 }, url);
    await modal({ title: 'Share this puzzle', body: h('div', null, h('p', null, 'Copy this link:'), input), actions: [{ label: 'Done', value: 'ok', cls: 'primary' }] });
  }
}

export async function importCode(nav: Nav): Promise<void> {
  const input = h('textarea', { class: 'code-box', rows: 4, placeholder: 'Paste a puzzle link or code…' });
  const r = await modal({ title: 'Import puzzle', body: h('div', null, input), actions: [{ label: 'Cancel', value: 'no' }, { label: 'Edit', value: 'edit' }, { label: 'Play', value: 'play', cls: 'primary' }] });
  if (r !== 'play' && r !== 'edit') return;
  const raw = input.value.trim();
  const code = raw.includes('#p=') ? raw.split('#p=')[1] : raw;
  try {
    const p = decodePuzzle(code, `shared-${Date.now()}`);
    if (r === 'play') nav.playCustom(p, () => nav.myPuzzles(), null);
    else nav.editor(p);
  } catch (e) {
    toast(`Couldn’t read that code: ${(e as Error).message}`, 'bad', 3000);
  }
}
