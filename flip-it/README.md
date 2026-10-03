# Flip it

A two-to-five-player shedding game with original retro double-value cards and a compact laptop table and three independent match options. Vanilla HTML, CSS and JavaScript: no build, npm dependencies, CDN scripts, remote images or external fonts.

Run `npm start` from this folder and open `http://localhost:8080/flip-it/`. Run `npm test` for deterministic rule, privacy, peer session and QR tests, or `npm run playtest` for 400 reproducible dealer rounds. The server serves the collection root too. Publish this folder's index, stylesheet, src, assets and preview together; the repository's Pages workflow does this.

## Match options

All three default ON. The host chooses them before a match; both screens show the locked configuration.

| Option | ON | OFF |
| --- | --- | --- |
| Quick turns | One action each, alternating; choose either play space | Two actions, right then left. Opening player gets only the right action |
| Compact deck | 24 cards, six ranks, dealt clockwise | 40 cards, ten ranks, dealt clockwise |
| Last chance | Emptying a hand gives every other player exactly one counter action | Emptying a hand wins immediately |

First to two round wins. Starting player rotates after every round, including draws. Three appearances of the same full position draw the round. A round also draws after 120 actions (compact) or 180 (full), except that a pending last-chance exchange finishes first. Draws award no win; deal again.

## Rules

Each card has two ranks, an active top rank and an inactive opposite rank. The large upside-down number shows its inactive value; a corner badge repeats it upright. The entire hand flips only when taking a Flip action. Cards picked up from the table always flip individually. There is no draw pile.

At the beginning of an action, the set in the acting player's chosen (or prescribed) play space is discarded. Then perform one action:

- **Play** one or more equal active ranks into that space. The rank must be strictly greater than every other set of that size on the entire table. Those lower sets return to their owners' hands flipped, including the actor's other set.
- **Add** exactly one matching card to an opponent's set. The new set size must beat every other set of that size; those lower sets return flipped.
- **Take** an opponent's complete set into your own hand, flipping each card.
- **Flip** all cards in your hand.

A last-chance reply overrides ordinary turn order, including the remainder of a double turn. If the first finisher is still empty after the reply, that player wins even if the responding player also became empty. Otherwise, if the responder became empty, they get their own last-chance window. A successful counter with cards remaining resumes normal turn scheduling from the reply action.

The right space is selected first by default (quick turns still allow either space). The digital interface selects a play space without discarding immediately. Discard and action are applied together, atomically: changing your choice or attempting an illegal move cannot lose cards. Selecting a different active rank starts a new selection. Select a single card before Add; Take needs no selection. Flip preview is informational and cannot play cards.

## Deck

For N ranks (6 or 10), each rank is paired with its next neighbour and the rank two steps ahead, wrapping around. Each pairing has two physical copies. Every rank appears on eight card ends and has four possible opposite ranks. Both decks are designed for Flip it; the full deck is not a reproduction of dnup's exact card inventory. Card artwork, wording and code are original. The game mechanics take inspiration from dnup by Kei Kajino; no claim of affiliation is made.

## Ways to play

- Solo against a dealer that receives only its own hand and public table information.
- Pass and play: private cards do not exist in the DOM behind the handoff curtain.
- Two browser peers in a duel, with each opponent's hand redacted.
- Team play: two peers share one hand against the dealer. Either teammate can act. Host revision checks reject stale competing moves.

## Online pairing

Online play uses a reliable ordered WebRTC data channel and native browser APIs. There is no signalling server: the host clicks Invite to generate an invitation link or QR; the guest opens it and sends a reply link or QR; the host pastes that reply to connect automatically, or uses Accept Reply. Opening a reply beside the original host tab delivers it via BroadcastChannel when supported. Otherwise paste it into the host's reply field. Links contain session descriptions and are not permanent rooms; keep both tabs open while playing. Connection settings and a fresh-invite/reply control remain available after link generation. The lobby’s Table options includes team play and optional AI seats.

QR encoding is the repository's existing dependency-free Model 2 byte encoder, with seven level-L size profiles. A native BarcodeDetector scans in-app where supported. Ordinary phone camera scanning and pasted links work independently of that API. Very long links fall back to copy/share rather than displaying a misleading QR.

Online play requires HTTPS or localhost. The default configurable STUN address is `stun:stun.l.google.com:19302`, which is a network service rather than a shipped library. Leave it blank for local-network tests. Restrictive networks may require a TURN relay supplied in Connection settings. Relay passwords remain in memory and are not saved to preferences or pairing links. No relay is provided by this game.

The host owns the authoritative state and sees the dealt hands internally. This design keeps normal opponent UI and network views private; it does not defend against a malicious host editing code. Invalid/stale actions cannot mutate state. Disconnects pause online actions and the team dealer. The last opponent and the host’s authoritative match are saved locally, with a redacted view on the guest. Reloading opens the saved table paused; Reconnect makes a fresh invite and resumes the same match after the reply. The lobby also remembers the last opponent. Explicitly leaving the online table or starting an offline game clears the saved match. Storage denial falls back to keeping the match in the open tab. TURN passwords and pairing links are never persisted. Both players must use the current protocol (v2) for right-first turns.

## Table talk and motion

Online duel and team tables include private peer-to-peer chat (240 characters per message, the latest 60 messages) and six reactions. Both peers see the same host-ordered messages. Chat is independent of turns, game revision and AI prompts; messages and reactions stay in memory. A short rate limit prevents reaction floods.

Visible card flights show plays, bank deposits, takes and cards returning flipped. Your hand flips face by face; an opponent’s anonymous card backs flip without exposing their ranks. Controls pause during movement, so the dealer and player do not outrun the animation. The last-move strip also explains the action and changed ranks.

## Controls and access

Touch and mouse controls have text labels. Keyboard: 1–9 or 0 selects all cards of rank 1–10; Enter plays; F flips; left/right changes space in quick-turn mode; Escape clears selection or closes a dialog. Sound is synthesized with Web Audio and defaults off. Reduced motion is respected, and FX can be disabled. Preferences are stored locally; storage denial falls back to memory.

Generated assets and exact prompt: [assets/README.md](assets/README.md). Browser playtest findings: [PLAYTEST.md](PLAYTEST.md).

## AI opponents and shared appearance

Choose zero to four AI seats in the lobby, up to five total players. Solo includes at least one opponent. A WebRTC duel has two human seats and room for three additional opponents; team play shares one human seat and can face four opponents. Each opponent can use the configured model or the free offline dealer. The host runs every AI move, including during a human duel; guests never receive the host's key or any other hand. Lobby changes apply to a new match.

AI settings are shared with Similo and Midnight Table: provider, per-provider model and reasoning effort, output budget, pricing, and opt-in remembered credentials. Unremembered keys stay in tab memory. OpenAI uses Responses with a strict candidate-index schema. One invalid response gets one correction attempt. Pause, retry, timeout and settings controls preserve the game. Other players' names and logs are data, not instructions. AI memory contains only its own previous short explanations; other players' sealed notes remain private.

Light, Dark and System are available in the top bar, shared with the other card games. System tracks device appearance changes live. Cards remain accessible text rather than baked image numerals.

Prompt evaluations and live browser checks are documented in [shared AI notes](../shared/ai/README.md).
