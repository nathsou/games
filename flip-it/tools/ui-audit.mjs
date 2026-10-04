// Browser regression coverage for layout, native range capture and card drags.
// Start npm start first. Playwright is an optional developer/test dependency.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {legalActions} from '../src/rules.js';
import {botAction} from '../src/bot.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || undefined,args:process.env.CHROMIUM_NO_SANDBOX==='1'?['--no-sandbox']:[]});
const origin=process.env.FLIP_IT_URL || 'http://localhost:8080/flip-it/';
const errors=[],results=[];
const artifacts=process.env.FLIP_IT_ARTIFACTS;
if(artifacts)await mkdir(artifacts,{recursive:true});
async function screenshot(p,name){if(artifacts)await p.screenshot({path:resolve(artifacts,name),animations:'disabled'});}
function seedBrowser({seed,prefs}){
  if(!localStorage.getItem('flip-it.preferences'))localStorage.setItem('flip-it.preferences',JSON.stringify(prefs));
  const original=crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues=values=>{if(values instanceof Uint32Array&&values.length===1){values[0]=seed;return values;}return original(values);};
}
async function page(size,settings={},mobile=false){
  const c=await browser.newContext({viewport:size,colorScheme:'dark',hasTouch:mobile,isMobile:mobile});
  await c.addInitScript(seedBrowser,{seed:3,prefs:{name:'WWWWWWWWWWWWWWWWWWWWWWWW',fx:false,stun:'',aiCount:1,options:{quickTurns:false,compactDeck:false,lastChance:true,target:5},...settings}});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin);await p.evaluate(()=>document.fonts.ready);return p;
}
async function state(p){return p.evaluate(()=>window.__flipit.state);}
async function metrics(p){return p.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,over:[...document.querySelectorAll('#app .flip-card,#app .rival-count,#app .button')].map(n=>{const r=n.getBoundingClientRect();return {class:n.className,text:n.textContent.trim(),x:r.x,right:r.right};}).filter(r=>r.x<-.5||r.right>innerWidth+.5)}));}
async function modalCheck(p,label){
  const m=await p.locator('#modal').evaluate(n=>{const r=n.getBoundingClientRect(),c=n.firstElementChild;return {x:r.x,right:r.right,y:r.y,bottom:r.bottom,h:innerHeight,w:innerWidth,sw:c.scrollWidth,cw:c.clientWidth};});
  assert(m.x>=0&&m.right<=m.w&&m.y>=0&&m.bottom<=m.h,JSON.stringify({label,...m}));
  assert(m.sw<=m.cw+1,JSON.stringify({label,...m}));
  await p.locator('#modal-content').evaluate(n=>n.scrollTop=n.scrollHeight);
  const last=p.locator('#modal-content > .button').last();
  if(await last.count()){const r=await last.boundingBox();assert(r.y+r.height<=m.bottom-10,JSON.stringify({label,last:r,...m}));}
  await p.locator('[data-action=close-modal]').first().click();
}
async function visiblePoint(locator){
  return locator.evaluate(n=>{const r=n.getBoundingClientRect();for(let y=Math.max(0,r.y+4);y<Math.min(innerHeight,r.bottom);y+=4)for(let x=Math.max(0,r.x+4);x<Math.min(innerWidth,r.right);x+=4)if(document.elementFromPoint(x,y)?.closest('[data-card],.flip-card')===n)return {x,y};throw new Error('Card has no visible pointer target');});
}
async function layouts(){
  let tables=0,dialogs=0;
  for(const size of [{width:320,height:740},{width:390,height:844},{width:1024,height:768},{width:1280,height:720},{width:1440,height:900}]){
    const p=await page(size,{aiCount:4});
    for(const action of ['rules','table-settings','house-rules']){await p.locator('[data-action='+action+']').click();await modalCheck(p,action+'-'+size.width);dialogs++;}
    for(const quick of [false,true])for(const compact of [false,true])for(const count of [2,3,5]){
      await p.evaluate(({quick,compact,count})=>{const prefs=JSON.parse(localStorage.getItem('flip-it.preferences'));prefs.options.quickTurns=quick;prefs.options.compactDeck=compact;prefs.aiCount=count-1;localStorage.setItem('flip-it.preferences',JSON.stringify(prefs));},{quick,compact,count});
      await p.reload();await p.evaluate(()=>document.fonts.ready);await p.locator('[data-action=start-game]').click();
      const m=await metrics(p),detail=JSON.stringify({count,quick,compact,...m});
      assert(m.sw<=size.width,detail);assert(!m.over.length,detail);if(size.width>760)assert(m.sh<=size.height,detail);tables++;
      await p.locator('[data-action=game-log]').click();await modalCheck(p,'replay-'+size.width+'-'+count+'-'+quick+'-'+compact);dialogs++;
    }
    await p.context().close();
  }
  results.push({tables,dialogs});
}
async function interactions(){
const p=await page({width:1280,height:720},{name:'Alex',fx:true});
await p.evaluate(()=>document.fonts.ready);await p.locator('[data-action=start-game]').click();
let v=await state(p);const play=legalActions(v,0).filter(a=>a.kind==='play').sort((a,b)=>b.cards.length-a.cards.length)[0];for(const id of play.cards)await p.locator('[data-card="'+id+'"]').click();
assert(play.cards.length>1);const from=await visiblePoint(p.locator('[data-card="'+play.cards.at(-1)+'"]'));await p.mouse.move(from.x,from.y);await p.mouse.down();await p.mouse.move(from.x+14,from.y-18);
assert.equal(await p.locator('.drag-ghost .flip-card').count(),play.cards.length);assert((await p.locator('.drag-count').textContent()).includes(play.cards.length+' cards'));assert.equal(await p.evaluate(()=>window.getSelection().toString()),'');
const invalid=await p.locator('[data-space-seat="0"][data-space-lane="0"]').boundingBox();await p.mouse.move(invalid.x+invalid.width/2,invalid.y+invalid.height/2);assert.equal(await p.locator('.drop-valid').count(),0);
const target=await p.locator('[data-space-seat="0"][data-space-lane="1"]').boundingBox();await p.mouse.move(target.x+target.width/2,target.y+target.height/2);assert.equal(await p.locator('.drop-valid').count(),1);await screenshot(p,'39-multi-card-drag.png');await p.mouse.up();assert.equal((await state(p)).revision,v.revision+1);assert.equal(await p.locator('.flying-card').count(),play.cards.length);await p.waitForFunction(()=>!document.querySelector('.flying-card'));
await p.waitForFunction(()=>!document.querySelector('[data-action=flip]').disabled,{},{timeout:10000});
v=await state(p);const take=legalActions(v,0).filter(a=>a.kind==='take').find(a=>v.table[1][a.target].length>1);assert(take,'bot exposes a multiple-card set');
// Public faces must not cover each other's reverse number. The enlarged
// view reports the exact public composition, including duplicates.
const group=p.locator('.exposed-cards[data-owner="1"][data-target="'+take.target+'"]');
const publicCards=v.table[1][take.target];
const bounds=await group.locator('.flip-card').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
for(let i=1;i<bounds.length;i++)assert(bounds[i].x>=bounds[i-1].right,'public cards overlap');
await screenshot(p,'45-exposed-cards.png');
await group.focus();await p.keyboard.press('Space');
assert.deepEqual(await p.locator('.set-detail-card').evaluateAll(nodes=>nodes.map(n=>[Number(n.querySelector('.card-rank:not(.other)').textContent),Number(n.querySelector('.card-rank.other').textContent)])),publicCards.map(c=>[c.ends[c.face],c.ends[1-c.face]]));
assert.equal(await p.locator('.set-detail-card').count(),publicCards.length);
await screenshot(p,'46-exposed-set-details.png');
await p.setViewportSize({width:320,height:740});
assert(await p.locator('#modal-content').evaluate(n=>n.scrollWidth<=n.clientWidth));
assert((await metrics(p)).sw<=320);
await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#modal').open&&!document.querySelector('#modal').dataset.kind);
await p.setViewportSize({width:1280,height:720});
const source=p.locator('[data-space-seat="1"][data-space-lane="'+take.target+'"] .flip-card').last(),r=await source.boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.mouse.move(r.x+r.width/2+14,r.y+r.height/2+16);const count=v.table[1][take.target].length;assert.equal(await p.locator('.drag-ghost .flip-card').count(),count);
const hand=await p.locator('.hand').boundingBox();await p.mouse.move(hand.x+hand.width/2,hand.y+hand.height/2);assert.equal(await p.locator('.drop-valid').count(),1);await p.mouse.up();assert.equal((await state(p)).log.at(-1).kind,'take');assert((await p.locator('.flying-card').count())>=count);await p.waitForFunction(()=>!document.querySelector('.flying-card'));
await p.locator('[data-action=game-log]').click();
// Interrupt a flight by scrubbing, then close during another flight. No cards
// from an old frame may remain over the current frame or the live table.
await p.locator('#replay-scrubber').fill('0');
await p.locator('[data-action=replay-step][data-step="1"]').click();
assert(await p.locator('#modal .flying-card').count());
await p.locator('#replay-scrubber').fill('0');
assert.equal(await p.locator('#modal .flying-card,#modal .move-pop').count(),0);
await p.locator('[data-action=replay-step][data-step="1"]').click();
assert(await p.locator('#modal .flying-card').count());
await p.locator('[data-action=close-modal]').click();
assert.equal(await p.locator('#modal .flying-card,#modal .move-pop').count(),0);
await p.waitForFunction(()=>!document.querySelector('#modal').classList.contains('replay-dialog'));
await p.locator('[data-action=game-log]').click();const range=p.locator('#replay-scrubber');await range.evaluate(n=>{window.auditRange=n;window.getSelection().removeAllRanges();});const b=await range.boundingBox();await p.mouse.move(b.x+b.width-8,b.y+b.height/2);await p.mouse.down();for(let i=0;i<=10;i++){await p.mouse.move(b.x+b.width-8-(b.width-16)*i/10,b.y+b.height/2);assert(await p.evaluate(()=>document.querySelector('#replay-scrubber')===window.auditRange));}await p.mouse.up();assert.equal(await range.inputValue(),'0');assert.equal(await p.evaluate(()=>window.getSelection().toString()),'');await range.focus();await p.keyboard.press('ArrowRight');assert.equal(await range.inputValue(),'1');assert(await p.evaluate(()=>document.activeElement===window.auditRange));await p.keyboard.press('End');assert.equal(await range.inputValue(),await range.getAttribute('max'));await screenshot(p,'40-replay-controls.png');
await p.locator('[data-action=close-modal]').click();await p.locator('[data-action=rules]').click();await p.locator('#modal-content').evaluate(n=>n.scrollTop=n.scrollHeight);await screenshot(p,'41-rules-scroll.png');

await p.context().close();results.push('multi-card mouse Play/Take, invalid drops, per-card flights, continuous mouse/keyboard replay scrubbing');
}
async function populatedTable(){
  const p=await page({width:1280,height:720},{name:'Alex',aiCount:4});
  await p.evaluate(()=>{const timer=setTimeout;window.setTimeout=(fn,ms,...args)=>timer(fn,ms===1200?20:ms,...args);});
  await p.locator('[data-action=start-game]').click();
  for(let i=0;i<12;i++){
    await p.waitForFunction(()=>window.__flipit.state.phase!=='playing'||!document.querySelector('[data-action=flip]').disabled);
    const v=await state(p);if(v.phase!=='playing')break;
    const m=await metrics(p);assert(m.sh<=720&&m.sw<=1280,JSON.stringify({moves:v.moves,...m}));
    const move=botAction(v,0);
    for(const id of move.cards||[]){await p.locator('[data-card="'+id+'"]').focus();await p.keyboard.press('Space');}
    const selector=['take','add'].includes(move.kind)?'[data-action='+move.kind+'][data-owner="'+move.targetSeat+'"][data-target="'+move.target+'"]':'[data-action='+move.kind+']';
    const control=p.locator(selector);
    if(['take','add'].includes(move.kind)&&!await control.isVisible())await control.locator('xpath=ancestor::article').locator('.set-inspect').click();
    await control.click();
  }
  await screenshot(p,'47-populated-five-player-table.png');await p.context().close();
  results.push('populated five-player double-turn table through 12 player turns');
}
async function touch(){
 const p=await page({width:390,height:844},{name:'Alex',fx:true,options:{quickTurns:true,compactDeck:false,lastChance:true,target:5}},true);await p.evaluate(()=>document.fonts.ready);await p.locator('[data-action=start-game]').click();let v=await state(p);const play=legalActions(v,0).find(a=>a.kind==='play'&&a.cards.length===3);assert(play);
 for(const id of play.cards){await p.locator('[data-card="'+id+'"]').focus();await p.keyboard.press('Space');}const source=p.locator('[data-card="'+play.cards.at(-1)+'"]');await source.scrollIntoViewIfNeeded();const point=await source.evaluate(n=>{const r=n.getBoundingClientRect();for(let y=r.y+4;y<Math.min(innerHeight,r.bottom);y+=4)for(let x=r.x+4;x<r.right;x+=4)if(document.elementFromPoint(x,y)?.closest('[data-card]')===n)return {x,y};throw new Error('No visible touch target');});
 const cdp=await p.context().newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+15,y:point.y-15}]});assert.equal(await p.locator('.drag-ghost .flip-card').count(),3);
 const oldScroll=await p.evaluate(()=>scrollY);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:200,y:12}]});await p.waitForFunction(old=>scrollY<old,oldScroll);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await p.locator('.drag-ghost,.drop-valid').count(),0);assert.equal((await state(p)).revision,v.revision);
 await source.scrollIntoViewIfNeeded();const start=await source.evaluate(n=>{const r=n.getBoundingClientRect();for(let y=r.y+4;y<Math.min(innerHeight,r.bottom);y+=4)for(let x=r.x+4;x<r.right;x+=4)if(document.elementFromPoint(x,y)?.closest('[data-card]')===n)return {x,y};throw new Error('No visible touch target');});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+15,y:start.y-15}]});const dest=p.locator('[data-space-seat="0"]');await dest.scrollIntoViewIfNeeded();const to=await dest.boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:to.x+to.width/2,y:to.y+to.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal((await state(p)).log.at(-1).kind,'play');assert.equal((await state(p)).log.at(-1).count,3);await p.waitForFunction(()=>!document.querySelector('.flying-card'));
 await p.locator('[data-action=game-log]').click();await p.locator('#modal-content').evaluate(n=>n.scrollTop=0);const range=p.locator('#replay-scrubber');await range.evaluate(n=>window.auditRange=n);const r=await range.boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width-8,y:r.y+r.height/2}]});for(let i=0;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+r.width-8-(r.width-16)*i/10,y:r.y+r.height/2}]});assert(await p.evaluate(()=>window.auditRange===document.querySelector('#replay-scrubber')));}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await range.inputValue(),'0');assert.equal(await p.evaluate(()=>window.getSelection().toString()),'');assert((await metrics(p)).sw<=390);await screenshot(p,'43-phone-replay.png');
 await p.context().close();
results.push('three-card touch Play, edge scrolling, cancellation, native touch replay scrubbing');
}
try{
  await layouts();await interactions();await populatedTable();await touch();
  assert.equal(errors.length,0,JSON.stringify(errors));console.log(JSON.stringify({results,errors}));
}finally{await browser.close();}
