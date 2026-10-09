# Rendering and loading review — 8 October 2026

The games already use native browser APIs. Cluance, Flip it, Midnight Table,
Spacegolf and Pawn Quest have no framework or runtime bundle. Nonocube uses
TypeScript and Vite, with a native WebGL renderer; its main game chunk builds to
about 151 KB (51 KB gzip). A framework rewrite would not address the issues found.

## Changes implemented

- **Cluance:** removed the startup barrier that downloaded and decoded all 62
  artwork atlases. The default home now requests 2 files / 1,418,102 bytes,
  versus 62 files / 34,346,656 bytes before (about 96% less artwork transferred).
  Other decks load as needed, including shared-view cards. Failed requests can
  be retried; AI observations await their role's artwork to avoid sending blank
  cards. Canvas dimensions stay fixed while artwork loads.
- **Reload appearance:** a small external, synchronous script applies the saved
  Light/Dark/System preference before styles paint in the card games, collection
  and outer room page. Cluance also ships an initial HTML layout and preloads its
  main fonts. No framework or build step was introduced.
- **Spacegolf artifacts:** replaced powers of signed values with multiplication,
  clamped noise used by fractional powers, corrected reversed `smoothstep`
  edges, and protected zero-length line segments. These operations previously
  had undefined GLSL results that can contaminate HDR/bloom pixels. Also fixed
  the lens list capacity to accept the intended four black holes.
- **Spacegolf performance:** reduced-resolution backdrop, actual shader octave
  limits, fewer bloom levels on Medium, no bloom/glass passes on Low, optional
  stars-only background, 30/60 FPS cap, and hidden-tab suspension. Static aim
  previews are reused until the shot changes; orbiting levels retain live hints.
  UI rendering stays sharp when scene resolution is reduced. Graphics changes
  take effect at the next frame boundary, avoiding render-target recreation in
  the middle of a frame.
- **Controls:** Gameplay and Graphics tabs fit a phone-width screen. Graphics
  includes Auto/High/Medium/Low, frame limit, background, glow and frosted glass.
  Auto starts at Medium and steps down under sustained load. All preferences
  persist, without changing deterministic physics or saved recordings.

At 960 × 720 and device pixel ratio 1, the browser audit counted the following
full-screen draw calls on the title scene. These are workload counts, not an FPS
or battery-life benchmark; instanced object/UI calls are additional.

| Setting | Full-screen passes/frame | Scene pixels |
| --- | ---: | ---: |
| Previous renderer | 32 | 691,200 |
| High | 33 | 691,200 |
| Medium / initial Auto | 23 | 499,392 |
| Low | 4 | 388,800 |

High adds a cheap upscale pass so the expensive nebula shader runs on one quarter
of the scene pixels. A 30 FPS cap further halves the target rendering frequency
relative to 60 FPS. Actual gains depend on device, resolution and level.

## Suggested next improvements

| Game | Evidence | Suggested work |
| --- | --- | --- |
| Nonocube | `src/app.ts` draws every animation frame; the renderer uses antialiasing and up to 2× pixel density. | Add render-on-change while the camera and puzzle are idle, plus pixel-density/antialiasing options. Cache static gallery geometry and ambient-occlusion calculations between changes. |
| Pawn Quest | `src/board.js` redraws every connected board every animation frame; board pixel density is uncapped. The background already runs at about 11 FPS. | Redraw idle boards only after input/state changes, keeping animation frames for active effects. Cap board density on high-DPI phones and cache the static board layer. Preserve the existing AI worker. |
| Midnight Table | `assets/sprites.png` is about 1.5 MB and used as a CSS sprite atlas. | Compare lossless WebP delivery against PNG, preserving exact atlas dimensions and pixel-art edges. Preload only if cold-load profiling shows it delays visible cards. |
| Flip it | Small texture assets and event-driven rendering already keep idle work low. `render()` replaces the whole app, and card motion captures/clones all visible cards. | Preserve unchanged hand/score DOM during turn updates; profile large five-player hands before changing the animation code. Keep the current reduced-motion support. |
| Collection / shared shell | Direct card-game URLs route through the outer room page before loading the game iframe. | Consider build-generated initial shell HTML and earlier routing if slow-network traces still show an intermediate-page flash. Keep room reconnection and saved-game routing intact. |

## Verification

- Node suites for Spacegolf (including deterministic campaign solutions,
  physics, generator and checkpoints), shared code/AI, Flip it and Midnight
  Table passed. Added frame-limit checks at 60/120/144 Hz and graphics-preset
  checks.
- Nonocube type-check, solver/persistence tests and production build passed;
  the collection asset build completed.
- `tools/rendering-audit.mjs` checks Cluance's first paint with application code
  delayed, selective artwork requests, artwork failure/retry, and populated AI
  images without making provider calls. It exercises Spacegolf's real pointer
  controls, phone layout, persistence, framebuffer completeness, hidden-tab
  pause, camera following and finite HDR pixels beyond the original bounds.
- Chromium checks include positive and negative camera positions out to
  20,000 world units, all sprite types and zero-length segments. No WebGL errors
  or uncaught browser errors were found. The original black-square artifact was
  not reproduced on this environment's software renderer; confirmation on the
  originally affected GPU remains useful.

Run `npm run test:rendering:ui` against a static server on port 8080, or set
`GAMES_URL`. `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and `CHROMIUM_NO_SANDBOX=1` can
select an existing browser installation. The audit also runs in the existing CI
browser job against Wrangler.
