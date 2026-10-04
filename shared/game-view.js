import {applyView} from './view-state.js';

export function isSharedFollower() {
  try {
    const session = parent !== window && parent.__friendSession;
    return Boolean(session?.screen?.active && !session.isHost);
  } catch { return false; }
}
export function installGameView(canvasRenderer = null) {
  const cache = new Map();
  // The guest never starts a game engine or writes the host's progress to its saves.
  let canvas = null;
  window.__sharedView = {
    get canvas() { return canvas; },
    apply(state) {
      applyView(document, state.view, cache);
      canvasRenderer?.apply(state.canvas, cache);
      canvas = state.canvas;
    },
  };
}
export async function installFollower(game) {
  let renderer;
  if (['cluance', 'spacegolf', 'pawn-quest'].includes(game)) {
    const module = await import(new URL('../' + game + '/src/friend-view.js', import.meta.url));
    renderer = await module.createFollower();
  }
  installGameView(renderer);
}
