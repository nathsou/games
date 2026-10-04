import {pixelText} from './font.js';
import {pieceSprite, owlSprite, starSprite, characterSprite, spriteCanvas} from './sprites.js';
import {drawBiome} from './map.js';
import {startSky} from './sky.js';
import {BoardView} from './board.js';
import {Position} from './chess.js';
import {viewNodeID} from '../../shared/view-state.js';

const fields = ['flipped', 'themeId', 'setOverride', 'coords', 'interactive', 'movable', 'selected', 'hover', 'cursor',
  'lastMove', 'threat', 'arrows', 'hanging', 'opportunities', 'dim', 'showLegal', 'hoverChip', 'drag'];
export function boardSnapshot(board) {
  return {id: viewNodeID(board.canvas), fen: board.pos.toFEN(), rules: board.pos.rules,
    fields: Object.fromEntries(fields.map(key => [key, board[key]])),
    marks: [...board.marks], highlights: [...board.highlights],
    targets: board.selected >= 0 ? board.targets(board.selected) : [],
  };
}
export function createFollower() {
  const boards = new Map(), drawings = new WeakMap();
  return {apply(states, nodes) {
    const live = new Set();
    for (const state of states?.boards || []) {
      const canvas = nodes.get(state.id);
      if (!canvas || canvas.localName !== 'canvas' || typeof state.fen !== 'string' || state.fen.length > 200) throw new Error('Invalid chess board view.');
      live.add(state.id);
      let board = boards.get(state.id);
      if (!board) {
        board = new BoardView(canvas.parentElement);
        canvas.replaceWith(board.canvas);
        nodes.set(state.id, board.canvas);
        boards.set(state.id, board);
      }
      board.setPosition(Position.fromFEN(state.fen, state.rules));
      for (const key of fields) if (Object.hasOwn(state.fields, key)) board[key] = state.fields[key];
      board.marks = new Map(state.marks); board.highlights = new Map(state.highlights);
      board.legalFor = () => state.targets;
      board.resize();
    }
    for (const {id, draw} of states?.decorations || []) {
      const canvas = nodes.get(id);
      if (!canvas || canvas.localName !== 'canvas') throw new Error('Invalid chess decoration.');
      const signature = JSON.stringify(draw);
      if (drawings.get(canvas) === signature) continue;
      drawings.set(canvas, signature);
      if (draw.type === 'sky') { startSky(canvas); continue; }
      if (draw.type === 'biome') { drawBiome(canvas, draw.cssW, draw.height, draw.world, draw.pts); continue; }
      let rendered;
      if (draw.type === 'text') rendered = pixelText(draw.text, draw.options);
      if (draw.type === 'sprite' && draw.sprite) {
        const factory = {pieceSprite, owlSprite, starSprite, characterSprite}[draw.sprite.type];
        if (factory) rendered = spriteCanvas(factory(...draw.sprite.args), draw.scale, draw.className);
      }
      if (rendered) {
        canvas.width = rendered.width; canvas.height = rendered.height;
        canvas.getContext('2d').drawImage(rendered, 0, 0);
      }
    }
    for (const [id, board] of boards) if (!live.has(id)) { board.destroy(); boards.delete(id); }
  }};
}
