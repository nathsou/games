import './styles.css';
import { App } from './app.ts';
import { decodePuzzle } from './core/codec.ts';
import type { Collection, PuzzleDef } from './core/types.ts';
import { randomSculpture, todayKey } from './data/daily.ts';
import { EditorScreen } from './editor/editor.ts';
import { onSettingsChange, store } from './game/storage.ts';
import { solverClient } from './solver/client.ts';
import { h, toast } from './ui/dom.ts';
import { CollectionScreen, CollectionsScreen, HomeScreen, MyPuzzlesScreen, type Nav } from './ui/menus.ts';
import { PlayScreen } from './ui/play.ts';
import { installTooltips } from './ui/tooltip.ts';
import { Tutorial } from './ui/tutorial.ts';

function applyTheme(): void {
  const t = store.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  document.documentElement.classList.toggle('reduce-motion', store.settings.reducedMotion);
}
applyTheme();
onSettingsChange(applyTheme);
installTooltips();

const canvas = h('canvas', { id: 'gl', 'aria-label': '3D puzzle view' });
const root = h('div', { id: 'ui' });
document.body.append(canvas, root);

let app: App;
try {
  app = new App(canvas, root);
} catch (e) {
  root.append(h('div', { class: 'fatal glass' }, h('h2', null, 'WebGL 2 unavailable'), h('p', null, 'Nonocube needs a browser with WebGL 2 support. ' + String((e as Error).message))));
  throw e;
}

const nav: Nav = {
  home: () => {
    history.replaceState(null, '', location.pathname);
    app.go(new HomeScreen(app, nav));
  },
  collections: () => app.go(new CollectionsScreen(app, nav)),
  collection: (c: Collection) => app.go(new CollectionScreen(app, nav, c)),
  play: (c: Collection, index: number) => {
    const puzzle = c.puzzles[index];
    app.go(
      new PlayScreen(app, {
        puzzle,
        mask: app.maskFor(puzzle),
        collection: c,
        index,
        saveKey: puzzle.id,
        onExit: () => nav.collection(c),
        onNext: index + 1 < c.puzzles.length ? () => nav.play(c, index + 1) : () => nav.collection(c),
      }),
    );
  },
  playCustom: (p: PuzzleDef, back: () => void, saveKey: string | null = null) => {
    app.go(new PlayScreen(app, { puzzle: p, mask: app.maskFor(p), saveKey, onExit: back, subtitle: saveKey === null && p.id === 'playtest' ? 'Playtest' : 'Custom puzzle' }));
  },
  daily: async () => {
    const key = todayKey();
    const t = setTimeout(() => toast('Sculpting today’s puzzle…'), 250);
    let chosen: PuzzleDef | null = null;
    for (let v = 0; v < 12 && !chosen; v++) {
      const p = randomSculpture(key, v);
      try {
        const res = await solverClient.generate(p.dims, p.cells, 'medium', p.id, 1500);
        if (res.analysis.status === 'unique') chosen = { ...p, mask: res.mask };
      } catch {
        break;
      }
    }
    clearTimeout(t);
    if (!chosen) {
      toast('Couldn’t make today’s puzzle — try again later.', 'bad');
      return;
    }
    const id = `daily-${key}`;
    app.go(new PlayScreen(app, { puzzle: { ...chosen, id }, mask: chosen.mask!, saveKey: id, subtitle: `Daily · ${key}`, onExit: () => nav.collections() }));
  },
  tutorial: () => new Tutorial(app, () => nav.collections()).start(),
  editor: (p?: PuzzleDef, userId?: string) => app.go(new EditorScreen(app, nav, p, userId)),
  myPuzzles: () => app.go(new MyPuzzlesScreen(app, nav)),
};

// Shared puzzle link: #p=<code>
function openFromHash(): boolean {
  const m = location.hash.match(/^#p=([A-Za-z0-9_-]+)/);
  if (!m) return false;
  try {
    const p = decodePuzzle(m[1], `shared-${m[1].slice(0, 24)}`);
    nav.playCustom(p, () => nav.home(), p.id);
    return true;
  } catch {
    toast('That puzzle link looks broken.', 'bad');
    return false;
  }
}
window.addEventListener('hashchange', () => openFromHash());
if (!openFromHash()) nav.home();

// Debug handle for development builds.
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__nono = { app, nav, store };
