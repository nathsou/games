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
    const result = {idle, afterMark, flipped, settled, density: board.dpr, baseReused: base === board.baseLayer, moved: board.pos.toFEN().includes('4P3')};
    board.destroy(); container.remove(); return result;
  });
  assert.equal(pawn.idle, 0);
  assert.ok(pawn.afterMark > 0);
  assert.equal(pawn.settled, 0);
  assert.equal(pawn.density, 2);
  assert.ok(pawn.flipped && pawn.baseReused && pawn.moved);
  console.log('Pawn Quest sleeps when idle, wakes for annotations and moves, and caps density:', pawn);
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
