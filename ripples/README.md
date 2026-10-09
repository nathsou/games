# Ripples

Co-op word-chain puzzles, inspired by *Ricochet* (Flip Flap). Vanilla HTML, CSS and ES modules.

## Play

Each puzzle is a short scene whose last line is missing. Two **start** words outside the grid each lead to a grid word; those two words must share a row or a column, and you cover them with pebble 1. Each covered word then leads to the next word of its chain (a synonym, a compound word, a saying, a category…), and each new pair must also share a row or column. When every chain word is covered, three or five words are left. Read aloud in grid order, they sound out the missing line: WARE · OAR · EWE, “Where are you?”; ÎLE · LAIT · TAON, « Il est temps ».

- **Guided** checks each pair as you place it. **Classic** checks only the final line, like the paper game; undo freely.
- **Hints** show the row or column of the next pair, then one of its words, then both. In classic play, a hint tells you which step left the path.

## Puzzles

Eighteen original puzzles, nine per language, in six story campaigns: *The Butterfingers Heist Crew*, *The Haunted Manor* and *Kitchen Brigade* in English; *Le Gang des Bras Cassés*, *Le Château hanté* and *Brigade en cuisine* in French. Each language's puzzles were written for that language's puns, not translated. None of the published Ricochet puzzles, characters or text were used.

Puzzles are stored as their two chains and the leftover words (`src/puzzles.js`). Each new game lays the grid out from them: every pair lands on a shared row or column and the leftover words fill the remaining cells in reading order, so the same puzzle has a fresh grid each time.

## With a friend

**Together** shares one board: either of you places pebbles, takes hints or answers. **Race** gives you each a board of the same grid; your rival sees only your progress, and the path stays hidden until your own board is finished. See [playing with a friend](../docs/FRIEND_SESSIONS.md).

## Checks

`npm test` validates every puzzle (25 distinct words, equal chains, start words outside the grid, accepted answers), 720 layouts, guided and classic solving, hints, answer matching and race privacy.
