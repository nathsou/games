# Nonocube

3D nonogram puzzles in the browser. A shape hides inside a block of cubes; number clues on each face tell you how many cubes in that row belong to the shape. Break away the rest to reveal it.

Built with TypeScript 7, Vite and hand-written WebGL 2. No runtime dependencies; Playwright is used only for browser checks.

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

Break is selected by default. Click or drag on cubes to apply the selected **Break / Paint** tool; drag the background or right-drag to turn the block. **Hold a key** to use a tool temporarily. The dock always shows both tools, and clicking the active one keeps it selected.

| | Mouse / keyboard | Touch |
|---|---|---|
| Turn the block | Drag the background, right-drag, ← → ↑ ↓ | Drag the background, or two fingers |
| Break | Hold **A** + click / drag | Turn on the hammer, tap / drag |
| Paint (protect) | Hold **D** + click / drag | Turn on the brush, tap / drag |
| Select a tool | Click Break / Paint in the dock | Tap Break / Paint |
| Temporarily swap tools | Hold Shift | Long-press |
| Zoom | Wheel / trackpad pinch | Pinch |
| Peel layers | Drag the axis knobs by the block, `[` `]`, or X / Y / Z | Slider |
| Clear all zero rows | `0` or the dashed-0 button | Dock |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z | Dock |
| Hint · rules · reset view | H · ? · R | Dock / top bar |
| Editor tools | Hold **W** add · **A** remove · **D** paint · **S** sample color (or lock one in the panel) | Panel |

Tool keys can be rebound in **Settings → Advanced**. Row drags lock to the grid axis that best matches the drag direction, and a hammer drag stops at painted (protected) cubes. Every control has a tooltip with its shortcut (long-press on touch).

## Features

- **65 puzzles in 8 galleries** (First Steps, Kitchen, Garden, Critters, Toybox, Outer Space, Chess Set, Architecture), plus a seeded **Daily Sculpture**. Each gallery is a 3D room of plinths: unsolved puzzles show their block (with your saved progress), solved ones show the finished piece, and a freshly solved piece is revealed on its plinth as a "new acquisition".
- **Immersive play**: optional *focus mode* fades the header while keeping the tool dock visible; peeled layers show a hatched cross-section; solving colors the shape in cube by cube and presents a museum plaque. Optional generative ambient music.
- **Interactive tutorial** (3 short lessons, skippable at any point, replayable from the home screen).
- **Level editor**: edit a top-down layer grid with live solver validation, or build with add / remove / paint / pick tools, mirror symmetry, resize, shift, rotate and crop. Auto-generate clues at a chosen difficulty, or tap faces to show and hide individual clues while a live solver badge reports whether the puzzle still has a unique solution and highlights ambiguous cubes. Playtest, save to *My Puzzles*, and share as a link (`#p=<code>`).
- **Clue generator** thins out zero-clues first (they're giveaways, and the game can clear them in one click), then hides further clues while keeping the puzzle uniquely solvable at the chosen difficulty.
- **Solver**: line solver over all three axes with contradiction probing and a backtracking uniqueness check. It powers hints, difficulty rating, clue generation and editor validation, and runs in a web worker for editor-sized puzzles.
- **Mono appearance**: black and white, locally hosted Manrope, crisp outlines and neutral sculptures. Light, Dark and System appearances share tokens with the WebGL scene; System follows device changes live. Clues stay on the outer block planes after cubes break and follow peeled layers.
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

## Browser verification and screenshots

Run the dev server in one terminal, then:

```bash
npx playwright install chromium
npm run test:ui
npm run test:ui -- --screenshots
```

`CHROMIUM_PATH=/usr/bin/chromium` selects an existing browser. `NONOCUBE_URL` selects a different dev-server address. The checks exercise desktop and touch layouts (1160×700, 390×800, and 320×568), tool clicks, protection, held keys, orbit, slicing, persistent clues, undo, appearance changes, saved progress, solving, tutorial skipping, and editor symmetry/save/solver behavior. Screenshot mode captures the running app into `docs/mono-screenshots/`; the supplied prototype screenshots are not used.
