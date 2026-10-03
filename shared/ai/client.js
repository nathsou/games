export const PROVIDERS = {
  openrouter: {name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/settings/keys', efforts: ['default','none','minimal','low','medium','high','xhigh','max']},
  openai: {name: 'OpenAI', url: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', efforts: ['default','none','minimal','low','medium','high','xhigh','max']},
  anthropic: {name: 'Anthropic', url: 'https://api.anthropic.com/v1', keyUrl: 'https://console.anthropic.com/settings/keys', efforts: ['default','none','low','medium','high','xhigh','max']},
};
export function headers(provider, key) {
  return provider === 'anthropic' ? {'Content-Type':'application/json', 'x-api-key':key,
    'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true'} :
    {'Content-Type':'application/json', ...(key ? {Authorization: `Bearer ${key}`} : {}),
      ...(provider === 'openrouter' ? {'X-OpenRouter-Title':'Games Arcade'} : {})};
}
export async function request(url, options, key) {
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
    const error=new Error(String(message).slice(0,500));
    if(body.usage)error.usageResponse={id:body.id,model:body.model,usage:body.usage};
    throw error;
  }
  return body;
}
export async function listModels(provider, key, signal, vision = true) {
  const body = await request(PROVIDERS[provider].url + '/models', {headers: headers(provider, key), signal}, key);
  return (body.data || []).filter(m => !vision || provider !== 'openrouter' || m.architecture?.input_modalities?.includes('image'))
    .map(m => ({id: m.id, name: m.name || m.display_name || m.id,
      reasoning: provider === 'openrouter' ? (m.supported_parameters || []).some(p => p === 'reasoning' || p === 'reasoning.effort') : null,
      pricing:provider==='openrouter' && m.pricing ? m.pricing : null}))
    .sort((a, b) => a.id.localeCompare(b.id));
}
export function buildProviderRequest(settings, instructions, text, schema, name = 'game_move', image = null) {
  const provider = settings.provider, model = settings.models[provider], effort = settings.efforts[provider];
  const budget = Math.max(2048, Math.min(32768, Number(settings.tokenBudget) || 8192));
  if (!PROVIDERS[provider] || !model) throw new Error('Choose an AI provider and model in settings.');
  if (provider === 'openai') return {url:PROVIDERS[provider].url+'/responses',body:{
    model,max_output_tokens:budget,store:false,...(effort !== 'default'?{reasoning:{effort}}:{}),instructions,
    input:[{role:'user',content:[{type:'input_text',text},...(image?[{type:'input_image',image_url:image,detail:'high'}]:[])]}],
    text:{format:{type:'json_schema',name,strict:true,schema}}}};
  if (provider === 'anthropic') return {url:PROVIDERS[provider].url+'/messages',body:{
    model,max_tokens:budget,system:instructions,
    ...(effort === 'none'?{thinking:{type:'disabled'}}:effort !== 'default'?{output_config:{effort}}:{}),
    messages:[{role:'user',content:[...(image?[{type:'image',source:{type:'base64',media_type:'image/png',data:image.split(',')[1]}}]:[]),{type:'text',text}]}]}};
  return {url:PROVIDERS[provider].url+'/chat/completions',body:{model,max_tokens:budget,
    ...(effort !== 'default'?{reasoning:{effort,exclude:true}}:{}),
    response_format:{type:'json_schema',json_schema:{name,strict:true,schema}},
    messages:[{role:'system',content:instructions},{role:'user',content:[{type:'text',text},...(image?[{type:'image_url',image_url:{url:image}}]:[])]}]}};
}
export function responseText(provider, data) {
  if (provider === 'openai') return (data.output || []).filter(o=>o.type==='message').flatMap(m=>m.content || []).filter(c=>c.type==='output_text').map(c=>c.text).join('');
  if (provider === 'anthropic') return (data.content || []).filter(c=>c.type==='text').map(c=>c.text).join('');
  return data.choices?.[0]?.message?.content;
}
