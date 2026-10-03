import test from 'node:test';
import assert from 'node:assert/strict';
import {encodePairing, decodePairing, makeLink, iceConfig} from '../src/peer.js';
import {commitment, verifyCommitment, validateView} from '../src/session.js';
import {createGame, playerView} from '../src/rules.js';

test('compressed pairing descriptions round-trip as codes and share links', async () => {
  for (const type of ['offer', 'answer']) {
    const room = 'a123456789abcdef';
    const desc = {type, sdp: 'v=0\r\na=midnight-test\r\n'};
    const token = await encodePairing(desc, room);
    assert.deepEqual(await decodePairing(token, type), {v: 1, ...desc, room});
    assert.deepEqual(await decodePairing(makeLink(token, type, 'https://example.com/games/midnight/'), type), {v: 1, ...desc, room});
    await assert.rejects(decodePairing(token, type === 'offer' ? 'answer' : 'offer'));
  }
  for (const invalid of ['', 'hello', 'MT1z.!!!', 'x'.repeat(70000), 'https://example.com/#invite=nope']) await assert.rejects(decodePairing(invalid, 'offer'));
});
test('commitments bind choices to their salt, seat and game phase', async () => {
  const action = {kind: 'bid', card: 'b05'};
  const salt = 'a'.repeat(32), context = 'table/backhand/0/choose';
  const hash = await commitment(context, 0, action, salt);
  assert(await verifyCommitment(hash, context, 0, {card: 'b05', kind: 'bid'}, salt));
  assert(!await verifyCommitment(hash, context, 0, {kind: 'bid', card: 'b04'}, salt));
  assert(!await verifyCommitment(hash, context, 1, action, salt));
  assert(!await verifyCommitment(hash, 'table/backhand/1/choose', 0, action, salt));
  assert(!await verifyCommitment(hash, context, 0, action, 'b'.repeat(32)));
});
test('network configuration and incoming game snapshots are bounded', () => {
  assert.deepEqual(iceConfig(''), {iceServers: []});
  assert.equal(iceConfig(undefined).iceServers.length, 1);
  assert.throws(() => iceConfig('https://example.com'));
  assert.throws(() => iceConfig('', 'javascript:alert(1)'));
  for (const type of ['backhand', 'closing', 'heist']) assert(validateView(playerView(createGame(type), 1)));
  assert.throws(() => validateView({type: '<img>'}));
  const view = playerView(createGame('backhand'), 1);
  view.hands[1][0].value = 999;
  assert.throws(() => validateView(view));
});
