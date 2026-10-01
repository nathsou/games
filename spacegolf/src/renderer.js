// WebGL2 renderer: a world pass (background, gravity overlay, instanced
// sprites) rendered into an offscreen target, bloom + lensing composite, and a
// screen-space UI pass. No HTML UI anywhere: even text is drawn from a glyph
// atlas rasterised once at startup.

import * as SH from './shaders.js';

export const T = {
  SPARKLE: 11,
  PLANET: 0, SUN: 1, BLACKHOLE: 2, REPULSOR: 3, WORMHOLE: 4, HOLE: 5, DOT: 6, STAR: 7,
  BALL: 8, WIND: 9, RING: 10, CAPSULE: 12, FLAG: 13,
};
export const LOOK_ID = { moon: 0, earth: 1, desert: 2, lava: 3, ice: 4, goo: 5, jelly: 6, gas: 7 };

const OBJ_STRIDE = 12;
const UI_STRIDE = 20;
const MAX_OBJ = 4096;
const MAX_UI = 8192;

function compile(gl, type, src, label) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const lines = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
    throw new Error(`Shader compile failed (${label}): ${log}\n${lines}`);
  }
  return s;
}

function program(gl, vs, fs, label) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs, label + ' vs'));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs, label + ' fs'));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Program link failed (${label}): ${gl.getProgramInfoLog(p)}`);
  const uniforms = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace('[0]', '');
    uniforms[name] = gl.getUniformLocation(p, info.name);
  }
  return { p, u: uniforms };
}

function makeTarget(gl, w, h, hdr = false) {
  const filter = gl.LINEAR;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fbo, w, h };
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.canvas = canvas;
    this.gl = gl;
    this.time = 0;
    this.dpr = 1;
    this.quality = 1; // render-resolution multiplier (lowered automatically on slow devices)
    this.cssW = 0;
    this.cssH = 0;
    this.W = 0;
    this.H = 0;
    this.cam = { x: 0, y: 0, scale: 1 };
    this.light = [-0.55, -0.62, 0.6];
    this.sun = null; // {x, y}: light comes from this world position when set
    this.bounds = null; // {hw, hh}: dims everything outside the playfield

    this.progObj = program(gl, SH.OBJ_VS, SH.OBJ_FS, 'objects');
    this.progBg = program(gl, SH.FS_VS, SH.BG_FS, 'background');
    this.progField = program(gl, SH.FS_VS, SH.FIELD_FS, 'field');
    this.progBright = program(gl, SH.FS_VS, SH.BRIGHT_FS, 'bright');
    this.progBlur = program(gl, SH.FS_VS, SH.BLUR_FS, 'blur');
    this.progCopy = program(gl, SH.FS_VS, SH.COPY_FS, 'copy');
    this.progComp = program(gl, SH.FS_VS, SH.COMPOSITE_FS, 'composite');
    this.progUI = program(gl, SH.UI_VS, SH.UI_FS, 'ui');

    // shared quad
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const quad01 = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad01);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

    // object instances (two layers: alpha blended, additive)
    this.objLayers = [0, 1].map(() => {
      const data = new Float32Array(MAX_OBJ * OBJ_STRIDE);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
      for (let i = 0; i < 3; i++) {
        gl.enableVertexAttribArray(1 + i);
        gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, OBJ_STRIDE * 4, i * 16);
        gl.vertexAttribDivisor(1 + i, 1);
      }
      return { data, vao, buf, n: 0 };
    });

    // UI instances
    {
      const data = new Float32Array(MAX_UI * UI_STRIDE);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad01);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
      for (let i = 0; i < 5; i++) {
        gl.enableVertexAttribArray(1 + i);
        gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, UI_STRIDE * 4, i * 16);
        gl.vertexAttribDivisor(1 + i, 1);
      }
      this.ui = { data, vao, buf, n: 0 };
    }
    gl.bindVertexArray(null);
    this.emptyVao = gl.createVertexArray();

    this.atlasTex = null;
    this.targets = null;
    this.holes = [];
    this.fieldBodies = new Float32Array(64);
    this.resize();
  }

  // ----- sizing ---------------------------------------------------------------
  resize() {
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * (this.quality || 1);
    const cssW = Math.max(1, window.innerWidth);
    const cssH = Math.max(1, window.innerHeight);
    const W = Math.round(cssW * dpr);
    const H = Math.round(cssH * dpr);
    if (W === this.W && H === this.H && dpr === this.dpr) return false;
    this.dpr = dpr;
    this.cssW = cssW;
    this.cssH = cssH;
    this.W = W;
    this.H = H;
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    if (this.allTargets) {
      for (const t of this.allTargets) {
        gl.deleteTexture(t.tex);
        gl.deleteFramebuffer(t.fbo);
      }
    }
    this.buildTargets(W, H);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  }

  // HDR (half float) targets when the browser can render to them, else plain RGBA8.
  buildTargets(W, H) {
    const gl = this.gl;
    if (this.hdr === undefined) {
      this.hdr = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    }
    const make = (w, h, hdr) => {
      const t = makeTarget(gl, Math.max(2, w), Math.max(2, h), hdr);
      this.allTargets.push(t);
      return t;
    };
    this.allTargets = [];
    let scene = make(W, H, this.hdr);
    if (this.hdr && gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      // half-float rendering is advertised but broken: fall back
      this.hdr = false;
      gl.deleteTexture(scene.tex);
      gl.deleteFramebuffer(scene.fbo);
      this.allTargets.length = 0;
      scene = make(W, H, false);
    }
    const hdr = this.hdr;
    this.targets = { scene };
    // bloom pyramid: 1/2, 1/4, 1/8, 1/16, 1/32 resolution, each with a ping-pong partner
    this.bloom = [];
    for (let i = 0; i < 5; i++) {
      const w = W >> (i + 1);
      const h = H >> (i + 1);
      this.bloom.push({ a: make(w, h, hdr), b: make(w, h, hdr) });
    }
    // composite result (kept for the frosted-glass UI) + its blurred copies
    this.final = make(W, H, false);
    this.glass = [
      { a: make(W >> 2, H >> 2, false), b: make(W >> 2, H >> 2, false) },
      { a: make(W >> 3, H >> 3, false), b: make(W >> 3, H >> 3, false) },
    ];
  }

  setAtlas(canvas2d) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas2d);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.atlasTex = tex;
  }

  // ----- world ---------------------------------------------------------------
  beginFrame(time) {
    const gl = this.gl;
    this.time = time;
    this.objLayers[0].n = 0;
    this.objLayers[1].n = 0;
    this.holes.length = 0;
    this.ui.n = 0;
    this.sun = null;
    this.bounds = null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets.scene.fbo);
    gl.viewport(0, 0, this.W, this.H);
    gl.disable(gl.BLEND);
  }

  // Fit a rectangle (world units, centred on origin) into a region of the screen (CSS px).
  fitCamera(worldW, worldH, region, shake) {
    const s = Math.min(region.w / worldW, region.h / worldH);
    const cx = region.x + region.w / 2;
    const cy = region.y + region.h / 2;
    // world origin lands on (cx, cy) in css px; camera centre is the world point at screen centre
    const wx = (this.cssW / 2 - cx) / s;
    const wy = (this.cssH / 2 - cy) / s;
    this.cam.x = wx + (shake ? shake.x / s : 0);
    this.cam.y = wy + (shake ? shake.y / s : 0);
    this.cam.scale = s * this.dpr;
    this.camCss = s;
    return s;
  }

  worldToScreen(x, y, out = {}) {
    out.x = (x - this.cam.x) * this.camCss + this.cssW / 2;
    out.y = (y - this.cam.y) * this.camCss + this.cssH / 2;
    return out;
  }

  screenToWorld(px, py, out = {}) {
    out.x = (px - this.cssW / 2) / this.camCss + this.cam.x;
    out.y = (py - this.cssH / 2) / this.camCss + this.cam.y;
    return out;
  }

  setUniformsCommon(prog) {
    const gl = this.gl;
    const u = prog.u;
    if (u.uRes) gl.uniform2f(u.uRes, this.W, this.H);
    if (u.uCam) gl.uniform3f(u.uCam, this.cam.x, this.cam.y, this.cam.scale);
    if (u.uTime) gl.uniform1f(u.uTime, this.time);
  }

  background(palette) {
    const gl = this.gl;
    const pr = this.progBg;
    gl.useProgram(pr.p);
    this.setUniformsCommon(pr);
    gl.uniform2f(pr.u.uPar, palette.parX || 0, palette.parY || 0);
    gl.uniform3fv(pr.u.uCol1, palette.c1);
    gl.uniform3fv(pr.u.uCol2, palette.c2);
    gl.uniform1f(pr.u.uSeed, palette.seed || 0);
    gl.uniform2f(pr.u.uBounds, this.bounds ? this.bounds.hw : 0, this.bounds ? this.bounds.hh : 0);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // mode 1 = potential contours, 2 = warped grid; bodies = [{x,y,mu,eps2}]
  field(mode, bodies, alpha = 1) {
    if (!mode || alpha <= 0.01) return;
    const gl = this.gl;
    const pr = this.progField;
    gl.useProgram(pr.p);
    this.setUniformsCommon(pr);
    const n = Math.min(16, bodies.length);
    for (let i = 0; i < n; i++) {
      this.fieldBodies[i * 4] = bodies[i].x;
      this.fieldBodies[i * 4 + 1] = bodies[i].y;
      this.fieldBodies[i * 4 + 2] = bodies[i].mu;
      this.fieldBodies[i * 4 + 3] = bodies[i].eps2;
    }
    gl.uniform4fv(pr.u.uBodies, this.fieldBodies);
    gl.uniform1i(pr.u.uCount, n);
    gl.uniform1i(pr.u.uMode, mode);
    gl.uniform1f(pr.u.uAlpha, alpha);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }

  // push a sprite to the alpha layer (additive = false) or the additive layer
  sprite(additive, type, x, y, ext, rad, seed, p1, p2, r, g, b, a) {
    const L = this.objLayers[additive ? 1 : 0];
    if (L.n >= MAX_OBJ) return;
    const o = L.n * OBJ_STRIDE;
    const d = L.data;
    d[o] = x; d[o + 1] = y; d[o + 2] = ext; d[o + 3] = rad;
    d[o + 4] = type; d[o + 5] = seed; d[o + 6] = p1; d[o + 7] = p2;
    d[o + 8] = r; d[o + 9] = g; d[o + 10] = b; d[o + 11] = a;
    L.n++;
  }

  // soft or hard disc in the additive layer
  dot(x, y, radius, r, g, b, a, hard = 0) {
    this.sprite(true, T.DOT, x, y, radius, radius, 0, hard, 0, r, g, b, a);
  }

  ringFx(x, y, radius, width, r, g, b, a) {
    this.sprite(true, T.RING, x, y, radius + width * 4, radius, 0, width, 0, r, g, b, a);
  }

  line(x1, y1, x2, y2, width, r, g, b, a, dash = 0) {
    const hx = (x2 - x1) / 2;
    const hy = (y2 - y1) / 2;
    const len = Math.hypot(hx, hy);
    this.sprite(true, T.CAPSULE, x1 + hx, y1 + hy, len + width * 13, width, dash, hx, hy, r, g, b, a);
  }

  flushWorld() {
    const gl = this.gl;
    const pr = this.progObj;
    gl.useProgram(pr.p);
    this.setUniformsCommon(pr);
    gl.uniform3f(pr.u.uLight, this.light[0], this.light[1], this.light[2]);
    gl.uniform3f(pr.u.uSun, this.sun ? this.sun.x : 0, this.sun ? this.sun.y : 0, this.sun ? 1 : 0);
    gl.enable(gl.BLEND);
    for (let k = 0; k < 2; k++) {
      const L = this.objLayers[k];
      if (!L.n) continue;
      if (k === 0) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      else gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindVertexArray(L.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, L.buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, L.data, 0, L.n * OBJ_STRIDE);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, L.n);
    }
    gl.disable(gl.BLEND);
  }

  // black holes bend the image: pass their screen position (device px, top-left origin) and radius
  lens(x, y, radius) {
    if (this.holes.length < 4) {
      const s = this.cam.scale;
      this.holes.push((x - this.cam.x) * s + this.W / 2, (y - this.cam.y) * s + this.H / 2, radius * s);
    }
  }

  // draw a fullscreen pass of `prog` from texture `src` into `dst` (null = screen)
  pass(prog, src, dst, w, h, setup) {
    const gl = this.gl;
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fbo : null);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(prog.u.uTex, 0);
    if (setup) setup(prog.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  blur(level, iterations) {
    // level = {a, b}; blurs a in place (a -> b -> a)
    for (let i = 0; i < iterations; i++) {
      this.pass(this.progBlur, level.a, level.b, level.a.w, level.a.h, (u) => this.gl.uniform2f(u.uDir, 1 / level.a.w, 0));
      this.pass(this.progBlur, level.b, level.a, level.a.w, level.a.h, (u) => this.gl.uniform2f(u.uDir, 0, 1 / level.a.h));
    }
  }

  // bloom + lensing + tone-mapping; leaves the finished image on the screen
  endWorld(fade = 1, shake = null, bloom = 0.8) {
    const gl = this.gl;
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.emptyVao);
    const scene = this.targets.scene;

    if (bloom > 0) {
      // bright pass -> level 0, then a blurred pyramid
      this.pass(this.progBright, scene, this.bloom[0].a, this.bloom[0].a.w, this.bloom[0].a.h, (u) => gl.uniform2f(u.uTexel, 1 / scene.w, 1 / scene.h));
      for (let i = 0; i < this.bloom.length; i++) {
        if (i > 0) this.pass(this.progCopy, this.bloom[i - 1].a, this.bloom[i].a, this.bloom[i].a.w, this.bloom[i].a.h);
        this.blur(this.bloom[i], i < 2 ? 1 : 2);
      }
    }

    // composite into `final`
    const pr = this.progComp;
    gl.useProgram(pr.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.final.fbo);
    gl.viewport(0, 0, this.W, this.H);
    const bind = (unit, tex) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
    };
    bind(0, scene.tex);
    for (let i = 0; i < 5; i++) bind(1 + i, this.bloom[i].a.tex);
    gl.uniform1i(pr.u.uScene, 0);
    for (let i = 0; i < 5; i++) gl.uniform1i(pr.u['uB' + i], 1 + i);
    gl.uniform2f(pr.u.uRes, this.W, this.H);
    const hn = Math.min(4, this.holes.length / 3);
    const hv = new Float32Array(12);
    for (let i = 0; i < hn * 3; i++) hv[i] = this.holes[i];
    gl.uniform3fv(pr.u.uHoles, hv);
    gl.uniform1i(pr.u.uHoleCount, hn);
    gl.uniform1f(pr.u.uBloomAmt, bloom > 0 ? bloom : 0);
    gl.uniform2f(pr.u.uShake, shake ? shake.x * this.dpr : 0, shake ? shake.y * this.dpr : 0);
    gl.uniform1f(pr.u.uTime, this.time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);

    // to the screen
    this.pass(this.progCopy, this.final, null, this.W, this.H);

    // blurred copies of the finished frame: the UI's frosted glass samples these
    const g0 = this.glass[0];
    const g1 = this.glass[1];
    this.pass(this.progCopy, this.final, g0.a, g0.a.w, g0.a.h);
    this.blur(g0, 1);
    this.pass(this.progCopy, g0.a, g1.a, g1.a.w, g1.a.h);
    this.blur(g1, 2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
  }

  // ----- UI -------------------------------------------------------------------
  uiPush(x, y, w, h, c1, c2, type, radius, border, extra, u0 = 0, v0 = 0, u1 = 0, v1 = 0) {
    const U = this.ui;
    if (U.n >= MAX_UI) return;
    const o = U.n * UI_STRIDE;
    const d = U.data;
    d[o] = x; d[o + 1] = y; d[o + 2] = w; d[o + 3] = h;
    d[o + 4] = c1[0]; d[o + 5] = c1[1]; d[o + 6] = c1[2]; d[o + 7] = c1[3];
    d[o + 8] = c2[0]; d[o + 9] = c2[1]; d[o + 10] = c2[2]; d[o + 11] = c2[3];
    d[o + 12] = type; d[o + 13] = radius; d[o + 14] = border; d[o + 15] = extra;
    d[o + 16] = u0; d[o + 17] = v0; d[o + 18] = u1; d[o + 19] = v1;
    U.n++;
  }

  flushUI() {
    const gl = this.gl;
    const U = this.ui;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    if (!U.n) return;
    const pr = this.progUI;
    gl.useProgram(pr.p);
    gl.uniform2f(pr.u.uView, this.cssW, this.cssH);
    gl.uniform1f(pr.u.uTime, this.time);
    gl.uniform1f(pr.u.uPx, 1 / this.dpr);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.uniform1i(pr.u.uAtlas, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.glass[1].a.tex);
    gl.uniform1i(pr.u.uGlass, 1);
    gl.uniform2f(pr.u.uDevRes, this.W, this.H);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(U.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, U.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, U.data, 0, U.n * UI_STRIDE);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, U.n);
    gl.disable(gl.BLEND);
  }
}
