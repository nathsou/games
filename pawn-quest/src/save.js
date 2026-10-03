// Progress and settings, kept in localStorage.
const KEY = 'pawn-quest:v1';

const defaults = () => ({
  levels: {},          // id -> { stars, best, done }
  codex: {},           // id -> true when unlocked
  newCodex: [],        // freshly unlocked entries (shows a badge)
  intro: false,
  settings: { sfx: true, music: true, theme: 'meadow', speed: 1, coords: true },
  arena: { played: 0, wins: 0, draws: 0, byBot: {}, options: { advice: true, warnings: true, threats: false, takebacks: true, color: 'w', bot: 'hangs' }, saved: null },
  gym: [],             // mistakes from your own games: { fen, best, san, text, date }
  practice: { rush: 0, daily: {}, drills: {} },
  stats: { movesPlayed: 0, puzzlesSolved: 0 },
});

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw) return defaults();
    const d = defaults();
    return { ...d, ...raw, settings: { ...d.settings, ...raw.settings }, arena: { ...d.arena, ...raw.arena, options: { ...d.arena.options, ...(raw.arena?.options || {}) } }, practice: { ...d.practice, ...raw.practice }, stats: { ...d.stats, ...raw.stats } };
  } catch { return defaults(); }
}

export const save = load();

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {}
}

export function resetProgress() {
  const fresh = defaults();
  fresh.settings = save.settings;
  for (const k of Object.keys(save)) delete save[k];
  Object.assign(save, fresh);
  persist();
}

export function levelResult(id) { return save.levels[id] || null; }

export function recordLevel(id, stars) {
  const prev = save.levels[id];
  const improved = !prev || stars > prev.stars;
  save.levels[id] = { stars: Math.max(stars, prev?.stars || 0), done: true, plays: (prev?.plays || 0) + 1 };
  persist();
  return { improved, first: !prev };
}

export function totalStars() { return Object.values(save.levels).reduce((s, l) => s + (l.stars || 0), 0); }

export function unlockCodex(ids = []) {
  const fresh = [];
  for (const id of ids) if (!save.codex[id]) { save.codex[id] = true; fresh.push(id); if (!save.newCodex.includes(id)) save.newCodex.push(id); }
  if (fresh.length) persist();
  return fresh;
}
