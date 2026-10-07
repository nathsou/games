import test from 'node:test';
import assert from 'node:assert/strict';
import {encodePuzzle, decodePuzzle, sharedPuzzleId} from '../src/core/codec.ts';
import {PlaySession} from '../src/game/session.ts';
import type {PuzzleDef} from '../src/core/types.ts';

const common = {
  name: 'Puzzle', difficulty: 'easy' as const, dims: [2, 2, 2] as const,
  palette: ['#123456', '#654321', '#abcdef', '#fedcba'],
  mask: new Uint8Array(12).fill(1),
};
const a: PuzzleDef = {...common, id: 'a', cells: Uint8Array.from([0, 1, 1, 1, 1, 1, 1, 1])};
const b: PuzzleDef = {...common, id: 'b', cells: Uint8Array.from([1, 0, 1, 1, 1, 1, 1, 1])};

test('shared puzzles with identical metadata keep separate progress keys', () => {
  const first = encodePuzzle(a), second = encodePuzzle(b);
  assert.equal(first.slice(0, 24), second.slice(0, 24), 'Reproduce the old key collision');
  assert.notEqual(sharedPuzzleId(a), sharedPuzzleId(b));
  assert.equal(sharedPuzzleId(a), sharedPuzzleId(decodePuzzle(first)));
  assert.equal(sharedPuzzleId(a), sharedPuzzleId({...a, id: 'another-id'}));
  const session = new PlaySession(a, common.mask, 'classic');
  session.breakCell(0);
  const progress = {[sharedPuzzleId(a)]: session.serialize()};
  assert.equal(progress[sharedPuzzleId(b)], undefined);
});

test('progress cannot restore into another puzzle with the same dimensions or ID', () => {
  const first = new PlaySession(a, common.mask, 'classic');
  first.breakCell(0);
  first.elapsed = 100;
  const saved = first.serialize();
  const second = new PlaySession({...b, id: a.id}, common.mask, 'classic');
  second.restore(saved);
  assert.deepEqual([...second.state], new Array(8).fill(0));
  assert.equal(second.elapsed, 0);
  assert.deepEqual(second.errors().wrongBroken, []);
  const restored = new PlaySession(a, common.mask, 'classic');
  restored.restore(saved);
  assert.deepEqual(restored.serialize(), saved);
});

test('legacy progress remains usable for existing collection puzzles', () => {
  const session = new PlaySession(a, common.mask, 'classic');
  session.restore({state: '20000000', strikes: 0, hints: 0, elapsed: 15});
  assert.equal(session.state[0], 2);
  assert.equal(session.elapsed, 15);
});
