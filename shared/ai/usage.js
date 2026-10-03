import {read, write} from './ledger-storage.js';

const VERIFIED = '2026-10-03';
const DEFAULT_PRICES = {
  'openai:gpt-6-luna': {input:.10, cachedInput:.01, cacheWrite:.125, output:.50,
    source:'OpenAI standard pricing', verified:VERIFIED, url:'https://developers.openai.com/api/docs/models/gpt-6-luna', longContext:true},
  'anthropic:claude-sonnet-4-6': {input:3, cachedInput:.30, cacheWrite:3.75, output:15,
    source:'Anthropic standard pricing', verified:VERIFIED, url:'https://platform.claude.com/docs/en/about-claude/pricing'},
};
const number = value => value === null || value === undefined || value === '' ? null :
  Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
let memory = {version:1, since:Date.now(), games:[], requests:[]};
let persistent = true;
export const priceKey = (provider, model) => `${provider}:${model}`;
export function modelPrice(settings, provider=settings.provider, model=settings.models[provider]) {
  const rate=settings.prices?.[priceKey(provider,model)] || DEFAULT_PRICES[priceKey(provider,model)];
  return rate && number(rate.input)!==null && number(rate.output)!==null ? {...rate,
    input:number(rate.input), output:number(rate.output), cachedInput:number(rate.cachedInput), cacheWrite:number(rate.cacheWrite)} : null;
}
function ledger() {
  if(!persistent)return memory;
  const saved=read('usage',null);
  if(saved?.version===1 && Array.isArray(saved.games) && Array.isArray(saved.requests))memory=saved;
  return memory;
}
function save(data) {
  memory=data;persistent=write('usage',data);
  globalThis.dispatchEvent?.(new Event('similo-usage-change'));
  globalThis.dispatchEvent?.(new Event('games-usage-change'));
}
export function trackGame(game, mode) {
  if(!game || mode==='replay')return;
  const data=ledger(), existing=data.games.find(g=>g.id===game.id);
  const entry={id:game.id, game:game.arcadeGame || 'similo', theme:game.theme || game.arcadeGame, clueTheme:game.clueTheme, mode, variant:game.variant,
    started:game.started, result:game.result, state:['over','matchOver'].includes(game.phase)?'finished':'in progress',
    aiTurns:(game.history || []).flatMap(r=>['giver','guesser'].flatMap(role=>
      r[role+'Source'] && r[role+'Source']!=='Human' ? [`${r.round}:${role}`] : []))};
  if(existing && JSON.stringify(existing)===JSON.stringify(entry))return;
  if(existing)Object.assign(existing,entry);else data.games.push(entry);
  save(data);
}
export function trackArcadeGame(id,kind,state,mode='AI table') {
  if(!id||!state)return;
  const data=ledger(),existing=data.games.find(g=>g.id===id),finished=['over','matchOver'].includes(state.phase);
  const winner=state.phase==='matchOver'?state.scores?.indexOf(2):state.scores?.[0]===state.scores?.[1]?null:state.scores?.[0]>state.scores?.[1]?0:1;
  const entry={id,game:kind,theme:kind,mode,started:existing?.started||Date.now(),state:finished?'finished':'in progress',result:finished?(winner===null?'draw':winner===0?'win':'loss'):null,aiTurns:[]};
  if(existing&&JSON.stringify(existing)===JSON.stringify(entry))return;
  if(existing)Object.assign(existing,entry);else data.games.push(entry);save(data);
}
export function beginUsage(game, role, settings) {
  if(game.arcadeGame)trackArcadeGame(game.id,game.arcadeGame,game);else trackGame(game,`ai-${role}`);
  const data=ledger(), entry={id:crypto.randomUUID(), gameId:game.id, round:game.round+1, role,
    provider:settings.provider, model:settings.models[settings.provider], effort:settings.efforts[settings.provider],
    ...(game.arcadeGame?{turn:game.revision}:{}),started:Date.now(), status:'pending', costUSD:null, costKind:'unknown', rates:modelPrice(settings)};
  data.requests.push(entry);save(data);return entry.id;
}
export function markUsage(id, status) {
  const data=ledger(), entry=data.requests.find(r=>r.id===id);
  if(!entry)return;entry.status=status;save(data);
}
export function finishUsage(id, response) {
  const data=ledger(), entry=data.requests.find(r=>r.id===id);
  if(!entry)return;
  const u=response.usage || {}, anthropic=entry.provider==='anthropic';
  const rawInput=number(anthropic?u.input_tokens:entry.provider==='openai'?u.input_tokens:u.prompt_tokens);
  const output=number(anthropic?u.output_tokens:entry.provider==='openai'?u.output_tokens:u.completion_tokens);
  const cache=anthropic?u:u.input_tokens_details || u.prompt_tokens_details || {};
  const cached=number(anthropic?u.cache_read_input_tokens:cache.cached_tokens) || 0;
  const writes=number(anthropic?u.cache_creation_input_tokens:cache.cache_write_tokens) || 0;
  const input=rawInput===null?null:anthropic?rawInput+cached+writes:rawInput;
  const uncached=rawInput===null?null:anthropic?rawInput:Math.max(0,rawInput-cached-writes);
  const reasoning=number(u.output_tokens_details?.reasoning_tokens ?? u.output_tokens_details?.thinking_tokens ?? u.completion_tokens_details?.reasoning_tokens);
  const reported=entry.provider==='openrouter'?number(u.cost):null;
  let costUSD=reported, costKind=reported===null?'unknown':'reported';
  if(costUSD===null && entry.rates && uncached!==null && output!==null) {
    const rate=entry.rates, long=rate.longContext && input>272000;
    const inputMultiplier=long?2:1, outputMultiplier=long?1.5:1;
    const tier=entry.provider==='openai' && ['fast','priority'].includes(response.service_tier)?2:
      entry.provider==='openai' && response.service_tier==='flex'?.5:1;
    const oneHour=anthropic?Math.min(writes,number(u.cache_creation?.ephemeral_1h_input_tokens)||0):0;
    costUSD=(inputMultiplier*(uncached*rate.input+cached*(rate.cachedInput??rate.input)+
      (writes-oneHour)*(rate.cacheWrite??rate.input)+oneHour*rate.input*2)+output*rate.output*outputMultiplier)*tier/1e6;
    costKind='estimated';
  }
  Object.assign(entry,{status:'responded', finished:Date.now(), responseId:typeof response.id==='string'?response.id:null,
    resolvedModel:typeof response.model==='string'?response.model:entry.model,
    inputTokens:input, outputTokens:output, cachedTokens:cached, cacheWriteTokens:writes,
    reasoningTokens:reasoning, costUSD, costKind});
  save(data);
}
export function usageSummary(requests, games=[]) {
  const untracked=games.reduce((sum,g)=>sum+(g.aiTurns||[]).filter(turn=>
    !requests.some(r=>r.gameId===g.id && `${r.round}:${r.role}`===turn)).length,0);
  const unknown=requests.filter(r=>r.costUSD===null).length+untracked;
  return {costUSD:requests.reduce((sum,r)=>sum+(number(r.costUSD)||0),0), unknown, untracked,
    pending:requests.filter(r=>r.status==='pending' && Date.now()-r.started<180000).length,
    requests:requests.length, completedTurns:new Set(requests.filter(r=>r.status==='completed').map(r=>`${r.gameId}:${r.round}:${r.role}:${r.turn??''}`)).size,
    inputTokens:requests.reduce((sum,r)=>sum+(r.inputTokens||0),0),
    outputTokens:requests.reduce((sum,r)=>sum+(r.outputTokens||0),0),
    cachedTokens:requests.reduce((sum,r)=>sum+(r.cachedTokens||0),0),
    cacheWriteTokens:requests.reduce((sum,r)=>sum+(r.cacheWriteTokens||0),0),
    reasoningTokens:requests.reduce((sum,r)=>sum+(r.reasoningTokens||0),0)};
}
export function usageSnapshot() {
  const data=ledger();
  return {...data, persistent, total:usageSummary(data.requests,data.games),
    games:data.games.map(g=>({...g, usage:usageSummary(data.requests.filter(r=>r.gameId===g.id),[g])}))};
}
export function gameUsage(id) {
  const data=ledger();return usageSummary(data.requests.filter(r=>r.gameId===id),data.games.filter(g=>g.id===id));
}
export function formatUSD(value) {
  return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:4,maximumFractionDigits:6}).format(value);
}
export function formatSpend(summary) {
  if(summary.unknown && !summary.costUSD)return summary.pending?'Awaiting usage':'Unknown';
  return (summary.unknown?'≥ ':'')+formatUSD(summary.costUSD);
}
