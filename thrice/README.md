# Thrice

A memory card game for two to six players, inspired by *Trio* (originally *Nana*). Vanilla HTML, CSS and ES modules; no packages, images or build step.

## Play

The 36 cards are numbered 1–12, three of each. Every hand is kept sorted; the rest lie face down in the middle. On your turn, reveal cards one at a time: the **lowest** or **highest** card of any hand, yours included, or a **middle** card. While the cards match, keep going. Three of a kind wins that trio and ends your turn; a different card ends your turn and everything goes back.

- **Simple:** three trios, or the trio of 7s.
- **Spicy:** two linked trios, whose numbers add up to 7 or differ by 7 (each card shows its partners), or the trio of 7s.

Two seats is a house duel variant with ten cards each. Hands are 9, 7, 6 and 5 cards at three to six seats.

**Card themes** change only the art: Classic numerals, Bakery, Deep Sea, Night Sky, Garden Bugs and Robots. Icons are system emoji, so the game ships no image files. The optional **memory aid** lists every card revealed so far.

## Bots

Bots play from what anyone at the table could know: their own hand, the public log of revealed cards and which cards were claimed. Older memories fade by difficulty: **Goldfish** forgets within a couple of turns, **Sharp** within several, **Elephant** never. In 60-game tests against two Sharp bots, an Elephant seat won 39 games and a Goldfish seat 7.

## With a friend

Both people plus up to four bots play in the room (`src/room.js`). Each browser receives only its own hand; the bots run in the room. See [playing with a friend](../docs/FRIEND_SESSIONS.md).

## Checks

`npm test` plays 300 seeded games at every table size and both win rules, checking card conservation, sorted hands, legal winners, hidden information in views and that the bot's first choice never depends on hidden cards.
