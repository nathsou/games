/**
 * Unified mouse / touch / pen gesture recognizer for the 3D view.
 *
 * - Press on a cube → stroke (tool action). Touch waits for a tap, a drag, or a long-press
 *   (alternate tool) so a second finger can still turn it into a camera gesture.
 * - Press on background, right/middle mouse, or two fingers → orbit (+ pinch zoom).
 * - Wheel / trackpad pinch → zoom.
 */
export interface GestureTarget {
  hitTest(x: number, y: number): boolean;
  strokeStart(x: number, y: number, alt: boolean): void;
  strokeMove(x: number, y: number): void;
  strokeEnd(): void;
  hover(x: number, y: number): void;
  hoverEnd(): void;
  orbitStart(): void;
  orbit(dx: number, dy: number, dt: number): void;
  orbitEnd(): void;
  zoom(factor: number): void;
  /** Touch-only: a finger is resting on a cube (for the clue readout). */
  touchFocus?(x: number, y: number | null): void;
}

type Mode = 'idle' | 'pending' | 'stroke' | 'orbit' | 'multi';

const LONG_PRESS_MS = 380;
const TAP_SLOP = 9;

export class Gestures {
  private el: HTMLElement;
  private t: GestureTarget;
  private pointers = new Map<number, { x: number; y: number }>();
  private mode: Mode = 'idle';
  private start = { x: 0, y: 0, id: -1 };
  private last = { x: 0, y: 0, time: 0 };
  private longTimer = 0;
  private multiStart: { dist: number; cx: number; cy: number } | null = null;
  private onLongPress: () => void;
  enabled = true;

  constructor(el: HTMLElement, target: GestureTarget, onLongPress: () => void = () => {}) {
    this.el = el;
    this.t = target;
    this.onLongPress = onLongPress;
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.cancel);
    el.addEventListener('pointerleave', this.leave);
    el.addEventListener('wheel', this.wheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  destroy(): void {
    const el = this.el;
    el.removeEventListener('pointerdown', this.down);
    el.removeEventListener('pointermove', this.move);
    el.removeEventListener('pointerup', this.up);
    el.removeEventListener('pointercancel', this.cancel);
    el.removeEventListener('pointerleave', this.leave);
    el.removeEventListener('wheel', this.wheel);
    clearTimeout(this.longTimer);
  }

  private pos(e: PointerEvent | WheelEvent): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private down = (e: PointerEvent) => {
    if (!this.enabled) return;
    const p = this.pos(e);
    this.pointers.set(e.pointerId, p);
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (this.pointers.size >= 2) {
      // second finger: abandon single-finger intent, start camera gesture
      clearTimeout(this.longTimer);
      if (this.mode === 'stroke') this.t.strokeEnd();
      if (this.mode === 'orbit') this.t.orbitEnd();
      this.t.touchFocus?.(0, null);
      this.mode = 'multi';
      this.multiStart = this.multiState();
      this.t.orbitStart();
      this.last.time = performance.now();
      return;
    }

    this.start = { x: p.x, y: p.y, id: e.pointerId };
    this.last = { x: p.x, y: p.y, time: performance.now() };
    const isMouse = e.pointerType === 'mouse';
    if (isMouse && e.button !== 0) {
      this.mode = 'orbit';
      this.t.orbitStart();
      return;
    }
    const hit = this.t.hitTest(p.x, p.y);
    if (!hit) {
      this.mode = 'orbit';
      this.t.orbitStart();
      return;
    }
    if (isMouse) {
      this.mode = 'stroke';
      this.t.strokeStart(p.x, p.y, e.shiftKey || e.altKey || e.ctrlKey || e.metaKey);
      return;
    }
    this.mode = 'pending';
    this.t.touchFocus?.(p.x, p.y);
    this.longTimer = window.setTimeout(() => {
      if (this.mode !== 'pending') return;
      this.mode = 'stroke';
      this.onLongPress();
      this.t.strokeStart(this.start.x, this.start.y, true);
    }, LONG_PRESS_MS);
  };

  private multiState() {
    const pts = [...this.pointers.values()];
    const [a, b] = pts;
    return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  private move = (e: PointerEvent) => {
    const p = this.pos(e);
    const now = performance.now();
    if (!this.pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && this.mode === 'idle') this.t.hover(p.x, p.y);
      return;
    }
    this.pointers.set(e.pointerId, p);

    if (this.mode === 'multi') {
      if (this.pointers.size < 2 || !this.multiStart) return;
      const m = this.multiState();
      const dt = (now - this.last.time) / 1000;
      this.t.orbit(m.cx - this.multiStart.cx, m.cy - this.multiStart.cy, dt);
      this.t.zoom(this.multiStart.dist / m.dist);
      this.multiStart = m;
      this.last.time = now;
      return;
    }
    if (e.pointerId !== this.start.id) return;
    const dt = (now - this.last.time) / 1000;
    if (this.mode === 'orbit') {
      this.t.orbit(p.x - this.last.x, p.y - this.last.y, dt);
    } else if (this.mode === 'pending') {
      if (Math.hypot(p.x - this.start.x, p.y - this.start.y) > TAP_SLOP) {
        clearTimeout(this.longTimer);
        this.mode = 'stroke';
        this.t.strokeStart(this.start.x, this.start.y, false);
        this.t.strokeMove(p.x, p.y);
      }
    } else if (this.mode === 'stroke') {
      this.t.strokeMove(p.x, p.y);
    }
    this.last = { x: p.x, y: p.y, time: now };
  };

  private finish(e: PointerEvent, cancelled: boolean) {
    this.pointers.delete(e.pointerId);
    try {
      this.el.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (this.mode === 'multi') {
      if (this.pointers.size === 0) {
        this.t.orbitEnd();
        this.mode = 'idle';
      } else if (this.pointers.size === 1) {
        this.multiStart = null;
      }
      return;
    }
    if (e.pointerId !== this.start.id) return;
    clearTimeout(this.longTimer);
    if (this.mode === 'pending' && !cancelled) {
      this.t.strokeStart(this.start.x, this.start.y, false);
      this.t.strokeEnd();
    } else if (this.mode === 'stroke') this.t.strokeEnd();
    else if (this.mode === 'orbit') this.t.orbitEnd();
    if (e.pointerType !== 'mouse') this.t.touchFocus?.(0, null);
    this.mode = 'idle';
    if (e.pointerType === 'mouse') {
      const p = this.pos(e);
      this.t.hover(p.x, p.y);
    }
  }

  private up = (e: PointerEvent) => this.finish(e, false);
  private cancel = (e: PointerEvent) => this.finish(e, true);

  private leave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && this.mode === 'idle') this.t.hoverEnd();
  };

  private wheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    const k = e.ctrlKey ? 0.012 : 0.0015;
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    this.t.zoom(Math.exp(delta * k));
  };
}
