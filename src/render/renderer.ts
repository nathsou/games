import type { Dims } from '../core/grid.ts';
import { ATLAS_COLS, buildAtlas } from './atlas.ts';
import type { OrbitCamera } from './camera.ts';
import { FACES, INST_FLOATS, type BlockScene, type Particles } from './scene.ts';

const CUBE_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
layout(location=3) in vec2 aFC;
layout(location=4) in vec4 iPosScale;
layout(location=5) in vec3 iColor;
layout(location=6) in uint iGlyph;
layout(location=7) in uvec2 iAO;
uniform mat4 uViewProj;
uniform vec3 uOrigin;
uniform vec3 uFaceUp[6];
const vec3 T1[6] = vec3[6](vec3(0,1,0), vec3(0,0,1), vec3(0,0,1), vec3(1,0,0), vec3(1,0,0), vec3(0,1,0));
const vec3 T2[6] = vec3[6](vec3(0,0,1), vec3(0,1,0), vec3(1,0,0), vec3(0,0,1), vec3(0,1,0), vec3(1,0,0));
out vec3 vNormal;
out vec2 vUV;
out vec3 vColor;
out vec2 vGlyphUV;
out float vAO;
flat out vec3 vT1;
flat out vec3 vT2;
flat out int vGlyph;
flat out float vFade;
flat out uint vFlags;
void main() {
  vec3 world = uOrigin + iPosScale.xyz + aPos * iPosScale.w;
  gl_Position = uViewProj * vec4(world, 1.0);
  int face = int(aFC.x + 0.5);
  int corner = int(aFC.y + 0.5);
  int axis = face / 2;
  uint g = (iGlyph >> uint(axis * 8)) & 0xFFu;
  vGlyph = int(g & 0x7Fu);
  vFade = (g & 0x80u) != 0u ? 1.0 : 0.0;
  vFlags = iGlyph >> 24u;
  vec3 up = uFaceUp[face];
  vec3 right = cross(up, aNormal);
  vGlyphUV = vec2(dot(aPos, right) + 0.5, 0.5 - dot(aPos, up));
  int k = face * 4 + corner;
  uint word = k < 16 ? iAO.x : iAO.y;
  uint ao = (word >> uint((k % 16) * 2)) & 3u;
  vAO = float(ao) / 3.0;
  vNormal = aNormal;
  vT1 = T1[face];
  vT2 = T2[face];
  vUV = aUV;
  vColor = iColor;
}`;

const CUBE_FS = `#version 300 es
precision highp float;
precision highp int;
in vec3 vNormal;
in vec2 vUV;
in vec3 vColor;
in vec2 vGlyphUV;
in float vAO;
flat in vec3 vT1;
flat in vec3 vT2;
flat in int vGlyph;
flat in float vFade;
flat in uint vFlags;
uniform sampler2D uAtlas;
uniform vec3 uLightDir;
uniform vec3 uInk;
uniform float uGlyphAlpha;
uniform float uTime;
uniform float uGreyDone;
out vec4 outColor;
void main() {
  vec3 n0 = normalize(vNormal);
  // rounded bevel: bend the normal outward near the face edges
  vec2 p = vUV * 2.0 - 1.0;
  const float B = 0.16;
  vec2 e = clamp((abs(p) - (1.0 - B)) / B, 0.0, 1.0);
  e = e * e * sign(p);
  vec3 n = normalize(n0 * (1.0 - 0.35 * max(abs(e.x), abs(e.y))) + (vT1 * e.x + vT2 * e.y) * 0.85);
  vec3 base = vColor;
  if ((vFlags & 1u) != 0u) {
    float s = smoothstep(0.42, 0.58, fract((vUV.x - vUV.y) * 3.5));
    base *= mix(1.0, 0.93, s);
  }
  float hemi = 0.5 + 0.5 * n.y;
  float diff = max(dot(n, uLightDir), 0.0);
  float light = 0.58 + 0.2 * hemi + 0.34 * diff;
  float ao = mix(0.55, 1.0, vAO);
  vec3 col = base * light * ao;
  // specular sheen on the bevel
  col += pow(max(dot(n, normalize(uLightDir + vec3(0.0, 0.0, 0.6))), 0.0), 24.0) * 0.08;
  vec2 ed = min(vUV, 1.0 - vUV);
  float d = min(ed.x, ed.y);
  col *= mix(0.7, 1.0, smoothstep(0.0, 0.022, d));
  if ((vFlags & 2u) != 0u) {
    float rim = 1.0 - smoothstep(0.03, 0.1, d);
    col = mix(col, vec3(1.0, 0.78, 0.25), rim * 0.95);
  }
  if ((vFlags & 4u) != 0u) {
    float pulse = 0.5 + 0.5 * sin(uTime * 6.0);
    col = mix(col, vec3(0.25, 0.82, 0.72), 0.22 + 0.28 * pulse);
  }
  if (vFade > 0.5 && uGreyDone > 0.5) {
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(l) * 0.86, 0.72);
  }
  if (vGlyph != 127) {
    vec2 cell = vec2(float(vGlyph % ${ATLAS_COLS}), float(vGlyph / ${ATLAS_COLS}));
    vec2 uv = (cell + clamp(vGlyphUV, 0.02, 0.98)) / ${ATLAS_COLS}.0;
    float sd = texture(uAtlas, uv).r;
    float w = clamp(fwidth(sd) * 0.7, 0.004, 0.25);
    float a = smoothstep(0.5 - w, 0.5 + w, sd) * uGlyphAlpha * (vFade > 0.5 ? 0.22 : 1.0);
    col = mix(col, uInk, a * 0.94);
  }
  outColor = vec4(col, 1.0);
}`;

const PART_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=4) in vec4 iPosScale;
layout(location=5) in vec4 iColor;
layout(location=6) in vec4 iRot;
uniform mat4 uViewProj;
uniform vec3 uOrigin;
out vec3 vNormal;
out vec4 vColor;
mat3 rot(vec3 a, float t) {
  float c = cos(t), s = sin(t), ic = 1.0 - c;
  return mat3(c + a.x*a.x*ic, a.y*a.x*ic + a.z*s, a.z*a.x*ic - a.y*s,
              a.x*a.y*ic - a.z*s, c + a.y*a.y*ic, a.z*a.y*ic + a.x*s,
              a.x*a.z*ic + a.y*s, a.y*a.z*ic - a.x*s, c + a.z*a.z*ic);
}
void main() {
  mat3 r = rot(iRot.xyz, iRot.w);
  vec3 world = uOrigin + iPosScale.xyz + r * aPos * iPosScale.w;
  gl_Position = uViewProj * vec4(world, 1.0);
  vNormal = r * aNormal;
  vColor = iColor;
}`;

const PART_FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec4 vColor;
uniform vec3 uLightDir;
out vec4 outColor;
void main() {
  vec3 n = normalize(vNormal);
  float l = 0.55 + 0.2 * (0.5 + 0.5 * n.y) + 0.35 * max(dot(n, uLightDir), 0.0);
  outColor = vec4(vColor.rgb * l * vColor.a, vColor.a);
}`;

const LINE_VS = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uViewProj;
void main() { gl_Position = uViewProj * vec4(aPos, 1.0); }`;

const LINE_FS = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 outColor;
void main() { outColor = vec4(uColor.rgb * uColor.a, uColor.a); }`;

const SHADOW_VS = `#version 300 es
layout(location=0) in vec2 aPos;
uniform mat4 uViewProj;
uniform vec3 uCenter;
uniform vec2 uSize;
out vec2 vP;
void main() {
  vP = aPos;
  gl_Position = uViewProj * vec4(uCenter + vec3(aPos.x * uSize.x, 0.0, aPos.y * uSize.y), 1.0);
}`;

const SHADOW_FS = `#version 300 es
precision highp float;
in vec2 vP;
uniform float uAlpha;
uniform vec3 uTint;
out vec4 outColor;
void main() {
  float d = length(vP);
  float a = (1.0 - smoothstep(0.35, 1.0, d)) * uAlpha;
  outColor = vec4(uTint * a, a);
}`;

export interface LineBatch {
  points: Float32Array; // xyz pairs in world space
  color: [number, number, number, number];
}

export interface DrawList {
  block?: BlockScene;
  particles?: Particles;
  lines?: LineBatch[];
  shadow?: { dims: Dims; alpha: number; tint?: [number, number, number] };
  ink?: [number, number, number];
  time?: number;
  /** Grey the faces of rows flagged as finished. */
  greyDone?: boolean;
}

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
  return p;
}

function uniforms(gl: WebGL2RenderingContext, p: WebGLProgram, names: string[]): Record<string, WebGLUniformLocation | null> {
  const out: Record<string, WebGLUniformLocation | null> = {};
  for (const n of names) out[n] = gl.getUniformLocation(p, n);
  return out;
}

/** Build a unit cube: 24 vertices (pos, normal, uv, face/corner) + 36 indices. */
function cubeMesh(): { verts: Float32Array; idx: Uint16Array } {
  const v: number[] = [];
  const idx: number[] = [];
  FACES.forEach((f, fi) => {
    for (let c = 0; c < 4; c++) {
      const s1 = c & 1 ? 1 : -1;
      const s2 = c & 2 ? 1 : -1;
      for (let a = 0; a < 3; a++) v.push(0.5 * (f.n[a] + f.t1[a] * s1 + f.t2[a] * s2));
      v.push(...f.n, s1 > 0 ? 1 : 0, s2 > 0 ? 1 : 0, fi, c);
    }
    const b = fi * 4;
    idx.push(b, b + 1, b + 3, b, b + 3, b + 2);
  });
  return { verts: Float32Array.from(v), idx: Uint16Array.from(idx) };
}

const LIGHT = (() => {
  const l = [0.45, 0.8, 0.55];
  const n = Math.hypot(...l);
  return l.map((x) => x / n);
})();

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  readonly canvas: HTMLCanvasElement;
  dpr = 1;
  private cubeProg: WebGLProgram;
  private partProg: WebGLProgram;
  private lineProg: WebGLProgram;
  private shadowProg: WebGLProgram;
  private cu: Record<string, WebGLUniformLocation | null>;
  private pu: Record<string, WebGLUniformLocation | null>;
  private lu: Record<string, WebGLUniformLocation | null>;
  private su: Record<string, WebGLUniformLocation | null>;
  private cubeVao: WebGLVertexArrayObject;
  private partVao: WebGLVertexArrayObject;
  private lineVao: WebGLVertexArrayObject;
  private shadowVao: WebGLVertexArrayObject;
  private instBuf: WebGLBuffer;
  private glyphBuf: WebGLBuffer;
  private aoBuf: WebGLBuffer;
  private partBuf: WebGLBuffer;
  private lineBuf: WebGLBuffer;
  private atlas: WebGLTexture;
  private partData = new Float32Array(0);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL 2 is not available');
    this.gl = gl;

    this.cubeProg = compile(gl, CUBE_VS, CUBE_FS);
    this.partProg = compile(gl, PART_VS, PART_FS);
    this.lineProg = compile(gl, LINE_VS, LINE_FS);
    this.shadowProg = compile(gl, SHADOW_VS, SHADOW_FS);
    this.cu = uniforms(gl, this.cubeProg, ['uViewProj', 'uOrigin', 'uFaceUp', 'uAtlas', 'uLightDir', 'uInk', 'uGlyphAlpha', 'uTime', 'uGreyDone']);
    this.pu = uniforms(gl, this.partProg, ['uViewProj', 'uOrigin', 'uLightDir']);
    this.lu = uniforms(gl, this.lineProg, ['uViewProj', 'uColor']);
    this.su = uniforms(gl, this.shadowProg, ['uViewProj', 'uCenter', 'uSize', 'uAlpha', 'uTint']);

    const mesh = cubeMesh();
    const meshBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, meshBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.verts, gl.STATIC_DRAW);
    const idxBuf = gl.createBuffer()!;

    const bindMesh = () => {
      gl.bindBuffer(gl.ARRAY_BUFFER, meshBuf);
      const stride = 10 * 4;
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 24);
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 32);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    };

    // Cube VAO
    this.cubeVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.cubeVao);
    bindMesh();
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);
    this.instBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 4, gl.FLOAT, false, INST_FLOATS * 4, 0);
    gl.vertexAttribDivisor(4, 1);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 3, gl.FLOAT, false, INST_FLOATS * 4, 16);
    gl.vertexAttribDivisor(5, 1);
    this.glyphBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glyphBuf);
    gl.enableVertexAttribArray(6);
    gl.vertexAttribIPointer(6, 1, gl.UNSIGNED_INT, 4, 0);
    gl.vertexAttribDivisor(6, 1);
    this.aoBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.aoBuf);
    gl.enableVertexAttribArray(7);
    gl.vertexAttribIPointer(7, 2, gl.UNSIGNED_INT, 8, 0);
    gl.vertexAttribDivisor(7, 1);

    // Particle VAO
    this.partVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.partVao);
    bindMesh();
    this.partBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    const ps = 12 * 4;
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 4, gl.FLOAT, false, ps, 0);
    gl.vertexAttribDivisor(4, 1);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 4, gl.FLOAT, false, ps, 16);
    gl.vertexAttribDivisor(5, 1);
    gl.enableVertexAttribArray(6);
    gl.vertexAttribPointer(6, 4, gl.FLOAT, false, ps, 32);
    gl.vertexAttribDivisor(6, 1);

    // Line VAO
    this.lineVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.lineVao);
    this.lineBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);

    // Shadow VAO
    this.shadowVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.shadowVao);
    const sb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);

    // Atlas texture
    this.atlas = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    const atlas = buildAtlas();
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, atlas.size, atlas.size, 0, gl.RED, gl.UNSIGNED_BYTE, atlas.data);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  }

  /** Sync the drawing buffer with the canvas CSS size. */
  resize(): { w: number; h: number } {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * this.dpr));
    const h = Math.max(1, Math.round(rect.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return { w: rect.width, h: rect.height };
  }

  /** Pick the in-plane axis per face that looks most "up" on screen, so numbers stay upright. */
  private faceUps(cam: OrbitCamera): Float32Array {
    const out = new Float32Array(18);
    const up = cam.up;
    FACES.forEach((f, i) => {
      let best: number[] = f.t1;
      let bestDot = -Infinity;
      for (const t of [f.t1, f.t2]) {
        for (const s of [1, -1]) {
          const d = (t[0] * up[0] + t[1] * up[1] + t[2] * up[2]) * s;
          if (d > bestDot + 1e-4) {
            bestDot = d;
            best = [t[0] * s, t[1] * s, t[2] * s];
          }
        }
      }
      out.set(best, i * 3);
    });
    return out;
  }

  render(cam: OrbitCamera, list: DrawList, target: { fbo: WebGLFramebuffer | null; w: number; h: number } | null = null): void {
    const gl = this.gl;
    const w = target ? target.w : this.canvas.width;
    const h = target ? target.h : this.canvas.height;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const dims = list.block?.dims ?? list.shadow?.dims ?? [1, 1, 1];
    const origin = [-(dims[0] - 1) / 2, -(dims[1] - 1) / 2, -(dims[2] - 1) / 2];

    if (list.shadow) {
      const [W, H, D] = list.shadow.dims;
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(this.shadowProg);
      gl.uniformMatrix4fv(this.su.uViewProj, false, cam.viewProj);
      gl.uniform3f(this.su.uCenter, 0, -H / 2 - 0.02, 0);
      gl.uniform2f(this.su.uSize, W * 0.62 + 1.4, D * 0.62 + 1.4);
      gl.uniform1f(this.su.uAlpha, list.shadow.alpha);
      gl.uniform3fv(this.su.uTint, list.shadow.tint ?? [0.1, 0.1, 0.2]);
      gl.bindVertexArray(this.shadowVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);

    const b = list.block;
    if (b && b.count > 0) {
      gl.useProgram(this.cubeProg);
      gl.uniformMatrix4fv(this.cu.uViewProj, false, cam.viewProj);
      gl.uniform3fv(this.cu.uOrigin, origin);
      gl.uniform3fv(this.cu.uFaceUp, this.faceUps(cam));
      gl.uniform3fv(this.cu.uLightDir, LIGHT);
      gl.uniform3fv(this.cu.uInk, list.ink ?? [0.13, 0.15, 0.23]);
      gl.uniform1f(this.cu.uGlyphAlpha, b.glyphAlpha);
      gl.uniform1f(this.cu.uTime, list.time ?? 0);
      gl.uniform1f(this.cu.uGreyDone, list.greyDone ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.atlas);
      gl.uniform1i(this.cu.uAtlas, 0);
      gl.bindVertexArray(this.cubeVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, b.inst.subarray(0, b.count * INST_FLOATS), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glyphBuf);
      gl.bufferData(gl.ARRAY_BUFFER, b.glyph.subarray(0, b.count), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.aoBuf);
      gl.bufferData(gl.ARRAY_BUFFER, b.ao.subarray(0, b.count * 2), gl.DYNAMIC_DRAW);
      gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, b.count);
    }

    const parts = list.particles?.list;
    if (parts && parts.length) {
      const n = parts.length;
      if (this.partData.length < n * 12) this.partData = new Float32Array(n * 24);
      const d = this.partData;
      parts.forEach((p, i) => {
        const o = i * 12;
        const t = p.life / p.maxLife;
        d[o] = p.x;
        d[o + 1] = p.y;
        d[o + 2] = p.z;
        d[o + 3] = p.size * (1 - t * t);
        d[o + 4] = p.rgb[0];
        d[o + 5] = p.rgb[1];
        d[o + 6] = p.rgb[2];
        d[o + 7] = 1;
        d[o + 8] = p.ax;
        d[o + 9] = p.ay;
        d[o + 10] = p.az;
        d[o + 11] = p.angle;
      });
      gl.useProgram(this.partProg);
      gl.uniformMatrix4fv(this.pu.uViewProj, false, cam.viewProj);
      gl.uniform3fv(this.pu.uOrigin, origin);
      gl.uniform3fv(this.pu.uLightDir, LIGHT);
      gl.bindVertexArray(this.partVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
      gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, n * 12), gl.DYNAMIC_DRAW);
      gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, n);
    }

    if (list.lines && list.lines.length) {
      gl.disable(gl.CULL_FACE);
      gl.useProgram(this.lineProg);
      gl.uniformMatrix4fv(this.lu.uViewProj, false, cam.viewProj);
      gl.bindVertexArray(this.lineVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      for (const batch of list.lines) {
        gl.uniform4fv(this.lu.uColor, batch.color);
        gl.bufferData(gl.ARRAY_BUFFER, batch.points, gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.LINES, 0, batch.points.length / 3);
      }
    }
    gl.bindVertexArray(null);
    gl.disable(gl.CULL_FACE);
  }

  /** Render a draw list offscreen and return a PNG data URL (for collection thumbnails). */
  snapshot(cam: OrbitCamera, list: DrawList, size: number): string {
    const gl = this.gl;
    const fbo = gl.createFramebuffer()!;
    const tex = gl.createRenderbuffer()!;
    const depth = gl.createRenderbuffer()!;
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) as number);
    gl.bindRenderbuffer(gl.RENDERBUFFER, tex);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, size, size);
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, size, size);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, tex);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    this.render(cam, list, { fbo, w: size, h: size });

    // Resolve multisampling into a plain framebuffer we can read.
    const rfbo = gl.createFramebuffer()!;
    const rtex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, rtex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, rfbo);
    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rtex, 0);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
    gl.blitFramebuffer(0, 0, size, size, 0, 0, size, size, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, rfbo);
    const px = new Uint8Array(size * size * 4);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteFramebuffer(rfbo);
    gl.deleteRenderbuffer(tex);
    gl.deleteRenderbuffer(depth);
    gl.deleteTexture(rtex);

    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      const src = (size - 1 - y) * size * 4;
      for (let x = 0; x < size * 4; x += 4) {
        const a = px[src + x + 3];
        const o = y * size * 4 + x;
        // un-premultiply
        img.data[o] = a ? Math.min(255, (px[src + x] * 255) / a) : 0;
        img.data[o + 1] = a ? Math.min(255, (px[src + x + 1] * 255) / a) : 0;
        img.data[o + 2] = a ? Math.min(255, (px[src + x + 2] * 255) / a) : 0;
        img.data[o + 3] = a;
      }
    }
    g.putImageData(img, 0, 0);
    return cv.toDataURL('image/png');
  }
}

/** Line segments for the 12 edges of an axis-aligned box in world space. */
export function boxEdges(min: number[], max: number[]): Float32Array {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const c = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const e = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
  return Float32Array.from(e.flatMap((i) => c[i]));
}
