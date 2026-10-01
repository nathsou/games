# Spacegolf

A golf game in space. Slingshot the ball around planets, let gravity bend its
path, and sink it in the hole in as few strokes as you can.

* **WebGL2 + vanilla JS**, zero dependencies, no build step.
* **No HTML UI.** The page is a single `<canvas>`; every button, label and
  panel is drawn by the WebGL UI pass (text comes from a glyph atlas that is
  rasterised once at startup).
* **Everything is procedural**: planets, nebulae, black-hole lensing, sound.
  No image or audio files are loaded.
* **Modern look**: an HDR render pipeline (see *Rendering* below), frosted-glass
  UI that blurs the scene behind it, soft shadows, three font weights, and
  eased motion.
* Works with **mouse, touch (tablet) and keyboard**.

## Run it

ES modules need a web server (they don't load from `file://`):

```sh
cd spacegolf
node tools/serve.mjs        # or: npm start       -> http://localhost:8080/
# any static server works too, e.g.  python3 -m http.server
```

## How to play

| Input | Action |
| --- | --- |
| Drag anywhere, release | Pull back and shoot (the further you pull, the harder). Right-click cancels. |
| Arrow keys, `Space` | Aim and fire with the keyboard |
| Hold pointer during flight, or `F` | Fast-forward |
| `R` / `U` / `G` / `Esc` | Retry / undo last shot / cycle gravity view / back |

The dotted line previews the first few seconds of the shot (adjustable in
Settings). Planets that orbit keep moving while you aim, so the preview always
shows where things *will* be, and timing is part of the puzzle.

Strokes count against **par**; ★ for finishing, ★★ for par or better, ★★★ for
par or better while collecting every pickup. Losing the ball (black hole, sun,
leaving the frame) costs +1 stroke and returns it to its last resting place.

## Game modes

* **Campaign**: 30 hand-made holes in 5 worlds (Home Orbit, Strange Surfaces,
  Moving Parts, Dark Matter, Cosmic Chaos).
* **Endless**: a new, verified-solvable hole whenever you want, at six difficulty
  levels (optionally ramping up every 3 holes). Every hole has a seed that can be
  shared (`#seed=K7F2QX&d=3`) or typed in on the on-canvas keypad. The next hole
  is generated in the background while you play.
* **Create**: a level editor (planets, bumpers, black holes, suns, wormholes,
  wind zones, pickups, orbits, tee and hole). Test a level to verify it, save it,
  and share it as a link (`#level=...`).

## Rendering

* The world is drawn into a half-float (HDR) target, so suns, lava and the hole's
  rim can exceed 1.0. A five-level bloom pyramid, black-hole lensing, a filmic
  highlight shoulder, a touch of grading, vignette and film grain finish the frame.
  If the browser can't render to half-float it falls back to 8-bit.
* Planets are shaded per pixel: gradient-noise fBm with level-of-detail (no
  shimmering on small planets), bump-mapped craters/dunes/cracks, ocean specular,
  clouds, city lights on the night side, atmospheric rim scattering, and light that
  comes from the level's sun when it has one.
* The backdrop is a domain-warped nebula with dust lanes and sparse, colour-tempered
  stars. The playfield is marked with corner brackets and everything outside it is dimmed.
* The UI pass blurs the finished frame into two small textures; panels and
  buttons sample them (`ui.glass`) for the frosted look, with drop shadows and
  a light-catching edge. Text uses a three-weight glyph atlas.

## Physics, in one paragraph

Everything runs on one deterministic fixed-step simulation (`src/physics.js`,
180 Hz velocity-Verlet): N-body gravity from every planet, repulsor and black
hole; atmospheric drag; per-surface bounce and friction (rock, ice, rubber,
sticky goo); wormholes; wind zones; and bodies on analytic circular orbits so
their position is a pure function of time. The aiming preview, the live flight,
the level generator and the offline solver all share it, so a preview matches
the real flight exactly.

## Procedural levels

`src/generator.js` builds levels *backwards from a solution*: it lays out a
random star system, fires a chain of simulated shots from the tee (keeping the
most interesting one each time) and puts the hole where the last shot comes to
rest, so every level is solvable by construction and its par is the length of
the chain. It then:

* rejects solutions a human couldn't execute (the last shot must survive small
  aim errors; earlier shots must reliably land on the same planet),
* rejects levels that a brute-force search (`src/solver.js`) can crack with a
  hole-in-one,
* places the pickups along the solution path so ★★★ is always achievable.

## Project layout

```
index.html            one <canvas>, nothing else
src/main.js           bootstrap (+ WebGL2 error message)
src/app.js            main loop, scene switching, animated menu backdrop
src/nav.js            wires scenes together, URL hash routes
src/physics.js        deterministic simulation (pure, DOM-free)
src/generator.js      procedural levels   src/solver.js   brute-force search
src/campaign.js       hand-made levels    src/solutions.js (generated pars/solutions)
src/renderer.js       WebGL2 passes       src/shaders.js  all GLSL
src/ui.js, text.js    immediate-mode UI + glyph atlas
src/audio.js          WebAudio synthesis
src/scenes/*.js       title, campaign, game, endless, settings, create, editor
tools/solve.mjs       verify campaign levels, find par, place pickups (--write)
tools/explore.mjs     sweep a hole's position to tune difficulty
tests/                node:test suites (physics, generator, solutions, editor ops)
```

## Development

```sh
npm test                       # physics, generator, campaign solutions, editor ops
node tools/solve.mjs --write   # after editing src/campaign.js: re-solve every level
node tools/solve.mjs w2-3      # check a single level (don't combine with --write)
```

Because gravity bends every trajectory, hand-made levels are verified by
simulation rather than by eye: `tools/solve.mjs` finds a *robust* solution for
each one (it must tolerate small aim errors), records the par, and the test
suite replays those solutions on every run.

A note on determinism: `Math.sin/cos` can differ in the last bit between
JavaScript engines, so a seed regenerates the same hole on the same browser
engine; a *level link* (`#level=`) is exact everywhere.
