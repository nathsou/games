import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BlockScene, NO_GLYPHS} from '../src/render/scene.ts';
import {OrbitCamera} from '../src/render/camera.ts';

test('ambient occlusion stays correct as occupancy, instance order and dimensions change', () => {
  const cached = new BlockScene();
  const fill = (scene: BlockScene, dims: [number, number, number], occupied: number[], positions: number[][], color = [1, 1, 1]) => {
    scene.reset(dims); scene.solid.fill(0);
    for (const i of occupied) scene.solid[i] = 1;
    for (const [x, y, z] of positions) scene.add(x, y, z, 1, color, NO_GLYPHS);
    scene.computeAO();
    return Array.from(scene.ao.subarray(0, scene.count * 2));
  };
  const dims: [number, number, number] = [3, 3, 3];
  const occupied = [0, 1, 3, 4, 9, 10, 12];
  const positions = [[0, 0, 0], [1, 1, 0]];
  const first = fill(cached, dims, occupied, positions);
  assert.deepEqual(fill(cached, dims, occupied, positions, [0, 0, 0]), first);
  for (const [d, cells, cubes] of [
    [dims, occupied.slice(2), positions],
    [dims, occupied, positions.slice().reverse()],
    [dims, occupied, [[0, 0.6, 0], [1, 1, 0]]],
    [[3, 1, 9], occupied, positions],
    [dims, occupied, positions.slice(1)],
  ] as Array<[[number, number, number], number[], number[][]]>) {
    assert.deepEqual(fill(cached, d, cells, cubes), fill(new BlockScene(), d, cells, cubes));
  }
  assert.notDeepEqual(fill(cached, dims, [], positions), first, 'removing neighbors must change shading');
});

test('camera remains active for zoom and panel framing, then settles exactly', () => {
  const cam = new OrbitCamera(); cam.setSize(800, 600);
  cam.zoomBy(1.5); assert.ok(cam.isMoving);
  for (let i = 0; i < 200; i++) cam.update(1 / 60);
  assert.equal(cam.zoom, 1.5); assert.equal(cam.isMoving, false);
  cam.frame(100, 0, 0, 200, 1 / 60); assert.ok(cam.isMoving);
  for (let i = 0; i < 200; i++) { cam.frame(100, 0, 0, 200, 1 / 60); cam.update(1 / 60); }
  assert.deepEqual(cam.offset, [100, 50]); assert.equal(cam.isMoving, false);
});
