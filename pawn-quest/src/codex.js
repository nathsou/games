// The Codex: every rule, idea and character you've met, with a looping demo board.
import { CODEX, CODEX_CATS } from './codex-data.js';
import { save, persist } from './save.js';
import { h, button, richEl } from './ui.js';
import { BoardView } from './board.js';
import { makePosition, FREE_RULES } from './levelkit.js';
import { attackMap } from './coach.js';
import { BLACK, LETTERS, WHITE, sqParse, mFrom, colorOf } from './chess.js';
import { pieceSprite, characterSprite, spriteCanvas } from './sprites.js';
import { playMusic } from './audio.js';

const wait = ms => new Promise(r => setTimeout(r, ms));

export function codexIcon(entry) {
  if (entry.icon?.startsWith('char:')) return spriteCanvas(characterSprite(entry.icon.slice(5)), 2);
  const t = LETTERS.indexOf(entry.icon);
  if (entry.icon?.length === 1 && t > 0) return spriteCanvas(pieceSprite(t, WHITE), 2);
  return h('span', {}, { x: '✕', board: '▦' }[entry.icon] || entry.icon || '•');
}

export function codexScreen(app, nav, openId) {
  playMusic('calm');
  const unlocked = id => !!save.codex[id];
  const count = Object.keys(CODEX).filter(unlocked).length, total = Object.keys(CODEX).length;
  const header = h('header', { class: 'hud' },
    button('◀ Back', () => history.length > 1 ? history.back() : nav.title(), 'small ghost back'),
    h('div', { class: 'hud-title' }, h('span', { class: 'hud-sub' }, `${count} / ${total} pages`), h('span', { class: 'hud-main' }, 'Codex')),
    h('div', { class: 'hud-right' }, button('Map', () => nav.map(), 'small ghost')));
  const list = h('nav', { class: 'codex-list', 'aria-label': 'Codex entries' },
    h('div', { class: 'progress-bar', title: `${count}/${total}` }, h('div', { style: { width: (count / total * 100) + '%' } })));
  const page = h('article', { class: 'codex-page' });
  app.replaceChildren(h('div', { class: 'screen' }, header, h('div', { class: 'codex' }, list, page)));
  let demo = null, demoToken = 0;
  const items = {};
  for (const cat of CODEX_CATS) {
    const ids = Object.keys(CODEX).filter(id => CODEX[id].cat === cat);
    if (!ids.length) continue;
    list.append(h('div', { class: 'codex-cat' }, cat));
    for (const id of ids) {
      const e = CODEX[id], ok = unlocked(id);
      const btn = h('button', { class: `codex-item ${ok ? '' : 'locked'} ${save.newCodex.includes(id) ? 'new' : ''}`, onclick: () => ok && show(id) },
        h('span', { class: 'codex-icon' }, ok ? codexIcon(e) : '?'), ok ? e.title : '???');
      items[id] = btn;
      list.append(btn);
    }
  }

  function show(id) {
    const e = CODEX[id];
    for (const [k, b] of Object.entries(items)) b.classList.toggle('on', k === id);
    if (save.newCodex.includes(id)) { save.newCodex = save.newCodex.filter(x => x !== id); persist(); items[id].classList.remove('new'); }
    demo?.destroy(); demo = null;
    const text = h('div', { class: 'codex-text' }, h('h1', {}, e.title), richEl('div', e.text));
    page.replaceChildren(text);
    if (e.demo) {
      const box = h('div', { class: 'codex-demo' });
      page.append(box);
      demo = new BoardView(box, { theme: save.settings.theme });
      runDemo(demo, e.demo, ++demoToken);
    } else if (e.icon?.startsWith('char:')) {
      page.append(h('div', { class: 'portrait', style: { width: '160px', height: '160px' } }, spriteCanvas(characterSprite(e.icon.slice(5)), 8)));
    }
    history.replaceState(null, '', `#/codex/${id}`);
  }

  async function runDemo(board, d, tok) {
    while (tok === demoToken && board.canvas.isConnected) {
      const rules = d.fen || d.turn ? { variant: 'standard' } : FREE_RULES;
      const pos = makePosition({ fen: d.fen, setup: d.setup, turn: d.turn }, rules);
      board.setPosition(pos);
      board.clearAnnotations();
      board.threat = d.danger ? attackMap(pos, BLACK) : null;
      for (const [sq, k] of Object.entries(d.marks || {})) board.marks.set(sqParse(sq), k);
      board.arrows = (d.arrows || []).map(([a, b, c]) => ({ from: sqParse(a), to: sqParse(b), color: c || 'info' }));
      if (d.legal) { const from = sqParse(d.legal); pos.turn = colorOf(pos.b[from]); board.legalFor = sq => sq === from ? pos.gen([]).filter(m => mFrom(m) === from) : []; board.selected = from; }
      board.lastMove = null;
      if (!d.moves?.length) return;
      await wait(1200);
      for (const u of d.moves) {
        if (tok !== demoToken) return;
        const m = pos.moveFromUci(u) || (() => { pos.turn ^= 1; return pos.moveFromUci(u); })();
        if (!m) break;
        board.arrows = [];
        await board.animateMove(m);
        pos.make(m);
        board.lastMove = [m & 127, (m >> 7) & 127];
        await wait(700);
      }
      await wait(1800);
    }
  }

  const first = openId && unlocked(openId) ? openId : Object.keys(CODEX).find(unlocked);
  if (first) show(first);
  else page.append(h('div', { class: 'codex-text' }, h('h1', {}, 'Your Codex is empty'), richEl('p', 'Every level you finish adds pages to your Codex: rules, ideas, tactics and the characters you meet. Start the quest to fill it!')));
  return () => { demoToken++; demo?.destroy(); };
}
