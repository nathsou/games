import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyLevel, validateLevel, encodeLevel, decodeLevel } from '../src/level.js';
import { addBody, removeBody, snapTee, snapHole, setOrbit } from '../src/leveledit.js';

function sample() {
  const l = emptyLevel('t');
  addBody(l, 'planet', -300, 0);
  addBody(l, 'planet', 0, 100);
  addBody(l, 'planet', 300, 0);
  snapTee(l, -300, -80);
  snapHole(l, 300, -70);
  return l;
}

test('empty level is invalid until it has a planet, tee and hole', () => {
  assert.ok(validateLevel(emptyLevel()).length >= 3);
  assert.deepEqual(validateLevel(sample()), []);
});

test('removing a body re-indexes the tee, hole and orbits', () => {
  const l = sample();
  l.bodies[2].orbit = { around: 1, period: 20 };
  removeBody(l, 1);
  assert.equal(l.bodies.length, 2);
  assert.equal(l.tee.body, 0);
  assert.equal(l.hole.body, 1);
  assert.equal(l.bodies[1].orbit, undefined, 'orbit around a deleted body is dropped');
  removeBody(l, 0);
  assert.equal(l.tee, null);
  assert.equal(l.hole.body, 0);
});

test('hole snaps to a surface when near and floats otherwise', () => {
  const l = sample();
  snapHole(l, 0, -400);
  assert.equal(typeof l.hole.x, 'number');
  snapHole(l, 300, -75);
  assert.equal(l.hole.body, 2);
});

test('orbit toggling', () => {
  const l = sample();
  setOrbit(l, 1, true);
  assert.ok(l.bodies[1].orbit.period > 0);
  setOrbit(l, 1, false);
  assert.equal(l.bodies[1].orbit, undefined);
});

test('level share strings round-trip', async () => {
  const l = sample();
  l.name = 'Round Trip';
  const s = await encodeLevel(l);
  const back = await decodeLevel(s);
  assert.equal(back.name, 'Round Trip');
  assert.equal(back.bodies.length, 3);
  assert.equal(await decodeLevel('garbage'), null);
});
