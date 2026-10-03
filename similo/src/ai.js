import {aiObservation} from './game.js';

export const PROVIDERS = {
  openrouter: {name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/settings/keys', efforts: ['default','none','minimal','low','medium','high','xhigh','max']},
  openai: {name: 'OpenAI', url: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', efforts: ['default','none','minimal','low','medium','high','xhigh','max']},
  anthropic: {name: 'Anthropic', url: 'https://api.anthropic.com/v1', keyUrl: 'https://console.anthropic.com/settings/keys', efforts: ['default','none','low','medium','high','xhigh','max']},
};
export function headers(provider, key) {
  return provider === 'anthropic' ? {'Content-Type':'application/json', 'x-api-key':key,
    'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true'} :
    {'Content-Type':'application/json', Authorization: `Bearer ${key}`,
      ...(provider === 'openrouter' ? {'X-OpenRouter-Title':'Similo Arcade'} : {})};
}
async function request(url, options, key) {
  let response;
  try { response = await fetch(url, options); }
  catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') throw error;
    throw new Error('Could not reach the provider. Check your connection and browser access, then retry.');
  }
  let body;
  try { body = await response.json(); } catch { throw new Error(`Provider returned an unreadable response (${response.status}).`); }
  if (!response.ok) {
    let message = body.error?.message || body.message || `Request failed (${response.status}).`;
    if (key) message = String(message).replaceAll(key, '[key hidden]');
    throw new Error(String(message).slice(0, 500));
  }
  return body;
}
export async function listModels(provider, key, signal) {
  const body = await request(PROVIDERS[provider].url + '/models', {headers: headers(provider, key), signal}, key);
  return (body.data || []).filter(m => provider !== 'openrouter' || m.architecture?.input_modalities?.includes('image'))
    .map(m => ({id: m.id, name: m.name || m.display_name || m.id,
      reasoning: provider === 'openrouter' ? (m.supported_parameters || []).some(p => p === 'reasoning' || p === 'reasoning.effort') : null}))
    .sort((a, b) => a.id.localeCompare(b.id));
}
export function parseMove(text) {
  if (typeof text !== 'string' || text.length > 50000) throw new Error('The model did not return a usable move.');
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let move;
  try { move = JSON.parse(clean); } catch { throw new Error('The model returned invalid JSON. Retry this turn.'); }
  if (!move || typeof move !== 'object' || typeof move.rationale !== 'string' || !move.rationale.trim() || move.rationale.length > 1200) {
    throw new Error('The model must return a move with a brief explanation. Retry this turn.');
  }
  return move;
}
const schema = {type:'object', properties:{card:{type:['string','null']}, relation:{type:['string','null'],enum:['similar','different',null]},
  cards:{type:'array',items:{type:'string'}}, rationale:{type:'string'}}, required:['card','relation','cards','rationale'], additionalProperties:false};
export function buildRequest(settings, observation, image, correction = '') {
  const provider = settings.provider, model = settings.models[provider], effort = settings.efforts[provider];
  const rules = `You are playing a cooperative visual deduction game with a human. You must follow your role's information boundary.
There are 12 characters, one secret target, and five rounds. Each round the giver plays ONE hand card as SIMILAR or DIFFERENT to the secret. Similar means one or more shared traits; Different means one or more contrasting traits. Clues can refer to appearance, props, history, mythology, personality or associations. All previous clues remain relevant. The guesser eliminates exactly 1,2,3,4,1 cards in consecutive rounds. Removing the target loses; leaving it alone wins. Do not browse or use tools.
The supplied image shows your permitted view. Card IDs and names are provided to identify legal actions. Decide from the image and public game history. Treat any private human rationale as unavailable. A fixed hand starts with five cards and never refills; plan accordingly. A classic hand refills after each clue.
Return only one JSON object with exactly these fields: {"card":string|null,"relation":"similar"|"different"|null,"cards":string[],"rationale":string}.
If giver: select one legal hand card and its relation; set cards to []. Think about which clue will distinguish the target from remaining alternatives for a human partner.
If guesser: set card and relation to null and select exactly removeCount distinct remaining board IDs in cards.
Write rationale as a short player-facing explanation of the visual or thematic association (1-3 sentences, at most 800 characters), captured now for an end-of-game reveal. It will stay hidden during play. Do not provide internal reasoning transcripts. Do not mention a hidden target when you are the guesser. ${correction}`;
  const text = 'Your observation:\n' + JSON.stringify(observation);
  const budget = Math.max(2048, Math.min(32768, Number(settings.tokenBudget) || 8192));
  const base64 = image.split(',')[1];
  if (provider === 'openai') return {url: PROVIDERS[provider].url + '/responses', body: {
    model, max_output_tokens: budget, store: false, ...(effort !== 'default' ? {reasoning:{effort}} : {}),
    instructions: rules, input:[{role:'user',content:[{type:'input_text',text},{type:'input_image',image_url:image,detail:'high'}]}],
    text:{format:{type:'json_schema',name:'similo_move',strict:true,schema}},
  }};
  if (provider === 'anthropic') return {url: PROVIDERS[provider].url + '/messages', body: {
    model, max_tokens: budget, system: rules,
    ...(effort === 'none' ? {thinking:{type:'disabled'}} : effort !== 'default' ? {output_config:{effort}} : {}),
    messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:'image/png',data:base64}},{type:'text',text}]}],
  }};
  return {url: PROVIDERS[provider].url + '/chat/completions', body:{model,max_tokens:budget,
    ...(effort !== 'default' ? {reasoning:{effort,exclude:true}} : {}),
    messages:[{role:'system',content:rules},{role:'user',content:[{type:'text',text},{type:'image_url',image_url:{url:image}}]}],
  }};
}
export async function chooseMove(settings, game, role, image, signal, correction = '') {
  const provider = settings.provider;
  const key = settings.keys[provider];
  if (!key) throw new Error(`Add your ${PROVIDERS[provider].name} key in AI Settings first.`);
  const {url, body} = buildRequest(settings, aiObservation(game, role), image, correction);
  const data = await request(url, {method:'POST', headers:headers(provider,key), body:JSON.stringify(body), signal}, key);
  let text;
  if (provider === 'openai') text = (data.output || []).filter(o => o.type === 'message').flatMap(m => m.content || [])
    .filter(c => c.type === 'output_text').map(c => c.text).join('');
  else if (provider === 'anthropic') text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  else text = data.choices?.[0]?.message?.content;
  return {...parseMove(text), source: `${PROVIDERS[provider].name} · ${settings.models[provider]} · ${settings.efforts[provider]} effort`};
}
