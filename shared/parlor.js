import {installThemeControls} from './theme.js';
import {loadPlayerName} from './player-name.js';

// Shared page helpers for the parlor games (Thrice, Yesteryear, Cover Story,
// Ripples): escaping, preferences, toasts, dialogs, sounds and room seat names.
export const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export function loadPrefs(key) {
  try { const value = JSON.parse(localStorage.getItem(key) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}
export function savePrefs(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Optional storage. */ } }
export const playerName = () => loadPlayerName() || 'You';

let toastTimer;
export function toast(message) {
  let element = document.querySelector('#toast');
  if (!element) { element = document.createElement('div'); element.id = 'toast'; element.setAttribute('role', 'status'); element.setAttribute('aria-live', 'polite'); document.body.append(element); }
  element.textContent = message; element.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('visible'), 4200);
}
export function openDialog(title, body, eyebrow = '') {
  let dialog = document.querySelector('#parlor-dialog');
  if (!dialog) {
    dialog = document.createElement('dialog'); dialog.id = 'parlor-dialog'; dialog.setAttribute('aria-labelledby', 'parlor-dialog-title');
    dialog.addEventListener('click', event => { if (event.target === dialog || event.target.closest('[data-close]')) dialog.close(); });
    document.body.append(dialog);
  }
  dialog.innerHTML = '<div class="dialog-head"><div>' + (eyebrow ? '<p class="eyebrow">' + esc(eyebrow) + '</p>' : '') + '<h2 id="parlor-dialog-title">' + esc(title) + '</h2></div><button type="button" class="close" data-close aria-label="Close">×</button></div><div class="dialog-body">' + body + '</div>';
  if (!dialog.open) dialog.showModal();
  return dialog;
}

let audio, soundOn = false;
export function playSound(kind = 'tap') {
  if (!soundOn) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const notes = {win: [392, 494, 587, 784], good: [440, 660], bad: [220, 165], flip: [520], tap: [450], turn: [330, 392]}[kind] || [450];
    notes.forEach((frequency, i) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain(), time = audio.currentTime + i * .07;
      oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(.04, time + .006); gain.gain.exponentialRampToValueAtTime(.0001, time + .12);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(time); oscillator.stop(time + .14);
    });
  } catch { /* Audio is optional. */ }
}
// Theme selector and a sound toggle in the page's top bar.
export function installTopbar(prefsKey) {
  const actions = document.querySelector('.top-actions'), prefs = loadPrefs(prefsKey);
  soundOn = Boolean(prefs.sound);
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'chip';
  const label = () => { button.textContent = soundOn ? 'Sound on' : 'Sound off'; button.setAttribute('aria-pressed', String(soundOn)); };
  button.onclick = () => { soundOn = !soundOn; const next = loadPrefs(prefsKey); next.sound = soundOn; savePrefs(prefsKey, next); label(); playSound('tap'); };
  label(); actions.append(button);
  installThemeControls(actions);
}
// Seat labels in a room game: the two people by name, then bots and AI players.
export function seatNames(record, client, botLabel = 'Bot') {
  const {me, friend} = client.names, role = client.session.role;
  let bots = 0, ais = 0;
  return record.controllers.map(kind => kind === 'team' ? (me + ' & ' + friend).slice(0, 28)
    : kind === 'host' || kind === 'guest' ? (kind === role ? me : friend)
    : kind === 'model' ? 'AI ' + ++ais : botLabel + ' ' + ++bots);
}
