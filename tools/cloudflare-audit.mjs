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
    if (!localStorage.getItem('games.friend-panel-auto-hide')) localStorage.setItem('games.friend-panel-auto-hide', 'off');
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
  await p.waitForURL('**/together/**');
  await gameView(p, game);
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
  if (game === 'collection') { await p.waitForFunction(() => window.__together?.connected); return; }
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
  else if (game === 'cluance' && !await view.locator('#invite-friend').count()) await view.locator('[data-action=create-invite]').click();
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

async function sharedPoint(host, guest, locator, point = {x: .5, y: .5}) {
  const element = await locator.boundingBox(), source = await host.locator('#game-frame').boundingBox(), target = await guest.locator('#screen-surface').boundingBox();
  const x = (element.x + element.width * point.x - source.x) / source.width;
  const y = (element.y + element.height * point.y - source.y) / source.height;
  assert(x >= 0 && x <= 1 && y >= 0 && y <= 1, 'Shared target must be visible');
  return {x: target.x + x * target.width, y: target.y + y * target.height};
}

async function collectionRoom() {
  console.log('Checking collection rooms, shared cursors and auto-hide');
  const c = await context();
  await c.addInitScript(() => {
    window.__captureCalls = 0;
    navigator.mediaDevices.getDisplayMedia = async () => { window.__captureCalls++; throw new Error('Capture must never be requested.'); };
  });
  const h = await c.newPage(), g = await c.newPage();
  for (const p of [h, g]) { p.setDefaultTimeout(15000); p.on('pageerror', e => errors.push(e.message)); }
  let rooms = 0;
  c.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/rooms') rooms++; });
  await h.goto(origin + '/');
  await h.locator('#invite-friend').click();
  await h.waitForFunction(() => document.querySelector('#room-link').value);
  const link = await h.locator('#room-link').inputValue();
  assert.equal(new URL(link).pathname, '/');
  await h.locator('#room-close').click();
  await h.locator('#invite-friend').click(); // Reopen an existing invitation.
  assert.equal(await h.locator('#room-link').inputValue(), link);
  await g.setViewportSize({width: 320, height: 844});
  await g.goto(link);
  for (const p of [h, g]) await p.waitForFunction(() => window.__together?.connected);
  const peerIDs = await Promise.all([h, g].map(p => p.evaluate(() => window.__testPeers[0].id)));
  // Declining preserves the room without asking for browser capture.
  await h.locator('#screen-toggle').click();
  await h.locator('#screen-accept').click();
  await g.locator('#screen-decline').click();
  await h.waitForFunction(() => window.__together.screen === 'off');
  assert.equal(await h.evaluate(() => window.__captureCalls), 0);
  await g.locator('#screen-toggle').click();
  await h.locator('#screen-accept').click();
  await g.locator('#screen-accept').click();
  await h.waitForFunction(() => window.__together.screen === 'sharing');
  await g.waitForFunction(() => window.__together.screen === 'viewing');
  assert(await g.locator('#game-frame').isVisible());
  assert.equal(await g.locator('video').count(), 0);
  const guestCollection = await (await g.locator('#game-frame').elementHandle()).contentFrame();
  await guestCollection.locator('a.card').first().waitFor();
  assert.equal(await h.locator('#screen-toggle').textContent(), 'Stop');
  const hostCollection = await (await h.locator('#game-frame').elementHandle()).contentFrame();
  const point = await sharedPoint(h, g, hostCollection.locator('a.card[href="spacegolf/"]'));
  await g.mouse.click(point.x, point.y);
  for (const p of [h, g]) await p.waitForFunction(() => window.__together.game === 'spacegolf');
  const golf = await (await h.locator('#game-frame').elementHandle()).contentFrame();
  await golf.locator('canvas').waitFor();
  await g.waitForFunction(() => window.__friendSession.screen.remoteReady);
  const guestGolf = await (await g.locator('#game-frame').elementHandle()).contentFrame();
  await guestGolf.waitForFunction(() => window.__sharedView?.canvas?.scene === 'TitleScene');
  await golf.evaluate(() => {
    window.__remoteEvents = [];
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'keyup']) {
      addEventListener(type, e => { if (!e.isTrusted) window.__remoteEvents.push({type, pointer: e.pointerId}); });
    }
  });
  const bounds = await g.locator('#screen-surface').boundingBox();
  await g.mouse.move(bounds.x + bounds.width * .4, bounds.y + bounds.height * .4);
  await g.mouse.down();
  await g.mouse.move(bounds.x + bounds.width * .6, bounds.y + bounds.height * .6, {steps: 5});
  await g.mouse.up();
  await g.mouse.wheel(0, 100);
  await g.keyboard.press('ArrowRight');
  await golf.waitForFunction(() => ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'keyup'].every(type => window.__remoteEvents.some(e => e.type === type)));
  // The host alone simulates physics; the guest receives matching ball state.
  await golf.evaluate(async () => {
    const {GameScene} = await import('/spacegolf/src/scenes/game.js');
    const {WORLDS} = await import('/spacegolf/src/campaign.js');
    const app = window.spacegolf;
    app.go(new GameScene(app, {level: WORLDS[0].levels[0], title: 'Shared physics'}), true);
    app.scene.fire(-1, .35);
  });
  await guestGolf.waitForFunction(() => window.__sharedView?.canvas?.state?.S?.shots === 1);
  await golf.evaluate(() => { window.spacegolf.scene.update = () => {}; });
  const ball = await golf.evaluate(() => window.spacegolf.scene.S.ball);
  await guestGolf.waitForFunction(ball => JSON.stringify(window.__sharedView.canvas.state.S.ball) === JSON.stringify(ball), ball);
  const retiredEpoch = await g.evaluate(() => window.__friendSession.screen.remoteEpoch);
  await h.mouse.move(400, 300);
  await g.locator('#friend-cursor').waitFor({state: 'visible'});
  await g.locator('#next-game').selectOption('flip-it');
  for (const p of [h, g]) await p.waitForFunction(() => window.__together.game === 'flip-it');
  const flip = await (await h.locator('#game-frame').elementHandle()).contentFrame();
  await flip.locator('#player-name').waitFor();
  await g.waitForFunction(() => window.__friendSession.screen.remoteReady);
  await flip.locator('#player-name').fill('');
  const namePoint = await sharedPoint(h, g, flip.locator('#player-name'));
  await g.mouse.click(namePoint.x, namePoint.y);
  await g.evaluate(epoch => {
    window.__friendSession.screen.send('input', {epoch, input: {kind: 'text', value: 'STALE'}});
    window.__friendSession.screen.send('input', {epoch: window.__friendSession.screen.remoteEpoch, input: {kind: 'text', value: 'X'.repeat(281)}});
  }, retiredEpoch);
  await g.keyboard.type('Alex');
  await flip.waitForFunction(() => document.querySelector('#player-name').value === 'Alex');
  await g.locator('#screen-typing').fill('!');
  await flip.waitForFunction(() => document.querySelector('#player-name').value === 'Alex!');
  assert.equal(await flip.evaluate(() => JSON.parse(localStorage.getItem('flip-it.preferences')).name), 'Alex!');
  const guestFlip = await (await g.locator('#game-frame').elementHandle()).contentFrame();
  await guestFlip.waitForFunction(() => document.querySelector('#player-name')?.value === 'Alex!');
  assert.equal(await guestFlip.evaluate(() => Boolean(window.__flipit)), false, 'Guest must not start a second game engine');
  assert.notEqual(await guestFlip.evaluate(() => JSON.parse(localStorage.getItem('flip-it.preferences')).name), 'Alex!', 'Shared views must not overwrite guest saves');
  await flip.evaluate(() => {
    const secret = document.createElement('input'); secret.type = 'password'; secret.id = 'api-key'; secret.value = 'PRIVATE-CREDENTIAL'; document.body.append(secret);
  });
  await guestFlip.locator('#api-key').waitFor();
  assert.equal(await guestFlip.locator('#api-key').inputValue(), '');
  await flip.evaluate(() => { const field = document.querySelector('#api-key'); field.type = 'text'; field.focus(); });
  await guestFlip.waitForFunction(() => document.querySelector('#api-key')?.type === 'text');
  assert.equal(await guestFlip.locator('#api-key').inputValue(), '', 'Revealed credentials stay private');
  const privateInput = await h.evaluate(() => ({count: window.__friendSession.screen.input.count, start: window.__friendSession.screen.input.windowStarted}));
  await g.evaluate(() => window.__friendSession.screen.send('input', {epoch: window.__friendSession.screen.remoteEpoch, input: {kind: 'text', value: 'UNAUTHORIZED'}}));
  await h.waitForFunction(old => { const input = window.__friendSession.screen.input; return input.count !== old.count || input.windowStarted !== old.start; }, privateInput);
  assert.equal(await flip.locator('#api-key').inputValue(), 'PRIVATE-CREDENTIAL');
  assert(await g.locator('.friend-bar').evaluate(el => el.scrollWidth <= el.clientWidth));
  await screenshot(g, 'shared-cursors-320.png');
  // Exercise an actual shared card drag, including virtual pointer capture.
  await flip.locator('[data-action=table-settings]').click();
  await flip.locator('#table-humans').selectOption('2');
  await flip.locator('#ai-count').selectOption('0');
  await flip.getByRole('button', {name: 'Done', exact: true}).click();
  await flip.locator('[data-action=start-game]').click();
  await flip.locator('[data-action=uncover]').click();
  const flipState = await flip.evaluate(() => window.__flipit.state);
  const flipSeat = await flip.evaluate(() => window.__flipit.seat), play = botAction(flipState, flipSeat);
  assert.equal(play.kind, 'play');
  for (const card of play.cards) await flip.locator('.hand [data-card="' + card + '"]').click();
  const dragFrom = await sharedPoint(h, g, flip.locator('.hand [data-card="' + play.cards[0] + '"]'));
  const dragTo = await sharedPoint(h, g, flip.locator('[data-space-seat="' + flipSeat + '"][data-space-lane="' + play.lane + '"]'));
  await g.mouse.move(dragFrom.x, dragFrom.y); await g.mouse.down();
  await g.mouse.move(dragTo.x, dragTo.y, {steps: 8}); await g.mouse.up();
  await flip.waitForFunction(revision => window.__flipit.state.revision > revision, flipState.revision);
  const flipText = await flip.locator('#app').textContent();
  await guestFlip.waitForFunction(text => document.querySelector('#app').textContent === text, flipText);
  for (const game of ['cluance', 'midnight', 'nonocube', 'pawn-quest', 'collection']) {
    await g.locator('#next-game').selectOption(game);
    await h.waitForFunction(game => window.__together.game === game, game);
    await g.waitForFunction(game => window.__together.game === game, game);
    console.log('Checking local shared view: ' + game);
    await g.waitForFunction(() => window.__friendSession.screen.remoteReady).catch(async error => {
      console.error(await Promise.all([h,g].map(p => p.evaluate(() => ({game: window.__together.game, phase: window.__together.screen, error: document.querySelector('#friend-error').textContent, ready: Boolean(document.querySelector('#game-frame').contentWindow.__sharedView)})))));
      console.error(errors); throw error;
    });
    const hostView = await (await h.locator('#game-frame').elementHandle()).contentFrame();
    const guestView = await (await g.locator('#game-frame').elementHandle()).contentFrame();
    if (game === 'cluance') {
      await hostView.locator('[data-token=partner]').click();
      await hostView.getByRole('button', {name: 'a friend on this screen', exact: true}).click();
      await hostView.locator('#start-game').click();
      await guestView.locator('#pass-ready').waitFor();
      const hold = await sharedPoint(h, g, hostView.locator('#pass-ready'));
      await g.mouse.move(hold.x, hold.y); await g.mouse.down();
      await hostView.locator('#board').waitFor();
      await g.mouse.up();
      await guestView.locator('#board .card-art canvas').first().waitFor();
      const card = await hostView.locator('#board [data-card]').first().getAttribute('data-card');
      await guestView.locator('#board [data-card="' + card + '"] .card-art canvas').waitFor();
      const pixel = await hostView.locator('#board [data-card="' + card + '"] canvas').evaluate(c => [...c.getContext('2d').getImageData(150,200,1,1).data]);
      await guestView.waitForFunction(({card,pixel}) => {
        const canvas = document.querySelector('#board [data-card="' + card + '"] canvas');
        return canvas && JSON.stringify([...canvas.getContext('2d').getImageData(150,200,1,1).data]) === JSON.stringify(pixel);
      }, {card,pixel});
    }
    if (game === 'nonocube') {
      await hostView.getByRole('button', {name: 'Skip', exact: true}).click();
      await hostView.getByRole('button', {name: 'Play', exact: true}).click();
      await hostView.locator('.coll-card').first().click();
      await hostView.locator('.gallery').waitFor();
      await hostView.locator('.gallery').getByRole('button', {name: 'Play', exact: true}).click();
      await guestView.locator('.play').waitFor();
      await guestView.waitForFunction(() => window.__sharedView?.canvas?.list?.block?.count > 0);
      await hostView.waitForFunction(() => { const b = window.__sharedCanvas.snapshot().list.block; return b.count === b.dims.reduce((a,b) => a*b, 1); });
      const count = await hostView.evaluate(() => window.__sharedCanvas.snapshot().list.block.count);
      await guestView.waitForFunction(count => window.__sharedView.canvas.list.block.count === count, count);
      await hostView.getByRole('button', {name: 'Turn right', exact: true}).first().click();
      const before = await guestView.evaluate(() => [...window.__sharedView.canvas.matrix]);
      await guestView.waitForFunction(old => JSON.stringify([...window.__sharedView.canvas.matrix]) !== JSON.stringify(old), before);
    }
    if (game === 'pawn-quest') {
      await hostView.evaluate(() => window.pawnQuest.nav.arena());
      await hostView.getByRole('button', {name: 'Start game ▶', exact: true}).click();
      await hostView.locator('.board-canvas').waitFor();
      await hostView.waitForFunction(() => window.__board?.pos);
      await guestView.locator('.board-canvas').waitFor();
      const fen = await hostView.evaluate(() => window.__board.pos.toFEN());
      await guestView.waitForFunction(fen => window.__sharedView?.canvas?.boards[0]?.fen === fen, fen);
      await hostView.waitForFunction(() => window.__board.interactive === 'move');
      for (const point of [{x:100/180,y:140/180}, {x:100/180,y:100/180}]) {
        const p = await sharedPoint(h, g, hostView.locator('.board-canvas'), point);
        await g.mouse.click(p.x, p.y);
      }
      await hostView.waitForFunction(() => window.__board.pos.b[0x34] === 1);
      await guestView.waitForFunction(() => window.__board?.pos?.b[0x34] === 1);
    }
  }
  await g.locator('#screen-toggle').click();
  for (const p of [h, g]) await p.waitForFunction(() => window.__together.screen === 'off' && window.__together.connected);
  for (let i = 0; i < 2; i++) assert.equal(await [h, g][i].evaluate(() => window.__testPeers[0].id), peerIDs[i]);
  assert.equal(rooms, 1);
  for (const p of [h, g]) {
    assert.equal(await p.evaluate(() => window.__testPeers.length), 1, 'Shared play uses no additional RTC connection');
    assert.equal(await p.evaluate(() => window.__captureCalls), 0);
  }
  await switchGame(h, g, 'flip-it');
  assert.equal((await state(h, 'flip-it')).hands.length, 2);
  // The preference survives game switches; the reveal button remains accessible.
  await g.locator('#friend-settings summary').click();
  await g.locator('#header-auto-hide').check();
  await g.locator('#friend-settings summary').click();
  await (await gameView(g, 'flip-it')).locator('#app').click({position: {x: 2, y: 2}});
  await g.locator('#show-friend-panel').waitFor({state: 'visible'});
  await g.locator('#show-friend-panel').click();
  await g.locator('#friend-settings summary').click();
  await g.locator('#header-auto-hide').uncheck();
  await g.locator('#friend-settings summary').click();
  await switchGame(h, g, 'collection');
  assert.equal(await g.evaluate(() => localStorage.getItem('games.friend-panel-auto-hide')), 'off');
  assert(await g.locator('#friend-header').isVisible());
  await c.close();
  results.push('Collection room: state-only consent, local card/UI/physics/voxel/chess rendering, shared Flip It drag and Cluance hold-to-reveal, protected credentials, scaled controls and cursors, every game, native co-op recovery and auto-hide; one RTC connection and room; zero capture calls');
}

try {
  await collectionRoom();
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
    await h.locator('#chat-toggle').click();
    await h.locator('#chat-input').fill('<b>Good luck!</b>');
    await h.locator('#chat-send').click();
    await g.waitForFunction(() => window.__friendSession.chat.entries.length === 1);
    assert.equal(await g.locator('#chat-toggle').textContent(), 'Chat (1)');
    await g.locator('#chat-toggle').click();
    assert.equal(await g.locator('#chat-log li span').textContent(), '<b>Good luck!</b>');
    assert.equal(await g.locator('#chat-log b').count(), 0);
    await g.locator('#chat-reactions button').last().click();
    await h.waitForFunction(() => window.__friendSession.chat.entries.length === 2);
    await h.locator('#chat-input').fill('Draft for the next game');
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
    assert.equal(await h.locator('#chat-input').inputValue(), 'Draft for the next game');
    assert.equal(await g.locator('#chat-log li').count(), 2);
    for (const p of [h, g]) await p.locator('#chat-close').click();
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
