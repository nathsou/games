// Run against a static preview of the repository or _site. No provider API calls.
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || '../nonocube/node_modules/playwright/index.mjs');
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--enable-unsafe-swiftshader', ...(process.env.CHROMIUM_NO_SANDBOX === '1' ? ['--no-sandbox'] : [])]});
const origin = process.env.GAMES_URL || 'http://127.0.0.1:8080';
const page = await browser.newPage({viewport: {width: 960, height: 720}});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  // Hold back the application to inspect the first HTML paint and saved theme.
  await page.addInitScript(() => localStorage.setItem('games-arcade:appearance', 'dark'));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/shared/game-entry.js', async route => { await gate; await route.continue(); });
  await page.goto(origin + '/cluance/#solo', {waitUntil: 'commit'});
  await page.locator('.home-hero').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-color-theme'), 'dark');
  assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(20, 18, 15)');
  release();
  await page.waitForFunction(() => window.__cluance);
  await page.unroute('**/shared/game-entry.js');
  await page.evaluate(async () => {
    const {loadArt} = await import('/cluance/src/art.js');
    await loadArt([...document.querySelectorAll('#hero-art [data-card]')].map(el => el.dataset.card));
  });
  const art = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.endsWith('.webp')).reduce((a, r) => ({count: a.count + 1, bytes: a.bytes + r.encodedBodySize}), {count: 0, bytes: 0}));
  assert.ok(art.count <= 3, `Home loaded ${art.count} atlases`);
  assert.ok(art.bytes < 2_000_000, `Home loaded ${art.bytes} bytes`);
  console.log('Cluance first paint uses the saved theme; home artwork:', art);

  // A single failed atlas must not take down the home UI; it can be retried.
  await page.route('**/cluance/assets/*.webp', route => route.abort());
  await page.reload();
  await page.locator('#start-game').waitFor();
  const failure = await page.evaluate(async () => {
    const {loadArt} = await import('/cluance/src/art.js');
    try { await loadArt([document.querySelector('#hero-art [data-card]').dataset.card]); return false; }
    catch { return true; }
  });
  assert.equal(failure, true);
  await page.unroute('**/cluance/assets/*.webp');
  await page.waitForFunction(() => document.querySelector('#hero-art canvas').onclick);
  await page.locator('#hero-art canvas').last().click({force: true});
  await page.evaluate(async () => {
    const {loadArt, drawArt} = await import('/cluance/src/art.js');
    await loadArt([...document.querySelectorAll('#hero-art [data-card]')].map(el => el.dataset.card));
    // Retrying a second card whose atlas is now cached clears its retry handler.
    const canvas = document.querySelector('#hero-art canvas');
    drawArt(canvas, canvas.__friendCard);
    if (canvas.onclick !== null) throw Error('Recovered artwork still intercepts card clicks');
  });
  // Observation rendering awaits its own artwork, independent of the home deck.
  const image = await page.evaluate(async () => {
    const {observationImage} = await import('/cluance/src/art.js');
    const {createGame, viewFor} = await import('/cluance/src/game.js');
    const game = createGame({theme: 'cities', clueTheme: 'countries'});
    return (await observationImage(viewFor(game, 'giver'), 'giver')).slice(0, 22);
  });
  assert.equal(image, 'data:image/png;base64,');
  console.log('Cluance artwork failure/retry and fully loaded AI observation passed');

  await page.goto(origin + '/spacegolf/');
  await page.waitForFunction(() => window.spacegolf);
  const rendering = await page.evaluate(async () => {
    const app = window.spacegolf, r = app.r, gl = r.gl;
    const presets = [];
    for (const quality of ['high', 'medium', 'low']) {
      app.store.settings.quality = quality;
      app.applyQuality();
      let passes = 0;
      const draw = gl.drawArrays.bind(gl);
      gl.drawArrays = (...args) => { passes++; draw(...args); };
      app.frame(1 / 60);
      gl.drawArrays = draw;
      const complete = r.allTargets.every(target => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      });
      presets.push({quality, passes, pixels: r.W * r.H, complete, error: gl.getError()});
    }
    app.store.settings.quality = 'high'; app.applyQuality(); app.frame(1 / 60);
    // Test procedural background and every sprite at camera positions outside
    // the original playfield. Reading HDR values detects NaN contamination.
    const {T} = await import('/spacegolf/src/renderer.js');
    const scans = [];
    for (const [x, y, scale] of [[0, 0, 1], [-4000, -2000, .15], [4000, 2000, .15], [20000, -20000, .15]]) {
      r.beginFrame(1); r.cam = {x, y, scale}; r.bounds = {hw: 800, hh: 450};
      r.background({c1: [.22, .12, .5], c2: [.05, .3, .55], seed: 3});
      for (const type of Object.values(T)) r.sprite(false, type, x + (type - 6) * 80, y, 100, 30, 2, 1, 1, 1, 1, 1, 1);
      r.sprite(true, T.CAPSULE, x, y + 100, 50, 2, 7, 0, 0, 1, 1, 1, 1);
      r.flushWorld();
      const values = r.hdr ? new Float32Array(r.W * r.H * 4) : new Uint8Array(r.W * r.H * 4);
      gl.readPixels(0, 0, r.W, r.H, gl.RGBA, r.hdr ? gl.FLOAT : gl.UNSIGNED_BYTE, values);
      scans.push({x, y, nonfinite: values.reduce((n, v) => n + !Number.isFinite(v), 0), error: gl.getError()});
    }
    app.playCampaign(0, 0);
    app.go(app.nextScene, true); app.nextScene = null;
    const scene = app.scene;
    Object.assign(scene.S.ball, {mode: 'fly', x: 12000, y: -9000, vx: 200, vy: -50});
    scene.camState = null;
    app.frame(1 / 60);
    const camera = {...r.cam};
    // A hidden tab neither schedules rendering nor advances the simulation.
    const time = app.time;
    Object.defineProperty(document, 'hidden', {configurable: true, value: true});
    document.dispatchEvent(new Event('visibilitychange'));
    app.loop(performance.now() + 1000);
    const paused = app.time === time && app.raf === null;
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
    return {presets, scans, camera, paused};
  });
  assert.ok(rendering.presets.every(p => p.complete && p.error === 0));
  assert.ok(rendering.presets[2].passes < rendering.presets[1].passes);
  assert.ok(rendering.presets[1].passes < rendering.presets[0].passes);
  assert.ok(rendering.scans.every(s => s.nonfinite === 0 && s.error === 0));
  assert.ok(rendering.camera.x > 8000 && rendering.camera.y < -6000);
  assert.equal(rendering.paused, true);
  console.log('Space Golf presets, offscreen rendering, camera tracking and hidden-tab pause:', rendering);

  // Record the canvas hit regions, then use real pointer input to pick settings.
  await page.evaluate(async () => {
    const {SettingsScene} = await import('/spacegolf/src/scenes/settings.js');
    const app = window.spacegolf;
    window.auditButtons = {};
    const button = app.ui.button.bind(app.ui);
    app.ui.button = (id, x, y, w, h, options) => {
      window.auditButtons[id] = {x, y, w, h};
      return button(id, x, y, w, h, options);
    };
    app.go(new SettingsScene(app), true);
  });
  const click = async id => {
    await page.waitForFunction(id => window.auditButtons[id], id);
    const b = await page.evaluate(id => window.auditButtons[id], id);
    await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2, {delay: 100});
  };
  await click('tab-graphics');
  await click('gq3');
  await click('fps0');
  await click('bg0');
  await click('bl0');
  await click('glass0');
  await page.waitForFunction(() => window.spacegolf.store.settings.fps === 30 && window.spacegolf.r.graphics.glass === false);
  const preferences = await page.evaluate(() => ({...window.spacegolf.store.settings}));
  assert.equal(preferences.quality, 'low');
  assert.equal(preferences.background, 'stars');
  assert.equal(preferences.bloom, false);
  assert.equal(preferences.glass, false);
  await page.setViewportSize({width: 390, height: 700});
  await page.waitForFunction(() => window.spacegolf.r.cssW === 390);
  const fits = await page.evaluate(() => ['gq0', 'gq3', 'fps0', 'bg0', 'glass1'].every(id => {
    const b = window.auditButtons[id];
    return b.x >= 0 && b.y >= 0 && b.x + b.w <= innerWidth && b.y + b.h <= innerHeight;
  }));
  assert.equal(fits, true);
  if (process.env.AUDIT_SCREENSHOT) await page.screenshot({path: process.env.AUDIT_SCREENSHOT});
  await page.reload();
  await page.waitForFunction(() => window.spacegolf && !window.spacegolf.graphicsPending);
  assert.deepEqual(await page.evaluate(() => ({...window.spacegolf.store.settings})), preferences);
  console.log('Space Golf controls work at phone width and persist after reload');

  await page.goto(origin + '/together/?game=cluance');
  await page.frameLocator('#game-frame').locator('#start-game').waitFor();
  await page.reload();
  await page.frameLocator('#game-frame').locator('#start-game').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-color-theme'), 'dark');
  console.log('Cluance reload inside the shared game shell passed');

  for (const game of ['flip-it', 'midnight', 'pawn-quest', 'collection']) {
    await page.goto(origin + '/' + game + '/#solo');
    await page.waitForFunction(() => document.querySelector('#app')?.children.length || document.querySelector('.grid .card'));
    await page.reload();
  }
  if (process.env.NONOCUBE_URL) {
    await page.goto(process.env.NONOCUBE_URL);
    await page.locator('#gl').waitFor();
    await page.locator('#ui button').first().waitFor();
    await page.reload();
    await page.locator('#gl').waitFor();
    await page.locator('#ui button').first().waitFor();
    console.log('Nonocube production reload passed');
  }
  assert.deepEqual(errors, []);
  console.log('Other game reload smoke checks passed; no uncaught browser errors');
} finally { await browser.close(); }
