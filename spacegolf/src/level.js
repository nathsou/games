// Level data helpers: validation, naming, sharing.

import { BODY_TYPES } from './physics.js';

export const LOOKS = ['moon', 'earth', 'desert', 'lava', 'ice', 'goo', 'jelly', 'gas'];

export function cloneLevel(l) {
  return JSON.parse(JSON.stringify(l));
}

export function emptyLevel(name = 'My Level') {
  return {
    name,
    bounds: { w: 1600, h: 900 },
    bodies: [],
    portals: [],
    winds: [],
    stars: [],
    tee: null,
    hole: null,
    par: 3,
    previewSec: 4,
  };
}

// Returns a list of human-readable problems (empty = playable).
export function validateLevel(l) {
  const out = [];
  if (!l || typeof l !== 'object') return ['not a level'];
  if (!Array.isArray(l.bodies) || l.bodies.length === 0) out.push('Add at least one planet.');
  else {
    l.bodies.forEach((b, i) => {
      if (!BODY_TYPES.includes(b.type)) out.push(`Body ${i + 1} has an unknown type.`);
      if (!(b.r > 0)) out.push(`Body ${i + 1} has no radius.`);
      if (b.orbit && typeof b.orbit.around === 'number' && !(b.orbit.around < i && b.orbit.around >= 0)) out.push(`Body ${i + 1} orbits a later body.`);
    });
  }
  if (!l.tee || typeof l.tee.body !== 'number' || !l.bodies[l.tee.body]) out.push('Place a tee on a planet.');
  else if (l.bodies[l.tee.body].type !== 'planet') out.push('The tee must sit on a planet.');
  if (!l.hole) out.push('Place a hole.');
  else if (typeof l.hole.body === 'number' && !l.bodies[l.hole.body]) out.push('The hole is attached to a missing body.');
  return out;
}

export function playable(l) {
  return validateLevel(l).length === 0;
}

// ---- sharing: JSON -> (deflate) -> base64url -----------------------------------------

function round(v) {
  return typeof v === 'number' ? Math.round(v * 100) / 100 : v;
}

function strip(l) {
  const c = cloneLevel(l);
  delete c.solution;
  delete c.generated;
  const walk = (o) => {
    if (Array.isArray(o)) return o.map(walk);
    if (o && typeof o === 'object') {
      const r = {};
      for (const k of Object.keys(o)) r[k] = walk(o[k]);
      return r;
    }
    return round(o);
  };
  return walk(c);
}

function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

async function pipe(bytes, stream) {
  const rs = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await rs.arrayBuffer());
}

export async function encodeLevel(level) {
  const json = JSON.stringify(strip(level));
  const raw = new TextEncoder().encode(json);
  if (typeof CompressionStream !== 'undefined') {
    try {
      return 'z' + b64url(await pipe(raw, new CompressionStream('deflate-raw')));
    } catch (e) { /* fall through */ }
  }
  return 'j' + b64url(raw);
}

export async function decodeLevel(text) {
  try {
    const kind = text[0];
    const bytes = unb64url(text.slice(1));
    let raw = bytes;
    if (kind === 'z') raw = await pipe(bytes, new DecompressionStream('deflate-raw'));
    else if (kind !== 'j') return null;
    const level = JSON.parse(new TextDecoder().decode(raw));
    return playable(level) ? level : null;
  } catch (e) {
    return null;
  }
}

// Nebula colours derived from a level's seed / index so each looks distinct.
export function paletteFor(level, salt = 0) {
  if (level.palette) return level.palette;
  const s = ((level.seed ?? 0) * 2654435761 + salt * 40503) >>> 0;
  const h1 = (s % 360) / 360;
  const h2 = ((s >>> 9) % 360) / 360;
  return {
    c1: hsl(h1, 0.7, 0.28),
    c2: hsl((h1 + 0.25 + h2 * 0.3) % 1, 0.75, 0.24),
    seed: (s % 997) / 31,
  };
}

function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}
