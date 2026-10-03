import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, newState, shoot, step, flyToEnd, simulateShot, DT, BALL_R, replay, cloneState } from '../src/physics.js';

const base = (extra = {}) => ({
  bounds: { w: 1600, h: 900 },
  bodies: [{ type: 'planet', x: 0, y: 0, r: 60, g: 250, look: 'moon' }],
  tee: { body: 0, angle: -Math.PI / 2 },
  hole: { body: 0, angle: Math.PI / 2 },
  ...extra,
});

test('ball at rest sits on the surface', () => {
  const w = createWorld(base());
  const S = newState(w);
  assert.equal(S.ball.mode, 'rest');
  assert.ok(Math.abs(Math.hypot(S.ball.x, S.ball.y) - 65) < 1e-9);
});

test('circular orbit stays roughly circular', () => {
  const lvl = base({ hole: null, bodies: [{ type: 'planet', x: 0, y: 0, r: 40, g: 250, look: 'moon' }] });
  const w = createWorld(lvl);
  const S = newState(w);
  // launch tangentially from 200 units out via a custom ball placement
  S.ball.mode = 'fly';
  S.ball.x = 0;
  S.ball.y = -200;
  const mu = w.mu[0];
  S.ball.vx = Math.sqrt(mu / 200);
  S.ball.vy = 0;
  S.aValid = false;
  let minR = 1e9;
  let maxR = 0;
  for (let i = 0; i < 180 * 20; i++) {
    step(w, S);
    const r = Math.hypot(S.ball.x, S.ball.y);
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
  }
  assert.equal(S.ball.mode, 'fly');
  assert.ok(minR > 190 && maxR < 210, `r in [${minR}, ${maxR}]`);
});

test('ball dropped on a planet eventually rests', () => {
  const w = createWorld(base({ hole: null }));
  const S = newState(w);
  shoot(w, S, -Math.PI / 2 + 0.3, 0.22);
  flyToEnd(w, S);
  assert.equal(S.ball.mode, 'rest');
  assert.equal(S.shots, 1);
});

test('hole captures a ball rolling in', () => {
  const lvl = base();
  lvl.hole = { body: 0, angle: -Math.PI / 2 + 0.5 };
  const w = createWorld(lvl);
  let found = false;
  for (let a = -Math.PI; a < Math.PI && !found; a += 0.01) {
    const { S } = simulateShot(w, newState(w), a, 0.3);
    if (S.ball.mode === 'captured') found = true;
  }
  assert.ok(found, 'some shot should reach the hole');
});

test('black hole swallows and returns ball with a penalty', () => {
  const lvl = base({
    hole: null,
    bodies: [
      { type: 'planet', x: -300, y: 0, r: 50, g: 200, look: 'moon' },
      { type: 'blackhole', x: 0, y: 0, r: 18 },
    ],
    tee: { body: 0, angle: 0 },
  });
  const w = createWorld(lvl);
  const S = newState(w);
  shoot(w, S, 0, 0.6);
  flyToEnd(w, S);
  assert.equal(S.penalties, 1);
  assert.equal(S.ball.mode, 'rest');
});

test('wormhole teleports', () => {
  const lvl = base({
    hole: null,
    bodies: [{ type: 'planet', x: -400, y: 0, r: 40, g: 100, look: 'moon' }],
    tee: { body: 0, angle: 0 },
    portals: [{ a: { x: -200, y: 0 }, b: { x: 300, y: 200 } }],
  });
  const w = createWorld(lvl);
  const S = newState(w);
  S.ev = [];
  shoot(w, S, 0, 0.6);
  for (let i = 0; i < 180 * 3 && !S.ev.some((e) => e.type === 'portal'); i++) step(w, S);
  assert.ok(S.ev.some((e) => e.type === 'portal'));
  assert.ok(S.ball.x > 250, 'ball emerged on the far side');
});

test('simulation is deterministic and orbiting bodies replay', () => {
  const lvl = base({
    bodies: [
      { type: 'planet', x: 0, y: 0, r: 60, g: 250, look: 'moon' },
      { type: 'planet', x: 400, y: 0, r: 30, g: 150, look: 'ice', orbit: { cx: 0, cy: 0, period: 40 } },
    ],
  });
  const w = createWorld(lvl);
  const shots = [{ t: 1.5, angle: -1.2, power: 0.5 }];
  const a = replay(w, shots);
  const b = replay(createWorld(lvl), shots);
  assert.equal(a.ball.x, b.ball.x);
  assert.equal(a.ball.y, b.ball.y);
  const c = cloneState(a);
  assert.equal(c.ball.x, a.ball.x);
});

test('preview matches the real flight', () => {
  const w = createWorld(base({ hole: null }));
  const S0 = newState(w);
  const sim = simulateShot(w, S0, -1.3, 0.25, { collect: true });
  const S = cloneState(S0);
  shoot(w, S, -1.3, 0.25);
  flyToEnd(w, S);
  assert.equal(S.ball.x, sim.S.ball.x);
  assert.equal(S.ball.y, sim.S.ball.y);
  assert.ok(sim.pts.length > 4);
});

test('a ball that leaves the level is neither lost nor recalled', () => {
  const w = createWorld(base({ hole: null }));
  const S = newState(w);
  S.ball.mode = 'rest';
  shoot(w, S, -Math.PI / 2, 1);
  for (let i = 0; i < 180 * 40; i++) step(w, S);
  assert.equal(S.ball.mode, 'fly', 'still flying after 40 s');
  assert.equal(S.penalties, 0);
  assert.ok(S.ball.y < -1500, 'far above the level');
});
