# Midnight Table

Three quick games in one original retro card room: **Backhand**, **Closing Time**,
and **Pocket Heist**. Vanilla HTML, CSS and ES modules; zero packages, build steps,
external fonts, analytics, CDN assets, or signaling servers.

## Run

From this directory, with Node 22 or newer:

    npm start
    # http://localhost:8080/midnight/
    npm test

The server serves the repository root, including the games index. Any static
server works. Deployment is included in the existing GitHub Pages workflow.

## Play

Select a game and choose **Play the Dealer**, **Pass & Play**, or **Play a
Friend**. Use the Rules button for an illustrated explanation. Cards are selected
before a separate lock-in action; no accidental one-click commitments.

- **Backhand:** start with ranks 1–5. Higher simultaneous bid wins the visible
  prize; exchange played cards. Ties carry over. Nine prizes worth a total of 18
  points; a final tied pot is discarded.
- **Closing Time:** five cubes per player; invest in one of three auctions, then
  tick another auction's clock. At three ticks the highest bid scores. First
  bidder keeps tie priority even after moving their cube. Empty auctions award
  nothing. Cubes return, closed auctions refill, and all nine auctions finish
  after exactly 27 ticks. With only one auction left, tick that auction.
- **Pocket Heist:** three alarms and three bluffs, five rounds. Higher-value loot
  goes in the vault; lower-value loot stays outside. Defenses lock before raid
  choices. Take the outside loot safely, or raid both piles: an alarm awards
  both to the defender; a bluff awards both to the attacker. Every defense is
  revealed and spent. Loot values are 2, 3 and 5. One defense remains unused.

Pass & Play renders no private cards during handoffs. Closing Time is public, so
it can alternate seats without a privacy curtain. Solo bots choose simultaneous
moves before your choice is revealed. Points and game wins stay distinct.

Keyboard: Tab and Enter/Space operate buttons; 1–6 selects a card and Enter locks
it. Touch and mouse work throughout. Sound is synthesized locally with Web Audio
and starts off. Visual effects can be disabled; reduced-motion preferences are
respected. Your preferences and game checkpoint are saved in the browser.

## Playing with a friend

**Play with …** (or **Play a friend** before anyone has joined your room) opens the Play together window's setup sheet: the game, and a duel or a team against the dealer or an AI. The game runs on the room's server, so it plays live when you're both at the table and waits when one of you leaves. Simultaneous choices stay hidden until both are locked; the other player only learns that a choice is locked. Both people confirm before the next round. In team play the dealer plays in the room, and an AI opponent uses the creator's provider settings while the creator has the game open. See [playing with a friend](../docs/FRIEND_SESSIONS.md).

## Implementation and checks

Pure seeded reducers are shared by all modes. Solo and pass-and-play run in the
browser; games with a friend run the same reducers in the room
(`cloudflare/turn-games.js`), which sends seat-specific views with opponent
hands, unrevealed choices and future decks removed.

Node's built-in test runner checks rules, invariants over 1,500 seeded automated
playthroughs, redaction and malformed snapshots. No install is necessary. Room
play is covered by the collection's `npm run test:cloudflare` suite.

Browser automation is a development tool only and is not shipped.

## Art references

The original four-sprite atlas was generated with the built-in image model.
The exact prompt and generation notes are in [assets/README.md](assets/README.md).
Numeric faces, cubes, felt, scanlines and sounds are rendered locally.

## Shared AI and themes

Every game can face either the free offline dealer or an AI using the provider/model configured in Similo. Model opponents work in solo play and in team play with a friend, where the game's creator alone makes provider calls. Simultaneous choices are prepared from a redacted observation before the human locks a choice; hands, future draws and opposing sealed choices never enter a prompt. Public alarm counts and exact immediate auction outcomes help the model interpret ownership correctly.

Provider, models, effort, response budget, optional remembered keys, custom rates and spending history use the collection's shared AI modules. Light, Dark and System themes share the card games' appearance preference. Unsupported model/effort combinations show their provider error without substituting another model. Pause and retry preserve the table. See [shared AI notes](../shared/ai/README.md) for live GPT-6-luna evaluations.
