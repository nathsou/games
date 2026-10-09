import {store} from './game/storage.ts';
import {installGameView} from '../../shared/game-view.js';
import {viewNodeID} from '../../shared/view-state.js';
import type {App} from './app.ts';
import {OrbitCamera} from './render/camera.ts';
import {Renderer, type DrawList} from './render/renderer.ts';
import type {BlockScene} from './render/scene.ts';
import {renderStyle, type RenderStyle} from './render/style.ts';

interface CanvasView {
  id: number;
  matrix: Float32Array;
  up: [number, number, number];
  list: DrawList;
  style: RenderStyle;
}
function blockView(scene: BlockScene): BlockScene {
  // Only visible cubes and their clues go to the other browser; no solution, grid or save data.
  return {dims: scene.dims, count: scene.count, glyphAlpha: scene.glyphAlpha,
    inst: scene.inst.subarray(0, scene.count * 7), glyph: scene.glyph.subarray(0, scene.count),
    ao: scene.ao.subarray(0, scene.count * 2)} as BlockScene;
}
function drawView(list: DrawList): DrawList {
  return {...list,
    block: list.block && blockView(list.block),
    placed: list.placed?.map(item => ({...item, scene: blockView(item.scene)})),
  };
}
export function installHostView(app: App): void {
  (window as unknown as {__sharedCanvas: {snapshot(): CanvasView}}).__sharedCanvas = {snapshot: () => ({
    id: viewNodeID(app.canvas), matrix: app.camera.viewProj, up: app.camera.up,
    list: drawView(app.sharedView), style: renderStyle,
  })};
}
export async function installFollower(): Promise<void> {
  await document.fonts.load('800 18px Manrope');
  let renderer: Renderer | null = null;
  const camera = new OrbitCamera();
  installGameView({apply(state: unknown, nodes: Map<number, Node>) {
    if (!state) return;
    const view = state as CanvasView;
    const canvas = nodes.get(view.id);
    if (!(canvas instanceof HTMLCanvasElement) || !ArrayBuffer.isView(view.matrix) || view.matrix.length !== 16 || !view.up?.every(Number.isFinite)) throw new Error('Invalid Nonocube view.');
    if (!renderer || renderer.canvas !== canvas) renderer = new Renderer(canvas);
    renderer.pixelDensity = store.settings.pixelDensity;
    renderer.antialias = store.settings.antialias;
    renderer.resize();
    camera.viewProj.set(view.matrix); camera.up = view.up;
    for (const key of Object.keys(renderStyle) as (keyof RenderStyle)[]) {
      // Fixed rendering fields; a packet cannot add methods or arbitrary properties.
      Object.assign(renderStyle, {[key]: view.style[key]});
    }
    renderer.render(camera, view.list);
  }});
}
