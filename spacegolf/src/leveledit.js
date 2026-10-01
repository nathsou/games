// Pure level-editing operations (no DOM) so they can be unit-tested.

import { LOOKS } from './level.js';

export const BODY_DEFAULTS = {
  planet: { r: 55, g: 200 },
  repulsor: { r: 24, g: 240 },
  blackhole: { r: 16, g: 4200 },
  sun: { r: 46, g: 170 },
};

let uid = 1;
const nextSeed = () => (Date.now() + uid++ * 7919) % 9973;

export function addBody(level, type, x, y, look) {
  const d = BODY_DEFAULTS[type];
  const b = { type, x: Math.round(x), y: Math.round(y), r: d.r, g: d.g, seed: nextSeed() };
  if (type === 'planet') b.look = look || LOOKS[level.bodies.filter((q) => q.type === 'planet').length % LOOKS.length];
  level.bodies.push(b);
  return level.bodies.length - 1;
}

// Remove a body and fix every index that referred to it or to a later body.
export function removeBody(level, i) {
  level.bodies.splice(i, 1);
  const fix = (idx) => (idx === i ? null : idx > i ? idx - 1 : idx);
  if (level.tee) {
    const t = fix(level.tee.body);
    if (t === null) level.tee = null;
    else level.tee.body = t;
  }
  if (level.hole && typeof level.hole.body === 'number') {
    const h = fix(level.hole.body);
    if (h === null) level.hole = null;
    else level.hole.body = h;
  }
  for (const b of level.bodies) {
    if (b.orbit && typeof b.orbit.around === 'number') {
      const a = fix(b.orbit.around);
      if (a === null) delete b.orbit;
      else b.orbit.around = a;
    }
  }
}

export function nearestBody(level, x, y, onlyPlanets = false) {
  let best = -1;
  let bd = Infinity;
  level.bodies.forEach((b, i) => {
    if (onlyPlanets && b.type !== 'planet') return;
    const d = Math.hypot(b.x - x, b.y - y) - b.r;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return { index: best, dist: bd };
}

// Put the tee on the planet nearest to (x, y), facing the point.
export function snapTee(level, x, y) {
  const n = nearestBody(level, x, y, true);
  if (n.index < 0) return false;
  const b = level.bodies[n.index];
  level.tee = { body: n.index, angle: +Math.atan2(y - b.y, x - b.x).toFixed(4) };
  return true;
}

// Attach the hole to a nearby body surface, or leave it floating in space.
export function snapHole(level, x, y) {
  const n = nearestBody(level, x, y, false);
  if (n.index >= 0 && n.dist < 55 && level.bodies[n.index].type !== 'blackhole' && level.bodies[n.index].type !== 'sun') {
    const b = level.bodies[n.index];
    level.hole = { body: n.index, angle: +Math.atan2(y - b.y, x - b.x).toFixed(4) };
  } else {
    level.hole = { x: Math.round(x), y: Math.round(y) };
  }
}

export function clampToBounds(level, p, pad = 20) {
  const hw = level.bounds.w / 2 - pad;
  const hh = level.bounds.h / 2 - pad;
  p.x = Math.max(-hw, Math.min(hw, p.x));
  p.y = Math.max(-hh, Math.min(hh, p.y));
}

export function setOrbit(level, i, on) {
  const b = level.bodies[i];
  if (!on) {
    delete b.orbit;
    return;
  }
  // orbit around the nearest other body (or the origin)
  let cx = 0;
  let cy = 0;
  let bd = Infinity;
  level.bodies.forEach((o, j) => {
    if (j === i) return;
    const d = Math.hypot(o.x - b.x, o.y - b.y);
    if (d < bd && !(o.orbit && o.orbit.around === i)) {
      bd = d;
      cx = o.x;
      cy = o.y;
    }
  });
  if (Math.hypot(b.x - cx, b.y - cy) < b.r + 30) {
    cx = 0;
    cy = 0;
  }
  b.orbit = { cx: Math.round(cx), cy: Math.round(cy), period: 30 };
}

const ADJ = ['Crimson', 'Silent', 'Lucky', 'Cosmic', 'Wobbly', 'Frozen', 'Electric', 'Tiny', 'Giant', 'Hidden', 'Sneaky', 'Golden', 'Rusty', 'Stellar', 'Midnight', 'Dizzy'];
const NOUN = ['Comet', 'Orbit', 'Nebula', 'Bogey', 'Birdie', 'Fairway', 'Putt', 'Eclipse', 'Pulsar', 'Asteroid', 'Quasar', 'Meteor', 'Crater', 'Horizon', 'Drift', 'Slingshot'];
export function randomName(rand = Math.random) {
  return `${ADJ[Math.floor(rand() * ADJ.length)]} ${NOUN[Math.floor(rand() * NOUN.length)]}`;
}
