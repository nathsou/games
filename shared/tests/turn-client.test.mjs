import test from 'node:test';
import assert from 'node:assert/strict';
import {TurnClient} from '../turn-client.js';
import {createTurnGame, advanceTurn, abandonTurn, turnView} from '../../cloudflare/turn-games.js';
import {botAction} from '../../flip-it/src/bot.js';

function client(record) {
  return new TurnClient({onChange() {}}, structuredClone(record));
}

test('an ended game cannot be resurrected by an older HTTP snapshot', () => {
  const record = createTurnGame('midnight', {}, 'host');
  const before = structuredClone(turnView(record, 'host'));
  const connection = client(before);
  abandonTurn(record, 'guest');
  const ended = turnView(record, 'host');
  assert.equal(ended.revision, before.revision);
  assert.equal(ended.version, before.version + 1);
  connection.apply(ended);
  connection.apply(before);
  assert.equal(connection.record.finished, true);
  assert.equal(connection.record.abandoned, 'guest');
  connection.close();
});

test('readiness and the next deal remain ordered even within one clock tick', () => {
  const record = createTurnGame('flip-it', {options: {target: 2}}, 'host');
  while (record.state.phase === 'playing') {
    const seat = record.state.turn;
    const version = record.version;
    advanceTurn(record, seat === 0 ? 'host' : 'guest', {revision: record.state.revision, action: botAction(record.state, seat)});
    assert.equal(record.version, version + 1);
  }
  const before = structuredClone(turnView(record, 'host'));
  const connection = client(before);
  const now = Date.now;
  Date.now = () => 1234;
  try {
    advanceTurn(record, 'guest', {revision: record.state.revision, action: {kind: 'next'}});
    const ready = structuredClone(turnView(record, 'host'));
    assert.equal(ready.revision, before.revision);
    connection.apply(ready);
    connection.apply(before);
    assert.deepEqual(connection.record.ready, [1]);
    advanceTurn(record, 'host', {revision: record.state.revision, action: {kind: 'next'}});
    const next = turnView(record, 'host');
    assert.equal(next.updatedAt, ready.updatedAt);
    connection.apply(next);
    connection.apply(ready);
    assert.equal(connection.record.round, 1);
    assert.deepEqual(connection.record.ready, []);
    const duplicate = {...next, finished: true};
    connection.apply(duplicate);
    assert.equal(connection.record.finished, false, 'Equal versions cannot overwrite accepted state');
  } finally {
    Date.now = now;
    connection.close();
  }
});

test('legacy saved games acquire record versions on their next mutation', () => {
  const record = createTurnGame('midnight', {}, 'host');
  delete record.version;
  const before = turnView(record, 'host');
  const connection = client({...before, version: undefined});
  abandonTurn(record, 'guest');
  connection.apply(turnView(record, 'host'));
  assert.equal(connection.record.finished, true);
  assert.equal(connection.record.version, before.revision + 1);
  connection.close();
});
