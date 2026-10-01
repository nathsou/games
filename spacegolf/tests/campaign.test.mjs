import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLDS, levelCount } from '../src/campaign.js';
import { SOLUTIONS } from '../src/solutions.js';
import { createWorld, replay } from '../src/physics.js';
import { validateLevel } from '../src/level.js';

test('campaign has 5 worlds of 6 levels with unique ids', () => {
  assert.equal(WORLDS.length, 5);
  assert.equal(levelCount(), 30);
  const ids = new Set();
  for (const w of WORLDS) for (const l of w.levels) {
    assert.ok(!ids.has(l.id));
    ids.add(l.id);
  }
});

for (const w of WORLDS) {
  for (const level of w.levels) {
    test(`${level.id} ${level.name}: valid, and its stored solution still wins in par shots`, () => {
      assert.deepEqual(validateLevel(level), []);
      const sol = SOLUTIONS[level.id];
      assert.ok(sol, 'run `node tools/solve.mjs --write` to (re)generate src/solutions.js');
      const S = replay(createWorld(level), sol.shots);
      assert.equal(S.ball.mode, 'captured');
      assert.equal(S.shots, sol.par);
      assert.equal(S.penalties, 0);
      assert.equal(S.starsGot, level.stars.length, 'every pickup lies on the par route (3 stars is achievable)');
    });
  }
}
