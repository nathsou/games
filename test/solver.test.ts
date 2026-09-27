import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridFor } from '../src/core/grid.ts';
import { computeClues, clueCode, maskStats } from '../src/core/clues.ts';
import { solveLine } from '../src/solver/line.ts';
import { Solver, FILLED, EMPTY } from '../src/solver/solver.ts';
import { analyze, generateMask, zeroShare } from '../src/solver/generator.ts';
import { encodePuzzle, decodePuzzle } from '../src/core/codec.ts';
import { allCollections } from '../src/data/collections.ts';
import { tutorialLesson1, tutorialLesson2, tutorialLesson3 } from '../src/data/tutorial.ts';
import { randomSculpture } from '../src/data/daily.ts';

test('grid line bookkeeping', () => {
  const g = gridFor([3, 4, 5]);
  assert.equal(g.lineCount, 4 * 5 + 3 * 5 + 3 * 4);
  for (let i = 0; i < g.size; i++)
    for (let a = 0; a < 3; a++) assert.ok(g.lines[g.cellLines[i * 3 + a]].includes(i));
  assert.deepEqual(g.coords(g.idx(2, 3, 4)), [2, 3, 4]);
});

test('line solver matches brute force', () => {
  const n = 6;
  for (let sol = 0; sol < 1 << n; sol++) {
    const { count, groups } = maskStats(sol);
    const clue = clueCode(count, groups);
    // random-ish partial knowledge consistent with sol
    const kf = sol & 0b010010;
    const ke = ~sol & 0b100001 & 63;
    const res = solveLine(n, clue, kf, ke)!;
    let and = 63;
    let or = 0;
    for (let m = 0; m < 1 << n; m++) {
      const s = maskStats(m);
      if (clueCode(s.count, s.groups) !== clue || (m & ke) || (m & kf) !== kf) continue;
      and &= m;
      or |= m;
    }
    assert.equal(res.fill, and);
    assert.equal(res.empty, ~or & 63);
  }
});

test('line solver detects contradiction', () => {
  assert.equal(solveLine(3, clueCode(3, 1), 0, 1), null);
});

test('solver solves a fully clued puzzle', () => {
  const p = allCollections[0].puzzles[0];
  const g = gridFor(p.dims);
  const s = new Solver(g, computeClues(g, p.cells), new Uint8Array(g.lineCount).fill(1));
  const r = s.solve(1);
  assert.ok(r.solved);
  for (let i = 0; i < g.size; i++) assert.equal(r.state[i], p.cells[i] ? FILLED : EMPTY);
});

test('detects multiple solutions', () => {
  // 2x2x1 diagonal with only X-line counts shown is ambiguous.
  const g = gridFor([2, 2, 1]);
  const cells = Uint8Array.from([1, 0, 0, 1]);
  const mask = new Uint8Array(g.lineCount);
  for (let l = 0; l < g.lineCount; l++) mask[l] = g.lineAxis[l] === 0 ? 1 : 0;
  const a = analyze(g, cells, mask);
  assert.equal(a.status, 'multiple');
  assert.ok(a.ambiguous.length > 0);
});

test('every collection puzzle is uniquely solvable with its generated clues', () => {
  for (const c of allCollections)
    for (const p of c.puzzles) {
      const g = gridFor(p.dims);
      const { mask, analysis } = generateMask(g, p.cells, p.difficulty, p.id);
      assert.equal(analysis.status, 'unique', p.id);
      const check = analyze(g, p.cells, mask);
      assert.equal(check.status, 'unique', p.id);
      assert.ok(p.cells.some((v) => v > 0), p.id);
      assert.ok(p.dims.every((d) => d <= 10), p.id);
    }
});

test('puzzle ids are unique', () => {
  const ids = allCollections.flatMap((c) => c.puzzles.map((p) => p.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('generation is deterministic', () => {
  const p = allCollections[2].puzzles[3];
  const g = gridFor(p.dims);
  const a = generateMask(g, p.cells, p.difficulty, p.id).mask;
  const b = generateMask(g, p.cells, p.difficulty, p.id).mask;
  assert.deepEqual(a, b);
});

test('tutorial lessons are uniquely line-solvable', () => {
  for (const p of [tutorialLesson1(), tutorialLesson2(), tutorialLesson3()]) {
    const a = analyze(gridFor(p.dims), p.cells, p.mask!);
    assert.equal(a.status, 'unique', p.id);
    assert.equal(a.level, 1, p.id);
  }
});

test('codec round trip', () => {
  const p = allCollections[3].puzzles[2];
  const g = gridFor(p.dims);
  const mask = generateMask(g, p.cells, p.difficulty, p.id).mask;
  const code = encodePuzzle({ ...p, mask });
  const q = decodePuzzle(code);
  assert.equal(q.name, p.name);
  assert.deepEqual([...q.dims], [...p.dims]);
  assert.deepEqual(q.cells, p.cells);
  assert.deepEqual(q.palette, p.palette);
  assert.deepEqual(q.mask, mask);
  assert.equal(q.difficulty, p.difficulty);
});

test('random sculptures are non-empty and in bounds', () => {
  for (let k = 0; k < 10; k++) {
    const p = randomSculpture('2026-01-01', k);
    assert.ok(p.cells.some((v) => v > 0));
  }
});

test('easy puzzles are not solved by zero-clues alone', () => {
  for (const c of allCollections.filter((c) => c.difficulty === 'easy'))
    for (const p of c.puzzles) {
      const g = gridFor(p.dims);
      const { mask } = generateMask(g, p.cells, p.difficulty, p.id);
      const share = zeroShare(g, computeClues(g, p.cells), mask, p.cells);
      assert.ok(share <= 0.5, `${p.id}: zeros clear ${Math.round(share * 100)}%`);
    }
});
