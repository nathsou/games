# Flip it playtest report

Verified 2026-10-03. Tests used the saved game files, isolated Chrome contexts and actual DOM controls. Browser automation dependencies came from the Codex bundled runtime, outside this project; none are shipped or declared as game dependencies.

## Automated checks

- **25 passing tests**: balanced decks, deterministic deals, card conservation, orientation changes, self-collisions, blocked additions, atomic illegal moves, clearing a space before comparison, both turn rhythms, counter chains, first-finisher tie priority, round scoring, repeat/action-cap draws, private snapshots, malformed snapshots, peer synchronization, stale/out-of-turn rejection, team arbitration, reconnects and pairing codes.
- Rule tests include **400 complete seeded rounds**, fifty under each of the eight option combinations. Every action checks card conservation, table-size uniqueness and both players' redacted network views.
- `npm run playtest` exercises **400 additional dealer-versus-dealer rounds** using only each actor's hand and public information.
- The collection's **49 existing Spacegolf tests** pass.

## Full browser matches

| Mode | Configurations completed |
| --- | --- |
| Solo dealer | All eight combinations, from deal through a two-round match win and rematch |
| Pass and play | All eight combinations, including handoff curtains and rematch |
| WebRTC duel | All eight combinations, both seats acting, hidden opposing hands, identical public tables and scores |
| WebRTC team | All ON and all OFF; both host and guest made shared-hand moves against the dealer |

These are **26 distinct completed match scenarios**. Live duels and team matches were repeated after incoming snapshot validation was tightened. The final live run completed ten matches with zero page exceptions or console errors. Its raw observations are in [tests/browser-playtest-results.json](tests/browser-playtest-results.json).

The initial team-play driver alternated participants using a counter that also counted dealer waits, which accidentally kept choosing the host. That driver assertion failed; the driver was corrected to alternate only teammate turns. Both actual peers then completed matches, including ten and twenty-one guest actions in the final team scenarios. The game did not need a change for that driver issue.

## Focused browser checks

- Real ordered WebRTC data channels connected separate browser contexts, using both a pasted reply and opening a reply link beside the original host tab.
- Closing the guest paused the duel, disabled host action controls and showed reconnect. A fresh invitation from the original host tab restored the exact state and allowed the next move.
- Both peers had to acknowledge a finished round before a new deal. Guests could not change host match settings.
- Previewing a flip did not mutate state and disabled card-playing controls. Changed menu preferences did not alter a resumed match's options.
- Phone-sized UI exercised **Play via Enter, Take, Add and Flip**, checking the handoff curtain contained no private card elements.
- Eight actual Flip actions produced a threefold-position draw; Next Round dealt successfully with the other starting player.
- Invalid invitation input produced readable feedback without replacing the current game.
- Rank shortcuts, Escape clearing, F flipping, rules dialog and root-index navigation worked.
- Widths **320, 390, 768, 1280 and 1440** had no horizontal overflow. Generated card numbers remained real HTML; artwork does not supply numeric game data.
- macOS Vision independently decoded the final live invite QR; decoded bytes matched the invitation link exactly. Regression fixtures cover all seven QR encoder profiles, which were independently decoded when the shared repository encoder was developed.

## Early pacing observations

These are fifty seeded public-information dealer rounds per configuration, not human balance or enjoyment measurements. No dealer round drew in this sample.

| Quick turns | Compact deck | Last chance | Mean actions per round | Longest | Starting-seat wins / other-seat wins |
| --- | --- | --- | ---: | ---: | --- |
| OFF | OFF | OFF | 27.06 | 39 | 20 / 30 |
| ON | OFF | OFF | 20.86 | 26 | 25 / 25 |
| OFF | ON | OFF | 15.08 | 24 | 29 / 21 |
| ON | ON | OFF | 11.56 | 15 | 28 / 22 |
| OFF | OFF | ON | 29.64 | 49 | 29 / 21 |
| ON | OFF | ON | 23.24 | 30 | 26 / 24 |
| OFF | ON | ON | 18.48 | 27 | 30 / 20 |
| ON | ON | ON | 13.52 | 22 | 26 / 24 |

The recommended all-ON setup remains the default. The larger deck and double turns are available when players want longer rounds. The dealer is a heuristic opponent; taking cards was covered explicitly in the focused browser check rather than relying on it to choose that action naturally.

## Practical limits

WebRTC testing used separate contexts on the same computer with STUN disabled. It confirms the real protocol and application behavior, not connectivity through every external NAT. No physical phone camera, real TURN relay, Safari or Firefox was available for this run. Their browser APIs have fallbacks where possible, but are not claimed as playtested here.

The host is authoritative and trusted. Opposing hands are hidden in normal peer views; a malicious host can inspect its own process. The original implementation lost the match on reload; the retro-table update below adds local host saves and exact-state reconnects. Invitations require the reply step; no permanent-room or one-click signalling service is provided.

## Numeric cards and mixed AI tables · 2026-10-03

The follow-up integration supports 2–5 seats and shared AI settings/themes. The full collection passed 104 automated checks. Complete browser matches covered a four-seat solo table, a five-seat WebRTC human duel with three AI/dealer seats, and shared-human team play against multiple opponents. All Midnight solo/model and WebRTC team/model modes completed too. A separate live run completed Flip it against GPT-6-luna in 20 model calls (score 2:1 for the scripted human); the other three games used another 45 calls. Tactical prompt iteration used 18 more GPT-6-luna calls.

Pause/retry, key-redacted failures, both Similo AI role images, remembered config migration, cross-tab preferences and System appearance changes were verified. The live tests used only GPT-6-luna; mocked responses were used for repeatable UI/protocol checks. See [shared verification](../shared/ai/README.md) and its JSON reports.

## Retro table, social play and reconnect · 2026-10-03

The current Flip It, shared AI and Spacegolf suites pass. The dealer playtest also completed 400 rounds across all eight option combinations after changing double turns to right then left. New session tests cover chat ordering, validation, stale/forged messages, throttling, disconnections, host restoration, guest redaction and damaged/denied storage.

Separate Chromium contexts connected using the actual game controls, through a temporary loopback TURN/TCP relay. The managed browser blocks direct, non-proxied UDP, so the relay was needed for this environment; no relay or signaling server is added to the game. Full default duels, full-deck double-turn duels, five-seat human/AI duels and shared-hand team matches all completed. A host reload restored the exact redacted view, then a fresh invite/reply resumed the same authoritative revision. Both peers' final scores agreed. Successful match observations are in [retro-browser-results.json](tests/retro-browser-results.json).

Focused browser checks exercised visible Play, Take, bank deposits, returned/flipped cards, whole-hand flips, anonymous opponent flips and live reactions. Chat drafts and caret focus survived an opponent move; HTML-shaped messages remained plain text. Reduced motion and FX OFF produced no flying-card overlays. Private handoffs contained no private card nodes or lingering overlays. Automatic reply acceptance on paste connected real peers. See [motion results](tests/retro-motion-results.json) and [layout results](tests/retro-layout-results.json).

The active table fits without page scrolling at **1280 × 720**, **1366 × 768** and **1440 × 900**, including a five-seat full-deck table at 1280 × 720. Light and dark appearances were checked, including light-theme body ink. A DOM-only 40-card hand stress check stayed inside widths 768, 1280 and 1440. Widths **320, 390, 768, 1280, 1366 and 1440** had no horizontal page overflow. Phones retain vertical scrolling, with cards wrapping and the chat below the table. Last chance replaces the normal turn prompt to preserve the compact table height.

Fresh screenshots of the lobby, solo table, multiplayer chat, five-player layout, phone layout, card motion, live reactions and light appearance are in [screenshots](screenshots/). The PR description embeds these images from the branch. Browser automation tools and the loopback test relay were kept outside the shipped game. Physical MacBook hardware, Safari, Firefox, phone cameras and external NAT/relay connectivity were not available for this verification.

## Single-space quick turns, browser replay and shared invites (2026-10-03)

- Quick turns now have one visible and legal space per player. Double-turn rules still use right then left. Legacy saved second piles return flipped with card conservation and hidden guest hands covered by regression tests.
- Seven Flip it test files pass, including shared codecs, cross-game token rejection, room-bound replies, multi-round replay retention, private-view persistence and denied storage. Existing Spacegolf and shared AI tests pass.
- Chromium at 1280 × 720: played complete solo matches, checked every recorded action against revision counts across rounds, scrubbed and played replay, filtered highlights, reloaded the library, verified replay does not change the live game, and checked 390-pixel phone layout. Replay flights render inside the native dialog.
- Real WebRTC via a temporary loopback TURN/TCP relay: both Flip it peers retain the same game ID, revision and recording after host reload/reconnect. Guest recording frames contain anonymous opponent hands. No test relay configuration or credentials are shipped.
- Cluance: automatic invite and reply generation, paste-to-accept, invitation navigation within an already-open tab, relay configuration, saved-host reconnect after round one, then all five rounds to a shared win. No page errors.
- Fresh screenshots: 09 quick turns, 10 Cluance invite, 11 replay/log, 12 highlights, 13 phone replay, 14 Cluance win, 15 Flip it invite, 16 replay motion.

## Starred-card opener and one deal button (2026-10-03)

- Both decks contain exactly one physical starred card. Its recipient opens every fresh round; the marker survives flipping and transfers. Tests cover both deck sizes, two to five seats, rotating deal offsets, fresh rounds and forged-marker rejection.
- Lobby uses one Deal the cards button. Table settings chooses one or two human players on this device and bot/AI seats. Settings stay expanded when choices change. Default lobby controls and the game fit 1280 × 720.
- Chromium verified a human opening, a bot opening, the second shared-device human opening behind the correct handoff curtain, and an online guest opening. In double turns the starred recipient gets the right-hand opening action, then the next player gets right and left. No page errors.
- Old unfinished saves keep their current turn and receive the visible physical marker; future rounds use the starred-card deal rule. Older replay views still load without exposing other hands.
- Screenshots 17–19 show the simplified lobby, starred opening hand and player settings. The collection preview is refreshed.


## Human-only friend invites and simpler pairing (2026-10-04)

Friend invitations use separate online opponent preferences and default to two humans, even when legacy solo AI counts and team settings are saved. The zero-opponent choice is always available for a human duel and local setup. A solo deal with zero opponents asks for a second human or an opponent rather than adding one silently; explicit team mode requires an opponent for its shared hand.

Chromium's invite audit verifies the real application/session handshake over a local test transport, including two-human tables, adding optional bots, returning to zero for a new deal, private local handoffs and explicit team play. Native WebRTC offer/reply generation, clipboard copy and paste-to-connect, acceptance of the matching reply, recovery from an invalid reply, relay values surviving dialog rerenders without entering preferences, and dialog widths of 1280, 390 and 320 pixels all passed. This environment produced zero native ICE candidates; live native data-channel and cross-network connectivity remain unverified.

The existing UI audit passed 60 table layouts and 75 dialog checks plus mouse/touch drag and replay interactions, with no page errors. Flip it rule/session/replay/QR tests, shared AI tests and Midnight peer/session tests passed. No signaling service was added.
