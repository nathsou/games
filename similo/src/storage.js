import {loadAI, saveAI} from '../../shared/ai/config.js';
const PREFIX = 'similo-arcade-v1:';
export function read(name, fallback) {
  try { const value = localStorage.getItem(PREFIX + name); return value === null ? fallback : JSON.parse(value); }
  catch { return fallback; }
}
export function write(name, value) {
  if (name === 'settings') saveAI(value);
  try { localStorage.setItem(PREFIX + name, JSON.stringify(value)); return true; }
  catch { return false; }
}
export function erase(name) { try { localStorage.removeItem(PREFIX + name); } catch { /* Private browsing may deny storage. */ } }
export const DEFAULT_SETTINGS = {provider: 'openrouter', models: {openrouter: 'openai/gpt-6-luna', openai: 'gpt-6-luna', anthropic: 'claude-sonnet-4-6'},
  efforts: {openrouter: 'medium', openai: 'medium', anthropic: 'medium'}, keys: {}, tokenBudget: 8192,
  stun: 'stun:stun.l.google.com:19302', sound: true, music: true, musicVolume: 22, muted: false, effects: true,
  appearance: 'system', tableCardSize: 'comfortable', prices: {}};
export function loadSettings() {
  const saved = read('settings', {});
  return {...DEFAULT_SETTINGS, ...saved, muted:false, sound:saved.muted?false:saved.sound??DEFAULT_SETTINGS.sound,
    music: saved.muted?false:saved.music ?? saved.sound ?? DEFAULT_SETTINGS.music,
    appearance:['dark','light','system'].includes(saved.appearance)?saved.appearance:DEFAULT_SETTINGS.appearance,
    tableCardSize:['compact','comfortable','large'].includes(saved.tableCardSize)?saved.tableCardSize:DEFAULT_SETTINGS.tableCardSize,
    prices: {...saved.prices}, models: {...DEFAULT_SETTINGS.models, ...saved.models},
    efforts: {...DEFAULT_SETTINGS.efforts, ...saved.efforts}, keys: {...saved.keys}, ...loadAI()};
}
