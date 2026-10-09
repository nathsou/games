import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CARDS} from '../src/cards.js';
import {ARTWORK} from '../src/artwork.js';

test('every bilingual event has its own cell in a shipped WebP atlas', async () => {
  assert.deepEqual(Object.keys(ARTWORK).sort(), Object.keys(CARDS).sort());
  const cells = new Set();
  for (const [id, {atlas, index}] of Object.entries(ARTWORK)) {
    assert.match(atlas, /^events-\d{2}$/);
    assert(Number.isInteger(index) && index >= 0 && index < 24, id);
    assert(!cells.has(atlas + ':' + index), id + ' reuses another event’s art');
    cells.add(atlas + ':' + index);
  }
  for (const atlas of new Set(Object.values(ARTWORK).map(a => a.atlas))) {
    const bytes = await readFile(new URL('../assets/' + atlas + '.webp', import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
});
