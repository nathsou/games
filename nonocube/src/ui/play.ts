import type { App, Screen } from '../app.ts';
import { ambient } from '../audio/ambient.ts';
import { haptic, sfx, unlockAudio } from '../audio/sfx.ts';
import { clueCount, clueKind, describeClue, CIRCLE, SQUARE } from '../core/clues.ts';
import type { Axis } from '../core/grid.ts';
import type { Collection, PuzzleDef } from '../core/types.ts';
import { BROKEN, findHint, MAX_STRIKES, PAINTED, PlaySession, type Hint } from '../game/session.ts';
import { firstTime, onSettingsChange, recordSolve, save, store } from '../game/storage.ts';
import { GLYPH_NONE } from '../render/atlas.ts';
import { DEFAULT_PITCH, DEFAULT_YAW } from '../render/camera.ts';
import { clamp, damp, hexToRgb, type Vec3 } from '../render/math.ts';
import { pickVoxel } from '../render/pick.ts';
import { boxEdges, type DrawList, type LineBatch } from '../render/renderer.ts';
import { BlockScene, FLAG_GLOW, FLAG_HOVER, FLAG_STRIPES, packGlyphs, Particles } from '../render/scene.ts';
import { CURSORS } from './cursors.ts';
import { button, formatTime, h, icon, iconButton, modal, toast } from './dom.ts';
import type { GestureTarget } from './gestures.ts';
import { I } from './icons.ts';
import { openSettings } from './settings.ts';
import { AXIS_COLORS, AXIS_NAMES, Slicer } from './slicer.ts';
import { FINE_POINTER, keyLabel, ToolKeys } from './toolkeys.ts';
import { layerColor, sceneColors, themeFor } from './theme.ts';

export { AXIS_COLORS, AXIS_NAMES };
export type Tool = 'break' | 'paint';

export const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

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

const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

export class PlayScreen implements Screen {
  readonly el: HTMLElement;
  readonly session: PlaySession;
  readonly opts: PlayOptions;
  readonly app: App;
  readonly gestures: GestureTarget;
  readonly slicer: Slicer;
  readonly theme: string;
  /** Tool locked on from the dock (null = clicks rotate the block). */
  tool: Tool | null = null;
  /** Shift is held: a locked tool is temporarily swapped for the other one. */
  private altHeld = false;
  /** Tools held down with the keyboard: A = hammer, D = brush. */
  private keys = new ToolKeys<Tool>({}, () => this.syncTool());
  private orbitFrom: { x: number; y: number; dist: number } | null = null;
  /** Focus mode: HUD fades while you work on the block and returns near the screen edges. */
  private pointer = { x: -1, y: -1, t: 0 };
  private hudHidden = false;
  private onDocPointer = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    this.pointer = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  private nudgeAt = -1e9;
  private nudges = 0;
  /** Lines to pulse (hints / tutorial). */
  highlightLines: number[] = [];
  highlightCells = new Set<number>();
  readonly ui: Record<string, HTMLElement> = {};

  private scene = new BlockScene();
  private clueScene = new BlockScene();
  private particles = new Particles();
  private hover = -1;
  private hoverLift = 0;
  private stroke: Stroke | null = null;
  private orbiting = false;
  private paintT: Float32Array;
  private shake: Float32Array;
  private flash: Float32Array;
  /** Per-line "just finished" pulse timers. */
  private lineFlash = new Map<number, number>();
  private prevDone: Uint8Array;
  /** Cubes waiting to be broken by the "clear zeros" cascade. */
  private sweep: { i: number; at: number }[] = [];
  private sweepClock = 0;
  private introT = 0;
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
    this.theme = themeFor(opts.collection?.id);
    if (opts.saveKey && store.progress[opts.saveKey]) this.session.restore(store.progress[opts.saveKey]);
    const n = this.session.grid.size;
    this.paintT = new Float32Array(n);
    this.shake = new Float32Array(n);
    this.flash = new Float32Array(n);
    this.prevDone = this.session.lineDone.slice();
    for (let i = 0; i < n; i++) this.paintT[i] = this.session.state[i] === PAINTED ? 1 : 0;
    this.slicer = new Slicer(app.camera, () => this.session.grid.dims, () => {
      this.opts.hooks?.event('slice');
      this.refreshHud();
    });
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
      (this.ui.name = h('div', { class: 'puzzle-name' }, s.solved ? p.name : '???', h('span', { class: 'dims' }, p.dims.join('×')))),
    );
    this.ui.timer = h('div', { class: 'stat timer', 'data-tip': 'Time', 'data-tip-pos': 'below' }, formatTime(s.elapsed));
    this.ui.strikes = h('div', { class: 'stat lives', 'data-tip-pos': 'below' });
    this.ui.progress = h('div', { class: 'progress' }, h('div', { class: 'progress-fill' }));

    const below = (b: HTMLElement) => ((b.dataset.tipPos = 'below'), b);
    const top = h('header', { class: 'topbar' },
      below(iconButton(I.back, 'Back', () => this.leave())),
      title,
      h('div', { class: 'spacer' }),
      (this.ui.status = h('div', { class: 'status-chip' }, this.ui.timer, this.ui.strikes)),
      below(iconButton(I.help, 'How to play', () => void this.showRules(), '', '?')),
      below(iconButton(I.restart, 'Restart puzzle', () => void this.confirmRestart(), 'hide-sm')),
      below(iconButton(I.gear, 'Settings', () => void openSettings(this.app))),
      this.ui.progress,
    );

    // tool dock
    this.ui.hammer = h('button', { class: 'tool', 'aria-pressed': 'false', onclick: () => this.setTool('break') }, icon(I.hammer), h('span', null, 'Break'), h('kbd', { class: 'key-hint' }));
    this.ui.brush = h('button', { class: 'tool', 'aria-pressed': 'false', onclick: () => this.setTool('paint') }, icon(I.brush), h('span', null, 'Paint'), h('kbd', { class: 'key-hint' }));
    this.ui.undo = button('Undo', () => this.undo(), '', I.undo);
    this.ui.undo.dataset.tip = `Undo (${MOD}+Z)`;
    this.ui.redo = iconButton(I.redo, 'Redo', () => this.redo(), '', `${MOD} ⇧ Z`);
    this.ui.zero = button('Clear 0s', () => this.clearZeros());
    this.ui.zero.dataset.key = '0';
    this.ui.hint = button('Hint', () => this.showHint(), '', I.bulb);
    this.ui.hint.dataset.key = 'H';
    this.ui.tools = h('div', { class: 'toolswitch', role: 'group', 'aria-label': 'Tool' }, this.ui.hammer, this.ui.brush);
    this.ui.dock = h('div', { class: 'dock' }, iconButton(I.rotL, 'Turn left', () => this.app.camera.turn(-1)), iconButton(I.rotR, 'Turn right', () => this.app.camera.turn(1)), this.ui.tools, h('div', { class: 'dock-actions' }, this.ui.undo, this.ui.redo, this.ui.zero, this.ui.hint));

    this.ui.slice = this.slicer.pill;
    this.ui.knobs = this.slicer.knobLayer;
    this.ui.view = h('div', { class: 'pill viewpad' },
      iconButton(I.rotL, 'Turn left', () => this.app.camera.turn(-1), '', '←'),
      iconButton(I.target, 'Reset view', () => this.resetView(), '', 'R'),
      iconButton(I.rotR, 'Turn right', () => this.app.camera.turn(1), '', '→'),
    );

    this.ui.focus = h('div', { class: 'focus', 'aria-live': 'polite' });
    this.ui.hintMsg = h('div', { class: 'hint-msg', 'aria-live': 'polite' });
    this.ui.legend = h('div', { class: 'clue-legend' }, ...[['', 'one group'], ['circle', '2 groups'], ['square', '3+ groups']].map(([cls, label]) => h('div', null, h('span', { class: `clue ${cls}` }, '3'), label)), h('small', null, 'Drag to turn the block'));

    return h('div', { class: 'play' }, this.ui.knobs, top, this.ui.focus, this.ui.hintMsg, this.ui.legend,
      h('footer', { class: 'bottom' }, this.ui.slice, this.ui.dock, this.ui.view));
  }

  /** Apply the player's key bindings to the held-key map and the dock hints. */
  private applyKeys(): void {
    const k = store.settings.keys;
    this.keys.setMap({ [k.break]: 'break', [k.paint]: 'paint' });
    const set = (btn: HTMLElement, key: string, what: string, name: string) => {
      const label = keyLabel(key);
      btn.setAttribute('aria-label', `${name} (hold ${label})`);
      btn.dataset.tip = FINE_POINTER ? `${what} — hold ${label} while clicking, or click here to keep it on` : `${what} — tap to turn on, tap again to go back to rotating`;
      btn.dataset.key = label;
      btn.querySelector('.key-hint')!.textContent = label;
    };
    set(this.ui.hammer, k.break, 'Break cubes that aren’t part of the shape', 'Hammer');
    set(this.ui.brush, k.paint, 'Paint cubes you know stay (protects them)', 'Brush');
  }

  private applySettings(): void {
    this.applyKeys();
    this.session.mode = store.settings.mistakeMode;
    this.session.warnWrongBreaks = store.settings.warnWrongBreaks;
    this.el.classList.toggle('lefty', store.settings.lefty);
    this.ui.timer.style.display = store.settings.showTimer ? '' : 'none';
    this.refreshHud();
  }

  refreshHud(): void {
    const s = this.session;
    this.ui.undo.toggleAttribute('disabled', !s.canUndo);
    this.ui.redo.toggleAttribute('disabled', !s.canRedo);
    const zeros = s.solved ? 0 : s.zeroCells().length + this.sweep.length;
    this.ui.zero.toggleAttribute('disabled', s.solved || this.sweep.length > 0);
    this.ui.zero.dataset.tip = zeros ? `Clear every row marked 0 (${zeros} cube${zeros === 1 ? '' : 's'})` : 'No zero rows left to clear';
    const classic = s.mode === 'classic' && !s.noStrikeLimit;
    this.ui.strikes.style.display = classic ? '' : 'none';
    if (classic) {
      const left = MAX_STRIKES - s.strikes;
      this.ui.strikes.replaceChildren(...Array.from({ length: MAX_STRIKES }, (_, k) => icon(k < left ? I.heart : I.heartOutline, k < left ? 'on' : '')));
      this.ui.strikes.dataset.tip = `${left} of ${MAX_STRIKES} lives left — breaking a cube of the shape costs one`;
      this.ui.strikes.setAttribute('aria-label', `${left} lives left`);
    }
    (this.ui.progress.firstChild as HTMLElement).style.width = `${Math.round(s.progress * 100)}%`;
  }

  /** The tool a click would use right now: a held key wins, then the locked tool (Shift swaps it). */
  get activeTool(): Tool | null {
    const held = this.keys.current;
    if (held) return held;
    if (!this.tool) return null;
    return this.altHeld ? (this.tool === 'break' ? 'paint' : 'break') : this.tool;
  }

  /** Lock a tool on from the dock; picking the locked tool again goes back to rotating. */
  setTool(t: Tool | null): void {
    this.tool = this.tool === t ? null : t;
    this.syncTool();
    sfx.tick();
    this.opts.hooks?.event('tool');
  }

  private syncTool(): void {
    const t = this.activeTool;
    this.ui.hammer.classList.toggle('active', t === 'break');
    this.ui.brush.classList.toggle('active', t === 'paint');
    this.ui.hammer.setAttribute('aria-pressed', String(this.tool === 'break'));
    this.ui.brush.setAttribute('aria-pressed', String(this.tool === 'paint'));
    this.ui.tools.classList.toggle('temporary', t !== null && t !== this.tool);
    this.el.classList.toggle('painting', t === 'paint');
    this.el.classList.toggle('rotate-mode', t === null);
    this.updateCursor();
  }

  /** Gently point at the tools when someone clicks a cube with no tool active. */
  private nudge(): void {
    this.ui.tools.classList.remove('nudge');
    void this.ui.tools.offsetWidth;
    this.ui.tools.classList.add('nudge');
    const now = performance.now();
    if (this.nudges < 3 && now - this.nudgeAt > 15000) {
      this.nudges++;
      this.nudgeAt = now;
      toast(FINE_POINTER ? `Hold ${keyLabel(store.settings.keys.break)} to break or ${keyLabel(store.settings.keys.paint)} to paint — or pick a tool below` : 'Pick the hammer or brush below to act on cubes', 'info', 3000);
    }
  }

  private setAltHeld(on: boolean): void {
    if (this.altHeld === on) return;
    this.altHeld = on;
    this.syncTool();
  }

  private resetView(): void {
    this.app.camera.snapTo(DEFAULT_YAW, DEFAULT_PITCH);
    this.app.camera.resetZoom();
  }

  private updateCursor(): void {
    const c = this.app.canvas.style;
    if (this.orbiting) c.cursor = 'grabbing';
    else if (this.session.solved) c.cursor = 'grab';
    else if (this.hover >= 0 && this.activeTool) c.cursor = this.activeTool === 'break' ? CURSORS.hammer : CURSORS.brush;
    else c.cursor = 'grab';
  }

  private async confirmRestart(): Promise<void> {
    const r = await modal({ title: 'Restart puzzle?', body: 'Your progress on this puzzle will be cleared.', actions: [{ label: 'Cancel', value: 'no' }, { label: 'Restart', value: 'yes', cls: 'danger' }] });
    if (r !== 'yes') return;
    this.flushSweep();
    this.session.restart();
    this.paintT.fill(0);
    this.prevDone = this.session.lineDone.slice();
    this.revealT = 0;
    this.solvedAt = -1;
    this.cardShown = false;
    this.outOfStrikesShown = false;
    this.introT = 0;
    this.el.querySelector('.solved-card')?.remove();
    this.el.classList.remove('solved');
    this.ui.name.firstChild!.textContent = '???';
    this.app.camera.autoSpin = 0;
    this.persist();
    this.refreshHud();
  }

  private async showRules(): Promise<void> {
    const ex = (n: number, kind: string, text: string, pattern: string) =>
      h('div', { class: 'rule' },
        h('span', { class: `clue ${kind}` }, String(n)),
        h('div', null, h('b', null, text), h('div', { class: 'pattern' }, ...[...pattern].map((c) => h('i', { class: c === '#' ? 'on' : '' })))));
    const body = h('div', { class: 'rules' },
      h('p', null, 'Each number counts the cubes of the hidden shape in the row running straight through that face. Break every cube that isn’t part of the shape.'),
      ex(3, '', 'Plain: one unbroken group', '.###.'),
      ex(3, 'circle', 'Circled: exactly 2 groups', '##.#.'),
      ex(3, 'square', 'Squared: 3 groups or more', '#.#.#'),
      h('p', { class: 'muted' }, 'Blank faces give no information. Rows marked 0 are empty — the ', h('b', null, 'clear zeros'), ' button removes them all at once.'),
      h('div', { class: 'controls-grid' },
        ...[
          ['Break', FINE_POINTER ? `Hold ${keyLabel(store.settings.keys.break)} + click` : 'Hammer on, tap'],
          ['Paint', FINE_POINTER ? `Hold ${keyLabel(store.settings.keys.paint)} + click` : 'Brush on, tap'],
          ['Whole row', 'Drag along it with a tool'],
          ['Turn', 'Drag with no tool · two fingers'],
          ['Lock a tool', 'Click it in the dock (Esc to release)'],
          ['Peel layers', 'Drag the knobs · slider'],
          ['Hint', 'H · lightbulb'],
        ].map(([a, b]) => h('div', null, h('b', null, a), h('span', null, b))),
      ),
    );
    await modal({ title: 'How to play', body, actions: [{ label: 'Got it', value: 'ok', cls: 'primary' }], cls: 'wide' });
  }

  /** Leave the puzzle (back button). */
  leave(): void {
    this.flushSweep();
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
    this.introT = store.settings.reducedMotion ? 10 : 0;
    document.addEventListener('pointermove', this.onDocPointer);
    document.body.classList.add('in-play');
    ambient.start();
    this.opts.hooks?.attach(this);
    if (this.session.solved) {
      this.revealT = 1;
      this.solvedAt = 0;
      this.el.classList.add('solved');
    }
    this.refreshHud();
    this.syncTool();
    if (!this.opts.hooks && this.session.zeroCells().length > 3 && firstTime('clear-zeros'))
      setTimeout(() => toast('Tip: Clear 0s clears every row marked 0 in one go', 'info', 4200), 1400);
  }

  /** Decide whether the HUD should step back (mouse only, while working on the block). */
  private updateFocusMode(): void {
    let hide = false;
    if (store.settings.autoHideHud && FINE_POINTER && !this.session.solved && !this.opts.hooks && this.pointer.x >= 0 && !document.querySelector('.modal-back')) {
      const top = (this.el.querySelector('.topbar') as HTMLElement).getBoundingClientRect().bottom + 50;
      let bottom = Infinity;
      for (const el of this.el.querySelectorAll<HTMLElement>('.bottom > *')) if (el.offsetParent) bottom = Math.min(bottom, el.getBoundingClientRect().top - 50);
      const nearEdge = this.pointer.y < top || this.pointer.y > bottom;
      const busy = !!this.stroke || this.orbiting;
      const idle = performance.now() - this.pointer.t > 1600;
      hide = !nearEdge && (busy || idle || this.hover >= 0);
    }
    if (hide !== this.hudHidden) {
      this.hudHidden = hide;
      this.el.classList.toggle('hud-hidden', hide);
    }
  }

  update(dt: number, time: number): void {
    this.time = time;
    this.introT += dt;
    this.updateFocusMode();
    document.body.style.setProperty('--progress', this.session.solved ? '1' : this.session.progress.toFixed(3));
    const s = this.session;
    const cam = this.app.camera;
    // keep the model clear of the HUD (refit every frame: the viewport may change)
    let top = 0;
    let bottom = cam.height;
    for (const el of this.el.querySelectorAll<HTMLElement>('.topbar, .tutorial-card')) top = Math.max(top, el.offsetTop + el.offsetHeight);
    // measure the (untransformed) containers so HUD fades don't shift the framing
    const dock = this.el.querySelector('.bottom') as HTMLElement;
    if (dock.offsetHeight) bottom = Math.min(bottom, dock.getBoundingClientRect().top);
    const card = this.el.querySelector('.solved-card.in') as HTMLElement | null;
    if (card) bottom = Math.min(bottom, card.getBoundingClientRect().top);
    // leave room for the slicer knobs around the block
    const knobRoom = this.slicer.pill.offsetParent ? 8 : 44;
    cam.frame(top + knobRoom, knobRoom, cam.height - bottom + knobRoom, knobRoom, this.firstFrame ? 0 : dt);
    cam.fit(s.grid.dims);
    this.firstFrame = false;
    this.slicer.update(!s.solved);

    if (!s.solved && document.visibilityState === 'visible' && !document.querySelector('.modal-back') && !this.opts.hooks) {
      s.elapsed += dt;
      this.ui.timer.textContent = formatTime(s.elapsed);
    }
    this.runSweep(dt);
    this.particles.update(dt);
    this.hoverLift += ((this.hover >= 0 ? 1 : 0) - this.hoverLift) * damp(22, dt);
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
    for (const [l, t] of this.lineFlash) {
      if (t - dt <= 0) this.lineFlash.delete(l);
      else this.lineFlash.set(l, t - dt);
    }
    if (s.solved && this.solvedAt >= 0) {
      this.revealT = Math.min(1, this.revealT + dt / 2);
      if (this.time - this.solvedAt > 1.7 && !this.cardShown) this.showSolvedCard();
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
    const fade = store.settings.greyDone;
    const intro = this.introT < 1.5;
    const BASE = sceneColors.cube;
    const PAINT = sceneColors.paint;
    const H = g.H;

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
      let popScale = 1;
      if (!revealing) {
        if (hoverLines.length && i !== this.hover && (lx === hoverLines[0] || ly === hoverLines[1] || lz === hoverLines[2]))
          for (let c = 0; c < 3; c++) col[c] += (sceneColors.wash[c] - col[c]) * sceneColors.washAmt;
        if (i === this.hover) flags |= FLAG_HOVER;
        if (hl.has(lx) || hl.has(ly) || hl.has(lz) || this.highlightCells.has(i)) flags |= FLAG_GLOW;
        const lf = Math.max(this.lineFlash.get(lx) ?? 0, this.lineFlash.get(ly) ?? 0, this.lineFlash.get(lz) ?? 0);
        if (lf > 0) for (let c = 0; c < 3; c++) col[c] += (sceneColors.accent[c] * 0.5 + 0.5 - col[c]) * lf * 0.9;
        const f = this.flash[i];
        if (f > 0) for (let c = 0; c < 3; c++) col[c] += (RED[c] - col[c]) * Math.min(1, f * 2);
      } else {
        // cubes take their true colors one by one, bottom to top, with a little pop
        const delay = (y / Math.max(1, H)) * 0.55 + (((i * 7919) % 97) / 97) * 0.25;
        const t = clamp((this.revealT * 1.8 - delay) / 0.45, 0, 1);
        const sc = layerColor(y, H);
        const e = t * t * (3 - 2 * t);
        for (let c = 0; c < 3; c++) col[c] += (sc[c] - col[c]) * e;
        popScale = 1 + 0.14 * Math.sin(Math.PI * t);
      }
      const packed = packGlyphs(GLYPH_NONE, GLYPH_NONE, GLYPH_NONE) | flags;
      let ox = 0;
      if (this.shake[i] > 0) ox = Math.sin(this.time * 70) * 0.09 * (this.shake[i] / 0.35);
      let scale = revealing ? popScale : 1 - 0.04 * Math.max(0, 1 - Math.abs(pt - 0.5) * 2);
      // the hovered cube lifts slightly toward you
      if (i === this.hover && !revealing) scale *= 1 + 0.06 * this.hoverLift;
      let oy = 0;
      if (intro) {
        // the block assembles from the bottom up
        const delay = (y / Math.max(1, H)) * 0.55 + ((i * 7919) % 97) / 97 * 0.2;
        const t = clamp((this.introT - delay) / 0.45, 0, 1);
        scale *= t <= 0 ? 0 : easeOutBack(t);
        oy = (1 - t) * 1.2;
        if (t <= 0) continue;
      }
      scene.add(x + ox, y + oy, z, scale, col, packed);
    }
    scene.computeAO();
    scene.glyphAlpha = clamp(1 - rt * 2.2, 0, 1);

    const clues = this.clueScene;
    clues.reset(g.dims);
    const min = [0, 0, 0];
    const max = g.dims.map((n) => n - 1);
    if (this.slicer.peel) {
      if (this.slicer.sign > 0) max[this.slicer.axis] -= this.slicer.peel;
      else min[this.slicer.axis] += this.slicer.peel;
    }
    if (!revealing && !intro) for (let i = 0; i < g.size; i++) {
      if (!this.visible(i)) continue;
      const xyz = g.coords(i);
      const glyphs = [0, 1, 2].map((axis) => {
        const l = g.cellLines[i * 3 + axis];
        return s.mask[l] && (xyz[axis] === min[axis] || xyz[axis] === max[axis]) ? s.clues[l] : GLYPH_NONE;
      });
      if (glyphs.every((v) => v === GLYPH_NONE)) continue;
      const done = [0, 1, 2].map((axis) => fade && s.lineDone[g.cellLines[i * 3 + axis]] === 1);
      clues.add(xyz[0], xyz[1], xyz[2], 1.004, BASE, packGlyphs(glyphs[0], glyphs[1], glyphs[2], done[0], done[1], done[2]));
    }
    const lines: LineBatch[] = [];
    const [W, , D] = g.dims;
    if (!revealing) {
      lines.push({ points: boxEdges([-W / 2, -H / 2, -D / 2], [W / 2, H / 2, D / 2]), color: [...sceneColors.ink, 0.22] });
      lines.push(...this.slicer.lines(!this.slicer.pill.offsetParent));
    }
    return { block: scene, clues: { scene: clues, min, max }, particles: this.particles, lines, shadow: { dims: g.dims, alpha: 0.22 }, time: this.time, ink: sceneColors.ink, greyDone: store.settings.greyDone, cut: revealing ? null : this.slicer.cap() };
  }

  visible(i: number): boolean {
    if (!this.slicer.peel) return true;
    const [x, y, z] = this.session.grid.coords(i);
    return this.slicer.visible(x, y, z);
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
      hitTest: (x, y) => !this.session.solved && this.activeTool !== null && !!this.pickCell(x, y),
      strokeStart: (x, y, alt) => {
        unlockAudio();
        this.beginStroke(x, y, alt);
      },
      strokeMove: (x, y) => this.moveStroke(x, y),
      strokeEnd: () => this.endStroke(),
      hover: (x, y) => this.setHover(this.pickCell(x, y)?.i ?? -1),
      hoverEnd: () => this.setHover(-1),
      touchFocus: (x, y) => this.setHover(y === null ? -1 : (this.pickCell(x, y)?.i ?? -1)),
      orbitStart: (x, y) => {
        unlockAudio();
        this.orbitFrom = { x, y, dist: 0 };
        cam.beginDrag();
        this.orbiting = true;
        this.setHover(-1);
        this.updateCursor();
      },
      orbit: (dx, dy, dt) => {
        cam.orbit(dx, dy, dt);
        if (this.orbitFrom) this.orbitFrom.dist += Math.abs(dx) + Math.abs(dy);
        this.orbitAccum += Math.abs(dx) + Math.abs(dy);
        if (this.orbitAccum > 120) {
          this.orbitAccum = 0;
          this.opts.hooks?.event('orbit');
        }
      },
      orbitEnd: () => {
        cam.endDrag();
        this.orbiting = false;
        // a click on a cube with no tool active: show how to act on cubes
        const o = this.orbitFrom;
        this.orbitFrom = null;
        if (o && o.dist < 4 && o.x >= 0 && !this.session.solved && !this.activeTool && this.pickCell(o.x, o.y)) this.nudge();
        this.updateCursor();
      },
      zoom: (f) => {
        cam.zoomBy(f);
        this.opts.hooks?.event('zoom');
      },
    };
  }

  private setHover(i: number): void {
    if (i === this.hover) return;
    this.hover = i;
    this.hoverLift = 0;
    this.renderFocus();
    this.updateCursor();
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
      return h('div', { class: `clue-chip ${done ? 'done' : ''}`, style: `--axis:${AXIS_COLORS[a]}` },
        h('span', { class: 'axis-dot' }, AXIS_NAMES[a]),
        visible
          ? h('span', { class: `clue ${kind === CIRCLE ? 'circle' : kind === SQUARE ? 'square' : ''}` }, String(clueCount(c)))
          : h('span', { class: 'clue none' }, '–'),
        h('span', { class: 'clue-desc' }, visible ? describeClue(c) : 'no clue'),
      );
    });
    this.ui.focus.replaceChildren(...chips);
    this.ui.focus.classList.add('show');
  }

  private beginStroke(x: number, y: number, alt: boolean): void {
    const p = this.pickCell(x, y);
    if (!p || this.session.solved) return;
    this.flushSweep();
    let tool = this.activeTool;
    if (!tool) return;
    // long-press (touch) or a modifier other than Shift swaps the tool for this stroke
    if (alt && !this.altHeld && !this.keys.current) tool = tool === 'break' ? 'paint' : 'break';
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

  private breakFx(i: number): void {
    const [x, y, z] = this.session.grid.coords(i);
    const base = sceneColors.cube;
    const few = store.settings.reducedMotion;
    this.particles.burst(x, y, z, [base[0] * 0.95, base[1] * 0.95, base[2] * 0.95], few ? 3 : 7);
    if (!few) this.particles.burst(x, y, z, [...sceneColors.accent] as [number, number, number], 3);
    sfx.break();
  }

  /** Apply the current stroke's action to a cell. Returns false when the stroke should stop. */
  private applyCell(i: number, first: boolean): boolean {
    const st = this.stroke!;
    const s = this.session;
    if (st.mode === 'break') {
      const r = s.breakCell(i);
      if (r === 'ok') {
        this.breakFx(i);
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
        this.ui.strikes.classList.remove('hurt');
        void this.ui.strikes.offsetWidth;
        this.ui.strikes.classList.add('hurt');
        this.opts.hooks?.event('action');
        if (s.strikesLeft <= 0) setTimeout(() => this.outOfStrikes(), 350);
        else toast(`That cube is part of the shape — ${s.strikesLeft} ${s.strikesLeft === 1 ? 'life' : 'lives'} left`, 'bad');
        return false;
      }
      if (r === 'warned') {
        this.shake[i] = 0.35;
        this.flash[i] = 0.6;
        sfx.clonk();
        haptic([20, 30, 20]);
        st.stopped = true;
        toast('Careful — that cube is part of the shape', 'bad');
        return false;
      }
      if (r === 'protected') {
        if (first) {
          toast('Painted cubes are protected. Tap to unpaint first.');
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

  /** Break every cube on rows marked 0, as a quick top-down cascade (one undo step). */
  clearZeros(): void {
    const s = this.session;
    if (s.solved || this.sweep.length) return;
    const cells = s.zeroCells();
    if (!cells.length) { toast('No zero rows left to clear'); return; }
    toast(`Cleared ${cells.length} cubes`);
    unlockAudio();
    this.clearHint();
    const g = s.grid;
    cells.sort((a, b) => {
      const [ax, ay, az] = g.coords(a);
      const [bx, by, bz] = g.coords(b);
      return by - ay || ax + az - (bx + bz);
    });
    const gap = Math.min(0.03, 0.7 / cells.length);
    s.beginGroup();
    this.sweepClock = 0;
    this.sweep = cells.map((i, k) => ({ i, at: store.settings.reducedMotion ? 0 : k * gap }));
    this.refreshHud();
  }

  private runSweep(dt: number): void {
    if (!this.sweep.length) return;
    this.sweepClock += dt;
    let n = 0;
    while (n < this.sweep.length && this.sweep[n].at <= this.sweepClock) {
      const i = this.sweep[n].i;
      if (this.session.breakCell(i) === 'ok') this.breakFx(i);
      n++;
    }
    if (n) this.sweep.splice(0, n);
    if (!this.sweep.length) {
      this.session.endGroup();
      haptic(12);
      this.opts.hooks?.event('action');
      this.afterChange();
    }
  }

  /** Finish a running cascade immediately (before any other action). */
  private flushSweep(): void {
    if (!this.sweep.length) return;
    this.sweepClock = Infinity;
    this.runSweep(0);
  }

  private afterChange(): void {
    const s = this.session;
    if (s.canUndo) this.ui.legend.hidden = true;
    // pulse rows that just became finished
    let newlyDone = 0;
    for (let l = 0; l < s.grid.lineCount; l++) {
      if (s.lineDone[l] && !this.prevDone[l] && s.mask[l] && s.clues[l] !== 0) {
        this.lineFlash.set(l, 0.45);
        newlyDone++;
      }
    }
    this.prevDone = s.lineDone.slice();
    if (newlyDone && !s.solved) sfx.rowDone();
    this.refreshHud();
    this.renderFocus();
    this.persist();
    if (s.solved && this.solvedAt < 0) this.onSolved();
  }

  private persist(immediate = false): void {
    const key = this.opts.saveKey;
    if (!key || this.session.solved) return;
    store.progress[key] = this.session.serialize();
    save(immediate);
  }

  undo(): void {
    this.flushSweep();
    const changed = this.session.undo();
    if (changed.length) {
      sfx.tick();
      this.opts.hooks?.event('undo');
    }
    this.afterChange();
  }

  redo(): void {
    this.flushSweep();
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
    this.flushSweep();
    const hint = findHint(s, this.hover);
    if (!hint) return;
    if (hint.kind !== 'mistake') s.hints++;
    this.hintInfo = hint;
    this.highlightLines = hint.line !== undefined ? [hint.line] : [];
    this.highlightCells = new Set([...hint.breakCells, ...hint.paintCells]);
    this.ui.hintMsg.textContent = hint.message;
    this.ui.hintMsg.classList.add('show');
    // make sure the hinted cells are visible
    if ([...this.highlightCells].some((i) => !this.visible(i))) this.slicer.reset();
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
    this.slicer.reset();
    this.el.classList.add('solved');
    this.ui.name.firstChild!.textContent = s.def.name;
    this.updateCursor();
    sfx.win();
    haptic([20, 60, 20, 60, 40]);
    const [W, H, D] = s.grid.dims;
    const colors = s.def.palette.map(hexToRgb);
    if (!store.settings.reducedMotion)
      for (let k = 0; k < 6; k++) this.particles.burst((Math.random() - 0.5) * W + (W - 1) / 2, H - 1, (Math.random() - 0.5) * D + (D - 1) / 2, colors[k % colors.length], 8, 1.4);
    this.app.camera.autoSpin = store.settings.reducedMotion ? 0 : 0.35;
    if (this.opts.saveKey) recordSolve(this.opts.saveKey, s.stars(), s.elapsed);
    if (this.opts.collection) this.app.freshSolve = s.def.id;
    this.opts.hooks?.event('solved');
    this.refreshHud();
  }

  private showSolvedCard(): void {
    this.cardShown = true;
    if (this.opts.hooks?.onSolved?.()) return;
    const s = this.session;
    const stars = s.stars();
    const rec = this.opts.saveKey ? store.records[this.opts.saveKey] : undefined;
    const where = this.opts.collection ? `${this.opts.collection.name} · No. ${(this.opts.index ?? 0) + 1}` : this.opts.subtitle ?? 'Solved';
    const title = h('h2', { class: 'plaque-title', 'aria-label': s.def.name });
    const card = h('div', { class: 'solved-card plaque' },
      h('div', { class: 'plaque-eyebrow' }, where),
      title,
      h('div', { class: 'plaque-rule' }),
      h('div', { class: 'stars', 'aria-label': `${stars} of 3 stars` }, ...[1, 2, 3].map((k) => icon(k <= stars ? I.star : I.starOutline, k <= stars ? 'on' : ''))),
      h('div', { class: 'solved-stats' },
        h('div', null, h('b', null, formatTime(s.elapsed)), h('span', null, 'time')),
        h('div', null, h('b', null, String(s.mode === 'classic' ? s.strikes : '–')), h('span', null, 'mistakes')),
        h('div', null, h('b', null, String(s.hints)), h('span', null, 'hints')),
        rec ? h('div', null, h('b', null, formatTime(rec.bestTime)), h('span', null, 'best')) : null,
      ),
      h('div', { class: 'row' },
        button(this.opts.collection ? 'To the gallery' : 'Back', () => this.leave(), 'ghost'),
        this.opts.onNext ? button('Next puzzle', () => this.opts.onNext!(), 'primary', I.arrowRight) : null,
      ),
    );
    // the name is lettered in, like a plaque being engraved
    const name = s.def.name;
    let n = 0;
    const type = () => {
      title.textContent = name.slice(0, n);
      if (n++ < name.length) setTimeout(type, store.settings.reducedMotion ? 0 : 55);
    };
    setTimeout(type, 250);
    this.el.append(card);
    requestAnimationFrame(() => card.classList.add('in'));
  }

  private async outOfStrikes(): Promise<void> {
    if (this.outOfStrikesShown) return;
    this.outOfStrikesShown = true;
    const r = await modal({
      title: 'Out of lives',
      body: `That's ${MAX_STRIKES} mistakes. Start over, or keep going without a limit (max 1 star).`,
      actions: [{ label: 'Keep going', value: 'go' }, { label: 'Restart', value: 'restart', cls: 'primary' }],
      dismissable: false,
    });
    if (r === 'restart') {
      this.session.restart();
      this.paintT.fill(0);
      this.prevDone = this.session.lineDone.slice();
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
    const sl = this.slicer;
    if (e.key === 'Shift') {
      this.setAltHeld(true);
      return;
    }
    if (this.keys.down(e)) return;
    if (mod && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if (mod && k === 'y') {
      e.preventDefault();
      this.redo();
    } else if (mod) return;
    else if (k === '0') this.clearZeros();
    else if (k === 'h') this.showHint();
    else if (k === '?') void this.showRules();
    else if (k === 'r') this.resetView();
    else if (k === 'arrowleft') this.app.camera.turn(-1);
    else if (k === 'arrowright') this.app.camera.turn(1);
    else if (k === 'arrowup') this.app.camera.snapTo(this.app.camera.yaw, clamp(this.app.camera.pitch + 0.4, -1.4, 1.4), 0.25);
    else if (k === 'arrowdown') this.app.camera.snapTo(this.app.camera.yaw, clamp(this.app.camera.pitch - 0.4, -1.4, 1.4), 0.25);
    else if (k === ']') sl.setPeel(sl.peel + 1);
    else if (k === '[') sl.setPeel(sl.peel - 1);
    else if (k === 'x' || k === 'y' || k === 'z') {
      const a = (k === 'x' ? 0 : k === 'y' ? 1 : 2) as Axis;
      // pressing the axis key again peels one more layer
      if (sl.axis === a) sl.setPeel(sl.peel + 1 >= this.session.grid.dims[a] ? 0 : sl.peel + 1);
      else {
        sl.setAxis(a);
        sl.setPeel(1);
      }
    } else if (k === 'escape') {
      if (this.tool) this.setTool(null);
      else this.clearHint();
    }
  }

  onKeyUp(e: KeyboardEvent): void {
    if (e.key === 'Shift') this.setAltHeld(false);
    else this.keys.up(e);
  }

  onBlur(): void {
    this.setAltHeld(false);
    this.keys.clear();
  }

  exit(): void {
    document.removeEventListener('pointermove', this.onDocPointer);
    document.body.classList.remove('in-play');
    ambient.stop();
    this.flushSweep();
    this.persist(true);
    this.opts.hooks?.detach?.();
    this.offSettings();
    this.app.canvas.style.cursor = '';
  }
}
