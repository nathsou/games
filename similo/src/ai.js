import {aiObservation} from './game.js';

export const PROVIDERS = {
  openrouter: {name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/settings/keys', efforts: ['default','none','minimal','low','medium','high','xhigh','max']},
  openai: {name: 'OpenAI', url: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', efforts: ['default','none','minimal','low','medium','high','xhigh','max']},
  anthropic: {name: 'Anthropic', url: 'https://api.anthropic.com/v1', keyUrl: 'https://console.anthropic.com/settings/keys', efforts: ['default','none','low','medium','high','xhigh','max']},
};
export function headers(provider, key) {
  return provider === 'anthropic' ? {'Content-Type':'application/json', 'x-api-key':key,
    'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true'} :
    {'Content-Type':'application/json', ...(key ? {Authorization: `Bearer ${key}`} : {}),
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
  const invalid = message => Object.assign(new Error(message), {code:'INVALID_MOVE'});
  if (typeof text !== 'string' || text.length > 50000) throw invalid('The model did not return a usable move.');
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let move;
  try { move = JSON.parse(clean); } catch { throw invalid('The model returned invalid JSON.'); }
  if (!move || typeof move !== 'object' || typeof move.rationale !== 'string' || !move.rationale.trim() || move.rationale.length > 1200) {
    throw invalid('The model must return a move with a brief explanation.');
  }
  return move;
}
const schema = {type:'object', properties:{card:{type:['string','null']}, relation:{type:['string','null'],enum:['similar','different',null]},
  cards:{type:'array',items:{type:'string'}}, rationale:{type:'string'}}, required:['card','relation','cards','rationale'], additionalProperties:false};
export function buildRequest(settings, observation, image, correction = '') {
  const provider = settings.provider, model = settings.models[provider], effort = settings.efforts[provider];
  const rules = `You are playing cooperative Similo with a human. Respect your role's information boundary and return one legal move.
GAME: Twelve cards, one secret, five rounds. The giver plays ONE hand card as SIMILAR (a shared feature) or DIFFERENT (a specific contrast). The guesser removes 1, 2, 3, 4, then 1 cards; removing the secret loses, keeping it alone wins. All previous clues remain relevant. A fixed hand never refills: plan the order of all remaining cards. A classic hand refills after each clue. Do not browse or use tools.
SHARED CONTEXT: Use the supplied image AND the public subtitles, dates and descriptions; the human can inspect the same context. Give equal consideration to every applicable dimension, with no automatic priority for looks or profession. Dimensions: (1) job, role or domain, such as emperor, scientist, writer or performer; (2) dates, lifespan overlap, historical era and contemporaries; (3) geography, origin, country and cultural setting; (4) known achievements, stories, relationships, beliefs or mythological associations; (5) traits and categories explicitly supported by the context; (6) appearance, clothing, props, colors, architecture and landscape. Consider all six before choosing; some may be inapplicable. Use the most clear and discriminating connection in this position. Neither a matching portrait nor a job label automatically outranks a clear chronological or thematic connection. Art is stylized: do not infer an exact age, ethnicity, character or biography from a face. Profession labels are incomplete: a computing pioneer can also be a mathematician. Avoid obscure trivia and unsupported psychological traits.
DATES: Unlabelled ranges are lifespans; Born, Reign and named landmarks/events/milestones have their stated meanings. c. is approximate; Trad. is traditional. Mythical figures have no historical lifespans. A country's milestone is not its founding or the beginning of its culture; a monument's date is not a city's entire era. Historic French regions can overlap modern ones. Do not invent connections or visual details.
PRIVATE INFORMATION: Givers receive the secret and hand; guessers receive neither. You receive only your OWN earlier short explanations as memory, never the partner's sealed notes. Reconsider your earlier interpretation when later evidence changes it. The rationale is sealed: the human only sees the card and its direction during play.
GIVER DECISION: For EACH legal hand card, consider BOTH Similar and Different. Compare its possible connections across the six dimensions with the secret and ALL surviving alternatives. For each plausible candidate, check: what is the human's natural reading; does the target fit that reading; which alternatives would it invite them to remove this round; could another dimension make it confusing or point away from the target; does it fit the whole clue trail? Anchor each new clue directly to the secret, not merely to an earlier clue. Check accumulated unintended patterns: if several clues share an era, job, geography or visual trait that the target lacks, would the human reasonably infer that pattern instead of your intended association? Avoid adding to a dangerous pattern unless the public clue trail clearly protects the target. Discard candidates whose most obvious reading endangers the target. Compare a few promising card/direction pairs before selecting the clearest. A broad role such as emperor or scientist is useful when it actually separates this board; a visual detail is useful under the same condition. Familiar geography, dates and stories are equally valid.
SIGN CHOICE: Similar and Different are equally legal. Do not default to Different because the task involves eliminating cards, or assume that repeated negative clues are desirable. A positive shared feature can guide safe eliminations just as well. A Different clue must communicate a concrete, recognizable opposing feature that the target fits, not just absence of an arbitrary similarity. Check for dangerous shared traits that could make its direction ambiguous. Choose the best signal; do not force a sign quota or alternate signs mechanically. When two moves are equally clear and safe, prefer a direct Similar connection, which requires less guessing about the intended contrast. With fixed five, reserve a useful final discriminator without sacrificing the current round or contradicting earlier clues.
GUESSER DECISION: Compare every remaining card against the whole clue trail through the same six dimensions. Consider several plausible meanings of the latest clue and check each against geography, dates/era, role, stories, traits and appearance. Ask which interpretation best explains the giver's choice and separates this board without conflicting with earlier clues. Similar means at least one relevant shared feature, not agreement in everything. Different means one contextual contrast, not a prohibition on every shared feature. Keep the candidates that best fit the combined evidence and remove the least plausible exactly as required. In the final round, directly contrast the two survivors against the latest clue in every applicable dimension, using the enlarged portraits and public biographies equally. Do not automatically resolve a tie by looks. Never claim to know the hidden secret.
OUTPUT: Return ONLY one JSON object with exactly {"card":string|null,"relation":"similar"|"different"|null,"cards":string[],"rationale":string}. Giver: one hand ID in card, one direction in relation, cards=[]. Guesser: card=null, relation=null, exactly removeCount distinct surviving board IDs in cards. Record a short player-facing rationale (1–3 sentences, at most 800 characters) naming the chosen association and why it distinguishes the relevant candidates. This is a brief end-of-game explanation, not a transcript of internal deliberation. Do not mention a hidden target when guessing. ${correction}`;
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
