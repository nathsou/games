import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// Run against `npm run dev`. Screenshots always come from the running WebGL app.
const url = process.env.NONOCUBE_URL ?? 'http://127.0.0.1:5173';
const captures = process.argv.includes('--screenshots');
const output = new URL('../docs/mono-screenshots/', import.meta.url);
if (captures) await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
const errors = [];
const settle = (page, ms = 350) => page.waitForTimeout(ms);
const current = (page) => page.locator('.screen:not(.leaving)');
const capture = async (page, name) => {
  await page.mouse.move(4, 4);
  await current(page).locator('.panel-scroll').evaluateAll((els) => els.forEach((el) => el.scrollTop = 0));
  if (captures) await page.screenshot({ path: new URL(`${name}.png`, output).pathname });
};
async function start(options) {
  const page = await browser.newPage(options);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    // Fixed capture conditions; puzzles, clues, solver results and records are real.
    if (!localStorage.getItem('nonocube:v1')) localStorage.setItem('nonocube:v1', JSON.stringify({ welcomed: true, settings: { reducedMotion: true, theme: 'auto', design: 'paper' } }));
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__nono);
  await settle(page, 500);
  return page;
}
async function appearance(page, value) {
  await current(page).getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator(`.settings input[value="${value}"]`).check();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await settle(page);
}
async function assertControlsFit(page) {
  const outside = await current(page).evaluate((screen) => [...screen.querySelectorAll('.topbar button, .dock button, .home-actions button')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width && (r.left < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1);
  }).map((el) => el.textContent));
  assert.deepEqual(outside, [], 'Visible controls must fit within the viewport');
}
// Find an exposed cube and click its actual projected center, with no held key.
async function clickCube(page, wantsShape) {
  const point = await page.evaluate((wantsShape) => {
    const p = window.__nono.app.screen;
    for (let i = 0; i < p.session.grid.size; i++) {
      if (p.session.state[i] === 2 || Boolean(p.session.def.cells[i]) !== wantsShape) continue;
      const xyz = p.session.grid.coords(i);
      const [x, y] = p.app.camera.project(p.worldOf(xyz));
      if (p.pickCell(x, y)?.i === i) return { x, y, i };
    }
    return null;
  }, wantsShape);
  assert.ok(point, 'An exposed test cube must exist');
  await page.mouse.click(point.x, point.y);
  await settle(page, 100);
  return point.i;
}
try {
  const page = await start({ viewport: { width: 1160, height: 700 }, colorScheme: 'light' });
  await capture(page, '01-home-light-desktop');
  await current(page).getByRole('button', { name: 'Play', exact: true }).click();
  await settle(page);
  assert.equal(await current(page).locator('.coll-card').count(), 10);
  await capture(page, '02-galleries-light-desktop');
  await current(page).locator('.coll-card').first().click();
  await settle(page, 600);
  await capture(page, '03-gallery-room-light-desktop');
  await current(page).getByRole('button', { name: 'Play', exact: true }).click();
  await settle(page, 1600);
  await assertControlsFit(page);
  await capture(page, '04-play-light-desktop');
  assert.equal(await page.evaluate(() => window.__nono.app.screen.activeTool), 'break');
  const before = await page.evaluate(() => window.__nono.app.screen.draw().clues.scene.count);
  const broken = await clickCube(page, false);
  assert.equal(await page.evaluate((i) => window.__nono.app.screen.session.state[i], broken), 2);
  await capture(page, '13-play-progress-light-desktop');
  assert.equal(await page.evaluate(() => window.__nono.app.screen.draw().clues.scene.count), before, 'Face clues must survive a broken cube');
  await current(page).getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await page.evaluate((i) => window.__nono.app.screen.session.state[i], broken), 0);
  await current(page).locator('.tool').last().click();
  const painted = await clickCube(page, true);
  assert.equal(await page.evaluate((i) => window.__nono.app.screen.session.state[i], painted), 1);
  await current(page).locator('.tool').first().click();
  await current(page).locator('.tool').first().click();
  assert.equal(await page.evaluate(() => window.__nono.app.screen.activeTool), 'break', 'Clicking the active tool must not deselect it');
  await clickCube(page, true);
  assert.equal(await page.evaluate((i) => window.__nono.app.screen.session.state[i], painted), 1, 'Paint protects shape cubes');
  assert.equal(await page.evaluate(() => window.__nono.app.screen.session.strikes), 0);
  await page.keyboard.down('d');
  assert.equal(await page.evaluate(() => window.__nono.app.screen.activeTool), 'paint');
  await page.keyboard.up('d');
  await page.keyboard.down('Shift');
  assert.equal(await page.evaluate(() => window.__nono.app.screen.activeTool), 'paint');
  await page.keyboard.up('Shift');
  const yaw = await page.evaluate(() => window.__nono.app.camera.yaw);
  await page.mouse.move(60, 230); await page.mouse.down(); await page.mouse.move(200, 240, { steps: 10 }); await page.mouse.up();
  assert.notEqual(await page.evaluate(() => window.__nono.app.camera.yaw), yaw, 'Background drags must orbit with Break selected');
  await page.keyboard.press('r'); await settle(page, 600);
  await page.keyboard.press('x');
  assert.equal(await page.evaluate(() => window.__nono.app.screen.slicer.peel), 1);
  assert.ok(await page.evaluate(() => window.__nono.app.screen.draw().clues.scene.count > 0));
  await page.evaluate(() => window.__nono.app.screen.slicer.reset());
  await current(page).getByRole('button', { name: 'Settings', exact: true }).click();
  await settle(page);
  await capture(page, '07-settings-light-desktop');
  const timer = await page.evaluate(() => window.__nono.app.screen.session.elapsed);
  await settle(page, 300);
  assert.equal(await page.evaluate(() => window.__nono.app.screen.session.elapsed), timer, 'Modal pauses the timer');
  await page.locator('.settings input[value="dark"]').check();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await settle(page, 2400);
  await capture(page, '09-play-dark-desktop');
  await appearance(page, 'auto');
  await page.emulateMedia({ colorScheme: 'dark' });
  await settle(page);
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert.deepEqual(await page.evaluate(() => window.__nono.app.screen.draw().ink), [1, 1, 1]);
  await page.emulateMedia({ colorScheme: 'light' });
  await settle(page);
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.reload(); await page.waitForFunction(() => window.__nono); await settle(page);
  assert.ok(await current(page).getByRole('button', { name: 'Continue', exact: true }).count());
  await current(page).getByRole('button', { name: 'Continue', exact: true }).click();
  await settle(page, 1600);
  assert.equal(await page.evaluate((i) => window.__nono.app.screen.session.state[i], painted), 1, 'Progress survives reload');
  // Finish the actual session to verify the reveal, plaque, records and gallery return.
  await page.evaluate(() => {
    const p = window.__nono.app.screen;
    p.session.beginGroup();
    for (let i = 0; i < p.session.grid.size; i++) if (!p.session.def.cells[i]) p.session.breakCell(i);
    p.session.endGroup(); p.afterChange();
  });
  await page.waitForSelector('.solved-card.in'); await settle(page, 1400);
  assert.equal(await page.evaluate(() => window.__nono.app.screen.session.solved), true);
  await capture(page, '06-solved-light-desktop');
  await current(page).getByRole('button', { name: 'To the gallery', exact: true }).click();
  await settle(page, 400);
  assert.ok(await page.evaluate(() => Object.keys(window.__nono.store.records).length));
  await page.evaluate(() => window.__nono.nav.tutorial()); await settle(page, 1600);
  await capture(page, '05-tutorial-light-desktop');
  const tutorialTimer = await page.evaluate(() => window.__nono.app.screen.session.elapsed);
  await settle(page, 300);
  assert.equal(await page.evaluate(() => window.__nono.app.screen.session.elapsed), tutorialTimer);
  await current(page).getByRole('button', { name: 'Skip tutorial', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Skip', exact: true }).click();
  await settle(page);
  await page.evaluate(() => window.__nono.nav.editor()); await settle(page);
  const editor = current(page);
  await editor.locator('.layer-cell').first().click();
  await editor.getByRole('button', { name: 'Mirror X', exact: true }).click();
  await editor.locator('.layer-cell').nth(4).click();
  assert.equal(await page.evaluate(() => window.__nono.app.screen.cells.filter(Boolean).length), 3, 'Layer edits honor mirror symmetry');
  await editor.getByRole('button', { name: 'L2', exact: true }).click();
  await editor.locator('.layer-cell').nth(1).click();
  await page.waitForFunction(() => window.__nono.app.screen.analysis?.status === 'unique');
  await capture(page, '08-editor-light-desktop');
  await page.keyboard.press('Control+z');
  assert.equal(await page.evaluate(() => window.__nono.app.screen.cells.filter(Boolean).length), 3);
  await page.keyboard.press('Control+Shift+z');
  assert.equal(await page.evaluate(() => window.__nono.app.screen.cells.filter(Boolean).length), 5);
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForFunction(() => window.__nono.store.user.length === 1);
  await page.reload(); await page.waitForFunction(() => window.__nono);
  assert.equal(await page.evaluate(() => window.__nono.store.user.length), 1);
  await page.evaluate(() => window.__nono.nav.editor()); await settle(page);
  assert.equal(await page.evaluate(() => window.__nono.app.screen.cells.filter(Boolean).length), 5, 'Editor draft survives reload');
  console.log('Desktop: appearance, tools, orbit, persistent clues, slicing, undo, persistence, solving, tutorial, editor and solver passed.');

  const phone = await start({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, colorScheme: 'light' });
  await capture(phone, '10-home-light-phone');
  await assertControlsFit(phone);
  await current(phone).getByRole('button', { name: 'Play', exact: true }).click();
  await current(phone).locator('.coll-card').first().click(); await settle(phone, 700);
  await capture(phone, '12-gallery-room-light-phone');
  await current(phone).getByRole('button', { name: 'Play', exact: true }).click(); await settle(phone, 1600);
  await assertControlsFit(phone);
  await capture(phone, '11-play-light-phone');
  assert.ok(await current(phone).locator('.tool').first().getByText('Break', { exact: true }).isVisible());
  assert.ok(await current(phone).locator('.tool').last().getByText('Paint', { exact: true }).isVisible());
  await current(phone).locator('.tool').last().tap();
  assert.equal(await phone.evaluate(() => window.__nono.app.screen.activeTool), 'paint');
  await appearance(phone, 'dark'); await assertControlsFit(phone);
  await phone.setViewportSize({ width: 320, height: 568 }); await settle(phone); await assertControlsFit(phone);
  await phone.evaluate(() => window.__nono.nav.editor()); await settle(phone);
  await assertControlsFit(phone);
  assert.ok(await current(phone).locator('.layer-cell').first().isVisible());
  console.log('Touch: 390px and 320px controls, galleries, tool switch and editor passed.');
  assert.deepEqual(errors, [], 'No browser runtime errors');
} finally {
  await browser.close();
}
