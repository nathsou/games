// Run npm run build:assets and npm run dev before this browser integration suite.
import assert from 'node:assert/strict';
import {installTestPeer} from './test-peer.mjs';
import {botAction} from '../flip-it/src/bot.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--enable-unsafe-swiftshader',...(process.env.CHROMIUM_NO_SANDBOX==='1'?['--no-sandbox']:[])]});
const origin=process.env.GAMES_URL||'http://127.0.0.1:8787',errors=[],results=[];
async function page(context){const p=await context.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));return p;}
async function frame(p){return(await p.locator('#game-frame').elementHandle()).contentFrame();}
async function game(p,name){await p.waitForFunction(name=>window.__together?.game===name,name);const f=await frame(p);await f.waitForFunction(name=>Boolean(window[name]),name==='cluance'?'__cluance':name==='midnight'?'__midnight':'__flipit');return f;}
async function invite(p,name,mode='live'){
  await p.goto(origin+'/');await showPanel(p);await p.locator('#invite-friend').click();await p.locator('#room-game').selectOption(name);
  if(mode==='async')await p.locator('#room-play-mode').selectOption('async');
  if(name==='cluance'){await p.locator('#room-setup-role').selectOption('giver');await p.locator('#room-setup-variant').selectOption('fixed');}
  await p.locator('#room-create').click();await p.waitForFunction(()=>document.querySelector('#room-link').value);const link=await p.locator('#room-link').inputValue();assert.equal(new URL(link).pathname,'/');await p.locator('#room-close').click();return link;
}
async function showPanel(p){if(!await p.locator('#friend-header').isVisible())await p.locator('#show-friend-panel').click();}
async function hidePanel(p){if(await p.locator('#friend-header').isVisible())await p.locator('#hide-friend-panel').click();}
async function sendChat(p,text){await p.locator('#chat-toggle').click();await p.locator('#chat-input').fill(text);await p.locator('#chat-send').click();await p.locator('#chat-log').getByText(text,{exact:true}).waitFor();}
async function flipMove(p){const f=await game(p,'flip-it'),v=await f.evaluate(()=>window.__flipit.state),seat=await f.evaluate(()=>window.__flipit.seat),move=botAction(v,seat);
  if(move.kind==='next'){await f.locator('[data-action=next]').click();return;}
  if(!v.options.quickTurns)await f.locator('[data-action=lane][data-lane="'+move.lane+'"]').click();
  for(const id of move.cards||[])await f.locator('[data-card="'+id+'"]').click();
  if(['add','take'].includes(move.kind)) {const target=f.locator('[data-action='+move.kind+'][data-owner="'+move.targetSeat+'"][data-target="'+move.target+'"]');if(!await target.isVisible())await f.locator('[data-action=inspect-set][data-owner="'+move.targetSeat+'"][data-target="'+move.target+'"] ').click();await target.click();}
  else await f.locator('[data-action='+move.kind+']').click();
}
async function switchGame(h,g,name){await h.locator('#next-game').selectOption(name);if(name!=='collection')await h.locator('#game-setup-start').click();await g.locator('#accept-switch').click();for(const p of [h,g])await p.waitForFunction(name=>window.__together?.game===name&&!window.__together.loading,name);}
try{
  // No RTC substitute here: async works with two independent browsers and either offline.
  const hc=await browser.newContext(),gc=await browser.newContext(),h=await page(hc),g=await page(gc);
  const link=await invite(h,'cluance','async');await g.goto(link);
  const hf=await game(h,'cluance');await hf.waitForFunction(()=>window.__cluance.mode==='async');let gf=await game(g,'cluance');await gf.waitForFunction(()=>window.__cluance.mode==='async');
  const privateView=await hf.evaluate(()=>window.__cluance.state),publicView=await gf.evaluate(()=>window.__cluance.state);
  assert(privateView.secret&&privateView.hand.length===5);assert(!publicView.secret&&!publicView.hand);assert.equal(privateView.variant,'fixed');
  await sendChat(h,'A persistent conversation');await g.evaluate(()=>window.__friendSession.chat.refresh());await g.locator('#chat-toggle').click();await g.locator('#chat-log').getByText('A persistent conversation',{exact:true}).waitFor();
  await hidePanel(h);await hf.locator('#hand [data-card]').first().click();await hf.locator('#confirm-move').click();await hf.waitForFunction(()=>window.__cluance.state.revision===1);
  // Close the giver's tab entirely; the guesser can still submit a legal move.
  await h.close();await g.evaluate(()=>window.__friendSession.refreshInbox());await gf.waitForFunction(()=>window.__cluance.state.phase==='guess');
  const safe=publicView.board.find(id=>id!==privateView.secret);await hidePanel(g);await gf.locator('#board [data-card="'+safe+'"]').click();await gf.locator('#confirm-move').click();await gf.waitForFunction(()=>window.__cluance.state.revision===2);
  const returned=await page(hc);await returned.goto(origin+'/');const restored=await game(returned,'cluance');await restored.waitForFunction(()=>window.__cluance.state.revision===2);assert.equal((await restored.evaluate(()=>window.__cluance.state)).secret,privateView.secret);
  await showPanel(returned);await returned.locator('#new-turn-game').click(); // new Cluance game, while retaining the first
  await returned.locator('#game-setup-start').click();await returned.waitForFunction(()=>window.__friendSession.asyncGame?.record.revision===0);await returned.evaluate(()=>window.__friendSession.refreshInbox());await returned.waitForFunction(()=>document.querySelectorAll('#turn-games-list button').length===2);
  await returned.locator('#next-game').selectOption('flip-it');await game(returned,'flip-it');await returned.locator('#new-turn-game').click();await returned.locator('#game-setup-start').click();const flip=await game(returned,'flip-it');await flip.waitForFunction(()=>window.__flipit.mode==='async');
  const flipID=await returned.evaluate(()=>window.__friendSession.asyncGame.record.id);
  await showPanel(g);await g.evaluate(()=>window.__friendSession.refreshInbox());await g.locator('#turn-games-list button').filter({hasText:'Flip It'}).click();gf=await game(g,'flip-it');await gf.waitForFunction(()=>window.__flipit.mode==='async');
  const fv=await flip.evaluate(()=>window.__flipit.state);assert(fv.hands[1].every(c=>c.hidden));const asyncActor=fv.turn===0?returned:g;await hidePanel(asyncActor);await flipMove(asyncActor);await flip.waitForFunction(()=>window.__flipit.state.revision===1);
  await showPanel(returned);await returned.locator('#next-game').selectOption('spacegolf');await returned.waitForFunction(()=>window.__together.game==='spacegolf');await returned.reload();await returned.waitForFunction(()=>window.__together.game==='spacegolf');
  await returned.evaluate(()=>window.__friendSession.refreshInbox());await returned.locator('#turn-games-list button').filter({hasText:'Flip It'}).click();await(await game(returned,'flip-it')).waitForFunction(()=>window.__flipit.state.revision===1);assert.equal(await returned.evaluate(()=>window.__friendSession.asyncGame.record.id),flipID);
  await returned.setViewportSize({width:320,height:844});assert(await returned.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await hidePanel(returned);await returned.reload();await returned.locator('#friend-header').waitFor({state:'hidden'});await showPanel(returned);await returned.locator('#friend-header').waitFor({state:'visible'});
  assert.equal(await returned.locator('#chat-input').count(),1);assert.equal(await(await game(returned,'flip-it')).locator('#chat-input').count(),0);
  results.push('Offline Cluance and Flip It, private views, browser close/reopen, persistent unified chat, concurrent saved games, background play, 320px panel and visibility preference');await hc.close();await gc.close();
  // A real signaling service with a deterministic RTC substitute for native game protocols.
  const c=await browser.newContext({viewport:{width:1280,height:900}});await c.addInitScript(()=>Object.defineProperty(window,'localStorage',{get:()=>sessionStorage}));await c.addInitScript(installTestPeer);
  const host=await page(c),guest=await page(c),liveLink=await invite(host,'flip-it');await guest.goto(liveLink);
  for(const p of [host,guest])await p.waitForFunction(()=>window.__together?.connected&&!window.__together.loading);
  let hostFlip=await game(host,'flip-it');await hostFlip.waitForFunction(()=>window.__flipit.connected&&window.__flipit.state);const firstLive=await hostFlip.evaluate(()=>window.__flipit.state);const firstActor=firstLive.turn===0?host:guest;await hidePanel(firstActor);await flipMove(firstActor);await hostFlip.waitForFunction(()=>window.__flipit.state.revision===1);await(await game(guest,'flip-it')).waitForFunction(()=>window.__flipit.state.revision===1);if(!await guest.locator('#friend-header').isVisible())await showPanel(guest);
  await host.reload();await host.waitForFunction(()=>window.__together?.connected&&!window.__together.loading);hostFlip=await game(host,'flip-it');await hostFlip.waitForFunction(()=>window.__flipit.state?.revision===1);if(!await host.locator('#friend-header').isVisible())await showPanel(host);
  await switchGame(host,guest,'cluance');let giving=await game(host,'cluance'),guessing=await game(guest,'cluance');await giving.waitForFunction(()=>window.__cluance.state);await guessing.waitForFunction(()=>window.__cluance.state);assert.notEqual((await giving.evaluate(()=>window.__cluance.state)).role,(await guessing.evaluate(()=>window.__cluance.state)).role);
  const hostClue=await giving.evaluate(()=>window.__cluance.state),giverPage=hostClue.role==='giver'?host:guest,guesserPage=giverPage===host?guest:host;
  giving=await game(giverPage,'cluance');guessing=await game(guesserPage,'cluance');const clueBefore=await giving.evaluate(()=>window.__cluance.state);
  await hidePanel(giverPage);await giving.locator('#hand [data-card]').first().click();await giving.locator('#confirm-move').click();await guessing.waitForFunction(()=>window.__cluance.state.phase==='guess');await hidePanel(guesserPage);
  await guessing.locator('#board [data-card="'+clueBefore.board.find(id=>id!==clueBefore.secret)+'"]').click();await guessing.locator('#confirm-move').click();await giving.waitForFunction(()=>window.__cluance.state.revision===2);
  await giverPage.reload();await giverPage.waitForFunction(()=>window.__together.connected&&!window.__together.loading);giving=await game(giverPage,'cluance');await giving.waitForFunction(()=>window.__cluance.state?.revision===2);assert.equal((await giving.evaluate(()=>window.__cluance.state)).secret,clueBefore.secret);await showPanel(host);await showPanel(guest);
  await sendChat(host,'Still together across games');await guest.evaluate(()=>window.__friendSession.chat.refresh());await guest.locator('#chat-toggle').click();await guest.locator('#chat-log').getByText('Still together across games',{exact:true}).waitFor();
  await switchGame(host,guest,'midnight');await(await game(host,'midnight')).waitForFunction(()=>window.__midnight.state);await(await game(guest,'midnight')).waitForFunction(()=>window.__midnight.state);
  const midnightBefore=await(await game(host,'midnight')).evaluate(()=>window.__midnight.state);await host.reload();await host.waitForFunction(()=>window.__together.connected&&!window.__together.loading);const restoredMidnight=await game(host,'midnight');await restoredMidnight.waitForFunction(()=>window.__midnight.state);const midnightAfter=await restoredMidnight.evaluate(()=>window.__midnight.state);assert.deepEqual(midnightAfter.hands,midnightBefore.hands);assert.equal(midnightAfter.phase,midnightBefore.phase);await showPanel(host);
  await switchGame(host,guest,'collection');await host.locator('#screen-toggle').click();await host.locator('#screen-accept').click();await guest.locator('#screen-accept').click();await host.waitForFunction(()=>window.__together.screen==='sharing');await guest.waitForFunction(()=>window.__together.screen==='viewing');
  await host.locator('#next-game').selectOption('spacegolf');await host.waitForFunction(()=>window.__together.game==='spacegolf');let golf=await frame(host);await golf.waitForFunction(()=>window.spacegolf);await golf.evaluate(()=>{window.spacegolf.playCampaign(0,0);window.spacegolf.go(window.spacegolf.nextScene,true);window.spacegolf.nextScene=null;window.spacegolf.scene.fire(-1,.35);window.__gameCheckpoint.save();});
  await host.reload();await host.waitForFunction(()=>window.__together.connected&&window.__together.screen==='sharing').catch(async error=>{console.log(await Promise.all([host,guest].map(p=>p.evaluate(()=>({game:window.__together.game,connected:window.__together.connected,screen:window.__together.screen,sharedResume:window.__friendSession.sharedResume,err:document.querySelector('#friend-error').textContent,peer:window.__friendSession.peer?.pc.connectionState})) )));console.log(errors);throw error;});golf=await frame(host);await golf.waitForFunction(()=>window.spacegolf?.scene?.S?.shots===1);await guest.waitForFunction(()=>window.__friendSession.screen.remoteReady);
  results.push('Global direct signaling, native live games, live reload without redeal, game settings, unified chat, Midnight integration, consented shared cursors and golf state recovery');await c.close();
  assert.deepEqual(errors,[]);console.log(JSON.stringify({results,pageErrors:errors,nativeInternetRTCVerified:false},null,2));
}finally{await browser.close();}
