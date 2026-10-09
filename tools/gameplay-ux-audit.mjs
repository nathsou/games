// Focused interaction regressions for the games introduced in PR #26.
// Run against a built local server. Uses the same browser variables as parlor-audit.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createGame as createThrice} from '../thrice/src/rules.js';
import {createGame as createYesteryear, correctSlot, year} from '../yesteryear/src/rules.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'../nonocube/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:process.env.CHROMIUM_NO_SANDBOX==='1'?['--no-sandbox']:[]});
const origin=process.env.GAMES_URL||'http://127.0.0.1:8787';
await fs.mkdir('/tmp/gameplay-ux',{recursive:true});
try {
{

const page=await browser.newPage({viewport:{width:1200,height:950}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
let state=createThrice({seats:3},42);state.turn=0;
await page.goto(origin+'/thrice/#solo');
await page.waitForFunction(()=>window.__gameCheckpoint);
await page.evaluate(({state})=>{localStorage.setItem('games.checkpoint.thrice',JSON.stringify({version:1,game:'thrice',updatedAt:Date.now(),data:{setup:{bots:2,theme:'bakery'},state}}));window.__gameCheckpoint.restore();},{state});
await page.screenshot({path:'/tmp/gameplay-ux/thrice-desktop.png',fullPage:true});
const ratios=await page.locator('.card').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return r.height/r.width}));assert(ratios.every(x=>Math.abs(x-1.4)<.02));
await page.locator('.mine [data-end=low]').click();await page.waitForTimeout(500);
await page.locator('.mine [data-end=high]').click();
assert.match(await page.locator('.status').innerText(),/No match/);
assert.equal(await page.locator('.reveal .face').count(),2);
assert.equal(await page.locator('[data-action=middle]:enabled').count(),0);
await page.waitForTimeout(1000);assert.match(await page.locator('.status').innerText(),/No match/);
await page.waitForTimeout(1000);assert.doesNotMatch(await page.locator('.status').innerText(),/No match/);
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/gameplay-ux/thrice-phone.png',fullPage:true});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.locator('[data-action=menu]').click(); await page.locator('#bots').selectOption('5');
assert.equal(await page.evaluate(()=>window.__gameCheckpoint.capture().setup.bots),2);
await page.locator('[data-action=resume]').click(); assert.equal((await page.evaluate(()=>window.__thrice.view)).seats,3);
assert.deepEqual(errors,[]); console.log('Thrice: correct card ratios, mismatch persists, input locked, transition completes, no mobile overflow.');
}
{
const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(origin+'/cover-story/#solo');await page.waitForFunction(()=>window.__coverStory);
assert.equal(await page.locator('#partner').count(),0);
await page.locator('[data-action=start]').click();assert.equal(await page.locator('.handoff').count(),1);assert.equal(await page.locator('.board').count(),0);
await page.locator('[data-action=ready]').click();await page.locator('#clue-word').fill('zebrafinch');await page.locator('.clue-form button').click();
assert.equal(await page.locator('.handoff').count(),1);assert.equal(await page.locator('.board').count(),0);
await page.locator('[data-action=ready]').click();assert.equal(await page.locator('.board .word').count(),25);assert.match(await page.locator('.status').innerText(),/ZEBRAFINCH/);
await page.screenshot({path:'/tmp/gameplay-ux/cover-duo-phone.png',fullPage:true});
await page.locator('[data-action=menu]').click();await page.locator('[data-mode=duel]').click();await page.locator('[data-action=start]').click();
let before=await page.evaluate(()=>window.__coverStory.view);await page.locator('.board .word').first().click();await page.locator('[data-action=confirm]').click();let after=await page.evaluate(()=>window.__coverStory.view);assert.equal(after.revision,before.revision+1);assert.notEqual(after.acting,before.acting);assert.equal(await page.locator('.handoff').count(),0);
await page.screenshot({path:'/tmp/gameplay-ux/cover-duel-phone.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
assert.deepEqual(errors,[]);console.log('Cover Story: human defaults, private Duo handoff, human Duel alternation, no mobile overflow.');
}
{

const page=await browser.newPage({viewport:{width:1200,height:1000}}), errors=[];page.on('pageerror',e=>errors.push(e.message));
const state=createYesteryear({mode:'streak',seats:1},42);
async function restore(){await page.evaluate(state=>{localStorage.setItem('games.checkpoint.yesteryear',JSON.stringify({version:1,game:'yesteryear',updatedAt:Date.now(),data:{setup:{mode:'streak',bots:1},state}}));window.__gameCheckpoint.restore();},state);}
await page.goto(origin+'/yesteryear/#solo');await page.waitForFunction(()=>window.__gameCheckpoint);await restore();
await page.locator('[data-action=pick]').first().click();assert.equal(await page.locator('.picked').count(),1);
await page.locator('[data-action=slot]').nth(correctSlot(state.timeline,state.hands[0][0])).click();
assert.equal((await page.evaluate(()=>window.__yesteryear.view)).revision,1);assert.equal(await page.locator('.fresh').count(),1);assert.equal(await page.locator('[data-action=pick]:enabled').count(),0);await page.waitForTimeout(1950);
await restore();
const cancelled=await page.locator('[data-action=pick]').first().boundingBox();
await page.mouse.move(cancelled.x+60,cancelled.y+40);await page.mouse.down();await page.mouse.move(cancelled.x+60,cancelled.y+15,{steps:4});
await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await page.locator('.drag-ghost').count(),0);assert.equal((await page.evaluate(()=>window.__yesteryear.view)).revision,0);
await page.locator('[data-slot]').nth(correctSlot(state.timeline,state.hands[0][0])).focus();await page.keyboard.press('Enter');
assert.equal((await page.evaluate(()=>window.__yesteryear.view)).revision,1);await page.waitForTimeout(1950);await restore();
const source=await page.locator('[data-action=pick]').first().boundingBox();await page.mouse.move(source.x+source.width/2,source.y+40);await page.mouse.down();await page.mouse.move(source.x+source.width/2,source.y+15,{steps:4});
assert.equal(await page.locator('.drag-ghost').count(),1);const target=await page.locator('[data-slot]').nth(correctSlot(state.timeline,state.hands[0][0])).boundingBox();await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:15});await page.mouse.up();
assert.equal((await page.evaluate(()=>window.__yesteryear.view)).revision,1);assert.equal(await page.locator('.drag-ghost').count(),0);await page.screenshot({path:'/tmp/gameplay-ux/yesteryear-desktop.png',fullPage:true});await page.waitForTimeout(1950);
await page.setViewportSize({width:390,height:844});await restore();
await page.locator('[data-action=pick]').first().scrollIntoViewIfNeeded();const src=await page.locator('[data-action=pick]').first().boundingBox();const cdp=await page.context().newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:src.x+60,y:src.y+40}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:src.x+60,y:src.y+15}]});
assert.equal(await page.locator('.drag-ghost').count(),1);
const dst=await page.locator('[data-slot]').nth(correctSlot(state.timeline,state.hands[0][0])).boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:dst.x+dst.width/2,y:Math.max(80,dst.y+dst.height/2)}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal((await page.evaluate(()=>window.__yesteryear.view)).revision,1);
await page.waitForTimeout(1950);await page.screenshot({path:'/tmp/gameplay-ux/yesteryear-phone.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));state.timeline.push(...state.deck.splice(0,9));state.timeline.sort((a,b)=>year(a)-year(b));await restore();
await page.locator('.tl').evaluate(el=>{el.scrollLeft=400;});const scroll=await page.locator('.tl').evaluate(el=>el.scrollLeft);
await page.locator('[data-action=pick]').first().click();assert.equal(await page.locator('.tl').evaluate(el=>el.scrollLeft),scroll);
await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.tl-card').first().evaluate(el=>getComputedStyle(el).animationName),'none');
assert.deepEqual(errors,[]);console.log('Yesteryear: click placement, mouse drag, real touch drag, Escape cancellation, keyboard placement, scroll preservation, reduced motion and mobile layout passed.');
}
{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(origin+'/ripples/#solo');await page.waitForFunction(()=>window.__ripples);
  await page.locator('[data-action=start]').click();
  for(let i=0;i<3;i++) await page.locator('[data-action=hint]').click();
  const v=await page.evaluate(()=>window.__ripples.view), pair=v.board.hint.words;
  await page.locator('[data-action=cell][data-index="'+pair[0]+'"]').click();
  await page.locator('[data-action=clear]').click();assert.equal(await page.locator('.cell.first').count(),0);
  for(const i of pair) await page.locator('[data-action=cell][data-index="'+i+'"]').click();
  assert.deepEqual(await page.locator('.start-word').allTextContents(),pair.map(i=>v.grid[i]));
  await page.locator('[data-action=giveup]').click();assert.equal((await page.evaluate(()=>window.__ripples.view)).board.gaveUp,false);
  await page.locator('#parlor-dialog .dialog-body [data-close]').first().click();
  await page.locator('[data-action=giveup]').click();await page.locator('[data-action=confirm-reveal]').click();
  assert.equal((await page.evaluate(()=>window.__ripples.view)).board.gaveUp,true);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log('Ripples: current chain clues, selection clearing and deliberate answer reveal passed.');
}
} finally { await browser.close(); }
