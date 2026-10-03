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

The host is authoritative and trusted. Opposing hands are hidden in normal peer views; a malicious host can inspect its own process. A reload of the original host tab loses the match. Invitations require the reply step; no permanent-room or one-click signalling service is provided.

## Numeric cards and mixed AI tables · 2026-10-03

The follow-up integration supports 2–5 seats and shared AI settings/themes. The full collection passed 104 automated checks. Complete browser matches covered a four-seat solo table, a five-seat WebRTC human duel with three AI/dealer seats, and shared-human team play against multiple opponents. All Midnight solo/model and WebRTC team/model modes completed too. A separate live run completed Flip it against GPT-6-luna in 20 model calls (score 2:1 for the scripted human); the other three games used another 45 calls. Tactical prompt iteration used 18 more GPT-6-luna calls.

Pause/retry, key-redacted failures, both Similo AI role images, remembered config migration, cross-tab preferences and System appearance changes were verified. The live tests used only GPT-6-luna; mocked responses were used for repeatable UI/protocol checks. See [shared verification](../shared/ai/README.md) and its JSON reports.
