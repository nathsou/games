// Run npm run build:assets and npm run dev before this browser integration suite.
import assert from 'node:assert/strict';
import {installTestPeer} from './test-peer.mjs';
import {botAction} from '../flip-it/src/bot.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--enable-unsafe-swiftshader',...(process.env.CHROMIUM_NO_SANDBOX==='1'?['--no-sandbox']:[])]});
const origin=process.env.GAMES_URL||'http://127.0.0.1:8787',errors=[],results=[];
async function page(context){const p=await context.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));return p;}
async function frame(p){return(await p.locator('#game-frame').elementHandle()).contentFrame();}
const globals={cluance:'__cluance',midnight:'__midnight','flip-it':'__flipit'};
async function game(p,name){await p.waitForFunction(name=>window.__together?.game===name&&document.querySelector('#game-frame').contentWindow.location.pathname==='/'+name+'/',name);const f=await frame(p);await f.waitForFunction(name=>Boolean(window[name]),globals[name]);return f;}
async function roomGame(p,name){const f=await game(p,name);await f.waitForFunction(name=>window[name]?.mode==='async',globals[name]);return f;}
async function showPanel(p,tab){if(!await p.locator('#friend-header').isVisible())await p.locator('#show-friend-panel').click();if(tab)await p.locator('#tab-'+tab).click({noWaitAfter:true});}
async function hidePanel(p){if(await p.locator('#friend-header').isVisible())await p.locator('#hide-friend-panel').click();}
async function createRoom(p,name){
  await p.goto(origin+'/');await showPanel(p);await p.locator('#my-name').fill(name);await p.locator('#invite-friend').click();
  await p.waitForFunction(()=>/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(document.querySelector('#room-code').textContent));
  const link=await p.evaluate(()=>window.__friendSession.credential.inviteLink);assert.equal(new URL(link).pathname,'/');
  return p.locator('#room-code').textContent();
}
async function joinByCode(p,name,code){
  await p.goto(origin+'/');await showPanel(p);await p.locator('#my-name').fill(name);
  await p.locator('#join-input').fill('bad');await p.locator('#join-friend').click();await p.locator('#start-status').filter({hasText:'eight-character'}).waitFor();
  await p.locator('#join-input').fill(code.toLowerCase().replace('-',' '));await p.locator('#join-friend').click();
  await p.locator('#view-room').waitFor();
}
async function startGame(p,name,configure=async()=>{}){
  await showPanel(p,'play');await p.locator('.play-item[data-game="'+name+'"]').click();await configure();await p.locator('#game-setup-start').click();
  return roomGame(p,name);
}
async function request(p,text){const card=p.locator('.request-card.shown').filter({hasText:text});await card.waitFor();return card;}
async function sendChat(p,text){await showPanel(p,'chat');await p.locator('#chat-input').fill(text);await p.locator('#chat-send').click();await p.locator('#chat-log').getByText(text,{exact:true}).waitFor();}
async function flipMove(f){
  const v=await f.evaluate(()=>window.__flipit.state),seat=await f.evaluate(()=>window.__flipit.seat),move=botAction(v,seat);
  if(move.kind==='next'){await f.locator('[data-action=next]').click();return;}
  if(!v.options.quickTurns)await f.locator('[data-action=lane][data-lane="'+move.lane+'"]').click();
  for(const id of move.cards||[])await f.locator('[data-card="'+id+'"]').click();
  if(['add','take'].includes(move.kind)) {const target=f.locator('[data-action='+move.kind+'][data-owner="'+move.targetSeat+'"][data-target="'+move.target+'"]');if(!await target.isVisible())await f.locator('button.set-inspect[data-owner="'+move.targetSeat+'"][data-target="'+move.target+'"]').click();await target.click();}
  else await f.locator('[data-action='+move.kind+']').click();
}
async function hide(p,hidden){await p.evaluate(hidden=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});document.dispatchEvent(new Event('visibilitychange'));},hidden);}
try{
  // Two independent browsers on the real Worker: nothing here uses a direct connection.
  const hc=await browser.newContext({viewport:{width:1280,height:900}}),gc=await browser.newContext({viewport:{width:1280,height:900}}),h=await page(hc),g=await page(gc);
  const code=await createRoom(h,'Ada');await joinByCode(g,'Grace',code);
  await h.waitForFunction(()=>window.__together.friend.name==='Grace'&&window.__together.friend.online);
  await h.locator('.toast').filter({hasText:'Grace joined your room'}).waitFor();
  assert.equal(await g.locator('#friend-name').textContent(),'Ada');
  assert.equal(await h.locator('#show-friend-panel .launcher-label').textContent(),'Grace');
  // A game request is a persistent card on the friend's screen, with the creator's name.
  let hf=await startGame(h,'cluance',async()=>{await h.locator('#game-setup-fields-role').selectOption('giver');await h.locator('#game-setup-fields-variant').selectOption('fixed');});
  const card=await request(g,'Ada wants to play Cluance');await g.waitForTimeout(3000);assert(await card.isVisible(),'Requests stay until answered');
  await card.getByRole('button',{name:'Play now'}).click();let gf=await roomGame(g,'cluance');
  const privateView=await hf.evaluate(()=>window.__cluance.state),publicView=await gf.evaluate(()=>window.__cluance.state);
  assert(privateView.secret&&privateView.hand.length===5);assert(!publicView.secret&&!publicView.hand);assert.equal(privateView.variant,'fixed');
  await g.waitForFunction(()=>window.__together.friend.game===window.__together.roomGame);
  // Chat arrives as a toast and an unread badge while the chat is closed, and stays read after reload.
  await hidePanel(g);await sendChat(h,'A persistent conversation');
  await g.locator('.toast').filter({hasText:'A persistent conversation'}).waitFor();
  await g.waitForFunction(()=>document.querySelector('#show-friend-panel .launcher-badge').textContent!=='');
  await showPanel(g,'chat');await g.locator('#chat-log').getByText('A persistent conversation',{exact:true}).waitFor();
  await hidePanel(g);await g.reload();gf=await roomGame(g,'cluance');
  assert(!await g.locator('#tab-chat .tab-badge').isVisible(),'Read messages must remain read after reload');
  // A slow send must not erase a reply being composed or persist the sent text as a draft.
  let releasePost;const held=new Promise(resolve=>releasePost=resolve);
  const started=h.waitForRequest(request=>request.method()==='POST'&&new URL(request.url()).pathname.endsWith('/chat'));
  const delayed=async route=>{if(route.request().method()==='POST'){await held;await new Promise(resolve=>setTimeout(resolve,600));}await route.continue();};
  await h.route('**/api/rooms/friends/*/chat',delayed);
  await h.locator('#chat-input').fill('A slow message');await h.locator('#chat-send').click();await started;
  assert(await h.locator('#chat-send').isDisabled());await h.locator('#chat-input').fill('My next reply');releasePost();
  await h.locator('#chat-log').getByText('A slow message',{exact:true}).waitFor();await h.waitForFunction(()=>!document.querySelector('#chat-send').disabled);
  assert.equal(await h.locator('#chat-input').inputValue(),'My next reply');
  await h.unroute('**/api/rooms/friends/*/chat',delayed);
  await h.locator('#chat-input').fill('');await h.locator('#chat-input').fill('A final draft');
  assert.equal(await h.evaluate(()=>JSON.parse(localStorage.getItem('games.friend-room.v1')).draft),'A final draft');
  // Moves are pushed: the guesser's table updates without any refresh, and a hidden tab flashes its title.
  await hidePanel(h);await hide(g,true);
  await hf.locator('#hand [data-card]').first().click();await hf.locator('#confirm-move').click();
  await gf.waitForFunction(()=>window.__cluance.state.phase==='guess');
  await g.waitForFunction(()=>document.title.startsWith('●'));await hide(g,false);await g.waitForFunction(()=>!document.title.startsWith('●'));
  // Close the giver's tab entirely; the guesser can still play, and sees the friend offline.
  await h.close();await g.waitForFunction(()=>!window.__together.friend.online);
  const safe=publicView.board.find(id=>id!==privateView.secret);await hidePanel(g);
  await gf.locator('#board [data-card="'+safe+'"]').click();await gf.locator('#confirm-move').click();await gf.waitForFunction(()=>window.__cluance.state.revision===2);
  const returned=await page(hc);await returned.goto(origin+'/together/?game=cluance');
  const restored=await roomGame(returned,'cluance');await restored.waitForFunction(()=>window.__cluance.state.revision===2);
  assert.equal((await restored.evaluate(()=>window.__cluance.state)).secret,privateView.secret);
  // A second game with a rules bot; the guest postpones the request and finds it under Games.
  const flip=await startGame(returned,'flip-it',async()=>{await returned.locator('#game-setup-fields-count').selectOption('1');});
  await (await request(g,'Ada wants to play Flip It')).getByRole('button',{name:'Later'}).click();
  await showPanel(g,'games');await g.locator('.game-row').filter({hasText:'Flip It'}).locator('.game-open').click();
  gf=await roomGame(g,'flip-it');
  const fv=await flip.evaluate(()=>window.__flipit.state);assert.equal(fv.hands.length,3);assert(fv.hands[1].every(c=>c.hidden)&&fv.hands[2].every(c=>c.hidden));
  assert.match(await gf.locator('.scoreboard').textContent(),/Ada.*Grace.*Bot 1/s);
  for(let moves=0;moves<6;moves++){
    const state=await flip.evaluate(()=>window.__flipit.state);if(state.phase!=='playing')break;
    if(state.turn===2){await flip.waitForFunction(revision=>window.__flipit.state.revision>revision,state.revision);continue;}
    const actor=state.turn===0?returned:g,f=state.turn===0?flip:gf;await hidePanel(actor);await flipMove(f);
    await flip.waitForFunction(revision=>window.__flipit.state.revision>revision,state.revision);
  }
  assert((await flip.evaluate(()=>window.__flipit.state.log)).some(event=>event.seat===2),'The room bot must have played');
  const flipID=await returned.evaluate(()=>window.__together.roomGame);
  // Browsing elsewhere keeps the friend's notifications coming.
  await showPanel(g,'play');await g.locator('#collection-link').click();await g.waitForFunction(()=>window.__together.game==='collection');
  // Ada and the bot play until it is Grace's turn again.
  let handedOver=false;
  for(let state=await flip.evaluate(()=>window.__flipit.state);state.phase==='playing'&&state.turn!==1;state=await flip.evaluate(()=>window.__flipit.state)){
    if(state.turn===0){await hidePanel(returned);await flipMove(flip);}
    await flip.waitForFunction(revision=>window.__flipit.state.revision>revision,state.revision);handedOver=true;
  }
  if(handedOver&&(await flip.evaluate(()=>window.__flipit.state)).phase==='playing')await g.locator('.toast').filter({hasText:'Your turn in Flip It'}).waitFor();
  await returned.goto(origin+'/together/?game=spacegolf');await returned.waitForFunction(()=>window.__together.game==='spacegolf');
  await showPanel(returned,'games');await returned.locator('.game-row').filter({hasText:'Flip It'}).locator('.game-open').click();
  await roomGame(returned,'flip-it');assert.equal(await returned.evaluate(()=>window.__together.roomGame),flipID);
  assert.equal(await returned.locator('#chat-input').count(),1);assert.equal(await(await frame(returned)).locator('#chat-input').count(),0);
  // Phone layout: no horizontal scrolling with the panel and a request on screen.
  await returned.setViewportSize({width:320,height:844});await showPanel(returned,'play');
  assert(await returned.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await returned.locator('.play-item[data-game=midnight]').click();await returned.locator('#game-setup-start').click();await roomGame(returned,'midnight');
  await g.setViewportSize({width:320,height:844});const midnightCard=await request(g,'Ada wants to play Midnight Table');
  const cardBox=await midnightCard.boundingBox();assert(cardBox.x>=0&&cardBox.x+cardBox.width<=320);
  await midnightCard.getByRole('button',{name:'Play now'}).click();const gm=await roomGame(g,'midnight');
  await gm.waitForFunction(()=>window.__midnight.state.type==='backhand');
  // Leaving a room removes it from this browser only.
  await showPanel(g);await g.locator('#open-settings').click();await g.locator('#leave-room').click();await g.locator('#confirm-accept').click();
  await g.locator('#view-start').waitFor();assert.equal(await g.evaluate(()=>localStorage.getItem('games.friend-room.v1')),null);
  await returned.waitForFunction(()=>!window.__together.friend.online);
  results.push('Room-code join with names and presence, persistent request cards, private views, pushed moves without refresh, hidden-tab title alerts, closed-tab play, chat toasts/badges/drafts, bots, postponed requests, notifications while browsing, phone layout and leaving');
  await hc.close();await gc.close();

  // Shared cursors: the invitation travels through the room, the game state over a deterministic RTC substitute.
  const c=await browser.newContext({viewport:{width:1280,height:900}});
  await c.addInitScript(()=>Object.defineProperty(window,'localStorage',{get:()=>sessionStorage}));
  await c.addInitScript(installTestPeer);
  const host=await page(c),guest=await page(c);
  await joinByCode(guest,'Grace',await createRoom(host,'Ada'));
  await host.waitForFunction(()=>window.__together.friend.online);
  await showPanel(host,'play');await host.locator('#share-list button[data-page=spacegolf]').click();
  await (await request(guest,'Ada wants to play Spacegolf')).getByRole('button',{name:'Join'}).click();
  await host.waitForFunction(()=>window.__together.screen==='sharing');await guest.waitForFunction(()=>window.__together.screen==='viewing');
  await host.waitForFunction(()=>window.__together.game==='spacegolf');
  const golf=await frame(host);await golf.waitForFunction(()=>window.spacegolf);
  await golf.evaluate(()=>{window.spacegolf.playCampaign(0,0);window.spacegolf.go(window.spacegolf.nextScene,true);window.spacegolf.nextScene=null;window.spacegolf.scene.fire(-1,.35);});
  await guest.waitForFunction(()=>window.__friendSession.screen.remoteReady);
  assert.match(await guest.locator('#cursors-text').textContent(),/Ada’s Spacegolf/);
  await guest.locator('#screen-toggle').click();
  await host.waitForFunction(()=>window.__together.screen==='off');await guest.waitForFunction(()=>window.__together.game==='collection');
  assert.equal(await host.evaluate(()=>window.__together.game),'spacegolf','The sharer keeps playing after the viewer leaves');
  results.push('Consented shared cursors through room relays, sharer-owned game state, viewer rendering and leaving');
  await c.close();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({results,pageErrors:errors,nativeInternetRTCVerified:false},null,2));
}finally{await browser.close();}
