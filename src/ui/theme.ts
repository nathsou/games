import { hexToRgb, type Vec3 } from '../render/math.ts';
import { renderStyle, type RenderStyle } from '../render/style.ts';

/**
 * Color themes. Each collection has its own vivid theme; the rest of the app uses "sunset".
 * A theme drives the page backdrop (CSS variables) and the 3D scene colors.
 */
export interface Theme {
  /** Backdrop gradient stops: light → saturated → deep. */
  bg: [string, string, string];
  /** UI accent (primary buttons, active tool). */
  accent: string;
  /** Painted ("keep") cubes. */
  paint: string;
  /** Unbroken, unpainted cubes. */
  cube: string;
  /** Clue numbers. */
  ink: string;
  plinth: string;
}

const NEUTRAL = { cube: '#f2efe8', ink: '#2b2d42', plinth: '#fbfaf7' };

/** Minimal rooms: near-white backdrops with a faint tint; color lives in the accents. */
export const THEMES: Record<string, Theme> = {
  sunset: { bg: ['#fdf9f5', '#fbf1ec', '#f3edf6'], accent: '#ff5e7e', paint: '#5b8def', ...NEUTRAL },
  'first-steps': { bg: ['#fffaf6', '#fff1ec', '#fde8e4'], accent: '#ff6b6b', paint: '#4f8cff', ...NEUTRAL },
  kitchen: { bg: ['#fffbf4', '#fff2e8', '#fbe9e2'], accent: '#e8384f', paint: '#12a594', ...NEUTRAL },
  garden: { bg: ['#f8fcf6', '#edf7ea', '#e2f1df'], accent: '#22a06b', paint: '#ff7a45', ...NEUTRAL },
  critters: { bg: ['#fffcf2', '#fff5de', '#fcedc9'], accent: '#f08c00', paint: '#7b61ff', ...NEUTRAL },
  toybox: { bg: ['#f9f9ff', '#f0efff', '#e7e5ff'], accent: '#6a4dff', paint: '#ff5c93', ...NEUTRAL },
  space: { bg: ['#f7f6fd', '#ecebfa', '#e0ddf5'], accent: '#7048e8', paint: '#15aabf', ...NEUTRAL },
  chess: { bg: ['#fbfaf6', '#f3f1e7', '#e8eadf'], accent: '#b7862a', paint: '#e0524a', ...NEUTRAL },
  architecture: { bg: ['#f8fbff', '#ebf4fd', '#deecf9'], accent: '#1c7ed6', paint: '#f08c00', ...NEUTRAL },
};

export function themeFor(collectionId?: string): string {
  return collectionId && THEMES[collectionId] ? collectionId : 'sunset';
}

/** Current 3D scene colors (read by the renderers every frame). */
export const sceneColors: { cube: Vec3; paint: Vec3; ink: Vec3; plinth: Vec3; accent: Vec3 } = {
  cube: hexToRgb(THEMES.sunset.cube),
  paint: hexToRgb(THEMES.sunset.paint),
  ink: hexToRgb(THEMES.sunset.ink),
  plinth: hexToRgb(THEMES.sunset.plinth),
  accent: hexToRgb(THEMES.sunset.accent),
};

// ------------------------------------------------------------------ design systems

export type DesignId = 'soft' | 'swiss' | 'bold' | 'paper';

export interface Design {
  id: DesignId;
  name: string;
  blurb: string;
  /** Color scheme the design needs ('auto' follows the Theme setting). */
  scheme: 'auto' | 'light' | 'dark';
  style: RenderStyle;
  /** Scene color overrides; functions receive the collection theme. */
  cube?: (t: Theme) => string;
  ink?: (t: Theme) => string;
  plinth?: (t: Theme) => string;
  edgeColor?: (t: Theme) => string;
}

const BASE_STYLE: RenderStyle = { bevel: 0.16, edge: 0.3, edgeColor: [0, 0, 0], edgeWidth: 0.022, flat: 0, ao: 1, spec: 1, shadow: 1, lines: 1 };

export const DESIGNS: Record<DesignId, Design> = {
  soft: { id: 'soft', name: 'Soft', blurb: 'Rounded, airy and calm', scheme: 'auto', style: BASE_STYLE },
  swiss: {
    id: 'swiss',
    name: 'Swiss',
    blurb: 'White, hairlines, square and precise',
    scheme: 'light',
    style: { ...BASE_STYLE, bevel: 0.006, edge: 0.9, edgeWidth: 0.012, flat: 0.92, ao: 0.25, spec: 0, shadow: 0.35, lines: 0.9 },
    cube: () => '#ffffff',
    ink: () => '#111111',
    plinth: () => '#ffffff',
    edgeColor: () => '#111111',
  },
  bold: {
    id: 'bold',
    name: 'Bold',
    blurb: 'Thick outlines, hard shadows, loud',
    scheme: 'light',
    style: { ...BASE_STYLE, bevel: 0.04, edge: 1, edgeWidth: 0.055, flat: 0.85, ao: 0.3, spec: 0, shadow: 0.7, lines: 1.8 },
    cube: () => '#ffffff',
    ink: () => '#111111',
    plinth: () => '#ffffff',
    edgeColor: () => '#111111',
  },
  paper: {
    id: 'paper',
    name: 'Paper',
    blurb: 'Ink drawings on cream paper',
    scheme: 'light',
    style: { ...BASE_STYLE, bevel: 0.05, edge: 0.8, edgeWidth: 0.03, flat: 0.8, ao: 0.45, spec: 0, shadow: 0.55, lines: 1.3 },
    cube: () => '#fbf6ea',
    ink: () => '#1f3a6b',
    plinth: () => '#fbf6ea',
    edgeColor: () => '#1f3a6b',
  },
};

let design: DesignId = 'soft';
export const currentDesign = (): Design => DESIGNS[design];

/** Switch design system: CSS tokens via [data-design], render style, scene colors. */
export function applyDesign(id: DesignId): void {
  design = DESIGNS[id as DesignId] ? id : 'soft';
  const d = DESIGNS[design];
  document.documentElement.setAttribute('data-design', design);
  Object.assign(renderStyle, d.style);
  const name = current;
  current = '';
  applyTheme(name || 'sunset');
}

let current = '';
const listeners = new Set<() => void>();
export const onThemeChange = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn));

export function applyTheme(name: string): void {
  if (name === current) return;
  current = name;
  const t = THEMES[name] ?? THEMES.sunset;
  const root = document.documentElement.style;
  root.setProperty('--room-a', t.bg[0]);
  root.setProperty('--room-b', t.bg[1]);
  root.setProperty('--room-c', t.bg[2]);
  root.setProperty('--accent', t.accent);
  root.setProperty('--paint', t.paint);
  const d = DESIGNS[design];
  sceneColors.cube = hexToRgb(d.cube?.(t) ?? t.cube);
  sceneColors.paint = hexToRgb(t.paint);
  sceneColors.ink = hexToRgb(d.ink?.(t) ?? t.ink);
  sceneColors.plinth = hexToRgb(d.plinth?.(t) ?? t.plinth);
  sceneColors.accent = hexToRgb(t.accent);
  renderStyle.edgeColor = hexToRgb(d.edgeColor?.(t) ?? '#000000');
  for (const l of listeners) l();
}
