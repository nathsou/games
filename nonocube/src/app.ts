import { gridFor } from './core/grid.ts';
import { hashString } from './core/rng.ts';
import type { ModelDef, PuzzleDef } from './core/types.ts';
import { onSettingsChange, store, save, maskFromString, maskToString } from './game/storage.ts';
import { OrbitCamera } from './render/camera.ts';
import { Renderer, type DrawList } from './render/renderer.ts';
import { BlockScene, NO_GLYPHS } from './render/scene.ts';
import { generateMask } from './solver/generator.ts';
import { Gestures, type GestureTarget } from './ui/gestures.ts';
import { applyTheme, layerColor, onThemeChange } from './ui/theme.ts';

export interface Screen {
  el: HTMLElement;
  gestures?: GestureTarget;
  enter?(): void;
  exit?(): void;
  update(dt: number, time: number): void;
  draw(time: number): DrawList | null;
  /** Whether the scene needs continuous frames; missing means always animate. */
  isAnimating?(): boolean;
  /** Real elapsed time, including idle periods, but excluding hidden tabs. */
  tick?(dt: number): void;
  /** Color theme name (see ui/theme.ts); defaults to "sunset". */
  theme?: string;
  onKey?(e: KeyboardEvent): void;
  onKeyUp?(e: KeyboardEvent): void;
  /** Window lost focus: drop any held-key state. */
  onBlur?(): void;
}

/**
 * Fill a scene with a model in Mono layer tones (no clues). `appear` (seconds) animates the
 * cubes dropping in from the bottom up; omit for the finished model.
 */
export function modelScene(scene: BlockScene, m: ModelDef, appear = Infinity): BlockScene {
  scene.reset(m.dims);
  const g = scene.grid;
  for (let i = 0; i < g.size; i++) scene.solid[i] = m.cells[i] ? 1 : 0;
  for (let i = 0; i < g.size; i++) {
    const c = m.cells[i];
    if (!c) continue;
    const [x, y, z] = g.coords(i);
    if (appear < 3) {
      const delay = (y / Math.max(1, m.dims[1])) * 0.7 + (((i * 7919) % 97) / 97) * 0.25;
      const t = Math.min(1, Math.max(0, (appear - delay) / 0.45));
      if (t <= 0) continue;
      const e = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
      scene.add(x, y + (1 - t) * 1.5, z, e, layerColor(y, m.dims[1]), NO_GLYPHS);
      continue;
    }
    scene.add(x, y, z, 1, layerColor(y, m.dims[1]), NO_GLYPHS);
  }
  scene.computeAO();
  return scene;
}

export class App {
  readonly canvas: HTMLCanvasElement;
  readonly root: HTMLElement;
  readonly renderer: Renderer;
  readonly camera = new OrbitCamera();
  screen: Screen | null = null;
  sharedView: DrawList = {};
  /** Puzzle id solved in the last play session (the gallery reveals it on its plinth). */
  freshSolve: string | null = null;
  private last = performance.now();
  private thumbs = new Map<string, string>();
  private dirty = true;
  private frame: number | null = null;
  private idleTimer: number | null = null;
  private observer: MutationObserver;

  invalidate = (): void => {
    this.dirty = true;
    if (document.hidden || this.frame !== null) return;
    if (this.idleTimer !== null) { clearTimeout(this.idleTimer); this.idleTimer = null; }
    this.frame = requestAnimationFrame(this.loop);
  };
  readonly gestures: Gestures;

  constructor(canvas: HTMLCanvasElement, root: HTMLElement) {
    this.canvas = canvas;
    this.root = root;
    this.renderer = new Renderer(canvas);
    onThemeChange(() => { this.thumbs.clear(); this.invalidate(); });
    const syncMomentum = () => {
      this.camera.momentum = store.settings.reducedMotion ? 'off' : store.settings.momentum;
      this.renderer.pixelDensity = store.settings.pixelDensity;
      this.renderer.antialias = store.settings.antialias;
      if (store.settings.reducedMotion) this.camera.autoSpin = 0;
      this.invalidate();
    };
    syncMomentum();
    onSettingsChange(syncMomentum);
    const proxy: GestureTarget = {
      hitTest: (x, y) => this.screen?.gestures?.hitTest(x, y) ?? false,
      strokeStart: (x, y, a) => this.screen?.gestures?.strokeStart(x, y, a),
      strokeMove: (x, y) => this.screen?.gestures?.strokeMove(x, y),
      strokeEnd: () => this.screen?.gestures?.strokeEnd(),
      hover: (x, y) => this.screen?.gestures?.hover(x, y),
      hoverEnd: () => this.screen?.gestures?.hoverEnd(),
      orbitStart: (x, y) => (this.screen?.gestures ? this.screen.gestures.orbitStart(x, y) : this.camera.beginDrag()),
      orbit: (dx, dy, dt) => (this.screen?.gestures ? this.screen.gestures.orbit(dx, dy, dt) : this.camera.orbit(dx, dy, dt)),
      orbitEnd: () => (this.screen?.gestures ? this.screen.gestures.orbitEnd() : this.camera.endDrag()),
      zoom: (f) => this.screen?.gestures?.zoom(f),
      touchFocus: (x, y) => this.screen?.gestures?.touchFocus?.(x, y),
    };
    this.gestures = new Gestures(canvas, proxy);
    window.addEventListener('keydown', (e) => {
      if (document.querySelector('.modal-back')) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') && (t as HTMLInputElement).type !== 'range') return;
      this.screen?.onKey?.(e);
    });
    window.addEventListener('keyup', (e) => this.screen?.onKeyUp?.(e));
    window.addEventListener('blur', () => this.screen?.onBlur?.());
    // Input and asynchronous UI changes wake an idle scene immediately.
    for (const event of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'wheel', 'keydown', 'keyup', 'click', 'input', 'change', 'resize', 'blur']) {
      window.addEventListener(event, this.invalidate, { capture: true, passive: true });
    }
    this.observer = new MutationObserver(this.invalidate);
    this.observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    document.addEventListener('visibilitychange', () => {
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      if (this.idleTimer !== null) clearTimeout(this.idleTimer);
      this.frame = this.idleTimer = null;
      this.last = performance.now();
      if (!document.hidden) this.invalidate();
    });
    this.invalidate();
  }

  go(screen: Screen): void {
    const old = this.screen;
    if (old) {
      old.exit?.();
      old.el.classList.add('leaving');
      setTimeout(() => old.el.remove(), 250);
    }
    this.screen = screen;
    this.last = performance.now();
    applyTheme(screen.theme ?? 'sunset');
    screen.el.classList.add('screen', 'entering');
    this.root.append(screen.el);
    requestAnimationFrame(() => requestAnimationFrame(() => screen.el.classList.remove('entering')));
    this.camera.offset = [0, 0];
    this.camera.target = [0, 0, 0];
    this.camera.viewScale = 1;
    this.camera.avail = null;
    this.camera.autoSpin = 0;
    screen.enter?.();
    this.invalidate();
  }

  private loop = (now: number) => {
    this.frame = null;
    if (document.hidden) return;
    const elapsed = Math.max(0, (now - this.last) / 1000);
    const dt = Math.min(0.05, elapsed);
    this.last = now;
    const s = this.screen;
    s?.tick?.(elapsed);
    // Timer labels do not invalidate the 3D scene.
    this.observer.takeRecords();
    const active = this.dirty || this.camera.isMoving || (s?.isAnimating?.() ?? true);
    if (s && active) {
      this.dirty = false;
      const { w, h } = this.renderer.resize();
      this.camera.setSize(w, h);
      s.update(dt, now / 1000);
      this.camera.update(dt);
      this.sharedView = s.draw(now / 1000) || {};
      this.renderer.render(this.camera, this.sharedView);
      // Ignore our own per-frame HUD writes, while observing later async changes.
      this.observer.takeRecords();
    }
    if (this.dirty || this.camera.isMoving || (s?.isAnimating?.() ?? true)) {
      this.frame = requestAnimationFrame(this.loop);
    } else {
      // Keep clocks accurate without layout, geometry uploads or GPU work.
      this.idleTimer = window.setTimeout(() => { this.idleTimer = null; this.loop(performance.now()); }, 250);
    }
  };

  /** Mono thumbnail of a model (cached). */
  thumbnail(m: ModelDef, size = 220): string {
    const key = `${document.documentElement.dataset.theme}:${m.id}:${hashString(Array.from(m.cells).join(','))}`;
    const cached = this.thumbs.get(key);
    if (cached) return cached;
    const cam = new OrbitCamera();
    cam.setSize(size, size);
    cam.yaw = 0.62;
    cam.pitch = 0.42;
    cam.fit(m.dims, 1.0);
    cam.updateMatrices();
    const scene = modelScene(new BlockScene(), m);
    const url = this.renderer.snapshot(cam, { block: scene, shadow: { dims: m.dims, alpha: 0.18 } }, size);
    this.thumbs.set(key, url);
    return url;
  }

  /** Clue mask for a puzzle: explicit, cached, or freshly generated. */
  maskFor(p: PuzzleDef): Uint8Array {
    if (p.mask) return p.mask;
    const g = gridFor(p.dims);
    const key = `g2:${p.id}:${hashString(Array.from(p.cells).join(''))}`;
    const cached = store.masks[key];
    if (cached) {
      const m = maskFromString(cached, g.lineCount);
      if (m) return m;
    }
    const { mask } = generateMask(g, p.cells, p.difficulty, p.id);
    store.masks[key] = maskToString(mask);
    save();
    return mask;
  }
}
