// Run with the built site served by Wrangler (no external friend connection needed).
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:process.env.CHROMIUM_NO_SANDBOX==='1'?['--no-sandbox']:[]});
const origin=process.env.GAMES_URL||'http://127.0.0.1:8787',errors=[],results=[];
async function page(context){const p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));return p;}
async function box(p,id){return p.locator(id).boundingBox();}
async function drag(p,selector,dx,dy,corner=false){
  const r=await box(p,selector),x=r.x+(corner?r.width/2:Math.min(110,r.width/2)),y=r.y+r.height/2;
  await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+dx,y+dy,{steps:12});await p.mouse.up();
}
async function inside(p,selector){
  // Viewport resize events are delivered on the browser's next rendering step.
  await p.waitForFunction(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return r.x>=7&&r.y>=7&&r.right<=innerWidth-7&&r.bottom<=innerHeight-7;},selector);
  const r=await box(p,selector),v=p.viewportSize();assert(r.x>=7&&r.y>=7&&r.x+r.width<=v.width-7&&r.y+r.height<=v.height-7,JSON.stringify({selector,r,v}));
}
try {
  const c=await browser.newContext({viewport:{width:1280,height:900}}),p=await page(c);
  await p.goto(origin+'/');await p.waitForFunction(()=>Boolean(window.__friendSession));
  assert(!await p.locator('#friend-header').isVisible());assert(!await p.locator('#friend-chat').isVisible());
  const f=await(await p.locator('#game-frame').elementHandle()).contentFrame();
  assert.equal(await f.getByText('Start a room with a friend →',{exact:true}).count(),0);
  const launcher=await box(p,'#show-friend-panel');await drag(p,'#show-friend-panel',-260,-120);
  assert(!await p.locator('#friend-header').isVisible(),'Dragging a launcher must not open its window');
  assert.equal((await box(p,'#show-friend-panel')).x,launcher.x-260);
  await p.locator('#show-friend-panel').click();let r=await box(p,'#friend-header');
  await drag(p,'#friends-titlebar',-550,-220);let moved=await box(p,'#friend-header');
  assert.equal(moved.x,r.x-550);assert.equal(moved.y,r.y-220);
  await drag(p,'#friend-header .window-resize-xy',90,80,true);let resized=await box(p,'#friend-header');
  assert.equal(resized.width,moved.width+90);assert.equal(resized.height,moved.height+80);
  assert(!await p.locator('.window-drag-shield').isVisible());
  await p.locator('#friends-titlebar').focus();await p.keyboard.press('ArrowRight');await p.keyboard.press('Shift+ArrowDown');
  assert.equal((await box(p,'#friend-header')).x,resized.x+16);assert.equal((await box(p,'#friend-header')).height,resized.height+16);
  await p.locator('#friend-header .window-resize-xy').focus();await p.keyboard.press('ArrowRight');
  assert.equal((await box(p,'#friend-header')).width,resized.width+16);
  // Escape cancels a drag, then closes only the focused window on the next press.
  r=await box(p,'#friends-titlebar');const beforeCancel=await box(p,'#friend-header');
  await p.mouse.move(r.x+100,r.y+20);await p.mouse.down();await p.mouse.move(r.x+180,r.y+80);
  await p.keyboard.press('Escape');await p.mouse.up();assert.deepEqual(await box(p,'#friend-header'),beforeCancel);
  await p.locator('#friends-titlebar').focus();await p.keyboard.press('Escape');assert(!await p.locator('#friend-header').isVisible());assert(await p.locator('#show-friend-panel').evaluate(el=>el===document.activeElement));
  await p.locator('#show-friend-panel').click();await p.reload();await p.waitForFunction(()=>Boolean(window.__friendSession));
  assert.deepEqual(await box(p,'#friend-header'),beforeCancel);assert.equal((await box(p,'#show-friend-panel')).x,launcher.x-260);
  // Independent chat, z order, close focus, and launcher icons surviving unread updates.
  await p.locator('#hide-friend-panel').click();await p.locator('#chat-toggle').click();assert(!await p.locator('#friend-header').isVisible());
  await drag(p,'#chat-titlebar',-250,-170);const chatRect=await box(p,'#friend-chat');
  await p.locator('#chat-close').click();assert(await p.locator('#chat-toggle').evaluate(el=>el===document.activeElement));
  await p.evaluate(()=>{const s=window.__friendSession;s.chat.append({sequence:1,seat:s.isHost?1:0,kind:'text',value:'A message while closed'});});
  assert.equal(await p.locator('#chat-toggle .launcher-badge').textContent(),'1');assert(await p.locator('#chat-toggle .launcher-badge').isVisible());assert.equal(await p.locator('#chat-toggle svg').count(),1);
  await p.locator('#chat-toggle').click();assert(!await p.locator('#chat-toggle .launcher-badge').isVisible());assert.deepEqual(await box(p,'#friend-chat'),chatRect);
  await p.locator('#show-friend-panel').click();await p.locator('#friends-titlebar').focus();
  assert(await p.evaluate(()=>+document.querySelector('#friend-header').style.zIndex>+document.querySelector('#friend-chat').style.zIndex));
  await p.locator('#chat-titlebar').focus();assert(await p.evaluate(()=>+document.querySelector('#friend-chat').style.zIndex>+document.querySelector('#friend-header').style.zIndex));
  // Focus the desired window before controls when two custom positions overlap.
  await p.locator('#friends-titlebar').focus();const gameRect=await box(p,'#friend-header');
  await p.locator('#next-game').selectOption('cluance');await p.waitForFunction(()=>window.__together.game==='cluance');
  assert.deepEqual(await box(p,'#friend-header'),gameRect);assert.deepEqual(await box(p,'#friend-chat'),chatRect);
  await p.locator('#hide-friend-panel').click();await p.evaluate(()=>window.__friendSession.openChat());assert(!await p.locator('#friend-header').isVisible());
  await p.locator('#chat-close').click();await p.setViewportSize({width:320,height:844});
  await inside(p,'#show-friend-panel');await inside(p,'#chat-toggle');await p.locator('#show-friend-panel').click();await inside(p,'#friend-header');
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.locator('#hide-friend-panel').click();await p.locator('#chat-toggle').click();await inside(p,'#friend-chat');
  await p.setViewportSize({width:568,height:320});await inside(p,'#friend-chat');
  const composer=await box(p,'#chat-form');assert(composer.y+composer.height<=312);
  await p.locator('#chat-close').click();await p.setViewportSize({width:1280,height:900});await p.locator('#chat-toggle').click();assert.deepEqual(await box(p,'#friend-chat'),chatRect,'Temporary viewport changes must preserve the preferred desktop placement');
  await p.locator('#chat-titlebar').focus();await p.keyboard.press('Home');assert.equal((await box(p,'#friend-chat')).width,352);
  await p.locator('#chat-close').click();await p.reload();assert(!await p.locator('#friend-chat').isVisible());
  await p.evaluate(()=>{localStorage.setItem('games-arcade:appearance','dark');window.dispatchEvent(new Event('games-theme-change'));});
  assert.equal(await p.locator('html').getAttribute('data-color-theme'),'dark');
  results.push('Mouse and keyboard move/resize, iframe crossing, drag cancellation, close/focus, persistent geometry, independent chat, unread badges, stacking, game switches, phone/landscape clamping, reset and theme');await c.close();
  const shrink=await browser.newContext({viewport:{width:1280,height:900}}),s=await page(shrink);
  await s.goto(origin+'/');await s.setViewportSize({width:320,height:844});
  await s.locator('#show-friend-panel').click();await s.locator('#hide-friend-panel').click();await s.locator('#chat-toggle').click();await s.locator('#chat-close').click();
  await s.locator('#show-friend-panel').click();const anchored=await box(s,'#friend-header');await drag(s,'#friend-header .window-resize-xy',500,500,true);
  const edge=await box(s,'#friend-header');assert.equal(edge.x,anchored.x);assert.equal(edge.y,anchored.y);await inside(s,'#friend-header');await shrink.close();
  // A genuine touch gesture, optional/invalid storage, and modal focus ownership.
  const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),t=await page(touch);
  await t.goto(origin+'/');const client=await touch.newCDPSession(t),tr=await box(t,'#show-friend-panel');
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tr.x+30,y:tr.y+30}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tr.x-70,y:tr.y-70}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert(!await t.locator('#friend-header').isVisible());assert.equal((await box(t,'#show-friend-panel')).x,tr.x-100);
  await t.locator('#show-friend-panel').tap();await inside(t,'#friend-header');
  await t.locator('#invite-friend').tap();assert(await t.locator('#room-dialog').isVisible());await t.keyboard.press('Escape');assert(!await t.locator('#room-dialog').isVisible());assert(await t.locator('#friend-header').isVisible());
  await t.evaluate(()=>localStorage.setItem('games.social-windows.v1','{"Friends":{"rect":{"x":null,"y":1,"width":-5,"height":4}},"Chat":{"rect":{"x":0,"y":0,"width":"bad","height":3}}}'));await t.reload();await t.locator('#show-friend-panel').tap();await inside(t,'#friend-header');await touch.close();
  const noStorage=await browser.newContext();await noStorage.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage unavailable');}}));const n=await page(noStorage);await n.goto(origin+'/');await n.locator('#show-friend-panel').click();await n.locator('#hide-friend-panel').click();await noStorage.close();
  results.push('Real touch drag/tap, modal Escape isolation, malformed preferences and unavailable storage');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({results,pageErrors:errors},null,2));
} finally {await browser.close();}
