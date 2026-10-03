# Puzzle Trail

A complete, board-centred chess adventure for absolute beginners. Restore six places along a woodland trail, light an observatory, and learn to play one small discovery at a time.

## Play locally

With Node.js 18 or newer:

```sh
cd puzzle-trail
npm start
```

Open <http://127.0.0.1:4178>. No installation, build step, dependency, account, or internet connection is required. Any static web server can also serve this directory. Use a web server rather than opening `index.html` as a `file:` URL, because browsers restrict local JavaScript modules and workers.

The preview server binds only to the local machine. Set `PORT` to choose another port. The game itself consists entirely of browser-native JavaScript, HTML, CSS, local SVG artwork, and sounds synthesized with Web Audio. No tests, dependencies, CDNs, downloaded fonts, or external services are included.

## The journey

| Place | Encounters | Discoveries |
| --- | ---: | --- |
| Lantern Meadow | 8 | Rook, bishop, knight, queen, pawn, captures, blocked paths |
| Whispering Woods | 6 | Attacks, undefended pieces, protection, safe captures, opponent replies |
| King's Sanctuary | 6 | King movement, check, escape, blocking, checkmate, stalemate |
| Twin Peaks | 6 | Forks, pins, skewers, exchanges, reading an unlabelled position |
| River Crossing | 5 | Pawn advances, promotion, both kinds of castling, en passant |
| The Observatory | 5 | Opening principles, development, cooperating pieces, a final checkmate |

The 36 encounters include movement drills, observation challenges, one-move puzzles, and short encounters with authored opponent replies. Drills explicitly pause opponent turns. Ordinary puzzles and full games share the same chess rules. Goals accept any move satisfying their conditions; hints suggest an example rather than limiting play to one answer.

Each restored region earns a stamp. The field guide records discoveries and remains available for reference. Hints, retries, and rewinds never remove completed progress. There are no lives, clocks, ratings, or compulsory streaks.

## Controls and assistance

- Select your piece, then select its destination. Click or tap an opposing piece with nothing selected to inspect its attacks.
- **Move guide** marks legal destinations for the selected piece. **Threats** marks opponent attacks with `×`; pawn attacks differ from pawn movement.
- **H** reveals the next hint. **U** rewinds. **Escape** clears a selection or dismisses a dialog.
- On the board, use arrow keys to navigate and **Enter** or **Space** to select and move.
- **Flip board** changes the viewpoint. **Settings** controls sound, coordinates, movement guidance, and reduced motion.
- On phones, Milo's guidance and the mission appear above the board.

## Friendly chess practice

The friendly table is available throughout the trail. Play a standard game, or practise a king-and-queen or king-and-rook ending. Choose either colour and a gentle or more thoughtful opponent. Endgame practice gives the chosen side the stronger pieces.

The local opponent runs a small search in a native Web Worker, with a browser-native fallback. It is intended for beginner practice, not expert analysis or a rated challenge. Milo explains observable attacks, check, and rules; he does not claim to identify the best move in every position.

Full games include promotion choices, castling, en passant, legal king safety, checkmate, stalemate, common dead positions, repetition, and move-count draws. Threefold repetition and the fifty-move rule allow a draw claim on your turn; fivefold repetition and seventy-five moves trigger automatic draws. Checkmate takes priority over the move-count draw.

Rewind undoes your decision and the opponent's reply together. An unfinished game can be resumed after returning to the trail or reloading. Progress, preferences, and the game are saved in this browser's local storage; if storage is unavailable, the current session remains playable. Resetting the trail asks for confirmation and preserves preferences and the saved game.

## Files

- `src/chess.js`: shared movement, attacks, legal moves, notation, draw conditions, and opponent search.
- `src/lessons.js`: the 36 authored encounters, region descriptions, hints, and field guide.
- `src/app.js`: interaction, goal evaluation, progression, dialogs, local saves, and practice.
- `src/art.js`: locally drawn piece silhouettes, Milo, lanterns, and the restored world.
- `src/sound.js`: short synthesized sound effects, muted by default.
- `src/opponent.js`: native worker entry point.
- `tools/serve.mjs`: optional local preview server using only the Node standard library.
- `screenshots/`: visual milestones and final desktop, phone, map, and practice views for the PR.

Chess rule reference: [FIDE Laws of Chess](https://handbook.fide.com/chapter/E012023). The game teaches ordinary chess; tournament clocks, touch-move procedures, and competition administration are outside its scope.
