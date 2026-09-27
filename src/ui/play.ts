import type { App, Screen } from '../app.ts';
import { haptic, sfx, unlockAudio } from '../audio/sfx.ts';
import { clueCount, clueKind, describeClue, CIRCLE, SQUARE } from '../core/clues.ts';
import type { Axis } from '../core/grid.ts';
import type { Collection, PuzzleDef } from '../core/types.ts';
import { BROKEN, findHint, MAX_STRIKES, PAINTED, PlaySession, type Hint } from '../game/session.ts';
import { onSettingsChange, recordSolve, save, store } from '../game/storage.ts';
import { GLYPH_NONE } from '../render/atlas.ts';
import { DEFAULT_PITCH, DEFAULT_YAW } from '../render/camera.ts';
import { clamp, damp, hexToRgb, type Vec3 } from '../render/math.ts';
import { pickVoxel } from '../render/pick.ts';
import { boxEdges, type DrawList, type LineBatch } from '../render/renderer.ts';
import { BlockScene, FLAG_GLOW, FLAG_HOVER, FLAG_STRIPES, packGlyphs, Particles } from '../render/scene.ts';
import { button, formatTime, h, icon, iconButton, modal, toast } from './dom.ts';
import type { GestureTarget } from './gestures.ts';
import { I } from './icons.ts';
import { openSettings } from './settings.ts';

export type Tool = 'break' | 'paint';

export const AXIS_COLORS = ['#e5534b', '#3bb37a', '#3d7be0'];
export const AXIS_NAMES = ['X', 'Y', 'Z'];

const BASE: Vec3 = hexToRgb('#e9e6de');
const PAINT: Vec3 = hexToRgb('#6f9df2');
const HOVER_TINT: Vec3 = hexToRgb('#ffd98a');
const RED: Vec3 = hexToRgb('#ff5a4e');

/** Hooks for the interactive tutorial. */
export interface PlayHooks {
  attach(p: PlayScreen): void;
  event(name: 'orbit' | 'zoom' | 'action' | 'slice' | 'tool' | 'hint' | 'solved' | 'undo'): void;
  /** Return true to suppress the regular "solved" card. */
  onSolved?(): boolean;
  detach?(): void;
}

export interface PlayOptions {
  puzzle: PuzzleDef;
  mask: Uint8Array;
  collection?: Collection;
  index?: number;
  /** Key for saving progress/records. null disables persistence (playtest, tutorial). */
  saveKey: string | null;
  onExit: () => void;
  onNext?: () => void;
  hooks?: PlayHooks;
  subtitle?: string;
}

interface Stroke {
  mode: 'break' | 'paint' | 'unpaint';
  start: [number, number, number];
  sx: number;
  sy: number;
  axis: Axis | -1;
  dir: [number, number];
  reachedPos: number;
  reachedNeg: number;
  stopped: boolean;
  count: number;
}

export class PlayScreen implements Screen {
  readonly el: HTMLElement;
  readonly session: PlaySession;
  readonly opts: PlayOptions;
  readonly app: App;
  readonly gestures: GestureTarget;
  tool: Tool = 'break';
  slice = { axis: 1 as Axis, peel: 0, sign: 1 };
  /** Lines to pulse (hints / tutorial). */
  highlightLines: number[] = [];
  highlightCells = new Set<number>();
  readonly ui: Record<string, HTMLElement> = {};

  private scene = new BlockScene();
  private particles = new Particles();
  private hover = -1;
  private stroke: Stroke | null = null;
  private paintT: Float32Array;
  private shake: Float32Array;
  private flash: Float32Array;
  private revealT = 0;
  private solvedAt = -1;
  private time = 0;
  private hintInfo: Hint | null = null;
  private orbitAccum = 0;
  private offSettings: () => void;
  private cardShown = false;
  private firstFrame = true;
  private outOfStrikesShown = false;

  constructor(app: App, opts: PlayOptions) {
    this.app = app;
    this.opts = opts;
    this.session = new PlaySession(opts.puzzle, opts.mask, store.settings.mistakeMode);
    if (opts.saveKey && store.progress[opts.saveKey]) this.session.restore(store.progress[opts.saveKey]);
    const n = this.session.grid.size;
    this.paintT = new Float32Array(n);
    this.shake = new Float32Array(n);
    this.flash = new Float32Array(n);
    for (let i = 0; i < n; i++) this.paintT[i] = this.session.state[i] === PAINTED ? 1 : 0;
    this.el = this.buildUI();
    this.gestures = this.makeGestures();
    this.offSettings = onSettingsChange(() => this.applySettings());
    this.applySettings();
  }

  // ---------------------------------------------------------------- UI

  private buildUI(): HTMLElement {
    const p = this.opts.puzzle;
    const s = this.session;
    const title = h('div', { class: 'title-block' },
      h('div', { class: 'eyebrow' }, this.opts.subtitle ?? (this.opts.collection ? `${this.opts.collection.name} · #${(this.opts.index ?? 0) + 1}` : 'Puzzle')),
      (this.ui.name = h('div', { class: 'puzzle-name' }, this.session.solved ? p.name : '???')),
    );
    this.ui.timer = h('div', { class: 'stat timer', title: 'Time' }, formatTime(s.elapsed));
    this.ui.strikes = h('div', { class: 'stat strikes', title: 'Mistakes' });
    this.ui.progress = h('div', { class: 'progress' }, h('div', { class: 'progress-fill' }));

    const top = h('header', { class: 'topbar' },
      iconButton(I.back, 'Back', () => this.leave()),
      title,
      h('div', { class: 'spacer' }),
      this.ui.timer,
      this.ui.strikes,
      iconButton(I.restart, 'Restart puzzle', () => this.confirmRestart(), 'hide-sm'),
      iconButton(I.gear, 'Settings', () => openSettings(this.app)),
      this.ui.progress,
    );

    // tool dock
    this.ui.hammer = h('button', { class: 'tool active', 'aria-label': 'Hammer: break cubes', title: 'Hammer (B)', onclick: () => this.setTool('break') }, icon(I.hammer), h('span', null, 'Break'));
    this.ui.brush = h('button', { class: 'tool', 'aria-label': 'Brush: paint cubes to keep', title: 'Brush (P)', onclick: () => this.setTool('paint') }, icon(I.brush), h('span', null, 'Paint'));
    this.ui.undo = iconButton(I.undo, 'Undo (Ctrl+Z)', () => this.undo());
    this.ui.redo = iconButton(I.redo, 'Redo (Ctrl+Shift+Z)', () => this.redo());
    this.ui.hint = iconButton(I.bulb, 'Hint (H)', () => this.showHint());
    this.ui.tools = h('div', { class: 'toolswitch', role: 'group', 'aria-label': 'Tool' }, this.ui.hammer, this.ui.brush);
    this.ui.dock = h('div', { class: 'dock' }, this.ui.undo, this.ui.redo, this.ui.tools, this.ui.hint);

    // slicer
    const axisBtns = [0, 1, 2].map((a) =>
      h('button', { class: 'axis-btn', style: `--axis:${AXIS_COLORS[a]}`, 'aria-label': `Slice along ${AXIS_NAMES[a]}`, onclick: () => this.setSliceAxis(a as Axis) }, AXIS_NAMES[a]),
    );
    this.ui.sliceRange = h('input', {
      type: 'range', min: '0', max: '1', step: '1', value: '0', class: 'slice-range', 'aria-label': 'Layers peeled',
      oninput: (e: Event) => this.setPeel(Number((e.target as HTMLInputElement).value)),
    });
    this.ui.sliceLabel = h('span', { class: 'slice-label' }, '0');
    this.ui.slice = h('div', { class: 'pill slicer', title: 'Peel layers to see inside ([ and ])' },
      icon(I.layers, 'muted'), ...axisBtns, this.ui.sliceRange, this.ui.sliceLabel);
    this.ui.axisBtns = h('div');
    axisBtns.forEach((b, i) => (this.ui[`axis${i}`] = b));

    this.ui.view = h('div', { class: 'pill viewpad' },
      iconButton(I.rotL, 'Turn left (←)', () => this.app.camera.turn(-1)),
      iconButton(I.target, 'Reset view (R)', () => this.resetView()),
      iconButton(I.rotR, 'Turn right (→)', () => this.app.camera.turn(1)),
    );

    this.ui.focus = h('div', { class: 'focus', 'aria-live': 'polite' });
    this.ui.hintMsg = h('div', { class: 'hint-msg' });

    const root = h('div', { class: 'play' }, top, this.ui.focus, this.ui.hintMsg,
      h('footer', { class: 'bottom' }, this.ui.slice, this.ui.dock, this.ui.view));
    return root;
  }

  private applySettings(): void {
    this.session.mode = store.settings.mistakeMode;
    this.el.classList.toggle('lefty', store.settings.lefty);
    this.ui.timer.style.display = store.settings.showTimer ? '' : 'none';
    this.refreshHud();
  }

  refreshHud(): void {
    const s = this.session;
    this.ui.undo.toggleAttribute('disabled', !s.canUndo);
    this.ui.redo.toggleAttribute('disabled', !s.canRedo);
    const classic = s.mode === 'classic' && !s.noStrikeLimit;
    this.ui.strikes.style.display = classic ? '' : 'none';
    if (classic) {
      this.ui.strikes.replaceChildren(
        ...Array.from({ length: MAX_STRIKES }, (_, k) => h('span', { class: `dot ${k < s.strikes ? 'on' : ''}` })),
      );
      this.ui.strikes.setAttribute('aria-label', `${s.strikes} of ${MAX_STRIKES} mistakes`);
    }
    (this.ui.progress.firstChild as HTMLElement).style.width = `${Math.round(s.progress * 100)}%`;
    const dim = this.session.grid.dims[this.slice.axis];
    const range = this.ui.sliceRange as HTMLInputElement;
    range.max = String(dim - 1);
    range.value = String(this.slice.peel);
    this.ui.sliceLabel.textContent = this.slice.peel ? `−${this.slice.peel}` : '';
    for (let a = 0; a < 3; a++) this.ui[`axis${a}`].classList.toggle('active', a === this.slice.axis);
    this.ui.slice.classList.toggle('peeling', this.slice.peel > 0);
  }

  setTool(t: Tool): void {
    if (this.tool === t) return;
    this.tool = t;
    this.ui.hammer.classList.toggle('active', t === 'break');
    this.ui.brush.classList.toggle('active', t === 'paint');
    this.el.classList.toggle('painting', t === 'paint');
    sfx.tick();
    this.opts.hooks?.event('tool');
  }

  setSliceAxis(a: Axis): void {
    if (this.slice.axis === a) {
      // tapping the active axis toggles peel off
      if (this.slice.peel) this.setPeel(0);
      return;
    }
    this.slice.axis = a;
    this.slice.peel = 0;
    this.refreshHud();
    sfx.tick();
  }

  setPeel(n: number): void {
    const dim = this.session.grid.dims[this.slice.axis];
    n = clamp(Math.round(n), 0, dim - 1);
    if (n > 0 && this.slice.peel === 0) {
      const e = this.app.camera.eye[this.slice.axis];
      this.slice.sign = e >= 0 ? 1 : -1;
    }
    if (n === this.slice.peel) return;
    this.slice.peel = n;
    this.refreshHud();
    sfx.tick();
    this.opts.hooks?.event('slice');
  }

  private resetView(): void {
    this.app.camera.snapTo(DEFAULT_YAW, DEFAULT_PITCH);
    this.app.camera.resetZoom();
  }

  private async confirmRestart(): Promise<void> {
    const r = await modal({ title: 'Restart puzzle?', body: 'Your progress on this puzzle will be cleared.', actions: [{ label: 'Cancel', value: 'no' }, { label: 'Restart', value: 'yes', cls: 'danger' }] });
    if (r !== 'yes') return;
    this.session.restart();
    this.paintT.fill(0);
    this.revealT = 0;
    this.solvedAt = -1;
    this.cardShown = false;
    this.outOfStrikesShown = false;
    this.el.querySelector('.solved-card')?.remove();
    this.el.classList.remove('solved');
    this.ui.name.textContent = '???';
    this.app.camera.autoSpin = 0;
    this.persist();
    this.refreshHud();
  }

  /** Leave the puzzle (back button). */
  leave(): void {
    this.persist(true);
    this.opts.onExit();
  }

  // ---------------------------------------------------------------- lifecycle

  enter(): void {
    const cam = this.app.camera;
    cam.fit(this.session.grid.dims);
    cam.yaw = DEFAULT_YAW + 0.9;
    cam.pitch = DEFAULT_PITCH;
    cam.zoom = 1.25;
    cam.resetZoom();
    cam.snapTo(DEFAULT_YAW, DEFAULT_PITCH, 0.9);
    this.opts.hooks?.attach(this);
    if (this.session.solved) {
      this.revealT = 1;
      this.solvedAt = 0;
      this.el.classList.add('solved');
    }
    this.refreshHud();
  }

  update(dt: number, time: number): void {
    this.time = time;
    const s = this.session;
    const cam = this.app.camera;
    // keep the model clear of the HUD
    let top = 0;
    let bottom = cam.height;
    for (const el of this.el.querySelectorAll<HTMLElement>('.topbar, .tutorial-card')) top = Math.max(top, el.getBoundingClientRect().bottom);
    for (const el of this.el.querySelectorAll<HTMLElement>('.bottom > *, .solved-card.in')) bottom = Math.min(bottom, el.getBoundingClientRect().top);
    cam.frame(top + 8, 8, cam.height - bottom + 8, 8, this.firstFrame ? 0 : dt);
    this.firstFrame = false;
    if (!s.solved && document.visibilityState === 'visible' && !document.querySelector('.modal-back')) {
      s.elapsed += dt;
      this.ui.timer.textContent = formatTime(s.elapsed);
    }
    this.particles.update(dt);
    const k = damp(18, dt);
    for (let i = 0; i < this.paintT.length; i++) {
      const target = s.state[i] === PAINTED ? 1 : 0;
      if (this.paintT[i] !== target) {
        this.paintT[i] += (target - this.paintT[i]) * k;
        if (Math.abs(this.paintT[i] - target) < 0.01) this.paintT[i] = target;
      }
      if (this.shake[i] > 0) this.shake[i] = Math.max(0, this.shake[i] - dt);
      if (this.flash[i] > 0) this.flash[i] = Math.max(0, this.flash[i] - dt);
    }
    if (s.solved && this.solvedAt >= 0) {
      this.revealT = Math.min(1, this.revealT + dt / 1.4);
      if (this.revealT > 0.55 && !this.cardShown) this.showSolvedCard();
    }
  }

  draw(): DrawList {
    const s = this.session;
    const g = s.grid;
    const scene = this.scene;
    scene.reset(g.dims);
    const revealing = s.solved && this.revealT > 0;
    const rt = revealing ? this.revealT * this.revealT * (3 - 2 * this.revealT) : 0;
    const hoverLines = this.hover >= 0 && !revealing ? [g.cellLines[this.hover * 3], g.cellLines[this.hover * 3 + 1], g.cellLines[this.hover * 3 + 2]] : [];
    const hl = new Set<number>(this.highlightLines);
    const palette = s.def.palette.map(hexToRgb);
    const fade = store.settings.fadeDone;
    const peel = this.slice.peel;

    for (let i = 0; i < g.size; i++) scene.solid[i] = s.state[i] !== BROKEN && this.visible(i) ? 1 : 0;
    const col: number[] = [0, 0, 0];
    for (let i = 0; i < g.size; i++) {
      if (!scene.solid[i]) continue;
      const [x, y, z] = g.coords(i);
      const pt = this.paintT[i];
      col[0] = BASE[0] + (PAINT[0] - BASE[0]) * pt;
      col[1] = BASE[1] + (PAINT[1] - BASE[1]) * pt;
      col[2] = BASE[2] + (PAINT[2] - BASE[2]) * pt;
      let flags = 0;
      if (pt > 0.5 && !revealing) flags |= FLAG_STRIPES;
      const lx = g.cellLines[i * 3];
      const ly = g.cellLines[i * 3 + 1];
      const lz = g.cellLines[i * 3 + 2];
      if (!revealing) {
        if (hoverLines.length && i !== this.hover && (lx === hoverLines[0] || ly === hoverLines[1] || lz === hoverLines[2]))
          for (let c = 0; c < 3; c++) col[c] = col[c] * 0.82 + HOVER_TINT[c] * 0.26;
        if (i === this.hover) flags |= FLAG_HOVER;
        if (hl.has(lx) || hl.has(ly) || hl.has(lz) || this.highlightCells.has(i)) flags |= FLAG_GLOW;
        const f = this.flash[i];
        if (f > 0) for (let c = 0; c < 3; c++) col[c] += (RED[c] - col[c]) * Math.min(1, f * 2);
      } else {
        const sc = palette[s.def.cells[i] - 1] ?? col;
        for (let c = 0; c < 3; c++) col[c] += (sc[c] - col[c]) * rt;
      }
      const glyph = (l: number) => (s.mask[l] ? s.clues[l] : GLYPH_NONE);
      const done = (l: number) => fade && s.mask[l] === 1 && s.lineDone[l] === 1;
      const packed = packGlyphs(glyph(lx), glyph(ly), glyph(lz), done(lx), done(ly), done(lz)) | flags;
      let ox = 0;
      if (this.shake[i] > 0) ox = Math.sin(this.time * 70) * 0.09 * (this.shake[i] / 0.35);
      const scale = revealing ? 1 : 1 - 0.04 * Math.max(0, 1 - Math.abs(pt - 0.5) * 2);
      scene.add(x + ox, y, z, scale, col, packed);
    }
    scene.computeAO();
    scene.glyphAlpha = 1 - rt;

    const lines: LineBatch[] = [];
    const [W, H, D] = g.dims;
    if (!revealing) lines.push({ points: boxEdges([-W / 2, -H / 2, -D / 2], [W / 2, H / 2, D / 2]), color: [0.45, 0.45, 0.6, 0.25] });
    if (peel > 0 && !revealing) {
      const a = this.slice.axis;
      const min = [-W / 2, -H / 2, -D / 2];
      const max = [W / 2, H / 2, D / 2];
      const cut = this.slice.sign > 0 ? g.dims[a] / 2 - peel : -g.dims[a] / 2 + peel;
      min[a] = max[a] = cut;
      const c = hexToRgb(AXIS_COLORS[a]);
      lines.push({ points: boxEdges(min, max), color: [c[0], c[1], c[2], 0.9] });
    }
    return { block: scene, particles: this.particles, lines, shadow: { dims: g.dims, alpha: 0.22 }, time: this.time };
  }

  visible(i: number): boolean {
    const peel = this.slice.peel;
    if (!peel) return true;
    const c = this.session.grid.coords(i)[this.slice.axis];
    const dim = this.session.grid.dims[this.slice.axis];
    return this.slice.sign > 0 ? c < dim - peel : c >= peel;
  }

  // ---------------------------------------------------------------- interaction

  pickCell(x: number, y: number): { i: number; hit: [number, number, number] } | null {
    const s = this.session;
    const { o, d } = this.app.camera.ray(x, y);
    const g = s.grid;
    const hit = pickVoxel(o, d, g.dims, (cx, cy, cz) => {
      const i = g.idx(cx, cy, cz);
      return s.state[i] !== BROKEN && this.visible(i);
    });
    if (!hit) return null;
    return { i: g.idx(hit.x, hit.y, hit.z), hit: [hit.x, hit.y, hit.z] };
  }

  private makeGestures(): GestureTarget {
    const cam = this.app.camera;
    return {
      hitTest: (x, y) => !this.session.solved && !!this.pickCell(x, y),
      strokeStart: (x, y, alt) => {
        unlockAudio();
        this.beginStroke(x, y, alt);
      },
      strokeMove: (x, y) => this.moveStroke(x, y),
      strokeEnd: () => this.endStroke(),
      hover: (x, y) => this.setHover(this.pickCell(x, y)?.i ?? -1),
      hoverEnd: () => this.setHover(-1),
      touchFocus: (x, y) => this.setHover(y === null ? -1 : (this.pickCell(x, y)?.i ?? -1)),
      orbitStart: () => {
        unlockAudio();
        cam.beginDrag();
        this.setHover(-1);
      },
      orbit: (dx, dy, dt) => {
        cam.orbit(dx, dy, dt);
        this.orbitAccum += Math.abs(dx) + Math.abs(dy);
        if (this.orbitAccum > 120) {
          this.orbitAccum = 0;
          this.opts.hooks?.event('orbit');
        }
      },
      orbitEnd: () => cam.endDrag(),
      zoom: (f) => {
        cam.zoomBy(f);
        this.opts.hooks?.event('zoom');
      },
    };
  }

  private setHover(i: number): void {
    if (i === this.hover) return;
    this.hover = i;
    this.renderFocus();
  }

  private renderFocus(): void {
    const s = this.session;
    const i = this.hover;
    if (i < 0 || s.solved) {
      this.ui.focus.classList.remove('show');
      return;
    }
    const chips = [0, 1, 2].map((a) => {
      const l = s.grid.cellLines[i * 3 + a];
      const visible = s.mask[l] === 1;
      const c = s.clues[l];
      const kind = clueKind(c);
      const done = visible && s.lineDone[l] === 1;
      return h('div', { class: `clue-chip ${done ? 'done' : ''}`, style: `--axis:${AXIS_COLORS[a]}`, title: visible ? describeClue(c) : 'No clue' },
        h('span', { class: 'axis-dot' }, AXIS_NAMES[a]),
        visible
          ? h('span', { class: `clue ${kind === CIRCLE ? 'circle' : kind === SQUARE ? 'square' : ''}` }, String(clueCount(c)))
          : h('span', { class: 'clue none' }, '–'),
      );
    });
    this.ui.focus.replaceChildren(...chips);
    this.ui.focus.classList.add('show');
  }

  private beginStroke(x: number, y: number, alt: boolean): void {
    const p = this.pickCell(x, y);
    if (!p || this.session.solved) return;
    const tool: Tool = alt ? (this.tool === 'break' ? 'paint' : 'break') : this.tool;
    const mode = tool === 'break' ? 'break' : this.session.state[p.i] === PAINTED ? 'unpaint' : 'paint';
    this.session.beginGroup();
    this.stroke = { mode, start: p.hit, sx: x, sy: y, axis: -1, dir: [0, 0], reachedPos: 0, reachedNeg: 0, stopped: false, count: 0 };
    this.setHover(p.i);
    this.clearHint();
    this.applyCell(p.i, true);
  }

  private moveStroke(x: number, y: number): void {
    const st = this.stroke;
    if (!st || st.stopped) return;
    const g = this.session.grid;
    const dx = x - st.sx;
    const dy = y - st.sy;
    if (st.axis < 0) {
      if (Math.hypot(dx, dy) < 14) return;
      // choose the grid axis whose on-screen direction best matches the drag
      const origin = this.worldOf(st.start);
      const p0 = this.app.camera.project(origin);
      let best = -1;
      let bestScore = 0.55;
      for (let a = 0; a < 3; a++) {
        const q: Vec3 = [...origin];
        q[a] += 1;
        const p1 = this.app.camera.project(q);
        const vx = p1[0] - p0[0];
        const vy = p1[1] - p0[1];
        const len = Math.hypot(vx, vy);
        if (len < 5) continue;
        const score = Math.abs(vx * dx + vy * dy) / (len * Math.hypot(dx, dy));
        if (score > bestScore) {
          bestScore = score;
          best = a;
          st.dir = [vx, vy];
        }
      }
      if (best < 0) return;
      st.axis = best as Axis;
    }
    const [vx, vy] = st.dir;
    const n = Math.round((dx * vx + dy * vy) / (vx * vx + vy * vy));
    const a = st.axis as Axis;
    const step = (o: number): boolean => {
      const c: [number, number, number] = [...st.start];
      c[a] += o;
      if (!g.inBounds(c[0], c[1], c[2])) return false;
      const i = g.idx(c[0], c[1], c[2]);
      if (!this.visible(i)) return false;
      if (this.session.state[i] === BROKEN) return true;
      return this.applyCell(i, false);
    };
    if (n > st.reachedPos) {
      for (let o = st.reachedPos + 1; o <= n; o++) {
        st.reachedPos = o;
        if (!step(o)) {
          st.reachedPos = 1e9;
          break;
        }
      }
    } else if (-n > st.reachedNeg) {
      for (let o = st.reachedNeg + 1; o <= -n; o++) {
        st.reachedNeg = o;
        if (!step(-o)) {
          st.reachedNeg = 1e9;
          break;
        }
      }
    }
    if (st.stopped) return;
    const cur = this.pickCell(x, y);
    if (cur) this.setHover(cur.i);
  }

  private endStroke(): void {
    if (!this.stroke) return;
    this.session.endGroup();
    this.stroke = null;
    this.afterChange();
  }

  /** Apply the current stroke's action to a cell. Returns false when the stroke should stop. */
  private applyCell(i: number, first: boolean): boolean {
    const st = this.stroke!;
    const s = this.session;
    if (st.mode === 'break') {
      const r = s.breakCell(i);
      if (r === 'ok') {
        const [x, y, z] = s.grid.coords(i);
        this.particles.burst(x, y, z, [BASE[0] * 0.95, BASE[1] * 0.95, BASE[2] * 0.95], store.settings.reducedMotion ? 3 : 9);
        sfx.break();
        haptic(6);
        st.count++;
        this.opts.hooks?.event('action');
        return true;
      }
      if (r === 'mistake') {
        this.shake[i] = 0.35;
        this.flash[i] = 0.6;
        sfx.mistake();
        haptic([30, 40, 30]);
        st.stopped = true;
        this.refreshHud();
        this.opts.hooks?.event('action');
        if (s.strikesLeft <= 0) setTimeout(() => this.outOfStrikes(), 350);
        else toast(`Oops — that cube belongs to the shape! (${s.strikes}/${MAX_STRIKES})`, 'bad');
        return false;
      }
      if (r === 'protected') {
        if (first) {
          this.shake[i] = 0.25;
          sfx.clonk();
        }
        st.stopped = true;
        return false;
      }
      return true;
    }
    const on = st.mode === 'paint';
    if (s.paintCell(i, on)) {
      if (on) sfx.paint();
      else sfx.unpaint();
      haptic(4);
      st.count++;
      this.opts.hooks?.event('action');
    }
    return true;
  }

  private afterChange(): void {
    this.refreshHud();
    this.renderFocus();
    this.persist();
    if (this.session.solved && this.solvedAt < 0) this.onSolved();
  }

  private persist(immediate = false): void {
    const key = this.opts.saveKey;
    if (!key || this.session.solved) return;
    store.progress[key] = this.session.serialize();
    save(immediate);
  }

  undo(): void {
    const changed = this.session.undo();
    if (changed.length) {
      sfx.tick();
      this.opts.hooks?.event('undo');
    }
    this.afterChange();
  }

  redo(): void {
    if (this.session.redo().length) sfx.tick();
    this.afterChange();
  }

  private clearHint(): void {
    if (!this.hintInfo) return;
    this.hintInfo = null;
    this.highlightLines = [];
    this.highlightCells.clear();
    this.ui.hintMsg.classList.remove('show');
  }

  showHint(): void {
    const s = this.session;
    if (s.solved) return;
    const hint = findHint(s, this.hover);
    if (!hint) return;
    if (hint.kind !== 'mistake') s.hints++;
    this.hintInfo = hint;
    this.highlightLines = hint.line !== undefined ? [hint.line] : [];
    this.highlightCells = new Set([...hint.breakCells, ...hint.paintCells]);
    this.ui.hintMsg.textContent = hint.message;
    this.ui.hintMsg.classList.add('show');
    // make sure the hinted cells are visible
    if ([...this.highlightCells].some((i) => !this.visible(i))) this.setPeel(0);
    sfx.hint();
    this.opts.hooks?.event('hint');
    this.persist();
  }

  private worldOf(c: readonly number[]): Vec3 {
    const [W, H, D] = this.session.grid.dims;
    return [c[0] - (W - 1) / 2, c[1] - (H - 1) / 2, c[2] - (D - 1) / 2];
  }

  // ---------------------------------------------------------------- completion

  private onSolved(): void {
    const s = this.session;
    this.solvedAt = this.time;
    this.revealT = 0;
    this.setHover(-1);
    this.clearHint();
    this.setPeel(0);
    this.el.classList.add('solved');
    this.ui.name.textContent = s.def.name;
    sfx.win();
    haptic([20, 60, 20, 60, 40]);
    const [W, H, D] = s.grid.dims;
    const colors = s.def.palette.map(hexToRgb);
    if (!store.settings.reducedMotion)
      for (let k = 0; k < 6; k++) this.particles.burst((Math.random() - 0.5) * W + (W - 1) / 2, H - 1, (Math.random() - 0.5) * D + (D - 1) / 2, colors[k % colors.length], 8, 1.4);
    this.app.camera.autoSpin = store.settings.reducedMotion ? 0 : 0.35;
    if (this.opts.saveKey) recordSolve(this.opts.saveKey, s.stars(), s.elapsed);
    this.opts.hooks?.event('solved');
    this.refreshHud();
  }

  private showSolvedCard(): void {
    this.cardShown = true;
    if (this.opts.hooks?.onSolved?.()) return;
    const s = this.session;
    const stars = s.stars();
    const rec = this.opts.saveKey ? store.records[this.opts.saveKey] : undefined;
    const card = h('div', { class: 'solved-card' },
      h('div', { class: 'eyebrow' }, 'Solved!'),
      h('h2', null, s.def.name),
      h('div', { class: 'stars', 'aria-label': `${stars} of 3 stars` }, ...[1, 2, 3].map((k) => icon(k <= stars ? I.star : I.starOutline, k <= stars ? 'on' : ''))),
      h('div', { class: 'solved-stats' },
        h('div', null, h('b', null, formatTime(s.elapsed)), h('span', null, 'time')),
        h('div', null, h('b', null, String(s.mode === 'classic' ? s.strikes : '–')), h('span', null, 'mistakes')),
        h('div', null, h('b', null, String(s.hints)), h('span', null, 'hints')),
        rec ? h('div', null, h('b', null, formatTime(rec.bestTime)), h('span', null, 'best')) : null,
      ),
      h('div', { class: 'row' },
        button('Back', () => this.leave(), 'ghost'),
        this.opts.onNext ? button('Next puzzle', () => this.opts.onNext!(), 'primary', I.arrowRight) : null,
      ),
    );
    this.el.append(card);
    requestAnimationFrame(() => card.classList.add('in'));
  }

  private async outOfStrikes(): Promise<void> {
    if (this.outOfStrikesShown) return;
    this.outOfStrikesShown = true;
    const r = await modal({
      title: 'Out of chances',
      body: `That's ${MAX_STRIKES} mistakes. Start over, or keep going without a limit (max 1 star).`,
      actions: [{ label: 'Keep going', value: 'go' }, { label: 'Restart', value: 'restart', cls: 'primary' }],
      dismissable: false,
    });
    if (r === 'restart') {
      this.session.restart();
      this.paintT.fill(0);
      this.outOfStrikesShown = false;
    } else {
      this.session.noStrikeLimit = true;
    }
    this.persist();
    this.refreshHud();
  }

  onKey(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if (mod && k === 'y') {
      e.preventDefault();
      this.redo();
    } else if (mod) return;
    else if (k === 'b' || k === '1') this.setTool('break');
    else if (k === 'p' || k === '2') this.setTool('paint');
    else if (k === ' ') {
      e.preventDefault();
      this.setTool(this.tool === 'break' ? 'paint' : 'break');
    } else if (k === 'h') this.showHint();
    else if (k === 'r') this.resetView();
    else if (k === 'arrowleft') this.app.camera.turn(-1);
    else if (k === 'arrowright') this.app.camera.turn(1);
    else if (k === 'arrowup') this.app.camera.snapTo(this.app.camera.yaw, clamp(this.app.camera.pitch + 0.4, -1.4, 1.4), 0.25);
    else if (k === 'arrowdown') this.app.camera.snapTo(this.app.camera.yaw, clamp(this.app.camera.pitch - 0.4, -1.4, 1.4), 0.25);
    else if (k === ']') this.setPeel(this.slice.peel + 1);
    else if (k === '[') this.setPeel(this.slice.peel - 1);
    else if (k === 'x') this.setSliceAxis(0);
    else if (k === 'y') this.setSliceAxis(1);
    else if (k === 'z') this.setSliceAxis(2);
    else if (k === 'escape') this.leave();
    else return;
  }

  exit(): void {
    this.persist(true);
    this.opts.hooks?.detach?.();
    this.offSettings();
  }
}
