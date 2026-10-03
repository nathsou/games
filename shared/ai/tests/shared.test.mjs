import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAI,saveAI,forgetKeys,CONFIG_KEY} from '../config.js';
import {buildProviderRequest} from '../client.js';
import {chooseTurn} from '../turn.js';
import {usageSnapshot} from '../usage.js';
import {createGame,playerView} from '../../../midnight/src/rules.js';
import {describeTurn} from '../../../midnight/src/ai.js';
const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
const settings={provider:'openai',models:{openai:'gpt-6-luna'},efforts:{openai:'low'},keys:{openai:'test-only-not-a-key'},rememberKeys:false,tokenBudget:4096,prices:{}};
test('legacy Similo config migrates, ephemeral credentials do not persist, and forgetting removes both stores',()=>{
 data.set('similo-arcade-v1:settings',JSON.stringify({...settings,rememberKeys:true}));assert.equal(loadAI().models.openai,'gpt-6-luna');
 saveAI(settings);assert.equal(loadAI().keys.openai,settings.keys.openai);assert.deepEqual(JSON.parse(data.get(CONFIG_KEY)).keys,{});assert.deepEqual(JSON.parse(data.get('similo-arcade-v1:settings')).keys,{});
 saveAI({...settings,rememberKeys:true});data.set(CONFIG_KEY,JSON.stringify({...settings,rememberKeys:true,keys:{openai:'new-test-key'}}));assert.equal(loadAI().keys.openai,'new-test-key');forgetKeys();assert.deepEqual(loadAI().keys,{});
});
test('shared Responses payload uses exact model, strict JSON, no storage, and optional role image',()=>{
 const schema={type:'object',properties:{choice:{type:'integer'}},required:['choice'],additionalProperties:false};
 const built=buildProviderRequest(settings,'rules','observation',schema);
 assert(built.url.endsWith('/responses'));assert.equal(built.body.model,'gpt-6-luna');assert.equal(built.body.store,false);assert.equal(built.body.text.format.strict,true);assert.equal(built.body.input[0].content.length,1);
 const vision=buildProviderRequest(settings,'rules','obs',schema,'test','data:image/png;base64,AAAA');assert.equal(vision.body.input[0].content[1].type,'input_image');assert.equal(built.body.max_output_tokens,4096);
});
test('one malformed move gets a correction, usage is recorded, and provider errors preserve the key boundary',async()=>{
 const original=globalThis.fetch,requests=[];let count=0;
 globalThis.fetch=async(url,opts)=>{requests.push(JSON.parse(opts.body));return {ok:true,json:async()=>({model:'gpt-6-luna',usage:{input_tokens:100,output_tokens:10},output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:JSON.stringify({choice:count++?0:99,rationale:'A brief explanation.'})}]}]})};};
 const description={game:'test',rules:'A test game.',observation:{you:0},candidates:[{action:{kind:'flip'}}]};
 try{const move=await chooseTurn(description,{settings,gameId:'test',role:'seat-1'});assert.equal(move.action.kind,'flip');assert.equal(requests.length,2);assert(requests[1].instructions.includes('last response was invalid'));assert.equal(usageSnapshot().requests.slice(-2)[0].status,'invalid');
 globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({error:{message:'Invalid '+settings.keys.openai}})});await assert.rejects(()=>chooseTurn(description,{settings}),e=>!e.message.includes(settings.keys.openai)&&e.message.includes('[key hidden]'));
 }finally{globalThis.fetch=original;}
});
test('Midnight role observations are idempotent and exclude future prizes, opposing cards and sealed choices',()=>{
 for(const type of ['backhand','closing','heist']){const state=createGame(type,13),view=playerView(state,1),d=describeTurn(view,1);assert.equal(d.observation.seed,undefined);assert.equal(d.observation.deck,undefined);assert.equal(d.observation.prizes,undefined);if(type!=='closing')assert(d.observation.hands[0].every(c=>c.hidden));}
});
