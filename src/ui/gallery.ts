import { modelScene, type App, type Screen } from '../app.ts';
import { sfx } from '../audio/sfx.ts';
import type { Collection, ModelDef, PuzzleDef } from '../core/types.ts';
import { store } from '../game/storage.ts';
import { clamp, damp, hexToRgb } from '../render/math.ts';
import type { DrawList, PlacedBlock } from '../render/renderer.ts';
import { BlockScene, NO_GLYPHS, Particles } from '../render/scene.ts';
import { button, h, icon, iconButton } from './dom.ts';
import type { GestureTarget } from './gestures.ts';
import { I } from './icons.ts';
import type { Nav } from './menus.ts';

/** Exhibit layout (world units). */
export const PLINTH = 3.2;
const PLINTH_W = 4.8;
const MODEL_SIZE = 4.2;
const SPACING = 9;

const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const UNSOLVED = hexToRgb('#e9e6de');
const PAINTED = hexToRgb('#6f9df2');
const PLINTH_COLOR = hexToRgb('#f4f1ea');

/** A plain plinth: one cube, scaled up (its bevel reads as a softly rounded edge). */
export function plinthScene(): BlockScene {
  const s = new BlockScene();
  s.reset([1, 1, 1]);
  s.solid[0] = 1;
  s.add(0, 0, 0, 1, PLINTH_COLOR, NO_GLYPHS);
  return s;
}

/** Scale that fits a model's largest side to the exhibit size. */
export const exhibitScale = (m: { dims: readonly number[] }) => Math.min(1.15, MODEL_SIZE / Math.max(...m.dims));

/** Plinth + model standing on it, centered at x. */
export function exhibit(model: BlockScene, dims: readonly number[], x: number, yaw: number, plinth: BlockScene): PlacedBlock[] {
  const s = exhibitScale({ dims });
  return [
    { scene: plinth, pos: [x, -PLINTH / 2, 0], scale: [PLINTH_W, PLINTH, PLINTH_W], bevel: 0.025, yaw: 0, shadow: 0.2 },
    { scene: model, pos: [x, (dims[1] * s) / 2 + 0.01, 0], scale: s, yaw, shadow: 0.28 },
  ];
}

/** The puzzle block as the player left it: unbroken cubes, painted ones in blue. */
function progressScene(scene: BlockScene, p: PuzzleDef): BlockScene {
  scene.reset(p.dims);
  const g = scene.grid;
  const saved = store.progress[p.id]?.state;
  const state = (i: number) => (saved && saved.length === g.size ? Number(saved[i]) : 0);
  for (let i = 0; i < g.size; i++) scene.solid[i] = state(i) === 2 ? 0 : 1;
  for (let i = 0; i < g.size; i++) {
    if (!scene.solid[i]) continue;
    const [x, y, z] = g.coords(i);
    scene.add(x, y, z, 1, state(i) === 1 ? PAINTED : UNSOLVED, NO_GLYPHS);
  }
  scene.computeAO();
  return scene;
}

/** Reveal-in-place: unsolved block → colored model, cube by cube. */
function revealScene(scene: BlockScene, m: ModelDef, t: number): BlockScene {
  scene.reset(m.dims);
  const g = scene.grid;
  const colors = m.palette.map(hexToRgb);
  for (let i = 0; i < g.size; i++) scene.solid[i] = m.cells[i] ? 1 : 0;
  const col = [0, 0, 0];
  for (let i = 0; i < g.size; i++) {
    const c = m.cells[i];
    if (!c) continue;
    const [x, y, z] = g.coords(i);
    const delay = (y / Math.max(1, m.dims[1])) * 0.55 + (((i * 7919) % 97) / 97) * 0.25;
    const k = clamp((t * 1.8 - delay) / 0.45, 0, 1);
    const e = k * k * (3 - 2 * k);
    for (let j = 0; j < 3; j++) col[j] = UNSOLVED[j] + (colors[c - 1][j] - UNSOLVED[j]) * e;
    scene.add(x, y, z, 1 + 0.14 * Math.sin(Math.PI * k), col, NO_GLYPHS);
  }
  scene.computeAO();
  return scene;
}

interface Exhibit {
  puzzle: PuzzleDef;
  scene: BlockScene;
  solved: boolean;
  yaw: number;
}

/**
 * A collection as a gallery room: one plinth per puzzle. Browse by dragging, scrolling,
 * arrow keys or clicking a neighbor; click the centered piece (or Play) to open it.
 */
export class GalleryScreen implements Screen {
  readonly el: HTMLElement;
  readonly gestures: GestureTarget;
  private app: App;
  private nav: Nav;
  private col: Collection;
  private items: Exhibit[];
  private plinth = plinthScene();
  private focus: number;
  private scroll: number;
  private drag: { x: number; y: number; start: number; dist: number } | null = null;
  private wheelAcc = 0;
  private particles = new Particles();
  private fresh: { index: number; t: number } | null = null;
  private time = 0;
  private ui: Record<string, HTMLElement> = {};

  constructor(app: App, nav: Nav, col: Collection, focus = -1) {
    this.app = app;
    this.nav = nav;
    this.col = col;
    this.items = col.puzzles.map((p) => {
      const solved = !!store.records[p.id];
      const scene = new BlockScene();
      if (solved) modelScene(scene, p);
      else progressScene(scene, p);
      return { puzzle: p, scene, solved, yaw: 0.55 };
    });
    // start on the requested piece, else the first unsolved one
    if (focus < 0) focus = Math.max(0, this.items.findIndex((e) => !e.solved));
    // a piece solved just now gets revealed on its plinth
    if (app.freshSolve) {
      const k = col.puzzles.findIndex((p) => p.id === app.freshSolve);
      if (k >= 0) {
        focus = k;
        this.fresh = { index: k, t: 0 };
        revealScene(this.items[k].scene, col.puzzles[k], 0);
      }
      app.freshSolve = null;
    }
    this.focus = focus;
    this.scroll = focus;
    this.el = this.buildUI();
    this.gestures = this.makeGestures();
    this.renderPlaque();
  }

  private buildUI(): HTMLElement {
    const solved = this.items.filter((e) => e.solved).length;
    const stars = this.col.puzzles.reduce((n, p) => n + (store.records[p.id]?.stars ?? 0), 0);
    this.ui.plaque = h('div', { class: 'gallery-plaque' });
    this.ui.dots = h('div', { class: 'gallery-dots', role: 'tablist', 'aria-label': 'Exhibits' },
      ...this.items.map((e, i) => h('button', { class: `gdot ${e.solved ? 'solved' : ''}`, 'aria-label': `Exhibit ${i + 1}`, 'data-tip': e.solved ? e.puzzle.name : `No. ${i + 1}`, onclick: () => this.goTo(i) })));
    return h('div', { class: 'gallery', style: `--t1:${this.col.tint[0]};--t2:${this.col.tint[1]}` },
      h('header', { class: 'gallery-head' },
        iconButton(I.back, 'All galleries', () => this.nav.collections()),
        h('div', { class: 'gallery-title' },
          h('div', { class: 'plaque-eyebrow' }, `${DIFF_LABEL[this.col.difficulty]} · ${solved} of ${this.items.length} exhibits`),
          h('h1', null, this.col.name)),
        h('div', { class: 'spacer' }),
        h('div', { class: 'head-stat' }, icon(I.star, 'on'), `${stars}/${this.items.length * 3}`)),
      h('button', { class: 'gallery-arrow left', 'aria-label': 'Previous', 'data-tip': 'Previous', 'data-key': '←', onclick: () => this.goTo(this.focus - 1) }, icon(I.back)),
      h('button', { class: 'gallery-arrow right', 'aria-label': 'Next', 'data-tip': 'Next', 'data-key': '→', onclick: () => this.goTo(this.focus + 1) }, icon(I.chevron)),
      h('footer', { class: 'gallery-foot' }, this.ui.plaque, this.ui.dots),
    );
  }

  private renderPlaque(): void {
    const e = this.items[this.focus];
    const p = e.puzzle;
    const rec = store.records[p.id];
    const prog = store.progress[p.id];
    const fresh = this.fresh?.index === this.focus;
    const starsEl = h('span', { class: 'mini-stars' }, ...[1, 2, 3].map((k) => icon(k <= (rec?.stars ?? 0) ? I.star : I.starOutline, k <= (rec?.stars ?? 0) ? 'on' : '')));
    this.ui.plaque.replaceChildren(
      h('div', { class: 'plaque-eyebrow' }, fresh ? 'New acquisition' : `No. ${this.focus + 1}`),
      h('h2', { class: 'plaque-title' }, e.solved ? p.name : 'Untitled'),
      h('div', { class: 'plaque-meta' },
        h('span', null, p.dims.join(' × ')),
        rec ? starsEl : prog ? h('span', { class: 'badge-inline' }, 'In progress') : h('span', null, 'Not yet solved')),
      button(e.solved ? 'Play again' : prog ? 'Continue' : 'Solve', () => this.play(), 'primary', I.play),
    );
    this.ui.plaque.classList.remove('swap');
    void this.ui.plaque.offsetWidth;
    this.ui.plaque.classList.add('swap');
    [...this.ui.dots.children].forEach((d, i) => d.classList.toggle('on', i === this.focus));
    (this.el.querySelector('.gallery-arrow.left') as HTMLElement).toggleAttribute('disabled', this.focus === 0);
    (this.el.querySelector('.gallery-arrow.right') as HTMLElement).toggleAttribute('disabled', this.focus === this.items.length - 1);
  }

  private goTo(i: number): void {
    i = clamp(i, 0, this.items.length - 1);
    if (i === this.focus) return;
    this.focus = i;
    sfx.tick();
    this.renderPlaque();
  }

  private play(): void {
    this.nav.play(this.col, this.focus);
  }

  private makeGestures(): GestureTarget {
    return {
      hitTest: () => false,
      strokeStart: () => {},
      strokeMove: () => {},
      strokeEnd: () => {},
      hover: (x, y) => {
        this.app.canvas.style.cursor = this.pickExhibit(x, y) >= 0 ? 'pointer' : 'grab';
      },
      hoverEnd: () => {},
      orbitStart: (x, y) => {
        this.drag = { x, y, start: this.scroll, dist: 0 };
        this.app.canvas.style.cursor = 'grabbing';
      },
      orbit: (dx, dy) => {
        if (!this.drag) return;
        this.drag.dist += Math.abs(dx) + Math.abs(dy);
        // drag the room sideways: one exhibit per ~third of the screen
        this.scroll = clamp(this.scroll - dx / (this.app.camera.width / 3), -0.4, this.items.length - 0.6);
      },
      orbitEnd: () => {
        const d = this.drag;
        this.drag = null;
        this.app.canvas.style.cursor = 'grab';
        if (!d) return;
        if (d.dist < 6 && d.x >= 0) {
          const i = this.pickExhibit(d.x, d.y);
          if (i === this.focus) this.play();
          else if (i >= 0) this.goTo(i);
          return;
        }
        const target = Math.round(this.scroll + Math.sign(this.scroll - d.start) * 0.2);
        this.focus = -1;
        this.goTo(clamp(target, 0, this.items.length - 1));
      },
      zoom: (f) => {
        this.wheelAcc += Math.log(f);
        if (Math.abs(this.wheelAcc) > 0.22) {
          this.goTo(this.focus + Math.sign(this.wheelAcc));
          this.wheelAcc = 0;
        }
      },
    };
  }

  private exhibitCenter(i: number): [number, number, number] {
    const p = this.items[i].puzzle;
    return [i * SPACING, (p.dims[1] * exhibitScale(p)) / 2, 0];
  }

  private pickExhibit(x: number, y: number): number {
    let best = -1;
    let bestD = 150;
    for (let i = 0; i < this.items.length; i++) {
      const [sx, sy] = this.app.camera.project(this.exhibitCenter(i));
      const d = Math.hypot(sx - x, sy - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  enter(): void {
    const cam = this.app.camera;
    cam.yaw = 0.3;
    cam.pitch = 0.2;
    cam.resetZoom();
    document.body.classList.add('in-gallery');
    this.app.canvas.style.cursor = 'grab';
  }

  exit(): void {
    document.body.classList.remove('in-gallery');
    this.app.canvas.style.cursor = '';
  }

  update(dt: number, time: number): void {
    this.time = time;
    if (!this.drag) this.scroll += (this.focus - this.scroll) * damp(9, dt);
    const cam = this.app.camera;
    const head = (this.el.querySelector('.gallery-head') as HTMLElement).getBoundingClientRect().bottom;
    const foot = (this.el.querySelector('.gallery-foot') as HTMLElement).getBoundingClientRect().top;
    cam.frame(head, 30, cam.height - foot, 30, dt);
    cam.target = [this.scroll * SPACING, (MODEL_SIZE - PLINTH) / 2, 0];
    cam.fit([12, MODEL_SIZE + PLINTH + 1.2, 5], 1.0);
    cam.yaw += (0.3 - cam.yaw) * damp(3, dt);
    cam.pitch += (0.2 - cam.pitch) * damp(3, dt);
    // the centered piece turns slowly; the others settle to a three-quarter view
    this.items.forEach((e, i) => {
      if (i === this.focus && !store.settings.reducedMotion) e.yaw += dt * 0.45;
      else e.yaw += (Math.round((e.yaw - 0.55) / (Math.PI * 2)) * Math.PI * 2 + 0.55 - e.yaw) * damp(4, dt);
    });
    if (this.fresh) {
      const f = this.fresh;
      const before = f.t;
      f.t = Math.min(1.2, f.t + dt / 1.8);
      const e = this.items[f.index];
      revealScene(e.scene, e.puzzle, Math.min(1, f.t));
      if (before < 0.15 && f.t >= 0.15) sfx.win();
      if (before < 0.7 && f.t >= 0.7 && !store.settings.reducedMotion) {
        const c = e.puzzle.palette.map(hexToRgb);
        const [x, y] = this.exhibitCenter(f.index);
        for (let k = 0; k < 5; k++) this.particles.burst(x + (Math.random() - 0.5) * 2, y + 2, (Math.random() - 0.5) * 2, c[k % c.length], 7, 1.2);
      }
      if (f.t >= 1.2) {
        modelScene(e.scene, e.puzzle);
        e.solved = true;
      }
    }
    this.particles.update(dt);
  }

  draw(): DrawList {
    const placed: PlacedBlock[] = [];
    this.items.forEach((e, i) => {
      if (Math.abs(i - this.scroll) > 3.2) return;
      placed.push(...exhibit(e.scene, e.puzzle.dims, i * SPACING, e.yaw, this.plinth));
    });
    // particles use the main block's origin: none here, so they're in world space
    return { placed, particles: this.particles, time: this.time };
  }

  onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowLeft') this.goTo(this.focus - 1);
    else if (e.key === 'ArrowRight') this.goTo(this.focus + 1);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.play();
    } else if (e.key === 'Escape') this.nav.collections();
  }
}
