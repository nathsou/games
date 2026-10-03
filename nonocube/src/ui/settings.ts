import type { App } from '../app.ts';
import { DEFAULT_KEYS, onSettingsChange, resetProgress, store, updateSettings, type KeyBindings, type Settings } from '../game/storage.ts';
import { keyLabel } from './toolkeys.ts';
import { DESIGNS, type DesignId } from './theme.ts';
import { h, icon, modal, toast } from './dom.ts';
import { I } from './icons.ts';

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

type Tab = 'look' | 'play' | 'controls' | 'feel' | 'data';
const TABS: { id: Tab; label: string; short?: string; icon: string }[] = [
  { id: 'look', label: 'Look', icon: I.sparkle },
  { id: 'play', label: 'Gameplay', icon: I.cube },
  { id: 'controls', label: 'Controls', icon: I.sliders },
  { id: 'feel', label: 'Sound & feel', short: 'Sound', icon: I.sound },
  { id: 'data', label: 'Data', icon: I.save },
];
let lastTab: Tab = 'look';
let launchTutorial: (() => void) | null = null;
/** Lets Settings offer "Replay the tutorial" (registered by main). */
export const setTutorialLauncher = (fn: () => void) => (launchTutorial = fn);

function pane(tab: Tab, close: () => void): HTMLElement {
  switch (tab) {
    case 'look':
      return h('div', null,
        looks(),
        segmented('Light or dark', 'Used by the Soft look; the others have their own.', 'theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]));
    case 'play':
      return h('div', null,
        segmented('Mistakes', 'Classic: 5 lives. Zen: no checks until the end.', 'mistakeMode', [['classic', 'Classic'], ['zen', 'Zen']]),
        toggle('Warn on wrong breaks', 'Zen: block breaking a shape cube, no penalty.', 'warnWrongBreaks'),
        toggle('Grey out finished rows', 'When a row matches its clue and is painted.', 'greyDone'),
        toggle('Show timer', '', 'showTimer'),
        toggle('Focus mode', 'Controls fade while you work (mouse).', 'autoHideHud'));
    case 'controls':
      return h('div', null,
        segmented('Spin momentum', 'Keeps turning after you let go.', 'momentum', [['off', 'Off'], ['light', 'Light'], ['strong', 'Strong']]),
        toggle('Left-handed layout', 'Mirror the tool dock.', 'lefty'),
        keyBindings());
    case 'feel':
      return h('div', null,
        toggle('Sound effects', '', 'sound'),
        toggle('Ambient music', 'Soft generative music while solving.', 'ambient'),
        toggle('Vibration', 'On supported phones.', 'haptics'),
        toggle('Reduce motion', 'Fewer particles, no auto-spin.', 'reducedMotion'));
    case 'data':
      return h('div', { class: 'settings-data' },
        h('div', { class: 'setting' },
          h('div', null, h('b', null, 'Tutorial'), h('small', null, 'Replay the three short lessons.')),
          h('button', { class: 'btn small', onclick: () => { close(); launchTutorial?.(); } }, 'Replay')),
        h('div', { class: 'setting' },
          h('div', null, h('b', null, 'Reset progress'), h('small', null, 'Erase stars, times and saved games. Your own puzzles are kept.')),
          h('button', {
            class: 'btn small danger',
            onclick: async () => {
              const r = await modal({ title: 'Reset all progress?', body: 'Stars, times and saved games will be erased. Your own puzzles are kept.', actions: [{ label: 'Cancel', value: 'no' }, { label: 'Erase', value: 'yes', cls: 'danger' }] });
              if (r === 'yes') {
                resetProgress();
                toast('Progress reset');
              }
            },
          }, 'Reset…')),
        h('p', { class: 'settings-foot' }, 'Nonocube · progress is saved in this browser.'));
  }
}

export async function openSettings(app: App): Promise<void> {
  void app;
  const content = h('div', { class: 'settings-pane' });
  const nav = h('nav', { class: 'settings-nav', role: 'tablist', 'aria-label': 'Settings sections' });
  let closeFn = () => {};
  const show = (tab: Tab) => {
    lastTab = tab;
    nav.querySelectorAll('button').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    content.replaceChildren(pane(tab, () => closeFn()));
    content.classList.remove('in');
    void content.offsetWidth;
    content.classList.add('in');
  };
  nav.append(...TABS.map((t) => h('button', { role: 'tab', 'data-tab': t.id, onclick: () => show(t.id) }, icon(t.icon), h('span', { class: 'tab-long' }, t.label), h('span', { class: 'tab-short' }, t.short ?? t.label))));
  show(lastTab);
  const body = h('div', { class: 'settings2' }, nav, content);
  const done = modal({ title: 'Settings', body, actions: [{ label: 'Done', value: 'ok', cls: 'primary' }], cls: 'settings-modal' });
  closeFn = () => (document.querySelector('.settings-modal .modal-actions .btn') as HTMLElement | null)?.click();
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

/** Visual picker for the design systems, each card previewed in its own look. */
function looks(): HTMLElement {
  const grid = h('div', { class: 'looks', role: 'radiogroup', 'aria-label': 'Look' });
  const render = () =>
    grid.replaceChildren(
      ...(Object.keys(DESIGNS) as DesignId[]).map((id) => {
        const d = DESIGNS[id];
        return h('button', {
          class: `look-card ${store.settings.design === id ? 'on' : ''}`,
          'data-design': id,
          role: 'radio',
          'aria-checked': String(store.settings.design === id),
          onclick: () => {
            updateSettings({ design: id });
            render();
          },
        },
          h('div', { class: 'pv' },
            h('span', { class: 'pv-cube' }, '3'),
            h('span', { class: 'pv-cube painted tall' }, '1'),
            h('span', { class: 'pv-cube' }, '0'),
            h('span', { class: 'pv-btn' }, 'Play')),
          h('div', null, h('b', null, d.name), h('small', null, d.blurb)));
      }),
    );
  render();
  return h('div', { class: 'setting-block' },
    h('div', { class: 'setting', style: 'border:none;padding:0 0 4px' }, h('div', null, h('b', null, 'Style'), h('small', null, 'Shift+L cycles them anywhere.'))),
    grid);
}
