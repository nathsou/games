# Pawn Quest

A chess teacher in the shape of a retro adventure. You are a little pawn who dreams of
reaching the eighth rank and becoming a queen; Professor Pip, an owl, teaches you chess
on the way, from "what is a square called?" to forks, pins and checkmating with a rook.

* **Vanilla JS, no dependencies, no build step.** ES modules, a Web Worker for the engine,
  canvas for the board and map, the DOM for everything else.
* **All art and sound are procedural**: pieces are authored as 16×16 silhouettes and shaded
  automatically, the map biomes are generated, music and effects are synthesised with WebAudio.
* **The coach is algorithmic** (no LLM): an alpha-beta engine, static exchange evaluation,
  pattern detectors for forks, pins, skewers, discovered attacks and mate threats, and
  opening/endgame principles turn engine scores into plain-language explanations.

## Run it

ES modules and workers need a web server:

```sh
cd games            # repository root (the game imports ../shared/theme.js)
npx http-server -c-1   # or: python3 -m http.server
# open http://localhost:8080/pawn-quest/
```

## What's inside

| Mode | |
| --- | --- |
| **The Quest** | 53 levels over 8 worlds ("ranks"). Each world teaches one theme and ends with a boss. |
| **Arena** | Normal chess against 7 characters of increasing strength (or a friend on the same device). Optional coach comments, blunder warnings, danger vision and undo. After the game, a review grades every move and can save your mistakes. |
| **Practice** | Daily puzzle, endless generated drills (mate in one, free pieces, forks, rescues), Coordinate Rush, and the Mistake Gym built from your own games. |
| **Codex** | Every rule, idea and tactic you've unlocked, with a looping demo board. Coach messages link to it. |

### The eight ranks

1. **Rook Road**: the board, rook, bishop, queen, capturing, guarded squares. Boss: Grabby Gus (capture-everything battle).
2. **Knight Woods**: knight, king, protection. Boss: Sir Prance ("capture the king", a gentle lead-in to check).
3. **Pawn Plains**: pawn moves, captures, promotion. Boss: Sergeant Stomp (Pawn Wars).
4. **Check Castle**: check, escaping check, checkmate, stalemate. Boss: King Rollo (mate with king and queen).
5. **Hanging Gardens**: piece values, hanging pieces, "checks, captures, threats". Boss: Sir Hangs-a-Lot (first full game).
6. **Castle Coast**: castling, en passant, promotion choices, draws. Boss: Turtle Tess.
7. **Tactics Tower**: forks, pins, skewers, discovered attacks, mate in two. Boss: Fiona Forks.
8. **Crown Summit**: opening principles, the opening race, rook mates, the rule of the square. Final boss: the Iron Queen.

Levels come in four kinds: **collect** (move a piece to grab stars without stopping on guarded
squares; par is computed by breadth-first search), **quiz** (tap squares or pick an answer;
answers are computed from the position), **puzzle** (handmade or generated and verified by the
engine), and **battle** (play a character with a goal and up to three stars).

## Code map

| File | Role |
| --- | --- |
| `src/chess.js` | 0x88 rules: legal moves, SAN, FEN, draws, and the teaching variants (no kings, king capture, capture-all, pawn wars). Verified with perft. |
| `src/engine.js` | Evaluation (tapered PSTs, pawn structure, mop-up) and alpha-beta search with quiescence, TT and killers; bot personalities (noise, believable blunders, greed, style). |
| `src/coach.js` | SEE, hanging pieces, threat detection, tactic recognition, move grading and explanations, hints. |
| `src/gen.js` | Procedural puzzles, each verified by the engine. |
| `src/brain.js`, `worker.js`, `ai.js` | Engine requests run in a Web Worker (main-thread fallback). |
| `src/curriculum.js`, `levelkit.js`, `level.js` | Level data, pure level logic, and the level screen. |
| `src/board.js`, `sprites.js`, `font.js`, `sky.js`, `map.js` | Rendering: board, pixel art, bitmap font, sky, world map. |
| `src/game.js`, `arena.js`, `practice.js`, `codex.js` | Games against bots, free play, practice and codex screens. |
| `src/audio.js` | Chiptune sound effects and music. |
