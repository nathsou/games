// Hand-made campaign levels.
//
// Authoring shorthand: tee: [bodyIndex, degrees], hole: [bodyIndex, degrees] or {x,y}.
// Degrees: 0 = right, 90 = down, 180 = left, 270 = up (y points down on screen).
// `par` is verified by tools/solve.mjs, which searches for a solution and also
// stores one so the test-suite can replay every level.

const rad = (d) => (d * Math.PI) / 180;
let seedCounter = 100;

export const planet = (x, y, r, look, o = {}) => ({ type: 'planet', x, y, r, look, g: 200, seed: ++seedCounter, ...o });
export const repulsor = (x, y, r, o = {}) => ({ type: 'repulsor', x, y, r, g: 240, seed: ++seedCounter, ...o });
export const blackhole = (x, y, r, o = {}) => ({ type: 'blackhole', x, y, r, g: 4200, seed: ++seedCounter, ...o });
export const sun = (x, y, r, o = {}) => ({ type: 'sun', x, y, r, g: 170, seed: ++seedCounter, ...o });

import { SOLUTIONS } from './solutions.js';

function build(id, name, def) {
  const sol = SOLUTIONS[id];
  const level = {
    id,
    name,
    bounds: { w: 1600, h: 900 },
    bodies: def.bodies,
    portals: def.portals || [],
    winds: def.winds || [],
    stars: sol && sol.stars ? sol.stars : def.stars || [],
    starFracs: def.starFracs,
    tee: { body: def.tee[0], angle: rad(def.tee[1]) },
    hole: Array.isArray(def.hole) ? { body: def.hole[0], angle: rad(def.hole[1]) } : def.hole,
    par: sol ? sol.par : def.par ?? 2,
    previewSec: def.preview ?? 4,
    hint: def.hint,
    palette: def.palette,
    solution: sol ? sol.shots : undefined,
  };
  return level;
}

export const WORLDS = [];

function world(id, name, blurb, look, colors, levels) {
  const w = { id, name, blurb, look, colors, levels: [] };
  levels.forEach((l, i) => w.levels.push(build(`${id}-${i + 1}`, l.name, l)));
  WORLDS.push(w);
}


// ---- World 1 ---------------------------------------------------------------------------
world('w1', 'Home Orbit', 'Learn the pull of gravity', 'earth', { c1: [0.1, 0.22, 0.6], c2: [0.04, 0.42, 0.45] }, [
  {
    name: 'First Swing',
    bodies: [planet(-520, 60, 70, 'earth', { g: 180 }), planet(480, -40, 55, 'moon', { g: 170 })],
    tee: [0, -20], hole: [1, 190], preview: 8, starFracs: [0.5],
    hint: 'Drag anywhere to pull back, then release to launch. Get the ball in the hole in as few strokes as you can.',
  },
  {
    name: 'Over the Hill',
    bodies: [planet(-600, 140, 60, 'earth', { g: 190 }), planet(-20, 40, 95, 'desert', { g: 210 }), planet(560, -120, 55, 'moon', { g: 180 })],
    tee: [0, -30], hole: [2, 30], preview: 7, starFracs: [0.5],
    hint: 'Gravity bends your path. Use it to curl a shot around a planet.',
  },
  {
    name: 'Stepping Stones',
    bodies: [planet(-620, 200, 58, 'earth'), planet(-150, -120, 40, 'ice'), planet(260, 150, 36, 'moon'), planet(640, -170, 52, 'desert')],
    tee: [0, -50], hole: [3, 0], preview: 6, starFracs: [0.5, 0.85],
    hint: 'Balls come to rest on planets. Land on one, then take your next shot from there.',
  },
  {
    name: 'Gravity Assist',
    bodies: [planet(0, 0, 100, 'earth', { g: 250 }), planet(520, 300, 45, 'moon'), planet(-560, -260, 50, 'lava')],
    tee: [1, 220], hole: [2, 210], preview: 6, starFracs: [0.45],
    hint: 'Swing close to a big planet to bend your flight around it.',
  },
  {
    name: 'Ice Rink',
    bodies: [planet(-560, -100, 60, 'earth'), planet(200, 60, 80, 'ice', { g: 190 }), planet(560, -300, 40, 'moon')],
    tee: [0, 20], hole: [1, 330], preview: 5, starFracs: [0.45],
    hint: 'Ice is slippery: a ball that lands on it slides a long way.',
  },
  {
    name: 'Island Hopper',
    bodies: [planet(-640, -200, 50, 'moon'), planet(-260, 230, 60, 'earth'), planet(200, -180, 50, 'desert'), planet(600, 210, 58, 'ice')],
    tee: [0, 30], hole: [3, 90], preview: 4.5, starFracs: [0.3, 0.6, 0.9],
  },
]);

// ---- World 2 ---------------------------------------------------------------------------
world('w2', 'Strange Surfaces', 'Goo, jelly, ice and thick air', 'jelly', { c1: [0.1, 0.45, 0.35], c2: [0.45, 0.12, 0.45] }, [
  {
    name: 'Sticky Situation',
    bodies: [planet(-620, 150, 55, 'earth'), planet(-60, -60, 72, 'goo', { g: 200 }), planet(580, 140, 50, 'moon'), planet(160, 300, 55, 'desert')],
    tee: [0, -30], hole: [2, 30], preview: 5, starFracs: [0.5],
    hint: 'Goo is sticky: the ball stays exactly where it lands.',
  },
  {
    name: 'Bounce House',
    bodies: [planet(-620, -150, 55, 'earth'), planet(-120, 150, 70, 'jelly', { g: 190 }), planet(230, -170, 60, 'jelly', { g: 190 }), planet(620, 200, 55, 'moon')],
    tee: [0, 40], hole: [3, 30], preview: 5, starFracs: [0.5],
    hint: 'Jelly planets are bouncy. Use them for bank shots.',
  },
  {
    name: 'Thick Air',
    bodies: [planet(0, 0, 100, 'gas', { g: 230, atmo: 60, drag: 1.5 }), planet(-620, -80, 50, 'moon'), planet(620, 100, 50, 'ice')],
    tee: [1, 10], hole: [2, 60], preview: 4.5, starFracs: [0.5],
    hint: 'Atmospheres slow you down. Dip into one to brake.',
  },
  {
    name: "Slip 'n Slide",
    bodies: [planet(-640, 250, 55, 'earth'), planet(-180, 30, 80, 'ice'), planet(350, -200, 70, 'ice'), planet(480, 250, 45, 'ice')],
    tee: [0, -60], hole: [3, 185], preview: 4.5, starFracs: [0.4, 0.8],
  },
  {
    name: 'Pinball',
    bodies: [planet(-650, 150, 55, 'earth'), planet(-100, -100, 55, 'jelly'), planet(150, -120, 50, 'jelly'), planet(40, 140, 62, 'goo'), planet(620, -250, 50, 'moon')],
    tee: [0, -20], hole: [4, 60], preview: 4, starFracs: [0.4, 0.75],
  },
  {
    name: 'Surface Tension',
    bodies: [planet(-640, -250, 48, 'moon'), planet(-300, 120, 60, 'goo'), planet(60, -200, 70, 'jelly'), planet(120, 220, 55, 'gas', { atmo: 40, g: 220 }), planet(600, 40, 60, 'ice')],
    tee: [0, 70], hole: [4, 170], preview: 3.5, starFracs: [0.3, 0.6, 0.9],
  },
]);

// ---- World 3 ---------------------------------------------------------------------------
world('w3', 'Moving Parts', 'Planets on the move', 'desert', { c1: [0.5, 0.18, 0.7], c2: [0.2, 0.25, 0.65] }, [
  {
    name: 'Merry-Go-Round',
    bodies: [planet(-600, 150, 60, 'earth'), planet(40, 0, 60, 'moon', { g: 230 }), planet(300, 0, 30, 'ice', { orbit: { around: 1, period: 26 } })],
    tee: [0, -30], hole: [2, 270], preview: 5, starFracs: [0.5],
    hint: 'This moon is on the move, and so is the hole. Time your shot: the preview follows the planets live.',
  },
  {
    name: 'Moon Shot',
    bodies: [planet(-640, -200, 50, 'earth'), planet(0, 20, 75, 'lava', { g: 230 }), planet(230, 20, 26, 'moon', { orbit: { around: 1, period: -18 } }), planet(380, 20, 32, 'desert', { orbit: { around: 1, period: 30 } })],
    tee: [0, 60], hole: [3, 90], preview: 5, starFracs: [0.5],
  },
  {
    name: 'Binary Dance',
    bodies: [planet(-650, -200, 50, 'earth'), planet(640, 150, 55, 'moon'), planet(-210, 0, 48, 'desert', { orbit: { cx: 0, cy: 0, period: 34 } }), planet(210, 0, 48, 'ice', { orbit: { cx: 0, cy: 0, period: 34 } })],
    tee: [0, 20], hole: [1, 30], preview: 5, starFracs: [0.5, 0.85],
  },
  {
    name: 'Timing Is Everything',
    bodies: [planet(-620, 0, 55, 'earth'), planet(620, 0, 55, 'moon'), planet(0, -140, 48, 'lava', { orbit: { cx: 0, cy: 0, period: 12 }, g: 240 })],
    tee: [0, 0], hole: [1, 180], preview: 3.5, starFracs: [0.5],
    hint: 'Wait for the gap. The preview shows where the planets will be.',
  },
  {
    name: 'Hitchhiker',
    bodies: [planet(-350, -150, 48, 'earth', { orbit: { cx: -350, cy: 0, period: 22 } }), planet(560, -120, 60, 'moon'), planet(-30, 40, 70, 'desert', { g: 220 })],
    tee: [0, 90], hole: [1, 170], preview: 4, starFracs: [0.5, 0.85],
    hint: 'Your tee is riding a planet. Wait for a good moment to fire.',
  },
  {
    name: 'Grand Orrery',
    bodies: [
      planet(-720, 330, 45, 'earth'), planet(0, 0, 70, 'lava', { g: 240 }),
      planet(170, 0, 24, 'moon', { orbit: { around: 1, period: 14 } }),
      planet(-260, 0, 30, 'ice', { orbit: { around: 1, period: -22 } }),
      planet(0, -340, 34, 'desert', { orbit: { around: 1, period: 32 } }),
    ],
    tee: [0, -30], hole: [4, 0], preview: 3, starFracs: [0.3, 0.6, 0.9],
  },
]);

// ---- World 4 ---------------------------------------------------------------------------
world('w4', 'Dark Matter', 'Black holes, suns and wormholes', 'lava', { c1: [0.3, 0.1, 0.5], c2: [0.55, 0.1, 0.25] }, [
  {
    name: "Don't Look Down",
    bodies: [planet(-600, 0, 55, 'earth'), planet(600, 0, 55, 'moon'), blackhole(0, 0, 16)],
    tee: [0, 0], hole: [1, 30], preview: 4.5, starFracs: [0.5],
    hint: 'A black hole swallows anything that gets too close (+1 stroke). Swing wide around it.',
  },
  {
    name: 'Bumper Cars',
    bodies: [planet(-620, 120, 55, 'earth'), planet(520, -20, 62, 'moon'), repulsor(300, -150, 26), repulsor(300, 110, 26), repulsor(120, -20, 22)],
    tee: [0, -40], hole: [1, 210], preview: 4, starFracs: [0.5],
    hint: 'Repulsors push everything away and bounce the ball.',
  },
  {
    name: 'Wormhole',
    bodies: [planet(-620, -150, 50, 'earth'), planet(0, 0, 120, 'desert', { g: 190 }), planet(620, 200, 50, 'moon')],
    portals: [{ a: { x: -330, y: 150 }, b: { x: 380, y: -200 } }],
    tee: [0, 60], hole: [2, 60], preview: 4, starFracs: [0.5, 0.85],
    hint: 'Wormholes come in pairs: go in one, come out the other, keeping your speed.',
  },
  {
    name: 'Hot Spot',
    bodies: [planet(-620, 160, 52, 'earth'), planet(560, 150, 45, 'moon'), sun(60, -30, 50), planet(-100, 300, 40, 'ice')],
    tee: [0, -20], hole: [1, 30], preview: 4, starFracs: [0.5, 0.85],
    hint: 'Suns are deadly. Stay out of them (+1 stroke).',
  },
  {
    name: 'Event Horizon',
    bodies: [planet(-620, -200, 50, 'earth'), planet(600, 220, 55, 'moon'), blackhole(60, -40, 16), planet(60, 180, 28, 'ice', { orbit: { cx: 60, cy: -40, period: 18 } })],
    tee: [0, 30], hole: [1, 90], preview: 3.5, starFracs: [0.5, 0.85],
  },
  {
    name: 'Gravity Gauntlet',
    bodies: [planet(-650, 250, 48, 'earth'), planet(620, -250, 55, 'moon'), blackhole(-120, -60, 15), sun(300, 120, 44), repulsor(400, -200, 24), planet(-300, -250, 40, 'lava'), planet(100, 300, 45, 'ice')],
    tee: [0, -40], hole: [1, 210], preview: 3, starFracs: [0.3, 0.6, 0.9],
  },
]);

// ---- World 5 ---------------------------------------------------------------------------
world('w5', 'Cosmic Chaos', 'Solar wind and everything else', 'gas', { c1: [0.65, 0.3, 0.1], c2: [0.55, 0.1, 0.5] }, [
  {
    name: 'Solar Wind',
    bodies: [planet(-600, 120, 55, 'earth'), planet(600, 120, 55, 'moon')],
    winds: [{ x: 0, y: 100, r: 170, ax: 0, ay: -130 }],
    tee: [0, -20], hole: [1, 120], preview: 4.5, starFracs: [0.5],
    hint: 'Wind zones push the ball sideways while it is inside.',
  },
  {
    name: 'Crosswinds',
    bodies: [planet(-620, 0, 55, 'earth'), planet(640, 0, 52, 'moon'), planet(0, 250, 60, 'desert')],
    winds: [{ x: -220, y: -20, r: 150, ax: 0, ay: 140 }, { x: 230, y: -20, r: 150, ax: 0, ay: -140 }],
    tee: [0, -10], hole: [1, 90], preview: 4, starFracs: [0.5, 0.85],
  },
  {
    name: 'Wormhole Maze',
    bodies: [planet(-640, -250, 48, 'earth'), planet(-100, 0, 100, 'ice'), planet(640, 250, 50, 'moon'), planet(300, -200, 55, 'lava')],
    portals: [{ a: { x: -400, y: 100 }, b: { x: 140, y: 250 } }, { a: { x: 280, y: 20 }, b: { x: 560, y: -250 } }],
    tee: [0, 50], hole: [2, 60], preview: 3.5, starFracs: [0.4, 0.8],
  },
  {
    name: 'Shy Hole',
    bodies: [planet(-640, 100, 55, 'earth'), planet(-250, -200, 60, 'moon'), planet(380, 180, 70, 'desert'), planet(350, -250, 40, 'ice')],
    hole: { x: 90, y: -10 },
    tee: [0, -10], preview: 4, starFracs: [0.5, 0.85],
    hint: 'This hole floats in open space. Arrive slowly or it will spit you out.',
  },
  {
    name: 'Kitchen Sink',
    bodies: [planet(-650, 280, 48, 'earth'), planet(620, -230, 55, 'moon'), blackhole(-80, -20, 15), planet(280, 160, 30, 'ice', { orbit: { cx: 280, cy: 20, period: 16 } }), repulsor(-330, -170, 24)],
    winds: [{ x: 260, y: -140, r: 140, ax: -90, ay: 60 }],
    tee: [0, -30], hole: [1, 0], preview: 3, starFracs: [0.35, 0.65, 0.92],
  },
  {
    name: 'Cosmic Golf',
    bodies: [
      planet(-680, 330, 45, 'earth'), planet(660, -330, 50, 'moon'), blackhole(-180, 40, 15), sun(260, 220, 42),
      planet(-330, -250, 38, 'lava'), planet(420, -100, 34, 'ice', { orbit: { cx: 150, cy: -100, period: 24 } }), repulsor(60, -200, 22),
    ],
    portals: [{ a: { x: -480, y: 20 }, b: { x: 500, y: 330 } }],
    winds: [{ x: 120, y: 40, r: 120, ax: 0, ay: -120 }],
    tee: [0, -45], hole: [1, 240], preview: 2.5, starFracs: [0.3, 0.6, 0.9],
  },
]);

export function findLevel(id) {
  for (const w of WORLDS) for (const l of w.levels) if (l.id === id) return l;
  return null;
}

export function levelCount() {
  return WORLDS.reduce((n, w) => n + w.levels.length, 0);
}
