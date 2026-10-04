import { hexToRgb, type Vec3 } from '../render/math.ts';
import { renderStyle } from '../render/style.ts';

/** One Mono palette drives both the DOM and WebGL scene. */
export const THEMES = {
  light: { bg: '#ffffff', ink: '#000000', muted: '#5c5c5c', soft: '#e6e6e6', cube: '#ffffff', paint: '#000000', plinth: '#ededed' },
  dark: { bg: '#000000', ink: '#ffffff', muted: '#a3a3a3', soft: '#262626', cube: '#2a2a2a', paint: '#ffffff', plinth: '#1a1a1a' },
};
export const sceneColors: { cube: Vec3; paint: Vec3; ink: Vec3; plinth: Vec3; accent: Vec3; wash: Vec3; washAmt: number } = {
  cube: [1, 1, 1], paint: [0, 0, 0], ink: [0, 0, 0], plinth: hexToRgb('#ededed'), accent: [0, 0, 0], wash: hexToRgb('#e6e6e6'), washAmt: 0.35,
};
const listeners = new Set<() => void>();
export const onThemeChange = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn));
export const themeFor = (_collectionId?: string): string => 'mono';

export function applyTheme(_name = 'mono'): void {
  const dark = document.documentElement.dataset.theme === 'dark';
  const t = THEMES[dark ? 'dark' : 'light'];
  const root = document.documentElement.style;
  for (const [key, value] of Object.entries({ bg: t.bg, ink: t.ink, 'ink-2': t.muted, 'ink-3': t.muted, accent: t.ink, paint: t.paint, 'accent-ink': t.bg, 'accent-soft': t.soft, plinth: t.plinth })) root.setProperty(`--${key}`, value);
  for (const key of ['cube', 'paint', 'ink', 'plinth'] as const) sceneColors[key] = hexToRgb(t[key]);
  sceneColors.accent = sceneColors.ink;
  sceneColors.wash = hexToRgb(t.soft);
  Object.assign(renderStyle, { bevel: 0.04, edge: 1, edgeColor: sceneColors.ink, edgeWidth: 0.05, flat: 0.85, ao: 0.3, spec: 0, shadow: 0.5, lines: 1, hoverColor: sceneColors.ink, hoverWidth: 0.08 });
  for (const fn of listeners) fn();
}

/** Museum pieces use neutral tones by height, while editor data keeps its palette. */
export function layerColor(y: number, height: number): Vec3 {
  const tones = document.documentElement.dataset.theme === 'dark' ? ['#ffffff', '#b3b3b3', '#707070', '#3d3d3d'] : ['#000000', '#4d4d4d', '#8c8c8c', '#c9c9c9'];
  return hexToRgb(tones[Math.min(3, Math.floor(y * 4 / Math.max(1, height)))]);
}
