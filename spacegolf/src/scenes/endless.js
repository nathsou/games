// Endless mode: an unlimited supply of procedurally generated, verified-solvable
// holes. Every game gets a fresh random seed; seeds can be shared and replayed.

import { generateSteps, DIFFICULTIES, MAX_DIFFICULTY } from '../generator.js';
import { runAsync } from '../solver.js';
import { randomSeed, seedToCode, codeToSeed, prettyCode, normalizeCode, SEED_ALPHABET, SEED_LENGTH } from '../rng.js';
import { COL, ICON, hex, withAlpha } from '../ui.js';
import { GameScene } from './game.js';
import { header } from './common.js';

// ---- run state + background generation ---------------------------------------------------

class EndlessRun {
  constructor(app, base, ramp) {
    this.app = app;
    this.base = base;
    this.ramp = ramp;
    this.holes = 0;
    this.over = 0;
    this.aces = 0;
    this.pending = null;
    this.cancelled = false;
  }

  difficulty(index = this.holes) {
    return this.ramp ? Math.min(MAX_DIFFICULTY, this.base + Math.floor(index / 3)) : this.base;
  }

  // start generating a hole (returns {seed, d, promise})
  generate(seed = randomSeed(), d = this.difficulty(), budget = 10) {
    const entry = { seed, d, promise: null, level: null };
    entry.promise = runAsync(generateSteps(seed, d), (p) => { entry.progress = p; }, budget).then((level) => {
      level.name = `Hole ${prettyCode(seedToCode(seed))}`;
      entry.level = level;
      return entry;
    });
    return entry;
  }

  prefetch() {
    if (!this.pending) this.pending = this.generate(randomSeed(), this.difficulty(this.holes + 1), 3);
  }

  take() {
    const e = this.pending || this.generate();
    this.pending = null;
    return e;
  }
}

export function startEndless(app, opts) {
  const { difficulty, ramp, seed } = opts;
  app.store.data.endless.difficulty = difficulty;
  app.store.data.endless.ramp = ramp;
  app.store.save();
  const run = new EndlessRun(app, difficulty, ramp);
  const entry = run.generate(seed ?? randomSeed(), difficulty, 10);
  openGenerating(app, run, entry);
}

export function playSeedFromLink(app, code, d) {
  const seed = codeToSeed(code);
  if (seed === null) return;
  const diff = Math.max(1, Math.min(MAX_DIFFICULTY, d || 2));
  startEndless(app, { difficulty: diff, ramp: false, seed });
}

function openGenerating(app, run, entry) {
  app.go(new GeneratingScene(app, run, entry));
}

function playHole(app, run, entry) {
  const level = entry.level;
  const code = prettyCode(seedToCode(entry.seed));
  const d = entry.d;
  const cfg = {
    level,
    kind: 'endless',
    title: `Hole ${run.holes + 1}`,
    subtitle: `${DIFFICULTIES[d].name} · seed ${code}`,
    paletteSalt: 0,
    onWin: (res) => {
      run.holes++;
      run.over += res.strokes - res.par;
      const st = app.store.data.endless;
      st.holes++;
      if (res.strokes === 1) {
        st.aces++;
        run.aces++;
      }
      app.store.save();
      const sign = run.over > 0 ? '+' : '';
      return { extra: `Run: ${sign}${run.over} over par after ${run.holes} hole${run.holes === 1 ? '' : 's'}` };
    },
    onNext: () => {
      const next = run.take();
      next.promise.then(() => {});
      openGenerating(app, run, next);
    },
    nextLabel: 'Next hole',
    onSkip: () => {
      const next = run.take();
      openGenerating(app, run, next);
    },
    onExit: () => app.go(new EndlessScene(app)),
    extraButtons: (ui, x, y, w, u) => {
      if (ui.button('w-share', x + w / 2 - 110 * u, y, 220 * u, 42 * u, { icon: ICON.copy, label: 'Share this hole', size: 14 })) shareSeed(app, entry.seed, d);
    },
  };
  app.go(new GameScene(app, cfg));
  // while the player lines up the first shot, build the next hole in the background
  run.prefetch();
}

async function shareSeed(app, seed, d) {
  const code = seedToCode(seed);
  const url = `${location.origin}${location.pathname}#seed=${code}&d=${d}`;
  try {
    await navigator.clipboard.writeText(url);
    app.ui.toast('Link copied to clipboard');
  } catch (e) {
    app.ui.toast(`Seed ${prettyCode(code)} · difficulty ${d}`);
  }
}

// ---- generating screen -------------------------------------------------------------------

export class GeneratingScene {
  constructor(app, run, entry) {
    this.app = app;
    this.run = run;
    this.entry = entry;
    this.t = 0;
    this.done = false;
    this.failed = null;
    this.shown = 0;
    entry.promise.then(
      () => { this.done = true; },
      (e) => { this.failed = e; console.error(e); },
    );
  }

  frame(dt) {
    const app = this.app;
    const ui = app.ui;
    const u = ui.u;
    this.t += dt;
    this.shown += ((this.entry.progress ?? 0) - this.shown) * Math.min(1, dt * 6);
    app.backdrop(2, 0.4, true);
    const cx = ui.w / 2;
    const cy = ui.h / 2;
    // orbiting dots
    for (let i = 0; i < 3; i++) {
      const rad = (46 + i * 26) * u;
      const a = this.t * (1.6 - i * 0.35) + i * 2.1;
      ui.disc(cx, cy - 30 * u, rad * 2, [0.5, 0.7, 1, 0.0], 1.2 * u, [0.5, 0.7, 1, 0.22]);
      ui.disc(cx + Math.cos(a) * rad, cy - 30 * u + Math.sin(a) * rad, (9 - i * 2) * u, i === 0 ? COL.accent : i === 1 ? COL.gold : COL.white);
    }
    ui.disc(cx, cy - 30 * u, 22 * u, hex('#ffcf5e'));
    const d = this.entry.d;
    ui.text('Charting the cosmos…', cx, cy + 90 * u, 24 * u, COL.text, { align: 'center', shadow: true });
    ui.text(`${DIFFICULTIES[d].name} · seed ${prettyCode(seedToCode(this.entry.seed))}`, cx, cy + 124 * u, 14 * u, COL.dim, { align: 'center' });
    // progress bar
    const bw = 260 * u;
    ui.rect(cx - bw / 2, cy + 150 * u, bw, 6 * u, { fill: hex('#1a2550', 0.9), radius: 3 * u });
    ui.rect(cx - bw / 2, cy + 150 * u, Math.max(8 * u, bw * Math.min(1, this.shown)), 6 * u, { fill: COL.accent, radius: 3 * u });
    if (header(app, 'Endless', null)) {
      this.run.cancelled = true;
      app.go(new EndlessScene(app));
      return;
    }
    if (this.failed) {
      ui.text('Something went wrong generating that hole.', cx, cy + 190 * u, 15 * u, COL.bad, { align: 'center' });
    }
    if (this.done && this.t > 0.35 && app.fadeDir < 0) {
      this.done = false;
      playHole(app, this.run, this.entry);
    }
  }
}

// ---- setup screen -----------------------------------------------------------------------

const DESCRIPTIONS = [
  null,
  'Two or three planets and a simple shot.',
  'Chain two shots with a little air and bumpers.',
  'Wind, moons and tougher trick shots.',
  'Wormholes, black holes and suns.',
  'Three-shot routes through hazards.',
  'Everything at once. Good luck.',
];

export class EndlessScene {
  constructor(app) {
    this.app = app;
    const st = app.store.data.endless;
    this.difficulty = Math.max(1, Math.min(MAX_DIFFICULTY, st.difficulty || 2));
    this.ramp = st.ramp !== false;
    this.seedText = '';
    this.keypad = false;
    this.t = 0;
  }

  frame(dt) {
    const app = this.app;
    const ui = app.ui;
    const u = ui.u;
    this.t += dt;
    app.backdrop(3, 0.4, true);

    if (this.keypad) {
      this.drawKeypad();
      return;
    }
    if (header(app, 'Endless', 'A fresh, solvable hole every time')) app.openTitle();
    for (const k of ui.keys) if (k.key === 'Escape') app.openTitle();

    const cx = ui.w / 2;
    const colW = Math.min(ui.w - 32 * u, 760 * u);
    const x0 = cx - colW / 2;
    let y = Math.max(92 * u, (ui.h - 400 * u) / 2 + 20 * u);

    // difficulty chips
    ui.text('DIFFICULTY', x0, y, 12 * u, COL.dim, { spacing: 0.25 });
    y += 22 * u;
    const gap = 10 * u;
    const cols = ui.w < 620 * u ? 3 : 6;
    const cw = (colW - gap * (cols - 1)) / cols;
    const ch = 64 * u;
    for (let i = 1; i <= MAX_DIFFICULTY; i++) {
      const col = (i - 1) % cols;
      const row = Math.floor((i - 1) / cols);
      const x = x0 + col * (cw + gap);
      const yy = y + row * (ch + gap);
      const sel = this.difficulty === i;
      if (ui.button('d' + i, x, yy, cw, ch, { selected: sel })) this.difficulty = i;
      ui.text(DIFFICULTIES[i].name, x + cw / 2, yy + ch * 0.36, 15 * u, COL.text, { align: 'center' });
      for (let k = 0; k < 6; k++) ui.disc(x + cw / 2 + (k - 2.5) * 10 * u, yy + ch * 0.74, 5.5 * u, k < i ? (sel ? COL.accent : COL.dim) : hex('#2a3566'));
    }
    y += Math.ceil(MAX_DIFFICULTY / cols) * (ch + gap);
    ui.text(DESCRIPTIONS[this.difficulty], cx, y + 8 * u, 15 * u, COL.dim, { align: 'center' });
    y += 40 * u;

    // ramp toggle
    const rw = Math.min(colW, 420 * u);
    if (ui.button('ramp', cx - rw / 2, y, rw, 48 * u, { icon: this.ramp ? ICON.check : ICON.cross, label: this.ramp ? 'Gets harder every 3 holes' : 'Stay at this difficulty', size: 16, selected: this.ramp })) this.ramp = !this.ramp;
    y += 48 * u + 14 * u;

    // seed
    const code = this.seedText.length === SEED_LENGTH ? this.seedText : null;
    const label = code ? `Seed ${prettyCode(code)}` : 'Random seed';
    if (ui.button('seed', cx - rw / 2, y, rw - 56 * u, 48 * u, { icon: ICON.pencil, label: `${label}  ·  enter a seed`, size: 15 })) this.keypad = true;
    if (ui.button('seed-clear', cx - rw / 2 + rw - 48 * u, y, 48 * u, 48 * u, { icon: ICON.dice, iconScale: 0.55, disabled: !code })) this.seedText = '';
    y += 48 * u + 22 * u;

    const pw = Math.min(colW, 380 * u);
    if (ui.button('play', cx - pw / 2, y, pw, 64 * u, { label: 'Play', icon: ICON.play, size: 24, kind: 'primary' })) {
      startEndless(app, { difficulty: this.difficulty, ramp: this.ramp, seed: code ? codeToSeed(code) : undefined });
    }
    for (const k of ui.keys) if (k.key === 'Enter') startEndless(app, { difficulty: this.difficulty, ramp: this.ramp, seed: code ? codeToSeed(code) : undefined });

    const st = app.store.data.endless;
    ui.text(`${st.holes} holes completed  ·  ${st.aces} hole${st.aces === 1 ? '' : 's'} in one`, cx, ui.h - 28 * u, 14 * u, COL.dim, { align: 'center' });
  }

  drawKeypad() {
    const app = this.app;
    const ui = app.ui;
    const u = ui.u;
    ui.rect(0, 0, ui.w, ui.h, { fill: [0.01, 0.02, 0.06, 0.6], radius: 0 });
    const keys = SEED_ALPHABET.split('');
    const cols = ui.w < 600 * u ? 8 : 8;
    const kg = 8 * u;
    const kw = Math.min(58 * u, (ui.w - 40 * u - kg * (cols - 1)) / cols);
    const rows = Math.ceil(keys.length / cols);
    const panelW = cols * kw + (cols - 1) * kg + 48 * u;
    const panelH = 120 * u + rows * (kw + kg) + 70 * u;
    const px = (ui.w - panelW) / 2;
    const py = Math.max(10 * u, (ui.h - panelH) / 2);
    ui.panel(px, py, panelW, panelH);
    ui.text('Enter a seed', px + panelW / 2, py + 30 * u, 20 * u, COL.text, { align: 'center' });
    // slots
    const sw = 40 * u;
    const sx = px + panelW / 2 - (SEED_LENGTH * (sw + 6 * u)) / 2;
    for (let i = 0; i < SEED_LENGTH; i++) {
      const x = sx + i * (sw + 6 * u);
      ui.glass(x, py + 52 * u, sw, 46 * u, { radius: 12 * u, shadow: false, tint: [0.02, 0.04, 0.14, 0.6], edge: i === this.seedText.length ? [0.5, 0.92, 1, 0.9] : [0.84, 0.91, 1, 0.25], border: i === this.seedText.length ? 1.6 : 1 });
      if (this.seedText[i]) ui.text(this.seedText[i], x + sw / 2, py + 75 * u, 24 * u, COL.text, { align: 'center' });
    }
    // typed keys
    for (const k of ui.keys) {
      if (k.key === 'Escape') this.keypad = false;
      else if (k.key === 'Backspace') this.seedText = this.seedText.slice(0, -1);
      else if (k.key === 'Enter' && this.seedText.length === SEED_LENGTH) this.keypad = false;
      else if (k.key.length === 1) {
        const c = normalizeCode(k.key);
        if (c && SEED_ALPHABET.includes(c) && this.seedText.length < SEED_LENGTH) this.seedText += c;
      }
    }
    const gx = px + (panelW - (cols * kw + (cols - 1) * kg)) / 2;
    const gy = py + 112 * u;
    keys.forEach((c, i) => {
      const x = gx + (i % cols) * (kw + kg);
      const y = gy + Math.floor(i / cols) * (kw + kg);
      if (ui.button('k' + c, x, y, kw, kw, { label: c, size: 20, disabled: this.seedText.length >= SEED_LENGTH })) this.seedText += c;
    });
    const by = gy + rows * (kw + kg) + 6 * u;
    const bw = (panelW - 48 * u - 2 * kg) / 3;
    if (ui.button('k-back', px + 24 * u, by, bw, 46 * u, { icon: ICON.back, iconScale: 0.5 })) this.seedText = this.seedText.slice(0, -1);
    if (ui.button('k-clear', px + 24 * u + bw + kg, by, bw, 46 * u, { label: 'Clear', size: 15 })) this.seedText = '';
    if (ui.button('k-ok', px + 24 * u + (bw + kg) * 2, by, bw, 46 * u, { label: 'Done', size: 16, kind: 'primary' })) this.keypad = false;
  }
}
