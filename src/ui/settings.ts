import type { App } from '../app.ts';
import { DEFAULT_KEYS, onSettingsChange, resetProgress, store, updateSettings, type KeyBindings, type Settings } from '../game/storage.ts';
import { keyLabel } from './toolkeys.ts';
import { DESIGNS, type DesignId } from './theme.ts';
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

export async function openSettings(app: App): Promise<void> {
  void app;
  const body = h('div', { class: 'settings' },
    looks(),
    segmented('Mistakes', 'Classic: breaking a shape cube costs a strike (5 max). Zen: no checks until the end.', 'mistakeMode', [['classic', 'Classic'], ['zen', 'Zen']]),
    toggle('Warn on wrong breaks', 'Zen mode: stop and warn instead of breaking a cube that belongs to the shape (no penalty). Classic mode always does this, and counts a mistake.', 'warnWrongBreaks'),
    toggle('Grey out finished rows', 'Once a row’s remaining cubes match its clue and are all painted, grey it out.', 'greyDone'),
    toggle('Show timer', '', 'showTimer'),
    toggle('Sound effects', '', 'sound'),
    toggle('Ambient music', 'A soft generative soundscape while you solve.', 'ambient'),
    toggle('Focus mode', 'With a mouse, the controls fade while you work on the block and return near the screen edges.', 'autoHideHud'),
    toggle('Vibration', 'On supported touch devices.', 'haptics'),
    toggle('Left-handed layout', 'Mirror the tool dock.', 'lefty'),
    segmented('Spin momentum', 'How much the block keeps turning after you let go.', 'momentum', [['off', 'Off'], ['light', 'Light'], ['strong', 'Strong']]),
    toggle('Reduce motion', 'Fewer particles and no auto-spin.', 'reducedMotion'),
    segmented('Theme', 'Light or dark (the Soft look only; other looks have their own).', 'theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]),
    keyBindings(),
    h('button', {
      class: 'btn danger small',
      onclick: async () => {
        const r = await modal({ title: 'Reset all progress?', body: 'Stars, times and saved games will be erased. Your own puzzles are kept.', actions: [{ label: 'Cancel', value: 'no' }, { label: 'Erase', value: 'yes', cls: 'danger' }] });
        if (r === 'yes') {
          resetProgress();
          toast('Progress reset');
        }
      },
    }, 'Reset progress…'),
  );
  await modal({ title: 'Settings', body, actions: [{ label: 'Done', value: 'ok', cls: 'primary' }], cls: 'wide' });
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
        h('div', null, h('b', null, 'Controls'), h('small', null, 'Hold these keys while clicking to use a tool. Click a key to change it.')),
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
    h('div', { class: 'setting', style: 'border:none;padding-bottom:0' }, h('div', null, h('b', null, 'Look'), h('small', null, 'Try a design system — Shift+L cycles them anywhere.'))),
    grid);
}
