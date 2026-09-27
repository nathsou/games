import type { App, Screen } from '../app.ts';
import { haptic, sfx, unlockAudio } from '../audio/sfx.ts';
import { computeClues } from '../core/clues.ts';
import { encodePuzzle } from '../core/codec.ts';
import { gridFor, type Axis, type Dims, type Grid } from '../core/grid.ts';
import type { Difficulty, PuzzleDef } from '../core/types.ts';
import { save, store } from '../game/storage.ts';
import { GLYPH_HIDDEN } from '../render/atlas.ts';
import { DEFAULT_PITCH, DEFAULT_YAW } from '../render/camera.ts';
import { clamp, hexToRgb, type Vec3 } from '../render/math.ts';
import { pickFloor, pickVoxel } from '../render/pick.ts';
import { boxEdges, type DrawList, type LineBatch } from '../render/renderer.ts';
import { BlockScene, FLAG_GLOW, FLAG_HOVER, NO_GLYPHS, packGlyphs } from '../render/scene.ts';
import type { Analysis } from '../solver/generator.ts';
import { solverClient } from '../solver/client.ts';
import { button, h, icon, iconButton, modal, toast } from '../ui/dom.ts';
import type { GestureTarget } from '../ui/gestures.ts';
import { I } from '../ui/icons.ts';
import { importCode, shareCode, type Nav } from '../ui/menus.ts';
import { AXIS_COLORS, AXIS_NAMES } from '../ui/play.ts';

type Tool = 'add' | 'remove' | 'paint' | 'pick';
type Mode = 'build' | 'clues';

const MAX_DIM = 16;
const MAX_COLORS = 15;
const DEFAULT_PALETTE = ['#e5534b', '#f28b30', '#f5c542', '#5cb85c', '#2f7d4a', '#7cc4f2', '#3d7be0', '#8e6bd6', '#f28bb3', '#8b5a3c', '#f7f7f2', '#2a2d34'];
const BASE: Vec3 = hexToRgb('#e9e6de');

interface Snapshot {
  dims: Dims;
  cells: Uint8Array;
  palette: string[];
  mask: Uint8Array | null;
}

interface EStroke {
  tool: Tool;
  lockAxis: number;
  lockCoord: number;
  clueValue: number;
  touched: Set<string>;
}

export class EditorScreen implements Screen {
  readonly el: HTMLElement;
  readonly gestures: GestureTarget;
  private app: App;
  private nav: Nav;
  private dims: Dims = [6, 6, 6];
  private grid: Grid = gridFor([6, 6, 6]);
  private cells: Uint8Array = new Uint8Array(216);
  private palette = DEFAULT_PALETTE.slice();
  private color = 1;
  private name = 'My puzzle';
  private difficulty: Difficulty = 'medium';
  private userId: string | null = null;
  private mask: Uint8Array | null = null;
  private analysis: Analysis | null = null;
  private analyzing = false;
  private reqId = 0;
  private mode: Mode = 'build';
  private tool: Tool = 'add';
  private prevTool: Tool = 'add';
  private mirrorX = false;
  private mirrorZ = false;
  private slice = { axis: 1 as Axis, peel: 0, sign: 1 };
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private stroke: EStroke | null = null;
  private hover: { cell: number[] | null; target: number[] | null; face: number } = { cell: null, target: null, face: -1 };
  private scene = new BlockScene();
  private time = 0;
  private ui: Record<string, HTMLElement> = {};
  private dirtySinceSave = false;
  private analyzeTimer = 0;

  constructor(app: App, nav: Nav, puzzle?: PuzzleDef, userId?: string) {
    this.app = app;
    this.nav = nav;
    if (puzzle) this.load(puzzle, userId ?? null);
    else if (store.editorDraft) {
      try {
        const d = JSON.parse(store.editorDraft) as { dims: Dims; cells: number[]; palette: string[]; name: string; difficulty: Difficulty; userId: string | null };
        this.dims = d.dims;
        this.grid = gridFor(d.dims);
        this.cells = Uint8Array.from(d.cells);
        this.palette = d.palette;
        this.name = d.name;
        this.difficulty = d.difficulty;
        this.userId = d.userId;
      } catch {
        this.starter();
      }
    } else this.starter();
    this.el = this.buildUI();
    this.gestures = this.makeGestures();
    this.refresh();
  }

  private starter(): void {
    this.dims = [6, 6, 6];
    this.grid = gridFor(this.dims);
    this.cells = new Uint8Array(this.grid.size);
  }

  private load(p: PuzzleDef, userId: string | null): void {
    this.dims = [...p.dims] as unknown as Dims;
    this.grid = gridFor(this.dims);
    // map puzzle palette into editor palette
    this.palette = p.palette.slice(0, MAX_COLORS);
    for (const c of DEFAULT_PALETTE) if (this.palette.length < MAX_COLORS && !this.palette.includes(c)) this.palette.push(c);
    this.cells = p.cells.slice();
    this.name = p.name;
    this.difficulty = p.difficulty;
    this.mask = p.mask ? p.mask.slice() : null;
    this.userId = userId;
  }

  // ------------------------------------------------------------ UI

  private buildUI(): HTMLElement {
    const top = h('header', { class: 'topbar' },
      iconButton(I.back, 'Back', () => void this.leave()),
      h('div', { class: 'title-block' }, h('div', { class: 'eyebrow' }, 'Level editor'),
        (this.ui.nameInput = h('input', { class: 'name-input', value: this.name, maxlength: 40, 'aria-label': 'Puzzle name', oninput: (e: Event) => { this.name = (e.target as HTMLInputElement).value; this.saveDraft(); } }))),
      h('div', { class: 'spacer' }),
      (this.ui.undo = iconButton(I.undo, 'Undo (Ctrl+Z)', () => this.undo())),
      (this.ui.redo = iconButton(I.redo, 'Redo', () => this.redo())),
      iconButton(I.plus, 'New puzzle', () => void this.newPuzzle(), 'hide-sm'),
      button('Playtest', () => void this.playtest(), 'primary small', I.play),
    );

    // mode tabs
    this.ui.tabBuild = h('button', { class: 'tab active', onclick: () => this.setMode('build') }, icon(I.cube), 'Build');
    this.ui.tabClues = h('button', { class: 'tab', onclick: () => this.setMode('clues') }, icon(I.sparkle), 'Clues');

    // build panel
    const toolBtn = (t: Tool, svg: string, label: string, key: string) =>
      (this.ui[`tool-${t}`] = h('button', { class: 'tool', title: `${label} (${key})`, onclick: () => this.setTool(t) }, icon(svg), h('span', null, label)));
    this.ui.swatches = h('div', { class: 'swatches' });
    this.ui.dimsRow = h('div', { class: 'dims-row' });
    this.ui.mirX = h('button', { class: 'chip', onclick: () => { this.mirrorX = !this.mirrorX; this.refresh(); } }, 'Mirror X');
    this.ui.mirZ = h('button', { class: 'chip', onclick: () => { this.mirrorZ = !this.mirrorZ; this.refresh(); } }, 'Mirror Z');

    const buildPanel = h('div', { class: 'panel-sec build-only' },
      h('div', { class: 'tools4' }, toolBtn('add', I.addCube, 'Add', 'A'), toolBtn('remove', I.eraser, 'Remove', 'E'), toolBtn('paint', I.paintBucket, 'Paint', 'P'), toolBtn('pick', I.dropper, 'Pick', 'I')),
      h('h4', null, 'Color'), this.ui.swatches,
      h('h4', null, 'Symmetry'), h('div', { class: 'chips' }, this.ui.mirX, this.ui.mirZ),
      h('h4', null, 'Size'), this.ui.dimsRow,
      h('h4', null, 'Transform'),
      h('div', { class: 'chips' },
        h('button', { class: 'chip', title: 'Shift left', onclick: () => this.shift(0, -1) }, '← X'),
        h('button', { class: 'chip', title: 'Shift right', onclick: () => this.shift(0, 1) }, 'X →'),
        h('button', { class: 'chip', title: 'Shift down', onclick: () => this.shift(1, -1) }, '↓ Y'),
        h('button', { class: 'chip', title: 'Shift up', onclick: () => this.shift(1, 1) }, 'Y ↑'),
        h('button', { class: 'chip', title: 'Shift back', onclick: () => this.shift(2, -1) }, '↖ Z'),
        h('button', { class: 'chip', title: 'Shift front', onclick: () => this.shift(2, 1) }, 'Z ↘'),
        h('button', { class: 'chip', onclick: () => this.rotateY() }, 'Rotate 90°'),
        h('button', { class: 'chip', onclick: () => this.flipX() }, 'Flip'),
        h('button', { class: 'chip', onclick: () => this.fitBounds() }, 'Crop to fit'),
        h('button', { class: 'chip danger', onclick: () => this.clearAll() }, 'Clear'),
      ),
    );

    // clue panel
    this.ui.status = h('div', { class: 'status' });
    this.ui.diff = h('div', { class: 'segmented' },
      ...(['easy', 'medium', 'hard'] as Difficulty[]).map((d) =>
        h('label', null, h('input', { type: 'radio', name: 'ed-diff', value: d, checked: this.difficulty === d, onchange: () => { this.difficulty = d; this.saveDraft(); } }), h('span', null, d[0].toUpperCase() + d.slice(1)))));
    const cluePanel = h('div', { class: 'panel-sec clues-only' },
      this.ui.status,
      h('h4', null, 'Auto-generate'),
      this.ui.diff,
      h('div', { class: 'chips' },
        button('Generate clues', () => void this.generate(), 'primary small', I.wand),
        button('Show all', () => this.setAllClues(1), 'small'),
      ),
      h('p', { class: 'help' }, 'Tap a face to show or hide the clue of the row going through it. The badge above tells you whether the puzzle still has exactly one solution.'),
    );

    const share = h('div', { class: 'panel-sec' },
      h('div', { class: 'chips' },
        button('Save', () => void this.saveToMine(), 'small', I.save),
        button('Share link', () => void this.share(), 'small', I.share),
        button('Import', () => void importCode(this.nav), 'small', I.download),
      ),
    );

    this.ui.panel = h('aside', { class: 'editor-panel' },
      h('div', { class: 'tabs' }, this.ui.tabBuild, this.ui.tabClues),
      h('div', { class: 'panel-scroll' }, buildPanel, cluePanel, share),
    );
    this.ui.panelToggle = h('button', { class: 'panel-toggle icon-btn', 'aria-label': 'Toggle panel', onclick: () => this.el.classList.toggle('panel-closed') }, icon(I.sliders));

    // slicer + view
    const axisBtns = [0, 1, 2].map((a) =>
      (this.ui[`axis${a}`] = h('button', { class: 'axis-btn', style: `--axis:${AXIS_COLORS[a]}`, onclick: () => this.setSliceAxis(a as Axis) }, AXIS_NAMES[a])));
    this.ui.sliceRange = h('input', { type: 'range', min: '0', max: '1', value: '0', class: 'slice-range', 'aria-label': 'Layers peeled', oninput: (e: Event) => this.setPeel(Number((e.target as HTMLInputElement).value)) });
    const slicer = h('div', { class: 'pill slicer' }, icon(I.layers, 'muted'), ...axisBtns, this.ui.sliceRange);
    const view = h('div', { class: 'pill viewpad' },
      iconButton(I.rotL, 'Turn left', () => this.app.camera.turn(-1)),
      iconButton(I.target, 'Reset view', () => { this.app.camera.snapTo(DEFAULT_YAW, DEFAULT_PITCH); this.app.camera.resetZoom(); }),
      iconButton(I.rotR, 'Turn right', () => this.app.camera.turn(1)));
    this.ui.emptyHint = h('div', { class: 'empty-hint' }, 'Tap the floor grid to place your first cube');

    return h('div', { class: 'editor' }, top, this.ui.panel, this.ui.panelToggle, this.ui.emptyHint, h('footer', { class: 'bottom' }, slicer, view));
  }

  private refresh(): void {
    // tools
    for (const t of ['add', 'remove', 'paint', 'pick'] as Tool[]) this.ui[`tool-${t}`].classList.toggle('active', this.tool === t);
    this.ui.mirX.classList.toggle('active', this.mirrorX);
    this.ui.mirZ.classList.toggle('active', this.mirrorZ);
    this.ui.tabBuild.classList.toggle('active', this.mode === 'build');
    this.ui.tabClues.classList.toggle('active', this.mode === 'clues');
    this.el.classList.toggle('mode-clues', this.mode === 'clues');
    this.ui.undo.toggleAttribute('disabled', !this.undoStack.length);
    this.ui.redo.toggleAttribute('disabled', !this.redoStack.length);
    // swatches
    this.ui.swatches.replaceChildren(
      ...this.palette.map((c, i) =>
        h('button', { class: `swatch ${this.color === i + 1 ? 'active' : ''}`, style: `--c:${c}`, 'aria-label': `Color ${c}`, onclick: () => { this.color = i + 1; if (this.tool === 'remove' || this.tool === 'pick') this.setTool('add'); this.refresh(); } }),
      ),
      (() => {
        const input = h('input', { type: 'color', value: this.palette[this.color - 1] ?? '#ff8800', 'aria-label': 'Edit color', onchange: (e: Event) => this.editColor((e.target as HTMLInputElement).value) });
        return h('label', { class: 'swatch custom', title: 'Change the selected color' }, icon(I.edit), input);
      })(),
      ...(this.palette.length < MAX_COLORS
        ? [h('label', { class: 'swatch add', title: 'Add a color' }, icon(I.plus), h('input', { type: 'color', value: '#ffffff', onchange: (e: Event) => this.addColor((e.target as HTMLInputElement).value) }))]
        : []),
    );
    // dims
    this.ui.dimsRow.replaceChildren(
      ...[0, 1, 2].map((a) =>
        h('div', { class: 'stepper', style: `--axis:${AXIS_COLORS[a]}` },
          h('span', { class: 'axis-dot' }, AXIS_NAMES[a]),
          h('button', { 'aria-label': `Shrink ${AXIS_NAMES[a]}`, onclick: () => this.resize(a, -1) }, '−'),
          h('b', null, String(this.dims[a])),
          h('button', { 'aria-label': `Grow ${AXIS_NAMES[a]}`, onclick: () => this.resize(a, 1) }, '+'))),
    );
    // slicer
    const range = this.ui.sliceRange as HTMLInputElement;
    range.max = String(this.dims[this.slice.axis] - 1);
    range.value = String(this.slice.peel);
    for (let a = 0; a < 3; a++) this.ui[`axis${a}`].classList.toggle('active', a === this.slice.axis);
    this.ui.emptyHint.classList.toggle('show', this.mode === 'build' && !this.cells.some((c) => c));
    this.renderStatus();
  }

  private renderStatus(): void {
    const a = this.analysis;
    let cls = 'pending';
    let text = 'Clues not generated yet';
    let sub = '';
    const filled = this.cells.reduce((n, c) => n + (c ? 1 : 0), 0);
    if (!filled) {
      cls = 'bad';
      text = 'The model is empty';
    } else if (this.analyzing) {
      text = 'Checking…';
    } else if (a) {
      sub = `${a.visible} of ${a.total} clues shown`;
      if (a.status === 'unique') {
        cls = 'good';
        text = a.level === 1 ? 'Unique solution · logic only' : a.level === 2 ? 'Unique · needs advanced logic' : 'Unique · needs guessing';
        if (a.level === 3) cls = 'warn';
      } else if (a.status === 'multiple') {
        cls = 'bad';
        text = 'More than one solution';
        sub = 'Glowing cubes are ambiguous — show more clues nearby.';
      } else if (a.status === 'unknown') {
        cls = 'warn';
        text = 'Too complex to verify';
      }
    }
    this.ui.status.className = `status ${cls}`;
    this.ui.status.replaceChildren(h('b', null, text), sub ? h('small', null, sub) : '');
  }

  setMode(m: Mode): void {
    if (this.mode === m) return;
    this.mode = m;
    sfx.tick();
    if (m === 'clues' && !this.mask) void this.generate();
    this.refresh();
  }

  setTool(t: Tool): void {
    if (t === 'pick' && this.tool !== 'pick') this.prevTool = this.tool;
    this.tool = t;
    if (this.mode !== 'build') this.setMode('build');
    this.refresh();
  }

  private setSliceAxis(a: Axis): void {
    if (this.slice.axis === a && this.slice.peel) this.slice.peel = 0;
    this.slice.axis = a;
    this.refresh();
  }

  private setPeel(n: number): void {
    n = clamp(Math.round(n), 0, this.dims[this.slice.axis] - 1);
    if (n > 0 && this.slice.peel === 0) this.slice.sign = this.app.camera.eye[this.slice.axis] >= 0 ? 1 : -1;
    this.slice.peel = n;
    this.refresh();
  }

  private visible(x: number, y: number, z: number): boolean {
    const peel = this.slice.peel;
    if (!peel) return true;
    const c = [x, y, z][this.slice.axis];
    const dim = this.dims[this.slice.axis];
    return this.slice.sign > 0 ? c < dim - peel : c >= peel;
  }

  // ------------------------------------------------------------ model edits

  private snapshot(): Snapshot {
    return { dims: [...this.dims] as unknown as Dims, cells: this.cells.slice(), palette: this.palette.slice(), mask: this.mask ? this.mask.slice() : null };
  }

  private pushUndo(): void {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 120) this.undoStack.shift();
    this.redoStack = [];
  }

  private restore(s: Snapshot): void {
    this.dims = s.dims;
    this.grid = gridFor(s.dims);
    this.cells = s.cells;
    this.palette = s.palette;
    this.mask = s.mask;
    this.analysis = null;
    if (this.mask) this.scheduleAnalyze();
    this.saveDraft();
    this.refresh();
  }

  undo(): void {
    const s = this.undoStack.pop();
    if (!s) return;
    this.redoStack.push(this.snapshot());
    this.restore(s);
    sfx.tick();
  }

  redo(): void {
    const s = this.redoStack.pop();
    if (!s) return;
    this.undoStack.push(this.snapshot());
    this.restore(s);
    sfx.tick();
  }

  /** Model changed: clues must be regenerated. */
  private modelChanged(): void {
    this.mask = null;
    this.analysis = null;
    this.dirtySinceSave = true;
    this.saveDraft();
    if (this.mode === 'clues') void this.generate();
    this.refresh();
  }

  private setCell(x: number, y: number, z: number, v: number): boolean {
    const g = this.grid;
    let changed = false;
    const xs = this.mirrorX ? [x, this.dims[0] - 1 - x] : [x];
    const zs = this.mirrorZ ? [z, this.dims[2] - 1 - z] : [z];
    for (const xx of xs)
      for (const zz of zs) {
        if (!g.inBounds(xx, y, zz)) continue;
        const i = g.idx(xx, y, zz);
        if (this.cells[i] !== v) {
          this.cells[i] = v;
          changed = true;
        }
      }
    return changed;
  }

  private resize(axis: number, delta: number): void {
    const nd = [...this.dims];
    nd[axis] = clamp(nd[axis] + delta, 1, MAX_DIM);
    if (nd[axis] === this.dims[axis]) return;
    this.pushUndo();
    const ng = gridFor(nd as unknown as Dims);
    const nc = new Uint8Array(ng.size);
    for (let i = 0; i < this.grid.size; i++) {
      const [x, y, z] = this.grid.coords(i);
      if (ng.inBounds(x, y, z)) nc[ng.idx(x, y, z)] = this.cells[i];
    }
    this.dims = nd as unknown as Dims;
    this.grid = ng;
    this.cells = nc;
    this.slice.peel = Math.min(this.slice.peel, this.dims[this.slice.axis] - 1);
    this.app.camera.fit(this.dims, 1.15);
    this.modelChanged();
  }

  private transform(fn: (x: number, y: number, z: number) => number[] | null, newDims?: Dims): void {
    this.pushUndo();
    const nd = newDims ?? this.dims;
    const ng = gridFor(nd);
    const nc = new Uint8Array(ng.size);
    for (let i = 0; i < this.grid.size; i++) {
      if (!this.cells[i]) continue;
      const [x, y, z] = this.grid.coords(i);
      const t = fn(x, y, z);
      if (t && ng.inBounds(t[0], t[1], t[2])) nc[ng.idx(t[0], t[1], t[2])] = this.cells[i];
    }
    this.dims = nd;
    this.grid = ng;
    this.cells = nc;
    this.app.camera.fit(this.dims, 1.15);
    this.modelChanged();
  }

  private shift(axis: number, d: number): void {
    this.transform((x, y, z) => {
      const c = [x, y, z];
      c[axis] += d;
      return c;
    });
  }

  private rotateY(): void {
    const [W, H, D] = this.dims;
    this.transform((x, y, z) => [D - 1 - z, y, x], [D, H, W]);
  }

  private flipX(): void {
    this.transform((x, y, z) => [this.dims[0] - 1 - x, y, z]);
  }

  private fitBounds(): void {
    let min = [Infinity, Infinity, Infinity];
    let max = [-1, -1, -1];
    for (let i = 0; i < this.grid.size; i++) {
      if (!this.cells[i]) continue;
      const c = this.grid.coords(i);
      min = min.map((m, a) => Math.min(m, c[a]));
      max = max.map((m, a) => Math.max(m, c[a]));
    }
    if (max[0] < 0) return;
    const nd = [0, 1, 2].map((a) => max[a] - min[a] + 1) as unknown as Dims;
    this.transform((x, y, z) => [x - min[0], y - min[1], z - min[2]], nd);
  }

  private async clearAll(): Promise<void> {
    const r = await modal({ title: 'Clear the model?', actions: [{ label: 'Cancel', value: 'no' }, { label: 'Clear', value: 'yes', cls: 'danger' }] });
    if (r !== 'yes') return;
    this.pushUndo();
    this.cells.fill(0);
    this.modelChanged();
  }

  private editColor(hex: string): void {
    this.pushUndo();
    this.palette[this.color - 1] = hex;
    this.saveDraft();
    this.refresh();
  }

  private addColor(hex: string): void {
    if (this.palette.length >= MAX_COLORS) return;
    this.palette.push(hex);
    this.color = this.palette.length;
    this.saveDraft();
    this.refresh();
  }

  private async newPuzzle(): Promise<void> {
    const sizes = h('div', { class: 'segmented' },
      ...['5', '6', '8', '10'].map((s, k) => h('label', null, h('input', { type: 'radio', name: 'new-size', value: s, checked: k === 1 }), h('span', null, `${s}³`))));
    const r = await modal({ title: 'New puzzle', body: h('div', null, h('p', null, 'Start from an empty block. (Your current work stays in undo history.)'), sizes), actions: [{ label: 'Cancel', value: 'no' }, { label: 'Create', value: 'yes', cls: 'primary' }] });
    if (r !== 'yes') return;
    const n = Number((sizes.querySelector('input:checked') as HTMLInputElement).value);
    this.pushUndo();
    this.dims = [n, n, n];
    this.grid = gridFor(this.dims);
    this.cells = new Uint8Array(this.grid.size);
    this.userId = null;
    this.name = 'My puzzle';
    (this.ui.nameInput as HTMLInputElement).value = this.name;
    this.app.camera.fit(this.dims, 1.15);
    this.modelChanged();
  }

  // ------------------------------------------------------------ clues & solver

  private async generate(): Promise<void> {
    const filled = this.cells.some((c) => c);
    if (!filled) return;
    const id = ++this.reqId;
    this.analyzing = true;
    this.renderStatus();
    try {
      const res = await solverClient.generate(this.dims, this.cells.slice(), this.difficulty, `${Date.now()}`);
      if (id !== this.reqId) return;
      if (!this.mask) this.pushUndo();
      this.mask = res.mask;
      this.analysis = res.analysis;
      if (res.analysis.status !== 'unique') toast('This shape can’t be made unique with clues alone. Try adjusting it.', 'bad', 3500);
      else sfx.hint();
    } catch {
      /* cancelled */
    } finally {
      if (id === this.reqId) this.analyzing = false;
      this.saveDraft();
      this.refresh();
    }
  }

  private setAllClues(v: number): void {
    if (!this.mask) this.mask = new Uint8Array(this.grid.lineCount);
    this.pushUndo();
    this.mask.fill(v);
    this.scheduleAnalyze();
  }

  private scheduleAnalyze(): void {
    clearTimeout(this.analyzeTimer);
    this.analyzing = true;
    this.renderStatus();
    this.analyzeTimer = window.setTimeout(() => void this.runAnalyze(), 180);
  }

  private async runAnalyze(): Promise<void> {
    if (!this.mask) return;
    const id = ++this.reqId;
    try {
      const a = await solverClient.analyze(this.dims, this.cells.slice(), this.mask.slice());
      if (id !== this.reqId) return;
      this.analysis = a;
    } catch {
      /* cancelled */
    } finally {
      if (id === this.reqId) this.analyzing = false;
      this.saveDraft();
      this.refresh();
    }
  }

  private toPuzzle(): PuzzleDef {
    // compact the palette to used colors
    const used = new Map<number, number>();
    const palette: string[] = [];
    const cells = new Uint8Array(this.cells.length);
    for (let i = 0; i < cells.length; i++) {
      const v = this.cells[i];
      if (!v) continue;
      let m = used.get(v);
      if (m === undefined) {
        palette.push(this.palette[v - 1]);
        m = palette.length;
        used.set(v, m);
      }
      cells[i] = m;
    }
    return { id: this.userId ?? `user-${Date.now().toString(36)}`, name: this.name.trim() || 'Untitled', dims: this.dims, cells, palette, difficulty: this.difficulty, mask: this.mask ?? undefined };
  }

  private async ensureReady(action: string): Promise<boolean> {
    if (!this.cells.some((c) => c)) {
      toast('Add some cubes first!', 'bad');
      return false;
    }
    if (!this.mask) await this.generate();
    while (this.analyzing) await new Promise((r) => setTimeout(r, 50));
    if (!this.mask) return false;
    if (this.analysis?.status !== 'unique') {
      const r = await modal({
        title: 'Not uniquely solvable',
        body: `With the current clues this puzzle has more than one answer (or couldn't be verified). ${action} anyway?`,
        actions: [{ label: 'Cancel', value: 'no' }, { label: action, value: 'yes' }],
      });
      return r === 'yes';
    }
    return true;
  }

  private async playtest(): Promise<void> {
    if (!(await this.ensureReady('Playtest'))) return;
    const p = this.toPuzzle();
    this.saveDraft();
    this.nav.playCustom({ ...p, id: 'playtest' }, () => this.nav.editor(), null);
  }

  private async saveToMine(): Promise<void> {
    if (!(await this.ensureReady('Save'))) return;
    const p = this.toPuzzle();
    this.userId = p.id;
    const code = encodePuzzle(p);
    const existing = store.user.find((u) => u.id === p.id);
    if (existing) {
      existing.code = code;
      existing.updated = Date.now();
    } else store.user.push({ id: p.id, code, updated: Date.now() });
    this.dirtySinceSave = false;
    this.saveDraft();
    save(true);
    toast('Saved to My Puzzles', 'good');
    sfx.hint();
  }

  private async share(): Promise<void> {
    if (!(await this.ensureReady('Share'))) return;
    await shareCode(encodePuzzle(this.toPuzzle()));
  }

  private saveDraft(): void {
    store.editorDraft = JSON.stringify({ dims: this.dims, cells: Array.from(this.cells), palette: this.palette, name: this.name, difficulty: this.difficulty, userId: this.userId });
    save();
  }

  private async leave(): Promise<void> {
    this.saveDraft();
    if (this.dirtySinceSave && this.userId) {
      const r = await modal({ title: 'Unsaved changes', body: 'Save your changes to My Puzzles before leaving?', actions: [{ label: 'Discard', value: 'no' }, { label: 'Save', value: 'yes', cls: 'primary' }] });
      if (r === 'yes') await this.saveToMine();
      if (r === null) return;
    }
    this.nav.home();
  }

  // ------------------------------------------------------------ view / interaction

  enter(): void {
    const cam = this.app.camera;
    cam.fit(this.dims, 1.15);
    cam.yaw = DEFAULT_YAW;
    cam.pitch = DEFAULT_PITCH;
    cam.resetZoom();
    if (this.mask) this.scheduleAnalyze();
    if (window.innerWidth < 760) this.el.classList.add('panel-closed');
  }

  exit(): void {
    clearTimeout(this.analyzeTimer);
    this.saveDraft();
  }

  update(dt: number, time: number): void {
    this.time = time;
    const cam = this.app.camera;
    const open = !this.el.classList.contains('panel-closed');
    const wide = window.innerWidth >= 760;
    const pr = this.ui.panel.getBoundingClientRect();
    let top = 0;
    let bottom = cam.height;
    for (const el of this.el.querySelectorAll<HTMLElement>('.topbar')) top = el.getBoundingClientRect().bottom;
    for (const el of this.el.querySelectorAll<HTMLElement>('.bottom > *')) bottom = Math.min(bottom, el.getBoundingClientRect().top);
    if (open && !wide) bottom = Math.min(bottom, pr.top);
    const right = open && wide ? cam.width - pr.left : 0;
    cam.frame(top + 8, right + 8, cam.height - bottom + 8, 8, dt);
  }

  private makeGestures(): GestureTarget {
    const cam = this.app.camera;
    return {
      hitTest: (x, y) => {
        if (this.mode === 'clues') return !!this.pickFull(x, y);
        if (this.tool === 'add') return !!this.pickBuild(x, y);
        return !!this.pickSolid(x, y);
      },
      strokeStart: (x, y, alt) => {
        unlockAudio();
        this.beginStroke(x, y, alt);
      },
      strokeMove: (x, y) => this.moveStroke(x, y),
      strokeEnd: () => {
        const st = this.stroke;
        this.stroke = null;
        if (!st) return;
        if (!st.touched.size) {
          this.undoStack.pop();
          this.refresh();
        } else if (this.mode === 'clues') this.scheduleAnalyze();
        else if (st.tool === 'paint') {
          // colors don't affect clues
          this.dirtySinceSave = true;
          this.saveDraft();
          this.refresh();
        } else this.modelChanged();
      },
      hover: (x, y) => this.updateHover(x, y),
      hoverEnd: () => (this.hover = { cell: null, target: null, face: -1 }),
      orbitStart: () => cam.beginDrag(),
      orbit: (dx, dy, dt) => cam.orbit(dx, dy, dt),
      orbitEnd: () => cam.endDrag(),
      zoom: (f) => cam.zoomBy(f),
    };
  }

  private rayAt(x: number, y: number) {
    return this.app.camera.ray(x, y);
  }

  private pickSolid(x: number, y: number) {
    const { o, d } = this.rayAt(x, y);
    const g = this.grid;
    return pickVoxel(o, d, this.dims, (a, b, c) => this.cells[g.idx(a, b, c)] !== 0 && this.visible(a, b, c));
  }

  private pickFull(x: number, y: number) {
    const { o, d } = this.rayAt(x, y);
    return pickVoxel(o, d, this.dims, (a, b, c) => this.visible(a, b, c));
  }

  /** Where an "add" would place a cube, plus the face axis it was placed against. */
  private pickBuild(x: number, y: number): { target: number[]; axis: number; hit: number[] | null } | null {
    const hit = this.pickSolid(x, y);
    if (hit) {
      const t = [hit.x + hit.normal[0], hit.y + hit.normal[1], hit.z + hit.normal[2]];
      const axis = hit.normal[0] ? 0 : hit.normal[1] ? 1 : 2;
      if (this.grid.inBounds(t[0], t[1], t[2])) return { target: t, axis, hit: [hit.x, hit.y, hit.z] };
      return null;
    }
    const { o, d } = this.rayAt(x, y);
    const f = pickFloor(o, d, this.dims);
    if (f) return { target: [f.x, 0, f.z], axis: 1, hit: null };
    return null;
  }

  private updateHover(x: number, y: number): void {
    if (this.mode === 'clues') {
      const hit = this.pickFull(x, y);
      this.hover = hit ? { cell: [hit.x, hit.y, hit.z], target: null, face: hit.normal[0] ? 0 : hit.normal[1] ? 1 : 2 } : { cell: null, target: null, face: -1 };
      return;
    }
    if (this.tool === 'add') {
      const b = this.pickBuild(x, y);
      this.hover = { cell: b?.hit ?? null, target: b?.target ?? null, face: -1 };
    } else {
      const hit = this.pickSolid(x, y);
      this.hover = { cell: hit ? [hit.x, hit.y, hit.z] : null, target: null, face: -1 };
    }
  }

  private beginStroke(x: number, y: number, alt: boolean): void {
    if (this.mode === 'clues') {
      const hit = this.pickFull(x, y);
      if (!hit || !this.mask) return;
      const axis = hit.normal[0] ? 0 : hit.normal[1] ? 1 : 2;
      const l = this.grid.lineOf(this.grid.idx(hit.x, hit.y, hit.z), axis as Axis);
      this.pushUndo();
      const v = this.mask[l] ? 0 : 1;
      this.stroke = { tool: 'add', lockAxis: axis, lockCoord: 0, clueValue: v, touched: new Set() };
      this.toggleClue(hit.x, hit.y, hit.z, axis);
      return;
    }
    let tool = this.tool;
    if (alt) tool = tool === 'add' ? 'remove' : tool === 'remove' ? 'add' : tool;
    if (tool === 'pick') {
      const hit = this.pickSolid(x, y);
      if (hit) {
        this.color = this.cells[this.grid.idx(hit.x, hit.y, hit.z)];
        this.tool = this.prevTool === 'pick' ? 'add' : this.prevTool;
        sfx.tick();
        this.refresh();
      }
      return;
    }
    this.pushUndo();
    this.stroke = { tool, lockAxis: -1, lockCoord: 0, clueValue: 0, touched: new Set() };
    this.applyBuild(x, y, true);
  }

  private moveStroke(x: number, y: number): void {
    if (!this.stroke) return;
    if (this.mode === 'clues') {
      const hit = this.pickFull(x, y);
      if (!hit) return;
      const axis = hit.normal[0] ? 0 : hit.normal[1] ? 1 : 2;
      if (axis === this.stroke.lockAxis) this.toggleClue(hit.x, hit.y, hit.z, axis);
      return;
    }
    this.applyBuild(x, y, false);
    this.updateHover(x, y);
  }

  private toggleClue(x: number, y: number, z: number, axis: number): void {
    const st = this.stroke!;
    const l = this.grid.lineOf(this.grid.idx(x, y, z), axis as Axis);
    const key = `l${l}`;
    if (st.touched.has(key) || !this.mask) return;
    st.touched.add(key);
    if (this.mask[l] !== st.clueValue) {
      this.mask[l] = st.clueValue;
      sfx.tick();
      haptic(4);
      this.analyzing = true;
      this.renderStatus();
    }
  }

  private applyBuild(x: number, y: number, first: boolean): void {
    const st = this.stroke!;
    const g = this.grid;
    if (st.tool === 'add') {
      const b = this.pickBuild(x, y);
      if (!b) return;
      if (first) {
        st.lockAxis = b.axis;
        st.lockCoord = b.target[b.axis];
      } else if (b.target[st.lockAxis] !== st.lockCoord) return;
      const [tx, ty, tz] = b.target;
      const key = `${tx},${ty},${tz}`;
      if (st.touched.has(key)) return;
      st.touched.add(key);
      if (this.setCell(tx, ty, tz, this.color)) {
        sfx.place();
        haptic(4);
      }
      return;
    }
    const hit = this.pickSolid(x, y);
    if (!hit) return;
    const axis = hit.normal[0] ? 0 : hit.normal[1] ? 1 : 2;
    const c = [hit.x, hit.y, hit.z];
    if (first) {
      st.lockAxis = axis;
      st.lockCoord = c[axis];
    } else if (st.tool === 'remove' && c[st.lockAxis] !== st.lockCoord) return;
    const key = c.join(',');
    if (st.touched.has(key)) return;
    st.touched.add(key);
    if (st.tool === 'remove') {
      if (this.setCell(hit.x, hit.y, hit.z, 0)) {
        sfx.break();
        haptic(4);
      }
    } else if (st.tool === 'paint') {
      if (this.cells[g.idx(hit.x, hit.y, hit.z)] !== this.color && this.setCell(hit.x, hit.y, hit.z, this.color)) sfx.paint();
    }
    // live update of AO etc. happens in draw(); mark model dirty at stroke end
  }

  draw(): DrawList {
    const g = this.grid;
    const scene = this.scene;
    scene.reset(this.dims);
    const colors = this.palette.map(hexToRgb);
    const clueMode = this.mode === 'clues';
    const clues = clueMode ? computeClues(g, this.cells) : null;
    const amb = new Set(this.analysis?.status === 'multiple' ? this.analysis.ambiguous : []);
    const hc = this.hover.cell;
    const hoverIdx = hc ? g.idx(hc[0], hc[1], hc[2]) : -1;
    const hoverLine = clueMode && hoverIdx >= 0 && this.hover.face >= 0 ? g.lineOf(hoverIdx, this.hover.face as Axis) : -1;

    for (let i = 0; i < g.size; i++) {
      const [x, y, z] = g.coords(i);
      scene.solid[i] = (clueMode || this.cells[i]) && this.visible(x, y, z) ? 1 : 0;
    }
    const col = [0, 0, 0];
    for (let i = 0; i < g.size; i++) {
      if (!scene.solid[i]) continue;
      const [x, y, z] = g.coords(i);
      const v = this.cells[i];
      let glyph = NO_GLYPHS;
      if (clueMode) {
        const base = v ? colors[v - 1] : BASE;
        const t = v ? 0.45 : 0;
        for (let c = 0; c < 3; c++) col[c] = BASE[c] + (base[c] - BASE[c]) * t;
        const gl = (a: number) => {
          const l = g.cellLines[i * 3 + a];
          return this.mask && this.mask[l] ? clues![l] : GLYPH_HIDDEN;
        };
        glyph = packGlyphs(gl(0), gl(1), gl(2));
        const ls = [g.cellLines[i * 3], g.cellLines[i * 3 + 1], g.cellLines[i * 3 + 2]];
        if (hoverLine >= 0 && ls.includes(hoverLine)) for (let c = 0; c < 3; c++) col[c] += (0.99 - col[c]) * 0.25;
        if (amb.has(i)) glyph |= FLAG_GLOW;
      } else {
        const c0 = colors[v - 1] ?? BASE;
        col[0] = c0[0];
        col[1] = c0[1];
        col[2] = c0[2];
      }
      if (i === hoverIdx && !clueMode && this.tool !== 'add') glyph |= FLAG_HOVER;
      scene.add(x, y, z, 1, col, glyph);
    }
    scene.computeAO();
    scene.glyphAlpha = 1;

    const [W, H, D] = this.dims;
    const lines: LineBatch[] = [];
    // floor grid
    const pts: number[] = [];
    for (let x = 0; x <= W; x++) pts.push(x - W / 2, -H / 2, -D / 2, x - W / 2, -H / 2, D / 2);
    for (let z = 0; z <= D; z++) pts.push(-W / 2, -H / 2, z - D / 2, W / 2, -H / 2, z - D / 2);
    lines.push({ points: Float32Array.from(pts), color: [0.45, 0.47, 0.62, 0.35] });
    lines.push({ points: boxEdges([-W / 2, -H / 2, -D / 2], [W / 2, H / 2, D / 2]), color: [0.45, 0.47, 0.62, 0.3] });
    if (this.mirrorX) lines.push({ points: boxEdges([0, -H / 2, -D / 2], [0, H / 2, D / 2]), color: [0.9, 0.35, 0.3, 0.6] });
    if (this.mirrorZ) lines.push({ points: boxEdges([-W / 2, -H / 2, 0], [W / 2, H / 2, 0]), color: [0.24, 0.48, 0.88, 0.6] });
    const t = this.hover.target;
    if (!clueMode && this.tool === 'add' && t) {
      const pulse = 0.6 + 0.3 * Math.sin(this.time * 6);
      const c = hexToRgb(this.palette[this.color - 1] ?? '#ffffff');
      const w = (v: number, a: number) => v - this.dims[a] / 2;
      lines.push({ points: boxEdges([w(t[0], 0) + 0.04, w(t[1], 1) + 0.04, w(t[2], 2) + 0.04], [w(t[0] + 1, 0) - 0.04, w(t[1] + 1, 1) - 0.04, w(t[2] + 1, 2) - 0.04]), color: [c[0], c[1], c[2], pulse] });
    }
    if (this.slice.peel > 0) {
      const a = this.slice.axis;
      const min = [-W / 2, -H / 2, -D / 2];
      const max = [W / 2, H / 2, D / 2];
      const cut = this.slice.sign > 0 ? this.dims[a] / 2 - this.slice.peel : -this.dims[a] / 2 + this.slice.peel;
      min[a] = max[a] = cut;
      const c = hexToRgb(AXIS_COLORS[a]);
      lines.push({ points: boxEdges(min, max), color: [c[0], c[1], c[2], 0.9] });
    }
    return { block: scene, lines, shadow: { dims: this.dims, alpha: 0.15 }, time: this.time };
  }

  onKey(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if (mod && k === 'y') {
      e.preventDefault();
      this.redo();
    } else if (mod) return;
    else if (k === 'a') this.setTool('add');
    else if (k === 'e') this.setTool('remove');
    else if (k === 'p') this.setTool('paint');
    else if (k === 'i') this.setTool('pick');
    else if (k === 'tab') {
      e.preventDefault();
      this.setMode(this.mode === 'build' ? 'clues' : 'build');
    } else if (k === ']') this.setPeel(this.slice.peel + 1);
    else if (k === '[') this.setPeel(this.slice.peel - 1);
    else if (k === 'arrowleft') this.app.camera.turn(-1);
    else if (k === 'arrowright') this.app.camera.turn(1);
    else if (k >= '1' && k <= '9') {
      const n = Number(k);
      if (n <= this.palette.length) {
        this.color = n;
        this.refresh();
      }
    }
  }
}
