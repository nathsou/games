# Flip it

A two-to-five-player shedding game with a pixel HUD, diagonal double-number cards, a compact laptop table and configurable house rules. Vanilla HTML, CSS and JavaScript: no build, npm dependencies, CDN scripts, remote images or external fonts.

Run `npm start` from this folder and open `http://localhost:8080/flip-it/`. Run `npm test` for deterministic rule, privacy, peer session and QR tests, or `npm run playtest` for 400 reproducible dealer rounds. The server serves the collection root too. The collection’s Cloudflare build publishes this folder's index, stylesheet, src, assets and preview together with the shared runtime; see [hosting setup](../docs/CLOUDFLARE.md).

## Match options

All three default ON. The host chooses them before a match; both screens show the locked configuration.

| Option | ON | OFF |
| --- | --- | --- |
| Quick turns | One action each, alternating; one play space per player | Two actions, right then left. Opening player gets only the right action |
| Compact deck | 24 cards, six ranks, dealt clockwise | 40 cards, ten ranks, dealt clockwise |
| Last chance | Emptying a hand gives every other player exactly one counter action | Emptying a hand wins immediately |

Choose a match goal of 1–5 round wins (default 2); 1 is a single game. Exactly one physical card carries a star on both faces. Whoever receives it starts each freshly dealt round, including after draws. The star has no additional power during play. Three appearances of the same full position draw the round. A round also draws after 120 actions (compact) or 180 (full), except that a pending last-chance exchange finishes first. Draws award no win; deal again.

## Rules

Each card has two ranks, an active top rank and an inactive opposite rank. The large upside-down number shows its inactive value; a diagonal color band identifies that reverse rank. The entire hand flips only when taking a Flip action. Cards picked up from the table always flip individually. There is no draw pile.

At the beginning of an action, the set in the acting player's chosen (or prescribed) play space is discarded. Then perform one action:

- **Play** one or more equal active ranks into that space. The rank must be strictly greater than every other set of that size on the entire table. Those lower sets return to their owners' hands flipped, including the actor's other set.
- **Add** exactly one matching card to any exposed set, including your other play space. Compare its new size with the other sets of that size: the lower-ranked set returns to its owner flipped. If the enlarged set loses, all its cards return, including the card just added. Equal ranks at the same size are blocked.
- **Take** an opponent's complete set into your own hand, flipping each card.
- **Flip** all cards in your hand.

A last-chance reply overrides ordinary turn order, including the remainder of a double turn. If the first finisher is still empty after the reply, that player wins even if the responding player also became empty. Otherwise, if the responder became empty, they get their own last-chance window. A successful counter with cards remaining resumes normal turn scheduling from the reply action.

Quick turns use a single play space. Double turns start on the right, then the left. The digital interface selects a play space without discarding immediately. Discard and action are applied together, atomically: changing your choice or attempting an illegal move cannot lose cards. Selecting a different active rank starts a new selection. Select a single matching card before Add; use ADD 1 or drag it onto an exposed set. Your action space is cashed out first, so only your other space can receive an Add. Take needs no selection. Flip preview is informational and cannot play cards.

## Deck

For N ranks (6 or 10), each rank is paired with its next neighbour and the rank two steps ahead, wrapping around. Each pairing has two physical copies. Every rank appears on eight card ends and has four possible opposite ranks. Both decks are designed for Flip it; the full deck is not a reproduction of dnup's exact card inventory. Card artwork, wording and code are original. The game mechanics take inspiration from dnup by Kei Kajino; no claim of affiliation is made.

## Ways to play

- One player against offline bots or AI opponents that receives only its own hand and public table information.
- Pass and play: private cards do not exist in the DOM behind the handoff curtain.
- Two browser peers in a duel, with each opponent's hand redacted.
- Team play: two peers share one hand against bots or AI opponents. Either teammate can act. Host revision checks reject stale competing moves.

## Friend rooms and take turns

Invite and Join open the global Friends side panel. Choose game parameters before sharing one direct-connection link. There is one room and one chat across games; no reply-link flow or separate game invitation dialog. Live tables use reliable ordered WebRTC and preserve the original host's authoritative state, with redacted opponent views. Reloading reconnects using the private browser room credential and resumes the saved match. HTTPS or localhost is required for live play; restrictive networks may need the site's managed TURN relay.

**Take turns** starts a two-human match stored on the server. Play your move and leave; your friend can play while your browser is closed. The server returns only your hand and public information and validates every move against the current revision. Both players choose next round before a new deal. Several turn games can wait in the inbox while you browse or play other games. Current native protocol is v6.

See [friend sessions and recovery limits](../docs/FRIEND_SESSIONS.md) and [hosting](../docs/CLOUDFLARE.md).

## Table talk and motion

Exposed opponent cards sit side by side with both numbers visible. Click or tap their cards to inspect the whole set at a larger size, with upright Top and Flips to labels for each physical card. Crowded strips scroll horizontally; the inspection view follows changes to the public set and never displays hidden hands.

The table Chat button opens the room's shared conversation. Its latest 60 messages/reactions (280-character text) are saved on the server and remain available across games and when either friend is offline. Chat stays separate from game actions and AI prompts.

Visible card flights show plays, bank deposits, takes and cards returning flipped. Your hand flips face by face; an opponent’s anonymous card backs flip without exposing their ranks. Controls pause during movement, so the dealer and player do not outrun the animation. The last-move strip also explains the action and changed ranks.

## Controls and access

Touch and mouse controls have text labels. Keyboard: 1–9 or 0 selects all cards of rank 1–10; Enter plays; F flips; Escape clears selection or closes a dialog. Sound is synthesized with Web Audio and defaults off. Reduced motion is respected, and FX can be disabled. Preferences are stored locally; storage denial falls back to memory.

Generated assets and exact prompt: [assets/README.md](assets/README.md). Browser playtest findings: [PLAYTEST.md](PLAYTEST.md).

## AI opponents and shared appearance

Choose zero to four bot/AI opponents in table settings, up to five total players. Zero is selectable even with one player on this device: invite a friend or switch to two players on the device before dealing. A solo deal needs an opponent and asks you to choose rather than silently adding a bot. A WebRTC duel has two human seats and room for three additional opponents; team play shares one human seat and can face four opponents. Each opponent can use the configured model or the free offline dealer. The host runs every AI move, including during a human duel; guests never receive the host's key or any other hand. Lobby changes apply to a new match.

AI settings are shared with Similo and Midnight Table: provider, per-provider model and reasoning effort, output budget, pricing, and opt-in remembered credentials. Unremembered keys stay in tab memory. OpenAI uses Responses with a strict candidate-index schema. One invalid response gets one correction attempt. Pause, retry, timeout and settings controls preserve the game. Other players' names and logs are data, not instructions. AI memory contains only its own previous short explanations; other players' sealed notes remain private.

Light, Dark and System are available in the top bar, shared with the other card games. System tracks device appearance changes live. Cards remain accessible text rather than baked image numerals.

Prompt evaluations and live browser checks are documented in [shared AI notes](../shared/ai/README.md).

## Saved highlights and replay

Every observed action is recorded locally across rounds. Open **Log & replay** for a visual and textual timeline, scrub or play through the recorded table and hand, or filter to highlights (returns, big sets, banks, last chances and round results). **Saved games** in the lobby opens the last eight recordings after a reload. Online recordings contain only the browser’s visible hand and public table; pass-and-play replay displays only the public table. Storage pressure removes entire older recordings, keeping the current one; denied storage keeps a replay in memory and displays a notice. A recording started midway or with missed updates is labelled incomplete. No chat, deal seeds, credentials or hidden opponent cards enter recordings.

Live connection controls are shared through `shared/friend-session.js` and `shared/peer.js`. Existing quick-turn saves return any cards in the retired second space to their owner flipped without losing cards. Older invitation tokens must be regenerated.

The lobby has one **Deal the cards** button. **Table settings** chooses one or two players on the same device and optional bot seats. These choices determine who is at the table; the dealt starred card determines who opens. Old unfinished saves keep their current turn, gain the visible card marker, and use starred-card starts on the next deal.

## Felt design

The HUD, cards, dialogs and arrow logo follow the supplied Felt mockups. **House rules** opens the turn/deck/ending and match-length controls; **Table settings** retains human, bot and AI seats plus online team play. Felt/Wood is saved per browser; Day/Night uses the shared Light/Dark/System appearance preference. Sound, FX and the game collection remain available below the HUD. Reduced motion and FX off disable the CRT overlay and decorative motion as well as card flights.

Jersey 10/15 fonts are self-hosted in `assets/fonts/` with their SIL OFL licenses. The supplied procedural art was rendered to static PNGs in `assets/table/`; neither the mockup runtime nor its stand-in rules engine ships. The bank stack represents cards removed from play, not a draw pile. Drag matching cards onto your space, a single card onto a rival set to Add, or a rival set into your hand to Take; all use the same rule validation as buttons.

The desktop table fits common laptop viewports, including 1280×720 and 1440×900, with larger hand cards on taller screens. Opponent sets open Add/Grab controls on tap; recent moves stay compact, and Chat opens the global Friends side panel. Card drags support mouse and touch.

## Browser UI regression checks

With the local server running, `npm run test:ui` checks laptop and phone layouts, rules/settings/replay dialog scrolling, both deck sizes and turn modes, multi-card mouse/touch drags, invalid drop indicators, cancellation, per-card flights, interrupted replay cleanup, and native replay slider dragging and keyboard focus. It uses real controls and the read-only, redacted diagnostics.

Playwright and Chromium are optional test tools; neither ships with the game. Install Playwright in your development environment or set `PLAYWRIGHT_MODULE` to its module path. `CHROMIUM_PATH` selects a system browser; `CHROMIUM_NO_SANDBOX=1` supports isolated Linux test containers that require it. `FLIP_IT_URL` overrides the local server URL, and `FLIP_IT_ARTIFACTS` optionally writes fresh screenshots to a directory. Run the collection's `npm run test:cloudflare:ui` for global invitations, settings, private turn games, chat, live reload and phone layout. The ordinary `npm test` remains dependency-free.
