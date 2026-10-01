import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel, MAX_DIFFICULTY } from '../src/generator.js';
import { createWorld, replay } from '../src/physics.js';
import { seedToCode, codeToSeed, randomSeed } from '../src/rng.js';

test('seed codes round-trip', () => {
  for (let i = 0; i < 50; i++) {
    const s = randomSeed();
    assert.equal(codeToSeed(seedToCode(s)), s);
  }
  assert.equal(codeToSeed('nope'), null);
});

test('generated levels are solvable in exactly par shots, at every difficulty', () => {
  for (let d = 1; d <= MAX_DIFFICULTY; d++) {
    const level = generateLevel(1000 + d * 17, d);
    assert.ok(level.par >= 1, `par for d${d}`);
    const w = createWorld(level);
    const S = replay(w, level.solution);
    assert.equal(S.ball.mode, 'captured', `d${d} solution should capture`);
    assert.equal(S.shots, level.par);
    assert.equal(S.penalties, 0);
    assert.equal(S.starsGot, level.stars.length, `d${d} pickups lie on the solution`);
  }
});

test('same seed gives the same level', () => {
  const a = generateLevel(424242, 3);
  const b = generateLevel(424242, 3);
  assert.deepEqual(a, b);
});
