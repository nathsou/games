import { startSky } from './sky.js';
import { save, persist, totalStars, resetProgress } from './save.js';
import { h, button, modal, toast, confetti, richEl } from './ui.js';
import { pixelText } from './font.js';
import { pieceSprite, spriteCanvas, PIECE_PALETTES } from './sprites.js';
import { PAWN, QUEEN, WHITE } from './chess.js';
import { sfx, playMusic, setSfx, setMusic, unlockAudio } from './audio.js';
import { levelById, LEVELS } from './curriculum.js';
import { levelScreen } from './level.js';
import { mapScreen, currentLevel } from './map.js';
import { BOARD_THEMES } from './board.js';
import { installThemeControls } from '../../shared/theme.js';

const app = document.getElementById('app');
startSky(document.getElementById('sky'));
setSfx(save.settings.sfx);
setMusic(save.settings.music);
addEventListener('pointerdown', unlockAudio, { once: true });
addEventListener('keydown', unlockAudio, { once: true });

let cleanup = null;
const go = hash => { if (location.hash === hash) route(); else location.hash = hash; };
const nav = {
  title: () => go('#/'),
  map: (w, celebrate) => { nav.celebrate = celebrate; go(w ? `#/map/${w}` : '#/map'); },
  level: (uid, force) => { if (force && location.hash === `#/level/${uid}`) route(); else go(`#/level/${uid}`); },
  arena: () => go('#/arena'),
  codex: id => go(id ? `#/codex/${id}` : '#/codex'),
  practice: () => go('#/practice'),
  ending: () => go('#/end'),
  settings: () => openSettings(),
};
window.pawnQuest = { nav, save };

async function route() {
  cleanup?.(); cleanup = null;
  document.querySelectorAll('.overlay').forEach(o => o.remove());
  const [, page, arg] = (location.hash || '#/').split('/');
  try {
    if (page === 'map') cleanup = mapScreen(app, nav, arg, nav.celebrate);
    else if (page === 'level' && levelById(arg)) cleanup = levelScreen(app, levelById(arg), nav);
    else if (page === 'arena') cleanup = (await import('./arena.js')).arenaScreen(app, nav);
    else if (page === 'codex') cleanup = (await import('./codex.js')).codexScreen(app, nav, arg);
    else if (page === 'practice') cleanup = (await import('./practice.js')).practiceScreen(app, nav, arg);
    else if (page === 'end') cleanup = endingScreen(app);
    else cleanup = titleScreen(app);
  } catch (e) { console.error(e); app.replaceChildren(h('pre', { style: { color: '#fff', padding: '20px' } }, String(e.stack || e))); }
  nav.celebrate = false;
}
addEventListener('hashchange', route);
route();

function titleScreen(app) {
  playMusic('map');
  const started = Object.keys(save.levels).length > 0;
  const cur = currentLevel();
  const hero = h('div', { class: 'title-hero', 'aria-hidden': 'true' },
    h('div', { class: 'hero-crown' }, spriteCanvas(pieceSprite(QUEEN, WHITE), 4)),
    h('div', { class: 'hero-shadow' }),
    h('div', { class: 'hero-pawn' }, spriteCanvas(pieceSprite(PAWN, WHITE), 6)));
  const foot = h('div', { class: 'title-foot' }, h('a', { href: '../' }, '← All games'), h('span', {}, `★ ${totalStars()} / ${LEVELS.length * 3}`));
  installThemeControls(foot);
  const root = h('div', { class: 'screen title-screen' },
    h('div', { class: 'title-logo' }, pixelText('PAWN QUEST', { scale: Math.min(10, Math.floor(innerWidth / 70)), color: '#ffd23f', shadow: '#b0480c', outline: '#1b1230' }), h('div', { class: 'title-tag' }, 'Learn chess from your very first move')),
    hero,
    h('div', { class: 'title-menu' },
      button(started ? `Continue · ${cur.title}` : 'Start the quest', () => started ? nav.map() : startQuest(), 'gold'),
      button('♟ Play chess (Arena)', () => nav.arena(), 'mint'),
      button('♞ Practice', () => nav.practice(), 'violet'),
      button('📖 Codex', () => nav.codex(), 'ghost'),
      button('⚙ Settings', () => openSettings(), 'ghost'),
    ),
    foot,
  );
  app.replaceChildren(root);
  return null;
}

function startQuest() {
  save.intro = true; persist();
  nav.level(LEVELS[0].uid);
}

export async function openSettings() {
  const row = (label, sub, key, onChange) => {
    const input = h('input', { type: 'checkbox' });
    input.checked = !!save.settings[key];
    input.onchange = () => { save.settings[key] = input.checked; persist(); onChange?.(input.checked); };
    return h('label', { class: 'toggle' }, input, h('span', {}, h('b', {}, label), h('small', {}, sub)));
  };
  const stars = totalStars();
  const themes = h('div', { class: 'theme-grid' });
  const paintThemes = () => {
    themes.replaceChildren(...Object.entries(BOARD_THEMES).map(([id, t]) => {
      const locked = stars < t.stars;
      const sw = h('div', { class: 'sw', style: { backgroundImage: `conic-gradient(${t.dark} 25%, ${t.light} 0 50%, ${t.dark} 0 75%, ${t.light} 0)` } });
      return h('button', { class: 'theme-swatch' + (save.settings.theme === id ? ' on' : ''), disabled: locked, onclick: () => { save.settings.theme = id; persist(); sfx.click(); paintThemes(); } }, sw, locked ? `🔒 ${t.stars}★` : t.name);
    }));
  };
  paintThemes();
  const body = h('div', { class: 'settings-list' },
    row('Sound effects', 'Clicks, captures and fanfares', 'sfx', v => setSfx(v)),
    row('Music', 'Chiptune tunes', 'music', v => setMusic(v)),
    row('Board coordinates', 'Show a–h and 1–8 around the board', 'coords'),
    h('div', { class: 'section-title' }, 'Board theme (earn stars to unlock)'),
    themes,
    h('div', {}, button('Reset all progress', async () => {
      const ok = await modal({ title: 'Reset progress?', body: 'This erases your stars, codex and practice records.', buttons: [{ label: 'Cancel', value: false, cls: 'ghost' }, { label: 'Reset', value: true, cls: 'coral' }] });
      if (ok) { resetProgress(); toast('Progress reset.'); nav.title(); }
    }, 'small coral')),
  );
  await modal({ title: 'Settings', body, buttons: [{ label: 'Done', value: true }] });
  if (location.hash.startsWith('#/level') || location.hash.startsWith('#/arena')) {} else route();
}

function endingScreen(app) {
  playMusic('map');
  const queen = h('div', { class: 'title-hero' }, h('div', { class: 'hero-shadow' }), h('div', { class: 'hero-pawn' }, spriteCanvas(pieceSprite(PAWN, WHITE), 6)));
  const root = h('div', { class: 'screen ending' },
    pixelText('PROMOTION!', { scale: Math.min(9, Math.floor(innerWidth / 80)) }),
    queen,
    richEl('p', 'Hoo-hoo! You crossed all eight ranks, little pawn. You learned how every piece moves, how to keep your pieces safe, how to spot forks, pins and skewers, and how to checkmate. You\'ve earned your crown: **you are a chess player now!**'),
    richEl('p', 'Keep growing in the **Arena** (try beating me, Professor Pip!), sharpen your eye in **Practice**, and review anything in your **Codex**.'),
    h('div', { class: 'title-menu' }, button('♟ Arena', () => nav.arena(), 'gold'), button('Back to the map', () => nav.map(), 'ghost')),
  );
  app.replaceChildren(root);
  // Pawn becomes a queen.
  setTimeout(() => {
    const p = queen.querySelector('.hero-pawn');
    if (!p) return;
    sfx.promote(); confetti(200);
    p.replaceChildren(spriteCanvas(pieceSprite(QUEEN, WHITE), 6));
  }, 1400);
  return null;
}

export { nav };
void PIECE_PALETTES;
