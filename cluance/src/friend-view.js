import {viewNodeID} from '../../shared/view-state.js';
import {drawArt} from './art.js';
import {CARDS} from './decks.js';

export function installHostView() {
  window.__sharedCanvas = {snapshot: () => [...document.querySelectorAll('canvas')].filter(c => c.__friendCard).map(c => ({id: viewNodeID(c), card: c.__friendCard}))};
}
export async function createFollower() {
  const painted = new WeakMap();
  return {apply(cards, nodes) {
    for (const {id, card} of cards || []) {
      const canvas = nodes.get(id);
      if (!canvas || canvas.localName !== 'canvas' || !Object.hasOwn(CARDS, card)) throw new Error('Invalid Cluance card view.');
      if (painted.get(canvas) === card) continue;
      drawArt(canvas, card);
      painted.set(canvas, card);
    }
  }};
}
