# Yesteryear

Timeline trivia, inspired by *Timeline*. Place inventions, discoveries and turning points in order before you see their year. Vanilla HTML, CSS and ES modules.

## Decks

305 cards in six decks, each with an English and a French title: **Inventions**, **Science & Discoveries**, **World History**, **History of France**, **Pop Culture** and **Space & Flight**, or everything mixed. The card language is a setting; the interface stays in English.

Each card has an original pixel illustration keyed by its stable ID, delivered in thirteen compact WebP atlases. Paper captions keep titles and revealed years separate from the artwork. Illustrations are stylized interpretations, not documentary reconstructions. See [artwork prompts and provenance](assets/PROMPTS.md).

Every card names its English Wikipedia article. `npm run verify` checks each year against Wikidata; cards whose item has no matching date were checked by hand and record the exact event in `tools/reviewed.mjs`. See [SOURCES.md](SOURCES.md).

## Play

- **Race:** two to six players, hands of six, five or four cards. Place one card per turn; right, it stays; wrong, it is discarded and replaced. When someone empties their hand, the round is finished so everyone has had the same number of turns; ties go to a one-card tie-break round.
- **Streak:** a shared hand of three, refilled after each placement, and three lives. Solo, or co-op with a friend from one shared hand.

Bots (**Casual**, **Buff**, **Historian**) guess each year with a personal error that grows for easier bots and for older events, and play the card they are most confident about.

## Checks

`npm test` checks the decks, plays 200 seeded races at two to six seats (timeline order, card conservation, fair final round), streak lives and redacted views.
