// Run npm run build and npm run dev first. Playwright is optional tooling.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {botAction} from '../flip-it/src/bot.js';
import {installTestPeer} from './test-peer.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:process.env.CHROMIUM_NO_SANDBOX==='1'?['--no-sandbox']:[]});
const origin=process.env.GAMES_URL||'http://127.0.0.1:8787';
const errors=[],results=[],artifacts=process.env.GAMES_ARTIFACTS;
if(artifacts)await mkdir(artifacts,{recursive:true});
async function context(mock=true,size={width:1280,height:720}){
  const c=await browser.newContext({viewport:size,permissions:['clipboard-read','clipboard-write']});
  await c.addInitScript(mock=>{
    // Simulate different browsers while using BroadcastChannel for the RTC substitute.
    if(mock)Object.defineProperty(window,'localStorage',{get:()=>sessionStorage});
    if(!localStorage.getItem('flip-it.preferences'))localStorage.setItem('flip-it.preferences',JSON.stringify({aiCount:3,aiKinds:['model','model','model'],team:true,stun:'',fx:false}));
  },mock);
  if(mock)await c.addInitScript(installTestPeer);
  else await c.addInitScript(()=>{const RTC=RTCPeerConnection;window.__testPeers=[];window.RTCPeerConnection=class extends RTC{constructor(...args){super(...args);window.__testPeers.push(this);}};});
  return c;
}
async function page(c,game){const p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/'+game+'/');return p;}
async function state(p,game){return p.evaluate(name=>window[name].state,game==='flip-it'?'__flipit':'__cluance');}
async function connected(p,game){try{await p.waitForFunction(name=>window[name]?.connected,game==='flip-it'?'__flipit':'__cluance');}catch(e){console.log(await p.evaluate(()=>({body:document.body.innerText,peers:window.__testPeers?.map(p=>({id:p.id,remote:p.remote,connection:p.connectionState,signaling:p.signalingState,channel:p.channel?.readyState}))})));throw e;}}
async function invite(p,game){
  if(game==='flip-it')await p.locator('[data-action=host]').first().click();
  else{await p.locator('#invite-friend').click();await p.locator('[data-action=create-invite]').click();}
  await p.waitForFunction(()=>document.querySelector('#pair-output')?.value);
  const link=await p.locator('#pair-output').inputValue();assert(link.includes('#room='));assert(link.length<240);assert.equal(await p.locator('#pair-input').count(),0);
  await p.locator('[data-action=copy]').click();assert.equal(await p.evaluate(()=>navigator.clipboard.readText()),link);return link;
}
async function screenshot(p,name){if(artifacts)await p.screenshot({path:resolve(artifacts,name)});}
async function join(c,link,game){const p=await page(c,game);await p.goto(link);await connected(p,game);return p;}
async function flipMove(p){
  const v=await state(p,'flip-it'),seat=await p.evaluate(()=>window.__flipit.seat),a=botAction(v,seat);
  if(a.kind==='next'){await p.locator('[data-action=next]').click();return;}
  if(!v.options.quickTurns)await p.locator('[data-action=lane][data-lane="'+a.lane+'"]').click();
  if(a.cards)for(const id of a.cards)await p.locator('[data-card="'+id+'"]').click();
  if(['add','take'].includes(a.kind)){
    const target=p.locator('[data-action='+a.kind+'][data-owner="'+a.targetSeat+'"][data-target="'+a.target+'"]');
    if(!await target.isVisible())await p.locator('[data-action=inspect-set][data-owner="'+a.targetSeat+'"][data-target="'+a.target+'"]').click();
    await target.click();
  }else await p.locator('[data-action='+a.kind+']').click();
}
try{
  console.log('Checking automatic Flip It sessions');
  const c=await context(),h=await page(c,'flip-it'),g=await join(c,await invite(h,'flip-it'),'flip-it');await connected(h,'flip-it');
  let v=await state(h,'flip-it');assert.equal(v.hands.length,2);assert(v.hands[1].every(card=>card.hidden));
  for(let i=0;i<6;i++){
    v=await state(h,'flip-it');const actor=v.turn===0?h:g;
    await flipMove(actor);await h.waitForFunction(r=>window.__flipit.state.revision>r,v.revision);await g.waitForFunction(r=>window.__flipit.state.revision>r,v.revision);
  }
  const before=await state(h,'flip-it');await h.reload();await h.waitForFunction(()=>window.__flipit.state);
  assert.equal((await state(h,'flip-it')).id,before.id);assert.equal((await state(h,'flip-it')).revision,before.revision);
  const fresh=await invite(h,'flip-it');await g.goto(fresh);await connected(g,'flip-it');await connected(h,'flip-it');
  assert.equal((await state(g,'flip-it')).id,before.id);assert.equal((await state(g,'flip-it')).revision,before.revision);
  results.push('Flip It defaults to two humans, synchronizes moves and reconnects the saved revision');await c.close();

  console.log('Checking Cluance roles, moves and role swaps');
  const cc=await context(),ch=await page(cc,'cluance'),cg=await join(cc,await invite(ch,'cluance'),'cluance');await connected(ch,'cluance');
  const hv=await state(ch,'cluance'),gv=await state(cg,'cluance');assert.equal(hv.id,gv.id);assert.notEqual(hv.role,gv.role);
  let giver=hv.role==='giver'?ch:cg,guesser=hv.role==='guesser'?ch:cg;
  const privateView=await state(giver,'cluance'),publicView=await state(guesser,'cluance');assert(privateView.secret);assert(!publicView.secret);assert(!publicView.hand);
  await giver.locator('#hand [data-card]').first().click();await giver.locator('#confirm-move').click();
  await guesser.waitForFunction(()=>window.__cluance.state.phase==='guess');
  const secret=privateView.secret,guess=await state(guesser,'cluance');
  const safe=guess.board.find(id=>id!==secret&&!guess.eliminated.includes(id));await guesser.locator('#board [data-card="'+safe+'"]').click();await guesser.locator('#confirm-move').click();
  await giver.waitForFunction(()=>window.__cluance.state.round===1);await guesser.waitForFunction(()=>window.__cluance.state.round===1);
  const oldId=(await state(ch,'cluance')).id;await ch.locator('#table-menu').click();await ch.locator('#menu-swap-roles').click();await ch.locator('#ask-role-swap').click();await cg.locator('#accept-role-swap').click();
  await ch.waitForFunction(id=>window.__cluance.state.id!==id,oldId);await cg.waitForFunction(id=>window.__cluance.state.id!==id,oldId);
  assert.notEqual((await state(ch,'cluance')).role,hv.role);assert.equal((await state(ch,'cluance')).id,(await state(cg,'cluance')).id);
  results.push('Cluance preserves inviter roles, keeps the secret private, synchronizes a round and swaps roles by agreement');await cc.close();

  console.log('Checking native signaling and phone dialogs');
  for(const game of ['flip-it','cluance'])for(const width of [1280,390,320]){
    const nc=await context(false,{width,height:width===1280?720:844}),p=await page(nc,game),link=await invite(p,game);
    const bounds=await p.locator('#modal-content').evaluate(el=>({w:el.clientWidth,sw:el.scrollWidth}));assert(bounds.sw<=bounds.w+1,JSON.stringify({game,width,...bounds}));
    await screenshot(p,game+'-invite-'+width+'.png');
    const ng=await page(nc,game);await ng.goto(link);await p.waitForFunction(()=>window.__testPeers.at(-1)?.remoteDescription?.type==='answer');
    assert.equal(await ng.locator('[data-action=copy]').count(),0);assert.equal(await ng.locator('#pair-output').count(),0);
    await nc.close();
  }
  results.push('Native offers and answers automatically exchanged for both games at 1280/390/320px');

  console.log('Checking Cluance manual pairing and recovery');
  const mc=await context(false),mp=await page(mc,'cluance');await invite(mp,'cluance');
  await mp.locator('.connection-settings > summary').click();await mp.locator('#turn-name').fill('session-user');await mp.locator('#turn-password').fill('session-password');
  await mp.locator('[data-action=manual-pair]').click();await mp.waitForFunction(()=>document.querySelector('#pair-output')?.value.includes('#invite='));
  assert.equal(await mp.locator('#turn-password').inputValue(),'session-password');assert(await mp.locator('.connection-settings').evaluate(el=>el.open));
  await mp.locator('.manual-reply > summary').click();await mp.locator('#pair-input').fill('invalid');await mp.locator('[data-action=accept-reply]').click();
  assert(await mp.locator('[role=alert]').count());assert.equal(await mp.locator('#pair-input').inputValue(),'invalid');assert.equal(await mp.locator('#turn-password').inputValue(),'session-password');
  assert(!JSON.stringify(await mp.evaluate(()=>({...localStorage}))).includes('session-password'));
  await mp.locator('[data-action=join-instead]').click();await mp.locator('#pair-input').fill('another invalid link');await mp.locator('[data-action=join-invite]').click();assert(await mp.locator('[role=alert]').count());
  results.push('Cluance retains typed input, relay fields and expanded sections; invalid links recover and roles can switch');await mc.close();
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,results,errors,gameplayTransport:'browser test substitute with real Cloudflare signaling',nativeConnectivityVerified:false}));
}finally{await browser.close();}
