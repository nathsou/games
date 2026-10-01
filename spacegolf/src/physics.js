// Spacegolf physics: a small deterministic N-body simulation.
//
// Everything here is pure (no DOM, no WebGL) so the exact same code drives the
// live game, the aiming preview, the level generator and the offline solver.
//
// Conventions
//  - World units are arbitrary; levels are ~1600 x 900 centred on the origin.
//  - +x is right, +y is DOWN (same as the screen). Angles are atan2(dy, dx).
//  - Bodies may orbit on analytic circles, so their position is a pure
//    function of time and the whole simulation is replayable.

export const DT = 1 / 180;
export const BALL_R = 5;
export const V_MAX = 560; // launch speed at full power
export const MAX_DRAG = 150; // drag distance (world units) for full power
export const MIN_DRAG = 8; // shorter drags cancel the shot
export const CAPTURE_R = 15; // hole capture radius
export const CAPTURE_V = 190; // max speed relative to the hole to be captured
export const HOLE_PULL_R = 38; // little funnel that helps the ball fall in
export const HOLE_PULL = 380;
export const MAX_FLIGHT = 30; // seconds before the ball is recalled
export const PORTAL_R = 18;
export const STAR_R = 17;
export const OOB_MARGIN = 40;
export const SPEED_CAP = 1800;
const REST_VN = 24; // bounces slower than this become sliding contact
const REST_V = 16; // sliding slower than this comes to rest

export const SURFACES = {
  rock: { e: 0.4, grip: 0.45, roll: 1.1 },
  ice: { e: 0.55, grip: 0.02, roll: 0.1 },
  rubber: { e: 0.93, grip: 0.3, roll: 1.6 },
  tar: { e: 0, grip: 1, roll: 9, sticky: true },
};

// Which surface each planet look has by default.
export const LOOK_SURFACE = {
  moon: 'rock',
  earth: 'rock',
  desert: 'rock',
  lava: 'rock',
  ice: 'ice',
  goo: 'tar',
  jelly: 'rubber',
  gas: 'rubber',
};

export const BODY_TYPES = ['planet', 'repulsor', 'blackhole', 'sun'];

// ---------------------------------------------------------------------------
// World construction
// ---------------------------------------------------------------------------

export function bodyMu(b) {
  if (typeof b.mu === 'number') return b.mu;
  const g = typeof b.g === 'number' ? b.g : 200;
  if (b.type === 'repulsor') return -Math.abs(g) * b.r * b.r;
  if (b.type === 'blackhole') return (typeof b.g === 'number' ? b.g : 5200) * b.r * b.r;
  return g * b.r * b.r;
}

export function bodySurface(b) {
  if (b.surface) return b.surface;
  if (b.type === 'repulsor') return 'rubber';
  return LOOK_SURFACE[b.look] || 'rock';
}

export function createWorld(level) {
  const bs = level.bodies || [];
  const n = bs.length;
  const w = {
    level,
    n,
    bodies: bs,
    mu: new Float64Array(n),
    R: new Float64Array(n),
    eps2: new Float64Array(n),
    atmo: new Float64Array(n),
    drag: new Float64Array(n),
    px: new Float64Array(n),
    py: new Float64Array(n),
    pvx: new Float64Array(n),
    pvy: new Float64Array(n),
    kind: new Array(n),
    surf: new Array(n),
    orb: new Array(n),
    winds: level.winds || [],
    portals: level.portals || [],
    stars: level.stars || [],
    hole: level.hole || null,
    hx: 1e9,
    hy: 1e9,
    hvx: 0,
    hvy: 0,
    hnx: 0,
    hny: -1,
    tb: NaN,
    halfW: (level.bounds ? level.bounds.w : 1600) / 2,
    halfH: (level.bounds ? level.bounds.h : 900) / 2,
  };
  for (let i = 0; i < n; i++) {
    const b = bs[i];
    w.mu[i] = bodyMu(b);
    w.R[i] = b.r;
    w.eps2[i] = b.type === 'blackhole' ? Math.pow(b.r * 0.6, 2) : b.type === 'repulsor' ? Math.pow(b.r * 0.3, 2) : 1;
    w.atmo[i] = b.atmo || 0;
    w.drag[i] = b.drag || 1.1;
    w.kind[i] = b.type || 'planet';
    w.surf[i] = SURFACES[bodySurface(b)] || SURFACES.rock;
    const o = b.orbit;
    if (o && o.period) {
      const wv = (Math.PI * 2) / o.period;
      if (typeof o.around === 'number' && o.around >= 0) {
        const p = bs[o.around];
        const ox = b.x - p.x;
        const oy = b.y - p.y;
        w.orb[i] = { around: o.around, cx: 0, cy: 0, r: Math.hypot(ox, oy), a0: Math.atan2(oy, ox), wv };
      } else {
        const ox = b.x - o.cx;
        const oy = b.y - o.cy;
        w.orb[i] = { around: -1, cx: o.cx, cy: o.cy, r: Math.hypot(ox, oy), a0: Math.atan2(oy, ox), wv };
      }
    } else {
      w.orb[i] = null;
    }
  }
  ensureBodies(w, 0);
  return w;
}

export function ensureBodies(w, t) {
  if (w.tb === t) return;
  w.tb = t;
  for (let i = 0; i < w.n; i++) {
    const o = w.orb[i];
    if (!o) {
      const b = w.bodies[i];
      w.px[i] = b.x;
      w.py[i] = b.y;
      w.pvx[i] = 0;
      w.pvy[i] = 0;
    } else {
      const a = o.a0 + o.wv * t;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const bx = o.around >= 0 ? w.px[o.around] : o.cx;
      const by = o.around >= 0 ? w.py[o.around] : o.cy;
      w.px[i] = bx + o.r * c;
      w.py[i] = by + o.r * s;
      const pvx = o.around >= 0 ? w.pvx[o.around] : 0;
      const pvy = o.around >= 0 ? w.pvy[o.around] : 0;
      w.pvx[i] = pvx - o.r * o.wv * s;
      w.pvy[i] = pvy + o.r * o.wv * c;
    }
  }
  const h = w.hole;
  if (h) {
    if (typeof h.body === 'number') {
      const i = h.body;
      const c = Math.cos(h.angle);
      const s = Math.sin(h.angle);
      w.hx = w.px[i] + c * w.R[i];
      w.hy = w.py[i] + s * w.R[i];
      w.hvx = w.pvx[i];
      w.hvy = w.pvy[i];
      w.hnx = c;
      w.hny = s;
    } else {
      w.hx = h.x;
      w.hy = h.y;
      w.hvx = 0;
      w.hvy = 0;
      w.hnx = 0;
      w.hny = -1;
    }
  } else {
    w.hx = w.hy = 1e9;
  }
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

export function newState(w) {
  const tee = w.level.tee;
  const S = {
    t: 0,
    ball: { x: 0, y: 0, vx: 0, vy: 0, mode: 'rest', body: tee.body, angle: tee.angle },
    lastRest: { body: tee.body, angle: tee.angle },
    stars: new Uint8Array(w.stars.length),
    starsGot: 0,
    shots: 0,
    penalties: 0,
    flightT: 0,
    portalCd: 0,
    aValid: false,
    ax: 0,
    ay: 0,
    minHole: 1e9,
    ev: null, // set to [] to receive events
  };
  ensureBodies(w, 0);
  placeOnBody(w, S.ball);
  return S;
}

export function cloneState(S) {
  return {
    t: S.t,
    ball: { ...S.ball },
    lastRest: { ...S.lastRest },
    stars: S.stars.slice(),
    starsGot: S.starsGot,
    shots: S.shots,
    penalties: S.penalties,
    flightT: S.flightT,
    portalCd: S.portalCd,
    aValid: S.aValid,
    ax: S.ax,
    ay: S.ay,
    minHole: S.minHole,
    ev: null,
  };
}

export function strokes(S) {
  return S.shots + S.penalties;
}

function placeOnBody(w, b) {
  const i = b.body;
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  const d = w.R[i] + BALL_R;
  b.x = w.px[i] + c * d;
  b.y = w.py[i] + s * d;
  b.vx = w.pvx[i];
  b.vy = w.pvy[i];
}

// Position of a resting ball at world time t (used by the aiming UI).
export function restPosition(w, S) {
  ensureBodies(w, S.t);
  const b = S.ball;
  if (b.mode === 'rest') placeOnBody(w, b);
  return b;
}

export function shoot(w, S, angle, power) {
  const b = S.ball;
  if (b.mode !== 'rest') return false;
  ensureBodies(w, S.t);
  placeOnBody(w, b);
  const i = b.body;
  const v = V_MAX * Math.max(0, Math.min(1, power));
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  b.vx = w.pvx[i] + c * v;
  b.vy = w.pvy[i] + s * v;
  // lift off a hair so a shot that points away from the ground is not "inside" it
  const nx = Math.cos(b.angle);
  const ny = Math.sin(b.angle);
  b.x += nx * 0.5;
  b.y += ny * 0.5;
  b.mode = 'fly';
  S.flightT = 0;
  S.shots++;
  S.aValid = false;
  S.portalCd = 0;
  S.minHole = 1e9;
  if (S.ev) S.ev.push({ type: 'shoot', x: b.x, y: b.y, angle, power });
  return true;
}

export function recall(w, S) {
  const b = S.ball;
  b.mode = 'rest';
  b.body = S.lastRest.body;
  b.angle = S.lastRest.angle;
  S.flightT = 0;
  S.aValid = false;
  ensureBodies(w, S.t);
  placeOnBody(w, b);
}

function lose(w, S, reason, penalty) {
  const b = S.ball;
  if (S.ev) S.ev.push({ type: 'lost', reason, x: b.x, y: b.y });
  if (penalty) S.penalties++;
  recall(w, S);
}

function settle(w, S, i, nx, ny) {
  const b = S.ball;
  b.mode = 'rest';
  b.body = i;
  b.angle = Math.atan2(ny, nx);
  S.lastRest.body = i;
  S.lastRest.angle = b.angle;
  S.aValid = false;
  S.flightT = 0;
  placeOnBody(w, b);
  if (S.ev) S.ev.push({ type: 'rest', x: b.x, y: b.y, body: i });
  // rolled to a stop right next to the hole: it drops in
  if (w.hole) {
    const dx = b.x - w.hx;
    const dy = b.y - w.hy;
    if (dx * dx + dy * dy < CAPTURE_R * CAPTURE_R * 1.7) capture(w, S);
  }
}

function capture(w, S) {
  const b = S.ball;
  b.mode = 'captured';
  if (S.ev) S.ev.push({ type: 'capture', x: w.hx, y: w.hy });
}

// ---------------------------------------------------------------------------
// Integration
// ---------------------------------------------------------------------------

const A = { x: 0, y: 0 };

function accelAt(w, x, y) {
  let ax = 0;
  let ay = 0;
  const { n, px, py, mu, eps2 } = w;
  for (let i = 0; i < n; i++) {
    const dx = px[i] - x;
    const dy = py[i] - y;
    const d2 = dx * dx + dy * dy + eps2[i];
    const k = mu[i] / (d2 * Math.sqrt(d2));
    ax += dx * k;
    ay += dy * k;
  }
  const ws = w.winds;
  for (let i = 0; i < ws.length; i++) {
    const z = ws[i];
    const dx = x - z.x;
    const dy = y - z.y;
    if (dx * dx + dy * dy < z.r * z.r) {
      ax += z.ax;
      ay += z.ay;
    }
  }
  if (w.hole) {
    const dx = w.hx - x;
    const dy = w.hy - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < HOLE_PULL_R * HOLE_PULL_R && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      const k = (HOLE_PULL * (1 - d / HOLE_PULL_R)) / d;
      ax += dx * k;
      ay += dy * k;
    }
  }
  A.x = ax;
  A.y = ay;
}

// Net acceleration at a point (used to draw gravity hints in the UI).
export function accelerationAt(w, t, x, y) {
  ensureBodies(w, t);
  accelAt(w, x, y);
  return { x: A.x, y: A.y };
}

export function step(w, S, dt = DT) {
  const b = S.ball;
  if (b.mode === 'captured') {
    S.t += dt;
    return;
  }
  if (b.mode === 'rest') {
    S.t += dt;
    if (S.portalCd > 0) S.portalCd -= dt;
    ensureBodies(w, S.t);
    placeOnBody(w, b);
    return;
  }

  // --- flying: velocity Verlet --------------------------------------------
  ensureBodies(w, S.t);
  if (!S.aValid) {
    accelAt(w, b.x, b.y);
    S.ax = A.x;
    S.ay = A.y;
    S.aValid = true;
  }
  const nx = b.x + b.vx * dt + 0.5 * S.ax * dt * dt;
  const ny = b.y + b.vy * dt + 0.5 * S.ay * dt * dt;
  S.t += dt;
  S.flightT += dt;
  if (S.portalCd > 0) S.portalCd -= dt;
  ensureBodies(w, S.t);
  accelAt(w, nx, ny);
  b.vx += 0.5 * (S.ax + A.x) * dt;
  b.vy += 0.5 * (S.ay + A.y) * dt;
  S.ax = A.x;
  S.ay = A.y;
  b.x = nx;
  b.y = ny;

  const sp2 = b.vx * b.vx + b.vy * b.vy;
  if (sp2 > SPEED_CAP * SPEED_CAP) {
    const k = SPEED_CAP / Math.sqrt(sp2);
    b.vx *= k;
    b.vy *= k;
  }

  const { n, px, py, pvx, pvy, R } = w;

  // --- atmospheres, black holes, solid contact ----------------------------
  for (let i = 0; i < n; i++) {
    const dx = b.x - px[i];
    const dy = b.y - py[i];
    const d2 = dx * dx + dy * dy;
    const kind = w.kind[i];
    const reach = R[i] + w.atmo[i] + BALL_R;
    if (d2 > reach * reach) continue;
    const dist = Math.sqrt(d2);

    if (w.atmo[i] > 0 && dist < R[i] + w.atmo[i]) {
      const f = 1 - (dist - R[i]) / w.atmo[i];
      const k = 1 - Math.exp(-w.drag[i] * f * f * dt);
      b.vx -= (b.vx - pvx[i]) * k;
      b.vy -= (b.vy - pvy[i]) * k;
    }

    if (kind === 'blackhole') {
      if (dist < R[i]) {
        lose(w, S, 'swallowed', true);
        return;
      }
      continue;
    }

    const minD = R[i] + BALL_R;
    if (dist >= minD) continue;
    if (kind === 'sun') {
      lose(w, S, 'burned', true);
      return;
    }
    const inv = dist > 1e-6 ? 1 / dist : 0;
    const cx = dist > 1e-6 ? dx * inv : 1;
    const cy = dist > 1e-6 ? dy * inv : 0;
    b.x = px[i] + cx * minD;
    b.y = py[i] + cy * minD;
    const rvx = b.vx - pvx[i];
    const rvy = b.vy - pvy[i];
    const vn = rvx * cx + rvy * cy;
    if (vn >= 0) continue;
    const surf = w.surf[i];
    S.aValid = false;
    if (surf.sticky) {
      if (S.ev) S.ev.push({ type: 'bounce', x: b.x, y: b.y, speed: -vn, body: i, soft: true });
      settle(w, S, i, cx, cy);
      return;
    }
    let tvx = rvx - vn * cx;
    let tvy = rvy - vn * cy;
    let nvn = -vn * surf.e;
    const impact = -vn;
    if (nvn < REST_VN) nvn = 0;
    const grip = 1 - Math.pow(1 - surf.grip, Math.min(1, impact / 140 + 0.15));
    tvx *= 1 - grip;
    tvy *= 1 - grip;
    if (nvn === 0) {
      // sliding contact: rolling resistance
      const k = Math.exp(-surf.roll * dt);
      tvx *= k;
      tvy *= k;
    }
    b.vx = pvx[i] + tvx + cx * nvn;
    b.vy = pvy[i] + tvy + cy * nvn;
    if (impact > 45 && S.ev) S.ev.push({ type: 'bounce', x: b.x, y: b.y, speed: impact, body: i, surface: bodySurface(w.bodies[i]) });
    if (nvn === 0 && tvx * tvx + tvy * tvy < REST_V * REST_V) {
      settle(w, S, i, cx, cy);
      return;
    }
  }

  // --- hole ---------------------------------------------------------------
  if (w.hole) {
    const dx = b.x - w.hx;
    const dy = b.y - w.hy;
    const d2 = dx * dx + dy * dy;
    if (d2 < S.minHole) S.minHole = d2;
    if (d2 < CAPTURE_R * CAPTURE_R) {
      const rvx = b.vx - w.hvx;
      const rvy = b.vy - w.hvy;
      if (rvx * rvx + rvy * rvy < CAPTURE_V * CAPTURE_V) {
        capture(w, S);
        return;
      }
    }
  }

  // --- pickups --------------------------------------------------------------
  const st = w.stars;
  for (let i = 0; i < st.length; i++) {
    if (S.stars[i]) continue;
    const dx = b.x - st[i].x;
    const dy = b.y - st[i].y;
    if (dx * dx + dy * dy < STAR_R * STAR_R) {
      S.stars[i] = 1;
      S.starsGot++;
      if (S.ev) S.ev.push({ type: 'star', index: i, x: st[i].x, y: st[i].y });
    }
  }

  // --- wormholes ----------------------------------------------------------
  if (S.portalCd <= 0) {
    const ps = w.portals;
    for (let i = 0; i < ps.length; i++) {
      for (let e = 0; e < 2; e++) {
        const from = e === 0 ? ps[i].a : ps[i].b;
        const to = e === 0 ? ps[i].b : ps[i].a;
        const dx = b.x - from.x;
        const dy = b.y - from.y;
        if (dx * dx + dy * dy < PORTAL_R * PORTAL_R) {
          const sp = Math.hypot(b.vx, b.vy) || 1;
          if (S.ev) S.ev.push({ type: 'portal', x: from.x, y: from.y, x2: to.x, y2: to.y });
          b.x = to.x + (b.vx / sp) * (PORTAL_R + BALL_R + 3);
          b.y = to.y + (b.vy / sp) * (PORTAL_R + BALL_R + 3);
          S.portalCd = 0.3;
          S.aValid = false;
          i = ps.length;
          break;
        }
      }
    }
  }

  // --- out of bounds / timeout ---------------------------------------------
  if (Math.abs(b.x) > w.halfW + OOB_MARGIN || Math.abs(b.y) > w.halfH + OOB_MARGIN) {
    lose(w, S, 'space', true);
    return;
  }
  if (S.flightT > MAX_FLIGHT) {
    if (S.ev) S.ev.push({ type: 'lost', reason: 'drift', x: b.x, y: b.y });
    recall(w, S);
  }
}

// Advance a resting ball to absolute world time t (used to wait for a planet to line up).
export function waitUntil(w, S, t) {
  if (S.ball.mode !== 'rest') return;
  S.t = t;
  ensureBodies(w, t);
  placeOnBody(w, S.ball);
}

// ---------------------------------------------------------------------------
// Prediction
// ---------------------------------------------------------------------------

// Simulate a shot on a copy of the state. Returns sampled points (for the aim
// preview) and the final state.
export function simulateShot(w, S0, angle, power, opts = {}) {
  const maxTime = opts.maxTime ?? MAX_FLIGHT;
  const stride = opts.stride ?? 6;
  const S = cloneState(S0);
  const pts = opts.collect ? [] : null;
  if (!shoot(w, S, angle, power)) return { S, pts, steps: 0 };
  const maxSteps = Math.ceil(maxTime / DT);
  let steps = 0;
  if (pts) pts.push(S.ball.x, S.ball.y);
  while (S.ball.mode === 'fly' && steps < maxSteps) {
    step(w, S);
    steps++;
    if (pts && steps % stride === 0) pts.push(S.ball.x, S.ball.y);
    if (S.shots !== S0.shots + 1) break;
  }
  if (pts) pts.push(S.ball.x, S.ball.y);
  return { S, pts, steps };
}

// Run a full flight to its end (rest / captured / recalled).
export function flyToEnd(w, S, maxTime = MAX_FLIGHT + 1) {
  const maxSteps = Math.ceil(maxTime / DT);
  let steps = 0;
  while (S.ball.mode === 'fly' && steps < maxSteps) {
    step(w, S);
    steps++;
  }
  return steps;
}

// Replay a list of shots [{t, angle, power}] from the start; returns the final state.
export function replay(w, shots) {
  const S = newState(w);
  for (const sh of shots) {
    if (S.ball.mode === 'captured') break;
    if (typeof sh.t === 'number' && sh.t > S.t) waitUntil(w, S, sh.t);
    shoot(w, S, sh.angle, sh.power);
    flyToEnd(w, S);
  }
  return S;
}

export function hasMovingBodies(level) {
  return (level.bodies || []).some((b) => b.orbit && b.orbit.period);
}

// Longest orbital period in the level (used to sample launch times).
export function maxPeriod(level) {
  let p = 0;
  for (const b of level.bodies || []) if (b.orbit && b.orbit.period) p = Math.max(p, Math.abs(b.orbit.period));
  return p;
}
