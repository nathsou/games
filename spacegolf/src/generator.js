// Procedural level generator for endless mode.
//
// Levels are built *backwards from a solution*: we lay out a random star
// system, then fire a chain of simulated shots from the tee, always keeping
// the most interesting one, and put the hole where the last shot comes to
// rest. That makes every level solvable by construction, and the number of
// shots in the chain is its par. A coarse brute-force search then throws away
// levels that turn out to be a trivial hole-in-one.

import { RNG } from './rng.js';
import {
  createWorld, newState, cloneState, shoot, step, waitUntil, ensureBodies, replay, flyToEnd,
  DT, PORTAL_R, hasMovingBodies,
} from './physics.js';
import { searchOneShot, drain, robustness, trial, ROBUST_MIN } from './solver.js';

export const DIFFICULTIES = [
  null,
  { name: 'Rookie', planets: [2, 3], rad: [36, 72], legs: [1, 1], specials: 0, kinds: [], preview: 6, stars: 1 },
  { name: 'Amateur', planets: [3, 4], rad: [30, 72], legs: [2, 2], specials: 1, kinds: ['atmo', 'repulsor'], preview: 4, stars: 1 },
  { name: 'Pro', planets: [3, 5], rad: [26, 70], legs: [2, 3], specials: 2, kinds: ['atmo', 'repulsor', 'wind', 'moon'], preview: 3, stars: 2 },
  { name: 'Expert', planets: [4, 5], rad: [24, 66], legs: [3, 3], specials: 2, kinds: ['wind', 'moon', 'orbiter', 'wormhole', 'blackhole', 'sun', 'repulsor'], preview: 2.4, stars: 2 },
  { name: 'Master', planets: [4, 6], rad: [22, 64], legs: [3, 4], specials: 3, kinds: ['moon', 'orbiter', 'wormhole', 'blackhole', 'sun', 'wind', 'repulsor', 'atmo'], preview: 2, stars: 3 },
  { name: 'Cosmic', planets: [5, 7], rad: [20, 62], legs: [4, 4], specials: 4, kinds: ['moon', 'orbiter', 'wormhole', 'blackhole', 'sun', 'wind', 'repulsor', 'atmo'], preview: 1.6, stars: 3 },
];
export const MAX_DIFFICULTY = DIFFICULTIES.length - 1;

const W = 1600;
const H = 900;
const LOOKS = ['moon', 'earth', 'desert', 'lava', 'ice', 'moon', 'earth', 'desert', 'goo', 'jelly'];

function rseed(seed, attempt) {
  return (Math.imul(seed ^ 0x5bd1e995, 0x9e3779b1) + Math.imul(attempt + 1, 0x85ebca6b)) >>> 0;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function pairGap(a, b) {
  const big = (t) => (t === 'blackhole' ? 135 : t === 'sun' ? 100 : 72);
  return Math.max(big(a.type), big(b.type));
}

// Smallest (distance - radii - required gap) between any two bodies over time.
function dynamicClearance(level) {
  const w = createWorld(level);
  const bs = level.bodies;
  let worst = Infinity;
  const hasMove = hasMovingBodies(level);
  const samples = hasMove ? 32 : 1;
  for (let k = 0; k < samples; k++) {
    ensureBodies(w, k * 2);
    for (let i = 0; i < bs.length; i++) {
      const reach = bs[i].r + (bs[i].atmo || 0) * 0.3;
      if (Math.abs(w.px[i]) + reach > W / 2 - 25 || Math.abs(w.py[i]) + reach > H / 2 - 25) worst = Math.min(worst, -1);
      for (let j = i + 1; j < bs.length; j++) {
        const d = Math.hypot(w.px[i] - w.px[j], w.py[i] - w.py[j]);
        worst = Math.min(worst, d - bs[i].r - bs[j].r - pairGap(bs[i], bs[j]));
      }
    }
  }
  return worst;
}

function layout(rng, d) {
  const cfg = DIFFICULTIES[d];
  const bodies = [];
  const portals = [];
  const winds = [];
  const margin = 80;

  const clear = (x, y, r, gapOverride) => {
    for (const b of bodies) {
      const g = gapOverride ?? pairGap(b, { type: 'planet' });
      if (Math.hypot(b.x - x, b.y - y) < b.r + r + g) return false;
    }
    return true;
  };
  const place = (r, gap, tries = 150) => {
    for (let k = 0; k < tries; k++) {
      const x = rng.range(-W / 2 + margin + r, W / 2 - margin - r);
      const y = rng.range(-H / 2 + margin + r, H / 2 - margin - r);
      if (clear(x, y, r, gap)) return { x, y };
    }
    return null;
  };

  // planets
  const nPlanets = rng.int(cfg.planets[0], cfg.planets[1]);
  for (let i = 0; i < nPlanets; i++) {
    const r = Math.round(rng.range(cfg.rad[0], cfg.rad[1]));
    const p = place(r, 95);
    if (!p) continue;
    const look = d === 1 ? rng.pick(['moon', 'earth', 'desert', 'ice']) : rng.pick(LOOKS);
    bodies.push({ type: 'planet', x: Math.round(p.x), y: Math.round(p.y), r, g: Math.round(rng.range(130, 270)), look, seed: rng.int(1, 9999) });
  }
  if (bodies.length < 2) return null;

  // specials
  const kinds = rng.shuffle([...cfg.kinds]);
  let specials = 0;
  for (const kind of kinds) {
    if (specials >= cfg.specials) break;
    if (kind === 'atmo') {
      const cand = bodies.filter((b) => b.type === 'planet' && !b.atmo && b.r >= 36);
      if (!cand.length) continue;
      const b = rng.pick(cand);
      b.atmo = Math.round(rng.range(26, 44));
      b.drag = +rng.range(0.9, 1.6).toFixed(2);
      if (rng.chance(0.5)) b.look = 'gas';
      specials++;
    } else if (kind === 'repulsor') {
      const r = Math.round(rng.range(20, 30));
      const p = place(r, 100);
      if (!p) continue;
      bodies.push({ type: 'repulsor', x: Math.round(p.x), y: Math.round(p.y), r, g: Math.round(rng.range(180, 300)), seed: rng.int(1, 9999) });
      specials++;
    } else if (kind === 'blackhole') {
      const r = Math.round(rng.range(13, 18));
      const p = place(r, 135);
      if (!p) continue;
      bodies.push({ type: 'blackhole', x: Math.round(p.x), y: Math.round(p.y), r, g: Math.round(rng.range(3200, 5200)), seed: rng.int(1, 9999) });
      specials++;
    } else if (kind === 'sun') {
      const r = Math.round(rng.range(38, 54));
      const p = place(r, 105);
      if (!p) continue;
      bodies.push({ type: 'sun', x: Math.round(p.x), y: Math.round(p.y), r, g: Math.round(rng.range(140, 200)), seed: rng.int(1, 9999) });
      specials++;
    } else if (kind === 'moon') {
      const parents = bodies.map((b, i) => ({ b, i })).filter(({ b }) => b.type === 'planet' && !b.orbit && b.r >= 44);
      if (!parents.length) continue;
      const { b: par, i: pi } = rng.pick(parents);
      const r = Math.round(rng.range(13, 22));
      const ro = Math.round(par.r + r + rng.range(105, 165));
      const phi = rng.range(0, Math.PI * 2);
      const period = Math.round(rng.range(20, 38)) * rng.sign();
      bodies.push({
        type: 'planet', x: Math.round(par.x + Math.cos(phi) * ro), y: Math.round(par.y + Math.sin(phi) * ro), r,
        g: Math.round(rng.range(150, 230)), look: rng.pick(['moon', 'ice', 'desert']), seed: rng.int(1, 9999),
        orbit: { around: pi, period },
      });
      specials++;
    } else if (kind === 'orbiter') {
      const r = Math.round(rng.range(24, 38));
      const cx = Math.round(rng.range(-250, 250));
      const cy = Math.round(rng.range(-100, 100));
      const ro = Math.round(rng.range(130, 230));
      const phi = rng.range(0, Math.PI * 2);
      bodies.push({
        type: 'planet', x: Math.round(cx + Math.cos(phi) * ro), y: Math.round(cy + Math.sin(phi) * ro * 0.999), r,
        g: Math.round(rng.range(150, 250)), look: rng.pick(LOOKS), seed: rng.int(1, 9999),
        orbit: { cx, cy, period: Math.round(rng.range(34, 60)) * rng.sign() },
      });
      specials++;
    } else if (kind === 'wormhole') {
      for (let k = 0; k < 80; k++) {
        const a = { x: Math.round(rng.range(-W / 2 + 110, W / 2 - 110)), y: Math.round(rng.range(-H / 2 + 100, H / 2 - 100)) };
        const b = { x: Math.round(rng.range(-W / 2 + 110, W / 2 - 110)), y: Math.round(rng.range(-H / 2 + 100, H / 2 - 100)) };
        if (Math.hypot(a.x - b.x, a.y - b.y) < 420) continue;
        if (!clear(a.x, a.y, PORTAL_R, 80) || !clear(b.x, b.y, PORTAL_R, 80)) continue;
        portals.push({ a, b });
        specials++;
        break;
      }
    } else if (kind === 'wind') {
      const r = Math.round(rng.range(95, 160));
      const x = Math.round(rng.range(-W / 2 + 160, W / 2 - 160));
      const y = Math.round(rng.range(-H / 2 + 120, H / 2 - 120));
      const ang = rng.range(0, Math.PI * 2);
      const mag = rng.range(75, 130);
      winds.push({ x, y, r, ax: Math.round(Math.cos(ang) * mag), ay: Math.round(Math.sin(ang) * mag) });
      specials++;
    }
  }

  const level = { bounds: { w: W, h: H }, bodies, portals, winds, stars: [] };
  if (dynamicClearance(level) < 0) return null;

  // tee: on a static planet, facing the middle of the action
  const tees = bodies.map((b, i) => ({ b, i })).filter(({ b }) => b.type === 'planet' && !b.orbit);
  if (!tees.length) return null;
  const { b: tb, i: ti } = rng.pick(tees);
  let cx = 0;
  let cy = 0;
  let cn = 0;
  for (let i = 0; i < bodies.length; i++) {
    if (i === ti) continue;
    cx += bodies[i].x;
    cy += bodies[i].y;
    cn++;
  }
  const toward = Math.atan2(cy / cn - tb.y, cx / cn - tb.x);
  level.tee = { body: ti, angle: +(toward + rng.range(-0.9, 0.9)).toFixed(3) };
  return level;
}

// ---------------------------------------------------------------------------
// Shot chain
// ---------------------------------------------------------------------------

function wrapPi(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function evalShot(w, S0, angle, power, t) {
  const S = cloneState(S0);
  S.ev = [];
  if (t > S.t) waitUntil(w, S, t);
  const startT = S.t;
  shoot(w, S, angle, power);
  let len = 0;
  let turn = 0;
  let px = S.ball.x;
  let py = S.ball.y;
  let heading = Math.atan2(S.ball.vy, S.ball.vx);
  const near = new Set();
  const maxSteps = Math.ceil(12 / DT);
  for (let i = 1; S.ball.mode === 'fly' && i <= maxSteps; i++) {
    step(w, S, DT);
    if (i % 8 === 0) {
      const b = S.ball;
      len += Math.hypot(b.x - px, b.y - py);
      px = b.x;
      py = b.y;
      const h = Math.atan2(b.vy, b.vx);
      turn += Math.abs(wrapPi(h - heading));
      heading = h;
      for (let k = 0; k < w.n; k++) {
        if (Math.hypot(b.x - w.px[k], b.y - w.py[k]) - w.R[k] < 100) near.add(k);
      }
    }
  }
  const portal = S.ev.some((e) => e.type === 'portal');
  S.ev = null;
  return { S, len, turn, near, portal, startT, shot: { t: startT, angle, power } };
}

function buildChain(w, rng, legs, level) {
  let S = newState(w);
  const shots = [];
  const visited = new Set([S.lastRest.body]);
  let usedPortal = false;
  const moving = hasMovingBodies(level);
  const solids = [];
  for (let i = 0; i < w.n; i++) if (w.kind[i] === 'planet') solids.push(i);
  for (let leg = 0; leg < legs; leg++) {
    const cands = [];
    for (let c = 0; c < 70; c++) {
      let angle = rng.range(-Math.PI, Math.PI);
      if (w.portals.length && rng.chance(0.3)) {
        const p = w.portals[0];
        const e = rng.chance(0.5) ? p.a : p.b;
        const b = S.ball;
        angle = Math.atan2(e.y - b.y, e.x - b.x) + rng.range(-0.04, 0.04);
      } else if (rng.chance(0.4)) {
        // aim at a random planet, then perturb a little
        const k = rng.pick(solids);
        angle = Math.atan2(w.py[k] - S.ball.y, w.px[k] - S.ball.x) + rng.range(-0.5, 0.5);
      }
      const power = rng.range(0.28, 1);
      const t = moving ? S.t + rng.range(0, 12) : S.t;
      const r = evalShot(w, S, angle, power, t);
      const E = r.S;
      if (E.ball.mode !== 'rest' || E.penalties !== S.penalties) continue;
      const rb = E.lastRest;
      if (rb.body === S.lastRest.body && Math.abs(wrapPi(rb.angle - S.lastRest.angle)) < 1.1) continue;
      if (w.kind[rb.body] !== 'planet') continue;
      if (r.len < 260) continue;
      let score = r.len / 500 + r.turn * 0.9 + r.near.size * 0.7 + (r.portal ? 3 : 0);
      if (visited.has(rb.body)) continue; // every leg lands on a fresh planet
      cands.push({ r, score });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => b.score - a.score);
    const pick = cands[Math.min(cands.length - 1, rng.int(0, 2))];
    if (pick.r.portal) usedPortal = true;
    shots.push(pick.r.shot);
    S = pick.r.S;
    visited.add(S.lastRest.body);
  }
  return { shots, S, usedPortal };
}

// Sample points along a replayed solution (for placing pickups).
function samplePath(w, shots) {
  const S = newState(w);
  const pts = [];
  for (const sh of shots) {
    if (sh.t > S.t) waitUntil(w, S, sh.t);
    shoot(w, S, sh.angle, sh.power);
    let i = 0;
    while (S.ball.mode === 'fly' && i < 5400) {
      step(w, S, DT);
      i++;
      if (i % 40 === 0 && S.ball.mode === 'fly') pts.push({ x: S.ball.x, y: S.ball.y, leg: S.shots });
    }
  }
  return pts;
}

function placeStars(w, level, shots, count, rng) {
  const pts = samplePath(w, shots);
  const good = pts.filter((p) => {
    for (let i = 0; i < w.n; i++) {
      if (Math.hypot(p.x - w.px[i], p.y - w.py[i]) < w.R[i] + (w.atmo[i] || 0) + 40) return false;
    }
    return Math.abs(p.x) < W / 2 - 50 && Math.abs(p.y) < H / 2 - 50;
  });
  const out = [];
  rng.shuffle(good);
  for (const p of good) {
    if (out.length >= count) break;
    if (out.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 170)) out.push({ x: Math.round(p.x), y: Math.round(p.y) });
  }
  return out;
}

// Can a human actually play this solution? The last shot must tolerate small aim
// errors, and every earlier shot must reliably land on the same planet.
function humanPlayable(w, shots) {
  const S = newState(w);
  for (let i = 0; i < shots.length; i++) {
    const sh = shots[i];
    if (sh.t > S.t) waitUntil(w, S, sh.t);
    const pre = cloneState(S);
    if (i === shots.length - 1) {
      if (robustness(w, pre, sh) < ROBUST_MIN) return false;
    } else {
      const want = (() => {
        const e = trial(w, pre, sh.angle, sh.power, sh.t);
        return e.lastRest.body;
      })();
      let ok = 0;
      for (const da of [-1, 0, 1]) {
        for (const dp of [-1, 0, 1]) {
          const e = trial(w, pre, sh.angle + da * 0.014, Math.max(0.03, Math.min(1, sh.power + dp * 0.025)), sh.t);
          if (e.ball.mode === 'rest' && e.penalties === pre.penalties && e.lastRest.body === want) ok++;
        }
      }
      if (ok < 6) return false;
    }
    shoot(w, S, sh.angle, sh.power);
    flyToEnd(w, S);
  }
  return true;
}

// Place pickups at the given fractions (0..1) of the way along a solution's flight path.
export function placeStarsAlong(level, shots, fracs) {
  const w = createWorld({ ...level, stars: [] });
  const S = newState(w);
  const pts = [];
  let total = 0;
  let px = null;
  let py = null;
  for (const sh of shots) {
    if (sh.t > S.t) waitUntil(w, S, sh.t);
    shoot(w, S, sh.angle, sh.power);
    let i = 0;
    while (S.ball.mode === 'fly' && i < 5400) {
      step(w, S, DT);
      i++;
      if (i % 10 === 0 && S.ball.mode === 'fly') {
        if (px !== null) total += Math.hypot(S.ball.x - px, S.ball.y - py);
        px = S.ball.x;
        py = S.ball.y;
        pts.push({ x: px, y: py, d: total });
      }
    }
    px = null;
  }
  const out = [];
  const clearOf = (p) => {
    for (let i = 0; i < w.n; i++) {
      if (Math.hypot(p.x - w.px[i], p.y - w.py[i]) < w.R[i] + (w.atmo[i] || 0) + 42) return false;
    }
    for (const q of out) if (Math.hypot(q.x - p.x, q.y - p.y) < 140) return false;
    return Math.abs(p.x) < W / 2 - 50 && Math.abs(p.y) < H / 2 - 50;
  };
  for (const f of fracs) {
    const target = total * f;
    let best = null;
    for (const p of pts) {
      if (!clearOf(p)) continue;
      if (!best || Math.abs(p.d - target) < Math.abs(best.d - target)) best = p;
    }
    if (best) out.push({ x: Math.round(best.x), y: Math.round(best.y) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Generator function: yields progress (0..1) and returns the finished level.
export function* generateSteps(seed, difficulty) {
  const d = Math.max(1, Math.min(MAX_DIFFICULTY, difficulty | 0));
  const cfg = DIFFICULTIES[d];
  const MAX_ATTEMPTS = 60;
  let fallback = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    yield attempt / MAX_ATTEMPTS;
    const rng = new RNG(rseed(seed, attempt));
    const level = layout(rng, d);
    if (!level) continue;
    const solidCount = level.bodies.filter((b) => b.type === 'planet').length;
    const legs = Math.min(rng.int(cfg.legs[0], cfg.legs[1]), solidCount - 1);
    const w0 = createWorld({ ...level, hole: null });
    const chain = buildChain(w0, rng, legs, level);
    if (!chain) continue;
    if (w0.portals.length && !chain.usedPortal && attempt < 40) continue;

    // put the hole where the chain ends and verify the whole thing
    const end = chain.S.lastRest;
    level.hole = { body: end.body, angle: +end.angle.toFixed(4) };
    level.stars = [];
    const w = createWorld(level);
    const check = replay(w, chain.shots);
    if (check.ball.mode !== 'captured' || check.penalties) continue;
    const par = check.shots;
    if (par !== chain.shots.length) continue; // captured early: the hole is too exposed
    const used = chain.shots;
    if (!humanPlayable(w, used)) continue; // needle-thin solutions are no fun

    level.stars = placeStars(w, level, used, cfg.stars, rng);
    const w2 = createWorld(level);
    const check2 = replay(w2, used);
    if (check2.ball.mode !== 'captured' || check2.starsGot !== level.stars.length) {
      level.stars = [];
    }

    level.par = par;
    level.solution = used.map((s) => ({ t: s.t, angle: s.angle, power: s.power }));
    level.previewSec = cfg.preview;
    level.difficulty = d;
    level.seed = seed;

    if (par > 1) {
      const wv = createWorld(level);
      const r = yield* searchOneShot(wv, newState(wv), { angles: 90, powers: [0.3, 0.45, 0.6, 0.8, 1], times: 5, refine: true, maxTime: 12 });
      if (r.solved) {
        if (!fallback) fallback = level;
        continue;
      }
    }
    return finish(level, seed, d);
  }
  if (fallback) return finish(fallback, seed, d);
  if (d > 1) {
    // couldn't build a good one at this difficulty: fall back to an easier layout
    const easier = yield* generateSteps((seed ^ 0x2545f491) & 0x3fffffff, d - 1);
    return finish(easier, seed, d);
  }
  return finish(simpleLevel(seed), seed, d);
}

function finish(level, seed, d) {
  level.generated = true;
  level.seed = seed;
  level.difficulty = d;
  return level;
}

// Last-resort level: two planets, one shot.
function simpleLevel(seed) {
  const rng = new RNG(seed);
  const level = {
    bounds: { w: W, h: H },
    bodies: [
      { type: 'planet', x: -450, y: rng.int(-120, 120), r: 60, g: 200, look: 'earth', seed: 11 },
      { type: 'planet', x: 450, y: rng.int(-120, 120), r: 48, g: 200, look: 'moon', seed: 12 },
    ],
    portals: [],
    winds: [],
    stars: [],
    tee: { body: 0, angle: 0 },
    hole: { body: 1, angle: Math.PI },
    previewSec: 6,
  };
  const w = createWorld(level);
  const r = drain(searchOneShot(w, newState(w), { angles: 180, times: 1 }));
  level.par = 1;
  level.solution = r.solved ? [r.shot] : [];
  return level;
}

export function generateLevel(seed, difficulty) {
  return drain(generateSteps(seed, difficulty));
}
