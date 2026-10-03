import type { App } from '../app.ts';
import { DEFAULT_KEYS, onSettingsChange, resetProgress, store, updateSettings, type KeyBindings, type Settings } from '../game/storage.ts';
import { keyLabel } from './toolkeys.ts';
import { h, modal, toast } from './dom.ts';

function toggle(label: string, desc: string, key: keyof Settings): HTMLElement {
  const input = h('input', {
    type: 'checkbox',
    role: 'switch',
    checked: Boolean(store.settings[key]),
    onchange: (e: Event) => updateSettings({ [key]: (e.target as HTMLInputElement).checked } as Partial<Settings>),
  });
  return h('label', { class: 'setting' }, h('div', null, h('b', null, label), h('small', null, desc)), h('span', { class: 'switch' }, input, h('i')));
}

function segmented<T extends string>(label: string, desc: string, key: keyof Settings, options: [T, string][]): HTMLElement {
  const name = `seg-${key}`;
  return h('div', { class: 'setting' },
    h('div', null, h('b', null, label), h('small', null, desc)),
    h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label },
      ...options.map(([v, text]) =>
        h('label', null,
          h('input', { type: 'radio', name, value: v, checked: store.settings[key] === v, onchange: () => updateSettings({ [key]: v } as Partial<Settings>) }),
          h('span', null, text)),
      ),
    ),
  );
}

let launchTutorial: (() => void) | null = null;
export const setTutorialLauncher = (fn: () => void) => (launchTutorial = fn);

export async function openSettings(app: App): Promise<void> {
  void app;
  let close = () => {};
  const body = h('div', { class: 'settings' },
    segmented('Appearance', 'Choose a look, or follow your device.', 'theme', [['light', 'Light'], ['dark', 'Dark'], ['auto', 'System']]),
    segmented('Mistakes', 'Classic: five lives. Zen: check at the end.', 'mistakeMode', [['classic', 'Classic'], ['zen', 'Zen']]),
    toggle('Sound effects', 'A little feedback for every move.', 'sound'),
    toggle('Ambient music', 'Soft generative music while solving.', 'ambient'),
    toggle('Show timer', 'Keep track of your time.', 'showTimer'),
    toggle('Warn on wrong breaks', 'In Zen, protect shape cubes without a penalty.', 'warnWrongBreaks'),
    toggle('Left-handed layout', 'Reverse the tool dock.', 'lefty'),
    toggle('Reduce motion', 'Fewer particles and no automatic spin.', 'reducedMotion'),
    h('details', { class: 'advanced' }, h('summary', null, 'Advanced'),
      toggle('Grey out finished rows', 'Fade clues when a row is complete and painted.', 'greyDone'),
      toggle('Focus mode', 'Fade the header while working; tools stay visible.', 'autoHideHud'),
      toggle('Vibration', 'Feedback on supported phones.', 'haptics'),
      segmented('Spin momentum', 'Keep turning after you let go.', 'momentum', [['off', 'Off'], ['light', 'Light'], ['strong', 'Strong']]),
      keyBindings(),
      h('div', { class: 'setting' }, h('b', null, 'Tutorial'), h('button', { class: 'btn', onclick: () => { close(); launchTutorial?.(); } }, 'Replay')),
      h('div', { class: 'setting' }, h('div', null, h('b', null, 'Reset progress'), h('small', null, 'Your own puzzles are kept.')), h('button', { class: 'btn danger', onclick: async () => {
        const r = await modal({ title: 'Reset all progress?', body: 'Stars, times and saved games will be erased. Your own puzzles are kept.', actions: [{ label: 'Cancel', value: 'no' }, { label: 'Erase', value: 'yes', cls: 'danger' }] });
        if (r === 'yes') { resetProgress(); toast('Progress reset'); }
      } }, 'Reset…'))));
  const done = modal({ title: 'Settings', body, actions: [{ label: 'Done', value: 'ok', cls: 'primary' }], cls: 'settings-modal' });
  close = () => (document.querySelector('.settings-modal .modal-actions .btn') as HTMLElement | null)?.click();
  await done;
}

/** Keys the game already uses for something else (per context). */
const RESERVED_PLAY = new Set(['0', 'h', 'r', 'x', 'y', 'z', '[', ']', '?', 'escape', 'tab', 'shift', 'control', 'meta', 'alt', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown']);
const RESERVED_EDITOR = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '[', ']', 'escape', 'tab', 'shift', 'control', 'meta', 'alt', 'arrowleft', 'arrowright']);

const BINDINGS: { id: keyof KeyBindings; label: string; group: 'play' | 'editor' }[] = [
  { id: 'break', label: 'Break (hammer)', group: 'play' },
  { id: 'paint', label: 'Paint (brush)', group: 'play' },
  { id: 'add', label: 'Add cube', group: 'editor' },
  { id: 'remove', label: 'Remove cube', group: 'editor' },
  { id: 'edPaint', label: 'Paint color', group: 'editor' },
  { id: 'pick', label: 'Sample color', group: 'editor' },
];

/** "Hold to use" key bindings, captured by clicking a key cap and pressing a key. */
function keyBindings(): HTMLElement {
  const wrap = h('div', { class: 'keybinds' });
  let capturing: { id: keyof KeyBindings; btn: HTMLElement } | null = null;

  const stop = () => {
    document.removeEventListener('keydown', onKey, true);
    capturing?.btn.classList.remove('capturing');
    capturing = null;
    render();
  };

  const onKey = (e: KeyboardEvent) => {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();
    const key = e.key.toLowerCase();
    if (key === 'escape') return stop();
    const b = BINDINGS.find((x) => x.id === capturing!.id)!;
    const reserved = b.group === 'play' ? RESERVED_PLAY : RESERVED_EDITOR;
    if (key.length !== 1 || reserved.has(key) || key === ' ') {
      capturing.btn.textContent = `${keyLabel(key)} is taken`;
      return;
    }
    const keys = { ...store.settings.keys };
    // swap with any other binding in the same context that used this key
    const clash = BINDINGS.find((x) => x.group === b.group && x.id !== b.id && keys[x.id] === key);
    if (clash) keys[clash.id] = keys[b.id];
    keys[b.id] = key;
    updateSettings({ keys });
    stop();
  };

  const render = () => {
    const keys = store.settings.keys;
    const row = (x: (typeof BINDINGS)[number]) => {
      const btn = h('button', {
        class: 'keycap',
        'aria-label': `${x.label}: ${keyLabel(keys[x.id])}. Click to change`,
        onclick: () => {
          if (capturing) stop();
          capturing = { id: x.id, btn };
          btn.classList.add('capturing');
          btn.textContent = 'Press a key…';
          document.addEventListener('keydown', onKey, true);
        },
      }, keyLabel(keys[x.id]));
      return h('div', { class: 'keybind' }, h('span', null, x.label), btn);
    };
    wrap.replaceChildren(
      h('div', { class: 'setting keybind-head' },
        h('div', null, h('b', null, 'Tool keys'), h('small', null, 'Hold while clicking. Click a key to change it.')),
        h('button', { class: 'btn small ghost', onclick: () => updateSettings({ keys: { ...DEFAULT_KEYS } }) }, 'Reset')),
      h('div', { class: 'keybind-group' }, h('small', null, 'Puzzle'), ...BINDINGS.filter((b) => b.group === 'play').map(row)),
      h('div', { class: 'keybind-group' }, h('small', null, 'Level editor'), ...BINDINGS.filter((b) => b.group === 'editor').map(row)),
    );
  };
  render();
  const off = onSettingsChange(() => !capturing && render());
  // stop listening once the dialog is gone
  const obs = new MutationObserver(() => {
    if (!wrap.isConnected) {
      off();
      stop();
      obs.disconnect();
    }
  });
  requestAnimationFrame(() => obs.observe(document.body, { childList: true, subtree: true }));
  return wrap;
}
