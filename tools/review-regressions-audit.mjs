// Run against Wrangler (GAMES_URL, default :8787) and Nonocube's Vite dev server
// (NONOCUBE_URL, default :8788). Uses isolated browser storage and dummy secrets.
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || '../nonocube/node_modules/playwright/index.mjs');
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--enable-unsafe-swiftshader', ...(process.env.CHROMIUM_NO_SANDBOX === '1' ? ['--no-sandbox'] : [])]});
const origin = process.env.GAMES_URL || 'http://127.0.0.1:8787';
const errors = [];
const page = await browser.newPage();
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(origin + '/');
  await page.waitForFunction(() => window.__friendSession?.screen);
  await page.evaluate(() => {
    localStorage.setItem('review-dummy-secret', 'dummy-key');
    const screen = window.__friendSession.screen;
    screen.start({sharer: false, id: crypto.randomUUID()});
    screen.handle({type: 'friend-screen-page', id: screen.id, epoch: crypto.randomUUID(), page: 'collection', size: [1000, 700]});
  });
  await page.waitForFunction(() => document.querySelector('#game-frame').contentWindow.__sharedView);
  await page.evaluate(() => {
    const node = (id, tag, attrs, children = [], svg = false) => ({id, tag, attrs, children, svg});
    const view = {tree: node(1, 'body', {}, [
      node(2, 'a', {HREF: "javascript:void(parent.reviewProof=localStorage.getItem('review-dummy-secret'))", AUTOFOCUS: '', id: 'probe', OnClick: 'parent.reviewProof=1', unknown: 'reject'}, [{id: 3, text: 'Press Enter'}]),
      node(4, 'form', {ACTION: 'https://example.com', id: 'form'}),
      node(5, 'img', {SRC: 'javascript:parent.reviewProof=1', id: 'image'}),
    ])};
    const screen = window.__friendSession.screen;
    screen.handle({type: 'friend-screen-state', id: screen.id, epoch: screen.remoteEpoch, seq: 1, part: 0, total: 1, data: JSON.stringify({replace: {view, canvas: null}})});
  });
  const frame = await (await page.locator('#game-frame').elementHandle()).contentFrame();
  await frame.locator('#probe').waitFor();
  assert.deepEqual(await frame.locator('#probe').evaluate(n => [...n.attributes].map(a => a.name)), ['id']);
  assert.equal(await frame.locator('#form').getAttribute('action'), null);
  assert.equal(await frame.locator('#image').getAttribute('src'), null);
  await frame.locator('#probe').focus();
  await page.keyboard.press('Enter');
  await frame.locator('#probe').click();
  assert.equal(await page.evaluate(() => window.reviewProof), undefined);
  // Cached nodes must also lose rejected attributes; safe SVG casing survives.
  assert.deepEqual(await page.evaluate(async () => {
    const {applyView} = await import('/shared/view-state.js');
    const doc = document.querySelector('#game-frame').contentDocument;
    const cache = new Map([[2, doc.querySelector('#probe')]]);
    cache.get(2).setAttribute('href', 'javascript:void(0)');
    const node = (id, tag, attrs, children = [], svg = false) => ({id, tag, attrs, children, svg});
    applyView(doc, {tree: node(1, 'body', {}, [node(2, 'a', {href: 'javascript:void(0)'}), node(3, 'svg', {viewBox: '0 0 10 10'}, [node(4, 'use', {'xlink:href': '#local'}, [], true)], true), node(5, 'img', {src: '/cluance/assets/nonexistent.png', alt: 'safe'})])}, cache);
    return {href: doc.querySelector('a').getAttribute('href'), viewBox: doc.querySelector('svg').getAttribute('viewBox'), reference: doc.querySelector('use').getAttribute('xlink:href'), alt: doc.querySelector('img').alt};
  }), {href: null, viewBox: '0 0 10 10', reference: '#local', alt: 'safe'});
  console.log('Shared-play case variants and cached attributes cannot execute JavaScript');

  await page.goto(origin + '/spacegolf/');
  await page.waitForFunction(() => window.spacegolf);
  const golf = await page.evaluate(async () => {
    const {playCustom} = await import('/spacegolf/src/scenes/create.js');
    const {EndlessRun, playHole} = await import('/spacegolf/src/scenes/endless.js');
    const app = window.spacegolf;
    const level = (name, radius) => ({name, bodies: [{type: 'planet', x: 0, y: 0, r: radius}], tee: {body: 0, angle: 0}, hole: {body: 0, angle: 1}, bounds: {w: 1600, h: 900}});
    app.store.data.custom = [{id: 'first', name: 'First hole', level: level('First hole', 100)}, {id: 'second', name: 'Second hole', level: level('Second hole', 150)}];
    playCustom(app, app.store.data.custom[1]);
    const scene = app.nextScene || app.scene;
    scene.S.shots = 2;
    scene.history.push(structuredClone(scene.S));
    window.__gameCheckpoint.save();
    const saved = window.__gameCheckpoint.capture();
    window.__gameCheckpoint.restore();
    const restored = window.__gameCheckpoint.capture();
    // The callback still belongs to the second entry, not the first.
    (app.nextScene || app.scene).onCapture({x: 0, y: 0});
    window.__gameCheckpoint.save();
    window.__gameCheckpoint.restore();
    const won = window.__gameCheckpoint.capture();
    const bests = app.store.data.custom.map(e => e.best?.strokes ?? null);
    // Restore older checkpoints lacking an entry ID, then an edited saved hole.
    const restore = data => {localStorage.setItem('games.checkpoint.spacegolf', JSON.stringify({version: 1, game: 'spacegolf', updatedAt: Date.now(), data})); window.__gameCheckpoint.restore(); return window.__gameCheckpoint.capture();};
    const legacy = structuredClone(saved); delete legacy.customId;
    const legacyRestored = restore(legacy);
    app.store.data.custom[1].level.bodies[0].r = 250;
    const editedRestored = restore(saved);
    // An Endless completion has already updated its counters before capture.
    const run = new EndlessRun(app, 1, false); run.holes = 3; run.over = 2;
    run.prefetch = () => {};
    playHole(app, run, {seed: 1, d: 1, level: saved.level});
    const endlessScene = app.nextScene || app.scene; endlessScene.S.shots = 1; endlessScene.onCapture({x: 0, y: 0});
    window.__gameCheckpoint.save(); const endlessSaved = window.__gameCheckpoint.capture();
    window.__gameCheckpoint.restore(); const endlessRestored = window.__gameCheckpoint.capture();
    return {saved, restored, won, bests, legacyRestored, editedRestored, endlessSaved, endlessRestored};
  });
  assert.equal(golf.restored.level.name, 'Second hole');
  assert.equal(golf.restored.customId, 'second');
  assert.deepEqual(golf.restored.S, golf.saved.S);
  assert.deepEqual(golf.restored.history, golf.saved.history);
  assert.equal(golf.won.state, 'won');
  assert.deepEqual(golf.bests, [null, 2]);
  assert.deepEqual(golf.legacyRestored.level, golf.saved.level);
  assert.deepEqual(golf.editedRestored.level, golf.saved.level);
  assert.equal(golf.endlessRestored.state, 'won');
  assert.deepEqual(golf.endlessRestored.run, golf.endlessSaved.run);
  console.log('Custom, legacy, edited, and completed Endless golf checkpoints restore correctly');

  await page.goto(process.env.NONOCUBE_URL || 'http://127.0.0.1:8788/');
  await page.waitForFunction(() => window.__nono);
  const puzzle = await page.evaluate(async () => {
    const {encodePuzzle} = await import('/src/core/codec.ts');
    const common = {name: 'Puzzle', difficulty: 'easy', dims: [2, 2, 2], palette: ['#123456', '#654321', '#abcdef', '#fedcba'], mask: new Uint8Array(12).fill(1)};
    return {first: encodePuzzle({...common, cells: Uint8Array.from([0, 0, 1, 1, 1, 1, 1, 1])}), second: encodePuzzle({...common, cells: Uint8Array.from([1, 0, 1, 1, 1, 1, 1, 1])})};
  });
  await page.evaluate(code => {location.hash = 'p=' + code;}, puzzle.first);
  await page.waitForFunction(() => window.__nono.app.screen?.session);
  const firstId = await page.evaluate(() => {
    const screen = window.__nono.app.screen; screen.session.breakCell(0); screen.persist(true); window.__gameCheckpoint.save(); return screen.opts.saveKey;
  });
  await page.evaluate(code => {location.hash = 'p=' + code;}, puzzle.second);
  await page.waitForFunction(id => window.__nono.app.screen?.opts?.saveKey !== id, firstId);
  assert.equal(await page.evaluate(() => window.__nono.app.screen.session.state[0]), 0);
  await page.evaluate(code => {location.hash = 'p=' + code;}, puzzle.first);
  await page.waitForFunction(id => window.__nono.app.screen?.opts?.saveKey === id, firstId);
  assert.equal(await page.evaluate(() => window.__nono.app.screen.session.state[0]), 2);
  console.log('Colliding shared puzzle prefixes keep independent progress');

  const checkpoints = await page.evaluate(async () => {
    const {encodePuzzle, decodePuzzle, sharedPuzzleId} = await import('/src/core/codec.ts');
    const {app, nav} = window.__nono;
    const puzzle = {id: 'source', name: 'Without a mask', difficulty: 'easy', dims: [2, 2, 2], palette: ['#ffffff'], cells: Uint8Array.from([0, 0, 1, 1, 1, 1, 1, 1])};
    puzzle.id = sharedPuzzleId(puzzle);
    nav.playCustom(puzzle, () => nav.home(), puzzle.id);
    app.screen.session.breakCell(0);
    window.__gameCheckpoint.save();
    const before = window.__gameCheckpoint.capture();
    window.__gameCheckpoint.restore();
    const after = window.__gameCheckpoint.capture();
    const legacy = structuredClone(before);
    legacy.id = 'shared-' + legacy.code.slice(0, 24); legacy.saveKey = legacy.id;
    delete legacy.identityCode; delete legacy.progress.puzzleCode;
    localStorage.setItem('games.checkpoint.nonocube', JSON.stringify({version: 1, game: 'nonocube', updatedAt: Date.now(), data: legacy}));
    window.__gameCheckpoint.restore();
    return {before, after, legacy: window.__gameCheckpoint.capture(), legacyId: sharedPuzzleId(decodePuzzle(legacy.code))};
  });
  assert.equal(checkpoints.after.id, checkpoints.before.id);
  assert.equal(checkpoints.after.saveKey, checkpoints.before.saveKey);
  assert.deepEqual(checkpoints.after.progress, checkpoints.before.progress);
  assert.equal(checkpoints.legacy.id, checkpoints.legacyId);
  assert.equal(checkpoints.legacy.progress.state, checkpoints.before.progress.state);
  console.log('Shared puzzle checkpoints retain identity and migrate legacy truncated IDs');

  const editor = await page.evaluate(async () => {
    const {app, nav, store} = window.__nono;
    const mask = new Uint8Array(12).fill(1); mask[0] = 0;
    nav.editor({id: 'review-editor', name: 'Review', dims: [2, 2, 2], cells: new Uint8Array(8).fill(1), palette: ['#ffffff'], difficulty: 'easy', mask});
    while (app.screen.analyzing) await new Promise(resolve => setTimeout(resolve, 50));
    const before = Array.from(app.screen.mask);
    await app.screen.playtest();
    const playtestId = app.screen.opts.puzzle.id; app.screen.opts.onExit();
    const after = Array.from(app.screen.mask); app.screen.saveDraft();
    return {before, after, playtestId, draftMask: JSON.parse(store.editorDraft).mask};
  });
  assert.equal(editor.playtestId, 'playtest');
  assert.deepEqual(editor.after, editor.before);
  assert.deepEqual(editor.draftMask, editor.before);
  await page.reload(); await page.waitForFunction(() => window.__nono);
  assert.deepEqual(await page.evaluate(() => {const {app, nav} = window.__nono; nav.editor(); return Array.from(app.screen.mask);}), editor.before);
  console.log('Editor clue masks survive playtesting, returning, and reloading');
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
