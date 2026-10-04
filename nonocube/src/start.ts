import {registerCheckpoint} from '../../shared/game-checkpoint.js';
import {allCollections} from './data/collections.ts';
import {installHostView} from './friend-view.ts';
import { App } from './app.ts';
import { encodePuzzle, decodePuzzle } from './core/codec.ts';
import type { Collection, PuzzleDef } from './core/types.ts';
import { randomSculpture, todayKey } from './data/daily.ts';
import { EditorScreen } from './editor/editor.ts';
import { onSettingsChange, store } from './game/storage.ts';
import { solverClient } from './solver/client.ts';
import { h, toast } from './ui/dom.ts';
import { GalleryScreen } from './ui/gallery.ts';
import { CollectionsScreen, HomeScreen, MyPuzzlesScreen, type Nav } from './ui/menus.ts';
import { PlayScreen } from './ui/play.ts';
import { installTooltips } from './ui/tooltip.ts';
import { setTutorialLauncher } from './ui/settings.ts';
import { applyTheme } from './ui/theme.ts';
import { Tutorial } from './ui/tutorial.ts';

const systemAppearance = matchMedia('(prefers-color-scheme: dark)');
function syncAppearance(): void {
  document.documentElement.dataset.theme = store.settings.theme === 'auto' ? (systemAppearance.matches ? 'dark' : 'light') : store.settings.theme;
  applyTheme();
  document.documentElement.classList.toggle('reduce-motion', store.settings.reducedMotion);
}
syncAppearance();
onSettingsChange(syncAppearance);
systemAppearance.addEventListener('change', syncAppearance);
// Load the local font before constructing the WebGL clue atlas.
await document.fonts.load('800 18px Manrope');

installTooltips();
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement | null)?.closest?.('button');
  if (b && e.detail > 0 && document.activeElement === b) b.blur();
});

const canvas = h('canvas', { id: 'gl', 'aria-label': '3D puzzle view' });
const root = h('div', { id: 'ui' });
document.body.append(canvas, root);

let app: App;
try {
  app = new App(canvas, root);
  installHostView(app);
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
  collection: (c: Collection, focus?: number) => app.go(new GalleryScreen(app, nav, c, focus)),
  play: (c: Collection, index: number) => {
    const puzzle = c.puzzles[index];
    app.go(
      new PlayScreen(app, {
        puzzle,
        mask: app.maskFor(puzzle),
        collection: c,
        index,
        saveKey: puzzle.id,
        onExit: () => nav.collection(c, index),
        onNext: index + 1 < c.puzzles.length ? () => nav.play(c, index + 1) : () => nav.collection(c, index),
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
setTutorialLauncher(() => nav.tutorial());
window.addEventListener('hashchange', () => openFromHash());
if (!openFromHash()) nav.home();

// Debug handle for development builds.
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__nono = { app, nav, store };

registerCheckpoint('nonocube',{
  capture(){
    const screen=app.screen;
    if(!(screen instanceof PlayScreen)||screen.opts.hooks||screen.opts.saveKey===null)return null;
    return {id:screen.opts.puzzle.id,code:encodePuzzle({...screen.opts.puzzle,mask:screen.opts.mask}),saveKey:screen.opts.saveKey,subtitle:screen.opts.subtitle,progress:screen.session.serialize()};
  },
  restore(data){
    if(!data||typeof data.code!=='string'||typeof data.id!=='string')throw Error('Invalid saved puzzle.');
    const puzzle=decodePuzzle(data.code,data.id),size=puzzle.cells.length,progress=data.progress;
    if(!progress||typeof progress.state!=='string'||progress.state.length!==size||!/^[0-3]*$/.test(progress.state)||![progress.strikes,progress.hints,progress.elapsed].every(v=>Number.isFinite(v)&&v>=0))throw Error('Invalid saved puzzle progress.');
    const collection=allCollections.find(c=>c.puzzles.some(p=>p.id===data.id));
    if(collection)nav.play(collection,collection.puzzles.findIndex(p=>p.id===data.id));
    else app.go(new PlayScreen(app,{puzzle,mask:puzzle.mask!,saveKey:data.saveKey,subtitle:data.subtitle,onExit:()=>nav.collections()}));
    const screen=app.screen;
    if(screen instanceof PlayScreen){screen.session.restore(progress);screen.refreshHud();}
  },
});
