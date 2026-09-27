import type { MistakeMode, SavedProgress } from './session.ts';

export interface Settings {
  mistakeMode: MistakeMode;
  fadeDone: boolean;
  showTimer: boolean;
  sound: boolean;
  haptics: boolean;
  lefty: boolean;
  reducedMotion: boolean;
  theme: 'auto' | 'light' | 'dark';
}

export interface PuzzleRecord {
  stars: number;
  bestTime: number;
}

export interface UserPuzzle {
  id: string;
  code: string;
  updated: number;
}

interface Store {
  settings: Settings;
  records: Record<string, PuzzleRecord>;
  progress: Record<string, SavedProgress>;
  masks: Record<string, string>;
  user: UserPuzzle[];
  tutorialDone: boolean;
  welcomed: boolean;
  editorDraft?: string;
}

const KEY = 'nonocube:v1';

const defaults = (): Store => ({
  settings: {
    mistakeMode: 'classic',
    fadeDone: true,
    showTimer: true,
    sound: true,
    haptics: true,
    lefty: false,
    reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    theme: 'auto',
  },
  records: {},
  progress: {},
  masks: {},
  user: [],
  tutorialDone: false,
  welcomed: false,
});

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const d = defaults();
    const s = JSON.parse(raw) as Partial<Store>;
    return { ...d, ...s, settings: { ...d.settings, ...(s.settings ?? {}) } };
  } catch {
    return defaults();
  }
}

export const store: Store = load();

let saveTimer = 0;
export function save(immediate = false): void {
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      /* storage full or unavailable: progress simply won't persist */
    }
  };
  clearTimeout(saveTimer);
  if (immediate) write();
  else saveTimer = window.setTimeout(write, 300);
}

type Listener = () => void;
const listeners = new Set<Listener>();
export function onSettingsChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function updateSettings(patch: Partial<Settings>): void {
  Object.assign(store.settings, patch);
  save();
  for (const l of listeners) l();
}

export function recordSolve(id: string, stars: number, time: number): { newBest: boolean } {
  const prev = store.records[id];
  const newBest = !prev || time < prev.bestTime;
  store.records[id] = {
    stars: Math.max(prev?.stars ?? 0, stars),
    bestTime: prev ? Math.min(prev.bestTime, time) : time,
  };
  delete store.progress[id];
  save();
  return { newBest };
}

export function resetProgress(): void {
  store.records = {};
  store.progress = {};
  store.masks = {};
  store.tutorialDone = false;
  save(true);
}

export function maskToString(m: Uint8Array): string {
  return Array.from(m).join('');
}
export function maskFromString(s: string, len: number): Uint8Array | null {
  if (s.length !== len) return null;
  return Uint8Array.from(s, (c) => (c === '1' ? 1 : 0));
}
