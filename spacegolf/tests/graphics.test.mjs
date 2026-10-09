import test from 'node:test';
import assert from 'node:assert/strict';
import {frameDue, graphicsOptions} from '../src/graphics.js';

test('frame limits hold on 60, 120, and 144 Hz displays without accumulating drift', () => {
  for (const display of [60, 120, 144]) for (const fps of [30, 60]) {
    let previous = 0, count = 0;
    for (let tick = 1; tick <= display * 10; tick++) {
      const due = frameDue(tick * 1000 / display, previous, fps);
      if (due !== null) { count++; previous = due; }
    }
    assert.equal(count, fps * 10, `${fps} fps on ${display} Hz`);
  }
});

test('a stalled frame does not schedule a burst of catch-up frames', () => {
  const due = frameDue(1020, 0, 30);
  assert.ok(due >= 1000);
  assert.equal(frameDue(1025, due, 30), null);
});

test('Low and adaptive settings remove expensive effects while explicit toggles survive presets', () => {
  const settings = {quality: 'low', bloom: true, glass: true, fps: 30};
  const low = graphicsOptions(settings);
  assert.equal(low.bloomLevels, 0);
  assert.equal(low.glass, false);
  assert.equal(low.starsOnly, true);
  assert.equal(low.fps, 30);
  const high = graphicsOptions({...settings, quality: 'high'});
  assert.equal(high.bloomLevels, 5);
  assert.equal(high.glass, true);
  const off = graphicsOptions({...settings, quality: 'high', bloom: false, glass: false});
  assert.equal(off.bloomLevels, 0);
  assert.equal(off.glass, false);
  const auto = {...settings, quality: 'auto'};
  assert.ok(graphicsOptions(auto, 2).scale < graphicsOptions(auto, 1).scale);
  assert.ok(graphicsOptions(auto, 1).detail < graphicsOptions(auto, 0).detail);
});
