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
respected. Only your name, sound/effect preferences and STUN setting are saved.

## Direct two-screen play

1. Host selects a game and opens **Invite a Friend**. For cooperative play,
   enable **Play together against the dealer** before creating the invitation.
2. Share the invitation link or display its QR code. The guest opens it and gets
   a reply link/QR.
3. The guest sends their reply back. The host pastes it into the invitation
   dialog, scans its QR, or opens the reply link in another tab of the same
   browser profile. A BroadcastChannel delivers that reply to the original
   hosting tab.
4. Keep both game tabs open. The host deals rematches or chooses another game.

Head-to-head mode gives each player their own hand. In cooperative mode both
peers see the same hand and either teammate can make the next move against the
dealer. Discuss a move together; the first accepted move is shared by both
screens. Revision checks prevent a second stale click from applying twice.

QR codes are generated in this repository without a QR dependency. Camera
scanning uses the browser's native BarcodeDetector when it supports QR codes.
Otherwise use your phone's normal camera to open an invitation, or copy/paste
links. Large uncompressed links fall back to sharing text if they exceed QR
capacity. Clipboard and system sharing have text-selection fallbacks.

WebRTC and commitment hashing require HTTPS or localhost. The hosted Pages site
provides HTTPS. A localhost invitation works between tabs on the same machine;
for another device use a reachable HTTPS URL, not a localhost URL.

A default public STUN address helps peers discover direct routes; it exchanges
connection metadata, not game messages. It is a network service, not a code
dependency. Clear it for local connections, or enter your own STUN address.
Some NATs/firewalls cannot form a direct route and require a user-supplied TURN
relay. Configure its address and credentials in Connection Settings on both
peers. TURN passwords remain only in memory. There is no hosted relay or
single-click signaling service hidden in this project.

A disconnected table pauses. Re-pair from the original host tab to resume the
last game state, including an auction's unfinished turn. Pending simultaneous
commitments are cleared during re-pairing. Reloading or closing the host tab
loses the in-memory table; create a fresh invitation. Invite/reply codes are
one-use descriptions tied to a room; replies from another room are rejected.

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
