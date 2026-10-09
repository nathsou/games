// Two-browser check of the parlor room games (Thrice, Yesteryear, Cover Story,
// Ripples). Run after npm run build:assets and npm run dev.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--enable-unsafe-swiftshader',...(process.env.CHROMIUM_NO_SANDBOX==='1'?['--no-sandbox']:[])]});
const origin=process.env.GAMES_URL||'http://127.0.0.1:8787',errors=[];
const globals={thrice:'__thrice',yesteryear:'__yesteryear','cover-story':'__coverStory',ripples:'__ripples'};
async function page(context){const p=await context.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));return p;}
async function frame(p){return(await p.locator('#game-frame').elementHandle()).contentFrame();}
async function roomGame(p,name){
  await p.waitForFunction(name=>window.__together?.game===name&&document.querySelector('#game-frame').contentWindow.location.pathname==='/'+name+'/',name);
  const f=await frame(p);await f.waitForFunction(name=>window[name]?.mode==='async',globals[name]);return f;
}
async function showPanel(p,tab){if(!await p.locator('#friend-header').isVisible())await p.locator('#show-friend-panel').click();if(tab)await p.locator('#tab-'+tab).click({noWaitAfter:true});}
const view=(f,name)=>f.evaluate(name=>window[name].view,globals[name]);
async function startGame(host,guest,name,fields={}){
  await showPanel(host,'play');await host.locator('.play-item[data-game="'+name+'"]').click();
  for(const [key,value] of Object.entries(fields))await host.locator('#game-setup-fields-'+key).selectOption(String(value));
  await host.locator('#game-setup-start').click();
  const hf=await roomGame(host,name);
  const card=guest.locator('.request-card.shown').filter({hasText:'Ana'});await card.waitFor();
  await card.getByRole('button',{name:'Play now'}).click();
  return [hf,await roomGame(guest,name)];
}
try{
  const host=await page(await browser.newContext()),guest=await page(await browser.newContext());
  await host.goto(origin+'/');await showPanel(host);await host.locator('#my-name').fill('Ana');await host.locator('#invite-friend').click();
  await host.waitForFunction(()=>/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(document.querySelector('#room-code').textContent));
  const code=await host.locator('#room-code').textContent();
  await guest.goto(origin+'/');await showPanel(guest);await guest.locator('#my-name').fill('Ben');await guest.locator('#join-input').fill(code);await guest.locator('#join-friend').click();await guest.locator('#view-room').waitFor();
  for(const p of [host,guest])if(await p.locator('#friend-header').isVisible())await p.locator('#hide-friend-panel').click();

  // Thrice: two people and a bot; reveals are pushed to the other browser.
  let [hf,gf]=await startGame(host,guest,'thrice',{bots:1});
  let v=await view(hf,'thrice');assert.equal(v.seats,3);assert(!('hands' in v));
  for(let i=0;i<8;i++){
    const f=(await view(hf,'thrice')).turn===0?hf:(await view(gf,'thrice')).turn===1?gf:null;
    if(!f){await host.waitForTimeout(1300);continue;}
    const before=(await view(f,'thrice')).revision;
    await f.locator('button[data-action=middle]:not([disabled])').first().click();
    await f.waitForFunction(r=>window.__thrice.view.revision>r,before);
  }
  const [a,b]=[await view(hf,'thrice'),await view(gf,'thrice')];assert.equal(a.revision,b.revision,'Both browsers show the same table');
  assert.notDeepEqual(a.hand,b.hand);console.log('Thrice: shared table, private hands, bot seat, revision',a.revision);

  // Yesteryear co-op streak: either person places from the shared hand.
  [hf,gf]=await startGame(host,guest,'yesteryear',{mode:'streak'});
  assert.deepEqual((await view(hf,'yesteryear')).hand,(await view(gf,'yesteryear')).hand);
  for(const f of [hf,gf]){const r=(await view(f,'yesteryear')).revision;await f.locator('button[data-action=pick]').first().click();await f.locator('button[data-action=slot]:not([disabled])').first().click();await f.waitForFunction(r=>window.__yesteryear.view.revision>r,r);}
  await gf.waitForFunction(()=>window.__yesteryear.view.revision>=2);console.log('Yesteryear: both placed cards in one streak');

  // Cover Story duo: each sees only their side of the key; a clue reaches the partner.
  [hf,gf]=await startGame(host,guest,'cover-story',{mode:'duo',lang:'fr'});
  v=await view(hf,'cover-story');const w=await view(gf,'cover-story');
  assert(v.myKey&&w.myKey&&!v.keys&&!w.keys);assert.notDeepEqual(v.myKey,w.myKey);
  const giver=v.giver===0?hf:gf,guesser=giver===hf?gf:hf;
  await giver.locator('#clue-word').fill('zzzzq');await giver.locator('#clue-word').dispatchEvent('input');await giver.locator('.clue-form button').click();
  await guesser.waitForFunction(()=>window.__coverStory.view.clue?.word==='zzzzq');
  const cell=guesser.locator('.word:not([aria-disabled=true])').first();await cell.click();await cell.click();
  await giver.waitForFunction(()=>window.__coverStory.view.guesses>0||window.__coverStory.view.phase==='clue'&&window.__coverStory.view.round>0||window.__coverStory.view.phase==='over');
  console.log('Cover Story: duo keys stay private, clue and guess are pushed');

  // Ripples race: both play the same grid; a rival sees only progress.
  [hf,gf]=await startGame(host,guest,'ripples',{puzzle:'gang-1',mode:'race'});
  assert.deepEqual((await view(hf,'ripples')).grid,(await view(gf,'ripples')).grid);
  await Promise.all([hf,gf].map(f=>f.locator('[data-action=hint]').click()));
  await hf.waitForFunction(()=>window.__ripples.view.board.hints===1&&window.__ripples.view.rivals[0].hints===1);
  await gf.waitForFunction(()=>window.__ripples.view.board.hints===1);
  assert(!('solution' in await view(gf,'ripples')));
  console.log('Ripples: simultaneous race moves both apply');
  assert.deepEqual(errors,[]);
  console.log('Parlor room audit passed.');
}finally{await browser.close();}
