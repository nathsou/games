// Behavioral performance checks; run with a static server and Nonocube's Vite server.
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || '../nonocube/node_modules/playwright/index.mjs');
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--enable-unsafe-swiftshader', ...(process.env.CHROMIUM_NO_SANDBOX === '1' ? ['--no-sandbox'] : [])]});
const page = await browser.newPage({viewport: {width: 1000, height: 760}, deviceScaleFactor: 3});
const origin = process.env.GAMES_URL || 'http://127.0.0.1:8080';
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(origin + '/pawn-quest/');
  const pawn = await page.evaluate(async () => {
    const {BoardView} = await import('/pawn-quest/src/board.js');
    const {Position} = await import('/pawn-quest/src/chess.js');
    const container = document.createElement('div');
    Object.assign(container.style, {width: '360px', height: '360px'}); document.body.append(container);
    const board = new BoardView(container);
    board.setPosition(Position.fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
    let paints = 0;
    const frame = board.frame.bind(board); board.frame = t => { paints++; frame(t); };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await wait(120); paints = 0; await wait(250); const idle = paints;
    board.marks.set(0x34, 'check'); await wait(100); const afterMark = paints;
    const base = board.baseLayer; board.flipped = true; await wait(100);
    const flipped = board.baseKey.endsWith(':true:true');
    const move = board.pos.moveFromUci('e2e4');
    await board.animateMove(move); board.pos.make(move); board.setPosition(board.pos);
    await wait(150); paints = 0; await wait(250); const settled = paints;
    board.shake(20, 110); await wait(300);
    const shakeSettled = board.time >= board.shakeUntil && board.ctx.getTransform().e === 0 && board.ctx.getTransform().f === 0;
    const result = {idle, afterMark, flipped, settled, shakeSettled, density: board.dpr, baseReused: base === board.baseLayer, moved: board.pos.toFEN().includes('4P3')};
    board.destroy(); container.remove(); return result;
  });
  assert.equal(pawn.idle, 0);
  assert.ok(pawn.afterMark > 0);
  assert.equal(pawn.settled, 0);
  assert.equal(pawn.density, 2);
  assert.ok(pawn.flipped && pawn.baseReused && pawn.moved && pawn.shakeSettled);
  console.log('Pawn Quest sleeps when idle, wakes for annotations and moves, and caps density:', pawn);
  await page.goto(origin + '/flip-it/#solo');
  await page.waitForFunction(() => window.__gameCheckpoint && window.__flipit);
  const flip = await page.evaluate(async () => {
    const {createMatch} = await import('/flip-it/src/rules.js');
    const {writeCheckpoint} = await import('/shared/game-checkpoint.js');
    const state = createMatch({compactDeck: false}, 42, 0, 5);
    // Stress a crowded five-player hand while conserving all forty cards.
    for (let seat = 0; seat < 5; seat++) if (seat !== state.turn) state.hands[state.turn].push(...state.hands[seat].splice(1));
    writeCheckpoint('flip-it', {mode: 'solo', seat: state.turn, state, controllers: ['human', 'human', 'human', 'human', 'human']});
    window.__gameCheckpoint.restore();
    const app = document.querySelector('#app');
    const hands = [...app.querySelectorAll('[data-hand-seat]')];
    const scores = [...app.querySelectorAll('[data-score-seat]')];
    const cards = [...app.querySelectorAll('.hand [data-visual-card]')];
    const byID = new Map(cards.map(el => [el.dataset.visualCard, el]));
    // Selection should not measure/clone every card as a turn animation would.
    let measurements = 0;
    for (const card of cards) {
      const measure = card.getBoundingClientRect.bind(card);
      card.getBoundingClientRect = () => { measurements++; return measure(); };
    }
    cards[0].focus(); cards[0].click();
    const focusKept = document.activeElement === cards[0];
    const selected = cards[0].getAttribute('aria-pressed') === 'true';
    app.querySelector('[data-action="preview"]').click();
    const preview = [...app.querySelectorAll('.hand [data-visual-card]')].every(el => el === byID.get(el.dataset.visualCard) && el.disabled && el.classList.contains('preview'));
    app.querySelector('[data-action="preview"]').click();
    const retained = [...hands, ...scores, ...cards].every(el => el.isConnected);
    const labelsValid = cards.every(el => el.getAttribute('aria-label').includes('Rank ' + el.querySelector('.card-rank').textContent));
    const mutations = [];
    const observer = new MutationObserver(records => mutations.push(...records));
    observer.observe(app, {subtree: true, childList: true});
    const start = performance.now();
    for (let i = 0; i < 20; i++) cards[0].click();
    const selectionMs = performance.now() - start;
    await Promise.resolve(); observer.disconnect();
    const detachedCards = mutations.flatMap(r => [...r.removedNodes]).filter(n => n.nodeType === 1 && (n.matches('[data-visual-card], .hand-card, [data-score-seat]') || n.querySelector('[data-visual-card]'))).length;
    return {players: scores.length, handSize: cards.length, retained, focusKept, selected, preview, labelsValid, measurements, detachedCards, selectionMs};
  });
  assert.equal(flip.players, 5); assert.equal(flip.handSize, 36);
  assert.ok(flip.retained && flip.focusKept && flip.selected && flip.preview && flip.labelsValid);
  assert.equal(flip.measurements, 0); assert.equal(flip.detachedCards, 0);
  console.log('Flip it preserves five-player hands, scores, focus and card identity; selection avoids animation capture:', flip);
  const nonocubeOrigin = process.env.NONOCUBE_URL || 'http://127.0.0.1:5173';
  await page.route(nonocubeOrigin + '/performance-test', route => route.fulfill({contentType: 'text/html', body: '<html data-theme="light"><head></head><body><canvas id="gl" style="width:600px;height:500px"></canvas><div id="ui"></div></body></html>'}));
  await page.goto(nonocubeOrigin + '/performance-test');
  const nonocube = await page.evaluate(async () => {
    const {App} = await import('/src/app.ts');
    const {PlayScreen} = await import('/src/ui/play.ts');
    const {store, updateSettings} = await import('/src/game/storage.ts');
    const {allCollections} = await import('/src/data/collections.ts');
    store.settings.reducedMotion = true; store.settings.sound = false;
    const app = new App(document.querySelector('#gl'), document.querySelector('#ui'));
    const puzzle = allCollections[0].puzzles[0];
    const play = new PlayScreen(app, {puzzle, mask: app.maskFor(puzzle), saveKey: null, onExit() {}});
    let draws = 0;
    const render = app.renderer.render.bind(app.renderer);
    app.renderer.render = (...args) => { draws++; return render(...args); };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    app.go(play); await wait(1800);
    draws = 0; const beforeTime = play.session.elapsed; await wait(1100);
    const idleDraws = draws, elapsed = play.session.elapsed - beforeTime;
    app.camera.zoomBy(1.2); app.invalidate(); await wait(1000);
    const zoomDraws = draws; draws = 0; await wait(400); const zoomSettled = draws;
    updateSettings({pixelDensity: '1', antialias: false}); await wait(150);
    const lowDensity = app.renderer.dpr, lowAA = app.renderer.multisample === null;
    updateSettings({pixelDensity: '2', antialias: true}); await wait(150);
    const highDensity = app.renderer.dpr, highAA = !!app.renderer.multisample;
    const gpuError = app.renderer.gl.getError();
    // Changing a puzzle cell wakes an idle board through its regular input path.
    window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'})); await wait(100);
    return {idleDraws, elapsed, zoomDraws, zoomSettled, lowDensity, highDensity, lowAA, highAA, gpuError};
  });
  assert.equal(nonocube.idleDraws, 0);
  assert.ok(nonocube.elapsed >= 0.9 && nonocube.elapsed < 1.4, 'idle puzzle timer tracks real elapsed time');
  assert.ok(nonocube.zoomDraws > 1); assert.equal(nonocube.zoomSettled, 0);
  assert.equal(nonocube.lowDensity, 1); assert.equal(nonocube.highDensity, 2);
  assert.ok(nonocube.lowAA && nonocube.highAA); assert.equal(nonocube.gpuError, 0);
  console.log('Nonocube sleeps while its timer runs, completes zoom easing, and applies graphics settings:', nonocube);
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
