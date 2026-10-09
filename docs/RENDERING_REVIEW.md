# Rendering and loading review — 9 October 2026

The games already use native browser APIs. Cluance, Flip it, Midnight Table,
Spacegolf and Pawn Quest have no framework or runtime bundle. Nonocube uses
TypeScript and Vite, with a native WebGL renderer; its main game chunk builds to
about 153 KB (51 KB gzip). A framework rewrite would not address the issues found.

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

## Follow-up improvements implemented

| Game | Change | Evidence |
| --- | --- | --- |
| Nonocube | Renders on input/state changes while idle; keeps continuous frames for camera motion, reveals, hover effects and particles. Hidden tabs stop scheduling. A lightweight idle clock preserves puzzle time. Graphics settings offer Auto/1×/1.5×/2× resolution and live antialiasing, including local preferences in shared views. | Browser check: zero idle puzzle draws while the timer advances by one second; zoom finishes and returns to zero draws; density and multisample targets change without WebGL errors. |
| Nonocube geometry | Finished home exhibits retain geometry; gallery reveals release their animation state on completion. Ambient occlusion is reused when occupancy and instance positions stay unchanged. | AO regression checks cover changed occupancy, dimensions, instance order/count and animated positions. Camera checks cover zoom and panel framing settling. |
| Pawn Quest | Boards wake on state/input/annotation changes and sleep after effects end. Density is capped at 2× and the board background is cached. The sky uses an 11 FPS timer, pauses when hidden and becomes static with reduced motion. | Browser check: zero idle/settled board draws, annotations and moves wake the board, and the first settled shake frame removes its offset. The existing chess worker is unchanged. |
| Midnight Table | Lossless WebP replaces the PNG sprite atlas; CSS coordinates and pixel edges are unchanged. | 1,566,261 → 1,232,298 bytes (21.3% smaller); decoded 1254 × 1254 RGBA pixels match exactly. |
| Flip it | Keyed DOM updates preserve cards, hand containers, scores and focus. Unchanged subtrees are skipped; animation snapshots are captured only for moves. | Five-player stress fixture with a 36-card hand: selection and peek preserve node identity, accessibility state and focus; selection performs zero card measurements and removes zero card nodes. Existing mouse/touch animations and replay scrubbing pass. |
| Collection / shared shell | Build-generated initial shell markup hydrates in place. Direct card-game links redirect in the document head before game styles paint; explicit solo links and invitation fragments retain their routes. | Delayed-script audit sees the shell and saved theme before JavaScript, confirms that the iframe waits for its parent session, and verifies the iframe is retained during hydration. Save/restore and shared-play regressions pass. |

These changes keep the native browser architecture. No framework migration or
new runtime dependency was needed. Workload counts describe the tested scenes;
they are not device FPS or battery-life measurements.

## Verification

- Node suites for Spacegolf (including deterministic campaign solutions,
  physics, generator and checkpoints), shared code/AI, Flip it and Midnight
  Table passed. Added frame-limit checks at 60/120/144 Hz and graphics-preset
  checks.
- Nonocube type-check, solver/persistence/rendering tests and production build passed;
  the collection asset build and Cloudflare deployment dry run completed.
- All 20 Cloudflare worker tests passed. Existing browser regressions covered
  shared-play input safety, custom/Endless golf saves, Nonocube puzzle identity
  and editor clue masks, and Pawn Quest/Nonocube resume from the room panel.
- Flip it’s UI audit passed 60 responsive table configurations and 75 dialogs,
  mouse and touch drags, per-card move animations, replay scrubbing, and a
  populated five-player table across up to 12 player turns with no browser errors.
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

Run `npm run test:performance:ui` with the static/built site at `GAMES_URL`
(default port 8080) and Nonocube’s Vite server at `NONOCUBE_URL` (default port
5173). It checks Pawn Quest idle rendering, large Flip it hands, and Nonocube
idle timekeeping and live graphics settings. `npm run test:startup:ui` uses the
built site at `GAMES_URL` (default port 8787) to verify initial shell HTML and
routing. Both audits also run in CI.
