export const CONFIG_KEY = 'games-arcade:ai-settings-v1';
export const DEFAULT_AI = Object.freeze({provider:'openrouter',models:{openrouter:'openai/gpt-6-luna',openai:'gpt-6-luna',anthropic:'claude-sonnet-4-6'},
  efforts:{openrouter:'medium',openai:'medium',anthropic:'medium'},keys:{},rememberKeys:false,tokenBudget:8192,prices:{}});
export const AI_FIELDS = Object.freeze(Object.keys(DEFAULT_AI));
let ephemeralKeys = {};
function read(key) { try {return JSON.parse(localStorage.getItem(key)||'null');} catch {return null;} }
export function loadAI() {
  const shared=read(CONFIG_KEY), legacy=read('similo-arcade-v1:settings') || {};
  const saved=shared || legacy;
  const rememberKeys=saved.rememberKeys === true || !shared && Object.keys(saved.keys||{}).length>0 && saved.rememberKeys!==false;
  return {...DEFAULT_AI,provider:['openrouter','openai','anthropic'].includes(saved.provider)?saved.provider:DEFAULT_AI.provider,
    models:{...DEFAULT_AI.models,...saved.models},efforts:{...DEFAULT_AI.efforts,...saved.efforts},
    keys:{...(rememberKeys?saved.keys:{}),...ephemeralKeys},rememberKeys,
    tokenBudget:Math.max(2048,Math.min(32768,Number(saved.tokenBudget)||8192)),prices:{...saved.prices}};
}
export function saveAI(settings) {
  const next=Object.fromEntries(AI_FIELDS.map(k=>[k,settings[k]??DEFAULT_AI[k]]));
  ephemeralKeys={...next.keys};
  const persisted={...next,keys:next.rememberKeys?next.keys:{}};
  let saved=true;
  try {
    localStorage.setItem(CONFIG_KEY,JSON.stringify(persisted));
    // Erase migrated credentials from the old store when remembering is disabled.
    const legacy=read('similo-arcade-v1:settings');
    if (legacy) localStorage.setItem('similo-arcade-v1:settings',JSON.stringify({...legacy,...persisted}));
  } catch {saved=false;}
  globalThis.dispatchEvent?.(new Event('games-ai-settings-change'));
  return saved;
}
export function forgetKeys() {const settings=loadAI();settings.keys={};settings.rememberKeys=false;return saveAI(settings);}
export function aiOnly(settings) {return Object.fromEntries(AI_FIELDS.map(k=>[k,settings[k]]));}
