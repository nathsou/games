import {App} from './app.js';
import {TitleScene} from './scenes/title.js';
import {CampaignScene} from './scenes/campaign.js';
import {EndlessScene, GeneratingScene} from './scenes/endless.js';
import {CreateScene} from './scenes/create.js';
import {EditorScene} from './scenes/editor.js';
import {SettingsScene} from './scenes/settings.js';
import {GameScene} from './scenes/game.js';
import {createWorld} from './physics.js';
import {viewNodeID} from '../../shared/view-state.js';

const scenes = {TitleScene, CampaignScene, EndlessScene, GeneratingScene, CreateScene, EditorScene, SettingsScene, GameScene};
const noop = () => {};
function sceneState(scene) {
  return JSON.parse(JSON.stringify(scene, (key, value) => {
    if (['app', 'run', 'promise', 'previewCache'].includes(key) || key === 'world' && typeof value === 'object') return undefined;
    if (typeof value === 'function') return {$callback: true};
    if (key === 'history') return value.map(() => null); // Rendering needs only the undo count.
    return value;
  }));
}
function callbacks(value) {
  if (value?.$callback === true) return noop;
  if (Array.isArray(value)) return value.map(callbacks);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, callbacks(item)]));
  return value;
}
export function installHostView(app) {
  window.__sharedCanvas = {snapshot: () => ({
    id: viewNodeID(app.canvas), scene: app.scene.constructor.name, state: sceneState(app.scene),
    store: app.store.data, time: app.time, fade: app.fade, par: app.par || null,
    pointer: {x: app.ui.ptr.x, y: app.ui.ptr.y}, toasts: app.ui.toasts,
  })};
}
export function createFollower() {
  let app;
  return {apply(state, nodes) {
    if (!state) return;
    const canvas = nodes.get(state.id), Scene = scenes[state.scene];
    if (!canvas || canvas.localName !== 'canvas' || !Scene) throw new Error('Invalid Spacegolf view.');
    if (!app || app.canvas !== canvas) {
      app = new App(canvas);
      app.sound.enabled = false;
      app.store.save = noop;
      app.go = noop;
    }
    const scene = Object.assign(Object.create(Scene.prototype), callbacks(state.state), {app});
    if (scene.level) scene.world = createWorld(scene.level);
    if (Scene === GameScene) { scene.handleInput = scene.update = noop; }
    if (Scene === GeneratingScene) scene.done = false; // Generation and navigation happen only on the host.
    app.scene = scene;
    app.store.data = state.store;
    app.time = state.time; app.fade = state.fade; app.par = state.par;
    Object.assign(app.ui.ptr, state.pointer);
    app.ui.toasts = state.toasts;
    app.frame(0, 0);
  }};
}
