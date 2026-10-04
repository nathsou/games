// Optional browser regression checks. Run with npm start in another terminal.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || undefined,args:process.env.CHROMIUM_NO_SANDBOX==='1'?['--no-sandbox']:[]});
const origin=process.env.FLIP_IT_URL || 'http://localhost:8080/flip-it/';
const errors=[];

// A local test channel exercises the real application/session exchange without
// requiring ICE candidates, internet access, or a TURN account. Native SDP
// generation and reply acceptance are checked separately below.
function testTransport(){
  class Channel extends EventTarget {
    constructor(pc){super();this.pc=pc;this.readyState='connecting';this.bufferedAmount=0;}
    send(data){this.pc.bus.postMessage({type:'data',from:this.pc.id,to:this.pc.remote,data});}
    close(){this.readyState='closed';}
    open(){this.readyState='open';this.dispatchEvent(new Event('open'));}
  }
  class Connection extends EventTarget {
    constructor(){
      super();this.id=crypto.randomUUID();this.signalingState='stable';this.connectionState='new';this.iceGatheringState='complete';
      this.bus=new BroadcastChannel('flip-it-invite-test');
      this.bus.onmessage=({data})=>{
        if(data.to!==this.id)return;
        if(data.type==='connect')this.open();
        if(data.type==='data'){const e=new Event('message');e.data=data.data;this.channel.dispatchEvent(e);}
      };
    }
    createDataChannel(){return this.channel=new Channel(this);}
    async createOffer(){return {type:'offer',sdp:'v=0\r\n'+this.id};}
    async createAnswer(){return {type:'answer',sdp:'v=0\r\n'+this.id};}
    async setLocalDescription(d){this.localDescription=d;this.signalingState=d.type==='offer'?'have-local-offer':'stable';}
    async setRemoteDescription(d){
      this.remote=d.sdp.trim().split('\n').at(-1);
      if(d.type==='offer'){const e=new Event('datachannel');e.channel=this.createDataChannel();this.dispatchEvent(e);}
      else {this.signalingState='stable';this.bus.postMessage({type:'connect',to:this.remote});this.open();}
    }
    open(){this.connectionState='connected';this.dispatchEvent(new Event('connectionstatechange'));this.channel.open();}
    close(){this.signalingState='closed';this.connectionState='closed';this.channel?.close();this.bus.close();}
  }
  window.RTCPeerConnection=Connection;
}
async function context(prefs,transport=false,size={width:1280,height:720}){
  const c=await browser.newContext({viewport:size,permissions:['clipboard-read','clipboard-write']});
  await c.addInitScript(p=>{if(!localStorage.getItem('flip-it.preferences'))localStorage.setItem('flip-it.preferences',JSON.stringify(p));}, {stun:'',fx:false,...prefs});
  if(transport)await c.addInitScript(testTransport);
  return c;
}
async function page(c){const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);await p.goto(origin);return p;}
async function ready(p){await p.waitForFunction(()=>document.querySelector('#pair-output')?.value);return p.locator('#pair-output').inputValue();}
async function invite(p){await p.locator('[data-action=host]').first().click();return ready(p);}
async function options(p){await p.locator('.pair-options > summary').click();}
async function pair(p,c){const url=await invite(p),g=await page(c);await g.goto(url);const reply=await ready(g);await p.locator('#pair-input').fill(reply);await p.locator('[data-action=accept-reply]').click();await p.waitForFunction(()=>window.__flipit.connected).catch(async error=>{console.error('host connection diagnostics',await p.evaluate(()=>({connected:window.__flipit.connected,state:window.__flipit.state,alerts:[...document.querySelectorAll('[role=alert]')].map(el=>el.textContent),toast:document.querySelector('#toast').textContent})));throw error;});await g.waitForFunction(()=>window.__flipit.connected);return g;}
try {
  // Old offline preferences must not silently create online AI or team seats.
  const c=await context({aiCount:4,aiKinds:['model','model','model','model'],team:true},true);
  console.log('Checking human-only online tables');
  const h=await page(c),g=await pair(h,c);
  const snapshot=await h.evaluate(()=>window.__flipit.state);
  assert.equal(snapshot.hands.length,2);assert.equal((await g.evaluate(()=>window.__flipit.state)).hands.length,2);
  await h.locator('[data-action=menu]').click();await h.locator('[data-action=table-settings]').click();
  assert.equal(await h.locator('#ai-count').inputValue(),'0');
  await h.locator('#ai-count').selectOption('2');await h.locator('[data-action=close-modal]').first().click();await h.locator('[data-action=deal-online]').click();
  await g.waitForFunction(()=>window.__flipit.state?.hands.length===4);
  await h.locator('[data-action=menu]').click();await h.locator('[data-action=table-settings]').click();await h.locator('#ai-count').selectOption('0');await h.locator('[data-action=close-modal]').first().click();await h.locator('[data-action=deal-online]').click();
  await g.waitForFunction(()=>window.__flipit.state?.hands.length===2);
  await c.close();

  // Zero is selectable for local play, is respected, and never creates a bot.
  console.log('Checking local zero-bot tables');
  const local=await context({}),p=await page(local);
  await p.locator('[data-action=table-settings]').click();assert.equal(await p.locator('#ai-count').inputValue(),'1');
  await p.locator('#ai-count').selectOption('0');await p.locator('[data-action=close-modal]').first().click();await p.locator('[data-action=start-game]').click();
  assert.equal(await p.evaluate(()=>window.__flipit.state),null);assert.equal(await p.locator('#ai-count').inputValue(),'0');
  await p.locator('#table-humans').selectOption('2');await p.locator('[data-action=close-modal]').first().click();await p.locator('[data-action=start-game]').click();
  assert.equal((await p.evaluate(()=>window.__flipit.state)).hands.length,2);assert(await p.evaluate(()=>window.__flipit.handoff));
  await local.close();

  // Team play is explicit and retains the minimum opponent it needs.
  console.log('Checking explicit team tables');
  const team=await context({},true),t=await page(team);
  await invite(t);await options(t);await t.locator('#team').check();assert.equal(await t.locator('#ai-count').inputValue(),'1');
  const teamUrl=await t.locator('#pair-output').inputValue(),tg=await page(team);await tg.goto(teamUrl);const tr=await ready(tg);
  await t.locator('#pair-input').fill(tr);await t.locator('[data-action=accept-reply]').click();await t.waitForFunction(()=>window.__flipit.connected);await tg.waitForFunction(()=>window.__flipit.connected);
  assert.equal((await t.evaluate(()=>window.__flipit.state)).hands.length,2);
  assert.equal(await tg.evaluate(()=>window.__flipit.seat),0);
  await team.close();

  // Native offers, replies, clipboard actions, errors, rerenders and phone UI.
  let candidates;
  for(const width of [1280,390,320]){
    console.log('Checking native pairing at width',width);
    const nc=await context({aiCount:3,team:true},false,{width,height:width===1280?720:844}),n=await page(nc);
    await invite(n);assert.equal(await n.locator('#ai-count').inputValue(),'0');assert.equal(await n.locator('#team').isChecked(),false);
    await n.locator('[data-action=copy]').click();const offer=await n.evaluate(()=>navigator.clipboard.readText());
    assert.equal(offer,await n.locator('#pair-output').inputValue());
    const ng=await page(nc);await ng.locator('[data-action=join]').click();await ng.evaluate(v=>navigator.clipboard.writeText(v),offer);await ng.locator('[data-action=paste-pair]').click();await ready(ng);
    await ng.locator('[data-action=copy]').click();const reply=await ng.evaluate(()=>navigator.clipboard.readText());
    await options(n);await n.locator('#ai-count').selectOption('1');assert(await n.locator('.pair-options').evaluate(el=>el.open));await n.locator('#ai-count').selectOption('0');
    await n.locator('.connection-settings > summary').click();await n.locator('#turn').fill('turn:example.invalid:3478');await n.locator('#turn-name').fill('test-user');await n.locator('#turn-password').fill('test-secret');
    await n.locator('#pair-input').fill('invalid reply');await n.locator('[data-action=accept-reply]').click();assert(await n.locator('[role=alert]').count());
    assert.equal(await n.locator('#pair-input').inputValue(),'invalid reply');assert.equal(await n.locator('#turn-password').inputValue(),'test-secret');assert(await n.locator('.connection-settings').evaluate(el=>el.open));
    const prefs=await n.evaluate(()=>localStorage.getItem('flip-it.preferences'));assert(!prefs.includes('test-secret'));assert(!prefs.includes('test-user'));
    await n.evaluate(v=>navigator.clipboard.writeText(v),reply);await n.locator('[data-action=paste-pair]').click();
    await n.waitForFunction(()=>!document.querySelector('[role=alert]'));
    candidates=await n.evaluate(async()=>{const {decodePairing}=await import('./src/peer.js');const {sdp}=await decodePairing(document.querySelector('#pair-output').value,'offer');return sdp.split('\n').filter(line=>line.startsWith('a=candidate')).length;});
    const bounds=await n.locator('#modal-content').evaluate(el=>({sw:el.scrollWidth,cw:el.clientWidth}));assert(bounds.sw<=bounds.cw+1,JSON.stringify({width,...bounds}));
    await nc.close();
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,checks:['human-only online default despite legacy preferences','optional bots then zero on a new online deal','zero local bots and private handoffs','explicit team play','native offer/reply and clipboard connect','invalid-reply recovery','session-only relay settings survive rerenders','1280/390/320px invite dialogs'],nativeIceCandidates:candidates,liveNativeConnectionVerified:false}));
} finally {await browser.close();}
