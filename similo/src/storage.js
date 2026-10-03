const PREFIX = 'similo-arcade-v1:';
export function read(name, fallback) {
  try { const value = localStorage.getItem(PREFIX + name); return value === null ? fallback : JSON.parse(value); }
  catch { return fallback; }
}
export function write(name, value) {
  try { localStorage.setItem(PREFIX + name, JSON.stringify(value)); return true; }
  catch { return false; }
}
export function erase(name) { try { localStorage.removeItem(PREFIX + name); } catch { /* Private browsing may deny storage. */ } }
export const DEFAULT_SETTINGS = {provider: 'openrouter', models: {openrouter: 'openai/gpt-6-luna', openai: 'gpt-6-luna', anthropic: 'claude-sonnet-4-6'},
  efforts: {openrouter: 'medium', openai: 'medium', anthropic: 'medium'}, keys: {}, tokenBudget: 8192,
  stun: 'stun:stun.l.google.com:19302', sound: true, music: true, musicVolume: 22, muted: false, effects: true};
export function loadSettings() {
  const saved = read('settings', {});
  return {...DEFAULT_SETTINGS, ...saved, music: saved.music ?? saved.sound ?? DEFAULT_SETTINGS.music, models: {...DEFAULT_SETTINGS.models, ...saved.models},
    efforts: {...DEFAULT_SETTINGS.efforts, ...saved.efforts}, keys: {...saved.keys}};
}
