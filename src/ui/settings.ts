import type { App } from '../app.ts';
import { resetProgress, store, updateSettings, type Settings } from '../game/storage.ts';
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
    segmented('Mistakes', 'Classic: breaking a shape cube costs a strike (5 max). Zen: no checks until the end.', 'mistakeMode', [['classic', 'Classic'], ['zen', 'Zen']]),
    toggle('Fade finished rows', 'Dim clues once a row has no more cubes to break.', 'fadeDone'),
    toggle('Show timer', '', 'showTimer'),
    toggle('Sound effects', '', 'sound'),
    toggle('Vibration', 'On supported touch devices.', 'haptics'),
    toggle('Left-handed layout', 'Mirror the tool dock.', 'lefty'),
    segmented('Spin momentum', 'How much the block keeps turning after you let go.', 'momentum', [['off', 'Off'], ['light', 'Light'], ['strong', 'Strong']]),
    toggle('Reduce motion', 'Fewer particles and no auto-spin.', 'reducedMotion'),
    segmented('Theme', '', 'theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]),
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
