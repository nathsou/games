import { sfx } from '../audio/sfx.ts';
import type { Axis, Dims } from '../core/grid.ts';
import type { OrbitCamera } from '../render/camera.ts';
import { clamp, hexToRgb, type Vec3 } from '../render/math.ts';
import type { LineBatch } from '../render/renderer.ts';
import { h, icon } from './dom.ts';
import { I } from './icons.ts';
import { hideTooltip } from './tooltip.ts';

export const AXIS_COLORS = ['#e5534b', '#3bb37a', '#3d7be0'];
export const AXIS_NAMES = ['X', 'Y', 'Z'];
const AXIS_WORDS = ['left–right', 'top–bottom', 'front–back'];

/** Gap between the block and the rails, in cube units. */
const RAIL_OFFSET = 0.75;
/** How far a resting knob sticks out past the block along its own axis. */
const KNOB_OUT = 0.9;

interface Rail {
  /** Fixed world coordinates on the two other axes. */
  fixed: [number, number, number];
  /** Screen position of the knob (CSS px). */
  sx: number;
  sy: number;
  /** Screen vector for peeling one more layer. */
  step: [number, number];
  onScreen: boolean;
}

/**
 * Layer slicing, Picross-3D style: each axis has a rail along an edge of the block with a
 * knob you drag inward to peel layers from the side facing you. Touch devices get a compact
 * slider pill instead (`pill`). Only one axis is peeled at a time.
 */
export class Slicer {
  axis: Axis = 1;
  peel = 0;
  /** +1 hides the high-coordinate side, -1 the low side. */
  sign = 1;
  readonly pill: HTMLElement;
  readonly knobLayer: HTMLElement;
  private knobs: HTMLElement[] = [];
  private badges: HTMLElement[] = [];
  private rails: Rail[] = [0, 1, 2].map(() => ({ fixed: [0, 0, 0], sx: 0, sy: 0, step: [0, 0], onScreen: false }));
  private signs = [1, 1, 1];
  private drag: { axis: Axis; x: number; y: number; start: number; step: [number, number]; id: number } | null = null;
  private range: HTMLInputElement;
  private label: HTMLElement;
  private axisBtns: HTMLElement[];
  private cam: OrbitCamera;
  private getDims: () => Dims;
  private onChange: () => void;
  enabled = true;

  constructor(cam: OrbitCamera, getDims: () => Dims, onChange: () => void) {
    this.cam = cam;
    this.getDims = getDims;
    this.onChange = onChange;

    // Knobs (pointer devices)
    this.knobLayer = h('div', { class: 'knob-layer' });
    for (let a = 0; a < 3; a++) {
      const badge = h('span', { class: 'knob-badge' });
      const knob = h('div', {
        class: 'knob',
        style: `--axis:${AXIS_COLORS[a]}`,
        role: 'slider',
        tabindex: '-1',
        'aria-label': `Peel ${AXIS_NAMES[a]} layers`,
        'data-tip': `Drag to peel ${AXIS_WORDS[a]} layers`,
        'data-key': a === 0 ? 'X' : a === 1 ? 'Y' : 'Z',
      }, h('span', { class: 'knob-arrow', html: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' }), badge);
      knob.addEventListener('pointerdown', (e) => this.knobDown(e, a as Axis));
      knob.addEventListener('pointermove', (e) => this.knobMove(e));
      knob.addEventListener('pointerup', (e) => this.knobUp(e));
      knob.addEventListener('pointercancel', (e) => this.knobUp(e));
      knob.addEventListener('dblclick', () => this.reset());
      this.knobs.push(knob);
      this.badges.push(badge);
      this.knobLayer.append(knob);
    }

    // Pill (touch devices)
    this.axisBtns = [0, 1, 2].map((a) =>
      h('button', {
        class: 'axis-btn',
        style: `--axis:${AXIS_COLORS[a]}`,
        'aria-label': `Slice ${AXIS_WORDS[a]}`,
        'data-tip': `Peel ${AXIS_WORDS[a]} layers`,
        onclick: () => this.setAxis(a as Axis, true),
      }, AXIS_NAMES[a]),
    );
    this.range = h('input', {
      type: 'range', min: '0', max: '1', step: '1', value: '0', class: 'slice-range', 'aria-label': 'Layers peeled',
      oninput: (e: Event) => this.setPeel(Number((e.target as HTMLInputElement).value)),
    });
    this.label = h('span', { class: 'slice-label' });
    this.pill = h('div', { class: 'pill slicer' },
      h('span', { class: 'slicer-title', 'data-tip': 'Peel away layers to see inside' }, icon(I.layers)),
      h('div', { class: 'axis-seg' }, ...this.axisBtns), this.range, this.label);
    this.sync();
  }

  get dims(): Dims {
    return this.getDims();
  }

  /** Is the cell at (x,y,z) still shown? */
  visible(x: number, y: number, z: number): boolean {
    if (!this.peel) return true;
    const c = this.axis === 0 ? x : this.axis === 1 ? y : z;
    const dim = this.dims[this.axis];
    return this.sign > 0 ? c < dim - this.peel : c >= this.peel;
  }

  setAxis(a: Axis, toggle = false): void {
    if (this.axis === a) {
      if (toggle && this.peel) this.setPeel(0);
      return;
    }
    this.axis = a;
    this.peel = 0;
    this.sync();
    sfx.tick();
    this.onChange();
  }

  setPeel(n: number): void {
    n = clamp(Math.round(n), 0, this.dims[this.axis] - 1);
    if (n > 0 && this.peel === 0) this.sign = this.signs[this.axis];
    if (n === this.peel) return;
    this.peel = n;
    this.sync();
    sfx.tick();
    this.onChange();
  }

  reset(): void {
    this.setPeel(0);
  }

  /** Keep the peel valid after the grid is resized. */
  clampToDims(): void {
    this.peel = Math.min(this.peel, this.dims[this.axis] - 1);
    this.sync();
  }

  private sync(): void {
    const dim = this.dims[this.axis];
    this.range.max = String(Math.max(1, dim - 1));
    this.range.value = String(this.peel);
    this.range.disabled = dim <= 1;
    this.label.textContent = this.peel ? `−${this.peel}` : '';
    this.axisBtns.forEach((b, a) => b.classList.toggle('active', a === this.axis));
    this.pill.classList.toggle('peeling', this.peel > 0);
  }

  // ---------------------------------------------------------------- knobs

  private knobDown(e: PointerEvent, a: Axis): void {
    if (!this.enabled) return;
    e.preventDefault();
    e.stopPropagation();
    hideTooltip();
    if (a !== this.axis) {
      this.axis = a;
      this.peel = 0;
      this.sync();
      this.onChange();
    }
    this.sign = this.peel ? this.sign : this.signs[a];
    const r = this.rails[a];
    this.drag = { axis: a, x: e.clientX, y: e.clientY, start: this.peel, step: r.step, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.knobLayer.classList.add('dragging');
    this.knobs[a].classList.add('grabbed');
  }

  private knobMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const [vx, vy] = d.step;
    const len2 = vx * vx + vy * vy;
    if (len2 < 1) return;
    const n = d.start + ((e.clientX - d.x) * vx + (e.clientY - d.y) * vy) / len2;
    this.setPeel(n);
  }

  private knobUp(e: PointerEvent): void {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    this.knobs[this.drag.axis].classList.remove('grabbed');
    this.drag = null;
    this.knobLayer.classList.remove('dragging');
  }

  /** World position on axis a's rail at coordinate t along the axis. */
  private railPoint(a: number, t: number): Vec3 {
    const p: Vec3 = [...this.rails[a].fixed];
    p[a] = t;
    return p;
  }

  /** Recompute rail placement and knob positions for the current camera. Call every frame. */
  update(show: boolean): void {
    const cam = this.cam;
    const dims = this.dims;
    const half = [dims[0] / 2, dims[1] / 2, dims[2] / 2];
    const eye = cam.eye;
    this.knobLayer.classList.toggle('hidden', !show || !this.enabled);
    for (let a = 0; a < 3; a++) {
      // peel from the side facing the camera (locked while peeled)
      const facing = eye[a] >= 0 ? 1 : -1;
      if (!(a === this.axis && this.peel > 0)) this.signs[a] = facing;
      const sgn = a === this.axis && this.peel > 0 ? this.sign : this.signs[a];
      const rail = this.rails[a];
      if (!this.drag || this.drag.axis !== a) {
        const fixed: [number, number, number] = [0, 0, 0];
        if (a === 1) {
          // vertical rail on the silhouette edge that's furthest right on screen
          let best = -Infinity;
          for (const sx of [-1, 1])
            for (const sz of [-1, 1]) {
              const p: Vec3 = [sx * (half[0] + RAIL_OFFSET * 0.7), 0, sz * (half[2] + RAIL_OFFSET * 0.7)];
              const s = cam.project(p)[0];
              if (s > best) {
                best = s;
                fixed[0] = p[0];
                fixed[2] = p[2];
              }
            }
        } else {
          // horizontal rails along the bottom (or top when looking from below), on the far edge,
          // so the X and Z knobs rest on opposite silhouette corners
          const other = a === 0 ? 2 : 0;
          fixed[1] = eye[1] < -half[1] ? half[1] + RAIL_OFFSET * 0.6 : -half[1] - RAIL_OFFSET * 0.6;
          fixed[other] = -(eye[other] >= 0 ? 1 : -1) * (half[other] + RAIL_OFFSET * 0.6);
        }
        rail.fixed = fixed;
      }
      const peel = a === this.axis ? this.peel : 0;
      const cut = sgn * (half[a] - peel + KNOB_OUT);
      const p0 = cam.project(this.railPoint(a, cut));
      const p1 = cam.project(this.railPoint(a, cut - sgn));
      rail.sx = p0[0];
      rail.sy = p0[1];
      rail.step = [p1[0] - p0[0], p1[1] - p0[1]];
      rail.onScreen = p0[0] > -40 && p0[1] > -40 && p0[0] < cam.width + 40 && p0[1] < cam.height + 40;
      const knob = this.knobs[a];
      const ang = Math.round((Math.atan2(rail.step[1], rail.step[0]) * 180) / Math.PI);
      knob.style.transform = `translate(${rail.sx.toFixed(1)}px, ${rail.sy.toFixed(1)}px)`;
      const path = knob.querySelector('path')!;
      if (path.dataset.angle !== String(ang)) {
        path.dataset.angle = String(ang);
        path.setAttribute('transform', `rotate(${ang} 12 12)`);
      }
      const flat = dims[a] <= 1 || Math.hypot(rail.step[0], rail.step[1]) < 6;
      knob.classList.toggle('off', !rail.onScreen || flat);
      knob.classList.toggle('active', a === this.axis && this.peel > 0);
      this.badges[a].textContent = a === this.axis && this.peel > 0 ? String(this.peel) : '';
    }
  }

  /** Rails (with layer ticks) and the cut outline, for the renderer. */
  lines(showRails: boolean): LineBatch[] {
    const out: LineBatch[] = [];
    const dims = this.dims;
    const half = [dims[0] / 2, dims[1] / 2, dims[2] / 2];
    if (showRails && this.enabled) {
      for (let a = 0; a < 3; a++) {
        if (dims[a] <= 1 || this.knobs[a].classList.contains('off')) continue;
        const pts: number[] = [];
        const f = this.rails[a].fixed;
        const p = (t: number, dx = 0, dy = 0, dz = 0) => {
          const q = [...f];
          q[a] = t;
          return [q[0] + dx, q[1] + dy, q[2] + dz];
        };
        const sg = a === this.axis && this.peel > 0 ? this.sign : this.signs[a];
        pts.push(...p(-sg * half[a]), ...p(sg * (half[a] + KNOB_OUT)));
        // ticks at layer boundaries, pointing back toward the block
        const inward = [0, 0, 0];
        for (let b = 0; b < 3; b++) if (b !== a) inward[b] = -Math.sign(f[b]) * 0.14;
        for (let k = 0; k <= dims[a]; k++) {
          const t = -half[a] + k;
          pts.push(...p(t), ...p(t, inward[0], inward[1], inward[2]));
        }
        const c = hexToRgb(AXIS_COLORS[a]);
        const active = a === this.axis && this.peel > 0;
        out.push({ points: Float32Array.from(pts), color: [c[0], c[1], c[2], active ? 0.85 : 0.4] });
      }
    }
    if (this.peel > 0) {
      const a = this.axis;
      const min = [-half[0], -half[1], -half[2]];
      const max = [half[0], half[1], half[2]];
      const cut = this.sign * (half[a] - this.peel);
      min[a] = max[a] = cut;
      const c = hexToRgb(AXIS_COLORS[a]);
      const corners: number[][] = [];
      const others = [0, 1, 2].filter((b) => b !== a);
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const q = [0, 0, 0];
        q[a] = cut;
        q[others[0]] = u ? max[others[0]] : min[others[0]];
        q[others[1]] = v ? max[others[1]] : min[others[1]];
        corners.push(q);
      }
      const pts: number[] = [];
      for (let k = 0; k < 4; k++) pts.push(...corners[k], ...corners[(k + 1) % 4]);
      out.push({ points: Float32Array.from(pts), color: [c[0], c[1], c[2], 0.95] });
    }
    return out;
  }
}
