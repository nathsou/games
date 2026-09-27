import type { Dims } from '../core/grid.ts';
import { clamp, damp, invert, lookAt, mat4, multiply, perspective, transformPoint, type Vec3 } from './math.ts';

const TAU = Math.PI * 2;
export const DEFAULT_YAW = 0.62;
export const DEFAULT_PITCH = 0.5;

/** Orbit camera with inertia, animated snapping and an off-center viewport. */
export class OrbitCamera {
  yaw = DEFAULT_YAW;
  pitch = DEFAULT_PITCH;
  zoom = 1;
  fov = (30 * Math.PI) / 180;
  fitDist = 12;
  target: Vec3 = [0, 0, 0];
  width = 1;
  height = 1;
  /** Shift the projected center (CSS px) to keep the model clear of side panels. */
  offset: [number, number] = [0, 0];
  autoSpin = 0;
  /** Extra distance factor so the model fits the area left free by the UI. */
  viewScale = 1;

  private velYaw = 0;
  private velPitch = 0;
  private dragging = false;
  private anim: { yaw0: number; pitch0: number; yaw1: number; pitch1: number; t: number; dur: number } | null = null;
  private zoomTarget = 1;

  readonly view = mat4();
  readonly proj = mat4();
  readonly viewProj = mat4();
  readonly invViewProj = mat4();
  eye: Vec3 = [0, 0, 10];
  /** Camera basis in world space. */
  right: Vec3 = [1, 0, 0];
  up: Vec3 = [0, 1, 0];

  get dist(): number {
    return this.fitDist * this.zoom * this.viewScale;
  }

  fit(dims: Dims, margin = 1.08): void {
    const r = 0.5 * Math.hypot(dims[0], dims[1], dims[2]);
    const aspect = this.width / this.height;
    const fovX = 2 * Math.atan(Math.tan(this.fov / 2) * aspect);
    const f = Math.min(this.fov, fovX);
    this.fitDist = (r / Math.sin(f / 2)) * margin;
  }

  setSize(w: number, h: number): void {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
  }

  /**
   * Fit the model into the part of the viewport not covered by UI (insets in CSS px),
   * easing toward the target so panels opening/closing don't jolt the view.
   */
  frame(top: number, right: number, bottom: number, left: number, dt: number): void {
    const w = Math.max(80, this.width - left - right);
    const h = Math.max(80, this.height - top - bottom);
    const scale = Math.max(this.width / w, this.height / h);
    const ox = (left - right) / 2;
    const oy = (top - bottom) / 2;
    const k = dt > 0 ? 1 - Math.exp(-10 * dt) : 1;
    this.viewScale += (scale - this.viewScale) * k;
    this.offset = [this.offset[0] + (ox - this.offset[0]) * k, this.offset[1] + (oy - this.offset[1]) * k];
  }

  beginDrag(): void {
    this.dragging = true;
    this.anim = null;
    this.velYaw = this.velPitch = 0;
  }

  orbit(dx: number, dy: number, dt: number): void {
    const k = 0.0085;
    this.yaw -= dx * k;
    this.pitch = clamp(this.pitch + dy * k, -1.45, 1.45);
    if (dt > 0) {
      const a = 0.35;
      this.velYaw = this.velYaw * (1 - a) + ((-dx * k) / dt) * a;
      this.velPitch = this.velPitch * (1 - a) + ((dy * k) / dt) * a;
    }
  }

  endDrag(): void {
    this.dragging = false;
    if (Math.abs(this.velYaw) < 0.3) this.velYaw = 0;
    if (Math.abs(this.velPitch) < 0.3) this.velPitch = 0;
  }

  zoomBy(factor: number, immediate = false): void {
    this.zoomTarget = clamp(this.zoomTarget * factor, 0.4, 2.4);
    if (immediate) this.zoom = this.zoomTarget;
  }

  resetZoom(): void {
    this.zoomTarget = 1;
  }

  snapTo(yaw: number, pitch: number, dur = 0.45): void {
    // shortest way around
    let dy = (yaw - this.yaw) % TAU;
    if (dy > Math.PI) dy -= TAU;
    if (dy < -Math.PI) dy += TAU;
    this.anim = { yaw0: this.yaw, pitch0: this.pitch, yaw1: this.yaw + dy, pitch1: pitch, t: 0, dur };
    this.velYaw = this.velPitch = 0;
  }

  /** Rotate by quarter turns around the vertical axis. */
  turn(quarters: number): void {
    const base = this.anim ? this.anim.yaw1 : this.yaw;
    this.snapTo(base + (quarters * Math.PI) / 2, this.anim ? this.anim.pitch1 : this.pitch);
  }

  update(dt: number): void {
    if (this.anim) {
      const a = this.anim;
      a.t += dt / a.dur;
      const t = Math.min(1, a.t);
      const e = 1 - Math.pow(1 - t, 3);
      this.yaw = a.yaw0 + (a.yaw1 - a.yaw0) * e;
      this.pitch = a.pitch0 + (a.pitch1 - a.pitch0) * e;
      if (t >= 1) this.anim = null;
    } else if (!this.dragging) {
      this.yaw += this.velYaw * dt;
      this.pitch = clamp(this.pitch + this.velPitch * dt, -1.45, 1.45);
      const d = Math.exp(-4.5 * dt);
      this.velYaw *= d;
      this.velPitch *= d;
      if (Math.abs(this.velYaw) < 0.01) this.velYaw = 0;
      if (Math.abs(this.velPitch) < 0.01) this.velPitch = 0;
      this.yaw += this.autoSpin * dt;
    }
    this.zoom += (this.zoomTarget - this.zoom) * damp(14, dt);
    this.updateMatrices();
  }

  updateMatrices(): void {
    const cp = Math.cos(this.pitch);
    const d = this.dist;
    const t = this.target;
    this.eye = [t[0] + d * cp * Math.sin(this.yaw), t[1] + d * Math.sin(this.pitch), t[2] + d * cp * Math.cos(this.yaw)];
    lookAt(this.view, this.eye, t, [0, 1, 0]);
    this.right = [this.view[0], this.view[4], this.view[8]];
    this.up = [this.view[1], this.view[5], this.view[9]];
    perspective(this.proj, this.fov, this.width / this.height, Math.max(0.1, d - 30), d + 30);
    this.proj[8] = (-2 * this.offset[0]) / this.width;
    this.proj[9] = (2 * this.offset[1]) / this.height;
    multiply(this.viewProj, this.proj, this.view);
    invert(this.invViewProj, this.viewProj);
  }

  /** World-space ray through a CSS pixel. */
  ray(px: number, py: number): { o: Vec3; d: Vec3 } {
    const nx = (px / this.width) * 2 - 1;
    const ny = 1 - (py / this.height) * 2;
    const a = transformPoint(this.invViewProj, [nx, ny, -1]);
    const b = transformPoint(this.invViewProj, [nx, ny, 1]);
    const o: Vec3 = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
    const e: Vec3 = [b[0] / b[3], b[1] / b[3], b[2] / b[3]];
    const d: Vec3 = [e[0] - o[0], e[1] - o[1], e[2] - o[2]];
    const l = Math.hypot(d[0], d[1], d[2]);
    return { o, d: [d[0] / l, d[1] / l, d[2] / l] };
  }

  /** Project a world point to CSS pixels. */
  project(p: Vec3): [number, number] {
    const c = transformPoint(this.viewProj, p);
    return [((c[0] / c[3] + 1) / 2) * this.width, ((1 - c[1] / c[3]) / 2) * this.height];
  }

  get isMoving(): boolean {
    return this.dragging || !!this.anim || this.velYaw !== 0 || this.velPitch !== 0 || this.autoSpin !== 0;
  }
}
