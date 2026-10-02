import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/storage.js';

const run = (n) => Array.from({ length: n }, (_, i) => ({ t: i, angle: i / 10, power: 0.5 }));

test('the best run of a level is kept for replays', () => {
  const st = new Store();
  st.recordCampaign('w1-1', 3, 2, run(3));
  assert.equal(st.levelRecord('w1-1').shots.length, 3);
  st.recordCampaign('w1-1', 5, 2, run(5)); // worse: keep the old one
  assert.equal(st.levelRecord('w1-1').shots.length, 3);
  st.recordCampaign('w1-1', 2, 3, run(2)); // better: replace it
  assert.equal(st.levelRecord('w1-1').best, 2);
  assert.equal(st.levelRecord('w1-1').shots.length, 2);
  st.recordCampaign('w1-1', 2, 3, run(2).map((s) => ({ ...s, power: 0.9 }))); // same strokes and stars: keep
  assert.equal(st.levelRecord('w1-1').shots[0].power, 0.5);
});
