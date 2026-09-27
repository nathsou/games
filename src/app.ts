import { gridFor } from './core/grid.ts';
import { hashString } from './core/rng.ts';
import type { ModelDef, PuzzleDef } from './core/types.ts';
import { store, save, maskFromString, maskToString } from './game/storage.ts';
import { OrbitCamera } from './render/camera.ts';
import { hexToRgb } from './render/math.ts';
import { Renderer, type DrawList } from './render/renderer.ts';
import { BlockScene, NO_GLYPHS } from './render/scene.ts';
import { generateMask } from './solver/generator.ts';
import { Gestures, type GestureTarget } from './ui/gestures.ts';

export interface Screen {
  el: HTMLElement;
  gestures?: GestureTarget;
  enter?(): void;
  exit?(): void;
  update(dt: number, time: number): void;
  draw(time: number): DrawList | null;
  onKey?(e: KeyboardEvent): void;
}

/** Fill a scene with a model in its own colors (no clues). */
export function modelScene(scene: BlockScene, m: ModelDef): BlockScene {
  scene.reset(m.dims);
  const g = scene.grid;
  const colors = m.palette.map(hexToRgb);
  for (let i = 0; i < g.size; i++) scene.solid[i] = m.cells[i] ? 1 : 0;
  for (let i = 0; i < g.size; i++) {
    const c = m.cells[i];
    if (!c) continue;
    const [x, y, z] = g.coords(i);
    scene.add(x, y, z, 1, colors[c - 1], NO_GLYPHS);
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
  private last = performance.now();
  private thumbs = new Map<string, string>();
  readonly gestures: Gestures;

  constructor(canvas: HTMLCanvasElement, root: HTMLElement) {
    this.canvas = canvas;
    this.root = root;
    this.renderer = new Renderer(canvas);
    const proxy: GestureTarget = {
      hitTest: (x, y) => this.screen?.gestures?.hitTest(x, y) ?? false,
      strokeStart: (x, y, a) => this.screen?.gestures?.strokeStart(x, y, a),
      strokeMove: (x, y) => this.screen?.gestures?.strokeMove(x, y),
      strokeEnd: () => this.screen?.gestures?.strokeEnd(),
      hover: (x, y) => this.screen?.gestures?.hover(x, y),
      hoverEnd: () => this.screen?.gestures?.hoverEnd(),
      orbitStart: () => (this.screen?.gestures ? this.screen.gestures.orbitStart() : this.camera.beginDrag()),
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
    requestAnimationFrame(this.loop);
  }

  go(screen: Screen): void {
    const old = this.screen;
    if (old) {
      old.exit?.();
      old.el.classList.add('leaving');
      setTimeout(() => old.el.remove(), 250);
    }
    this.screen = screen;
    screen.el.classList.add('screen', 'entering');
    this.root.append(screen.el);
    requestAnimationFrame(() => requestAnimationFrame(() => screen.el.classList.remove('entering')));
    this.camera.offset = [0, 0];
    this.camera.viewScale = 1;
    this.camera.autoSpin = 0;
    screen.enter?.();
  }

  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const { w, h } = this.renderer.resize();
    this.camera.setSize(w, h);
    const s = this.screen;
    if (s) {
      s.update(dt, now / 1000);
      this.camera.update(dt);
      const list = s.draw(now / 1000);
      if (list) this.renderer.render(this.camera, list);
      else this.renderer.render(this.camera, {});
    }
    requestAnimationFrame(this.loop);
  };

  /** Colored thumbnail of a model (cached). */
  thumbnail(m: ModelDef, size = 220): string {
    const key = `${m.id}:${hashString(Array.from(m.cells).join(','))}`;
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
    const key = `${p.id}:${hashString(Array.from(p.cells).join(''))}`;
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
