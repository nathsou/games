import type { App } from '../app.ts';
import type { PuzzleDef } from '../core/types.ts';
import { tutorialLesson1, tutorialLesson2, tutorialLesson3 } from '../data/tutorial.ts';
import { BROKEN, PAINTED } from '../game/session.ts';
import { save, store } from '../game/storage.ts';
import { button, h, modal } from './dom.ts';
import { PlayScreen, type PlayHooks } from './play.ts';
import { FINE_POINTER } from './toolkeys.ts';

/** Pick the wording for mouse/keyboard or touch. */
const say = (mouse: string, touch: string) => (FINE_POINTER ? mouse : touch);

type Ev = Parameters<PlayHooks['event']>[0];

interface Step {
  title: string;
  text: string;
  /** Pulse these line ids (computed from the puzzle). */
  lines?: (p: PlayScreen) => number[];
  /** HUD element key to spotlight. */
  spot?: string;
  /** Advance when this returns true (checked after every event). */
  until?: (p: PlayScreen, ev: Ev) => boolean;
  /** Label for a manual "next" button. */
  next?: string;
}

interface Lesson {
  puzzle: () => PuzzleDef;
  steps: Step[];
}

// line ids for flat (depth 1) lessons: X-lines = y, Y-lines = H*D + x
const rowLine = (y: number) => y;
const colLine = (p: PlayScreen, x: number) => p.session.grid.axisOffset[1] + x;
const cellsOf = (p: PlayScreen, pts: [number, number][]) => pts.map(([x, y]) => p.session.grid.idx(x, y, 0));
const all = (p: PlayScreen, pts: [number, number][], st: number) => cellsOf(p, pts).every((i) => p.session.state[i] === st);

const LESSONS: Lesson[] = [
  {
    puzzle: tutorialLesson1,
    steps: [
      {
        title: 'Welcome to Nonocube',
        text: 'A shape is hidden inside this block. The numbers tell you how many cubes in that row belong to the shape. Break away everything else to reveal it!',
        next: 'Next',
      },
      {
        title: 'Look around',
        text: say(
          'With no tool active, dragging anywhere turns the block. Scroll to zoom.',
          'With no tool active, dragging anywhere turns the block. Pinch to zoom.',
        ),
        until: (_p, ev) => ev === 'orbit',
        next: 'Skip',
      },
      {
        title: 'Zero means empty',
        text: say(
          'The glowing column shows 0 on top: none of its cubes belong to the shape. Hold A and click them to break them — or hold A and drag down the column to break it all at once.',
          'The glowing column shows 0 on top: none of its cubes belong to the shape. Turn on the hammer below, then tap them — or drag down the column to break it all at once.',
        ),
        lines: (p) => [colLine(p, 3)],
        spot: 'hammer',
        until: (p) => all(p, [[3, 0], [3, 1], [3, 2]], BROKEN),
      },
      {
        title: 'Keep what’s certain',
        text: say(
          'This column says 3 and has exactly 3 cubes, so they all stay. Hold D and click (or drag) to paint them — painted cubes are protected from the hammer.',
          'This column says 3 and has exactly 3 cubes, so they all stay. Switch to the brush and paint them — painted cubes are protected from the hammer.',
        ),
        lines: (p) => [colLine(p, 1)],
        spot: 'brush',
        until: (p) => all(p, [[1, 0], [1, 1], [1, 2]], PAINTED),
      },
      {
        title: 'Count it out',
        text: 'The top row says 3. One of its cubes is gone, so the 3 that remain must all stay. Paint them.',
        lines: () => [rowLine(2)],
        until: (p) => all(p, [[0, 2], [1, 2], [2, 2]], PAINTED),
      },
      {
        title: 'Finish it',
        text: say(
          'The last two rows say 1, and each already has a painted cube. Break the rest with A! (You can also click a tool below to keep it on.)',
          'The last two rows say 1, and each already has a painted cube. Switch back to the hammer and break the rest!',
        ),
        lines: () => [rowLine(0), rowLine(1)],
        spot: 'hammer',
        until: (p) => p.session.solved,
      },
      { title: 'Solved!', text: 'Every solved puzzle reveals a hidden object. Next: clues that come in groups.', next: 'Next lesson' },
    ],
  },
  {
    puzzle: tutorialLesson2,
    steps: [
      {
        title: 'Circles and squares',
        text: 'A circled number means the cubes form exactly 2 separate groups. A squared number means 3 groups or more. A plain number means they’re all together.',
        lines: () => [rowLine(0), rowLine(2)],
        next: 'Got it',
      },
      {
        title: 'Only one way',
        text: 'The top row has a squared 3: three cubes in at least three groups. In a row of five, only “cube, gap, cube, gap, cube” fits. Break the 2nd and 4th cubes.',
        lines: () => [rowLine(2)],
        until: (p) => all(p, [[1, 2], [3, 2]], BROKEN),
      },
      {
        title: 'Easy one',
        text: 'The middle row is 0. Clear it!',
        lines: () => [rowLine(1)],
        until: (p) => all(p, [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]], BROKEN),
      },
      {
        title: 'Find the gap',
        text: 'The bottom row’s circled 4 has a single gap somewhere. The middle column says 1 — and its top cube already stays. So where’s the gap?',
        lines: (p) => [rowLine(0), colLine(p, 2)],
        until: (p) => p.session.solved,
      },
      { title: 'Nice!', text: 'Now let’s go fully 3D.', next: 'Next lesson' },
    ],
  },
  {
    puzzle: tutorialLesson3,
    steps: [
      {
        title: 'Into the third dimension',
        text: 'Each face shows the clue for the row running straight through it: left–right, up–down or front–back. Hover or touch a cube to see all three of its clues up top.',
        next: 'Next',
      },
      {
        title: 'Peek inside',
        text: 'Some cubes are hidden in the middle. Drag one of the colored knobs next to the block (or use the slider) to peel away layers from the side you’re looking at.',
        spot: matchMedia('(hover: hover) and (pointer: fine)').matches ? 'knobs' : 'slice',
        until: (p, ev) => ev === 'slice' && p.slicer.peel > 0,
        next: 'Skip',
      },
      {
        title: 'Your turn',
        text: 'Solve the rest on your own. Stuck? The lightbulb shows a hint.',
        spot: 'hint',
        until: (p) => p.session.solved,
      },
      {
        title: 'You’re ready!',
        text: 'That’s everything. Classic mode counts mistakes (5 allowed) — switch to Zen in Settings if you’d rather play without them. Have fun!',
        next: 'Let’s play',
      },
    ],
  },
];

/** Drives the three tutorial lessons on top of regular play screens. */
export class Tutorial implements PlayHooks {
  private app: App;
  private onDone: () => void;
  private lesson = 0;
  private step = 0;
  private play: PlayScreen | null = null;
  private card: HTMLElement | null = null;
  private spotted: HTMLElement | null = null;

  constructor(app: App, onDone: () => void) {
    this.app = app;
    this.onDone = onDone;
  }

  start(): void {
    this.startLesson(0);
  }

  private startLesson(i: number): void {
    this.lesson = i;
    this.step = 0;
    const puzzle = LESSONS[i].puzzle();
    const screen = new PlayScreen(this.app, {
      puzzle,
      mask: puzzle.mask!,
      saveKey: null,
      subtitle: `Tutorial · Lesson ${i + 1} of ${LESSONS.length}`,
      onExit: () => void this.confirmSkip(),
      hooks: this,
    });
    this.app.go(screen);
  }

  attach(p: PlayScreen): void {
    this.play = p;
    p.session.noStrikeLimit = true;
    p.refreshHud();
    this.card = h('div', { class: 'tutorial-card', role: 'dialog', 'aria-live': 'polite' });
    p.el.append(this.card);
    this.render();
  }

  detach(): void {
    this.clearSpot();
    this.play = null;
  }

  event(ev: Ev): void {
    const p = this.play;
    if (!p) return;
    const steps = LESSONS[this.lesson].steps;
    if (ev === 'solved' && this.step < steps.length - 1) {
      // Solved (possibly ahead of the script): jump to the lesson's wrap-up.
      this.step = steps.length - 1;
      this.render();
      return;
    }
    const s = steps[this.step];
    if (s?.until?.(p, ev)) this.advance();
  }

  onSolved(): boolean {
    return true;
  }

  private advance(): void {
    const steps = LESSONS[this.lesson].steps;
    if (this.step < steps.length - 1) {
      this.step++;
      this.render();
      // a step may already be satisfied (e.g. the player got ahead)
      const s = steps[this.step];
      if (s.until && this.play && s.until(this.play, 'action')) setTimeout(() => this.advance(), 700);
      return;
    }
    if (this.lesson < LESSONS.length - 1) this.startLesson(this.lesson + 1);
    else this.finish();
  }

  private finish(): void {
    store.tutorialDone = true;
    save();
    this.onDone();
  }

  private async confirmSkip(): Promise<void> {
    const r = await modal({
      title: 'Skip the tutorial?',
      body: 'You can replay it any time from the home screen.',
      actions: [{ label: 'Keep learning', value: 'stay' }, { label: 'Skip', value: 'skip', cls: 'primary' }],
    });
    if (r === 'skip') this.finish();
  }

  private clearSpot(): void {
    this.spotted?.classList.remove('spot');
    this.spotted = null;
  }

  private render(): void {
    const p = this.play;
    if (!p || !this.card) return;
    const steps = LESSONS[this.lesson].steps;
    const s = steps[this.step];
    this.clearSpot();
    if (s.spot && p.ui[s.spot]) {
      this.spotted = p.ui[s.spot];
      this.spotted.classList.add('spot');
    }
    p.highlightLines = s.lines ? s.lines(p) : [];
    const dots = h('div', { class: 'tut-dots' }, ...steps.map((_, k) => h('i', { class: k === this.step ? 'on' : k < this.step ? 'done' : '' })));
    this.card.replaceChildren(
      h('div', { class: 'tut-head' }, h('span', { class: 'eyebrow' }, `Lesson ${this.lesson + 1} · ${this.step + 1}/${steps.length}`), dots),
      h('h3', null, s.title),
      h('p', null, s.text),
      h('div', { class: 'tut-actions' },
        button('Skip tutorial', () => void this.confirmSkip(), 'ghost small'),
        s.next ? button(s.next, () => this.advance(), s.until ? 'small' : 'primary small') : null,
      ),
    );
    this.card.classList.remove('pop');
    void this.card.offsetWidth;
    this.card.classList.add('pop');
  }
}
