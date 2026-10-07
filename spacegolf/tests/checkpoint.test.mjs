import test from 'node:test';
import assert from 'node:assert/strict';
import {installCheckpoint} from '../src/checkpoint.js';
import {playCustom} from '../src/scenes/create.js';

const level = (name, radius) => ({name, bodies: [{type: 'planet', x: 0, y: 0, r: radius}], tee: {body: 0, angle: 0}, hole: {body: 0, angle: 1}, bounds: {w: 1600, h: 900}});

test('custom checkpoints retain their level, progress, and completed state', () => {
  const keys = ['window', 'parent', 'document', 'localStorage', 'setInterval'];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const storage = new Map();
  const app = {
    store: {settings: {field: 0}, data: {custom: [
      {id: 'first', name: 'First', level: level('First', 100)},
      {id: 'second', name: 'Second', level: level('Second', 150)},
    ]}, save() {}},
    sound: {capture() {}, win() {}, setHum() {}},
    go(scene) {this.scene = scene;},
  };
  try {
    globalThis.window = {addEventListener() {}};
    globalThis.parent = window;
    globalThis.document = {addEventListener() {}};
    globalThis.localStorage = {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)};
    globalThis.setInterval = () => 0;
    installCheckpoint(app);
    const checkpoint = window.__gameCheckpoint;
    playCustom(app, app.store.data.custom[1]);
    app.scene.S.shots = 2;
    app.scene.history.push(structuredClone(app.scene.S));
    checkpoint.save();
    const saved = structuredClone(checkpoint.capture());
    checkpoint.restore();
    assert.equal(app.scene.level.name, 'Second');
    assert.equal(app.scene.cfg.customId, 'second');
    assert.deepEqual(checkpoint.capture().S, saved.S);
    assert.deepEqual(checkpoint.capture().history, saved.history);
    app.scene.onCapture({x: 0, y: 0});
    assert.equal(app.store.data.custom[0].best, undefined);
    assert.equal(app.store.data.custom[1].best.strokes, 2);
    checkpoint.save();
    checkpoint.restore();
    assert.equal(app.scene.state, 'won');
    assert.equal(app.scene.win.result.strokes, 2);

    const restore = data => {
      localStorage.setItem('games.checkpoint.spacegolf', JSON.stringify({version: 1, game: 'spacegolf', updatedAt: Date.now(), data}));
      checkpoint.restore();
      assert.deepEqual(app.scene.level, saved.level);
    };
    const legacy = structuredClone(saved);
    delete legacy.customId;
    restore(legacy);
    app.store.data.custom[1].level.bodies[0].r = 250;
    restore(saved);
    app.store.data.custom.pop();
    restore(saved);
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
