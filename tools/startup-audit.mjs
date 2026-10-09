// Run against the built site (Wrangler or a static server serving _site).
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || '../nonocube/node_modules/playwright/index.mjs');
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--enable-unsafe-swiftshader', ...(process.env.CHROMIUM_NO_SANDBOX === '1' ? ['--no-sandbox'] : [])]});
const origin = process.env.GAMES_URL || 'http://127.0.0.1:8787';
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.addInitScript(() => localStorage.setItem('games-arcade:appearance', 'dark'));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/together/src/app.js', async route => { await gate; await route.continue(); });
  await page.goto(origin + '/together/?game=cluance', {waitUntil: 'commit'});
  await page.locator('#game-loading').waitFor({state: 'visible'});
  assert.equal(await page.locator('html').getAttribute('data-color-theme'), 'dark');
  assert.equal(await page.locator('#game-frame').getAttribute('src'), null, 'game must wait for its parent session');
  assert.equal(await page.locator('#friend-header').count(), 1, 'shell exists before module hydration');
  const frameNode = await page.locator('#game-frame').elementHandle();
  release();
  await page.waitForFunction(() => window.__friendSession?.game === 'cluance');
  await page.frameLocator('#game-frame').locator('#start-game').waitFor();
  await page.locator('#game-loading').waitFor({state: 'hidden'});
  assert.equal(await frameNode.evaluate(el => el === document.querySelector('#game-frame')), true, 'hydrate the existing iframe');
  await page.unroute('**/together/src/app.js');
  console.log('Built shell paints before JavaScript and hydrates without replacing the iframe');

  // Stop at the destination so an example invitation cannot contact signaling.
  await page.route('**/together/src/app.js', route => route.abort());
  for (const game of ['cluance', 'flip-it', 'midnight']) {
    await page.goto(origin + '/' + game + '/');
    await page.waitForURL(url => url.pathname === '/together/' && url.searchParams.get('game') === game);
    assert.equal(await page.locator('#game-loading').count(), 1);
    await page.goto(origin + '/' + game + '/#together=1&room=example');
    await page.waitForURL(url => url.pathname === '/together/' && url.searchParams.get('game') === game);
    assert.equal(new URL(page.url()).hash, '#together=1&room=example');
    await page.goto(origin + '/' + game + '/#solo');
    assert.equal(new URL(page.url()).pathname, '/' + game + '/');
    assert.equal(await page.locator('#game-frame').count(), 0);
  }
  assert.deepEqual(errors, []);
  console.log('Early routing preserves standalone links, embedded games and invitation hashes');
} finally { await browser.close(); }
