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

Select a game and choose **Play the Dealer**, **Pass & Play**, or **Invite a
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

## Direct two-screen play

Invite and Join open the global Friends side panel. Choose the game and team/opponent settings, then share one direct-connection link. There is no reply-link step. Live games use WebRTC, with a private browser resume credential and local table checkpoints for reconnecting after reload. One chat and connection continue across Midnight Table, Cluance and Flip It. HTTPS or localhost is required; restrictive networks may need the site's managed TURN relay. See [friend room behavior and limits](../docs/FRIEND_SESSIONS.md).

Head-to-head gives each player a private hand. Cooperative play shares a hand against the dealer/AI. The host owns the state and stale revisions cannot apply twice. Pending simultaneous commitments are cleared during reconnect, allowing both players to choose again from the saved phase. Midnight remains a live game; Take turns is available for Cluance and Flip It.

## Implementation and checks

Pure seeded reducers are shared by all modes. The host validates online moves
and sends seat-specific views with opponent hands/choices and future decks
removed. Simultaneous head-to-head choices use salted SHA-256 commit/reveal
bound to a game, round, phase and peer seat; both must commit before either
reveals. A reveal mismatch pauses the table. The host remains the trusted state
authority, so this is not an anti-cheat system against a modified host client.

Node's built-in test runner checks rules, invariants over 1,500 seeded automated
playthroughs, redaction, malformed pairing descriptions, commitment binding,
network message handling and QR fixtures. No install is necessary.

The browser playtest report records complete games through actual controls in
solo, local, WebRTC head-to-head and WebRTC cooperative modes, plus pairing,
reply forwarding, disconnect/reconnect, QR decoding and responsive layouts.
Browser automation is a development tool only and is not shipped.

## Art and QR references

The original four-sprite atlas was generated with the built-in image model.
The exact prompt and generation notes are in [assets/README.md](assets/README.md).
Numeric faces, cubes, felt, scanlines and sounds are rendered locally.

The small QR encoder implements Model 2 byte mode, Reed–Solomon correction,
finder/alignment/timing patterns, BCH metadata and mask scoring. Profile
parameters and standard layout were checked against
[Project Nayuki's QR reference](https://www.nayuki.io/page/qr-code-generator-library).
No reference library is imported or shipped.

## Shared AI and themes

Every game can face either the free offline dealer or an AI using the provider/model configured in Similo. Model opponents work in solo and WebRTC team play. The host alone makes provider calls. Simultaneous choices are prepared from a redacted observation before the human locks a choice; hands, future draws and opposing sealed choices never enter a prompt. Public alarm counts and exact immediate auction outcomes help the model interpret ownership correctly.

Provider, models, effort, response budget, optional remembered keys, custom rates and spending history use the collection's shared AI modules. Light, Dark and System themes share the card games' appearance preference. Unsupported model/effort combinations show their provider error without substituting another model. Pause and retry preserve the table. See [shared AI notes](../shared/ai/README.md) for live GPT-6-luna evaluations.
