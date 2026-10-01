// Brute-force shot search. Used to verify procedurally generated levels, to
// set par for hand-made levels (tools/solve.mjs) and by the tests.
//
// The search functions are generators that yield now and then so the browser
// can keep rendering while a level is being validated.

import { createWorld, newState, cloneState, shoot, step, waitUntil, DT, MAX_FLIGHT, hasMovingBodies } from './physics.js';

export function drain(gen) {
  let r;
  while (!(r = gen.next()).done);
  return r.value;
}

// Drive a generator from the browser without blocking the frame.
export function runAsync(gen, onProgress, budgetMs = 10) {
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        const t0 = performance.now();
        let r;
        do {
          r = gen.next();
          if (r.done) return resolve(r.value);
          if (typeof r.value === 'number' && onProgress) onProgress(r.value);
        } while (performance.now() - t0 < budgetMs);
        setTimeout(tick, 0);
      } catch (e) {
        reject(e);
      }
    };
    tick();
  });
}

export const POWERS = [0.2, 0.32, 0.45, 0.58, 0.72, 0.86, 1];

export function minPeriod(level) {
  let p = 0;
  for (const b of level.bodies || []) {
    if (b.orbit && b.orbit.period) {
      const a = Math.abs(b.orbit.period);
      p = p === 0 ? a : Math.min(p, a);
    }
  }
  return p;
}

// Launch times worth trying for a state: [t, t+dt, ...] covering one orbital period.
export function timeSamples(level, S, count) {
  if (!hasMovingBodies(level) || count <= 1) return [S.t];
  const T = minPeriod(level);
  const out = [];
  for (let k = 0; k < count; k++) out.push(S.t + (k * T) / count);
  return out;
}

// Fly one shot on a copy; returns the resulting state.
export function trial(w, S0, angle, power, t, maxTime = 20) {
  const S = cloneState(S0);
  if (t > S.t) waitUntil(w, S, t);
  shoot(w, S, angle, power);
  const maxSteps = Math.ceil(maxTime / DT);
  let steps = 0;
  while (S.ball.mode === 'fly' && steps < maxSteps) {
    step(w, S, DT);
    steps++;
  }
  return S;
}

function keepBest(list, item, cap) {
  list.push(item);
  list.sort((a, b) => a.miss - b.miss);
  if (list.length > cap) list.length = cap;
}

// Is there a single shot from S0 that drops the ball in the hole?
export function* searchOneShot(w, S0, opts = {}) {
  const level = w.level;
  const nA = opts.angles ?? 120;
  const powers = opts.powers ?? POWERS;
  const times = timeSamples(level, S0, opts.times ?? 6);
  const refine = opts.refine ?? true;
  const maxTime = opts.maxTime ?? 20;
  const misses = [];
  let count = 0;
  for (let ai = 0; ai < nA; ai++) {
    const angle = (ai / nA) * Math.PI * 2;
    for (const power of powers) {
      for (const t of times) {
        const S = trial(w, S0, angle, power, t, maxTime);
        if (S.ball.mode === 'captured') return { solved: true, shot: { t, angle, power } };
        if (refine) keepBest(misses, { angle, power, t, miss: S.minHole }, 6);
        if (++count % 300 === 0) yield ai / nA;
      }
    }
  }
  if (refine) {
    const dTheta = (Math.PI * 2) / nA;
    const T = minPeriod(level) || 1;
    const dtStep = times.length > 1 ? T / times.length : 0;
    for (const m of misses) {
      for (let da = -0.6; da <= 0.6001; da += 0.1) {
        for (let dp = -0.05; dp <= 0.0501; dp += 0.01) {
          for (let dt = dtStep ? -0.5 : 0; dt <= (dtStep ? 0.5001 : 0); dt += 0.25) {
            const angle = m.angle + da * dTheta;
            const power = Math.max(0.05, Math.min(1, m.power + dp));
            const t = Math.max(S0.t, m.t + dt * dtStep);
            const S = trial(w, S0, angle, power, t, maxTime);
            if (S.ball.mode === 'captured') return { solved: true, shot: { t, angle, power } };
            if (++count % 300 === 0) yield 1;
          }
        }
      }
    }
  }
  return { solved: false, tried: count };
}

// Breadth-first search for a short solution. Returns { par, shots } or null.
export function* solve(level, opts = {}) {
  const w = createWorld(level);
  const maxDepth = opts.maxDepth ?? 3;
  const beam = opts.beam ?? 24;
  const nA = opts.angles ?? 120;
  const powers = opts.powers ?? POWERS;
  let frontier = [{ S: newState(w), shots: [] }];
  const seen = new Set();
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = [];
    for (const node of frontier) {
      if (depth === 1 || !opts.skipDirect) {
        const r = yield* searchOneShot(w, node.S, { angles: nA, powers, times: opts.times ?? (depth === 1 ? 8 : 4) });
        if (r.solved) return { par: depth, shots: [...node.shots, r.shot] };
      }
      if (depth === maxDepth) continue;
      const times = timeSamples(level, node.S, opts.times ?? 4);
      for (let ai = 0; ai < nA; ai++) {
        const angle = (ai / nA) * Math.PI * 2;
        for (const power of powers) {
          for (const t of times) {
            const S = trial(w, node.S, angle, power, t);
            if (S.ball.mode !== 'rest' || S.penalties !== node.S.penalties) continue;
            if (S.lastRest.body === node.S.lastRest.body && Math.abs(S.lastRest.angle - node.S.lastRest.angle) < 0.15) continue;
            const key = `${S.lastRest.body}:${Math.round(S.lastRest.angle / 0.12)}:${w.level.bodies.length ? Math.round(S.t / 4) : 0}`;
            if (seen.has(key)) continue;
            seen.add(key);
            next.push({ S, shots: [...node.shots, { t, angle, power }] });
          }
        }
        yield (ai / nA) * 0.99;
      }
    }
    // keep the nodes closest to the hole
    next.sort((a, b) => holeDist(w, a.S) - holeDist(w, b.S));
    frontier = next.slice(0, beam);
    if (!frontier.length) break;
  }
  return null;
}

function holeDist(w, S) {
  // distance to the hole at the node's time (static approximation for sorting)
  const b = S.ball;
  const h = w.level.hole;
  let hx = h.x;
  let hy = h.y;
  if (typeof h.body === 'number') {
    const o = w.bodies[h.body];
    hx = o.x + Math.cos(h.angle) * o.r;
    hy = o.y + Math.sin(h.angle) * o.r;
  }
  return Math.hypot(b.x - hx, b.y - hy);
}
