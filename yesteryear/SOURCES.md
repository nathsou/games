# Yesteryear sources

Every card in `src/cards.js` names the English Wikipedia article it comes from. `npm run verify` (in this folder, network required) resolves each article to its Wikidata item and checks that the card's year appears in one of its dated properties: discovery or invention, inception, point in time, start or end time, publication, launch, landing, official opening, service entry, first flight or first performance. BCE years are compared with Wikidata's astronomical year numbering.

On 9 October 2026, 229 of the 305 cards matched a Wikidata date. The other 76 link to an article about a person or a general topic, so their item has no date for that specific event. Each was checked by hand against its article; `tools/reviewed.mjs` records the exact event and date the card refers to, such as "Lippershey applies for a patent, 2 October 1608" or "Annonay demonstration, 4 June 1783".

Cards were reworded where an event has several commonly quoted years:

- **Smallpox vaccine** → *Jenner's first smallpox vaccination* (1796), not the 1798 publication.
- **Ballpoint pen patent** → *Bíró's ballpoint pen patent* (1938); John Loud patented a ballpoint in 1888.
- **Black Death reaches Europe** → *reaches Sicily* (1347); the plague was at Caffa, in Crimea, in 1346.
- **Slavery abolished in France** → *abolished for good* (1848); the first abolition was in 1794.
- The Gutenberg press and the Bessemer process were dropped because their years are given differently by different sources.

Titles are short descriptions written for the game in English and French. No text or images were copied from any published timeline game.
