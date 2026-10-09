import {BANK, fold} from './words.js';
import {playerView, actingSeat, clueProblem, teamOf} from './rules.js';

// The offline Cover Story bot plays from its seat's own view. As a spymaster
// (or duo giver) it looks for an association shared by several of its words and
// by none of the dangerous ones; as an operative it guesses the words most
// linked to the clue and stops when nothing fits.
const indexes = {};
function index(lang) {
  if (indexes[lang]) return indexes[lang];
  const words = new Map();
  for (const [word, list] of Object.entries(BANK[lang])) words.set(fold(word), new Set(list.map(fold)));
  return indexes[lang] = words;
}
const variants = clue => [...new Set([clue, clue.replace(/(es|s|x)$/, ''), clue + 's'])];
// How strongly a clue points at a board word: listed association (3), the
// clue's own associations naming the word (3), plus shared associations.
export function relation(lang, clue, word) {
  const bank = index(lang), target = fold(word), own = bank.get(target) || new Set();
  let score = 0;
  for (const c of variants(fold(clue))) {
    if (own.has(c)) score = Math.max(score, 3);
    const theirs = bank.get(c);
    if (theirs?.has(target)) score = Math.max(score, 3);
    if (theirs) { let shared = 0; for (const a of theirs) if (own.has(a)) shared++; score = Math.max(score, Math.min(2, shared)); }
  }
  return score;
}
function giverPlan(view) {
  const live = view.words.map((word, i) => ({word, i})).filter(({i}) => view.revealed[i] === null);
  let mine, danger;
  if (view.mode === 'teams') {
    const team = teamOf(view.seat), other = team === 'red' ? 'blue' : 'red';
    mine = live.filter(({i}) => view.key[i] === team);
    danger = ({i}) => view.key[i] === 'assassin' ? 100 : view.key[i] === other ? 4 : 1;
  } else {
    mine = live.filter(({i}) => view.myKey[i] === 'agent');
    danger = ({i}) => view.myKey[i] === 'assassin' ? 100 : view.bystanders[view.seat][i] ? .5 : 1;
  }
  const others = live.filter(card => !mine.includes(card));
  const candidates = new Set(mine.flatMap(({word}) => BANK[view.lang][word] || []));
  let best = null;
  for (const clue of candidates) {
    if (clueProblem(view, clue)) continue;
    const targets = mine.filter(({word}) => relation(view.lang, clue, word) >= 3);
    if (!targets.length) continue;
    let risk = 0;
    for (const card of others) { const r = relation(view.lang, clue, card.word); if (r >= 2) risk += danger(card) * (r >= 3 ? 1 : .4); }
    if (risk >= 100) continue;
    const score = targets.length * 10 - risk * 6;
    if (!best || score > best.score) best = {score, clue, targets: targets.map(t => t.i)};
  }
  if (!best) {
    // No safe shared link: point at one word with its first usable association.
    for (const {word, i} of mine) for (const clue of BANK[view.lang][word] || []) if (!clueProblem(view, clue)) return {kind: 'clue', word: clue, number: 1, targets: [i]};
    return {kind: 'clue', word: view.lang === 'fr' ? 'mystère' : 'mystery', number: 1, targets: []};
  }
  return {kind: 'clue', word: best.clue, number: Math.min(9, best.targets.length), targets: best.targets};
}
export function rankGuesses(view) {
  const open = view.words.map((word, i) => i).filter(i => view.revealed[i] === null && !(view.mode === 'duo' && view.bystanders[view.giver][i]));
  return open.map(i => ({i, score: relation(view.lang, view.clue.word, view.words[i])})).sort((a, b) => b.score - a.score || a.i - b.i);
}
function guesserPlan(view) {
  const ranked = rankGuesses(view), strong = ranked.filter(r => r.score >= 3), weak = ranked.filter(r => r.score >= 2);
  const pool = strong.length >= view.clue.number ? strong : weak;
  if (view.guesses < view.clue.number && view.guesses < pool.length) return {kind: 'guess', index: pool[view.guesses].i};
  if (!view.guesses) return {kind: 'guess', index: (ranked[0] || {i: view.revealed.indexOf(null)}).i};
  return {kind: 'pass'};
}
export function botAction(state, seat) {
  if (actingSeat(state) !== seat) throw new Error('The bot is not on turn.');
  const view = playerView(state, seat);
  const plan = state.phase === 'clue' ? giverPlan(view) : guesserPlan(view);
  return plan.kind === 'clue' ? {kind: 'clue', word: plan.word, number: plan.number} : plan;
}
export {giverPlan, guesserPlan};
