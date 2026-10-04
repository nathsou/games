import type { MistakeMode, SavedProgress } from './session.ts';

export interface Settings {
  mistakeMode: MistakeMode;
  showTimer: boolean;
  sound: boolean;
  haptics: boolean;
  lefty: boolean;
  reducedMotion: boolean;
  theme: 'auto' | 'light' | 'dark';
  momentum: 'off' | 'light' | 'strong';
  /** Grey out rows whose clue is satisfied (Picross 3D Round 2 style). */
  greyDone: boolean;
  /** Mouse: fade the HUD while working on the block. */
  autoHideHud: boolean;
  ambient: boolean;
  /** Zen mode: warn instead of breaking a cube of the shape. */
  warnWrongBreaks: boolean;
  keys: KeyBindings;
}

/** Hold-to-use tool keys (lowercase `KeyboardEvent.key` values). */
export interface KeyBindings {
  break: string;
  paint: string;
  add: string;
  remove: string;
  edPaint: string;
  pick: string;
}

export const DEFAULT_KEYS: KeyBindings = { break: 'a', paint: 'd', add: 'w', remove: 'a', edPaint: 'd', pick: 's' };

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
  tips: string[];
}

const KEY = 'nonocube:v1';

const defaults = (): Store => ({
  settings: {
    mistakeMode: 'classic',
    showTimer: true,
    sound: true,
    haptics: true,
    lefty: false,
    reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    theme: 'auto',
    momentum: 'light',
    greyDone: true,
    autoHideHud: false,
    ambient: false,
    warnWrongBreaks: false,
    keys: { ...DEFAULT_KEYS },
  },
  records: {},
  progress: {},
  masks: {},
  user: [],
  tutorialDone: false,
  welcomed: false,
  tips: [],
});

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const d = defaults();
    const s = JSON.parse(raw) as Partial<Store>;
    const settings = { ...d.settings, ...(s.settings ?? {}) };
    settings.keys = { ...DEFAULT_KEYS, ...(s.settings?.keys ?? {}) };
    return { ...d, ...s, settings };
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

/** Returns true the first time a one-off tip is requested. */
export function firstTime(tip: string): boolean {
  if (store.tips.includes(tip)) return false;
  store.tips.push(tip);
  save();
  return true;
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
