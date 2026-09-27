# Nonocube

3D nonogram puzzles in the browser. A shape hides inside a block of cubes; number clues on each face tell you how many cubes in that row belong to the shape. Break away the rest to reveal it.

Built with TypeScript 7, Vite and hand-written WebGL 2 — no other dependencies.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # solver / generator / codec tests (Node's built-in runner)
npm run build      # type-check + production build into dist/
```

## Rules

- A plain number: that many cubes stay, all in one group.
- A circled number: that many cubes, split into exactly 2 groups.
- A squared number: that many cubes, split into 3 or more groups.
- No number: no information about that row.

**Classic** mode counts a strike when you break a cube that belongs to the shape (5 allowed). **Zen** mode doesn't check until the end, unless you turn on *Warn on wrong breaks*, which blocks such breaks with a warning and no penalty. Rows whose remaining cubes match their clue and are all painted are greyed out (Picross 3D Round 2 style; can be turned off).

## Controls

Controls work like Picross 3D: with no tool active, clicking and dragging just turns the block. To act on cubes, **hold a key** while clicking, or **lock a tool** by clicking it in the dock (click it again or press Esc to go back to rotating).

| | Mouse / keyboard | Touch |
|---|---|---|
| Turn the block | Drag anywhere (no tool active), right-drag, ← → ↑ ↓ | Drag anywhere, or two fingers |
| Break | Hold **A** + click / drag | Turn on the hammer, tap / drag |
| Paint (protect) | Hold **D** + click / drag | Turn on the brush, tap / drag |
| Lock a tool | Click Break / Paint in the dock · Esc releases | Tap Break / Paint |
| Swap the locked tool | Hold Shift | Long-press |
| Zoom | Wheel / trackpad pinch | Pinch |
| Peel layers | Drag the colored knobs by the block, `[` `]`, or X / Y / Z | Slider |
| Clear all zero rows | `0` or the dashed-0 button | Dock |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z | Dock |
| Hint · rules · reset view | H · ? · R | Dock / top bar |
| Editor tools | Hold **W** add · **A** remove · **D** paint · **S** sample color (or lock one in the panel) | Panel |

Tool keys can be rebound in **Settings → Controls**. Row drags lock to the grid axis that best matches the drag direction, and a hammer drag stops at painted (protected) cubes. Every control has a tooltip with its shortcut (long-press on touch).

## Features

- **65 puzzles in 8 collections** (First Steps, Kitchen, Garden, Critters, Toybox, Outer Space, Chess Set, Architecture), plus a seeded **Daily Sculpture**.
- **Interactive tutorial** (3 short lessons, skippable at any point, replayable from the home screen).
- **Level editor**: build with add / remove / paint / pick tools, mirror symmetry, resize, shift, rotate and crop. Auto-generate clues at a chosen difficulty, or tap faces to show and hide individual clues while a live solver badge reports whether the puzzle still has a unique solution and highlights ambiguous cubes. Playtest, save to *My Puzzles*, and share as a link (`#p=<code>`).
- **Clue generator** thins out zero-clues first (they're giveaways, and the game can clear them in one click), then hides further clues while keeping the puzzle uniquely solvable at the chosen difficulty.
- **Solver**: line solver over all three axes with contradiction probing and a backtracking uniqueness check. It powers hints, difficulty rating, clue generation and editor validation, and runs in a web worker for editor-sized puzzles.
- Progress, stars, best times and in-progress games are saved in `localStorage`. There are light and dark themes, a left-handed layout, a reduced-motion option and synthesized sound effects.

## Layout

```
src/core      grid geometry, clue encoding, share-code codec, RNG
src/solver    line solver, propagation/probing/search, clue generator, worker + client
src/render    WebGL 2 renderer (instanced cubes, glyph atlas, AO, particles), camera, picking
src/game      play session (undo, strikes, hints), storage/settings
src/ui        screens (home, collections, play, tutorial, settings), gestures, DOM helpers
src/editor    level editor
src/data      voxel modeling DSL and the puzzle collections
scripts       preview.ts — print models as ASCII and check they're uniquely solvable
test          node --test suites
```
