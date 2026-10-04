// Optional browser checks: run npm run build and npm run dev first.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {botAction} from '../flip-it/src/bot.js';
import {installTestPeer} from './test-peer.mjs';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: process.env.CHROMIUM_NO_SANDBOX === '1' ? ['--no-sandbox'] : [],
});
const origin = process.env.GAMES_URL || 'http://127.0.0.1:8787';
const errors = [], results = [], artifacts = process.env.GAMES_ARTIFACTS;
if (artifacts) await mkdir(artifacts, {recursive: true});

async function context(mock = true, width = 1280) {
  const c = await browser.newContext({
    viewport: {width, height: width === 1280 ? 720 : 844},
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  await c.addInitScript(mock => {
    // Separate each browser's saves while sharing the test RTC BroadcastChannel.
    if (mock) Object.defineProperty(window, 'localStorage', {get: () => sessionStorage});
    if (!localStorage.getItem('flip-it.preferences')) {
      localStorage.setItem('flip-it.preferences', JSON.stringify({
        aiCount: 3, aiKinds: ['model', 'model', 'model'], team: true, stun: '', fx: false,
      }));
    }
  }, mock);
  if (mock) await c.addInitScript(installTestPeer);
  else await c.addInitScript(() => {
    const RTC = RTCPeerConnection;
    window.__testPeers = [];
    window.RTCPeerConnection = class extends RTC {
      constructor(...args) { super(...args); window.__testPeers.push(this); }
    };
  });
  return c;
}
async function page(c, game) {
  const p = await c.newPage();
  p.setDefaultTimeout(15000);
  p.on('pageerror', error => errors.push(error.message));
  await p.goto(origin + '/' + game + '/');
  await p.waitForFunction(name => Boolean(window[name]), game === 'flip-it' ? '__flipit' : '__cluance');
  return p;
}
async function gameView(p, game) {
  if (!p.url().includes('/together/')) return p;
  await p.locator('#game-frame').waitFor();
  const frame = await (await p.locator('#game-frame').elementHandle()).contentFrame();
  await frame.waitForFunction(name => Boolean(window[name]), game === 'flip-it' ? '__flipit' : '__cluance');
  return frame;
}
async function state(p, game) {
  return (await gameView(p, game)).evaluate(name => window[name].state,
    game === 'flip-it' ? '__flipit' : '__cluance');
}
async function connected(p, game) {
  const view = await gameView(p, game);
  await view.waitForFunction(name => window[name]?.connected,
    game === 'flip-it' ? '__flipit' : '__cluance');
  await p.waitForFunction(() => window.__together?.connected);
}
async function invite(p, game) {
  const view = await gameView(p, game), outside = view === p;
  if (game === 'flip-it') await view.locator('[data-action=host]').first().click();
  else if (await view.locator('#invite-friend').count()) await view.locator('#invite-friend').click();
  else await view.locator('#start-game').click();
  if (outside) await p.waitForURL('**/together/**');
  else if (game === 'cluance') await view.locator('[data-action=create-invite]').click();
  const current = await gameView(p, game);
  await current.waitForFunction(() => document.querySelector('#pair-output')?.value);
  const link = await current.locator('#pair-output').inputValue();
  assert(link.includes('#room=') && link.includes('together=1') && link.length < 260);
  assert.equal(await current.locator('#pair-input').count(), 0);
  await current.locator('[data-action=copy]').click();
  assert.equal(await current.evaluate(() => navigator.clipboard.readText()), link);
  return link;
}
async function join(c, link, game) {
  const p = await page(c, game);
  await p.goto(link);
  await p.waitForURL('**/together/**');
  await connected(p, game);
  return p;
}
async function switchGame(requester, friend, game) {
  await requester.locator('#next-game').selectOption(game);
  await acceptSwitch(requester, friend, game);
}
async function acceptSwitch(requester, friend, game) {
  await friend.locator('#accept-switch').click();
  for (const p of [requester, friend]) {
    await p.waitForFunction(game => window.__together.game === game && !window.__together.loading, game);
    await connected(p, game);
  }
}
async function flipMove(p) {
  const view = await gameView(p, 'flip-it'), v = await state(p, 'flip-it');
  const seat = await view.evaluate(() => window.__flipit.seat), move = botAction(v, seat);
  if (move.kind === 'next') { await view.locator('[data-action=next]').click(); return; }
  if (!v.options.quickTurns) await view.locator('[data-action=lane][data-lane="' + move.lane + '"]').click();
  for (const id of move.cards || []) await view.locator('[data-card="' + id + '"]').click();
  if (['add', 'take'].includes(move.kind)) {
    const target = view.locator('[data-action=' + move.kind + '][data-owner="' + move.targetSeat + '"][data-target="' + move.target + '"]');
    if (!await target.isVisible()) await view.locator('[data-action=inspect-set][data-owner="' + move.targetSeat + '"][data-target="' + move.target + '"]').click();
    await target.click();
  } else await view.locator('[data-action=' + move.kind + ']').click();
}
async function cluanceRound(h, g) {
  const hv = await state(h, 'cluance'), gv = await state(g, 'cluance');
  assert.equal(hv.id, gv.id);
  assert.notEqual(hv.role, gv.role);
  const giver = hv.role === 'giver' ? h : g, guesser = hv.role === 'guesser' ? h : g;
  const privateView = await state(giver, 'cluance'), publicView = await state(guesser, 'cluance');
  assert(privateView.secret && privateView.hand.length);
  assert(!publicView.secret && !publicView.hand);
  const giving = await gameView(giver, 'cluance'), guessing = await gameView(guesser, 'cluance');
  await giving.locator('#hand [data-card]').first().click();
  await giving.locator('#confirm-move').click();
  await guessing.waitForFunction(() => window.__cluance.state.phase === 'guess');
  const guess = await state(guesser, 'cluance');
  const safe = guess.board.find(id => id !== privateView.secret && !guess.eliminated.includes(id));
  await guessing.locator('#board [data-card="' + safe + '"]').click();
  await guessing.locator('#confirm-move').click();
  await giving.waitForFunction(() => window.__cluance.state.round === 1);
  await guessing.waitForFunction(() => window.__cluance.state.round === 1);
}
async function screenshot(p, name) {
  if (artifacts) await p.screenshot({path: resolve(artifacts, name)});
}

try {
  for (const initial of ['flip-it', 'cluance']) {
    console.log('Checking persistent sessions beginning in ' + initial);
    const c = await context(), h = await page(c, initial);
    let rooms = 0;
    c.on('request', request => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/rooms') rooms++;
    });
    const g = await join(c, await invite(h, initial), initial);
    await connected(h, initial);
    const ids = await Promise.all([h, g].map(p => p.evaluate(() => window.__testPeers.map(peer => peer.id))));
    assert(ids.every(list => list.length === 1));
    const other = initial === 'flip-it' ? 'cluance' : 'flip-it';
    await h.locator('#next-game').selectOption(other);
    await g.locator('#decline-switch').click();
    await h.locator('#friend-dialog').waitFor({state: 'hidden'});
    assert.equal(await h.evaluate(() => window.__together.game), initial);
    await g.locator('#next-game').selectOption(other);
    await g.locator('#decline-switch').click();
    await g.locator('#friend-dialog').waitFor({state: 'hidden'});
    await h.locator('#friend-dialog').waitFor({state: 'hidden'});
    await switchGame(g, h, other);
    const before = await state(g, other);
    // A retired game's packet travels through the live encrypted transport.
    // It must not reach the new game, even if it names the active game.
    await g.evaluate(() => {
      window.__staleDelivered = false;
      const link = window.__friendSession.link, receive = link.onMessage;
      link.onMessage = message => {
        if (message.type === 'stale-probe') window.__staleDelivered = true;
        return receive(message);
      };
    });
    await h.evaluate(game => window.__friendSession.peer.send({
      type: 'friend-game', game, epoch: 'initial', message: {type: 'stale-probe', v: 5, version: 1},
    }), other);
    // This later request is an ordered-channel barrier for the stale packet.
    await h.locator('#next-game').selectOption('cluance');
    await g.locator('#accept-switch').waitFor({state: 'visible'});
    assert.equal(await g.evaluate(() => window.__staleDelivered), false);
    assert.deepEqual(await state(g, other), before);
    await acceptSwitch(h, g, 'cluance');
    await cluanceRound(h, g);
    const ch = await gameView(h, 'cluance'), cg = await gameView(g, 'cluance');
    const oldId = (await state(h, 'cluance')).id, oldRole = (await state(h, 'cluance')).role;
    await ch.locator('#table-menu').click();
    await ch.locator('#menu-swap-roles').click();
    await ch.locator('#ask-role-swap').click();
    await cg.locator('#accept-role-swap').click();
    await ch.waitForFunction(id => window.__cluance.state.id !== id, oldId);
    await cg.waitForFunction(id => window.__cluance.state.id !== id, oldId);
    assert.notEqual((await state(h, 'cluance')).role, oldRole);
    await switchGame(g, h, 'flip-it');
    let v = await state(h, 'flip-it');
    assert.equal(v.hands.length, 2);
    assert(v.hands[1].every(card => card.hidden));
    for (let i = 0; i < 6; i++) {
      v = await state(h, 'flip-it');
      await flipMove(v.turn === 0 ? h : g);
      for (const p of [h, g]) await (await gameView(p, 'flip-it')).waitForFunction(r => window.__flipit.state.revision > r, v.revision);
    }
    const currentIds = await Promise.all([h, g].map(p => p.evaluate(() => window.__testPeers.map(peer => peer.id))));
    assert.deepEqual(currentIds, ids);
    assert.equal(rooms, 1, 'Switching games must not create new invitation rooms');
    for (const p of [h, g]) assert.equal(await (await gameView(p, 'flip-it')).evaluate(() => window.__testPeers.length), 0);
    const saved = await state(h, 'flip-it');
    await h.reload();
    const restored = await gameView(h, 'flip-it');
    assert.equal((await state(h, 'flip-it')).id, saved.id);
    assert.equal((await state(h, 'flip-it')).revision, saved.revision);
    const fresh = await invite(h, 'flip-it');
    await g.goto(fresh);
    await g.waitForURL('**/together/**');
    await connected(g, 'flip-it');
    await connected(h, 'flip-it');
    assert.equal((await state(g, 'flip-it')).id, saved.id);
    assert.equal((await state(g, 'flip-it')).revision, saved.revision);
    assert(restored);
    await h.locator('#disconnect').click();
    await h.locator('#accept-switch').click();
    await g.waitForFunction(() => !window.__together.connected);
    assert.equal(await h.evaluate(() => window.__testPeers.at(-1).signalingState), 'closed');
    results.push(initial + ': consent, cancellation, switches, private views, role swaps and saved-game reconnect; one RTC connection throughout switches');
    await c.close();
  }

  console.log('Checking native signaling and phone layouts');
  for (const game of ['flip-it', 'cluance']) for (const width of [1280, 390, 320]) {
    const c = await context(false, width), h = await page(c, game), link = await invite(h, game);
    const view = await gameView(h, game);
    const bounds = await view.locator('#modal-content').evaluate(el => ({w: el.clientWidth, sw: el.scrollWidth}));
    assert(bounds.sw <= bounds.w + 1, JSON.stringify({game, width, ...bounds}));
    assert(await h.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (width < 600) assert(await h.locator('.friend-bar').evaluate(el => el.clientHeight <= 96));
    await screenshot(h, game + '-together-' + width + '.png');
    const g = await page(c, game);
    await g.goto(link);
    await g.waitForURL('**/together/**');
    await h.waitForFunction(() => window.__testPeers.at(-1)?.remoteDescription?.type === 'answer');
    assert.equal(await (await gameView(g, game)).locator('#pair-output').count(), 0);
    await c.close();
  }

  console.log('Checking manual pairing and dialog retention');
  const c = await context(false), h = await page(c, 'cluance');
  await invite(h, 'cluance');
  const view = await gameView(h, 'cluance');
  await view.locator('.connection-settings > summary').click();
  await view.locator('#turn-name').fill('session-user');
  await view.locator('#turn-password').fill('session-password');
  await view.locator('[data-action=manual-pair]').click();
  await view.waitForFunction(() => document.querySelector('#pair-output')?.value.includes('#invite='));
  assert.equal(await view.locator('#turn-password').inputValue(), 'session-password');
  assert(await view.locator('.connection-settings').evaluate(el => el.open));
  await view.locator('.manual-reply > summary').click();
  await view.locator('#pair-input').fill('invalid');
  await view.locator('[data-action=accept-reply]').click();
  assert(await view.locator('[role=alert]').count());
  assert.equal(await view.locator('#pair-input').inputValue(), 'invalid');
  assert.equal(await view.locator('#turn-password').inputValue(), 'session-password');
  assert(!JSON.stringify(await view.evaluate(() => ({...localStorage}))).includes('session-password'));
  await c.close();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({passed: true, results, errors,
    gameplayTransport: 'test RTC substitute with real Cloudflare signaling', nativeConnectivityVerified: false}));
} finally {
  await browser.close();
}
